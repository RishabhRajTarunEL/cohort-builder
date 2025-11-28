"""
Natural Language Query Agent Service

Processes user queries through a 4-stage workflow:
- Stage 0: Extract raw criteria (inclusion/exclusion)
- Stage 1: Map to schema + concepts + generate UI components
- Stage 2: Generate & validate SQL
- Stage 3: Execute query
"""

import json
import logging
import pickle
import sqlite3
import tempfile
from pathlib import Path
from typing import Dict, List, Any, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from openai import OpenAI
from django.conf import settings

from api.storage import get_gcs_storage, AtlasFileCache
from .ui_component_generator import generate_ui_components

logger = logging.getLogger(__name__)


class AgentService:
    """
    Handles natural language query processing for cohort building
    """
    
    def __init__(self, project_id: str, atlas_id: str, user_id: int):
        self.project_id = project_id
        self.atlas_id = atlas_id
        self.user_id = user_id
        self.openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
        
        # Load atlas files from GCS
        self.schema = None
        self.schema_embeddings = None
        self.schema_keys = None
        self.concept_df = None
        self.concept_lookup = None
        self.db_path = None
        
        self._load_atlas_files()
    
    def _load_atlas_files(self):
        """Load all required atlas files from GCS (with caching)"""
        import time
        start_time = time.time()
        
        try:
            # Try to get cached files first
            file_cache = AtlasFileCache(self.atlas_id)
            cached_data = file_cache.get_cached_files()
            
            if cached_data:
                # Use cached files
                self.schema = cached_data.get('schema')
                self.schema_embeddings = cached_data.get('schema_embeddings')
                self.schema_keys = cached_data.get('schema_keys')
                self.concept_df = cached_data.get('concept_df')
                self.concept_lookup = cached_data.get('concept_lookup')
                self.db_path = cached_data.get('db_path')
                self.temp_dir = cached_data.get('temp_dir')
                
                elapsed = time.time() - start_time
                logger.info(f"✓ Loaded atlas files from cache in {elapsed:.2f}s")
                return
            
            # Cache miss - download from GCS
            logger.info(f"Cache miss - downloading atlas files from GCS...")
            gcs = get_gcs_storage()
            
            # Create temp directory for downloads
            self.temp_dir = tempfile.mkdtemp(prefix=f"agent_{self.atlas_id}_")
            logger.info(f"Created temp directory: {self.temp_dir}")
            
            # Load schema.json
            schema_path = f"atlases/{self.atlas_id}/schema.json"
            local_schema = Path(self.temp_dir) / "schema.json"
            gcs.download_file(schema_path, str(local_schema))
            with open(local_schema, 'r') as f:
                self.schema = json.load(f)
            logger.info(f"Loaded schema with {len(self.schema)} tables")
            
            # Load schema_field_embeddings.json
            embeddings_path = f"atlases/{self.atlas_id}/schema_field_embeddings.json"
            local_embeddings = Path(self.temp_dir) / "schema_field_embeddings.json"
            gcs.download_file(embeddings_path, str(local_embeddings))
            with open(local_embeddings, 'r') as f:
                self.schema_embeddings = json.load(f)
            logger.info(f"Loaded schema embeddings for {len(self.schema_embeddings)} fields")
            
            # Load schema_keys.json
            keys_path = f"atlases/{self.atlas_id}/schema_keys.json"
            local_keys = Path(self.temp_dir) / "schema_keys.json"
            gcs.download_file(keys_path, str(local_keys))
            with open(local_keys, 'r') as f:
                self.schema_keys = json.load(f)
            logger.info(f"Loaded schema keys for {len(self.schema_keys)} tables")
            
            # Load concept_table.csv
            concept_path = f"atlases/{self.atlas_id}/concept_table.csv"
            local_concept = Path(self.temp_dir) / "concept_table.csv"
            gcs.download_file(concept_path, str(local_concept))
            self.concept_df = pd.read_csv(local_concept)
            logger.info(f"Loaded concept table with {len(self.concept_df)} concepts")
            
            # Load concept_embeddings.pkl
            embeddings_pkl_path = f"atlases/{self.atlas_id}/concept_embeddings.pkl"
            local_embeddings_pkl = Path(self.temp_dir) / "concept_embeddings.pkl"
            gcs.download_file(embeddings_pkl_path, str(local_embeddings_pkl))
            with open(local_embeddings_pkl, 'rb') as f:
                data = pickle.load(f)
                concepts = data.get('concepts', [])
                embeddings = data.get('embeddings', [])
                self.concept_lookup = dict(zip(concepts, embeddings))
            logger.info(f"Loaded concept embeddings for {len(self.concept_lookup)} concepts")
            
            # Download SQLite database (for query execution)
            db_files = gcs.list_files(f"atlases/{self.atlas_id}/")
            db_file = next((f for f in db_files if f.endswith('.db')), None)
            if db_file:
                local_db = Path(self.temp_dir) / f"{self.atlas_id}.db"
                gcs.download_file(db_file, str(local_db))
                self.db_path = str(local_db)
                logger.info(f"Downloaded database to {self.db_path}")
            
            elapsed = time.time() - start_time
            logger.info(f"Downloaded atlas files from GCS in {elapsed:.2f}s")
            
            # Cache the files for future use
            file_data = {
                'schema': self.schema,
                'schema_embeddings': self.schema_embeddings,
                'schema_keys': self.schema_keys,
                'concept_df': self.concept_df,
                'concept_lookup': self.concept_lookup,
                'db_path': self.db_path,
                'temp_dir': self.temp_dir
            }
            file_cache.cache_files(file_data)
            
        except Exception as e:
            logger.error(f"Failed to load atlas files: {e}")
            raise Exception(f"Failed to initialize agent: {e}")
    
    def cleanup(self):
        """Cleanup temporary files (but keep cached files)"""
        import shutil
        try:
            # Only cleanup if this is NOT a cached directory
            # Cached directories are in AtlasFileCache.CACHE_BASE_DIR
            if hasattr(self, 'temp_dir') and Path(self.temp_dir).exists():
                cache_base = str(AtlasFileCache.CACHE_BASE_DIR)
                if not self.temp_dir.startswith(cache_base):
                    # This is a temporary directory, safe to delete
                    shutil.rmtree(self.temp_dir)
                    logger.info(f"Cleaned up temp directory: {self.temp_dir}")
                else:
                    # This is a cached directory, don't delete it
                    logger.info(f"Keeping cached directory: {self.temp_dir}")
        except Exception as e:
            logger.warning(f"Failed to cleanup temp directory: {e}")
    
    # -------------------------
    # Stage 0: Extract Raw Criteria
    # -------------------------
    
    def process_stage_0(self, query: str, feedback: str = "") -> Dict:
        """
        Extract inclusion/exclusion criteria from natural language query.
        Returns criteria as chips for frontend display.
        
        Args:
            query: User's natural language query
            feedback: Optional feedback to refine criteria
        
        Returns:
            {
                "stage": 0,
                "criteria": [
                    {
                        "id": "c1",
                        "type": "include",
                        "text": "hemoglobin levels less than 8",
                        "chip": {
                            "label": "Hemoglobin < 8",
                            "category": "lab_results",
                            "color": "blue"
                        }
                    }
                ]
            }
        """
        from pydantic import BaseModel, Field
        
        class Criterion(BaseModel):
            type: str = Field(..., description="include or exclude")
            text: str = Field(..., description="The criterion text")
        
        class CriteriaList(BaseModel):
            criteria: List[Criterion]
        
        prompt = f"""
        TASK:
        Break down the query into a list of granular logical criteria for building a cohort.

        APPROACH:
        Focus on the part of the query that is relevant to cohort building.
        Ignore parts asking for analysis, plotting, or specific attributes.
        Each distinct AND condition should be a separate item in the list.
        Do not split OR clauses.
        Handle exclusive conditions by adding an exclusion criterion.

        Return the result as a JSON list of objects. Each object has:
        - "type": "include" or "exclude"
        - "text": The string phrase for the condition.

        Example:
        Query: "Find all women who have diabetes or hypertension but not smokers and are older than 50."
        Result:
        [
            {{"type": "include", "text": "are women"}},
            {{"type": "include", "text": "have diabetes or hypertension"}},
            {{"type": "include", "text": "are older than 50"}},
            {{"type": "exclude", "text": "are smokers"}}
        ]

        Original User Query: {query}
        User Feedback: {feedback}

        Return strict JSON matching the schema.
        """
        
        try:
            response = self._call_llm(
                user_prompt=prompt,
                system_prompt="You are a biomedical expert agent that extracts cohort criteria.",
                response_model=CriteriaList
            )
            
            # Convert to frontend format with chips
            criteria = []
            for idx, crit in enumerate(response.criteria):
                criterion_id = f"c{idx}"
                
                # Generate chip label (simplified version of text)
                chip_label = self._generate_chip_label(crit.text)
                
                criteria.append({
                    "id": criterion_id,
                    "type": crit.type,
                    "text": crit.text,
                    "chip": {
                        "label": chip_label,
                        "category": self._categorize_criterion(crit.text),
                        "color": "blue" if crit.type == "include" else "red",
                        "editable": True,
                        "deletable": True
                    }
                })
            
            return {
                "stage": 0,
                "criteria": criteria,
                "status": "Criteria extracted. Review and approve or add more criteria.",
                "actions": ["approve", "add_criterion", "edit", "delete"]
            }
            
        except Exception as e:
            logger.error(f"Stage 0 failed: {e}")
            raise Exception(f"Failed to extract criteria: {e}")
    
    def _generate_chip_label(self, text: str) -> str:
        """Generate a concise chip label from criterion text"""
        # Simple heuristics to shorten text
        text = text.strip()
        if len(text) <= 30:
            return text
        
        # Try to extract key parts
        # e.g., "have diabetes or hypertension" -> "Diabetes OR Hypertension"
        if "or" in text.lower():
            parts = text.lower().split("or")
            if len(parts) == 2:
                return f"{parts[0].strip().title()} OR {parts[1].strip().title()}"
        
        # Truncate if too long
        return text[:27] + "..." if len(text) > 30 else text
    
    def _categorize_criterion(self, text: str) -> str:
        """Categorize criterion for UI display"""
        text_lower = text.lower()
        
        if any(word in text_lower for word in ['age', 'year', 'old', 'birth']):
            return 'demographics'
        elif any(word in text_lower for word in ['diabetes', 'hypertension', 'disease', 'condition']):
            return 'conditions'
        elif any(word in text_lower for word in ['hemoglobin', 'wbc', 'lab', 'test']):
            return 'lab_results'
        elif any(word in text_lower for word in ['mutation', 'gene', 'genetic']):
            return 'genomics'
        elif any(word in text_lower for word in ['male', 'female', 'gender', 'sex']):
            return 'demographics'
        else:
            return 'general'
    
    # -------------------------
    # Stage 1: Map to Schema + Concepts + Generate UI
    # -------------------------
    
    def process_stage_1(self, criteria: List[Dict]) -> Dict:
        """
        Map criteria to database schema and concepts, then generate UI components.
        
        Args:
            criteria: List of criteria from Stage 0
        
        Returns:
            {
                "stage": 1,
                "criteria": [
                    {
                        "id": "c1",
                        "type": "include",
                        "text": "hemoglobin levels less than 8",
                        "chip": {...},
                        "entities": [
                            {"attribute": "hemoglobin levels", "entity": "less than 8"}
                        ],
                        "db_mappings": {
                            "less than 8": {
                                "table.field": "labreports.hemoglobin_levels",
                                "mapped_concept": null,
                                "ui_component": {
                                    "type": "range_slider",
                                    "config": {...}
                                }
                            }
                        }
                    }
                ]
            }
        """
        try:
            # Step 1: Extract entities from criteria text
            criteria = self._extract_entities(criteria)
            
            # Step 2: Map entities to schema (table.field)
            criteria = self._map_to_schema(criteria)
            
            # Step 3: Map entities to concepts (actual values)
            criteria = self._map_to_concepts(criteria)
            
            # Step 4: Generate UI components
            criteria = generate_ui_components(criteria, self.schema, self.concept_df)
            
            return {
                "stage": 1,
                "criteria": criteria,
                "status": "Review and adjust criteria using UI components",
                "actions": ["approve", "edit_component", "back"]
            }
            
        except Exception as e:
            logger.error(f"Stage 1 failed: {e}")
            raise Exception(f"Failed to map criteria to schema: {e}")
    
    def _extract_entities(self, criteria: List[Dict]) -> List[Dict]:
        """Extract attribute-entity pairs from criterion text"""
        from pydantic import BaseModel
        
        class FilterItem(BaseModel):
            attribute: str
            entity: str
        
        class FilterItemList(BaseModel):
            items: List[FilterItem]
        
        for criterion in criteria:
            prompt = f"""
            You are given a selection criterion that needs to be converted to a structured DB query.

            Task:
            - Extract all *attributes/properties* mentioned (e.g., "age", "hemoglobin level")
            - Extract all *specific entities* (e.g., "50", "diabetes", "< 8")
            - Return each *entity* linked to its corresponding *attribute*
            - If no attribute is explicit, infer it based on context

            Examples:
            Criterion: "have diabetes or hypertension"
            Result: [{{"attribute":"medical condition", "entity":"diabetes"}}, {{"attribute":"medical condition", "entity":"hypertension"}}]

            Criterion: "born between 1990 and 1997"
            Result: [{{"attribute":"birth year", "entity":"1990-1997"}}]

            Criterion: "{criterion['text']}"
            
            Return strict JSON.
            """
            
            try:
                response = self._call_llm(
                    user_prompt=prompt,
                    response_model=FilterItemList
                )
                
                criterion['entities'] = [
                    {"attribute": item.attribute, "entity": item.entity}
                    for item in response.items
                ]
                
            except Exception as e:
                logger.warning(f"Failed to extract entities from '{criterion['text']}': {e}")
                criterion['entities'] = []
        
        return criteria
    
    def _map_to_schema(self, criteria: List[Dict]) -> List[Dict]:
        """Map entities to database schema (table.field)"""
        for criterion in criteria:
            criterion['db_mappings'] = {}
            
            for entity_item in criterion.get('entities', []):
                attribute = entity_item['attribute']
                entity = entity_item['entity']
                
                # Use semantic search + LLM to find best table.field
                mapping = self._find_best_field(attribute, entity, criterion['text'])
                
                if mapping:
                    criterion['db_mappings'][entity] = mapping
        
        return criteria
    
    def _find_best_field(self, attribute: str, entity: str, context: str) -> Optional[Dict]:
        """
        Find the best matching table.field for an entity using aggregation method.
        This runs 3 different mapping strategies in parallel and aggregates results.
        Based on LangGraph implementation for higher accuracy.
        """
        try:
            # Run all 3 methods in parallel
            field_matches = []
            
            with ThreadPoolExecutor(max_workers=3) as executor:
                # Method 1: Embed + rerank (current approach)
                future_embed = executor.submit(
                    self._map_entity_embed_rerank, attribute, entity, context
                )
                
                # Method 2: Sequential LLM mapping
                future_sequential = executor.submit(
                    self._map_entity_sequential, attribute, entity, context
                )
                
                # Method 3: Value mapping via concepts
                future_value = executor.submit(
                    self._map_entity_value_mapping, attribute, entity
                )
                
                # Collect all results
                for future in as_completed([future_embed, future_sequential, future_value]):
                    try:
                        result = future.result()
                        if result and result.get('ranked_matches'):
                            field_matches.extend(result['ranked_matches'])
                    except Exception as e:
                        logger.warning(f"One mapping method failed: {e}")
            
            # Remove duplicates while preserving order
            field_matches = list(dict.fromkeys([m for m in field_matches if m]))
            
            if not field_matches:
                logger.warning(f"No field matches found for entity '{entity}'")
                return None
            
            # Final reranking with full context
            candidates = [
                (f, self.schema_embeddings.get(f, {}).get('text', ''))
                for f in field_matches
            ]
            context_enhanced = f"The entity maps to attribute: `{attribute}`, from filter: `{context}`. Use descriptions and value formats to decide relevance."
            
            best_match = self._rerank_with_llm(entity, candidates, context_enhanced)
            
            if not best_match or '.' not in best_match:
                # Fallback to first match
                best_match = field_matches[0]
            
            table, field = best_match.split('.')
            field_info = self.schema.get(table, {}).get('fields', {}).get(field, {})
            
            return {
                "attribute": attribute,
                "table.field": best_match,
                "ranked_matches": field_matches[:5],  # Top 5 for UI dropdown
                "field_data_type": field_info.get('field_data_type'),
                "field_description": field_info.get('field_description'),
                "mapped_concept": None  # Will be filled in next step
            }
            
        except Exception as e:
            logger.error(f"Failed to map entity '{entity}' to schema: {e}")
            return None
    
    def _map_entity_embed_rerank(self, attribute: str, entity: str, context: str) -> Dict:
        """
        Method 1: Embed entity → kNN search → LLM rerank
        """
        try:
            query_text = f"{attribute} {entity}"
            query_embedding = self._get_embedding(query_text)
            
            top_matches = self._find_similarity_matches(
                query_embedding,
                self.schema_embeddings,
                top_k=5
            )
            
            if not top_matches:
                return {"ranked_matches": []}
            
            candidates = [(name, self.schema_embeddings[name]['text']) for name, _ in top_matches]
            best_match = self._rerank_with_llm(entity, candidates, context)
            
            ranked_matches = [name for name, _ in top_matches]
            if best_match and best_match in ranked_matches:
                # Move best_match to front
                ranked_matches.remove(best_match)
                ranked_matches.insert(0, best_match)
            
            return {"ranked_matches": ranked_matches}
            
        except Exception as e:
            logger.warning(f"Embed-rerank method failed: {e}")
            return {"ranked_matches": []}
    
    def _map_entity_sequential(self, attribute: str, entity: str, context: str) -> Dict:
        """
        Method 2: LLM table selection → LLM field selection → kNN → rerank
        """
        from pydantic import BaseModel, Field
        
        class TableChoice(BaseModel):
            table: str = Field(..., description="Most relevant table name")
        
        class FieldChoice(BaseModel):
            field: str = Field(..., description="Most relevant field name")
        
        try:
            # Step 1: Choose table
            table_descriptions = {
                name: details.get('table_description', '')
                for name, details in self.schema.items()
            }
            
            prompt_table = f"""
Given entity "{entity}" from attribute "{attribute}" in criterion "{context}",
select the most relevant table. Respond with only the table name.

Available tables:
{json.dumps(table_descriptions, indent=2)}
"""
            
            response_table = self._call_llm(
                user_prompt=prompt_table,
                system_prompt="You are a database schema expert.",
                response_model=TableChoice
            )
            table = response_table.table
            
            if table not in self.schema:
                return {"ranked_matches": []}
            
            # Step 2: Choose field within table
            field_descriptions = self.schema[table].get('fields', {})
            
            prompt_field = f"""
Given entity "{entity}" from attribute "{attribute}" in criterion "{context}",
select the most relevant field in table "{table}". 
The field's value format should match the entity.
Respond with only the field name.

Available fields in {table}:
{json.dumps(field_descriptions, indent=2)}
"""
            
            response_field = self._call_llm(
                user_prompt=prompt_field,
                system_prompt="You are a database schema expert.",
                response_model=FieldChoice
            )
            field = response_field.field
            
            if field not in field_descriptions:
                return {"ranked_matches": []}
            
            # Step 3: Find similar fields and rerank
            key = f'{table}.{field}'
            if key in self.schema_embeddings:
                top_matches = self._find_similarity_matches(
                    self.schema_embeddings[key]['embedding'],
                    self.schema_embeddings,
                    top_k=5
                )
                ranked_matches = [name for name, _ in top_matches]
            else:
                ranked_matches = [key]
            
            return {"ranked_matches": ranked_matches}
            
        except Exception as e:
            logger.warning(f"Sequential method failed: {e}")
            return {"ranked_matches": []}
    
    def _map_entity_value_mapping(self, attribute: str, entity: str) -> Dict:
        """
        Method 3: Direct concept value mapping
        Embed entity → find similar concept values → get parent table.field
        """
        try:
            if not self.concept_df is not None or not self.concept_lookup:
                return {"ranked_matches": []}
            
            entity_emb = self._get_embedding(f"{attribute} {entity}")
            query_vec = np.array(entity_emb).reshape(1, -1)
            
            # Get all concept embeddings
            concepts = list(self.concept_lookup.keys())
            emb_matrix = np.array(list(self.concept_lookup.values()))
            
            # Cosine similarity
            sims = cosine_similarity(query_vec, emb_matrix)[0]
            top_idxs = np.argsort(sims)[::-1][:5]
            
            # Get top matching concepts
            top_concepts = [concepts[i] for i in top_idxs]
            
            # Retrieve corresponding table.field
            filter_rows = self.concept_df[
                self.concept_df['concept_with_context'].isin(top_concepts)
            ]
            
            if filter_rows.empty:
                return {"ranked_matches": []}
            
            ranked_matches = list(set([
                f"{row['table_name']}.{row['field_name']}"
                for _, row in filter_rows.iterrows()
            ]))
            
            return {"ranked_matches": ranked_matches}
            
        except Exception as e:
            logger.warning(f"Value mapping method failed: {e}")
            return {"ranked_matches": []}
    
    def _map_to_concepts(self, criteria: List[Dict]) -> List[Dict]:
        """Map entities to actual database values (concepts)"""
        for criterion in criteria:
            for entity, mapping in criterion.get('db_mappings', {}).items():
                table_field = mapping.get('table.field')
                if not table_field or '.' not in table_field:
                    logger.warning(f"Skipping entity '{entity}': invalid table.field '{table_field}'")
                    continue
                
                table, field = table_field.split('.', 1)
                logger.info(f"Mapping entity '{entity}' to concepts in {table}.{field}")
                
                # Find matching concepts in concept_df
                matched_concepts = self._search_concepts(entity, table, field)
                
                if matched_concepts:
                    logger.info(f"Found {len(matched_concepts)} concepts for '{entity}': {matched_concepts[:3]}")
                    mapping['mapped_concept'] = matched_concepts
                else:
                    logger.warning(f"No concepts found for entity '{entity}' in {table}.{field}")
        
        return criteria
    
    def _search_concepts(self, entity: str, table: str, field: str) -> Optional[List[str]]:
        """
        Search for matching concepts using hybrid approach (LangGraph improvement).
        Uses LLM for small sets (<=50), semantic search for large sets (>50).
        """
        try:
            logger.info(f"Searching concepts: entity='{entity}', table='{table}', field='{field}'")
            subset = self.concept_df[
                (self.concept_df['table_name'] == table) &
                (self.concept_df['field_name'] == field)
            ]
            
            logger.info(f"Found {len(subset)} concepts in concept_df for {table}.{field}")
            
            if subset.empty:
                logger.warning(f"No concepts in concept_df for {table}.{field}")
                return None
            
            subset_unique = subset.drop_duplicates(subset=['concept_name']).reset_index(drop=True)
            num_unique = len(subset_unique)
            
            logger.info(f"Unique concepts: {num_unique} (threshold: 50 for LLM vs embedding)")
            
            # ==== HYBRID APPROACH ====
            # Small set (<= 50): Use LLM for better accuracy with nuanced differences
            if num_unique <= 50:
                logger.info(f"Using LLM selection for {num_unique} concepts")
                candidates = subset_unique['concept_name'].tolist()
                chosen = self._choose_concepts_with_llm(entity, table, field, candidates)
                if chosen:
                    logger.info(f"LLM selected: {chosen}")
                return chosen
            
            # Large set (> 50): Use semantic search for speed and scalability
            logger.info(f"Using semantic search for {num_unique} concepts")
            entity_emb = self._get_embedding(entity)
            subset_ctx = subset_unique['concept_with_context'].tolist()
            
            # Build embedding matrix from available concepts
            valid_embs = []
            valid_indices = []
            for i, ctx in enumerate(subset_ctx):
                if ctx in self.concept_lookup:
                    valid_embs.append(self.concept_lookup[ctx])
                    valid_indices.append(i)
            
            if len(valid_embs) == 0:
                logger.warning(f"No embeddings found for concepts in {table}.{field}")
                return None
            
            subset_embs = np.vstack(valid_embs)
            query_vec = np.array(entity_emb).reshape(1, -1)
            sims = cosine_similarity(query_vec, subset_embs)[0]
            
            # Get top 5 matches
            best_idxs = sims.argsort()[::-1][:5]
            results = [subset_unique.iloc[valid_indices[i]]['concept_name'] for i in best_idxs]
            logger.info(f"Semantic search found: {results}")
            return results
            
        except Exception as e:
            logger.error(f"Failed to search concepts for '{entity}': {e}", exc_info=True)
            return None
    
    def _choose_concepts_with_llm(self, entity: str, table: str, field: str, candidates: List[str]) -> Optional[List[str]]:
        """Use LLM to choose best matching concept(s)"""
        from pydantic import BaseModel, Field
        
        class ConceptChoice(BaseModel):
            concepts: Optional[List[str]] = Field(None, description="Best matching concepts or null")
            reason: str = Field(..., description="Short explanation")
        
        bullet_list = "\n".join(f"- {c}" for c in candidates[:50])  # Limit to 50
        
        prompt = f"""
        You are helping map a user entity to the most relevant database concept(s).

        TASK:
        - Select one or more highly relevant concepts from the list
        - If none are suitable, return null
        - Provide a short reason

        CONTEXT:
        - Table: {table}
        - Field: {field}
        - Entity to map: "{entity}"

        CANDIDATES:
        {bullet_list}

        Return strict JSON: {{"concepts": ["concept1", "concept2"] or null, "reason": "explanation"}}
        """
        
        try:
            response = self._call_llm(
                user_prompt=prompt,
                system_prompt="You are a precise data-mapping assistant.",
                response_model=ConceptChoice
            )
            return response.concepts
        except Exception as e:
            logger.warning(f"LLM concept selection failed: {e}")
            return None
    
    # -------------------------
    # Stage 2: Generate SQL
    # -------------------------
    
    def process_stage_2(self, criteria_with_values: List[Dict]) -> Dict:
        """
        Generate SQL query from criteria with user-modified values.
        
        Args:
            criteria_with_values: Criteria with values from UI components
        
        Returns:
            {
                "stage": 2,
                "criteria": [...],
                "sql_query": "SELECT patient_id FROM ...",
                "sql_explanation": {...},
                "validation": {"valid": true, "errors": [], "warnings": []}
            }
        """
        try:
            # Step 1: Rewrite criteria to SQL expressions
            criteria = self._rewrite_to_sql(criteria_with_values)
            
            # Step 2: Validate SQL expressions
            validation = self._validate_criteria(criteria)
            
            if not validation['valid']:
                return {
                    "stage": 2,
                    "criteria": criteria,
                    "sql_query": None,
                    "validation": validation,
                    "status": "Validation failed. Please fix errors.",
                    "actions": ["back", "edit"]
                }
            
            # Step 3: Build complete SQL with JOINs
            sql_query = self._build_sql_query(criteria)
            
            # Step 4: Generate explanation
            explanation = self._explain_sql(sql_query, criteria)
            
            return {
                "stage": 2,
                "criteria": criteria,
                "sql_query": sql_query,
                "sql_explanation": explanation,
                "validation": validation,
                "status": "SQL query generated and validated",
                "actions": ["execute", "edit", "back", "export_sql"]
            }
            
        except Exception as e:
            logger.error(f"Stage 2 failed: {e}")
            raise Exception(f"Failed to generate SQL: {e}")
    
    def _rewrite_to_sql(self, criteria: List[Dict]) -> List[Dict]:
        """Convert criteria to SQL expressions"""
        from pydantic import BaseModel, Field
        
        class SQLExpression(BaseModel):
            result: str = Field(..., description="SQL expression using table.field and values")
        
        for criterion in criteria:
            # Build mapping context
            mapping_context = {}
            for entity, mapping in criterion.get('db_mappings', {}).items():
                field = mapping.get('table.field')
                # Use current_value if set by user, otherwise fall back to mapped_concept
                value = mapping.get('current_value')
                if value is None:
                    # Default to mapped_concept if no user modification
                    value = mapping.get('mapped_concept')
                
                operator = mapping.get('current_operator', 'equals')
                
                if field and value is not None:
                    mapping_context[entity] = {
                        "field": field,
                        "value": value,
                        "operator": operator
                    }
            
            if not mapping_context:
                logger.warning(f"No mapping context for criterion: {criterion.get('text')}")
                continue
            
            prompt = f"""
            Rewrite the criterion into a SQL logical expression.
            Use table.field notation and proper SQL syntax.
            String values should be in single quotes, numbers unquoted.
            Valid operators: =, >, <, >=, <=, !=, IN, BETWEEN
            Preserve logical clauses (AND/OR/NOT).

            Criterion: {criterion['text']}
            Mapped Fields: {json.dumps(mapping_context, indent=2)}

            Examples:
            - "age > 50" if field is age and operator is greater_than with value 50
            - "gender = 'Male'" if field is gender and value is Male
            - "hemoglobin BETWEEN 8 AND 12" if operator is between with values [8, 12]

            Return JSON: {{"result": "SQL expression"}}
            """
            
            try:
                response = self._call_llm(
                    user_prompt=prompt,
                    response_model=SQLExpression
                )
                criterion['sql_expression'] = response.result
            except Exception as e:
                logger.warning(f"Failed to rewrite criterion to SQL: {e}")
                criterion['sql_expression'] = None
        
        return criteria
    
    def _validate_criteria(self, criteria: List[Dict]) -> Dict:
        """Validate SQL expressions against schema"""
        errors = []
        warnings = []
        
        for criterion in criteria:
            sql_expr = criterion.get('sql_expression')
            if not sql_expr:
                errors.append(f"Missing SQL expression for: {criterion.get('text')}")
                continue
            
            # Basic validation: check if table.field exists
            try:
                # Extract table.field from expression
                import re
                fields = re.findall(r'(\w+)\.(\w+)', sql_expr)
                
                for table, field in fields:
                    if table not in self.schema:
                        errors.append(f"Table '{table}' not found in schema")
                    elif field not in self.schema[table].get('fields', {}):
                        errors.append(f"Field '{field}' not found in table '{table}'")
                        
            except Exception as e:
                warnings.append(f"Could not validate: {sql_expr}")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings
        }
    
    def _build_sql_query(self, criteria: List[Dict]) -> str:
        """Build complete SQL query with JOINs"""
        # Extract table.field references from all SQL expressions
        required_tables = set()
        where_clauses = []
        
        for criterion in criteria:
            sql_expr = criterion.get('sql_expression')
            if not sql_expr:
                continue
            
            # Extract table names
            import re
            fields = re.findall(r'(\w+)\.(\w+)', sql_expr)
            for table, _ in fields:
                required_tables.add(table)
            
            # Add to WHERE clause
            if criterion['type'] == 'include':
                where_clauses.append(f"({sql_expr})")
            else:  # exclude
                where_clauses.append(f"NOT ({sql_expr})")
        
        # Determine root table (table with most references or first table in schema_keys with pk)
        root_table = self._determine_root_table(required_tables)
        
        # Build SELECT clause - with better fallback for primary key
        root_pk = self._get_primary_key(root_table)
        logger.info(f"Building SQL with root_table={root_table}, primary_key={root_pk}")
        select_clause = f"SELECT {root_table}.{root_pk}"
        
        # Build FROM clause with JOINs
        from_clause, join_clauses = self._build_joins(root_table, required_tables)
        
        # Build WHERE clause
        where_clause = " AND ".join(where_clauses) if where_clauses else "1=1"
        
        # Assemble query
        query = f"{select_clause}\nFROM {from_clause}"
        if join_clauses:
            query += "\n" + "\n".join(join_clauses)
        query += f"\nWHERE {where_clause}"
        
        return query
    
    def _get_primary_key(self, table: str) -> str:
        """
        Get the primary key field for a table with intelligent fallback.
        
        Order of preference:
        1. Check schema_keys for 'pk' field
        2. Look for common PK patterns in schema: {table}_id, id, {table}id
        3. Use first field in schema as last resort
        """
        # Try schema_keys first
        if self.schema_keys and table in self.schema_keys:
            pk = self.schema_keys[table].get('pk')
            if pk:
                logger.info(f"Found primary key in schema_keys: {table}.{pk}")
                return pk
        
        # Fallback: look for common patterns in schema fields
        if table in self.schema:
            fields = self.schema[table].get('fields', {})
            
            # Common primary key patterns
            common_pk_names = [
                f"{table}_id",      # e.g., patient_id
                "id",               # generic id
                f"{table}id",       # e.g., patientid
                f"{table}_ID",      # uppercase variant
                "ID"                # uppercase generic
            ]
            
            # Check if any common PK name exists in fields
            for pk_name in common_pk_names:
                if pk_name in fields:
                    logger.info(f"Inferred primary key from schema fields: {table}.{pk_name}")
                    return pk_name
            
            # Last resort: use first field
            if fields:
                first_field = next(iter(fields.keys()))
                logger.warning(f"No standard PK found for {table}, using first field: {first_field}")
                return first_field
        
        # Ultimate fallback
        logger.warning(f"Could not determine primary key for {table}, defaulting to 'id'")
        return 'id'
    
    def _determine_root_table(self, tables: set) -> str:
        """Determine which table should be the root of the query"""
        # Simple heuristic: choose the first table with a primary key
        for table in tables:
            if self.schema_keys.get(table, {}).get('pk'):
                return table
        
        # Fallback to first table
        return list(tables)[0] if tables else list(self.schema.keys())[0]
    
    def _build_joins(self, root_table: str, required_tables: set) -> tuple:
        """Build JOIN clauses to connect all required tables"""
        from collections import deque
        
        # BFS to find join path
        joins = []
        visited = {root_table}
        queue = deque([root_table])
        
        while queue and len(visited) < len(required_tables):
            current = queue.popleft()
            
            # Check foreign keys from current table
            fks = self.schema_keys.get(current, {}).get('fks', {})
            for fk_field, ref_table in fks.items():
                if ref_table in required_tables and ref_table not in visited:
                    ref_pk = self._get_primary_key(ref_table)
                    joins.append(
                        f"JOIN {ref_table} ON {current}.{fk_field} = {ref_table}.{ref_pk}"
                    )
                    visited.add(ref_table)
                    queue.append(ref_table)
            
            # Check foreign keys TO current table (reverse lookup)
            for other_table in required_tables:
                if other_table in visited:
                    continue
                    
                other_fks = self.schema_keys.get(other_table, {}).get('fks', {})
                if current in other_fks.values():
                    # Find the FK field pointing to current table
                    fk_field = next(k for k, v in other_fks.items() if v == current)
                    current_pk = self._get_primary_key(current)
                    joins.append(
                        f"JOIN {other_table} ON {current}.{current_pk} = {other_table}.{fk_field}"
                    )
                    visited.add(other_table)
                    queue.append(other_table)
        
        return root_table, joins
    
    def _explain_sql(self, sql_query: str, criteria: List[Dict]) -> Dict:
        """Generate human-readable explanation of SQL query"""
        import re
        
        # Extract tables used
        tables_used = list(set(re.findall(r'FROM\s+(\w+)|JOIN\s+(\w+)', sql_query, re.IGNORECASE)))
        tables_used = [t for pair in tables_used for t in pair if t]
        
        # Extract joins
        joins = re.findall(r'JOIN\s+\w+\s+ON\s+([^\n]+)', sql_query, re.IGNORECASE)
        
        # Extract where conditions
        where_match = re.search(r'WHERE\s+(.+)', sql_query, re.IGNORECASE | re.DOTALL)
        filters = []
        if where_match:
            where_clause = where_match.group(1).strip()
            # Split by AND (simplified)
            filters = [f.strip() for f in where_clause.split(' AND ') if f.strip()]
        
        return {
            "tables_used": tables_used,
            "num_tables": len(tables_used),
            "joins": joins,
            "filters": filters,
            "num_criteria": len(criteria),
            "estimated_results": "Unknown"  # Could estimate based on concepts
        }
    
    # -------------------------
    # Stage 3: Execute Query
    # -------------------------
    
    def process_stage_3(self, sql_query: str) -> Dict:
        """
        Execute SQL query on the SQLite database and return results.
        
        Args:
            sql_query: SQL query to execute
        
        Returns:
            {
                "stage": 3,
                "execution": {...},
                "results": {
                    "total_count": 118,
                    "columns": [...],
                    "preview": [...],
                    "gcs_path": "gs://..."
                }
            }
        """
        try:
            if not self.db_path or not Path(self.db_path).exists():
                raise Exception("Database not found")
            
            # Check for invalid column references (e.g., "patient.None")
            import re
            invalid_columns = re.findall(r'\b(\w+)\.None\b', sql_query)
            if invalid_columns:
                error_msg = f"Invalid SQL query: contains references to undefined columns ({', '.join(set(invalid_columns))}). Please regenerate the SQL query."
                logger.error(f"Invalid SQL detected: {sql_query}")
                raise Exception(error_msg)
            
            import time
            start_time = time.time()
            
            # Execute query
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row  # Enable column names
            cursor = conn.cursor()
            
            cursor.execute(sql_query)
            rows = cursor.fetchall()
            
            execution_time = int((time.time() - start_time) * 1000)  # ms
            
            # Convert to DataFrame
            df = pd.DataFrame([dict(row) for row in rows])
            
            conn.close()
            
            # Generate query ID
            import uuid
            query_id = f"q_{uuid.uuid4().hex[:12]}"
            
            # Save results to GCS
            results_path = f"query_results/{self.project_id}/{query_id}.csv"
            local_results = Path(self.temp_dir) / f"{query_id}.csv"
            df.to_csv(local_results, index=False)
            
            gcs = get_gcs_storage()
            gcs_uri = gcs.upload_file(str(local_results), results_path)
            
            # Prepare response
            return {
                "stage": 3,
                "execution": {
                    "status": "success",
                    "query_id": query_id,
                    "executed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "execution_time_ms": execution_time
                },
                "results": {
                    "total_count": len(df),
                    "columns": df.columns.tolist(),
                    "preview": df.head(10).to_dict('records'),
                    "gcs_path": gcs_uri,
                    "download_url": f"/api/query/{query_id}/download"
                },
                "actions": ["download", "visualize", "edit_criteria", "new_query", "save_cohort"]
            }
        
        except Exception as e:
            logger.error(f"Stage 3 failed: {e}", exc_info=True)
            return {
                "stage": 3,
                "execution": {
                    "status": "error",
                    "error": str(e)
                },
                "results": None,
                "actions": ["edit_criteria", "back"]
            }
    
    # -------------------------
    # Helper Methods
    # -------------------------
    
    def get_schema_summary(self) -> str:
        """
        Generate a human-readable summary of the database schema
        for answering user questions about available data.
        """
        try:
            # Get schema from atlas files
            tables_info = []
            
            for table_name, table_data in self.schema.items():
                fields = table_data.get('fields', {})
                field_list = []
                
                for field_name, field_info in list(fields.items())[:10]:  # First 10 fields
                    field_type = field_info.get('field_data_type', 'unknown')
                    field_desc = field_info.get('field_description', '')
                    field_list.append(f"  - {field_name} ({field_type}): {field_desc[:100]}")
                
                table_summary = f"\nTable: {table_name}\n" + "\n".join(field_list)
                if len(fields) > 10:
                    table_summary += f"\n  ... and {len(fields) - 10} more fields"
                
                tables_info.append(table_summary)
            
            schema_text = "\n".join(tables_info)
            return f"Available Tables and Fields:\n{schema_text}"
            
        except Exception as e:
            logger.error(f"Error generating schema summary: {e}")
            return "Schema information is available but could not be formatted at this time."
    
    def _call_llm(
        self,
        user_prompt: str,
        system_prompt: str = "You are a helpful biomedical assistant.",
        response_model: Any = None
    ) -> Any:
        """Call OpenAI API with optional structured output"""
        try:
            if response_model:
                # Structured output using Pydantic
                completion = self.openai_client.beta.chat.completions.parse(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    response_format=response_model
                )
                return completion.choices[0].message.parsed
            else:
                # Regular text response
                completion = self.openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.0
                )
                return completion.choices[0].message.content
                
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            raise
    
    def _get_embedding(self, text: str) -> List[float]:
        """Get OpenAI embedding for text"""
        try:
            clean_text = text.replace("\n", " ")
            response = self.openai_client.embeddings.create(
                model="text-embedding-3-small",
                input=[clean_text]
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"Failed to get embedding: {e}")
            raise
    
    def _find_similarity_matches(
        self,
        query_embedding: List[float],
        embeddings: Dict,
        top_k: int = 5
    ) -> List[tuple]:
        """Find top-k most similar items using cosine similarity"""
        try:
            keys = list(embeddings.keys())
            emb_matrix = np.array([v['embedding'] for v in embeddings.values()])
            query_vec = np.array(query_embedding).reshape(1, -1)
            
            sims = cosine_similarity(query_vec, emb_matrix)[0]
            top_idx = np.argsort(sims)[::-1][:top_k]
            
            return [(keys[i], sims[i]) for i in top_idx]
        except Exception as e:
            logger.error(f"Similarity search failed: {e}")
            return []
    
    def _rerank_with_llm(
        self,
        query: str,
        candidates: List[tuple],
        context: str = ""
    ) -> Optional[str]:
        """Rerank candidates using LLM"""
        from pydantic import BaseModel, Field
        
        class RankingResult(BaseModel):
            best_match: str = Field(..., description="Name of the best matching candidate")
            reason: str = Field(..., description="Short explanation")
        
        candidates_text = "\n".join(
            f"- {name}: {desc}" for name, desc in candidates
        )
        
        prompt = f"""
        Select the BEST matching candidate for the query.

        Query: {query}
        Context: {context}

        Candidates:
        {candidates_text}

        Return JSON: {{"best_match": "candidate name", "reason": "explanation"}}
        """
        
        try:
            response = self._call_llm(
                user_prompt=prompt,
                system_prompt="You are a precise ranking assistant.",
                response_model=RankingResult
            )
            return response.best_match
        except Exception as e:
            logger.warning(f"LLM reranking failed: {e}")
            # Fallback to first candidate
            return candidates[0][0] if candidates else None
