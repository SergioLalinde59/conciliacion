# Test: Reclasificar Movimientos (Masivo)

## Objetivo
Verificar que la reclasificacion masiva respeta el permiso de clasificar.

## Pagina
`/herramientas/mantenimiento/reclasificar-movimientos` - ReclasificarMovimientosPage

## Permisos Involucrados
- `tipo_cuenta.permite_clasificar` - Si se puede cambiar tercero/CC/concepto

## Casos de Prueba

### 1. Sugerencias de Reclasificacion
- [ ] Muestra grupos de movimientos con misma clasificacion
- [ ] Permite seleccionar para reclasificar como "Traslado" u otro

### 2. Aplicar Reclasificacion
- [ ] Solo si TODOS los movimientos del grupo tienen `permite_clasificar=true`
- [ ] Si alguno no permite, mostrar error descriptivo
- [ ] Reclasificacion cambia tercero, CC, concepto en lote

### 3. Filtros
- [ ] Filtrar por cuenta, rango de fechas
- [ ] Filtrar por tercero actual

## Archivos Relevantes
- `frontend/src/pages/mantenimiento/ReclasificarMovimientosPage.tsx`
- `Backend/src/infrastructure/api/routers/movimientos.py` (endpoint /reclasificar-lote)

## Resultado Esperado
La reclasificacion masiva funciona para cualquier cuenta que tenga `permite_clasificar=true` (todas actualmente).