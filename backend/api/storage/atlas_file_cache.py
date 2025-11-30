"""
Atlas File Cache Service

Caches downloaded atlas files to avoid repeated GCS downloads.
Uses local file system cache with metadata tracking in Django cache.

This solves the performance issue where every chat message was downloading
~60 seconds worth of files from GCS.

MEMORY OPTIMIZATION:
In addition to file-based caching, this module now includes an in-memory cache
to avoid repeatedly loading large pickle files (concept_embeddings.pkl) from disk.
This prevents OOM errors when multiple requests are processed.
"""
import json
import logging
import pickle
import shutil
import tempfile
import threading
from pathlib import Path
from typing import Dict, Any, Optional
from django.core.cache import cache
from django.conf import settings
import numpy as np
import pandas as pd

from .gcs_storage import get_gcs_storage

logger = logging.getLogger(__name__)

# ============================================================================
# IN-MEMORY CACHE (Module-level singleton)
# ============================================================================
# This prevents repeated loading of large pickle files from disk.
# Each worker process maintains its own in-memory cache.
# ============================================================================

class InMemoryAtlasCache:
    """Thread-safe in-memory cache for loaded atlas data.
    
    NOTE: Each gunicorn worker has its own in-memory cache.
    With --preload, workers share the initial state via copy-on-write.
    """
    
    def __init__(self):
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()
        import os
        self._pid = os.getpid()
    
    def get(self, atlas_id: str) -> Optional[Dict[str, Any]]:
        """Get cached data for an atlas (returns a reference, not a copy)."""
        import os
        with self._lock:
            data = self._cache.get(atlas_id)
            if data:
                logger.debug(f"[PID {os.getpid()}] In-memory cache GET: {atlas_id} -> HIT")
            return data
    
    def set(self, atlas_id: str, data: Dict[str, Any]):
        """Cache data for an atlas."""
        import os
        with self._lock:
            self._cache[atlas_id] = data
            logger.info(f"[PID {os.getpid()}] In-memory cache SET: {atlas_id}")
    
    def delete(self, atlas_id: str):
        """Remove an atlas from cache."""
        with self._lock:
            if atlas_id in self._cache:
                del self._cache[atlas_id]
                logger.info(f"In-memory cache DELETE for atlas {atlas_id}")
    
    def clear(self):
        """Clear all cached data."""
        with self._lock:
            self._cache.clear()
            logger.info("In-memory cache CLEARED")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        with self._lock:
            return {
                'cached_atlases': list(self._cache.keys()),
                'count': len(self._cache)
            }

