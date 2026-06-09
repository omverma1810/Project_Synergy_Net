.PHONY: dev migrate lint test seed stop build logs shell-backend shell-frontend

# Start all services in development mode
dev:
	docker-compose up

# Start services in detached mode
dev-d:
	docker-compose up -d

# Stop all services
stop:
	docker-compose down

# Build all Docker images
build:
	docker-compose build

# Run Django database migrations
migrate:
	docker-compose exec backend python manage.py migrate

# Create new Django migrations
makemigrations:
	docker-compose exec backend python manage.py makemigrations

# Run all linters (ESLint + Ruff)
lint:
	docker-compose exec frontend pnpm lint
	docker-compose exec backend ruff check .

# Auto-fix lint issues
lint-fix:
	docker-compose exec frontend pnpm lint --fix
	docker-compose exec backend ruff check --fix .

# Run all tests (pytest + jest)
test:
	docker-compose exec backend pytest
	docker-compose exec frontend pnpm test

# Load demo/seed data
seed:
	docker-compose exec backend python manage.py loaddata fixtures/demo.json

# View logs for all services
logs:
	docker-compose logs -f

# Open a shell in the backend container
shell-backend:
	docker-compose exec backend bash

# Open a shell in the frontend container
shell-frontend:
	docker-compose exec frontend sh

# Open Django shell
django-shell:
	docker-compose exec backend python manage.py shell
