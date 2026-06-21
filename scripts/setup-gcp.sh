#!/usr/bin/env bash
# One-time GCP bootstrap for Synergy Net.
# Run this from your local machine: bash scripts/setup-gcp.sh
set -euo pipefail

PROJECT_ID="synergy-500111"
REGION="asia-northeast1"
REPO="synergy-net"
SA_NAME="synergy-deployer"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
REGISTRY="${REGION}-docker.pkg.dev"

echo "==> Setting active project"
gcloud config set project "${PROJECT_ID}"

echo "==> Enabling required APIs"
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  cloudbuild.googleapis.com \
  --project="${PROJECT_ID}"

echo "==> Creating Artifact Registry repository"
gcloud artifacts repositories create "${REPO}" \
  --repository-format=docker \
  --location="${REGION}" \
  --description="Synergy Net Docker images" \
  --project="${PROJECT_ID}" 2>/dev/null || echo "  (already exists)"

echo "==> Creating service account for GitHub Actions"
gcloud iam service-accounts create "${SA_NAME}" \
  --display-name="Synergy Net GitHub Deployer" \
  --project="${PROJECT_ID}" 2>/dev/null || echo "  (already exists)"

echo "==> Granting IAM roles to service account"
for ROLE in \
  "roles/run.admin" \
  "roles/artifactregistry.writer" \
  "roles/secretmanager.secretAccessor" \
  "roles/iam.serviceAccountUser" \
  "roles/cloudbuild.builds.editor"; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="${ROLE}" \
    --quiet
done

echo "==> Creating service account key for GitHub Actions secret"
gcloud iam service-accounts keys create /tmp/synergy-sa-key.json \
  --iam-account="${SA_EMAIL}" \
  --project="${PROJECT_ID}"
echo ""
echo "  *** Copy the contents of /tmp/synergy-sa-key.json"
echo "  *** into GitHub Secret: GCP_SA_KEY"
echo ""

echo "==> Storing secrets in Secret Manager"

store_secret() {
  local NAME="$1"
  local VALUE="$2"
  echo -n "${VALUE}" | gcloud secrets create "${NAME}" \
    --data-file=- \
    --project="${PROJECT_ID}" 2>/dev/null \
  || echo -n "${VALUE}" | gcloud secrets versions add "${NAME}" \
    --data-file=- \
    --project="${PROJECT_ID}"
}

# Django secret key
store_secret "django-secret-key" "=aqh)xheiv7#d+^v+imd1kvp^1=or3x_omwflo_cq%miy^jdc-"

# Supabase credentials
store_secret "db-password" "Omverma@1810"
store_secret "db-host"     "aws-1-ap-northeast-1.pooler.supabase.com"
store_secret "db-user"     "postgres.xfbustplmacngxiflcnv"

# Runtime config (will be updated once Cloud Run URL is known)
store_secret "allowed-hosts" "*.run.app,project-synergy-net.vercel.app"
store_secret "cors-origins"  "https://project-synergy-net.vercel.app"

echo ""
echo "==> All done! Next steps:"
echo ""
echo "  1. Add these secrets to GitHub (repo → Settings → Secrets → Actions):"
echo "       GCP_SA_KEY    → contents of /tmp/synergy-sa-key.json"
echo "       VERCEL_TOKEN  → from vercel.com/account/tokens"
echo ""
echo "  2. Link Vercel project:"
echo "       cd apps/web && vercel link"
echo "       (creates .vercel/project.json needed by the deploy job)"
echo ""
echo "  3. Push to master — GitHub Actions will:"
echo "       • Build Docker image & push to Artifact Registry"
echo "       • Prune images older than the 5 most recent"
echo "       • Run Django migrations against Supabase"
echo "       • Deploy backend to Cloud Run (asia-northeast1)"
echo "       • Deploy frontend to Vercel"
echo ""
echo "  4. After first deploy, copy the Cloud Run URL printed in the workflow"
echo "     and set it in Vercel: Project Settings → Environment Variables:"
echo "       API_URL = https://<your-service>-<hash>-an.a.run.app"
echo "     Then redeploy Vercel (or push any commit to master)."
