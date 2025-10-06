# Monitorillo

Fast, simple infrastructure monitoring for Hetzner VPS servers running Docker.

## Features

- **Real-time Monitoring**: Track CPU, RAM, Disk, Network, and Docker container metrics
- **Smart Alerts**: Email and Slack notifications with sustained breach detection
- **Team Collaboration**: Multi-tenant with role-based access control
- **Live Dashboard**: React-based UI with real-time WebSocket updates
- **Lightweight Daemon**: Go-based collector with minimal resource usage

## Architecture

- **Daemon** (Go): Collects system metrics every 30s
- **API** (FastAPI): Stores metrics, evaluates alerts, manages WebSocket connections
- **Dashboard** (React + Vite): Real-time visualization with shadcn/ui
- **Database** (PostgreSQL): Metric storage and querying
- **Cache** (Redis): Session management and real-time data

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Python 3.11+ with uv
- Node.js 18+
- Go 1.21+ (for daemon)

### Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your configuration
docker-compose up -d  # Start PostgreSQL and Redis
uv venv && source .venv/bin/activate
uv pip install -e .
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Daemon Installation

```bash
cd daemon
make build
sudo ./install.sh
```

## Development

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for detailed development phases.

## License

MIT
