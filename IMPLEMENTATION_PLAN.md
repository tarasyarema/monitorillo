# Monitorillo - Infrastructure Monitoring System

## Executive Summary

**Goal**: Build a fast, simple infrastructure monitoring system for Hetzner VPS servers running Docker.

**Core Components**:
1. **Go Daemon** - Collects system/Docker metrics every 30s
2. **Python API (FastAPI)** - Receives metrics, evaluates alerts, sends notifications
3. **React Dashboard** - Real-time visualization with WebSockets

**Tech Stack**: Go (daemon), Python 3.11+ (FastAPI), React 18 (Vite + shadcn/ui), PostgreSQL, Redis

---

## Architecture Overview

```
┌─────────────┐              ┌─────────────┐              ┌─────────────┐
│   Daemon    │─────POST────▶│  FastAPI    │◀────WSS────│   React     │
│   (Go)      │              │   API       │             │  Dashboard  │
│             │              │             │             │             │
│ • gopsutil  │              │ • SQLAlchemy│             │ • shadcn/ui │
│ • docker    │              │ • WebSocket │             │ • Recharts  │
│   client    │              │ • Alerts    │             │ • WS client │
└─────────────┘              └──────┬──────┘             └─────────────┘
                                    │
                          ┌─────────┴─────────┐
                          │                   │
                      ┌───▼────┐       ┌─────▼──────┐
                      │Postgre │       │   Redis    │
                      │  SQL   │       │  (cache)   │
                      └────────┘       └────────────┘
                                             │
                                      ┌──────┴──────┐
                                      │             │
                                 ┌────▼───┐   ┌────▼────┐
                                 │ Resend │   │  Slack  │
                                 │(email) │   │(webhook)│
                                 └────────┘   └─────────┘
```

**Data Flow**:
1. Daemon collects metrics → POST to API every 30s
2. API stores in PostgreSQL → evaluates alert rules → triggers notifications
3. API broadcasts updates via WebSocket → Dashboard updates in real-time
4. Users authenticate → view team servers → acknowledge alerts

---

## Database Schema (Key Tables)

```sql
-- Core tables
users (id, email, hashed_password, full_name)
teams (id, name, slug)
team_members (user_id, team_id, role)  -- 'owner', 'admin', 'member', 'viewer'

-- Monitoring
servers (id, team_id, name, hostname, status, last_seen_at, tags)
metrics (id, server_id, metric_type, value JSONB, timestamp)
docker_containers (id, server_id, container_id, name, status)

-- Alerts
alerts (id, team_id, server_id, metric_type, severity, state, threshold_value, current_value)
alert_configs (id, team_id, server_id, metric_type, warning_threshold, critical_threshold)
notifications (id, alert_id, channel, recipient, status)

-- Indexes
idx_metrics_server_timestamp ON metrics(server_id, timestamp DESC)
idx_alerts_team_state ON alerts(team_id, state)
```

---

## Implementation Phases

### Phase 1: Setup (1 day)

**Monorepo Structure**:
```
monitorillo/
├── backend/       # FastAPI
├── frontend/      # React + Vite
├── daemon/        # Go daemon
└── docs/
```

**Tasks**:
- [ ] Create project structure
- [ ] Setup PostgreSQL + Redis (Docker Compose)
- [ ] Initialize migrations with Alembic
- [ ] Configure environment files
- [ ] Setup git repository

---

### Phase 2: Auth & Teams (2 days)

**Backend (FastAPI)**:
- [ ] Install FastAPI-Users + JWT
- [ ] Create User, Team, TeamMember models
- [ ] Implement RBAC with dependency injection
- [ ] Add permission checking (owner/admin/member/viewer roles)
- [ ] Create auth endpoints (`/auth/login`, `/auth/register`, `/auth/logout`)
- [ ] Create team endpoints (`POST /teams`, `GET /teams/{id}`, `POST /teams/{id}/members`)

