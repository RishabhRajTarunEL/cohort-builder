"""Cohort project and chat models"""
import uuid
from django.db import models
from django.contrib.auth.models import User


class CohortProject(models.Model):
    """Represents a cohort project with associated atlas"""
    name = models.CharField(max_length=255)
    atlas_id = models.CharField(max_length=255)
    atlas_name = models.CharField(max_length=255)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='cohort_projects')
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['atlas_id']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.atlas_name})"


class ChatSession(models.Model):
    """Stores chat session state for a cohort project"""
    session_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    cohort_project = models.OneToOneField(CohortProject, on_delete=models.CASCADE, related_name='chat_session')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='chat_sessions')
    current_stage = models.IntegerField(default=0)  # 0, 1, 2, or 3
    state_data = models.JSONField(default=dict)  # Stores current criteria, UI component values, etc.
    last_query_results = models.JSONField(null=True, blank=True)  # Store last execution results
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', '-updated_at']),
            models.Index(fields=['session_id']),
        ]
    
    def __str__(self):
        return f"ChatSession for {self.cohort_project.name} - Stage {self.current_stage}"


class ChatMessage(models.Model):
    """Stores chat messages for a cohort project with UI component state"""
    ROLE_CHOICES = (
        ('user', 'User'),
        ('assistant', 'Assistant'),
        ('system', 'System'),
    )
    
    MESSAGE_TYPE_CHOICES = (
        ('text', 'Text Message'),
        ('criteria_chips', 'Criteria Chips'),
        ('ui_components', 'UI Components'),
        ('sql_preview', 'SQL Preview'),
        ('query_results', 'Query Results'),
        ('progress', 'Progress Update'),
        ('error', 'Error Message'),
    )
    
    cohort_project = models.ForeignKey(CohortProject, on_delete=models.CASCADE, related_name='messages')
    chat_session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name='messages', null=True, blank=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPE_CHOICES, default='text')
    content = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)  # Stores stage, criteria, UI components, etc.
    stage = models.IntegerField(default=0)  # Which stage this message belongs to
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['cohort_project', 'created_at']),
            models.Index(fields=['chat_session', 'stage']),
        ]
    
    def __str__(self):
        return f"{self.role} ({self.message_type}): {self.content[:50]}..."
