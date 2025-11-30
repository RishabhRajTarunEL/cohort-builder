"""
Cohort Project Views
"""
import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from api.models import CohortProject, ChatMessage, AtlasProcessingTask
from api.serializers import CohortProjectSerializer, ChatMessageSerializer
from api.storage import get_gcs_storage
import json
from pathlib import Path

logger = logging.getLogger(__name__)


class CohortProjectListCreateView(APIView):
    """List all cohort projects or create a new one"""
    permission_classes = (IsAuthenticated,)
    
    def get(self, request):
        """Get all cohort projects for the authenticated user"""
        try:
            projects = CohortProject.objects.filter(user=request.user)
            serializer = CohortProjectSerializer(projects, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Failed to list cohort projects: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'Failed to list projects: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def post(self, request):
        """Create a new cohort project"""
        try:
            atlas_id = request.data.get('atlas_id')
            atlas_name = request.data.get('atlas_name')
            name = request.data.get('name')
            description = request.data.get('description', '')
            
            # Validate required fields
            if not atlas_id or not atlas_name or not name:
                return Response(
                    {'detail': 'atlas_id, atlas_name, and name are required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Verify that the atlas has been successfully processed
            successful_task = AtlasProcessingTask.objects.filter(
                atlas_id=atlas_id,
                user=request.user,
                status='SUCCESS'
            ).first()
            
            if not successful_task:
                return Response(
                    {'detail': 'Atlas must be successfully processed before creating a cohort project'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create the cohort project
            project = CohortProject.objects.create(
                name=name,
                atlas_id=atlas_id,
                atlas_name=atlas_name,
                user=request.user,
                description=description
            )
            
            serializer = CohortProjectSerializer(project)
            logger.info(f"Created cohort project {project.id} for user {request.user.id}")
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Failed to create cohort project: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'Failed to create project: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CohortProjectDetailView(APIView):
    """Retrieve, update, or delete a cohort project"""
    permission_classes = (IsAuthenticated,)
    
    def get(self, request, project_id):
        """Get a specific cohort project"""
        try:
            project = get_object_or_404(CohortProject, id=project_id, user=request.user)
            serializer = CohortProjectSerializer(project)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Failed to get cohort project: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'Failed to get project: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def patch(self, request, project_id):
        """Update a cohort project"""
        try:
            project = get_object_or_404(CohortProject, id=project_id, user=request.user)
            
            # Update allowed fields
            if 'name' in request.data:
                project.name = request.data['name']
            if 'description' in request.data:
                project.description = request.data['description']
            
            project.save()
            serializer = CohortProjectSerializer(project)
            
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Failed to update cohort project: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'Failed to update project: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def delete(self, request, project_id):
        """Delete a cohort project"""
        try:
            project = get_object_or_404(CohortProject, id=project_id, user=request.user)
            project.delete()
            
            return Response(
                {'detail': 'Project deleted successfully'},
                status=status.HTTP_204_NO_CONTENT
            )
        except Exception as e:
            logger.error(f"Failed to delete cohort project: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'Failed to delete project: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ChatMessageListCreateView(APIView):
    """List chat messages or create a new message"""
    permission_classes = (IsAuthenticated,)
    
    def get(self, request, project_id):
        """Get all chat messages for a cohort project"""
        try:
            project = get_object_or_404(CohortProject, id=project_id, user=request.user)
            messages = ChatMessage.objects.filter(cohort_project=project)
            serializer = ChatMessageSerializer(messages, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Failed to list chat messages: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'Failed to list messages: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def post(self, request, project_id):
        """Create a new chat message"""
        try:
            project = get_object_or_404(CohortProject, id=project_id, user=request.user)
            
            content = request.data.get('content')
            role = request.data.get('role', 'user')
            
            if not content:
                return Response(
                    {'detail': 'content is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if role not in ['user', 'assistant']:
                return Response(
                    {'detail': 'role must be either "user" or "assistant"'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create the message
            message = ChatMessage.objects.create(
                cohort_project=project,
                role=role,
                content=content
            )
            
            serializer = ChatMessageSerializer(message)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Failed to create chat message: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'Failed to create message: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DatabaseSchemaView(APIView):
    """Get database schema for a cohort project"""
    permission_classes = (IsAuthenticated,)
    
    def get(self, request, project_id):
        """Get the database schema for a specific cohort project"""
        try:
            # Verify the project exists and belongs to the user
            project = get_object_or_404(CohortProject, id=project_id, user=request.user)
            
            # Validate atlas_id exists
            if not project.atlas_id:
                logger.warning(f"Project {project_id} has no atlas_id")
                return Response(
                    {'detail': 'Project has no atlas_id. Please ensure the atlas has been processed.'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Try to get cached schema first (same approach as ProjectSchemaView)
            from api.storage.atlas_file_cache import AtlasFileCache
            
            cache = AtlasFileCache(project.atlas_id)
            cached_files = cache.get_cached_files()
            
            if cached_files and 'schema' in cached_files:
                schema_data = cached_files['schema']
                logger.info(f"Successfully loaded schema for project {project_id} from cache")
                return Response(schema_data, status=status.HTTP_200_OK)
            
            # If not in cache, try to load from GCS and cache it
            try:
                from api.storage.gcs_storage import get_gcs_storage
                gcs = get_gcs_storage()
                gcs_path = f"atlases/{project.atlas_id}/schema.json"
                
                # Download schema file from GCS
                local_path = f"/tmp/db_schema_{project.atlas_id}.json"
                gcs.download_file(gcs_path, local_path)
                
                # Read the schema
                with open(local_path, 'r') as f:
                    schema_data = json.load(f)
                
                # Cache it for future use
                try:
                    cache.cache_files({'schema': schema_data})
                    logger.info(f"Cached schema for atlas {project.atlas_id}")
                except Exception as cache_error:
                    logger.warning(f"Failed to cache schema: {cache_error}")
                
                # Clean up temp file
                Path(local_path).unlink(missing_ok=True)
                
                logger.info(f"Successfully loaded schema for project {project_id} from GCS")
                return Response(schema_data, status=status.HTTP_200_OK)
                
            except Exception as gcs_error:
                logger.warning(f"Failed to load schema from GCS: {str(gcs_error)}")
                
                # Fallback: Try to load from local file system
                local_schema_path = Path(__file__).parent.parent.parent.parent / "frontend" / "app" / "lib" / "db_schema.json"
                
                if local_schema_path.exists():
                    with open(local_schema_path, 'r') as f:
                        schema_data = json.load(f)
                    
                    logger.info(f"Successfully loaded schema for project {project_id} from local fallback")
                    return Response(schema_data, status=status.HTTP_200_OK)
                else:
                    logger.error(f"Schema file not found in cache, GCS, or locally for atlas {project.atlas_id}")
                    return Response(
                        {'detail': 'Database schema not found. Please ensure the atlas has been processed and cached.'},
                        status=status.HTTP_404_NOT_FOUND
                    )
            
        except Exception as e:
            logger.error(f"Failed to get database schema: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'Failed to get schema: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
