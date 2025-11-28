"""
Schema and embedding generation for Atlas databases
Based on Initial_schema_and_embedding_generation.ipynb
"""
import json
import logging
import pickle
import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

import numpy as np
import pandas as pd
from openai import OpenAI
from api.storage import get_gcs_storage

logger = logging.getLogger(__name__)


class SchemaGenerator:
    """Generate schema with LLM descriptions and embeddings"""
    
    def __init__(self, openai_api_key: str, model: str = "gpt-4o-mini"):
        self.client = OpenAI(api_key=openai_api_key)
        self.model = model
    
    def generate_llm_description(self, prompt: str) -> str:
        """Generate LLM description for a prompt"""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert data documentation assistant."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"Failed to generate LLM description: {str(e)}")
            return f"Error: {str(e)}"
    
    def is_probably_numeric_string(self, series: pd.Series, threshold: float = 0.9) -> bool:
        """
        Detect if a string column is mostly numeric.
        If >= threshold fraction can be converted to numeric, treat as numeric.
        """
        non_null = series.dropna().astype(str)
        converted = pd.to_numeric(non_null, errors="coerce")
        numeric_ratio = converted.notna().mean()
        return numeric_ratio >= threshold
    
    def generate_schema_from_db(
        self,
        db_path: str,
        max_unique: int = 50,
        sample_size: int = 5,
        max_workers: int = 10
    ) -> Tuple[Dict, pd.DataFrame]:
        """
        Generate schema with LLM descriptions and concept table
        
        Returns:
            Tuple of (schema_dict, concept_dataframe)
        """
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        schema = {}
        concept_rows = []
        
        # Get table names
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [t[0] for t in cursor.fetchall()]
        
        logger.info(f"Generating schema for {len(tables)} tables")
        
        for table_idx, table in enumerate(tables, 1):
            logger.info(f"Processing table {table_idx}/{len(tables)}: {table}")
            
            df = pd.read_sql(f"SELECT * FROM {table}", conn)
            
            # Build table-level prompt
            field_examples = []
            for col in df.columns:
                sample_vals = pd.Series(df[col].dropna().unique()).head(sample_size).tolist()
                dtype = str(df[col].dtype)
                field_examples.append(f"- {col} ({dtype}), e.g. {sample_vals}")
            
            table_prompt = f"""
You are given the following information about a database table:

Table name: {table}

Columns with example values:
{chr(10).join(field_examples)}

Please write a clear, concise (2–3 lines), human-readable and accurate description of what this table contains overall. Focus on the purpose and nature of data stored in the table, not on detailed descriptions of individual fields. Provide your response in a plain text format.
"""
            
            # Collect prompts (table + fields)
            prompts = {"__table__": table_prompt}
            candidate_concepts = []
            
            for col in df.columns:
                col_data = df[col].dropna()
                dtype = str(df[col].dtype)
                
                total_rows = len(df)
                num_unique = col_data.nunique()
                uniqueness_pct = (num_unique / total_rows) * 100 if total_rows > 0 else 0
                
                unique_vals = col_data.unique()
                if len(unique_vals) > max_unique:
                    unique_info = f"{len(unique_vals)} unique values"
                    concept_samples = unique_vals
                else:
                    unique_info = unique_vals.tolist()
                    concept_samples = unique_vals
                
                # Exclusion logic for concept table
                exclude = False
                if np.issubdtype(df[col].dtype, np.number):
                    exclude = True  # numeric column
                elif self.is_probably_numeric_string(col_data):
                    exclude = True  # stringified numeric
                elif uniqueness_pct == 100:
                    exclude = True  # ID-like column
                
                if not exclude:
                    candidate_concepts.append((table, col, concept_samples))
                
                # Field description prompt
                field_prompt = f"""
You are given the following information about a database column:

- Column name: {col}
- Table: {table}
- Data type (inferred from DB): {dtype}
- Sample values: {pd.Series(col_data.unique()).head(sample_size).tolist()}
- Unique values: {unique_info}
- Uniqueness percent: {round(uniqueness_pct, 2)}

Write a clear, concise and human-readable description of what this field likely represents. Provide your response as a plain text format.
"""
                prompts[col] = field_prompt
            
            # Parallel execution of all prompts
            logger.info(f"Generating {len(prompts)} LLM descriptions for table {table}")
            results = {}
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                future_to_key = {
                    executor.submit(self.generate_llm_description, p): k
                    for k, p in prompts.items()
                }
                for future in as_completed(future_to_key):
                    key = future_to_key[future]
                    try:
                        results[key] = future.result()
                    except Exception as e:
                        results[key] = f"Error: {e}"
            
            # Build schema with results
            table_info = {
                "table_description": results["__table__"],
                "fields": {}
            }
            
            for col in df.columns:
                col_data = df[col].dropna()
                dtype = str(df[col].dtype)
                
                total_rows = len(df)
                num_unique = col_data.nunique()
                uniqueness_pct = (num_unique / total_rows) * 100 if total_rows > 0 else 0
                
                unique_vals = col_data.unique()
                if len(unique_vals) > max_unique:
                    unique_info = f"{len(unique_vals)} unique values"
                else:
                    unique_info = unique_vals.tolist()
                
                table_info["fields"][col] = {
                    "field_data_type": dtype,
                    "field_description": results[col],
                    "field_sample_values": pd.Series(col_data.unique()).head(sample_size).tolist(),
                    "field_unique_values": unique_info,
                    "field_uniqueness_percent": round(uniqueness_pct, 2)
                }
            
            schema[table] = table_info
            
            # Finalize concept table
            for table_name, col_name, values in candidate_concepts:
                for val in values:
                    concept_rows.append({
                        "concept_name": str(val),
                        "table_name": table_name,
                        "field_name": col_name
                    })
        
        conn.close()
        
        concept_df = pd.DataFrame(concept_rows)
        concept_df["concept_with_context"] = (
            concept_df["table_name"].astype(str) + "_" +
            concept_df["field_name"].astype(str) + "_" +
            concept_df["concept_name"].astype(str)
        )
        
        logger.info(f"Schema generation complete: {len(schema)} tables, {len(concept_df)} concepts")
        
        return schema, concept_df


