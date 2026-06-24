#!/usr/bin/env sh
# Release tasks run by the Cloud Run "migrate-job" before each deploy.
# Migrations must succeed; data seeding is best-effort so a seed hiccup never
# blocks a deploy once the schema is up to date.
set -e

echo "==> Applying database migrations"
python manage.py migrate --noinput

echo "==> Enriching territories with geo + film-board data"
python manage.py seed_geo_gov || echo "  (seed_geo_gov skipped)"

echo "==> Release tasks complete"
