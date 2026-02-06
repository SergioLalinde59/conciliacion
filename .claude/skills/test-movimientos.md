# Test: Pagina de Movimientos (CRUD)

## Objetivo
Verificar que el CRUD de movimientos respeta los permisos del tipo de cuenta.

## Pagina
`/movimientos` - MovimientosPage

## Permisos Involucrados
- `permite_crear_manual` - Mostrar boton "Nuevo Movimiento"
- `permite_editar` - Mostrar boton editar, abrir modal
- `permite_modificar` - Permitir cambiar fecha/valor/descripcion
- `permite_borrar` - Mostrar boton eliminar
- `permite_clasificar` - Permitir cambiar tercero/CC/concepto

## Casos de Prueba

### 1. Cuenta Bancaria (crear=NO, editar=NO, modificar=NO, borrar=NO, clasificar=SI)
- [ ] NO aparece boton "Nuevo Movimiento" para esta cuenta
- [ ] Al hacer clic en editar, solo permite cambiar clasificacion
- [ ] Campos fecha/valor/descripcion deshabilitados o no visibles
- [ ] NO aparece boton eliminar
- [ ] SI puede cambiar tercero, centro_costo, concepto

### 2. Cuenta Efectivo (crear=SI, editar=SI, modificar=SI, borrar=SI, clasificar=SI)
- [ ] SI aparece boton "Nuevo Movimiento"
- [ ] Modal permite editar TODOS los campos
- [ ] SI aparece boton eliminar
- [ ] Enter abre confirmacion (responde_enter=true)
- [ ] Descripcion es obligatoria (requiere_descripcion=true)

### 3. Backend Validacion
- [ ] POST /api/movimientos rechaza si `permite_crear_manual=false`
- [ ] PUT /api/movimientos rechaza cambios de valores si `permite_modificar=false`
- [ ] DELETE /api/movimientos rechaza si `permite_borrar=false`
- [ ] Errores retornan HTTP 403 con mensaje descriptivo

### 4. MovimientoModal
- [ ] Campos deshabilitados segun permisos
- [ ] Validaciones dinamicas (requiere_descripcion, valor_minimo)
- [ ] Enter funciona solo si responde_enter=true

## Archivos Relevantes
- `frontend/src/pages/MovimientosPage.tsx`
- `frontend/src/components/organisms/modals/MovimientoModal.tsx`
- `Backend/src/infrastructure/api/routers/movimientos.py` (lineas 421-450, 513-545, 725-756)

## Resultado Esperado
- Bancarias: Solo clasificar, no modificar datos del extracto
- Efectivo: Control total (crear, editar, borrar)