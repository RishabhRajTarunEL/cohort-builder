"""
Field mapping model to store user-defined and agent-finalized field mappings.
This enables sync between left panel filters and agent-generated mappings.
"""
import uuid
from django.db import models
from django.contrib.auth.models import User
from .project import CohortProject


class FieldMapping(models.Model):
    """
    Stores field mappings and concept mappings for filters.
    
    This model acts as the single source of truth for:
    1. User-created filters from left panel
    2. Agent-finalized mappings before SQL generation
    3. Bidirectional sync between UI and agent
    """
    
    SOURCE_CHOICES = (
        ('user', 'User Created'),
        ('agent', 'Agent Finalized'),
        ('imported', 'Imported'),
    )
    
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('pending_agent', 'Pending Agent Review'),
        ('agent_confirmed', 'Agent Confirmed'),
        ('applied', 'Applied to Query'),
    )
    
    # Identification
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cohort_project = models.ForeignKey(
        CohortProject, 
        on_delete=models.CASCADE, 
        related_name='field_mappings'
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    
    # Source tracking
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='user')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    
    # Field mapping data
    table_name = models.CharField(max_length=255)
    field_name = models.CharField(max_length=255)
    field_type = models.CharField(max_length=100)  # int64, float64, object, bool
    
    # Concept mapping
    concept = models.CharField(max_length=500, help_text="Human-readable concept (e.g., 'female patients')")
    operator = models.CharField(max_length=50, blank=True, help_text="Operator: =, !=, >, <, >=, <=, BETWEEN, IN")
    
    # Values
    value = models.JSONField(
        help_text="Single value, list of values, or range {min, max}"
    )
    
    # SQL representation
    sql_criterion = models.TextField(
        help_text="SQL WHERE clause fragment (e.g., 'patients.gender = \"Female\"')"
    )
    
    # Metadata
    display_text = models.TextField(
        help_text="Display text for UI (e.g., 'Gender is Female')"
    )
    
    # Agent metadata
    agent_metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional metadata from agent (confidence, alternatives, etc.)"
    )
    
    # Ordering and grouping
    filter_group = models.CharField(
        max_length=255, 
        blank=True,
        help_text="Group related filters together (e.g., 'demographics', 'diagnoses')"
    )
    order_index = models.IntegerField(default=0)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    applied_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['order_index', '-created_at']
        indexes = [
            models.Index(fields=['cohort_project', 'status']),
            models.Index(fields=['cohort_project', 'table_name']),
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['status', 'source']),
        ]
        verbose_name = 'Field Mapping'
        verbose_name_plural = 'Field Mappings'
    
    def __str__(self):
        return f"{self.table_name}.{self.field_name}: {self.display_text}"
    
    def to_filter_dict(self):
        """Convert to filter format compatible with FilterContext"""
        return {
            'id': str(self.id),
            'type': 'include',  # or determine from operator
            'text': self.display_text,
            'entities': [self.concept],
            'db_mappings': {
                self.concept: {
                    'entity_class': 'attribute',
                    'table.field': f"{self.table_name}.{self.field_name}",
                    'ranked_matches': [self.value] if not isinstance(self.value, list) else self.value,
                    'mapped_concept': self.concept,
                    'mapping_method': 'direct' if self.source == 'user' else 'agent',
                    'reason': None,
                    'top_candidates': self.agent_metadata.get('alternatives', []),
                }
            },
            'revised_criterion': self.sql_criterion,
            'enabled': self.status == 'applied',
            'affectedCount': 0,
            'source': self.source,
            'status': self.status,
        }
    
    @classmethod
    def from_filter_dict(cls, filter_data, cohort_project, user):
        """Create FieldMapping from filter dictionary"""
        db_mapping = list(filter_data.get('db_mappings', {}).values())[0] if filter_data.get('db_mappings') else {}
        table_field = db_mapping.get('table.field', '').split('.')
        
        return cls(
            cohort_project=cohort_project,
            user=user,
            source='user',
            status='draft',
            table_name=table_field[0] if len(table_field) > 0 else '',
            field_name=table_field[1] if len(table_field) > 1 else '',
            field_type='object',  # default, should be determined from schema
            concept=list(filter_data.get('entities', [''])[0]),
            operator='=',  # default
            value=filter_data.get('db_mappings', {}).get(filter_data['entities'][0], {}).get('ranked_matches', [])[0] if filter_data.get('entities') else None,
            sql_criterion=filter_data.get('revised_criterion', ''),
            display_text=filter_data.get('text', ''),
            agent_metadata={},
        )
