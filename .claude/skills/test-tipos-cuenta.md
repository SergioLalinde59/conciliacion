# Test: Configuracion de Tipos de Cuenta

## Objetivo
Verificar que la pagina de tipos de cuenta permite ver y editar toda la configuracion.

## Pagina
`/maestros/tipos-cuenta` - TiposCuentaPage

## Campos a Verificar

### Datos Basicos
- [ ] Nombre del tipo
- [ ] Descripcion (opcional)

### Pesos de Clasificacion
- [ ] `peso_referencia` - Importancia de referencia (0-100)
- [ ] `peso_descripcion` - Importancia de descripcion (0-100)
- [ ] `peso_valor` - Importancia del monto (0-100)
- [ ] `longitud_min_referencia` - Minimo caracteres para usar referencia

### Permisos de Operacion
- [ ] `permite_crear_manual` - Crear movimientos desde UI
- [ ] `permite_editar` - Abrir modal de edicion
- [ ] `permite_modificar` - Cambiar fecha/valor/descripcion
- [ ] `permite_borrar` - Eliminar movimientos
- [ ] `permite_clasificar` - Asignar tercero/CC/concepto

### Validaciones y UX
- [ ] `requiere_descripcion` - Descripcion obligatoria al crear
- [ ] `valor_minimo` - Monto minimo permitido
- [ ] `responde_enter` - Enter abre confirmacion

## Casos de Prueba

### 1. Listar Tipos
- [ ] Tabla muestra todos los tipos activos
- [ ] Pesos visibles como badges (R:100 D:50 V:30)
- [ ] Permisos visibles como badges verdes/grises

### 2. Editar Tipo
- [ ] Modal carga todos los valores actuales
- [ ] Checkboxes para permisos funcionan
- [ ] Guardar actualiza correctamente

### 3. Crear Tipo (si necesario)
- [ ] Modal inicia con valores por defecto
- [ ] Validacion de nombre obligatorio

## Configuracion Esperada

| Tipo | Crear | Editar | Modif | Borrar | Clasif | Enter |
|------|-------|--------|-------|--------|--------|-------|
| Efectivo | SI | SI | SI | SI | SI | SI |
| Bancaria | NO | NO | NO | NO | SI | NO |
| Tarjeta | NO | NO | NO | NO | SI | NO |
| Inversiones | NO | NO | NO | NO | SI | NO |

## Archivos Relevantes
- `frontend/src/pages/TiposCuentaPage.tsx`
- `frontend/src/components/organisms/tables/TiposCuentaTable.tsx`
- `frontend/src/components/organisms/modals/TipoCuentaModal.tsx`
- `Backend/src/infrastructure/api/routers/tipos_cuenta.py`

## Resultado Esperado
La pagina permite configurar completamente cada tipo de cuenta, y los cambios se reflejan en el comportamiento del sistema.