FROM python:3.12-slim-bookworm AS builder

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        gcc \
        postgresql-client \
        curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

ENV PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    VIRTUAL_ENV=/venv \
    PATH="/venv/bin:$PATH"

RUN uv venv $VIRTUAL_ENV

WORKDIR /app

COPY ./pyproject.toml ./uv.lock ./

RUN uv sync --locked --active

COPY . .

RUN uv sync --locked --active --all-extras

# Create a non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app /venv
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
