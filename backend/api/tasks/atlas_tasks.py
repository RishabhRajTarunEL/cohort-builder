"""
Celery tasks for asynchronous operations
"""
import json
import logging
import os
import pickle
import sqlite3
from pathlib import Path
from typing import List, Dict, Optional
from celery import shared_task
import requests
import pandas as pd
from django.conf import settings
from api.services.schema import SchemaGenerator, EmbeddingGenerator
from api.storage import get_gcs_storage
from api.models import AtlasProcessingTask

logger = logging.getLogger(__name__)


def generate_schema_keys(db_path: str, schema: Dict) -> Dict:
    """
    Extract primary and foreign key relationships from SQLite database.
    
    Args:
        db_path: Path to SQLite database file
        schema: Database schema dictionary
    
    Returns:
        Dictionary mapping table names to their primary keys and foreign keys:
        {
            "table_name": {
                "pk": "primary_key_field",
                "fks": {"foreign_key_field": "referenced_table"}
            }
        }
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    schema_keys = {}
    
    for table_name in schema.keys():
        try:
            # Get primary key from table_info
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = cursor.fetchall()
            # Column structure: (cid, name, type, notnull, default, pk)
            pk = next((col[1] for col in columns if col[5] == 1), None)
            
            # Get foreign keys
            cursor.execute(f"PRAGMA foreign_key_list({table_name})")
            fk_rows = cursor.fetchall()
            # FK structure: (id, seq, table, from, to, on_update, on_delete, match)
            fks = {row[3]: row[2] for row in fk_rows}
            
            schema_keys[table_name] = {
                "pk": pk,
                "fks": fks
            }
            
            logger.info(f"Extracted keys for table {table_name}: pk={pk}, fks={len(fks)}")
            
        except Exception as e:
            logger.warning(f"Failed to extract keys for table {table_name}: {e}")
            schema_keys[table_name] = {
                "pk": None,
                "fks": {}
            }
    
    conn.close()
    return schema_keys


class AtlasProcessor:
    """
    Process Polly Atlas tables and create SQLite database
    """
    
    def __init__(self, atlas_id: str, api_key: str, base_url: str = "https://apis.polly.elucidata.io"):
        self.atlas_id = atlas_id
        self.api_key = api_key
        self.base_url = f"{base_url}/sarovar/atlas"
        self.headers = {
            "x-api-key": api_key,
            "Content-Type": "application/vnd.api+json",
            "Accept": "application/vnd.api+json"
        }
    
    def _list_tables(self) -> List[Dict]:
        """
        Fetch all tables in the atlas
        """
        url = f"{self.base_url}/{self.atlas_id}/tables"
        try:
            response = requests.get(url=url, headers=self.headers, timeout=30)
            response.raise_for_status()
            full_response = response.json()
            data = full_response.get("data", [])
            logger.info(f"Found {len(data)} tables in Atlas {self.atlas_id}")
            return data
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch tables: {str(e)}")
            raise Exception(f"Failed to fetch tables: {str(e)}")
    
    def _execute_sql_query(self, sql_query: str) -> List[Dict]:
        """
        Execute SQL query on Polly Atlas
        """
        url = f"{self.base_url}/{self.atlas_id}/queries"
        payload = {
            "data": {
                "type": "query",
                "attributes": {
                    "query": sql_query
                }
            }
        }
        try:
            response = requests.post(url=url, headers=self.headers, json=payload, timeout=60)
            response.raise_for_status()
            return response.json()["data"]["results"]
        except requests.exceptions.RequestException as e:
            try:
                error_detail = response.json()["errors"][0]["detail"]
                logger.error(f"Query failed: {error_detail}")
                raise Exception(f"Query failed: {error_detail}")
            except:
                logger.error(f"Query failed: {str(e)}")
                raise Exception(f"Query failed: {str(e)}")
    
    def _download_table_to_db(
        self,
        table_name: str,
        conn: sqlite3.Connection,
        limit: Optional[int] = None
    ) -> int:
        """
        Download a single table to SQLite database
        """
        # Construct SQL query
        sql_query = f"SELECT * FROM {table_name}"
        if limit:
            sql_query += f" LIMIT {limit}"
        
        logger.info(f"Downloading table: {table_name}")
        
        # Execute query
        results = self._execute_sql_query(sql_query)
        
        if not results:
            logger.warning(f"Table {table_name} is empty")
            return 0
        
        # Convert to DataFrame
        df = pd.DataFrame(results)
        
        # Write directly to SQLite
        df.to_sql(table_name, conn, if_exists="replace", index=False)
        
        logger.info(f"Loaded {len(df)} rows into table {table_name}")
        return len(df)
    
    def process_atlas_to_database(
        self,
        output_path: str,
        limit: Optional[int] = None,
        exclude_tables: Optional[List[str]] = None,
        include_tables: Optional[List[str]] = None
    ) -> Dict:
        """
        Download all tables from Atlas to SQLite database
        
        Returns:
            Dictionary with processing results
        """
        exclude_tables = exclude_tables or []
        
        # Get all tables
        tables = self._list_tables()
        
        # Extract table names
        table_names = []
        for table in tables:
            table_name = table.get("attributes", {}).get("table_name") or table.get("id")
            if table_name:
                table_names.append(table_name)
        
        # Filter tables
        if include_tables:
            table_names = [t for t in table_names if t in include_tables]
        table_names = [t for t in table_names if t not in exclude_tables]
        
        logger.info(f"Processing {len(table_names)} tables from Atlas {self.atlas_id}")
        
        # Connect to SQLite database
        conn = sqlite3.connect(output_path)
        
        # Download each table
        results = {}
        failed_tables = []
        
        for i, table_name in enumerate(table_names, 1):
            try:
                row_count = self._download_table_to_db(table_name, conn, limit)
                results[table_name] = row_count
                logger.info(f"[{i}/{len(table_names)}] Successfully processed {table_name}: {row_count} rows")
            except Exception as e:
                logger.error(f"[{i}/{len(table_names)}] Failed to process {table_name}: {str(e)}")
                failed_tables.append({"table": table_name, "error": str(e)})
        
        # Commit and close
        conn.commit()
        conn.close()
        
        summary = {
            "atlas_id": self.atlas_id,
            "total_tables": len(table_names),
            "successful_tables": len(results),
            "failed_tables": len(failed_tables),
            "total_rows": sum(results.values()),
            "database_path": output_path,
            "table_results": results,
            "failures": failed_tables
        }
        
        logger.info(f"Processing complete: {len(results)}/{len(table_names)} tables successful")
        return summary


@shared_task(bind=True, name='api.tasks.process_atlas')
def process_atlas(self, atlas_id: str, user_id: int, api_key: str):
    """
    Celery task to process an atlas: download tables, generate schema, and create embeddings
    
    Args:
        atlas_id: ID of the atlas to process
        user_id: ID of the user who initiated the task
        api_key: Decrypted Polly API key
    
    Returns:
        Dictionary with processing results
    """
    # Helper function to update both Celery state and database
    def update_progress(status_msg: str, progress: int, state: str = 'PROCESSING'):
        # Update Celery state
        self.update_state(
            state=state,
            meta={'status': status_msg, 'progress': progress}
        )
        # Update database record
        try:
            task_record = AtlasProcessingTask.objects.filter(
                task_id=self.request.id,
                atlas_id=atlas_id,
                user_id=user_id
            ).first()
            if task_record:
                task_record.status = state
                task_record.progress = progress
                task_record.status_message = status_msg
                task_record.save()
        except Exception as e:
            logger.warning(f"Failed to update database task status: {e}")
    
    # Update task state to PROCESSING
    update_progress('Starting atlas processing...', 0)
    
    # Use temporary directory for processing (automatically cleaned up)
    import tempfile
    temp_dir = tempfile.mkdtemp(prefix=f"atlas_{atlas_id}_")
    
    try:
        # Generate output file paths in temp directory
        output_filename = f"{atlas_id}_user_{user_id}.db"
        output_path = Path(temp_dir) / output_filename
        schema_path = Path(temp_dir) / f"{atlas_id}_user_{user_id}_schema.json"
        concept_table_path = Path(temp_dir) / f"{atlas_id}_user_{user_id}_concept_table.csv"
        concept_embeddings_path = Path(temp_dir) / f"{atlas_id}_user_{user_id}_concept_embeddings.pkl"
        schema_embeddings_path = Path(temp_dir) / f"{atlas_id}_user_{user_id}_db_table_field_embeddings.json"
        
        logger.info(f"Starting atlas processing: {atlas_id} for user {user_id}")
        
        # Step 1: Download tables to database
        update_progress('Downloading atlas tables...', 5)
        
        processor = AtlasProcessor(
            atlas_id=atlas_id,
            api_key=api_key
        )
        
        results = processor.process_atlas_to_database(
            output_path=str(output_path)
        )
        
        # Step 2: Generate schema with LLM descriptions
        update_progress('Generating schema with LLM descriptions...', 30)
        
        openai_api_key = getattr(settings, 'OPENAI_API_KEY', os.getenv('OPENAI_API_KEY'))
        if not openai_api_key:
            logger.warning("OpenAI API key not configured, skipping schema and embedding generation")
            results['schema_generated'] = False
            results['embeddings_generated'] = False
        else:
            schema_gen = SchemaGenerator(openai_api_key=openai_api_key)
            
            schema, concept_df = schema_gen.generate_schema_from_db(
                db_path=str(output_path),
                max_workers=5  # Limit concurrency for OpenAI API
            )
            
            # Save schema
            with open(schema_path, 'w', encoding='utf-8') as f:
                json.dump(schema, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Schema saved to {schema_path}")
            
            # Generate and save schema keys (primary/foreign key relationships)
            schema_keys = generate_schema_keys(str(output_path), schema)
            schema_keys_path = Path(temp_dir) / f"{atlas_id}_user_{user_id}_schema_keys.json"
            with open(schema_keys_path, 'w', encoding='utf-8') as f:
                json.dump(schema_keys, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Schema keys saved to {schema_keys_path}")
            
            # Save concept table
            concept_df.to_csv(concept_table_path, index=False)
            logger.info(f"Concept table saved to {concept_table_path}")
            
            results['schema_generated'] = True
            results['schema_path'] = str(schema_path)
            results['concept_table_path'] = str(concept_table_path)
            results['num_concepts'] = len(concept_df)
            
            # Step 3: Generate embeddings
            update_progress('Generating embeddings...', 60)
            
            embedding_gen = EmbeddingGenerator(openai_api_key=openai_api_key)
            
            # Generate concept embeddings with streaming to save memory
            concept_embeddings = embedding_gen.generate_concept_embeddings(
                concept_df=concept_df,
                batch_size=512,  # Reduced to 512 to prevent memory issues
                output_path=str(concept_embeddings_path)  # Stream directly to disk
            )
            
            logger.info(f"Concept embeddings saved to {concept_embeddings_path}")
            
            # Generate schema field embeddings
            schema_field_embeddings = embedding_gen.generate_schema_field_embeddings(schema)
            
            with open(schema_embeddings_path, 'w') as f:
                json.dump(schema_field_embeddings, f, indent=2)
            
            logger.info(f"Schema field embeddings saved to {schema_embeddings_path}")
            
            results['embeddings_generated'] = True
            results['concept_embeddings_path'] = str(concept_embeddings_path)
            results['schema_embeddings_path'] = str(schema_embeddings_path)
        
        # Finalize
        update_progress('Finalizing...', 95)
        
        # Add file size to results
        file_size = os.path.getsize(output_path) if output_path.exists() else 0
        results['file_size'] = file_size
        results['file_size_mb'] = round(file_size / (1024 * 1024), 2)
        
        # Upload all files to GCS
        update_progress('Uploading files to Google Cloud Storage...', 97)
        
        try:
            gcs = get_gcs_storage()
            gcs_files = {}
        
            # Upload SQLite database
            if output_path.exists():
                gcs_path = f"atlases/{atlas_id}/{output_filename}"
                gcs_uri = gcs.upload_file(str(output_path), gcs_path)
                gcs_files['database'] = gcs_uri
                logger.info(f"Uploaded database to GCS: {gcs_uri}")
            
            # Upload schema JSON
            if schema_path.exists():
                gcs_path = f"atlases/{atlas_id}/schema.json"
                gcs_uri = gcs.upload_file(str(schema_path), gcs_path)
                gcs_files['schema'] = gcs_uri
                logger.info(f"Uploaded schema to GCS: {gcs_uri}")
            
            # Upload concept table CSV
            if concept_table_path.exists():
                gcs_path = f"atlases/{atlas_id}/concept_table.csv"
                gcs_uri = gcs.upload_file(str(concept_table_path), gcs_path)
                gcs_files['concept_table'] = gcs_uri
                logger.info(f"Uploaded concept table to GCS: {gcs_uri}")
            
            # Note: concept_embeddings are already uploaded by schema_generator.py
            # Check if file exists, if not it was already uploaded and deleted
            if concept_embeddings_path.exists():
                gcs_path = f"atlases/{atlas_id}/concept_embeddings.pkl"
                gcs_uri = gcs.upload_file(str(concept_embeddings_path), gcs_path)
                gcs_files['concept_embeddings'] = gcs_uri
                logger.info(f"Uploaded concept embeddings to GCS: {gcs_uri}")
            else:
                # Already uploaded by schema_generator
                gcs_files['concept_embeddings'] = f"gs://{gcs.bucket_name}/atlases/{atlas_id}/concept_embeddings.pkl"
            
            # Upload schema field embeddings
            if schema_embeddings_path.exists():
                gcs_path = f"atlases/{atlas_id}/schema_field_embeddings.json"
                gcs_uri = gcs.upload_file(str(schema_embeddings_path), gcs_path)
                gcs_files['schema_embeddings'] = gcs_uri
                logger.info(f"Uploaded schema embeddings to GCS: {gcs_uri}")
            
            # Upload schema keys (primary/foreign key relationships)
            if schema_keys_path.exists():
                gcs_path = f"atlases/{atlas_id}/schema_keys.json"
                gcs_uri = gcs.upload_file(str(schema_keys_path), gcs_path)
                gcs_files['schema_keys'] = gcs_uri
                logger.info(f"Uploaded schema keys to GCS: {gcs_uri}")
            
            results['gcs_files'] = gcs_files
            results['storage'] = 'gcs'
            logger.info(f"All files uploaded to GCS for atlas {atlas_id}")
            
        except Exception as e:
            logger.warning(f"Failed to upload files to GCS: {str(e)}")
            results['storage'] = 'local'
            results['gcs_upload_error'] = str(e)
        finally:
            # Always cleanup temp directory
            import shutil
            try:
                shutil.rmtree(temp_dir)
                logger.info(f"Cleaned up temporary directory: {temp_dir}")
            except Exception as cleanup_error:
                logger.warning(f"Failed to cleanup temp directory: {cleanup_error}")
        
        logger.info(f"Atlas processing completed: {atlas_id}")
        
        # Update database to SUCCESS
        update_progress('Atlas processing completed', 100, state='SUCCESS')
        
        return {
            'status': 'completed',
            'progress': 100,
            'results': results
        }
        
    except Exception as e:
        logger.error(f"Atlas processing failed: {str(e)}", exc_info=True)
        
        # Cleanup temp directory on failure
        import shutil
        try:
            if 'temp_dir' in locals():
                shutil.rmtree(temp_dir)
                logger.info(f"Cleaned up temporary directory after failure: {temp_dir}")
        except Exception as cleanup_error:
            logger.warning(f"Failed to cleanup temp directory after failure: {cleanup_error}")
        
        # Update database to FAILURE
        try:
            task_record = AtlasProcessingTask.objects.filter(
                task_id=self.request.id,
                atlas_id=atlas_id,
                user_id=user_id
            ).first()
            if task_record:
                task_record.status = 'FAILURE'
                task_record.error_message = str(e)
                task_record.save()
        except Exception as db_error:
            logger.warning(f"Failed to update database task status on failure: {db_error}")
        
        self.update_state(
            state='FAILURE',
            meta={'status': f'Failed: {str(e)}', 'error': str(e)}
        )
        raise
