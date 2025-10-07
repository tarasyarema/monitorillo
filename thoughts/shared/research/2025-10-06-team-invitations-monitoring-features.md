---
date: 2025-10-06T16:33:47Z
researcher: 2pac
git_commit: ed6d05d8ca6299a9b15569520b06df81ce482b5d
branch: main
repository: monitorillo
topic: "Implementing Team Invitations, URL/API Monitoring, and Service Version Tracking"
tags: [research, codebase, team-management, monitoring, healthchecks, services, deployments, resend, email]
status: complete
last_updated: 2025-10-06
last_updated_by: 2pac
---

# Research: Implementing Team Invitations, URL/API Monitoring, and Service Version Tracking

**Date**: 2025-10-06T16:33:47Z
**Researcher**: 2pac
**Git Commit**: ed6d05d8ca6299a9b15569520b06df81ce482b5d
**Branch**: main
**Repository**: monitorillo

## Research Question

Research the current state of the codebase to understand what exists and what needs to be implemented for three new features:

1. **Team Invitations**: Ability to edit teams and invite people via email (using Resend API)
2. **URL/API Monitoring**: Simple health checks for URLs with configurable HTTP method, headers, expected status code, and optional JSON path validation
3. **Service Version Tracking**: Monitor versions of deployed services by querying endpoints and extracting version from JSON response

Additionally, understand how to model "services" as a core concept with attached healthchecks, version tracking (deployments), and alerts.

## Summary

The codebase currently has a **server infrastructure monitoring system** focused on system metrics (CPU, memory, disk) and Docker container monitoring. It has a solid foundation with:

- **Team management** with role-based access control (OWNER, ADMIN, MEMBER, VIEWER)
- **Alert system** with threshold-based monitoring and notification tracking
- **Resend email integration** configured but not yet implemented
- **RESTful API architecture** using FastAPI with JWT authentication
- **Database schema** for teams, servers, metrics, and alerts

**What's Missing for the New Features**:
- No user invitation system or email sending implementation
- No URL/API health check monitoring (current monitoring is server agent-based only)
- No "services" concept (only "servers" which represent infrastructure hosts)
- No version/deployment tracking capability
- No JSON path extraction or comparison logic

## Detailed Findings

### 1. Team Management & User Invitation System

#### Current State

**Team Management API** (`backend/app/api/teams.py`):
- `POST /api/v1/teams` - Create team
- `GET /api/v1/teams` - List teams
- `GET /api/v1/teams/{team_id}` - Get team details
- `PATCH /api/v1/teams/{team_id}` - Update team
- `DELETE /api/v1/teams/{team_id}` - Delete team
- `POST /api/v1/teams/{team_id}/members` - Add member (requires existing user_id)
- `PATCH /api/v1/teams/{team_id}/members/{member_id}` - Update member role
- `DELETE /api/v1/teams/{team_id}/members/{member_id}` - Remove member

**Role-Based Access Control** (`backend/app/core/rbac.py`):
- `TeamRole` enum with OWNER (level 4), ADMIN (level 3), MEMBER (level 2), VIEWER (level 1)
- `require_team_role()` dependency for endpoint protection
- Convenience dependencies: `require_team_owner()`, `require_team_admin()`, `require_team_member()`, `require_team_viewer()`

**Database Schema**:
- `users` table - FastAPI-Users managed user accounts
- `teams` table - Team info (id, name, slug, created_at)
- `team_members` table - Junction table with role field

**Frontend** (`frontend/src/pages/Teams.tsx`):
- Team listing with member counts
- Team creation form
- Team selection for active context
- Uses React Query for data fetching

#### What's Missing for Invitations

**No Invitation System**:
- No `invitations` database table
- No invitation token generation/validation
- No email sending service implementation (despite Resend configured)
- The `addMember()` API endpoint expects `user_id` but frontend sends `email`
- No user lookup by email endpoint
- No pending invitations tracking

**Email Infrastructure Configured but Not Implemented**:
- Environment variables defined: `RESEND_API_KEY`, `ALERT_EMAIL_FROM` (`.env.example:22-24`, `backend/app/core/config.py:26-28`)
- Resend package installed (v0.8.0) in `requirements.txt:15`
- No actual email sending service file exists
- UserManager has hooks (`on_after_register`, `on_after_forgot_password`, `on_after_request_verify`) but only print statements (`backend/app/core/users.py:21-29`)

### 2. Current Monitoring Architecture

#### Server-Based Monitoring (What Exists)

