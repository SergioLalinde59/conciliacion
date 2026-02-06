# Test: Carga de Movimientos

## Objetivo
Verificar que la carga de archivos de movimientos respeta los permisos del tipo de cuenta.

## Página
`/movimientos/cargar` - UploadMovimientosPage

## Permisos Involucrados
- `cuenta.permite_carga` - Determina si la cuenta aparece en el selector
- `tipo_cuenta.permite_crear_manual` - NO aplica aquí (es carga masiva, no manual)

## Casos de Prueba

### 1. Selector de Cuentas
- [ ] Solo aparecen cuentas con `permite_carga = true`
- [ ] Cuentas de efectivo NO deben aparecer (movimientos manuales)
- [ ] Cuentas bancarias SI deben aparecer

### 2. Carga de Archivo
- [ ] Subir archivo CSV/Excel para cuenta bancaria
- [ ] Verificar que los movimientos se crean correctamente
- [ ] Los movimientos nuevos quedan como "pendientes de clasificar"

### 3. Duplicados
- [ ] Si ya existen movimientos con misma fecha+valor+referencia, no duplicar
- [ ] Mostrar resumen de: nuevos, duplicados, errores

## Archivos Relevantes
- `frontend/src/pages/UploadMovimientosPage.tsx`
- `Backend/src/infrastructure/api/routers/archivos.py`
- `Backend/src/application/services/cargar_movimientos_service.py`

## Resultado Esperado
La carga masiva funciona para cuentas bancarias. Las cuentas de efectivo no aparecen porque sus movimientos se crean manualmente.