# Global in-memory cache instance (one per worker process)
_memory_cache = InMemoryAtlasCache()


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
        
        Uses a two-level caching strategy:
        1. In-memory cache (fastest, prevents repeated pickle loading)
        2. File-based cache (persistent across restarts)
        
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
            # Level 1: Check in-memory cache first (prevents repeated pickle loading)
            memory_data = _memory_cache.get(self.atlas_id)
            if memory_data is not None:
                # FAST PATH: Data already in memory, no disk I/O needed
                logger.debug(f"⚡ In-memory cache HIT for atlas {self.atlas_id} (no disk I/O)")
                return memory_data
            
            # Level 2: Check file-based cache (Redis metadata + local files)
            cache_metadata = cache.get(self.cache_key)
            
            if not cache_metadata:
                logger.info(f"❌ Cache MISS for atlas {self.atlas_id}: no Redis metadata (will download from GCS)")
                return None
            
            # Verify all files still exist on disk
            if not self._verify_files_exist(cache_metadata):
                logger.info(f"❌ Cache MISS for atlas {self.atlas_id}: local files missing (will download from GCS)")
                cache.delete(self.cache_key)
                return None
            
            # MEDIUM PATH: Load from local disk (not GCS)
            logger.info(f"📁 File cache HIT for atlas {self.atlas_id}, loading from local disk into memory...")
            
            # Load files from cached paths (local disk, NOT GCS)
            result = self._load_files_from_cache(cache_metadata)
            
            # Store in memory cache for future requests (prevents reloading from disk)
            _memory_cache.set(self.atlas_id, result)
            logger.info(f"✓ Loaded atlas {self.atlas_id} from local disk and cached in memory")
            
            return result
            
        except Exception as e:
            logger.warning(f"Error retrieving cache for atlas {self.atlas_id}: {e}")
            return None
    
    def cache_files(self, file_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Cache atlas files to persistent storage AND in-memory.
        
        Args:
            file_data: Dict with loaded atlas data
            
        Returns:
            Same dict with updated temp_dir path
        """
        try:
            # Store in memory cache immediately (for current request chain)
            _memory_cache.set(self.atlas_id, file_data)
            
            # Create atlas-specific cache directory for LOCAL storage (not GCS)
            self.atlas_dir.mkdir(exist_ok=True, parents=True)
            logger.info(f"💾 Saving atlas files to LOCAL cache: {self.atlas_dir}")
            
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
            
            # Save concept_embeddings using numpy format (memory efficient)
            # IMPORTANT: Don't use .tolist() as it doubles memory usage!
            if '_concept_matrix' in file_data and file_data['_concept_matrix'] is not None:
                # Save keys as JSON (small)
                keys_path = self.atlas_dir / "concept_keys.json"
                with open(keys_path, 'w') as f:
                    json.dump(file_data.get('_concept_keys', []), f)
                metadata['files']['concept_keys'] = str(keys_path)
                
                # Save matrix using numpy (memory efficient, no copy)
                matrix_path = self.atlas_dir / "concept_matrix.npy"
                np.save(matrix_path, file_data['_concept_matrix'])
                metadata['files']['concept_matrix'] = str(matrix_path)
                
                logger.info(f"Saved concept embeddings: {len(file_data.get('_concept_keys', []))} concepts")
            
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
            
            # Verify it was stored
            verify = cache.get(self.cache_key)
            if verify:
                logger.info(f"✅ Successfully cached atlas {self.atlas_id} files to Redis and local disk")
            else:
                logger.error(f"❌ Failed to store cache metadata in Redis for atlas {self.atlas_id}! Check Redis connection.")
            
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
            
            # Load concept embeddings - try new format first (numpy), fall back to pickle
            if 'concept_matrix' in files and 'concept_keys' in files:
                # New format: separate numpy array and JSON keys (memory efficient)
                import numpy as np
                with open(files['concept_keys'], 'r') as f:
                    result['_concept_keys'] = json.load(f)
                result['_concept_matrix'] = np.load(files['concept_matrix'])
                result['_concept_to_idx'] = {k: i for i, k in enumerate(result['_concept_keys'])}
                result['concept_lookup'] = None
                logger.info(f"Loaded concept embeddings from cache (numpy): {len(result['_concept_keys'])} concepts")
                
            elif 'concept_embeddings' in files:
                # Old format: pickle file (fallback)
                import numpy as np
                with open(files['concept_embeddings'], 'rb') as f:
                    data = pickle.load(f)
                    concepts = data.get('concepts', [])
                    embeddings = data.get('embeddings', [])
                    
                    result['_concept_keys'] = concepts
                    result['_concept_matrix'] = np.array(embeddings, dtype=np.float32)
                    result['_concept_to_idx'] = {k: i for i, k in enumerate(concepts)}
                    result['concept_lookup'] = None
                    del embeddings, data  # Free memory immediately
                    
                logger.info(f"Loaded concept embeddings from cache (pickle): {len(concepts)} concepts")
            
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
        """Clear cache for a specific atlas (both memory and file-based)"""
        try:
            # Clear in-memory cache
            _memory_cache.delete(atlas_id)
            
            # Clear file-based cache
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
        """Clear all atlas caches (both memory and file-based)"""
        try:
            # Clear in-memory cache
            _memory_cache.clear()
            
            # Clear Django cache keys (requires pattern matching, which may not be supported)
            # For now, we'll just clear the file system cache
            if cls.CACHE_BASE_DIR.exists():
                shutil.rmtree(cls.CACHE_BASE_DIR)
                cls.CACHE_BASE_DIR.mkdir(exist_ok=True, parents=True)
                logger.info("Cleared all atlas file caches")
                
        except Exception as e:
            logger.warning(f"Error clearing all caches: {e}")
    
    @classmethod
    def get_memory_cache_stats(cls) -> Dict[str, Any]:
        """Get in-memory cache statistics (useful for debugging)"""
        return _memory_cache.get_stats()
    
    def is_cached(self) -> Dict[str, Any]:
        """
        Lightweight check if atlas is cached WITHOUT loading files.
        Used for polling status checks.
        
        Returns:
            {
                'is_cached': bool,
                'in_memory': bool,
                'on_disk': bool,
                'files': list of cached file types
            }
        """
        result = {
            'is_cached': False,
            'in_memory': False,
            'on_disk': False,
            'files': []
        }
        
        # Check in-memory cache (fastest)
        memory_data = _memory_cache.get(self.atlas_id)
        if memory_data is not None:
            result['in_memory'] = True
            result['is_cached'] = True
            result['files'] = [k for k in memory_data.keys() if not k.startswith('_') and memory_data[k] is not None]
            return result
        
        # Check Redis metadata (no file loading)
        cache_metadata = cache.get(self.cache_key)
        if cache_metadata:
            # Verify files exist without loading them
            if self._verify_files_exist(cache_metadata):
                result['on_disk'] = True
                result['is_cached'] = True
                result['files'] = list(cache_metadata.get('files', {}).keys())
        
        return result
