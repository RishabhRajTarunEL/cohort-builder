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
from django.contrib.auth.models import User
from rest_framework.exceptions import NotFound
import json
from pathlib import Path


def get_project_with_access(project_id, user):
    """
    Get a cohort project if user has access (owner or shared).
    Raises NotFound if project doesn't exist or user doesn't have access.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        project = CohortProject.objects.get(id=project_id)
        logger.info(f"Found project {project_id}, checking access for user {user.id}")
        
        # Check if user is owner
        is_owner = project.user == user
        logger.info(f"User {user.id} is owner: {is_owner}")
        
        # Check if user is in shared_with
        is_shared = project.shared_with.filter(id=user.id).exists()
        logger.info(f"User {user.id} is shared: {is_shared}")
        
        if not (is_owner or is_shared):
            logger.warning(f"User {user.id} does not have access to project {project_id}")
            raise NotFound("You do not have permission to access this project")
        
        logger.info(f"User {user.id} has access to project {project_id}")
        return project
    except CohortProject.DoesNotExist:
        logger.warning(f"Project {project_id} not found")
        raise NotFound("Project not found")
    except NotFound:
        raise
    except Exception as e:
        logger.error(f"Error checking project access: {e}", exc_info=True)
        raise NotFound(f"Error accessing project: {str(e)}")

logger = logging.getLogger(__name__)


class CohortProjectListCreateView(APIView):
    """List all cohort projects or create a new one"""
    permission_classes = (IsAuthenticated,)
    
    def get(self, request):
        """Get all cohort projects for the authenticated user (owned and shared)"""
        try:
            # Get owned projects
            owned_projects = CohortProject.objects.filter(user=request.user)
            # Get shared projects
            shared_projects = CohortProject.objects.filter(shared_with=request.user)
            
            # Combine and deduplicate
            all_projects = (owned_projects | shared_projects).distinct()
            
            serializer = CohortProjectSerializer(all_projects, many=True, context={'request': request})
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
        """Get a specific cohort project (owner or shared user)"""
        try:
            project = get_project_with_access(project_id, request.user)
            serializer = CohortProjectSerializer(project, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except NotFound as e:
            logger.warning(f"Project {project_id} not found or no access for user {request.user.id}: {str(e)}")
            raise  # Let DRF handle NotFound exceptions
        except Exception as e:
            logger.error(f"Failed to get cohort project: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'Failed to get project: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def patch(self, request, project_id):
        """Update a cohort project (owner only)"""
        try:
            project = get_object_or_404(CohortProject, id=project_id)
            
            # Only owner can update
            if project.user != request.user:
                return Response(
                    {'detail': 'Only the project owner can update this project'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Update allowed fields
            if 'name' in request.data:
                project.name = request.data['name']
            if 'description' in request.data:
                project.description = request.data['description']
            
            project.save()
            serializer = CohortProjectSerializer(project, context={'request': request})
            
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Failed to update cohort project: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'Failed to update project: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def delete(self, request, project_id):
        """Delete a cohort project (owner only)"""
        try:
            project = get_object_or_404(CohortProject, id=project_id)
            
            # Only owner can delete
            if project.user != request.user:
                return Response(
                    {'detail': 'Only the project owner can delete this project'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
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
            project = get_project_with_access(project_id, request.user)
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
            project = get_project_with_access(project_id, request.user)
            
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
            # Verify the project exists and user has access
            project = get_project_with_access(project_id, request.user)
            
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


class ProjectShareView(APIView):
    """Share/unshare a cohort project with users"""
    permission_classes = (IsAuthenticated,)
    
    def post(self, request, project_id):
        """Share project with users"""
        try:
            project = get_object_or_404(CohortProject, id=project_id)
            
            # Only owner can share
            if project.user != request.user:
                return Response(
                    {'detail': 'Only the project owner can share this project'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            user_ids = request.data.get('user_ids', [])
            if not isinstance(user_ids, list):
                return Response(
                    {'detail': 'user_ids must be a list'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get users to share with
            users = User.objects.filter(id__in=user_ids)
            if users.count() != len(user_ids):
                return Response(
                    {'detail': 'Some user IDs are invalid'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Add users to shared_with (doesn't duplicate)
            project.shared_with.add(*users)
            
            serializer = CohortProjectSerializer(project, context={'request': request})
            logger.info(f"Project {project_id} shared with {len(users)} users")
            
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Failed to share project: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'Failed to share project: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def delete(self, request, project_id):
        """Unshare project with users"""
        try:
            project = get_object_or_404(CohortProject, id=project_id)
            
            # Only owner can unshare
            if project.user != request.user:
                return Response(
                    {'detail': 'Only the project owner can unshare this project'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            user_ids = request.data.get('user_ids', [])
            if not isinstance(user_ids, list):
                return Response(
                    {'detail': 'user_ids must be a list'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Remove users from shared_with
            users = User.objects.filter(id__in=user_ids)
            project.shared_with.remove(*users)
            
            serializer = CohortProjectSerializer(project, context={'request': request})
            logger.info(f"Project {project_id} unshared with {len(users)} users")
            
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Failed to unshare project: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'Failed to unshare project: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserListView(APIView):
    """List all users for sharing dropdown"""
    permission_classes = (IsAuthenticated,)
    
    def get(self, request):
        """Get all users (excluding current user)"""
        try:
            from api.serializers.project_serializers import UserSerializer
            
            # Get all users except current user
            users = User.objects.exclude(id=request.user.id).order_by('username')
            serializer = UserSerializer(users, many=True)
            
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Failed to list users: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'Failed to list users: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
