# Codebase Auditor — task runner

default:
    @just --list

frontend_dir := "frontend"
backend_dir := "backend"

# Install all dependencies (frontend + backend)
install:
    cd {{frontend_dir}} && npm install
    cd {{backend_dir}} && uv sync

# Start both dev servers (backend :8000, frontend :3000)
dev:
    cd {{backend_dir}} && uv run uvicorn server:app --reload --port 8000 &
    cd {{frontend_dir}} && npm run dev

# Start backend dev server only
dev-backend:
    cd {{backend_dir}} && uv run uvicorn server:app --reload --port 8000

# Start frontend dev server only
dev-frontend:
    cd {{frontend_dir}} && npm run dev

# Lint frontend (eslint) and backend (ruff)
lint:
    cd {{frontend_dir}} && npm run lint
    cd {{backend_dir}} && uv run ruff check .

# Run backend tests
test:
    cd {{backend_dir}} && uv run pytest; s=$?; [ $s -eq 5 ] && exit 0 || exit $s

# Build Lambda package and deploy with OpenTofu
deploy:
    bash scripts/deploy.sh
