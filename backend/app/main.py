from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import teams, servers, metrics, alerts
from app.core.config import settings
from app.core.users import auth_backend, fastapi_users
from app.schemas.user import UserCreate, UserRead, UserUpdate

app = FastAPI(title=settings.PROJECT_NAME, debug=settings.DEBUG)

# CORS
app.add_middleware(
    CORSMiddleware,
    # allow_origins=settings.cors_origins_list,
    allow_origins=["*"],  # Allow all origins for testing purposes
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


@app.get("/")
async def root():
    return {"message": "Monitorillo API", "version": "0.1.0"}


@app.get("/health")
async def health():
    return {"status": "ok"}
