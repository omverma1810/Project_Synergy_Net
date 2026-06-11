# Synergy Net — Deployment Guide

## Architecture

- **Backend:** Django 5 on GCP Cloud Run (containerized, scales to zero)
- **Database:** Supabase PostgreSQL (connection pooler, port 6543)
- **Frontend:** Next.js 14 (deploy separately to Vercel or Cloud Run)
- **Storage:** GCP Artifact Registry (Docker images, keep latest 5)
- **CI/CD:** GitHub Actions (`.github/workflows/deploy.yml`)

---

## Prerequisites

1. GCP Project with billing enabled
2. Supabase project (free tier works)
3. GitHub repository secrets configured

---

## Step 1 — GCP Setup

### 1.1 Enable APIs
```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com
```

### 1.2 Create Artifact Registry repository
```bash
gcloud artifacts repositories create synergy-net \
  --repository-format=docker \
  --location=us-central1 \
  --description="Synergy Net Docker images"
```

### 1.3 Create Service Account for GitHub Actions
```bash
SA_EMAIL="synergy-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com"

gcloud iam service-accounts create synergy-deployer \
  --display-name="Synergy Net GitHub Actions Deployer"

# Grant required roles
for ROLE in \
  roles/run.admin \
  roles/artifactregistry.writer \
  roles/secretmanager.secretAccessor \
  roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="${ROLE}"
done

# Export key for GitHub secret
gcloud iam service-accounts keys create sa-key.json \
  --iam-account="${SA_EMAIL}"
```

---

## Step 2 — Supabase Setup

1. Go to https://supabase.com → create project
2. Settings → Database → Connection string → **Connection Pooling** tab
3. Copy the connection string — it looks like:
   ```
   postgresql://postgres.XXXX:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```
4. Note these values:
   - `DB_HOST`: `aws-0-us-east-1.pooler.supabase.com`
   - `DB_PORT`: `6543`
   - `DB_NAME`: `postgres`
   - `DB_USER`: `postgres.XXXX`
   - `DB_PASSWORD`: your Supabase password

---

## Step 3 — GCP Secret Manager

Store all secrets in Secret Manager (never in env vars or code):

```bash
# Django secret key (generate a secure one)
python -c "import secrets; print(secrets.token_urlsafe(50))" | \
  gcloud secrets create django-secret-key --data-file=-

# Database credentials
echo -n "YOUR_SUPABASE_PASSWORD" | gcloud secrets create db-password --data-file=-
echo -n "aws-0-us-east-1.pooler.supabase.com" | gcloud secrets create db-host --data-file=-
echo -n "postgres" | gcloud secrets create db-name --data-file=-
echo -n "postgres.XXXX" | gcloud secrets create db-user --data-file=-
```

---

## Step 4 — GitHub Repository Secrets

In your GitHub repo → Settings → Secrets and Variables → Actions, add:

| Secret | Value |
|--------|-------|
| `GCP_PROJECT_ID` | Your GCP project ID (e.g., `my-project-123`) |
| `GCP_SA_KEY` | Contents of `sa-key.json` (the service account key JSON) |

---

## Step 5 — First Deployment

Push to `master` branch — GitHub Actions will automatically:
1. Build Docker image from `apps/api/Dockerfile`
2. Push to Artifact Registry
3. Delete old images (keeps latest 5)
4. Run `python manage.py migrate --noinput` via Cloud Run Job
5. Deploy the service to Cloud Run

### Manual trigger:
```bash
git push origin master
```

Or trigger manually in GitHub → Actions → "Build & Deploy to Cloud Run" → "Run workflow"

---

## Step 6 — Frontend Deployment (Next.js)

### Option A: Vercel (recommended)
```bash
cd apps/web
npx vercel --prod
# Set NEXT_PUBLIC_API_URL to your Cloud Run URL
```

### Option B: Cloud Run
```bash
docker build -t gcr.io/PROJECT_ID/synergy-web apps/web/
docker push gcr.io/PROJECT_ID/synergy-web
gcloud run deploy synergy-web --image gcr.io/PROJECT_ID/synergy-web --allow-unauthenticated
```

---

## Environment Variables Reference

### Required in Cloud Run (via Secret Manager)
| Secret | Description |
|--------|-------------|
| `django-secret-key` | Django SECRET_KEY — must be 50+ random chars |
| `db-password` | Supabase database password |
| `db-host` | Supabase connection pooler hostname |
| `db-name` | Database name (usually `postgres`) |
| `db-user` | Database user (e.g., `postgres.XXXX`) |

### Optional Cloud Run environment variables
| Variable | Default | Description |
|----------|---------|-------------|
| `CELERY_TASK_ALWAYS_EAGER` | `True` | Run tasks inline (no Redis needed) |
| `CORS_ALLOWED_ORIGINS` | — | Comma-separated allowed origins |
| `ALLOWED_HOSTS` | `*.run.app` | Comma-separated allowed hostnames |
| `DB_PORT` | `6543` | Supabase pooler port |

---

## Seeding Production Data

After first deployment, seed territories:
```bash
gcloud run jobs create seed-job \
  --image=IMAGE_TAG \
  --region=us-central1 \
  --set-env-vars="DJANGO_SETTINGS_MODULE=synergy.settings_production" \
  --set-secrets="SECRET_KEY=django-secret-key:latest,DB_PASSWORD=db-password:latest,DB_HOST=db-host:latest,DB_NAME=db-name:latest,DB_USER=db-user:latest" \
  --command="python,manage.py,seed_demo"

gcloud run jobs execute seed-job --region=us-central1 --wait
```

---

## Monitoring & Logs

```bash
# View logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=synergy-api" --limit=50

# Stream logs
gcloud run services logs tail synergy-api --region=us-central1
```
