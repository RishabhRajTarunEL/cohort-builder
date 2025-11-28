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

CMD ["gunicorn", "cohort_backend.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "4"]
