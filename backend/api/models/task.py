"""Atlas processing task models"""
from django.db import models
from django.contrib.auth.models import User


class AtlasProcessingTask(models.Model):
    """Tracks atlas processing tasks"""
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('PROCESSING', 'Processing'),
        ('SUCCESS', 'Success'),
        ('FAILURE', 'Failure'),
    )
    
    atlas_id = models.CharField(max_length=255)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='atlas_tasks')
    task_id = models.CharField(max_length=255, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    progress = models.IntegerField(default=0)
    status_message = models.TextField(blank=True)
    result = models.JSONField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['atlas_id', 'user']),
            models.Index(fields=['task_id']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"Atlas {self.atlas_id} - {self.status}"
