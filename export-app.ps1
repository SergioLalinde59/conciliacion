# export-app.ps1 — Empaqueta la app para despliegue en otra máquina
# Uso: .\export-app.ps1
# Genera: conciliacion_YYYY-MM-DD.zip con solo archivos esenciales

$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$date = Get-Date -Format "yyyy-MM-dd"
$output = Join-Path $projectDir "conciliacion_$date.zip"

Set-Location $projectDir

# Eliminar ZIP anterior del mismo día si existe
if (Test-Path $output) { Remove-Item $output }

Write-Host "Recopilando archivos..." -ForegroundColor Cyan

$files = @()

# --- Archivos raíz ---
$files += "docker-compose.yml"
$files += ".gitignore"

# --- Backend: config ---
foreach ($f in @("Dockerfile", ".dockerignore", ".gitignore", ".env.example", "requirements.txt")) {
    $path = "Backend\$f"
    if (Test-Path $path) { $files += $path }
}

# --- Backend: migrations SQL ---
if (Test-Path "Backend\migrations") {
    $files += Get-ChildItem "Backend\migrations" -Filter "*.sql" -File -Recurse |
        ForEach-Object { $_.FullName.Substring($projectDir.Length + 1) }
}

# --- Backend: código fuente (sin __pycache__ ni .pyc) ---
$files += Get-ChildItem "Backend\src" -File -Recurse |
    Where-Object { $_.FullName -notmatch '__pycache__' -and $_.Extension -ne '.pyc' } |
    ForEach-Object { $_.FullName.Substring($projectDir.Length + 1) }

# --- Frontend: config ---
foreach ($f in @("Dockerfile", ".dockerignore", ".gitignore", "package.json",
                 "package-lock.json", "tsconfig.json", "vite.config.ts",
                 "index.html", "nginx.conf")) {
    $path = "frontend\$f"
    if (Test-Path $path) { $files += $path }
}

# --- Frontend: código fuente (sin vestigios del template Vite) ---
$excludeNames = @("counter.ts", "typescript.svg", "style.css")
$files += Get-ChildItem "frontend\src" -File -Recurse |
    Where-Object { $_.Name -notin $excludeNames } |
    ForEach-Object { $_.FullName.Substring($projectDir.Length + 1) }

# --- LocalServer (opcional) ---
if (Test-Path "LocalServer\docker-compose.yml") { $files += "LocalServer\docker-compose.yml" }
if (Test-Path "LocalServer\config_app.md") { $files += "LocalServer\config_app.md" }

# --- Crear ZIP ---
$fileCount = $files.Count
Write-Host "Archivos encontrados: $fileCount" -ForegroundColor Cyan
Write-Host "Creando $output ..." -ForegroundColor Cyan

$fullPaths = $files | ForEach-Object { Join-Path $projectDir $_ }
Compress-Archive -Path $fullPaths -DestinationPath $output -CompressionLevel Optimal

# --- Resumen ---
$size = (Get-Item $output).Length / 1MB
$sizeFormatted = "{0:N2}" -f $size

Write-Host ""
Write-Host "=== Exportacion completada ===" -ForegroundColor Green
Write-Host "Archivo:  conciliacion_$date.zip"
Write-Host "Tamano:   $sizeFormatted MB"
Write-Host "Archivos: $fileCount"
Write-Host ""
Write-Host "Para desplegar en otra maquina:" -ForegroundColor Yellow
Write-Host "  1. Copiar conciliacion_$date.zip a la maquina destino"
Write-Host "  2. Descomprimir el ZIP"
Write-Host "  3. Crear .env basandose en Backend\.env.example"
Write-Host "  4. docker compose up --build"
