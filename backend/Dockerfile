FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    build-essential \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install uv

# Copy application code
COPY . .

# Install dependencies
RUN uv pip install --system -e .

# Collect static files
RUN python manage.py collectstatic --noinput

EXPOSE 8000

# Memory optimization:
# - --workers 1: Single worker to minimize memory (use threads for concurrency)
# - --threads 4: Use threads instead of processes for concurrency
# - --timeout 300: Increased for initial file loading (can take time)
# - --max-requests 200: Recycle worker to prevent memory leaks
# - --max-requests-jitter 20: Add jitter to recycling
# Note: With 1 worker, we avoid duplicating large data structures in memory
CMD ["gunicorn", "cohort_backend.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "1", "--threads", "4", "--timeout", "300", "--max-requests", "200", "--max-requests-jitter", "20"]