**Testing**:
- [ ] Can register user
- [ ] Can login and receive JWT token
- [ ] Can create team and add members
- [ ] Permission checks block unauthorized access

---

### Phase 3: Monitoring Daemon (3 days)

**Go Project**:
```go
// Key libraries
github.com/shirou/gopsutil/v4  // System metrics
github.com/docker/docker/client  // Docker API
gopkg.in/yaml.v3  // Config
```

**Implementation**:
- [ ] Config loader (`/etc/monitorillo/config.yaml`)
- [ ] System metrics collector (CPU, RAM, Disk, Network using gopsutil)
- [ ] Docker metrics collector (containers, stats)
- [ ] HTTP client to POST metrics to API
- [ ] Main loop with 30s ticker
- [ ] Systemd service file
- [ ] Installation script (`install.sh`)

**Files**:
- `daemon/internal/collector/system.go` - gopsutil collectors
- `daemon/internal/collector/docker.go` - Docker stats
- `daemon/internal/reporter/client.go` - API client
- `daemon/cmd/daemon/main.go` - Main loop

**Testing**:
- [ ] Compiles without errors
- [ ] Collects CPU/RAM/Disk/Network metrics
- [ ] Collects Docker container stats
- [ ] Posts metrics to API successfully
- [ ] Systemd service auto-restarts

---

### Phase 4: API Metrics Ingestion (2 days)

**Backend**:
- [ ] Create Server and Metric models
- [ ] Add `POST /api/v1/metrics` endpoint (receives daemon data)
- [ ] Store metrics in PostgreSQL with team isolation
- [ ] Update server `last_seen_at` and `status`
- [ ] Add `GET /api/v1/servers` and `GET /api/v1/metrics/{server_id}`
- [ ] Implement WebSocket endpoint (`/ws`)
- [ ] Broadcast metric updates via WebSocket

**Schema**:
```python
# Metric payload from daemon
{
  "server_name": "prod-01",
  "timestamp": "2025-10-05T10:30:00Z",
  "system": {
    "cpu": {"usage_percent": 45.2, "per_core": [...]},
    "memory": {"used_percent": 62.1, "total": 8GB},
    "disk": {"/": {"used_percent": 48.3}},
    "network": {"bytes_sent": 12345, "bytes_recv": 67890}
  },
  "docker": {
    "containers": [
      {"id": "abc123", "name": "nginx", "cpu_percent": 2.1, "memory_usage": 128MB}
    ]
  }
}
```

**Testing**:
- [ ] Daemon posts metrics successfully
- [ ] Metrics stored in database
- [ ] WebSocket clients receive updates
- [ ] Can query metrics via API

---

### Phase 5: Alerts & Notifications (2 days)

**Alert Evaluation**:
- [ ] Create Alert and AlertConfig models
- [ ] Implement `AlertEvaluator` service (checks thresholds)
- [ ] Evaluate on each metric ingestion
- [ ] Sustained breach detection (15min window, 3+ consecutive breaches)
- [ ] Auto-resolution when metrics normalize
- [ ] Alert state management (new → acknowledged → resolved)

**Notifications**:
- [ ] Resend email integration (HTML templates)
- [ ] Slack webhook integration (rich messages with blocks)
- [ ] Notification log tracking
- [ ] Alert API endpoints (`GET /alerts`, `POST /alerts/{id}/acknowledge`)

**Default Thresholds**:
- CPU: Warning 80%, Critical 90%
- Memory: Warning 70%, Critical 85%
- Disk: Warning 75%, Critical 90%

**Testing**:
- [ ] Alert triggers when CPU > 90% for 15min
- [ ] Email sent via Resend
- [ ] Slack message posted
- [ ] Can acknowledge alert
- [ ] Alert auto-resolves when metric drops

---

### Phase 6: React Dashboard (4 days)

**Setup**:
- [ ] Vite + React + TypeScript
- [ ] Install shadcn/ui components
- [ ] Setup Tailwind CSS
- [ ] Configure React Router

