"""Cohort and filter models"""
from django.db import models
from django.contrib.auth.models import User


class Cohort(models.Model):
    """Represents a patient cohort"""
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='cohorts')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    patient_count = models.IntegerField(default=0)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return self.name


class Filter(models.Model):
    """Represents a filter applied to a cohort"""
    FILTER_TYPES = (
        ('include', 'Include'),
        ('exclude', 'Exclude'),
    )
    
    cohort = models.ForeignKey(Cohort, on_delete=models.CASCADE, related_name='filters')
    filter_type = models.CharField(max_length=10, choices=FILTER_TYPES, default='include')
    table_name = models.CharField(max_length=100)
    field_name = models.CharField(max_length=100)
    operator = models.CharField(max_length=50)  # =, !=, >, <, >=, <=, BETWEEN, IN, etc.
    value = models.JSONField()  # Store filter value(s) as JSON
    sql_criterion = models.TextField()  # Generated SQL criterion
    enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['created_at']
    
    def __str__(self):
        return f"{self.table_name}.{self.field_name} {self.operator}"


class QueryHistory(models.Model):
    """Stores natural language queries and their results"""
    cohort = models.ForeignKey(Cohort, on_delete=models.CASCADE, related_name='queries', null=True, blank=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='queries')
    query_text = models.TextField()
    interpretation = models.TextField(blank=True)
    suggested_filters = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Query histories'
    
    def __str__(self):
        return f"Query at {self.created_at}"