**Data Flow**:
1. Go daemon collects system/Docker metrics at intervals
2. Daemon sends HTTP POST to `/api/v1/metrics` with X-API-Key header
3. Backend validates, stores metrics in PostgreSQL
4. Alert evaluator checks metrics against thresholds
5. Frontend displays via REST API

**Monitored Entities**: "Servers" (infrastructure hosts)
- `servers` table stores server info, API keys, team relationships
- Each server has unique API key for daemon authentication
- Server status: online, offline, warning, critical

**Metrics Collection** (Go Daemon):
- System metrics: CPU, memory, disk, network (`daemon/internal/collector/system.go`)
- Docker metrics: Container stats (`daemon/internal/collector/docker.go`)
- Metrics stored as JSON in `metrics` table with timestamp indexing

**Alert System**:
- `alert_configs` table - Threshold configurations (warning/critical levels)
- `alerts` table - Alert instances with state tracking (new, acknowledged, resolved)
- `notifications` table - Delivery tracking with channel (email, slack) and status (pending, sent, failed)
- Alert evaluator runs automatically on metric ingestion (`backend/app/services/alert_evaluator.py`)

**API Endpoints**:
- `POST /api/v1/metrics` - Ingest metrics from daemon
- `GET /api/v1/metrics/servers/{server_id}/latest` - Latest metrics
- `GET /api/v1/metrics/servers/{server_id}/history` - Historical metrics with time range
- `GET /api/v1/alerts` - List alerts with optional state filter
- `POST /api/v1/alerts/{alert_id}/acknowledge` - Acknowledge alert

#### What's Missing for URL/API Monitoring

**No HTTP Health Check System**:
- All current monitoring relies on daemon agents installed on servers
- No capability to monitor external URLs or APIs
- No HTTP request configuration storage (method, headers, expected status)
- No JSON response validation or path extraction
- No scheduled/periodic health check execution

**No "Services" Concept**:
- Only "servers" exist (infrastructure hosts)
- No table for services/applications
- No relationship between services and healthchecks
- No deployment tracking

### 3. Database Schema for Services, Healthchecks, and Deployments

#### Current Schema (What Exists)

**8 Tables Organized Around Infrastructure Monitoring**:

```
User (1) ←→ (N) TeamMember (N) ←→ (1) Team
                                      ↓ (1)
                                   Server (N)
                                      ↓ (1)
                       ┌──────────────┼──────────────┐
                       ↓ (N)          ↓ (N)          ↓ (N)
                    Metric      AlertConfig       Alert
                                                      ↓ (1)
                                                Notification (N)
```

**Key Tables**:
- `servers` - Infrastructure hosts with API keys (`backend/app/models/server.py:10-37`)
- `metrics` - Time-series metric data with JSON values (`backend/app/models/server.py:40-54`)
- `alert_configs` - Threshold configurations, can be team-wide or server-specific (`backend/app/models/alert.py:10-25`)
- `alerts` - Active/resolved alerts with state tracking (`backend/app/models/alert.py:28-52`)
- `notifications` - Notification delivery attempts (`backend/app/models/alert.py:55-68`)

**Multi-Tenancy Pattern**:
- All monitoring entities scoped to teams via `team_id` foreign keys
- Cascade delete ensures cleanup when team is deleted

#### What's Missing for New Features

**No Service/Application Model**:
- Current focus is infrastructure (servers), not applications/services
- No table to represent deployed services or applications
- No concept of service versions or releases

**No Healthcheck/Monitor Model**:
- No table for URL health check configurations
- No storage for HTTP request details (method, headers, body)
- No expected response configuration (status code, JSON path validation)

**No Deployment/Version Tracking**:
- No table for deployments or releases
- No version history tracking
- No relationship between services and versions

**Potential New Schema Structure Needed**:
```
Service (N) ←→ (1) Team
   ↓ (1)
   ├─→ (N) HealthCheck (URL monitors)
   ├─→ (N) Deployment (version tracking)
   └─→ (N) Alert
```

### 4. HTTP Request Patterns & JSON Handling

#### Frontend HTTP Patterns (TypeScript/Axios)

