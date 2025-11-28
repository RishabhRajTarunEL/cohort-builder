"""
Views for Polly API integration
"""
import requests
import logging
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from celery.result import AsyncResult
from api.tasks import process_atlas
from api.models import AtlasProcessingTask
from google.cloud import storage
from django.conf import settings

logger = logging.getLogger(__name__)


class PollyAtlasListView(APIView):
    """
    Proxy endpoint to fetch all atlases from Polly using user's API key
    """
    permission_classes = (IsAuthenticated,)
    
    # Polly API base URL - you may need to update this based on your Polly instance
    # Production: https://apis.polly.elucidata.io
    # Testing: https://apis.testpolly.elucidata.io
    # Development: https://apis.devpolly.elucidata.io
    POLLY_BASE_URL = "https://apis.polly.elucidata.io"
    
    def get(self, request):
        """Fetch all atlases from Polly"""
        try:
            # Get user's Polly API key from their profile (decrypted)
            polly_api_key = request.user.profile.get_polly_api_key()
            
            logger.info(f"User {request.user.username} fetching atlases")
            logger.info(f"Decrypted API key length: {len(polly_api_key) if polly_api_key else 0}")
            logger.info(f"API key starts with: {polly_api_key[:10] if polly_api_key else 'None'}...")
            
            if not polly_api_key:
                return Response(
                    {'detail': 'Polly API key not configured. Please update your profile.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Polly API uses JSON API specification (https://jsonapi.org/)
            headers = {
                'x-api-key': f'{polly_api_key}',
                'Content-Type': 'application/vnd.api+json',
                'Accept': 'application/vnd.api+json'
            }
            
            url = f'{self.POLLY_BASE_URL}/sarovar/atlas'
            logger.info(f"Making request to Polly API: {url}")
            logger.info(f"Request headers: {headers}")
            
            response = requests.get(
                url,
                headers=headers,
                timeout=30
            )
            
            logger.info(f"Polly API response status: {response.status_code}")
            logger.info(f"Polly API response content-type: {response.headers.get('content-type')}")
            logger.info(f"Polly API full response: {response.text}")
            
            # Check if response is successful
            if response.status_code == 200:
                try:
                    return Response(response.json())
                except ValueError as e:
                    logger.error(f"Failed to parse JSON response: {str(e)}")
                    return Response(
                        {
                            'detail': 'Polly API returned invalid JSON',
                            'response_text': response.text[:1000],
                            'content_type': response.headers.get('content-type')
                        },
                        status=status.HTTP_502_BAD_GATEWAY
                    )
            elif response.status_code == 401:
                return Response(
                    {
                        'detail': 'Invalid Polly API key. Please update your API key in your profile.',
                        'error': response.text[:500]
                    },
                    status=status.HTTP_401_UNAUTHORIZED
                )
            elif response.status_code == 403:
                return Response(
                    {
                        'detail': 'Access forbidden. Check your Polly API key permissions.',
                        'error': response.text[:500]
                    },
                    status=status.HTTP_403_FORBIDDEN
                )
            else:
                return Response(
                    {
                        'detail': f'Polly API error: {response.status_code}',
                        'error': response.text[:500]
                    },
                    status=response.status_code
                )
                
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Connection error to Polly API: {str(e)}")
            return Response(
                {
                    'detail': 'Failed to connect to Polly API. Please check your network connection.',
                    'error': str(e)
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        except requests.exceptions.Timeout as e:
            logger.error(f"Timeout connecting to Polly API: {str(e)}")
            return Response(
                {
                    'detail': 'Request to Polly API timed out. Please try again.',
                    'error': str(e)
                },
                status=status.HTTP_504_GATEWAY_TIMEOUT
            )
        except requests.exceptions.RequestException as e:
            logger.error(f"Request exception: {str(e)}")
            return Response(
                {
                    'detail': f'Failed to connect to Polly API: {str(e)}',
                    'error_type': type(e).__name__
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}", exc_info=True)
            return Response(
                {
                    'detail': f'Internal error: {str(e)}',
                    'error_type': type(e).__name__
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ProcessAtlasView(APIView):
    """
    Trigger Celery task to process an atlas and create SQLite database
    """
    permission_classes = (IsAuthenticated,)
    
    def post(self, request, atlas_id):
        """Start atlas processing task"""
        try:
            # Get user's decrypted Polly API key
            polly_api_key = request.user.profile.get_polly_api_key()
            
            if not polly_api_key:
                return Response(
                    {'detail': 'Polly API key not configured. Please update your profile.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if there's already a running task for this atlas
            existing_task = AtlasProcessingTask.objects.filter(
                atlas_id=atlas_id,
                user=request.user,
                status__in=['PENDING', 'PROCESSING']
            ).first()
                
            if existing_task:
                return Response({
                    'task_id': existing_task.task_id,
                    'atlas_id': atlas_id,
                    'status': existing_task.status,
                    'progress': existing_task.progress,
                    'message': 'Task already running'
                }, status=status.HTTP_200_OK)
                
            logger.info(f"Starting atlas processing for {atlas_id} by user {request.user.id}")
            
            # Trigger Celery task
            task = process_atlas.delay(
                atlas_id=atlas_id,
                user_id=request.user.id,
                api_key=polly_api_key
            )
                
            # Save task to database
            AtlasProcessingTask.objects.create(
                atlas_id=atlas_id,
                user=request.user,
                task_id=task.id,
                status='PENDING',
                progress=0,
                status_message='Task queued'
            )
            
            return Response({
                'task_id': task.id,
                'atlas_id': atlas_id,
                'status': 'processing',
                'message': 'Atlas processing started'
            }, status=status.HTTP_202_ACCEPTED)
            
        except Exception as e:
            logger.error(f"Failed to start atlas processing: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'Failed to start processing: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ProcessAtlasStatusView(APIView):
    """
    Check the status of an atlas processing task
    """
    permission_classes = (IsAuthenticated,)
    
    def get(self, request, task_id):
        """Get task status"""
        try:
            task_result = AsyncResult(task_id)
            
            response_data = {
                'task_id': task_id,
                'state': task_result.state,
            }
            
            if task_result.state == 'PENDING':
                response_data['status'] = 'Task is waiting to start'
                response_data['progress'] = 0
            elif task_result.state == 'PROCESSING':
                response_data['status'] = task_result.info.get('status', 'Processing...')
                response_data['progress'] = task_result.info.get('progress', 0)
            elif task_result.state == 'SUCCESS':
                response_data['status'] = 'Completed'
                response_data['progress'] = 100
                response_data['result'] = task_result.info.get('results', {})
            elif task_result.state == 'FAILURE':
                response_data['status'] = 'Failed'
                response_data['error'] = str(task_result.info)
            else:
                response_data['status'] = task_result.state
            
            return Response(response_data)
        
        except Exception as e:
            logger.error(f"Failed to get task status: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'Failed to get task status: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AtlasTaskStatusView(APIView):
    """
    Get the current processing task status for an atlas
    """
    permission_classes = (IsAuthenticated,)
    
    def get(self, request, atlas_id):
        """Get current task status for an atlas"""
        try:
            # Get the most recent task for this atlas and user
            task = AtlasProcessingTask.objects.filter(
                atlas_id=atlas_id,
                user=request.user,
                status__in=['PENDING', 'PROCESSING']
            ).first()
            
            if not task:
                return Response({
                    'has_running_task': False
                }, status=status.HTTP_200_OK)
            
            try:
                # Get live status from Celery
                task_result = AsyncResult(task.task_id)
                
                response_data = {
                    'has_running_task': True,
                    'task_id': task.task_id,
                    'state': task_result.state,
                }
            except (ValueError, KeyError) as e:
                # Handle corrupted Celery task metadata
                logger.warning(f"Corrupted task metadata for {task.task_id}: {str(e)}")
                # Return database status instead
                return Response({
                    'has_running_task': True,
                    'task_id': task.task_id,
                    'state': task.status,
                    'status': task.status_message or 'Processing...',
                    'progress': task.progress
                }, status=status.HTTP_200_OK)
            
            if task_result.state == 'PENDING':
                response_data['status'] = 'Task is waiting to start'
                response_data['progress'] = 0
            elif task_result.state == 'PROCESSING':
                response_data['status'] = task_result.info.get('status', 'Processing...')
                response_data['progress'] = task_result.info.get('progress', 0)
            elif task_result.state == 'SUCCESS':
                response_data['status'] = 'Completed'
                response_data['progress'] = 100
                response_data['result'] = task_result.info.get('results', {})
                # Update database
                task.status = 'SUCCESS'
                task.progress = 100
                task.result = task_result.info
                task.save()
            elif task_result.state == 'FAILURE':
                response_data['status'] = 'Failed'
                response_data['error'] = str(task_result.info)
                # Update database
                task.status = 'FAILURE'
                task.error_message = str(task_result.info)
                task.save()
            else:
                response_data['status'] = task_result.state
            
            return Response(response_data)
        
        except Exception as e:
            logger.error(f"Failed to get atlas task status: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'Failed to get task status: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UploadDataDictionaryView(APIView):
    """
    Upload data dictionary CSV file to GCS bucket
    """
    permission_classes = (IsAuthenticated,)
    parser_classes = (MultiPartParser, FormParser)
    
    def post(self, request):
        """Upload data dictionary CSV to GCS"""
        try:
            file = request.FILES.get('file')
            atlas_id = request.data.get('atlas_id')
            
            if not file:
                return Response(
                    {'detail': 'No file provided'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not atlas_id:
                return Response(
                    {'detail': 'Atlas ID is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate file is CSV
            if not file.name.endswith('.csv'):
                return Response(
                    {'detail': 'File must be a CSV'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            logger.info(f"Uploading data dictionary for atlas {atlas_id}, file: {file.name}")
            
            # Initialize GCS client
            storage_client = storage.Client(project=settings.GCS_PROJECT_ID)
            bucket = storage_client.bucket(settings.GCS_BUCKET_NAME)
            
            # Create blob path: atlases/{atlas_id}/data_dictionary.csv
            blob_path = f"atlases/{atlas_id}/data_dictionary.csv"
            blob = bucket.blob(blob_path)
            
            # Upload file
            blob.upload_from_file(file, content_type='text/csv')
            
            logger.info(f"Successfully uploaded data dictionary to gs://{settings.GCS_BUCKET_NAME}/{blob_path}")
            
            return Response({
                'message': 'Data dictionary uploaded successfully',
                'gcs_path': f"gs://{settings.GCS_BUCKET_NAME}/{blob_path}",
                'atlas_id': atlas_id
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Failed to upload data dictionary: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'Failed to upload file: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
