import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0007_chatmessage_message_type_chatmessage_metadata_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='FieldMapping',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('source', models.CharField(choices=[('user', 'User Created'), ('agent', 'Agent Finalized'), ('imported', 'Imported')], default='user', max_length=20)),
                ('status', models.CharField(choices=[('draft', 'Draft'), ('pending_agent', 'Pending Agent Review'), ('agent_confirmed', 'Agent Confirmed'), ('applied', 'Applied to Query')], default='draft', max_length=20)),
                ('table_name', models.CharField(max_length=255)),
                ('field_name', models.CharField(max_length=255)),
                ('field_type', models.CharField(max_length=100)),
                ('concept', models.CharField(help_text='Human-readable concept', max_length=500)),
                ('operator', models.CharField(blank=True, max_length=50)),
                ('value', models.JSONField(help_text='Single value, list, or range {min, max}')),
                ('sql_criterion', models.TextField(help_text='SQL WHERE clause fragment')),
                ('display_text', models.TextField(help_text='Display text for UI')),
                ('agent_metadata', models.JSONField(blank=True, default=dict)),
                ('filter_group', models.CharField(blank=True, max_length=255)),
                ('order_index', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('applied_at', models.DateTimeField(blank=True, null=True)),
                ('cohort_project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='field_mappings', to='api.cohortproject')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['order_index', '-created_at'],
                'verbose_name': 'Field Mapping',
                'verbose_name_plural': 'Field Mappings',
            },
        ),
        migrations.AddIndex(
            model_name='fieldmapping',
            index=models.Index(fields=['cohort_project', 'status'], name='api_fieldma_cohort__5f2a3c_idx'),
        ),
        migrations.AddIndex(
            model_name='fieldmapping',
            index=models.Index(fields=['cohort_project', 'table_name'], name='api_fieldma_cohort__8a1b4d_idx'),
        ),
        migrations.AddIndex(
            model_name='fieldmapping',
            index=models.Index(fields=['user', '-created_at'], name='api_fieldma_user_id_9c3e5f_idx'),
        ),
        migrations.AddIndex(
            model_name='fieldmapping',
            index=models.Index(fields=['status', 'source'], name='api_fieldma_status__7d4f6e_idx'),
        ),
    ]