**Components**:
- [ ] AuthContext (login/logout/register)
- [ ] ProtectedRoute wrapper
- [ ] API client with Axios (token refresh interceptor)
- [ ] WebSocket hook (react-use-websocket)

**Pages**:
- [ ] Login/Register pages
- [ ] Dashboard (server grid, stats cards, active alerts)
- [ ] Server Detail page (CPU/RAM/Disk charts with Recharts, Docker containers list)
- [ ] Alerts page (list, acknowledge, filter)
- [ ] Team Settings (members, invite, alert configs)

**UI Patterns**:
- Card-based layout for servers
- Status badges (green/yellow/red/gray)
- Real-time metric updates
- Sparklines for quick trends
- Full charts on detail pages

**Testing**:
- [ ] Can login and see dashboard
- [ ] Server cards display correctly
- [ ] Real-time updates work
- [ ] Charts render metrics
- [ ] Mobile responsive

---

### Phase 7: Deployment (1 day)

**Backend (Docker)**:
- [ ] Create Dockerfile
- [ ] Docker Compose with PostgreSQL + Redis
- [ ] Environment variable configuration
- [ ] Deploy to VPS or cloud

**Frontend (Vercel)**:
- [ ] Push to GitHub
- [ ] Configure Vercel project
- [ ] Set environment variables (`VITE_API_URL`, `VITE_WS_URL`)
- [ ] Deploy with custom domain

**Daemon**:
- [ ] Build release binaries (`make release`)
- [ ] Create installation documentation
- [ ] Test installation on fresh server

**Documentation**:
- [ ] README.md with project overview
- [ ] DEPLOYMENT.md with deployment steps
- [ ] DAEMON_INSTALL.md with daemon installation

**Testing**:
- [ ] Production API accessible via HTTPS
- [ ] Frontend deployed on Vercel
- [ ] Daemon connects to production API
- [ ] End-to-end flow works

---

## Key Missing Features (Discussed in Research)

Based on comprehensive research, here are critical additions not explicitly mentioned:

### 1. **Caddy Configuration Monitoring**
- Daemon should read `/etc/caddy/Caddyfile` or use Caddy Admin API
- Display reverse proxy mappings (domain → upstream service)
- Security: Sanitize sensitive upstream URLs

### 2. **Open Ports Detection**
- Use `gopsutil/net` to list listening ports
- Store in database for visualization
- Show which process owns each port

### 3. **Network Metrics Enhancement**
- Track bandwidth usage (MB/s in/out)
- Network interface details
- Connection counts

### 4. **Docker-Specific Enhancements**
- Container restart counts (indicates instability)
- Container logs (last 100 lines accessible from UI)
- Health check status
- Volume usage

