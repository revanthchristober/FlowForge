.PHONY: setup up down dev test eval clean

PYTHON := uv run python
PYTEST  := uv run pytest

# ── Bootstrap ──────────────────────────────────────────────────────────────────
setup:
	@echo "→ Installing uv..."
	curl -LsSf https://astral.sh/uv/install.sh | sh
	@echo "→ Installing Python 3.12..."
	uv python install 3.12
	@echo "→ Syncing backend dependencies..."
	cd backend && uv sync
	@echo "→ Copying .env.example → .env (edit with your keys)..."
	@test -f .env || cp .env.example .env
	@echo "✓ Setup complete. Edit .env then run: make up && make dev"

# ── Infrastructure ─────────────────────────────────────────────────────────────
up:
	@cp .env infra/.env 2>/dev/null || true
	docker compose -f infra/docker-compose.yml --env-file .env up -d
	@echo "Waiting for Postgres..."
	@sleep 3
	@echo "Running DB migrations..."
	cd backend && $(PYTHON) -m forgeflow.db --setup
	@echo "✓ Stack up: Postgres=5432  LiteLLM=4000"

down:
	docker compose -f infra/docker-compose.yml down

logs:
	docker compose -f infra/docker-compose.yml logs -f

# ── Backend dev server ─────────────────────────────────────────────────────────
dev:
	cd backend && uv run uvicorn forgeflow.api:app --reload --host 0.0.0.0 --port 8000

# ── Tests ──────────────────────────────────────────────────────────────────────
test:
	cd backend && $(PYTEST) tests/ -v --tb=short

test-unit:
	cd backend && $(PYTEST) tests/test_state.py tests/test_agents.py -v --tb=short

# ── Demo helpers ───────────────────────────────────────────────────────────────
demo:
	@echo "Starting demo run with todo_api PRD..."
	cd backend && $(PYTHON) -m forgeflow.cli demo ../golden_prds/todo_api.md

# ── Eval ──────────────────────────────────────────────────────────────────────
eval:
	cd backend && $(PYTHON) -m forgeflow.eval.run

eval-baseline:
	cd backend && $(PYTHON) -m forgeflow.eval.run --save-baseline

eval-compare:
	cd backend && $(PYTHON) -m forgeflow.eval.run --baseline forgeflow/eval/baselines.json

# ── Frontend ──────────────────────────────────────────────────────────────────
setup-frontend:
	cd frontend && pnpm install

dev-frontend:
	cd frontend && pnpm dev

test-frontend:
	cd frontend && pnpm test

# ── Full stack (backend + frontend) ──────────────────────────────────────────
dev-all:
	@echo "Starting backend and frontend dev servers..."
	@(cd backend && uv run uvicorn forgeflow.api:app --reload --host 0.0.0.0 --port 8000) &
	@(cd frontend && pnpm dev)

# ── Sandbox image ─────────────────────────────────────────────────────────────
sandbox-build:
	docker build -t forgeflow-sandbox:latest -f infra/Dockerfile.sandbox infra/

# ── Cleanup ───────────────────────────────────────────────────────────────────
clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
