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
    # Cohort project views
    CohortProjectListCreateView,
    CohortProjectDetailView,
    ChatMessageListCreateView,
    # Chat views
    ChatStreamView,
    ChatSessionView,
    ChatHistoryView,
    ChatActionView,
    ConversationalChatView,
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
    
    # Cohort Project endpoints
    path('cohort-projects', CohortProjectListCreateView.as_view(), name='cohort-project-list-create'),
    path('cohort-projects/<int:project_id>', CohortProjectDetailView.as_view(), name='cohort-project-detail'),
    path('cohort-projects/<int:project_id>/messages', ChatMessageListCreateView.as_view(), name='chat-message-list-create'),
    
    # Chat/NLQ Agent endpoints
    path('chat/stream', ChatStreamView.as_view(), name='chat-stream'),
    path('chat/conversational', ConversationalChatView.as_view(), name='chat-conversational'),
    path('chat/session/<int:project_id>', ChatSessionView.as_view(), name='chat-session'),
    path('chat/history/<int:project_id>', ChatHistoryView.as_view(), name='chat-history'),
    path('chat/action', ChatActionView.as_view(), name='chat-action'),
    
    # API endpoints
    path('', include(router.urls)),
]
