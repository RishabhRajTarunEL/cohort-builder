#!/bin/bash
set -e

echo "Starting Celery worker..."
celery -A cohort_backend worker --loglevel=info --concurrency=2
