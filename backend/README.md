# Monitorillo Backend

FastAPI-based backend for Monitorillo infrastructure and service monitoring platform.

## Features

- **RESTful API**: Full-featured API with automatic OpenAPI documentation
- **WebSocket Support**: Real-time metrics streaming
- **Background Worker**: Automated health checks and version detection
- **Multi-tenant**: Team-based isolation with RBAC
- **Authentication**: JWT-based auth with refresh tokens
- **Email Integration**: Resend API for team invitations
- **Time-series Storage**: Optimized PostgreSQL schema for metrics

## Tech Stack

- **FastAPI**: Modern async web framework
- **SQLAlchemy 2.0**: Async ORM with type hints
- **Alembic**: Database migrations
- **PostgreSQL**: Primary database
- **Redis**: Session storage and caching
- **Pydantic**: Data validation
- **httpx**: Async HTTP client for health checks
- **jsonpath-ng**: JSON path parsing

## Project Structure

```
backend/
├── app/
│   ├── api/              # API endpoints
│   │   ├── alerts.py
│   │   ├── deployments.py
│   │   ├── health_checks.py
│   │   ├── invitations.py
│   │   ├── metrics.py
│   │   ├── servers.py
│   │   ├── services.py
│   │   └── teams.py
│   ├── core/             # Core configuration
│   │   ├── auth.py       # Authentication
│   │   ├── config.py     # Settings
│   │   ├── database.py   # Database connection
│   │   ├── rbac.py       # Role-based access control
│   │   └── users.py      # User management
│   ├── models/           # SQLAlchemy models
│   │   ├── alert.py
│   │   ├── invitation.py
│   │   ├── metric.py
│   │   ├── server.py
│   │   ├── service.py
│   │   ├── team.py
│   │   └── user.py
│   ├── schemas/          # Pydantic schemas
│   │   ├── alert.py
│   │   ├── invitation.py
│   │   ├── metric.py
│   │   ├── server.py
│   │   ├── service.py
│   │   └── team.py
│   ├── services/         # Business logic
│   │   ├── email_service.py
│   │   ├── health_checker.py
│   │   └── version_checker.py
│   ├── main.py           # FastAPI application
│   └── worker.py         # Background worker
├── alembic/              # Database migrations
│   └── versions/
├── tests/                # Test suite
├── pyproject.toml        # Dependencies
└── Dockerfile
```

## Setup

### 1. Install Dependencies

```bash
# Install uv if not already installed
curl -LsSf https://astral.sh/uv/install.sh | sh

# Create virtual environment and install dependencies
uv sync
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database
DATABASE_URL=postgresql+asyncpg://monitorillo:password@localhost:5432/monitorillo

# Redis
REDIS_URL=redis://localhost:6379/0

# Authentication
SECRET_KEY=your-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30

# Email (Resend API)
RESEND_API_KEY=re_xxxxxxxxxxxxx
FRONTEND_URL=http://localhost:5173

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Daemon Authentication
DAEMON_API_KEY=your-daemon-api-key
```

### 3. Run Migrations

```bash
uv run alembic upgrade head
```

### 4. Start Services

#### Development Mode

```bash
# Terminal 1: Start API server
uv run uvicorn app.main:app --reload --port 8000

# Terminal 2: Start background worker
uv run python app/worker.py
```

#### Production Mode

```bash
# API server with multiple workers
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4

# Worker (run as systemd service)
uv run python app/worker.py
```

## API Documentation

Once the server is running, access:
- **Interactive API Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

## Database Migrations

### Create a new migration

```bash
uv run alembic revision --autogenerate -m "description of changes"
```

### Apply migrations

```bash
uv run alembic upgrade head
```

### Rollback migration

```bash
uv run alembic downgrade -1
```

### View migration history

```bash
uv run alembic history
```

## Background Worker

The worker handles:
- **Health Checks**: Executes HTTP health checks every minute
- **Version Detection**: Queries version endpoints and detects deployments
- **Status Updates**: Updates service status based on check results

The worker runs continuously in a loop with a 60-second interval.

### Worker Features

- Automatic retry on failures
- Error logging with details
- Graceful shutdown handling
- No external dependencies (runs with Python stdlib + httpx)