class EmbeddingGenerator:
    """Generate embeddings for concepts and schema fields"""
    
    def __init__(self, openai_api_key: str, model: str = "text-embedding-3-small"):
        self.client = OpenAI(api_key=openai_api_key)
        self.model = model
    
    def get_single_embedding(
        self,
        text: str,
        max_retries: int = 3,
        delay: int = 2
    ) -> Optional[List[float]]:
        """Generate embedding for a single text with retry logic"""
        for attempt in range(max_retries):
            try:
                response = self.client.embeddings.create(model=self.model, input=text)
                return response.data[0].embedding
            except Exception as e:
                if attempt < max_retries - 1:
                    time.sleep(delay * (2 ** attempt))  # exponential backoff
                else:
                    logger.error(f"Failed after {max_retries} retries for text: {text[:50]}... | Error: {e}")
                    return None
    
    def get_embeddings_batch(
        self,
        texts: List[str],
        batch_size: int = 2048,
        max_retries: int = 3
    ) -> np.ndarray:
        """
        Generate embeddings in batches (more efficient than parallel one-by-one).
        OpenAI supports up to 2048 texts per request.
        """
        all_embeddings = []
        num_batches = (len(texts) + batch_size - 1) // batch_size
        
        logger.info(f"Generating embeddings for {len(texts)} texts in {num_batches} batches of {batch_size}")
        
        for batch_idx in range(num_batches):
            start_idx = batch_idx * batch_size
            end_idx = min(start_idx + batch_size, len(texts))
            batch_texts = texts[start_idx:end_idx]
            
            logger.info(f"Processing batch {batch_idx + 1}/{num_batches} ({len(batch_texts)} texts)")
            
            # Retry logic for this batch
            for attempt in range(max_retries):
                try:
                    response = self.client.embeddings.create(
                        model=self.model,
                        input=batch_texts
                    )
                    batch_embeddings = [e.embedding for e in response.data]
                    all_embeddings.extend(batch_embeddings)
                    
                    # Free memory from response
                    del response
                    del batch_embeddings
                    break
                except Exception as e:
                    if attempt < max_retries - 1:
                        wait_time = 2 ** attempt  # exponential backoff
                        logger.warning(f"Batch {batch_idx + 1} failed (attempt {attempt + 1}/{max_retries}), retrying in {wait_time}s: {e}")
                        time.sleep(wait_time)
                    else:
                        logger.error(f"Batch {batch_idx + 1} failed after {max_retries} retries: {e}")
                        # Fill with zero vectors for failed batch
                        all_embeddings.extend([np.zeros(1536).tolist()] * len(batch_texts))
        
        return np.array(all_embeddings)
    
    def get_embeddings_parallel(
        self,
        texts: List[str],
        max_workers: int = 10
    ) -> np.ndarray:
        """
        DEPRECATED: Use get_embeddings_batch() instead for better efficiency.
        This method is kept for backwards compatibility.
        """
        logger.warning("get_embeddings_parallel is deprecated. Use get_embeddings_batch() for 10-100x speedup.")
        return self.get_embeddings_batch(texts, batch_size=2048)
    
    def generate_concept_embeddings(
        self,
        concept_df: pd.DataFrame,
        batch_size: int = 12288,
        output_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate embeddings for concepts using efficient batch processing.
        Memory-efficient: Can stream to disk if output_path is provided.
        
        Args:
            concept_df: DataFrame with 'concept_with_context' column
            batch_size: Number of texts per API call (reduced to 1024 to save memory)
            output_path: If provided, embeddings are saved incrementally to this path
        
        Returns:
            Dict with 'concepts' and 'embeddings' arrays (or path if streaming)
        """
        concepts = concept_df["concept_with_context"].astype(str).tolist()
        
        # For large datasets, use smaller batches and stream to disk
        if output_path and len(concepts) > 10000:
            logger.info(f"Using streaming mode for {len(concepts)} concepts to save memory")
            return self._generate_embeddings_streaming(concepts, batch_size, output_path)
        else:
            embeddings = self.get_embeddings_batch(concepts, batch_size=batch_size)
            return {
                "concepts": concepts,
                "embeddings": embeddings
            }
    
    def _generate_embeddings_streaming(
        self,
        concepts: List[str],
        batch_size: int,
        output_path: str
    ) -> Dict[str, Any]:
        """
        Stream embeddings directly to disk using numpy memmap to avoid memory issues.
        Processes batches and writes incrementally without loading all into RAM.
        """
        import gc
        
        num_batches = (len(concepts) + batch_size - 1) // batch_size
        logger.info(f"Streaming {len(concepts)} embeddings in {num_batches} batches to {output_path}")
        
        # Create a memory-mapped file for embeddings (write directly to disk)
        embedding_dim = 1536
        temp_npy_path = output_path + '.memmap.npy'
        embeddings_memmap = np.memmap(
            temp_npy_path, 
            dtype='float32', 
            mode='w+', 
            shape=(len(concepts), embedding_dim)
        )
        
        for batch_idx in range(num_batches):
            start_idx = batch_idx * batch_size
            end_idx = min(start_idx + batch_size, len(concepts))
            batch_texts = concepts[start_idx:end_idx]
            
            logger.info(f"Streaming batch {batch_idx + 1}/{num_batches} ({len(batch_texts)} texts)")
            
            # Get embeddings for this batch
            for attempt in range(3):
                try:
                    response = self.client.embeddings.create(
                        model=self.model,
                        input=batch_texts
                    )
                    batch_embeddings = np.array([e.embedding for e in response.data], dtype='float32')
                    
                    # Write directly to memory-mapped file (writes to disk immediately)
                    embeddings_memmap[start_idx:end_idx] = batch_embeddings
                    embeddings_memmap.flush()  # Ensure written to disk
                    
                    # Free memory immediately
                    del response
                    del batch_embeddings
                    gc.collect()
                    break
                except Exception as e:
                    if attempt < 2:
                        wait_time = 2 ** attempt
                        logger.warning(f"Batch {batch_idx + 1} failed, retrying in {wait_time}s: {e}")
                        time.sleep(wait_time)
                    else:
                        logger.error(f"Batch {batch_idx + 1} failed after retries: {e}")
                        # Write zeros for failed batch
                        embeddings_memmap[start_idx:end_idx] = np.zeros((len(batch_texts), embedding_dim), dtype='float32')
                        embeddings_memmap.flush()
        
        # Carefully convert memmap to array in chunks to avoid memory spike
        logger.info("Finalizing embeddings file (converting memmap to pickle)...")
        
        # Read memmap in chunks and rebuild array piece by piece
        chunk_size = 10000  # Process 10K embeddings at a time (~60MB)
        embeddings_chunks = []
        
        for i in range(0, len(concepts), chunk_size):
            end_i = min(i + chunk_size, len(concepts))
            chunk = np.array(embeddings_memmap[i:end_i], dtype='float32', copy=True)
            embeddings_chunks.append(chunk)
            
            if (i // chunk_size) % 5 == 0:  # Log every 5 chunks
                logger.info(f"Converting embeddings: {end_i}/{len(concepts)} ({100*end_i/len(concepts):.1f}%)")
            
            gc.collect()
        
        # Close and delete memmap first
        del embeddings_memmap
        gc.collect()
        
        # Concatenate chunks (still memory intensive but better than loading all at once)
        logger.info("Concatenating embedding chunks...")
        embeddings_array = np.concatenate(embeddings_chunks, axis=0)
        del embeddings_chunks
        gc.collect()
        
        result = {
            "concepts": concepts,
            "embeddings": embeddings_array
        }
        
        # Save as pickle locally
        logger.info("Saving final pickle file...")
        with open(output_path, 'wb') as f:
            pickle.dump(result, f)
        
        logger.info(f"Embeddings saved to {output_path}")
        
        # Upload to GCS
        try:
            import os
            gcs = get_gcs_storage()
            # Create GCS path: atlases/{atlas_id}/embeddings/concept_embeddings.pkl
            filename = os.path.basename(output_path)
            # Extract atlas_id from path (assuming path format: /data/atlases/{atlas_id}/...)
            path_parts = Path(output_path).parts
            if 'atlases' in path_parts:
                atlas_idx = path_parts.index('atlases') + 1
                atlas_id = path_parts[atlas_idx] if atlas_idx < len(path_parts) else 'unknown'
            else:
                atlas_id = 'unknown'
            
            gcs_path = f"atlases/{atlas_id}/concept_embeddings.pkl"
            gcs_uri = gcs.upload_file(output_path, gcs_path)
            logger.info(f"Uploaded embeddings to GCS: {gcs_uri}")
            
            # Clean up local file after successful upload
            os.remove(output_path)
            logger.info(f"Removed local file: {output_path}")
        except Exception as e:
            logger.warning(f"Failed to upload embeddings to GCS (keeping local file): {str(e)}")
        
        # Clean up temp files
        del embeddings_array
        try:
            os.remove(temp_npy_path)
        except:
            pass
        gc.collect()
        
        return result
    
    def generate_schema_field_embeddings(
        self,
        schema: Dict[str, Dict[str, Any]]
    ) -> Dict[str, Dict[str, Any]]:
        """Generate embeddings for schema table.field descriptions"""
        
        # Extract table.field texts
        pairs = {}
        for table, table_info in schema.items():
            fields = table_info.get("fields", {})
            for field, field_info in fields.items():
                desc = field_info.get("field_description", "")
                samples = field_info.get("field_sample_values", [])
                sample_str = f" Example Values: {', '.join(map(str, samples))}" if samples else ""
                text = f"{field}__{desc}__{sample_str}"
                pairs[f'{table}.{field}'] = text.strip()
        
        # Generate embeddings
        texts = list(pairs.values())
        keys = list(pairs.keys())
        
        logger.info(f"Generating embeddings for {len(texts)} schema fields")
        
        response = self.client.embeddings.create(
            model=self.model,
            input=texts
        )
        embeddings = [e.embedding for e in response.data]
        
        return {
            k: {"text": pairs[k], "embedding": embeddings[i]}
            for i, k in enumerate(keys)
        }
