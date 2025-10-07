from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import teams, servers, metrics, alerts, invitations, services, health_checks, version_checks, deployments, notifications
from app.core.config import settings
from app.core.users import auth_backend, fastapi_users
from app.schemas.user import UserCreate, UserRead, UserUpdate

app = FastAPI(title=settings.PROJECT_NAME, debug=settings.DEBUG)

origins = [
    "http://localhost",
    "http://localhost:8080",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5005",
    "https://app.desplega.ai",
    "https://desplega.ai",
    "https://monitorillo.vercel.app",
    "https://*.vercel.app",
    # Remove
    # "*",
]


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Auth routes
app.include_router(
    fastapi_users.get_auth_router(auth_backend),
    prefix="/auth/jwt",
    tags=["auth"],
)

app.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix="/auth",
    tags=["auth"],
)

app.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["users"],
)

# API routes
app.include_router(teams.router, prefix=settings.API_V1_PREFIX)
app.include_router(servers.router, prefix=settings.API_V1_PREFIX)
app.include_router(metrics.router, prefix=settings.API_V1_PREFIX)
app.include_router(alerts.router, prefix=settings.API_V1_PREFIX)
app.include_router(
    invitations.router,
    prefix="/api/v1",
    tags=["invitations"],
)
app.include_router(
    services.router,
    prefix="/api/v1",
    tags=["services"],
)
app.include_router(
    health_checks.router,
    prefix="/api/v1",
    tags=["health-checks"],
)
app.include_router(
    version_checks.router,
    prefix="/api/v1",
    tags=["version-checks"],
)
app.include_router(
    deployments.router,
    prefix="/api/v1",
    tags=["deployments"],
)
app.include_router(
    notifications.router,
    prefix="/api/v1",
    tags=["notifications"],
)


@app.get("/")
async def root():
    return {"message": "Monitorillo API", "version": "0.1.0"}


@app.get("/health")
async def health():
    return {"status": "ok"}
