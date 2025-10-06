.PHONY: help install dev-install sync freeze run migrate migrate-prod run-prod check format typecheck test clean docker-build

help:
	@echo "Available commands:"
	@echo "  make install          - Install production dependencies"
	@echo "  make dev-install      - Install all dependencies including dev"
	@echo "  make sync             - Sync dependencies with lockfile"
	@echo "  make freeze           - Freeze dependencies to requirements.txt"
	@echo "  make run              - Run the application in dev mode"
	@echo "  make migrate          - Run database migrations"
	@echo "  make migrate-prod     - Run database migrations (production)"
	@echo "  make run-prod         - Run API in production with gunicorn"
	@echo "  make check            - Run linting checks and fixes"
	@echo "  make format           - Format code"
	@echo "  make typecheck        - Run type checking"
	@echo "  make test             - Run tests"
	@echo "  make clean            - Remove generated files"
	@echo "  make docker-build     - Build Docker image for deployment"

install:
	uv sync --locked --active

dev-install:
	uv sync --locked --active --all-extras

sync:
	uv sync --locked --active --all-extras

freeze:
	uv pip freeze > requirements.txt

run:
	uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

migrate:
	uv run alembic upgrade head

migrate-prod:
	alembic upgrade head

run-prod: migrate-prod
	gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

check:
	uv run ruff check --fix --preview

format: check
	uv run ruff format --preview

typecheck:
	uv run mypy .

test:
	uv run pytest tests/

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true

docker-build:
	docker build -t monitorillo-backend:latest .