**Axios Client with Interceptors** (`frontend/src/lib/api.ts:1-31`):
```typescript
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

**Query Parameters** (`frontend/src/lib/api.ts:94-145`):
```typescript
const response = await api.get('/api/v1/alerts', {
  params: state ? { state } : {},
});
```

**Custom Headers**:
```typescript
const response = await api.post('/auth/jwt/login',
  new URLSearchParams({ username, password }),
  { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
);
```

#### Backend HTTP Patterns (Python/FastAPI)

**Custom Header Authentication** (`backend/app/api/metrics.py:19-35`):
```python
async def verify_api_key(
    x_api_key: Annotated[str, Header()],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> Server:
    """Verify daemon API key and return associated server"""
    result = await session.execute(
        select(Server).where(Server.api_key == x_api_key)
    )
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    return server
```

**Query Parameters with Defaults** (`backend/app/api/metrics.py:182-188`):
```python
@router.get("/servers/{server_id}/history")
async def get_metrics_history(
    server_id: int,
    hours: int = 24,
):
    since = datetime.utcnow() - timedelta(hours=hours)
```

**JSON Path Navigation** (`backend/app/services/alert_evaluator.py:64-76`):
```python
# Extract value from nested JSON
if config.metric_type == "cpu":
    value = metric.value.get("cpu", {}).get("usage_percent")
elif config.metric_type == "memory":
    value = metric.value.get("memory", {}).get("used_percent")
elif config.metric_type == "disk":
    partitions = metric.value.get("disk", {}).get("partitions", {})
    root = partitions.get("/") or partitions.get("/System/Volumes/Data")
    if root:
        value = root.get("used_percent")
```

#### Available HTTP Libraries

**Frontend**:
- `axios` v1.12.2 - HTTP client (`package.json:36`)
- `@tanstack/react-query` v5.90.2 - Data fetching with caching

**Backend**:
- `httpx` v0.26.0 - Async HTTP client (installed but not used) (`requirements.txt:14`)
- `resend` v0.8.0 - Email API SDK (installed but not used) (`requirements.txt:15`)

### 5. Email & Notification Infrastructure

#### Resend Configuration (Ready but Not Implemented)

**Environment Configuration** (`.env.example:22-24`):
```bash
RESEND_API_KEY=your-resend-api-key
SLACK_WEBHOOK_URL=your-slack-webhook-url
ALERT_EMAIL_FROM=alerts@monitorillo.com
```

**Settings Class** (`backend/app/core/config.py:26-28`):
```python
RESEND_API_KEY: str = ""
SLACK_WEBHOOK_URL: str = ""
ALERT_EMAIL_FROM: str = "alerts@monitorillo.com"
```

**Dependencies Installed**:
- Resend SDK v0.8.0 in `requirements.txt:15`

**Notification Tracking Model** (`backend/app/models/alert.py:55-68`):
- `channel` field - "email" or "slack"
- `recipient` field - Email address or webhook URL
- `status` field - "pending", "sent", "failed"
- `sent_at` timestamp
- `error_message` for failure tracking

#### What's Missing

**No Email Sending Service**:
- No service file that uses Resend API (e.g., `notification_service.py` doesn't exist)
- Alert evaluator creates alerts but doesn't send notifications
- No email template rendering
- No integration between alert creation and notification dispatch

**UserManager Hooks Incomplete** (`backend/app/core/users.py:21-29`):
- `on_after_register()` - Only prints, no email sent
- `on_after_forgot_password()` - Only prints, no reset email
- `on_after_request_verify()` - Only prints, no verification email

## Code References

### Team Management
- `backend/app/api/teams.py` - Team CRUD endpoints
- `backend/app/models/team.py:10-50` - Team and TeamMember models
- `backend/app/core/rbac.py:14-99` - Role-based access control
- `frontend/src/pages/Teams.tsx` - Team management UI

### Monitoring System
- `backend/app/api/metrics.py` - Metrics ingestion API
- `backend/app/models/server.py:10-54` - Server and Metric models
- `backend/app/services/alert_evaluator.py` - Alert evaluation logic
- `daemon/internal/collector/system.go` - System metrics collection
- `daemon/internal/reporter/client.go` - HTTP metrics reporting

### Alert System
- `backend/app/models/alert.py:10-68` - Alert, AlertConfig, Notification models
- `backend/app/api/alerts.py` - Alert management endpoints
- `frontend/src/pages/Alerts.tsx` - Alert management UI

### Configuration & Dependencies
- `backend/app/core/config.py:26-28` - Email/notification settings
- `backend/.env.example:22-24` - Environment variables
- `backend/requirements.txt:14-15` - httpx, resend packages
- `frontend/package.json:36-50` - axios, react-query

## Architecture Documentation

### Current Patterns

**Multi-Tenancy**:
- All resources scoped to teams via `team_id` foreign keys
- Team-based access control enforced at API layer
- Cascade deletes ensure data cleanup

**Role-Based Access Control**:
- Four-level hierarchy: OWNER (4), ADMIN (3), MEMBER (2), VIEWER (1)
- Dependency injection for endpoint protection
- Role stored in `team_members` table

**API Authentication**:
- JWT tokens for user authentication
- API keys (X-API-Key header) for daemon/server authentication
- Token refresh via FastAPI-Users

**Monitoring Architecture**:
- Push-based metrics collection (daemon → API)
- Time-series storage with JSON values
- Threshold-based alerting with state machine
- Alert states: new → acknowledged → resolved

**Frontend Data Fetching**:
- React Query for caching and automatic refetching
- Axios interceptors for global auth token injection
- Query invalidation on mutations

### String Enumerations (Not Database Enums)

All enumerated fields stored as VARCHAR with documented valid values:
- `team_members.role`: owner, admin, member, viewer
- `servers.status`: online, offline, warning, critical
- `metrics.metric_type`: system, docker
- `alert_configs.metric_type`: cpu, memory, disk
- `alerts.severity`: warning, critical
- `alerts.state`: new, acknowledged, resolved
- `notifications.channel`: email, slack
- `notifications.status`: pending, sent, failed

## Historical Context (from thoughts/)

**Implementation Planning** (`IMPLEMENTATION_PLAN.md`):
- Lines 38-40: Architecture diagram shows Resend email integration planned
- Lines 199-204: Phase 5 includes "Resend email integration (HTML templates)"
- Line 331: Email invitation system listed as future feature

**Implementation Status** (`IMPLEMENTATION_COMPLETE.md`):
- Line 292: "Notification Integration: Add Resend email and Slack webhooks" listed as recommended next step

**Deployment Documentation** (`DEPLOYMENT.md`):
- Line 128: `RESEND_API_KEY=your-resend-key` in environment setup instructions

## Open Questions

### For Team Invitations Feature

1. **Invitation Flow**: Should invitations create pending records or just send magic links?
  A: Pending records recommended for tracking.
2. **User Discovery**: How to handle inviting users who don't have accounts yet?
  A: Create account on acceptance or prompt registration.
3. **Email Templates**: What format/design for invitation emails?
  A: Simple ones, not a priority now.
4. **Invitation Expiry**: Should invitation tokens expire? How long?
  A: Yes, 48 hours recommended.
5. **Resend Configuration**: Is the API key in `.env` valid and ready to use?
  A: Yes (but do not test this part, i'll handle it later).

### For URL/API Monitoring Feature

1. **Execution Model**: Who executes the health checks? (New background worker? Existing daemon?)
  A: New background worker recommended for separation of concerns.
2. **Scheduling**: How to configure check intervals? (Cron-like? Fixed intervals?)
  A: Fixed intervals (e.g., every 5 minutes) recommended for simplicity.
3. **JSON Path Library**: Use JSONPath, JMESPath, or simple dict navigation?
  A: JSON path recommended for flexibility.
4. **Service Model**: How to relate services to teams? Can services belong to multiple teams?
  A: Services are part of teams, i.e. 1 team -> N services.
5. **Migration Path**: How to preserve existing server monitoring while adding service monitoring?
  A: Keep both models separate, no migration needed.

### For Version Tracking Feature

1. **Version Format**: Support semantic versioning only or any string?
  A: Assume semver for now, but store as string.
2. **Deployment Detection**: How to determine a new deployment occurred? (Version change? Timestamp?)
  A: Version change is primary indicator. As there could be rollbacks (which should be tracked as well).
3. **Deployment History**: How much history to retain? Pagination needed?
  A: Retain full history, paginate in API. 
4. **Notification**: Should version changes trigger alerts/notifications?
  A: Not initially, but could be a future enhancement.
5. **Service Relationship**: One version endpoint per service, or multiple?
  A: One version endpoint per service.

### Cross-Feature Questions

1. **Database Migrations**: In what order to implement schema changes?
  A: Team invitations first, then services/healthchecks, then deployments.
2. **API Versioning**: All changes under existing `/api/v1/` or introduce `/api/v2/`?
  A: Keep under `/api/v1/` for now, as changes are additive.
3. **Frontend Routes**: Where to place new UI for services, healthchecks, deployments?
  A: New top-level "Services" section in sidebar. For team invitations, extend existing "Teams" section.
      Inside services, have tabs for "Health Checks" and "Deployments" (for each one).
4. **Backward Compatibility**: How to ensure existing server monitoring continues to work?
  A: Keep existing endpoints and data models intact. New features are additive.
5. **Testing Strategy**: Unit tests, integration tests, or E2E tests for new features?
  A: Only implement basic unit testing of the backend and daemon, when applicable. Keep them suuuper simple please. No frontend nor E2E tests needed.
