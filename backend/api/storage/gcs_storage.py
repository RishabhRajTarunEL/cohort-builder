"""
Google Cloud Storage utility for storing atlas processing files
"""
import os
import logging
from typing import Optional, BinaryIO
from google.cloud import storage
from django.conf import settings

logger = logging.getLogger(__name__)


class GCSStorage:
    """Handler for Google Cloud Storage operations"""
    
    def __init__(self):
        """Initialize GCS client"""
        self.bucket_name = settings.GCS_BUCKET_NAME
        self.project_id = settings.GCS_PROJECT_ID
        
        # Initialize client
        # If GOOGLE_APPLICATION_CREDENTIALS env var is set, it will use that
        # Otherwise, will use default credentials
        self.client = storage.Client(project=self.project_id)
        self.bucket = self.client.bucket(self.bucket_name)
        
        logger.info(f"Initialized GCS client for bucket: {self.bucket_name}")
    
    def upload_file(self, local_file_path: str, gcs_path: str) -> str:
        """
        Upload a file to GCS
        
        Args:
            local_file_path: Path to local file
            gcs_path: Destination path in GCS bucket
            
        Returns:
            Public URL of uploaded file
        """
        try:
            blob = self.bucket.blob(gcs_path)
            blob.upload_from_filename(local_file_path)
            
            logger.info(f"Uploaded {local_file_path} to gs://{self.bucket_name}/{gcs_path}")
            
            # Return the GCS URI
            return f"gs://{self.bucket_name}/{gcs_path}"
        
        except Exception as e:
            logger.error(f"Failed to upload {local_file_path} to GCS: {str(e)}")
            raise
    
    def upload_fileobj(self, file_obj: BinaryIO, gcs_path: str) -> str:
        """
        Upload a file object to GCS
        
        Args:
            file_obj: File-like object
            gcs_path: Destination path in GCS bucket
            
        Returns:
            GCS URI of uploaded file
        """
        try:
            blob = self.bucket.blob(gcs_path)
            file_obj.seek(0)  # Reset file pointer
            blob.upload_from_file(file_obj)
            
            logger.info(f"Uploaded file object to gs://{self.bucket_name}/{gcs_path}")
            
            return f"gs://{self.bucket_name}/{gcs_path}"
        
        except Exception as e:
            logger.error(f"Failed to upload file object to GCS: {str(e)}")
            raise
    
    def download_file(self, gcs_path: str, local_file_path: str) -> str:
        """
        Download a file from GCS
        
        Args:
            gcs_path: Source path in GCS bucket
            local_file_path: Destination local file path
            
        Returns:
            Path to downloaded file
        """
        try:
            blob = self.bucket.blob(gcs_path)
            
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(local_file_path), exist_ok=True)
            
            blob.download_to_filename(local_file_path)
            
            logger.info(f"Downloaded gs://{self.bucket_name}/{gcs_path} to {local_file_path}")
            
            return local_file_path
        
        except Exception as e:
            logger.error(f"Failed to download {gcs_path} from GCS: {str(e)}")
            raise
    
    def download_to_memory(self, gcs_path: str) -> bytes:
        """
        Download a file from GCS to memory
        
        Args:
            gcs_path: Source path in GCS bucket
            
        Returns:
            File contents as bytes
        """
        try:
            blob = self.bucket.blob(gcs_path)
            content = blob.download_as_bytes()
            
            logger.info(f"Downloaded gs://{self.bucket_name}/{gcs_path} to memory")
            
            return content
        
        except Exception as e:
            logger.error(f"Failed to download {gcs_path} to memory: {str(e)}")
            raise
    
    def file_exists(self, gcs_path: str) -> bool:
        """
        Check if a file exists in GCS
        
        Args:
            gcs_path: Path in GCS bucket
            
        Returns:
            True if file exists, False otherwise
        """
        try:
            blob = self.bucket.blob(gcs_path)
            return blob.exists()
        
        except Exception as e:
            logger.error(f"Failed to check if {gcs_path} exists: {str(e)}")
            return False
    
    def delete_file(self, gcs_path: str) -> bool:
        """
        Delete a file from GCS
        
        Args:
            gcs_path: Path in GCS bucket
            
        Returns:
            True if successful, False otherwise
        """
        try:
            blob = self.bucket.blob(gcs_path)
            blob.delete()
            
            logger.info(f"Deleted gs://{self.bucket_name}/{gcs_path}")
            
            return True
        
        except Exception as e:
            logger.error(f"Failed to delete {gcs_path}: {str(e)}")
            return False
    
    def list_files(self, prefix: str = "") -> list:
        """
        List files in GCS bucket with optional prefix
        
        Args:
            prefix: Prefix to filter files
            
        Returns:
            List of file paths
        """
        try:
            blobs = self.bucket.list_blobs(prefix=prefix)
            file_list = [blob.name for blob in blobs]
            
            logger.info(f"Listed {len(file_list)} files with prefix: {prefix}")
            
            return file_list
        
        except Exception as e:
            logger.error(f"Failed to list files with prefix {prefix}: {str(e)}")
            return []
    
    def get_signed_url(self, gcs_path: str, expiration_minutes: int = 60) -> str:
        """
        Generate a signed URL for temporary access to a file
        
        Args:
            gcs_path: Path in GCS bucket
            expiration_minutes: URL expiration time in minutes
            
        Returns:
            Signed URL
        """
        try:
            blob = self.bucket.blob(gcs_path)
            
            from datetime import timedelta
            url = blob.generate_signed_url(
                version="v4",
                expiration=timedelta(minutes=expiration_minutes),
                method="GET"
            )
            
            logger.info(f"Generated signed URL for {gcs_path} (expires in {expiration_minutes} min)")
            
            return url
        
        except Exception as e:
            logger.error(f"Failed to generate signed URL for {gcs_path}: {str(e)}")
            raise


# Singleton instance
_gcs_storage = None


def get_gcs_storage() -> GCSStorage:
    """Get or create GCS storage instance"""
    global _gcs_storage
    
    if _gcs_storage is None:
        _gcs_storage = GCSStorage()
    
    return _gcs_storage
