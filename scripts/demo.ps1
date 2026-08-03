# One-command demo launcher for the Visual AI Agent (Windows PowerShell).
#
#   pwsh scripts/demo.ps1
#
# Brings up Postgres (Docker), ensures backend/.env, installs deps, runs the
# migration + seed, then starts the dashboard on http://localhost:3100.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"
$dbUrl = "postgresql://postgres:postgres@localhost:5434/visual_ai_agent"

Write-Host "== Visual AI Agent demo ==" -ForegroundColor Cyan

# 1. Postgres container on port 5434
$running = docker ps -q -f name=vaa-pg
if (-not $running) {
    $exists = docker ps -aq -f name=vaa-pg
    if ($exists) {
        Write-Host "Starting existing vaa-pg container..."
        docker start vaa-pg | Out-Null
    } else {
        Write-Host "Creating vaa-pg Postgres (pgvector) container on port 5434..."
        docker run --name vaa-pg -e POSTGRES_PASSWORD=postgres `
            -e POSTGRES_DB=visual_ai_agent -p 5434:5432 -d pgvector/pgvector:pg16 | Out-Null
    }
}
Write-Host "Waiting for Postgres to be ready..."
for ($i = 0; $i -lt 30; $i++) {
    docker exec vaa-pg pg_isready -U postgres 2>$null | Out-Null
    if ($?) { break }
    Start-Sleep -Seconds 1
}

# 2. backend/.env
$envFile = Join-Path $backend ".env"
$needsEnv = $true
if (Test-Path $envFile) {
    if (Select-String -Path $envFile -Pattern "^DATABASE_URL=.+" -Quiet) { $needsEnv = $false }
}
if ($needsEnv) {
    Write-Host "Writing backend/.env (DATABASE_URL)..."
    "DATABASE_URL=$dbUrl" | Out-File -FilePath $envFile -Encoding utf8
    Write-Host "  (add ANTHROPIC_API_KEY to backend/.env to enable AI captions)" -ForegroundColor Yellow
}

# 3. install, migrate, seed
Push-Location $backend
try {
    if (-not (Test-Path (Join-Path $backend "node_modules"))) {
        Write-Host "Installing dependencies..."
        npm install
    }
    Write-Host "Running migration..."
    npm run migrate
    Write-Host "Seeding demo data..."
    npm run seed

    Write-Host ""
    Write-Host "Dashboard:  http://localhost:3100" -ForegroundColor Green
    Write-Host "Health:     http://localhost:3100/api/health"
    Write-Host "Starting Next.js (Ctrl+C to stop)..." -ForegroundColor Cyan
    npx next dev -p 3100
}
finally {
    Pop-Location
}
