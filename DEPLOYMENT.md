# Monitorillo Deployment Guide

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Python 3.11+ with `uv`
- Node.js 18+
- Go 1.21+ (for daemon)

### 1. Backend Deployment

```bash
cd backend

# Copy and configure environment
cp .env.example .env
# Edit .env with your production settings

# Start database
docker-compose up -d

# Install dependencies
uv venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
uv pip install -e .

# Run migrations
alembic upgrade head

# Start API server
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

For production, use gunicorn:
```bash
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### 2. Frontend Deployment

```bash
cd frontend

# Install dependencies
npm install

# Build for production
npm run build

# Serve with nginx or deploy to Vercel
```

**Vercel Deployment:**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Configure environment variables in Vercel:
- `VITE_API_URL`: Your backend API URL

### 3. Daemon Installation (on monitored servers)

```bash
cd daemon

# Build daemon
make build

# Or build for Linux from macOS
make build-linux

# Install (requires sudo)
sudo ./install.sh

# Configure
sudo nano /etc/monitorillo/config.yaml
```

**Configuration (`/etc/monitorillo/config.yaml`):**
```yaml
server_name: "production-server-01"

api:
  url: "https://your-api-domain.com"
  api_key: "your-server-api-key-from-dashboard"

interval: 30  # seconds
```

**Start the daemon:**
```bash
sudo systemctl start monitorillo
sudo systemctl enable monitorillo

# Check status
sudo systemctl status monitorillo

# View logs
sudo journalctl -u monitorillo -f
```

## Environment Variables

### Backend (.env)

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/monitorillo

# Redis
REDIS_URL=redis://localhost:6379/0

# Security
SECRET_KEY=generate-a-secure-random-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15

# CORS
CORS_ORIGINS=https://your-frontend-domain.com

# Notifications (optional)
RESEND_API_KEY=your-resend-key
SLACK_WEBHOOK_URL=your-slack-webhook
```

### Frontend (.env)

```bash
VITE_API_URL=https://your-api-domain.com
```

## Production Checklist

### Security
- [ ] Change all default secrets and API keys
- [ ] Enable HTTPS only
- [ ] Configure firewall rules
- [ ] Set up rate limiting
- [ ] Review CORS settings

### Database
- [ ] Set up automated backups
- [ ] Configure connection pooling
- [ ] Set retention policy for old metrics (90 days recommended)

### Monitoring
- [ ] Set up uptime monitoring for the API
- [ ] Configure log aggregation
- [ ] Set up error tracking (Sentry, etc.)

### Performance
- [ ] Add database indexes
- [ ] Configure Redis caching
- [ ] Set up CDN for frontend assets

## Troubleshooting

### Daemon not sending metrics

Check logs:
```bash
sudo journalctl -u monitorillo -n 50
```

Common issues:
- Incorrect API key
- Network connectivity
- Docker permission issues

### API not starting

Check database connection:
```bash
psql $DATABASE_URL -c "SELECT 1"
```

Check logs:
```bash
# In development
uvicorn app.main:app --reload

# In production
sudo journalctl -u monitorillo-api -f
```

## Scaling

### Multiple API Instances

Use a load balancer (nginx, HAProxy) in front of multiple API instances:

```nginx
upstream monitorillo_api {
    server api1:8000;
    server api2:8000;
    server api3:8000;
}

server {
    listen 80;
    server_name api.monitorillo.com;

    location / {
        proxy_pass http://monitorillo_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Database Optimization

For 100+ servers, consider:
- Setting up read replicas
- Partitioning the metrics table by date
- Using TimescaleDB for time-series data

## Support

For issues and questions:
- GitHub Issues: https://github.com/yourusername/monitorillo/issues
- Documentation: See project README.md
