from .settings import *  # noqa
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}
CELERY_TASK_ALWAYS_EAGER = True
import logging; logging.disable(logging.CRITICAL)
