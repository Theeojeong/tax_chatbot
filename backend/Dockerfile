FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

COPY pyproject.toml uv.lock ./

ENV PATH="/app/.venv/bin:$PATH"

ENV UV_PYTHON_PREFERENCE=only-system

RUN uv sync --frozen --no-cache

COPY backend .
COPY reference ./reference

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]