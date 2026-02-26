# Script para sincronizar cambios con GitHub
# Repositorio: https://github.com/SergioLalinde59/conciliacion

Clear-Host
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Sincronizacion con GitHub" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Mostrar informacion del ultimo push/commit
Write-Host "Ultimo commit registrado:" -ForegroundColor Magenta
$formatString = "%h - %s (%cr)"
$ultimoCommit = git log -1 --pretty=format:$formatString 2>$null
if ($ultimoCommit) {
    Write-Host "   $ultimoCommit" -ForegroundColor White
} else {
    Write-Host "   No hay commits previos" -ForegroundColor Gray
}
Write-Host ""

# Mostrar resumen de cambios pendientes
Write-Host "Cambios pendientes:" -ForegroundColor Magenta
$statusOutput = git status --short 2>$null
if ($statusOutput) {
    $changeCount = ($statusOutput | Measure-Object -Line).Lines
    Write-Host "   $changeCount archivos modificados/nuevos" -ForegroundColor White
} else {
    Write-Host "   No hay cambios pendientes" -ForegroundColor Gray
}
Write-Host ""
Write-Host "------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

# 1. Pedir descripcion para la actualizacion
$descripcion = Read-Host "Ingrese una descripcion para la actualizacion"

# Validar descripcion
if ([string]::IsNullOrWhiteSpace($descripcion)) {
    Write-Host "Error: La descripcion no puede estar vacia." -ForegroundColor Red
    Start-Sleep -Seconds 2
    exit 1
}

$hayError = $false

# 2. Agregar todos los cambios
Write-Host "1. Agregando cambios..." -ForegroundColor Yellow
$ErrorActionPreference = "Continue"
git add . 2>$null
$ErrorActionPreference = "Stop"
if ($LASTEXITCODE -ne 0) {
    Write-Host "   Error al agregar cambios." -ForegroundColor Red
    $hayError = $true
}

# 3. Realizar commit
if (-not $hayError) {
    Write-Host "2. Confirmando cambios (Commit)..." -ForegroundColor Yellow
    $ErrorActionPreference = "Continue"
    $commitOutput = git commit -m "$descripcion" 2>&1 | Out-String
    $commitExitCode = $LASTEXITCODE
    $ErrorActionPreference = "Stop"

    if ($commitExitCode -ne 0) {
        if ($commitOutput -match "nothing to commit") {
            Write-Host "   No hay cambios nuevos para confirmar." -ForegroundColor Yellow
        } else {
            Write-Host "   Error en commit: $($commitOutput.Trim())" -ForegroundColor Red
            $hayError = $true
        }
    } else {
        Write-Host "   Commit realizado: $descripcion" -ForegroundColor Green
    }
}

# 4. Traer cambios remotos
if (-not $hayError) {
    Write-Host "3. Verificando cambios remotos (Pull)..." -ForegroundColor Yellow
    $ErrorActionPreference = "Continue"
    $pullOutput = git pull origin main --rebase 2>&1 | Out-String
    $pullExitCode = $LASTEXITCODE
    $ErrorActionPreference = "Stop"

    if ($pullExitCode -ne 0) {
        Write-Host "   Advertencia en pull: $($pullOutput.Trim())" -ForegroundColor Yellow
        Write-Host "   Continuando con push..." -ForegroundColor Yellow
    } else {
        Write-Host "   Repositorio local actualizado" -ForegroundColor Green
    }
}

# 5. Enviar cambios (Push)
if (-not $hayError) {
    Write-Host "4. Enviando cambios a GitHub (Push)..." -ForegroundColor Yellow
    $ErrorActionPreference = "Continue"
    $pushOutput = git push origin main 2>&1 | Out-String
    $pushExitCode = $LASTEXITCODE
    $ErrorActionPreference = "Stop"

    if ($pushExitCode -eq 0) {
        Write-Host ""
        Write-Host "Actualizacion completada exitosamente." -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "Error en push: $($pushOutput.Trim())" -ForegroundColor Red
    }
}

if ($hayError) {
    Write-Host ""
    Write-Host "El proceso se detuvo por errores. Revise los mensajes anteriores." -ForegroundColor Red
}

Write-Host ""
Write-Host "Presione cualquier tecla para salir..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
