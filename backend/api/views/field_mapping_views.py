"""
API views for field mappings and schema operations.
Enables lazy loading of schema data and syncing between left panel and agent.
"""
import logging
import json
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.http import Http404
from api.models import CohortProject, FieldMapping
from api.storage.atlas_file_cache import AtlasFileCache
import pandas as pd

logger = logging.getLogger(__name__)


def get_project_with_access(project_id, user):
    """
    Get a cohort project if user has access (owner or shared).
    Raises Http404 if project doesn't exist or user doesn't have access.
    """
    try:
        project = CohortProject.objects.get(id=project_id)
        if not project.can_access(user):
            raise Http404("You do not have permission to access this project")
        return project
    except CohortProject.DoesNotExist:
        raise Http404("Project not found")


class CacheStatusView(APIView):
    """
    Check if atlas files are cached without trying to load them.
    Returns cache readiness status for the frontend loader.
    
    GET: Lightweight check - only checks metadata, does NOT load files.
    POST: Triggers full caching of atlas files from GCS.
    """
    permission_classes = (IsAuthenticated,)
    
    def get(self, request, project_id):
        """Check if cache is ready (lightweight, no file loading)"""
        try:
            project = get_project_with_access(project_id, request.user)
            
            # Validate atlas_id exists
            if not project.atlas_id:
                logger.warning(f"Project {project_id} has no atlas_id")
                return Response({
                    'is_ready': False,
                    'atlas_id': None,
                    'has_schema': False,
                    'has_db': False,
                    'error': 'Project has no atlas_id'
                }, status=status.HTTP_200_OK)
            
            # Lightweight cache check - does NOT load files
            file_cache = AtlasFileCache(project.atlas_id)
            cache_status = file_cache.is_cached()
            
            # Determine if ready (need at least schema and db)
            has_schema = 'schema' in cache_status['files']
            has_db = 'db' in cache_status['files'] or 'concept_embeddings' in cache_status['files']
            is_ready = cache_status['is_cached'] and has_schema
            
            return Response({
                'is_ready': is_ready,
                'atlas_id': project.atlas_id,
                'has_schema': has_schema,
                'has_db': has_db,
                'in_memory': cache_status['in_memory'],
                'on_disk': cache_status['on_disk'],
                'cached_files': cache_status['files'],
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Cache status check failed for project {project_id}: {e}", exc_info=True)
            return Response(
                {'detail': str(e), 'is_ready': False},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def post(self, request, project_id):
        """Trigger full caching of atlas files from GCS.
        
        Called when cohort project page loads to pre-cache all files.
        This makes the first message much faster.
        """
        try:
            project = get_project_with_access(project_id, request.user)
            
            if not project.atlas_id:
                return Response({
                    'cached': False,
                    'error': 'Project has no atlas_id'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if already cached
            file_cache = AtlasFileCache(project.atlas_id)
            cache_status = file_cache.is_cached()
            
            if cache_status['is_cached']:
                logger.info(f"Atlas {project.atlas_id} already cached")
                return Response({
                    'cached': True,
                    'already_cached': True,
                    'in_memory': cache_status['in_memory'],
                    'files': cache_status['files']
                }, status=status.HTTP_200_OK)
            
            # Trigger full caching by loading all files
            logger.info(f"🔄 Triggering full cache for atlas {project.atlas_id}")
            
            from api.services.agent.agent_service import AgentService
            
            # This will download from GCS and cache everything
            agent = AgentService(
                project_id=str(project.id),
                atlas_id=project.atlas_id,
                user_id=request.user.id
            )
            
            # Get updated cache status
            new_status = file_cache.is_cached()
            
            # Cleanup (but keep cached files)
            agent.cleanup()
            
            return Response({
                'cached': True,
                'already_cached': False,
                'in_memory': new_status['in_memory'],
                'files': new_status['files']
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Cache trigger failed for project {project_id}: {e}", exc_info=True)
            return Response(
                {'cached': False, 'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SchemaValidationView(APIView):
    """
    Validate schema.json against actual SQLite database.
    Returns mismatches between schema file and database structure.
    """
    permission_classes = (IsAuthenticated,)
    
    def get(self, request, project_id):
        """Compare schema.json with actual database"""
        try:
            project = get_project_with_access(project_id, request.user)
            
            if not project.atlas_id:
                return Response(
                    {'detail': 'Project has no atlas_id'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Import agent service for validation
            from api.services.agent.agent_service import AgentService
            
            agent = AgentService(
                project_id=str(project.id),
                atlas_id=project.atlas_id,
                user_id=request.user.id
            )
            
            try:
                result = agent.validate_schema_vs_database()
                return Response(result, status=status.HTTP_200_OK)
            finally:
                agent.cleanup()
                
        except Exception as e:
            logger.error(f"Schema validation failed: {e}", exc_info=True)
            return Response(
                {'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ProjectSchemaView(APIView):
    """
    Get schema for a cohort project.
    Returns table names only initially, fields loaded on demand.
    """
    permission_classes = (IsAuthenticated,)
    
    def get(self, request, project_id):
        """Get schema structure for project"""
        try:
            project = get_project_with_access(project_id, request.user)
            
            # Get cached atlas files
            cache = AtlasFileCache(project.atlas_id)
            cached_files = cache.get_cached_files()
            
            if not cached_files or 'schema' not in cached_files:
                return Response(
                    {'detail': 'Atlas schema not found. Please process the atlas first.'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            schema = cached_files['schema']
            db_path = cached_files.get('db_path')
            
            logger.info(f"Schema loaded from cache with {len(schema)} tables")
            if db_path:
                logger.info(f"Database file available at: {db_path}")
            
            # Return table list with basic info (not full field details)
            tables = []
            for table_name, table_data in schema.items():
                tables.append({
                    'table_name': table_name,
                    'table_description': table_data.get('table_description', ''),
                    'field_count': len(table_data.get('fields', {})),
                })
            
            return Response({
                'tables': tables,
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Failed to get schema for project {project_id}: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'Failed to get schema: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ProjectTableFieldsView(APIView):
    """
    Get fields for a specific table in a project.
    Lazy loads field details only when table is expanded.
    """
    permission_classes = (IsAuthenticated,)
    
    def get(self, request, project_id, table_name):
        """Get fields for specific table"""
        try:
            project = get_project_with_access(project_id, request.user)
            
            # Get cached atlas files
            cache = AtlasFileCache(project.atlas_id)
            cached_files = cache.get_cached_files()
            
            if not cached_files or 'schema' not in cached_files:
                return Response(
                    {'detail': 'Atlas schema not found.'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            schema = cached_files['schema']
            
            if table_name not in schema:
                return Response(
                    {'detail': f'Table {table_name} not found in schema.'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            table_schema = schema[table_name]
            fields = []
            
            for field_name, field_data in table_schema.get('fields', {}).items():
                field_info = {
                    'field_name': field_name,
                    'field_type': field_data.get('field_data_type', 'object'),
                    'field_description': field_data.get('field_description', ''),
                    'field_uniqueness_percent': field_data.get('field_uniqueness_percent', 0),
                }
                
                # Add value information based on type
                field_type = field_data.get('field_data_type', 'object')
                
                if field_type in ['int64', 'float64']:
                    # For numeric fields, provide range info
                    samples = field_data.get('field_sample_values', [])
                    if samples:
                        field_info['min_value'] = min(samples)
                        field_info['max_value'] = max(samples)
                        field_info['sample_values'] = samples[:5]  # First 5 samples
                
                elif field_type == 'object':
                    # For categorical fields, indicate if we have unique values
                    has_unique_values = bool(field_data.get('field_unique_values'))
                    field_info['has_unique_values'] = has_unique_values
                    field_info['value_count'] = len(field_data.get('field_unique_values', [])) if has_unique_values else 0
                    
                    # Don't send full value list yet, will be loaded on demand
                
                fields.append(field_info)
            
            return Response({
                'fields': fields,
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Failed to get table fields: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'Failed to get table fields: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ProjectFieldValuesView(APIView):
    """
    Get unique/sample values for a specific field.
    Only loaded when user expands a field to apply filter.
    Can optionally query the actual database for live values.
    """
    permission_classes = (IsAuthenticated,)
    
    def get(self, request, project_id, table_name, field_name):
        """Get values for specific field"""
        try:
            project = get_project_with_access(project_id, request.user)
            
            # Get cached atlas files
            cache = AtlasFileCache(project.atlas_id)
            cached_files = cache.get_cached_files()
            
            if not cached_files or 'schema' not in cached_files:
                return Response(
                    {'detail': 'Atlas schema not found.'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            schema = cached_files['schema']
            db_path = cached_files.get('db_path')
            
            if table_name not in schema:
                return Response(
                    {'detail': f'Table {table_name} not found.'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            table_schema = schema[table_name]
            fields = table_schema.get('fields', {})
            
            if field_name not in fields:
                return Response(
                    {'detail': f'Field {field_name} not found.'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            field_data = fields[field_name]
            field_type = field_data.get('field_data_type', 'object')
            
            response_data = {
                'field_name': field_name,
                'field_type': field_type,
            }
            
            # Try to get values from actual database if available
            use_db = request.query_params.get('use_db', 'true').lower() == 'true'
            limit = int(request.query_params.get('limit', 100))
            
            if use_db and db_path and field_type == 'object':
                try:
                    import sqlite3
                    conn = sqlite3.connect(db_path)
                    cursor = conn.cursor()
                    
                    # Query unique values from database
                    query = f'SELECT DISTINCT "{field_name}" FROM "{table_name}" WHERE "{field_name}" IS NOT NULL LIMIT {limit}'
                    cursor.execute(query)
                    db_values = [row[0] for row in cursor.fetchall()]
                    conn.close()
                    
                    if db_values:
                        response_data['values'] = db_values
                        response_data['has_unique_values'] = True
                        response_data['source'] = 'database'
                        logger.info(f"Retrieved {len(db_values)} values from database for {table_name}.{field_name}")
                        return Response(response_data, status=status.HTTP_200_OK)
                except Exception as e:
                    logger.warning(f"Failed to query database for values: {e}, falling back to schema")
            
            # Fallback to schema values
            if field_type == 'object':
                # Return unique or sample values from schema
                unique_values = field_data.get('field_unique_values', [])
                sample_values = field_data.get('field_sample_values', [])
                
                response_data['has_unique_values'] = bool(unique_values)
                response_data['values'] = unique_values if unique_values else sample_values
                response_data['source'] = 'schema'
                
            elif field_type in ['int64', 'float64']:
                # Return range and samples
                samples = field_data.get('field_sample_values', [])
                if samples:
                    response_data['min_value'] = min(samples)
                    response_data['max_value'] = max(samples)
                    response_data['sample_values'] = samples
                response_data['source'] = 'schema'
            
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Failed to get field values: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'Failed to get field values: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class FieldMappingListCreateView(APIView):
    """
    List and create field mappings for a project.
    """
    permission_classes = (IsAuthenticated,)
    
    def get(self, request, project_id):
        """Get all field mappings for project"""
        try:
            project = get_project_with_access(project_id, request.user)
            
            # Get query parameters for filtering
            status_filter = request.query_params.get('status')
            source_filter = request.query_params.get('source')
            
            try:
                mappings = FieldMapping.objects.filter(cohort_project=project)
                
                if status_filter:
                    mappings = mappings.filter(status=status_filter)
                if source_filter:
                    mappings = mappings.filter(source=source_filter)
                
                # Evaluate queryset to list to avoid lazy evaluation issues
                mappings_list = list(mappings)
            except Exception as query_error:
                logger.error(f"Database query error for field mappings: {query_error}", exc_info=True)
                return Response(
                    {'detail': f'Database error: {str(query_error)}', 'field_mappings': []},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            mapping_data = []
            for m in mappings_list:
                try:
                    mapping_data.append({
                    'id': str(m.id),
                        'table_name': m.table_name or '',
                        'field_name': m.field_name or '',
                        'field_type': m.field_type or 'object',
                        'concept': m.concept or '',
                        'operator': m.operator or '',
                        'value': m.value if m.value is not None else None,
                        'sql_criterion': m.sql_criterion or '',
                        'display_text': m.display_text or '',
                        'source': m.source or 'user',
                        'status': m.status or 'draft',
                        'filter_group': m.filter_group or '',
                        'agent_metadata': m.agent_metadata if m.agent_metadata is not None else {},
                        'created_at': m.created_at.isoformat() if m.created_at else None,
                        'updated_at': m.updated_at.isoformat() if m.updated_at else None,
                    })
                except Exception as e:
                    logger.error(f"Error serializing field mapping {m.id}: {e}", exc_info=True)
                    # Skip this mapping if there's an error
                    continue
            
            return Response({
                'field_mappings': mapping_data,
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Failed to list field mappings for project {project_id}: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'Failed to list mappings: {str(e)}', 'field_mappings': []},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def post(self, request, project_id):
        """Create new field mapping"""
        try:
            project = get_project_with_access(project_id, request.user)
            
            # Create field mapping
            mapping = FieldMapping.objects.create(
                cohort_project=project,
                user=request.user,
                source=request.data.get('source', 'user'),
                status=request.data.get('status', 'draft'),
                table_name=request.data.get('table_name'),
                field_name=request.data.get('field_name'),
                field_type=request.data.get('field_type', 'object'),
                concept=request.data.get('concept', ''),
                operator=request.data.get('operator', '='),
                value=request.data.get('value'),
                sql_criterion=request.data.get('sql_criterion', ''),
                display_text=request.data.get('display_text', ''),
                filter_group=request.data.get('filter_group', ''),
                agent_metadata=request.data.get('agent_metadata', {}),
            )
            
            logger.info(f"Created field mapping {mapping.id} for project {project_id}")
            
            return Response({
                'id': str(mapping.id),
                'message': 'Field mapping created successfully',
                'mapping': {
                    'id': str(mapping.id),
                    'table_name': mapping.table_name,
                    'field_name': mapping.field_name,
                    'display_text': mapping.display_text,
                    'status': mapping.status,
                }
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Failed to create field mapping: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'Failed to create mapping: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class FieldMappingDetailView(APIView):
    """
    Retrieve, update, or delete a field mapping.
    """
    permission_classes = (IsAuthenticated,)
    
    def get(self, request, project_id, mapping_id):
        """Get specific field mapping"""
        try:
            project = get_project_with_access(project_id, request.user)
            mapping = get_object_or_404(FieldMapping, id=mapping_id, cohort_project=project)
            
            return Response({
                'id': str(mapping.id),
                'table_name': mapping.table_name,
                'field_name': mapping.field_name,
                'field_type': mapping.field_type,
                'concept': mapping.concept,
                'operator': mapping.operator,
                'value': mapping.value,
                'sql_criterion': mapping.sql_criterion,
                'display_text': mapping.display_text,
                'source': mapping.source,
                'status': mapping.status,
                'filter_group': mapping.filter_group,
                'agent_metadata': mapping.agent_metadata,
                'created_at': mapping.created_at.isoformat(),
                'updated_at': mapping.updated_at.isoformat(),
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Failed to get field mapping: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'Failed to get mapping: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def patch(self, request, project_id, mapping_id):
        """Update field mapping (agent can finalize here)"""
        try:
            project = get_project_with_access(project_id, request.user)
            mapping = get_object_or_404(FieldMapping, id=mapping_id, cohort_project=project)
            
            # Update allowed fields
            if 'status' in request.data:
                mapping.status = request.data['status']
            if 'sql_criterion' in request.data:
                mapping.sql_criterion = request.data['sql_criterion']
            if 'agent_metadata' in request.data:
                mapping.agent_metadata = request.data['agent_metadata']
            if 'concept' in request.data:
                mapping.concept = request.data['concept']
            if 'operator' in request.data:
                mapping.operator = request.data['operator']
            if 'value' in request.data:
                mapping.value = request.data['value']
            if 'display_text' in request.data:
                mapping.display_text = request.data['display_text']
            
            mapping.save()
            
            logger.info(f"Updated field mapping {mapping.id}")
            
            return Response({
                'message': 'Field mapping updated successfully',
                'mapping': {
                    'id': str(mapping.id),
                    'status': mapping.status,
                    'display_text': mapping.display_text,
                }
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Failed to update field mapping: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'Failed to update mapping: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def delete(self, request, project_id, mapping_id):
        """Delete field mapping"""
        try:
            project = get_project_with_access(project_id, request.user)
            mapping = get_object_or_404(FieldMapping, id=mapping_id, cohort_project=project)
            
            mapping.delete()
            
            logger.info(f"Deleted field mapping {mapping_id}")
            
            return Response(
                {'message': 'Field mapping deleted successfully'},
                status=status.HTTP_204_NO_CONTENT
            )
            
        except Exception as e:
            logger.error(f"Failed to delete field mapping: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'Failed to delete mapping: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