## Testing

```bash
# Run all tests
uv run pytest

# Run with coverage
uv run pytest --cov=app --cov-report=html

# Run specific test file
uv run pytest tests/test_api.py

# Run with verbose output
uv run pytest -v
```

## Code Quality

```bash
# Format code
uv run ruff format .

# Lint code
uv run ruff check .

# Type checking
uv run mypy app
```

## Docker

### Build image

```bash
docker build -t monitorillo-backend .
```

### Run container

```bash
docker run -p 8000:8000 \
  -e DATABASE_URL=postgresql+asyncpg://user:pass@host/db \
  -e REDIS_URL=redis://host:6379/0 \
  monitorillo-backend
```

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/jwt/login` - Login with email/password
- `POST /auth/jwt/logout` - Logout
- `GET /users/me` - Get current user

### Teams
- `GET /api/v1/teams` - List user's teams
- `POST /api/v1/teams` - Create team
- `GET /api/v1/teams/{id}` - Get team details
- `POST /api/v1/teams/{id}/members` - Add member
- `DELETE /api/v1/teams/{id}/members/{user_id}` - Remove member

### Invitations
- `POST /api/v1/teams/{id}/invitations` - Create invitation
- `GET /api/v1/teams/{id}/invitations` - List invitations
- `POST /api/v1/invitations/accept` - Accept invitation
- `DELETE /api/v1/invitations/{id}` - Revoke invitation

### Servers
- `GET /api/v1/servers` - List servers
- `POST /api/v1/servers` - Create server
- `GET /api/v1/servers/{id}` - Get server details
- `PATCH /api/v1/servers/{id}` - Update server
- `DELETE /api/v1/servers/{id}` - Delete server
- `POST /api/v1/servers/{id}/regenerate-key` - Regenerate API key

### Services
- `GET /api/v1/teams/{id}/services` - List services
- `POST /api/v1/teams/{id}/services` - Create service
- `GET /api/v1/services/{id}` - Get service details
- `PATCH /api/v1/services/{id}` - Update service
- `DELETE /api/v1/services/{id}` - Delete service

### Health Checks
- `POST /api/v1/services/{id}/health-checks` - Create health check
- `GET /api/v1/services/{id}/health-checks` - List health checks
- `PATCH /api/v1/health-checks/{id}` - Update health check
- `DELETE /api/v1/health-checks/{id}` - Delete health check
- `POST /api/v1/health-checks/{id}/execute` - Execute check manually
- `GET /api/v1/health-checks/{id}/results` - Get check results

### Deployments
- `GET /api/v1/services/{id}/deployments` - List deployments
- `PATCH /api/v1/deployments/{id}` - Update deployment notes

### Metrics
- `POST /api/v1/metrics` - Submit metrics (daemon only)
- `GET /api/v1/metrics/servers/{id}/latest` - Get latest metrics
- `GET /api/v1/metrics/servers/{id}/history` - Get metrics history

### Alerts
- `GET /api/v1/alerts` - List alerts
- `POST /api/v1/alerts/{id}/acknowledge` - Acknowledge alert
- `POST /api/v1/alerts/{id}/resolve` - Resolve alert
- `GET /api/v1/alerts/configs` - List alert configs
- `PATCH /api/v1/alert-configs/{id}` - Update alert config

## Environment-specific Configuration

### Development
```env
DEBUG=True
CORS_ORIGINS=http://localhost:5173
```

### Production
```env
DEBUG=False
CORS_ORIGINS=https://yourdomain.com
SECRET_KEY=generate-a-secure-random-key
```

## Troubleshooting

### Database connection errors
- Verify PostgreSQL is running: `docker ps`
- Check DATABASE_URL in .env
- Ensure migrations are applied: `uv run alembic upgrade head`

### Worker not executing checks
- Check worker is running: `ps aux | grep worker`
- Verify health checks are enabled in database
- Check logs for errors

### Email invitations not sending
- Verify RESEND_API_KEY is set correctly
- Check Resend dashboard for delivery status
- Ensure FRONTEND_URL is accessible

## Contributing

1. Create a feature branch
2. Make your changes
3. Add tests
4. Run tests and linting
5. Submit a pull request

## License

MIT
