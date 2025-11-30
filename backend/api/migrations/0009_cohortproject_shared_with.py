# Generated migration for adding sharing functionality

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0008_fieldmapping'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='cohortproject',
            name='shared_with',
            field=models.ManyToManyField(blank=True, related_name='shared_cohort_projects', to=settings.AUTH_USER_MODEL),
        ),
    ]