### 5. **Alert Fatigue Prevention**
- Alert grouping (don't send 10 emails for same issue)
- Snooze/mute functionality
- Alert digest mode (hourly summary for warnings)
- Time-based routing (warnings only during business hours)

### 6. **Dashboard Performance**
- Data decimation for charts (max 1000 points)
- Batched WebSocket updates (every 2-3s, not per metric)
- Virtual scrolling for 50+ servers

### 7. **Security Hardening**
- Rate limiting on login (5 attempts/min)
- CSRF protection
- API key authentication for daemons (not user JWT)
- Content Security Policy headers

### 8. **Team Invitations**
- Email invitation system
- Invitation tokens with expiry
- New users can accept invite and register

---

## Testing Strategy

### Unit Tests
- **Backend**: `pytest` for API, services, models
- **Frontend**: Vitest for components
- **Daemon**: `go test` for collectors

### Integration Tests
- End-to-end metric flow (daemon → API → DB → dashboard)
- Alert evaluation + notification delivery
- WebSocket real-time updates

### Manual Testing Checklist
- [ ] Install daemon on test server
- [ ] Verify metrics in dashboard within 30s
- [ ] Trigger CPU alert (stress test)
- [ ] Confirm email + Slack notification
- [ ] Acknowledge alert via UI
- [ ] Add team member
- [ ] Verify team isolation
- [ ] Test mobile responsive design
- [ ] Simulate daemon offline

---

## Performance Targets

- **Metric Collection**: Every 30 seconds per server
- **Dashboard Latency**: <1 second for metric updates
- **Alert Trigger Time**: <1 minute from threshold breach
- **API Response Time**: <200ms for dashboard endpoints
- **Concurrent Servers**: Support 100+ servers per instance
- **Data Retention**: 90 days of metrics

---

## Security Checklist

- [ ] HTTPS only in production
- [ ] httpOnly, Secure, SameSite=Strict cookies
- [ ] Argon2id password hashing
- [ ] JWT with 15min expiry + refresh tokens
- [ ] CSRF protection on state-changing endpoints
- [ ] Rate limiting on auth endpoints
- [ ] Input validation with Pydantic
- [ ] SQL injection prevention (SQLAlchemy ORM)
- [ ] XSS protection (React escaping + CSP)
- [ ] Environment variables for secrets
- [ ] Daemon API keys (unique per server)
- [ ] Team-based data isolation

---

## Future Enhancements (Post-MVP)

- Historical trends and anomaly detection
- Custom dashboards (drag-drop widgets)
- Slack bot for interactive alerts
- Multi-factor authentication (MFA)
- SSO integration (Google, GitHub)
- Cost tracking for Hetzner
- Capacity planning recommendations
- Mobile app (React Native)
- Custom metrics via daemon plugins
- Webhook integrations

---

## Timeline Estimate

- Phase 1 (Setup): 1 day
- Phase 2 (Auth): 2 days
- Phase 3 (Daemon): 3 days
- Phase 4 (Metrics API): 2 days
- Phase 5 (Alerts): 2 days
- Phase 6 (Dashboard): 4 days
- Phase 7 (Deployment): 1 day

**Total: ~15 days for MVP**

---

## Success Criteria

### MVP Complete When:
- [ ] Daemon collects CPU, RAM, Disk, Network, Docker metrics
- [ ] Dashboard displays all servers with real-time updates
- [ ] Alerts trigger and send email + Slack notifications
- [ ] Can create teams and invite members
- [ ] Team members can only see their team's servers
- [ ] Mobile-responsive UI works on phone
- [ ] Can deploy: API (Docker), UI (Vercel), Daemon (systemd)
- [ ] Documentation complete for installation and deployment

### Production Ready When:
- [ ] 100+ servers monitored without performance issues
- [ ] Uptime > 99.9%
- [ ] All security hardening complete
- [ ] Backup and disaster recovery plan
- [ ] Monitoring for the monitoring system (meta!)

---

## References

**Research Sources**:
- Daemon: gopsutil docs, Go Docker client, systemd best practices
- Alerts: Datadog/Grafana alert patterns, threshold recommendations
- UI/UX: shadcn/ui, Recharts, dashboard design patterns
- Auth: FastAPI-Users, JWT best practices, PostgreSQL multi-tenancy
- Performance: WebSocket scaling, chart optimization, data decimation

**Key Libraries**:
- Backend: FastAPI, FastAPI-Users, SQLAlchemy, python-jose, argon2-cffi
- Frontend: React, shadcn/ui, Recharts, react-use-websocket, Axios
- Daemon: gopsutil/v4, docker/docker/client, gorilla/websocket

---

## Getting Started

1. **Clone repo**: `git clone https://github.com/yourusername/monitorillo.git`
2. **Backend**: `cd backend && docker-compose up -d`
3. **Frontend**: `cd frontend && npm install && npm run dev`
4. **Daemon**: `cd daemon && make build && sudo ./install.sh`
5. **Verify**: Access dashboard at `http://localhost:5173`

---

**Questions or Issues?** Refer to `docs/` directory or create a GitHub issue.
