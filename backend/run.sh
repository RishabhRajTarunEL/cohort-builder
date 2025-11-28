#!/bin/bash
set -e

# Wait for postgres
echo "Waiting for postgres..."
while ! nc -z $DB_HOST $DB_PORT; do
  sleep 0.1
done
echo "PostgreSQL started"

# Run migrations
python manage.py migrate

# Create superuser if it doesn't exist
python manage.py shell << PYTHON
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin')
    print('Superuser created')
PYTHON

# Start server
exec gunicorn cohort_backend.wsgi:application --bind 0.0.0.0:8000 --workers 4 --timeout 120
