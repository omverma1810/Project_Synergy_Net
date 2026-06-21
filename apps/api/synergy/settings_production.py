"""
Production settings for Synergy Net on GCP Cloud Run + Supabase.
Set DJANGO_SETTINGS_MODULE=synergy.settings_production
"""
from .settings import *  # noqa: F401, F403
import os
import logging
from decouple import config

DEBUG = False

SECRET_KEY = config('SECRET_KEY')  # must be set in environment / Secret Manager

ALLOWED_HOSTS = config(
    'ALLOWED_HOSTS',
    default='*.run.app,synergy-medialabs.com',
    cast=lambda v: [s.strip() for s in v.split(',')],
)

# Supabase PostgreSQL via connection pooler (port 6543, sslmode=require)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME', default='postgres'),
        'USER': config('DB_USER', default='postgres'),
        'PASSWORD': config('DB_PASSWORD'),
        'HOST': config('DB_HOST'),
        'PORT': config('DB_PORT', default='6543'),
        'OPTIONS': {'sslmode': 'require'},
        'CONN_MAX_AGE': 60,
    }
}

# Cloud Run terminates TLS and forwards plain HTTP internally.
# This header tells Django the original request was HTTPS so it won't redirect.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True

# Security headers
SECURE_SSL_REDIRECT = False  # Cloud Run handles SSL — don't double-redirect
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = 'DENY'

# WhiteNoise for static files
MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')  # noqa: F405
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Cloud Run port
PORT = int(os.environ.get('PORT', 8080))

# Celery: synchronous in production (no Redis on Cloud Run)
CELERY_TASK_ALWAYS_EAGER = config('CELERY_TASK_ALWAYS_EAGER', default=True, cast=bool)

# CORS for frontend
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='https://synergy-medialabs.com',
    cast=lambda v: [s.strip() for s in v.split(',')],
)

# Structured JSON logging for Cloud Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'json': {
            '()': 'pythonjsonlogger.jsonlogger.JsonFormatter',
            'format': '%(asctime)s %(name)s %(levelname)s %(message)s',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'json',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {'handlers': ['console'], 'level': 'WARNING', 'propagate': False},
        'django.request': {'handlers': ['console'], 'level': 'ERROR', 'propagate': False},
    },
}
