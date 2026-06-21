FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libpangocairo-1.0-0 \
    libcairo2 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

COPY requirements/production.txt requirements/production.txt
COPY requirements/base.txt requirements/base.txt
RUN pip install --no-cache-dir -r requirements/production.txt

COPY . .

# Collect static files at build time with placeholder secrets (no DB connection needed)
RUN SECRET_KEY=build-placeholder \
    DB_PASSWORD=build-placeholder \
    DB_HOST=build-placeholder \
    DJANGO_SETTINGS_MODULE=synergy.settings_production \
    python manage.py collectstatic --noinput

EXPOSE 8080

CMD ["sh", "-c", "gunicorn synergy.wsgi:application --bind 0.0.0.0:${PORT:-8080} --workers 2 --threads 2 --timeout 120 --access-logfile -"]
