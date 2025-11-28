"""
Atlas File Cache Service

Caches downloaded atlas files to avoid repeated GCS downloads.
Uses local file system cache with metadata tracking in Django cache.

This solves the performance issue where every chat message was downloading
~60 seconds worth of files from GCS.
"""
import json
import logging
import pickle
import shutil
import tempfile
from pathlib import Path
from typing import Dict, Any, Optional
from django.core.cache import cache
from django.conf import settings
import pandas as pd

from .gcs_storage import get_gcs_storage

logger = logging.getLogger(__name__)


class AtlasFileCache:
    """
    Manages caching of atlas files from GCS.
    
    Strategy:
    - Files are cached in a persistent temp directory
    - File metadata (paths, timestamps) stored in Django cache (Redis)
    - Cache key format: atlas_files_{atlas_id}
    - Cache TTL: 4 hours (14400 seconds)
    """
    
    CACHE_TTL = 14400  # 4 hours
    CACHE_BASE_DIR = Path(tempfile.gettempdir()) / "atlas_cache"
    
    def __init__(self, atlas_id: str):
        self.atlas_id = atlas_id
        self.cache_key = f"atlas_files_{atlas_id}"
        
        # Ensure cache directory exists
        self.CACHE_BASE_DIR.mkdir(exist_ok=True, parents=True)
        self.atlas_dir = self.CACHE_BASE_DIR / atlas_id
        
    def get_cached_files(self) -> Optional[Dict[str, Any]]:
        """
        Get cached atlas files if they exist and are valid.
        
        Returns:
            Dict with file paths and loaded data, or None if cache miss
            {
                'schema': {...},
                'schema_embeddings': {...},
                'schema_keys': {...},
                'concept_df': DataFrame,
                'concept_lookup': {...},
                'db_path': '/path/to/db.db',
                'temp_dir': '/path/to/cache/dir'
            }
        """
        try:
            # Check if cache metadata exists
            cache_metadata = cache.get(self.cache_key)
            
            if not cache_metadata:
                logger.info(f"Cache miss for atlas {self.atlas_id}: no metadata")
                return None
            
            # Verify all files still exist
            if not self._verify_files_exist(cache_metadata):
                logger.info(f"Cache miss for atlas {self.atlas_id}: files missing")
                cache.delete(self.cache_key)
                return None
            
            logger.info(f"Cache hit for atlas {self.atlas_id}")
            
            # Load files from cached paths
            return self._load_files_from_cache(cache_metadata)
            
        except Exception as e:
            logger.warning(f"Error retrieving cache for atlas {self.atlas_id}: {e}")
            return None
    
    def cache_files(self, file_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Cache atlas files to persistent storage.
        
        Args:
            file_data: Dict with loaded atlas data
            
        Returns:
            Same dict with updated temp_dir path
        """
        try:
            # Create atlas-specific cache directory
            self.atlas_dir.mkdir(exist_ok=True, parents=True)
            logger.info(f"Caching atlas files to {self.atlas_dir}")
            
            # Save each file type
            metadata = {
                'atlas_id': self.atlas_id,
                'cache_dir': str(self.atlas_dir),
                'files': {}
            }
            
            # Save schema.json
            if 'schema' in file_data:
                schema_path = self.atlas_dir / "schema.json"
                with open(schema_path, 'w') as f:
                    json.dump(file_data['schema'], f)
                metadata['files']['schema'] = str(schema_path)
            
            # Save schema_field_embeddings.json
            if 'schema_embeddings' in file_data:
                embeddings_path = self.atlas_dir / "schema_field_embeddings.json"
                with open(embeddings_path, 'w') as f:
                    json.dump(file_data['schema_embeddings'], f)
                metadata['files']['schema_embeddings'] = str(embeddings_path)
            
            # Save schema_keys.json
            if 'schema_keys' in file_data:
                keys_path = self.atlas_dir / "schema_keys.json"
                with open(keys_path, 'w') as f:
                    json.dump(file_data['schema_keys'], f)
                metadata['files']['schema_keys'] = str(keys_path)
            
            # Save concept_table.csv
            if 'concept_df' in file_data:
                concept_path = self.atlas_dir / "concept_table.csv"
                file_data['concept_df'].to_csv(concept_path, index=False)
                metadata['files']['concept_table'] = str(concept_path)
            
            # Save concept_embeddings.pkl
            if 'concept_lookup' in file_data:
                concept_emb_path = self.atlas_dir / "concept_embeddings.pkl"
                # Reconstruct the format that was loaded
                concept_data = {
                    'concepts': list(file_data['concept_lookup'].keys()),
                    'embeddings': list(file_data['concept_lookup'].values())
                }
                with open(concept_emb_path, 'wb') as f:
                    pickle.dump(concept_data, f)
                metadata['files']['concept_embeddings'] = str(concept_emb_path)
            
            # Copy database file if it exists
            if 'db_path' in file_data and file_data['db_path']:
                db_source = Path(file_data['db_path'])
                if db_source.exists():
                    db_dest = self.atlas_dir / db_source.name
                    if db_source != db_dest:  # Don't copy if already in cache dir
                        shutil.copy2(db_source, db_dest)
                    metadata['files']['db'] = str(db_dest)
            
            # Store metadata in Django cache (Redis)
            cache.set(self.cache_key, metadata, self.CACHE_TTL)
            logger.info(f"Successfully cached atlas {self.atlas_id} files")
            
            # Update file_data to point to cached location
            file_data['temp_dir'] = str(self.atlas_dir)
            
            return file_data
            
        except Exception as e:
            logger.error(f"Error caching atlas files for {self.atlas_id}: {e}")
            # Return original file_data even if caching fails
            return file_data
    
    def _verify_files_exist(self, metadata: Dict) -> bool:
        """Verify all cached files still exist"""
        try:
            cache_dir = Path(metadata['cache_dir'])
            if not cache_dir.exists():
                return False
            
            for file_type, file_path in metadata['files'].items():
                if not Path(file_path).exists():
                    logger.warning(f"Cached file missing: {file_path}")
                    return False
            
            return True
            
        except Exception as e:
            logger.warning(f"Error verifying cached files: {e}")
            return False
    
    def _load_files_from_cache(self, metadata: Dict) -> Dict[str, Any]:
        """Load files from cached paths"""
        try:
            files = metadata['files']
            result = {
                'temp_dir': metadata['cache_dir']
            }
            
            # Load schema.json
            if 'schema' in files:
                with open(files['schema'], 'r') as f:
                    result['schema'] = json.load(f)
                logger.info(f"Loaded schema from cache: {len(result['schema'])} tables")
            
            # Load schema_field_embeddings.json
            if 'schema_embeddings' in files:
                with open(files['schema_embeddings'], 'r') as f:
                    result['schema_embeddings'] = json.load(f)
                logger.info(f"Loaded schema embeddings from cache: {len(result['schema_embeddings'])} fields")
            
            # Load schema_keys.json
            if 'schema_keys' in files:
                with open(files['schema_keys'], 'r') as f:
                    result['schema_keys'] = json.load(f)
                logger.info(f"Loaded schema keys from cache: {len(result['schema_keys'])} tables")
            
            # Load concept_table.csv
            if 'concept_table' in files:
                result['concept_df'] = pd.read_csv(files['concept_table'])
                logger.info(f"Loaded concept table from cache: {len(result['concept_df'])} concepts")
            
            # Load concept_embeddings.pkl
            if 'concept_embeddings' in files:
                with open(files['concept_embeddings'], 'rb') as f:
                    data = pickle.load(f)
                    concepts = data.get('concepts', [])
                    embeddings = data.get('embeddings', [])
                    result['concept_lookup'] = dict(zip(concepts, embeddings))
                logger.info(f"Loaded concept embeddings from cache: {len(result['concept_lookup'])} concepts")
            
            # Get database path
            if 'db' in files:
                result['db_path'] = files['db']
                logger.info(f"Using cached database: {result['db_path']}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error loading cached files: {e}")
            raise
    
    @classmethod
    def clear_cache(cls, atlas_id: str):
        """Clear cache for a specific atlas"""
        try:
            cache_key = f"atlas_files_{atlas_id}"
            cache.delete(cache_key)
            
            # Remove files
            atlas_dir = cls.CACHE_BASE_DIR / atlas_id
            if atlas_dir.exists():
                shutil.rmtree(atlas_dir)
                logger.info(f"Cleared cache for atlas {atlas_id}")
                
        except Exception as e:
            logger.warning(f"Error clearing cache for atlas {atlas_id}: {e}")
    
    @classmethod
    def clear_all_caches(cls):
        """Clear all atlas caches"""
        try:
            # Clear Django cache keys (requires pattern matching, which may not be supported)
            # For now, we'll just clear the file system cache
            if cls.CACHE_BASE_DIR.exists():
                shutil.rmtree(cls.CACHE_BASE_DIR)
                cls.CACHE_BASE_DIR.mkdir(exist_ok=True, parents=True)
                logger.info("Cleared all atlas file caches")
                
        except Exception as e:
            logger.warning(f"Error clearing all caches: {e}")
