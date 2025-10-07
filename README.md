# Monitorillo

Fast, simple infrastructure monitoring for VPS servers and web services.

## Features

### Infrastructure Monitoring
- **Real-time Metrics**: Track CPU, RAM, Disk, Network, and Docker container metrics
- **Smart Alerts**: Email and Slack notifications with sustained breach detection
- **Lightweight Daemon**: Go-based collector with minimal resource usage

### Service Monitoring (NEW!)
- **HTTP Health Checks**: Monitor API endpoints and web services
- **JSON Validation**: Verify response structure and values
- **Version Tracking**: Automatic deployment detection and history
- **Service Status**: Real-time health status (healthy/degraded/unhealthy)

### Team Management
- **Multi-tenant Architecture**: Isolated teams with RBAC
- **Email Invitations**: Secure 48-hour invitation system
- **Role-based Access**: Owner, Admin, Member, Viewer roles
- **Team Collaboration**: Share monitoring across your organization

### User Experience
- **Live Dashboard**: React-based UI with real-time updates
- **Mobile Responsive**: Works on all devices
- **Dark Mode Ready**: Modern UI with shadcn/ui components

## Architecture

- **Daemon** (Go): Collects system metrics every 30s from monitored servers
- **API** (FastAPI): RESTful API with WebSocket support
- **Worker** (Python): Background job processor for health checks and version detection
- **Dashboard** (React + Vite): Modern SPA with TypeScript
- **Database** (PostgreSQL): Persistent storage with time-series optimization
- **Cache** (Redis): Session management and real-time data

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Python 3.13+ with uv
- Node.js 18+
- Go 1.21+ (for daemon - optional)

### 1. Start Infrastructure

```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis
```

### 2. Backend Setup

```bash
cd backend

# Copy and configure environment
cp .env.example .env
# Edit .env - set DATABASE_URL, RESEND_API_KEY, etc.

# Install dependencies and run migrations
uv sync
uv run alembic upgrade head

# Start API server
uv run uvicorn app.main:app --reload

# In another terminal, start the worker (for health checks)
uv run python app/worker.py
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### 4. Access the Application

- **Frontend**: http://localhost:5173
- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### 5. Daemon Installation (Optional)

For monitoring servers, install the daemon on each target server:

```bash
cd daemon
make build
sudo ./install.sh
```

## Project Structure

```
monitorillo/
├── backend/          # FastAPI backend + worker
├── frontend/         # React + TypeScript dashboard
├── daemon/           # Go metrics collector
├── docs/             # Documentation
└── docker-compose.yml
```

See individual README files in each directory for detailed information.

## Environment Variables

Required environment variables (see `backend/.env.example`):

- `DATABASE_URL`: PostgreSQL connection string
- `RESEND_API_KEY`: For sending invitation emails
- `SECRET_KEY`: JWT signing key
- `FRONTEND_URL`: Frontend URL for email links

## Development

See README files in subdirectories:
- [Backend Development](backend/README.md)
- [Frontend Development](frontend/README.md)
- [Daemon Development](daemon/README.md)

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for production deployment guides.

## License

MIT
