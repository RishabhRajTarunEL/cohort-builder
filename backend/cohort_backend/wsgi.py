"""
WSGI config for cohort_builder project.
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cohort_backend.settings')

application = get_wsgi_application()
