"""
Chat API views with Server-Sent Events (SSE) streaming for NLQ Agent.
"""

import json
import logging
import time
import traceback
from typing import Generator, Dict, Any
from django.http import StreamingHttpResponse, JsonResponse
from django.views import View
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from api.models import CohortProject, ChatSession, ChatMessage
from api.services.agent import AgentService
from api.views.cohort_project_views import get_project_with_access
from rest_framework.exceptions import NotFound

logger = logging.getLogger(__name__)


class ChatStreamView(APIView):
    """
    SSE endpoint that streams agent progress through all 4 stages.
    
    POST /api/chat/stream/
    Body: {
        "project_id": "uuid",
        "message": "natural language query",
        "stage": 0,  // optional, defaults to 0
        "context": {}  // optional, previous stage data for continuation
    }
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            project_id = request.data.get('project_id')
            message = request.data.get('message', '')
            stage = request.data.get('stage', 0)
            context = request.data.get('context', {})
            
            if not project_id:
                return Response(
                    {"error": "project_id is required"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get cohort project
            try:
                project = get_project_with_access(project_id, request.user)
            except NotFound:
                raise  # Let DRF handle NotFound exceptions
            
            # Get or create chat session
            chat_session, created = ChatSession.objects.get_or_create(
                cohort_project=project,
                user=request.user,
                defaults={
                    'current_stage': 0,
                    'state_data': {}
                }
            )
            
            # Save user message
            if message:
                ChatMessage.objects.create(
                    cohort_project=project,
                    chat_session=chat_session,
                    role='user',
                    message_type='text',
                    content=message,
                    stage=stage
                )
            
            # Create streaming response
            response = StreamingHttpResponse(
                self._stream_agent_response(
                    project=project,
                    chat_session=chat_session,
                    message=message,
                    stage=stage,
                    context=context,
                    user_id=request.user.id
                ),
                content_type='text/event-stream'
            )
            response['Cache-Control'] = 'no-cache'
            response['X-Accel-Buffering'] = 'no'
            return response
            
        except Exception as e:
            logger.error(f"Error in ChatStreamView: {e}\n{traceback.format_exc()}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _stream_agent_response(
        self,
        project: CohortProject,
        chat_session: ChatSession,
        message: str,
        stage: int,
        context: Dict,
        user_id: int
    ) -> Generator[str, None, None]:
        """
        Generator that yields SSE events as the agent processes the query.
        """
        try:
            # Initialize agent service
            yield self._format_sse_event({
                'type': 'status',
                'message': 'Initializing agent...',
                'stage': stage
            })
            
            agent = AgentService(
                project_id=str(project.id),
                atlas_id=project.atlas_id,
                user_id=user_id
            )
            
            yield self._format_sse_event({
                'type': 'status',
                'message': 'Agent initialized successfully',
                'stage': stage
            })
            
            # Process based on current stage
            if stage == 0:
                # Stage 0: Extract criteria from natural language
                yield self._format_sse_event({
                    'type': 'progress',
                    'message': 'Analyzing your query...',
                    'stage': 0
                })
                
                feedback = context.get('feedback', '')
                result = agent.process_stage_0(message, feedback)
                
                # Save assistant message with criteria chips
                ChatMessage.objects.create(
                    cohort_project=project,
                    chat_session=chat_session,
                    role='assistant',
                    message_type='criteria_chips',
                    content=result.get('status', ''),
                    metadata=result,
                    stage=0
                )
                
                # Update session state
                chat_session.current_stage = 0
                chat_session.state_data = {'stage_0': result}
                chat_session.save()
                
                yield self._format_sse_event({
                    'type': 'stage_complete',
                    'stage': 0,
                    'data': result
                })
                
            elif stage == 1:
                # Stage 1: Map to schema/concepts and generate UI components
                yield self._format_sse_event({
                    'type': 'progress',
                    'message': 'Mapping criteria to database schema...',
                    'stage': 1
                })
                
                criteria = context.get('criteria', [])
                if not criteria:
                    raise ValueError("No criteria provided for stage 1")
                
                result = agent.process_stage_1(criteria)
                
                # Save assistant message with UI components
                ChatMessage.objects.create(
                    cohort_project=project,
                    chat_session=chat_session,
                    role='assistant',
                    message_type='ui_components',
                    content=result.get('status', ''),
                    metadata=result,
                    stage=1
                )
                
                # Update session state
                chat_session.current_stage = 1
                state_data = chat_session.state_data
                state_data['stage_1'] = result
                chat_session.state_data = state_data
                chat_session.save()
                
                yield self._format_sse_event({
                    'type': 'stage_complete',
                    'stage': 1,
                    'data': result
                })
                
            elif stage == 2:
                # Stage 2: Generate SQL query
                yield self._format_sse_event({
                    'type': 'progress',
                    'message': 'Generating SQL query...',
                    'stage': 2
                })
                
                criteria_with_values = context.get('criteria_with_values', [])
                if not criteria_with_values:
                    raise ValueError("No criteria with values provided for stage 2")
                
                result = agent.process_stage_2(criteria_with_values)
                
                # Save assistant message with SQL preview
                ChatMessage.objects.create(
                    cohort_project=project,
                    chat_session=chat_session,
                    role='assistant',
                    message_type='sql_preview',
                    content=result.get('sql_query') or result.get('status', 'SQL generation completed'),
                    metadata=result,
                    stage=2
                )
                
                # Update session state
                chat_session.current_stage = 2
                state_data = chat_session.state_data
                state_data['stage_2'] = result
                chat_session.state_data = state_data
                chat_session.save()
                
                yield self._format_sse_event({
                    'type': 'stage_complete',
                    'stage': 2,
                    'data': result
                })
                
            elif stage == 3:
                # Stage 3: Execute query
                yield self._format_sse_event({
                    'type': 'progress',
                    'message': 'Executing query on database...',
                    'stage': 3
                })
                
                sql_query = context.get('sql_query', '')
                if not sql_query:
                    raise ValueError("No SQL query provided for stage 3")
                
                result = agent.process_stage_3(sql_query)
                
                # Save assistant message with query results
                ChatMessage.objects.create(
                    cohort_project=project,
                    chat_session=chat_session,
                    role='assistant',
                    message_type='query_results',
                    content=f"Query returned {result['results']['total_count']} results",
                    metadata=result,
                    stage=3
                )
                
                # Update session state
                chat_session.current_stage = 3
                state_data = chat_session.state_data
                state_data['stage_3'] = result
                chat_session.last_query_results = result['results']
                chat_session.state_data = state_data
                chat_session.save()
                
                yield self._format_sse_event({
                    'type': 'stage_complete',
                    'stage': 3,
                    'data': result
                })
            
            else:
                raise ValueError(f"Invalid stage: {stage}")
            
            # Send completion event
            yield self._format_sse_event({
                'type': 'done',
                'message': 'Processing complete'
            })
            
        except Exception as e:
            logger.error(f"Error in agent stream: {e}\n{traceback.format_exc()}")
            
            # Save error message
            ChatMessage.objects.create(
                cohort_project=project,
                chat_session=chat_session,
                role='assistant',
                message_type='error',
                content=f"Error: {str(e)}",
                metadata={'error': str(e), 'traceback': traceback.format_exc()},
                stage=stage
            )
            
            yield self._format_sse_event({
                'type': 'error',
                'message': str(e),
                'stage': stage
            })
    
    def _format_sse_event(self, data: Dict[str, Any]) -> str:
        """Format data as Server-Sent Event."""
        return f"data: {json.dumps(data)}\n\n"


class ChatSessionView(APIView):
    """
    Get or manage chat session for a project.
    
    GET /api/chat/session/<project_id>/
    POST /api/chat/session/<project_id>/  (update state)
    DELETE /api/chat/session/<project_id>/  (reset/clear)
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, project_id):
        """Get current chat session state."""
        try:
            project = get_project_with_access(project_id, request.user)
            
            try:
                chat_session = ChatSession.objects.get(
                    cohort_project=project,
                    user=request.user
                )
                
                return Response({
                    'session_id': str(chat_session.session_id),
                    'project_id': str(project.id),
                    'project_name': project.name,
                    'atlas_id': str(project.atlas.id),
                    'atlas_name': project.atlas.name,
                    'current_stage': chat_session.current_stage,
                    'state_data': chat_session.state_data,
                    'last_query_results': chat_session.last_query_results,
                    'created_at': chat_session.created_at.isoformat(),
                    'updated_at': chat_session.updated_at.isoformat()
                })
                
            except ChatSession.DoesNotExist:
                # Return empty session data
                return Response({
                    'session_id': None,
                    'project_id': str(project.id),
                    'project_name': project.name,
                    'atlas_id': str(project.atlas.id),
                    'atlas_name': project.atlas.name,
                    'current_stage': 0,
                    'state_data': {},
                    'last_query_results': None
                })
                
        except NotFound:
            raise  # Let DRF handle NotFound exceptions
        except Exception as e:
            logger.error(f"Error getting chat session: {e}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def post(self, request, project_id):
        """Update chat session state."""
        try:
            project = get_project_with_access(project_id, request.user)
            
            chat_session, created = ChatSession.objects.get_or_create(
                cohort_project=project,
                user=request.user,
                defaults={
                    'current_stage': 0,
                    'state_data': {}
                }
            )
            
            # Update fields if provided
            if 'current_stage' in request.data:
                chat_session.current_stage = request.data['current_stage']
            
            if 'state_data' in request.data:
                chat_session.state_data = request.data['state_data']
            
            if 'last_query_results' in request.data:
                chat_session.last_query_results = request.data['last_query_results']
            
            chat_session.save()
            
            return Response({
                'session_id': str(chat_session.session_id),
                'current_stage': chat_session.current_stage,
                'state_data': chat_session.state_data,
                'updated_at': chat_session.updated_at.isoformat()
            })
            
        except CohortProject.DoesNotExist:
            return Response(
                {"error": "Project not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error updating chat session: {e}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def delete(self, request, project_id):
        """Reset/clear chat session."""
        try:
            project = get_project_with_access(project_id, request.user)
            
            # Delete all messages
            ChatMessage.objects.filter(cohort_project=project).delete()
            
            # Reset session
            try:
                chat_session = ChatSession.objects.get(
                    cohort_project=project,
                    user=request.user
                )
                chat_session.current_stage = 0
                chat_session.state_data = {}
                chat_session.last_query_results = None
                chat_session.save()
            except ChatSession.DoesNotExist:
                pass
            
            return Response({"message": "Chat session cleared"})
            
        except CohortProject.DoesNotExist:
            return Response(
                {"error": "Project not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error clearing chat session: {e}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ChatHistoryView(APIView):
    """
    Get chat message history for a project.
    
    GET /api/chat/history/<project_id>/
    Query params:
        - limit: max messages to return (default 50)
        - offset: pagination offset (default 0)
        - stage: filter by stage (optional)
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, project_id):
        """Get chat history with UI component metadata."""
        try:
            project = get_project_with_access(project_id, request.user)
            
            # Get query params
            limit = int(request.query_params.get('limit', 50))
            offset = int(request.query_params.get('offset', 0))
            stage_filter = request.query_params.get('stage')
            
            # Query messages
            messages_query = ChatMessage.objects.filter(
                cohort_project=project
            ).order_by('-created_at')
            
            if stage_filter is not None:
                messages_query = messages_query.filter(stage=int(stage_filter))
            
            total_count = messages_query.count()
            messages = messages_query[offset:offset + limit]
            
            # Format response
            messages_data = []
            for msg in messages:
                messages_data.append({
                    'id': msg.id,
                    'role': msg.role,
                    'message_type': msg.message_type,
                    'content': msg.content,
                    'metadata': msg.metadata,
                    'stage': msg.stage,
                    'created_at': msg.created_at.isoformat()
                })
            
            return Response({
                'project_id': str(project.id),
                'total_count': total_count,
                'limit': limit,
                'offset': offset,
                'messages': messages_data
            })
            
        except NotFound:
            raise  # Let DRF handle NotFound exceptions
        except Exception as e:
            logger.error(f"Error getting chat history: {e}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ChatActionView(APIView):
    """
    Handle chat actions like approve, edit, back, etc.
    
    POST /api/chat/action/
    Body: {
        "project_id": "uuid",
        "action": "approve" | "edit" | "back" | "add_criterion" | "delete_criterion",
        "data": {}  // action-specific data
    }
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Execute a chat action."""
        try:
            project_id = request.data.get('project_id')
            action = request.data.get('action')
            data = request.data.get('data', {})
            
            if not project_id or not action:
                return Response(
                    {"error": "project_id and action are required"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            project = get_project_with_access(project_id, request.user)
            chat_session = ChatSession.objects.get(
                cohort_project=project,
                user=request.user
            )
            
            # Handle different actions
            if action == 'approve':
                # Move to next stage
                next_stage = chat_session.current_stage + 1
                if next_stage > 3:
                    return Response(
                        {"error": "Already at final stage"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                return Response({
                    'action': 'approve',
                    'next_stage': next_stage,
                    'message': f'Ready to proceed to stage {next_stage}'
                })
            
            elif action == 'back':
                # Go back to previous stage
                prev_stage = chat_session.current_stage - 1
                if prev_stage < 0:
                    return Response(
                        {"error": "Already at first stage"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                chat_session.current_stage = prev_stage
                chat_session.save()
                
                return Response({
                    'action': 'back',
                    'current_stage': prev_stage,
                    'state_data': chat_session.state_data.get(f'stage_{prev_stage}', {})
                })
            
            elif action == 'edit_criteria':
                # Return to stage 1 with current values for editing
                stage_1_data = chat_session.state_data.get('stage_1', {})
                
                chat_session.current_stage = 1
                chat_session.save()
                
                return Response({
                    'action': 'edit_criteria',
                    'current_stage': 1,
                    'data': stage_1_data,
                    'message': 'Edit your criteria and resubmit'
                })
            
            elif action == 'add_criterion':
                # Add a new criterion to stage 0
                stage_0_data = chat_session.state_data.get('stage_0', {})
                criteria = stage_0_data.get('criteria', [])
                
                new_criterion = data.get('criterion', {})
                if not new_criterion:
                    return Response(
                        {"error": "criterion data is required"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                criteria.append(new_criterion)
                stage_0_data['criteria'] = criteria
                
                state_data = chat_session.state_data
                state_data['stage_0'] = stage_0_data
                chat_session.state_data = state_data
                chat_session.save()
                
                return Response({
                    'action': 'add_criterion',
                    'criteria': criteria
                })
            
            elif action == 'delete_criterion':
                # Delete a criterion from stage 0
                criterion_id = data.get('criterion_id')
                if not criterion_id:
                    return Response(
                        {"error": "criterion_id is required"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                stage_0_data = chat_session.state_data.get('stage_0', {})
                criteria = stage_0_data.get('criteria', [])
                
                criteria = [c for c in criteria if c.get('id') != criterion_id]
                stage_0_data['criteria'] = criteria
                
                state_data = chat_session.state_data
                state_data['stage_0'] = stage_0_data
                chat_session.state_data = state_data
                chat_session.save()
                
                return Response({
                    'action': 'delete_criterion',
                    'criteria': criteria
                })
            
            else:
                return Response(
                    {"error": f"Unknown action: {action}"},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
        except CohortProject.DoesNotExist:
            return Response(
                {"error": "Project not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except ChatSession.DoesNotExist:
            return Response(
                {"error": "Chat session not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error executing chat action: {e}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ConversationalChatView(APIView):
    """
    New conversational chat endpoint that intelligently determines 
    stage and action based on user message and conversation history.
    
    POST /api/chat/conversational/
    Body: {
        "project_id": int,
        "message": "user's natural language message"
    }
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            project_id = request.data.get('project_id')
            message = request.data.get('message', '').strip()
            field_mappings = request.data.get('field_mappings')  # Optional field mappings update
            
            if not project_id or not message:
                return Response(
                    {"error": "project_id and message are required"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get project (check access for owner or shared users)
            try:
                project = CohortProject.objects.get(id=project_id)
                if not project.can_access(request.user):
                    return Response(
                        {"error": "You do not have permission to access this project"},
                        status=status.HTTP_403_FORBIDDEN
                    )
            except CohortProject.DoesNotExist:
                return Response(
                    {"error": "Project not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Get or create chat session
            chat_session, created = ChatSession.objects.get_or_create(
                cohort_project=project,
                user=request.user,
                defaults={
                    'current_stage': 0,
                    'state_data': {}
                }
            )
            
            # Save user message
            user_msg = ChatMessage.objects.create(
                cohort_project=project,
                chat_session=chat_session,
                role='user',
                message_type='text',
                content=message,
                stage=chat_session.current_stage
            )
            
            # Get conversation history
            history = ChatMessage.objects.filter(
                chat_session=chat_session
            ).order_by('created_at').values(
                'id', 'role', 'message_type', 'content', 'metadata', 'stage', 'created_at'
            )
            history_list = list(history)
            
            # Initialize conversational agent
            # Note: File-level caching is now handled by AtlasFileCache in AgentService
            from api.services.agent.conversational_agent import ConversationalAgent
            
            logger.info(f"Creating agent for session {chat_session.id}")
            agent = ConversationalAgent(
                project_id=str(project.id),
                atlas_id=project.atlas_id,
                user_id=request.user.id
            )
            
            try:
                # Process message (with optional field mappings)
                response = agent.process_message(message, history_list, field_mappings=field_mappings)
                
                # Determine message type from ui_components
                ui_components = response.get('ui_components', [])
                if isinstance(ui_components, list) and len(ui_components) > 0:
                    message_type = ui_components[0].get('type', 'text')
                elif isinstance(ui_components, dict):
                    message_type = ui_components.get('type', 'text')
                else:
                    message_type = 'text'
                
                # Save assistant response
                assistant_msg = ChatMessage.objects.create(
                    cohort_project=project,
                    chat_session=chat_session,
                    role='assistant',
                    message_type=message_type,
                    content=response.get('response_text', ''),
                    metadata=response,
                    stage=response.get('stage', chat_session.current_stage)
                )
                
                # Update session state
                chat_session.current_stage = response.get('stage', chat_session.current_stage)
                chat_session.state_data = response.get('metadata', {})
                chat_session.save()
                
                # Return response
                return Response({
                    'user_message_id': user_msg.id,
                    'assistant_message_id': assistant_msg.id,
                    'response_text': response.get('response_text'),
                    'ui_components': response.get('ui_components'),
                    'stage': response.get('stage'),
                    'metadata': response.get('metadata', {}),
                    'next_prompt': response.get('next_prompt'),
                    'timestamp': assistant_msg.created_at.isoformat()
                })
                
            finally:
                # Cleanup agent (but cached files are preserved by AtlasFileCache)
                agent.cleanup()
                
        except Exception as e:
            logger.error(f"Error in conversational chat: {e}\n{traceback.format_exc()}")
            return Response(
                {"error": str(e), "traceback": traceback.format_exc()},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
