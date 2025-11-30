"""URL Configuration for API endpoints"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from api.views import (
    # Cohort views
    CohortViewSet,
    FilterViewSet,
    QueryHistoryViewSet,
    # Auth views
    CSRFTokenView,
    LoginView,
    RegisterView,
    LogoutView,
    MeView,
    ProfileUpdateView,
    # Polly views
    PollyAtlasListView,
    ProcessAtlasView,
    ProcessAtlasStatusView,
    AtlasTaskStatusView,
    UploadDataDictionaryView,
    UploadSchemaKeysView,
    # Cohort project views
    CohortProjectListCreateView,
    CohortProjectDetailView,
    ChatMessageListCreateView,
    DatabaseSchemaView,
    ProjectShareView,
    UserListView,
    # Chat views
    ChatStreamView,
    ChatSessionView,
    ChatHistoryView,
    ChatActionView,
    ConversationalChatView,
)
from api.views.field_mapping_views import (
    CacheStatusView,
    SchemaValidationView,
    ProjectSchemaView,
    ProjectTableFieldsView,
    ProjectFieldValuesView,
    FieldMappingListCreateView,
    FieldMappingDetailView,
)

router = DefaultRouter()
router.register(r'cohorts', CohortViewSet, basename='cohort')
router.register(r'filters', FilterViewSet, basename='filter')
router.register(r'queries', QueryHistoryViewSet, basename='query')

urlpatterns = [
    # Authentication endpoints
    path('auth/csrf', CSRFTokenView.as_view(), name='auth-csrf'),
    path('auth/login', LoginView.as_view(), name='auth-login'),
    path('auth/register', RegisterView.as_view(), name='auth-register'),
    path('auth/logout', LogoutView.as_view(), name='auth-logout'),
    path('auth/me', MeView.as_view(), name='auth-me'),
    path('auth/profile', ProfileUpdateView.as_view(), name='auth-profile-update'),
    
    # Polly API endpoints
    path('polly/atlases', PollyAtlasListView.as_view(), name='polly-atlases'),
    path('polly/atlases/<str:atlas_id>/process', ProcessAtlasView.as_view(), name='polly-process-atlas'),
    path('polly/atlases/<str:atlas_id>/task-status', AtlasTaskStatusView.as_view(), name='polly-atlas-task-status'),
    path('polly/tasks/<str:task_id>/status', ProcessAtlasStatusView.as_view(), name='polly-task-status'),
    path('polly/upload-data-dict', UploadDataDictionaryView.as_view(), name='upload-data-dict'),
    path('polly/upload-schema-keys', UploadSchemaKeysView.as_view(), name='upload-schema-keys'),
    
    # Cohort Project endpoints
    path('cohort-projects', CohortProjectListCreateView.as_view(), name='cohort-project-list-create'),
    path('cohort-projects/<int:project_id>', CohortProjectDetailView.as_view(), name='cohort-project-detail'),
    path('cohort-projects/<int:project_id>/messages', ChatMessageListCreateView.as_view(), name='chat-message-list-create'),
    path('cohort-projects/<int:project_id>/schema', DatabaseSchemaView.as_view(), name='database-schema'),
    path('cohort-projects/<int:project_id>/share', ProjectShareView.as_view(), name='project-share'),
    path('users', UserListView.as_view(), name='user-list'),
    
    # Field Mapping endpoints (lazy loading)
    path('cohort-projects/<int:project_id>/cache-status', CacheStatusView.as_view(), name='cache-status'),
    path('cohort-projects/<int:project_id>/validate-schema', SchemaValidationView.as_view(), name='validate-schema'),
    path('cohort-projects/<int:project_id>/table-schema', ProjectSchemaView.as_view(), name='project-schema'),
    path('cohort-projects/<int:project_id>/tables/<str:table_name>/fields', ProjectTableFieldsView.as_view(), name='project-table-fields'),
    path('cohort-projects/<int:project_id>/tables/<str:table_name>/fields/<str:field_name>/values', ProjectFieldValuesView.as_view(), name='project-field-values'),
    path('cohort-projects/<int:project_id>/field-mappings', FieldMappingListCreateView.as_view(), name='field-mapping-list-create'),
    path('cohort-projects/<int:project_id>/field-mappings/<uuid:mapping_id>', FieldMappingDetailView.as_view(), name='field-mapping-detail'),
    
    # Chat/NLQ Agent endpoints
    path('chat/stream', ChatStreamView.as_view(), name='chat-stream'),
    path('chat/conversational', ConversationalChatView.as_view(), name='chat-conversational'),
    path('chat/session/<int:project_id>', ChatSessionView.as_view(), name='chat-session'),
    path('chat/history/<int:project_id>', ChatHistoryView.as_view(), name='chat-history'),
    path('chat/action', ChatActionView.as_view(), name='chat-action'),
    
    # API endpoints
    path('', include(router.urls)),
]
