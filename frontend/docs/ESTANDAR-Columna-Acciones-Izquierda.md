# ✅ Estándar Establecido: Columna de Acciones a la Izquierda

> **Decisión de Diseño** que establece el posicionamiento de columnas de acción en todas las DataTables
>
> **Fecha:** 2026-02-03  
> **Alcance:** Todas las tablas en la aplicación  
> **Estado:** ✅ Implementado en MovimientosTable y ReclasificarMovimientosPage

---

## 📐 Regla de Diseño

### Orden de Columnas Estándar

```
┌─────────────┬─────────┬────────┬────────┬────────┬─────────┐
│ [Selección] │ ACCIÓN  │ ID     │ Fecha  │ Datos  │ ...     │
│  Checkbox   │ Botones │        │        │        │         │
└─────────────┴─────────┴────────┴────────┴────────┴─────────┘
     (1)         (2)       (3)      (4)      (5+)
```

**Posiciones:**
1. **Columna de Selección** (si aplica) - Checkbox para selección múltiple
2. **Columna de Acciones** - Botones de acción (Ver, Editar, Eliminar, etc.)
3. **Columna de ID** (si aplica) - Identificador del registro
4. **Columna de Fecha** (si aplica) - Fecha principal del registro
5. **Columnas de Datos** - Resto de la información

---

## ✅ Ejemplos Implementados

### MovimientosTable.tsx (Referencia)

```typescript
const columns: Column<Movimiento>[] = useMemo(() => [
    {
        key: 'actions',
        header: <TableHeaderCell>Acción</TableHeaderCell>,
        align: 'center',
        width: 'w-16',
        accessor: (row) => (
            <div className="flex items-center justify-center gap-1">
                {onView && (
                    <Button variant="ghost" size="sm" onClick={() => onView(row)}>
                        <Eye size={15} />
                    </Button>
                )}
            </div>
        )
    },
    idColumn<Movimiento>('id', <TableHeaderCell>ID</TableHeaderCell>, ...),
    fechaColumn<Movimiento>('fecha', <TableHeaderCell>Fecha</TableHeaderCell>, ...),
    // ... resto de columnas
], [onEdit, onView, onDelete])
```

**Características:**
- ✅ Primera columna (sin contar selección)
- ✅ Header con TableHeaderCell: "Acción"
- ✅ Align: center
- ✅ Width: w-16
- ✅ Condicional según handlers disponibles

---

### ReclasificarMovimientosPage.tsx

```typescript
const columns = useMemo<Column<Movimiento>[]>(() => [
    {
        key: 'selection',
        header: (<input type="checkbox" ... />),
        // ... checkbox para selección múltiple
    },
    {
        key: 'actions',
        header: <TableHeaderCell>Acción</TableHeaderCell>,
        align: 'center',
        width: 'w-16',
        accessor: (row) => (
            <Button
                variant="ghost-warning"
                size="sm"
                onClick={() => handleReclasificarUno(row)}
                title="Reclasificar Individualmente"
            >
                <Unlink size={14} />
            </Button>
        )
    },
    fechaColumn<Movimiento>('fecha', ...),
    // ... resto de columnas
], [selectedIds, movimientos, ...])
```

**Características:**
- ✅ Segunda columna (después de selección)
- ✅ Header con TableHeaderCell: "Acción"
- ✅ Botón de acción específico (Reclasificar)
- ✅ Variant y size apropiados

---

## 🎯 Beneficios de Este Estándar

### 1. **UX Consistente**
- ✅ Usuario siempre sabe dónde buscar acciones
- ✅ Patrón predecible en toda la aplicación
- ✅ Menos carga cognitiva

### 2. **Flujo Natural de Lectura**
- ✅ Acción → Identificación → Datos
- ✅ "¿Qué puedo hacer?" aparece primero
- ✅ Luego "¿Con qué?" y "¿Qué información tiene?"

### 3. **Diseño Responsivo**
- ✅ Columnas de acción siempre visibles
- ✅ No se pierden en scroll horizontal
- ✅ Acceso rápido en pantallas pequeñas

### 4. **Accesibilidad**
- ✅ Tab order lógico (acciones primero)
- ✅ Keyboard navigation intuitiva
- ✅ Screen readers encuentran acciones fácilmente

---

## 📋 Checklist de Implementación

Para cualquier tabla nueva o refactorización:

### Estructura Básica

- [ ] ✅ Columna de selección (si hay selección múltiple)
- [ ] ✅ Columna de acciones inmediatamente después
- [ ] ✅ Header con `<TableHeaderCell>Acción</TableHeaderCell>`
- [ ] ✅ `align: 'center'`
- [ ] ✅ `width: 'w-16'` (o ajustar según botones)
- [ ] ✅ Botones con variant apropiado

### Columna de Acciones

```typescript
{
    key: 'actions',
    header: <TableHeaderCell>Acción</TableHeaderCell>,
    align: 'center',
    width: 'w-16', // Ajustar según cantidad de botones
    headerClassName: '!py-2.5 !px-0.5 text-[10px] font-bold text-gray-400 tracking-wide',
    cellClassName: '!py-0.5 !px-0.5',
    accessor: (row) => (
        <div className="flex items-center justify-center gap-1">
            {/* Botones de acción */}
        </div>
    )
}
```

### Botones de Acción Comunes

| Acción | Variant | Icono | Color | Uso |
|--------|---------|-------|-------|-----|
| Ver | `ghost` | `Eye` | blue-600 | Ver detalles |
| Editar | `ghost` | `Edit2` | gray-600 | Editar registro |
| Eliminar | `ghost-danger` | `Trash2` | red-600 | Eliminar |
| Reclasificar | `ghost-warning` | `Unlink` | amber-600 | Resetear clasificación |

---

## 🚫 Antipatrones a Evitar

### ❌ Acciones al Final
```typescript
// ❌ MAL - Acciones al final
[
    fechaColumn(...),
    nombreColumn(...),
    // ... muchas columnas
    {
        key: 'actions', // ❌ Al final
        header: '',     // ❌ Sin header
        align: 'right', // ❌ Alineado a derecha
        // ...
    }
]
```

### ❌ Sin Header de Tabla
```typescript
// ❌ MAL - Header vacío
{
    key: 'actions',
    header: '', // ❌ Vacío, usuario no sabe qué es
    // ...
}
```

### ❌ Alineación Inconsistente
```typescript
// ❌ MAL - Alineado a derecha
{
    key: 'actions',
    header: <TableHeaderCell>Acción</TableHeaderCell>,
    align: 'right', // ❌ Debe ser 'center'
    // ...
}
```

---

## ✅ Correcto

```typescript
// ✅ BIEN - Acciones primero, centradas, con header
const columns = [
    // 1. Selección (si aplica)
    selectionColumn,
    
    // 2. ACCIONES - Siempre aquí
    {
        key: 'actions',
        header: <TableHeaderCell>Acción</TableHeaderCell>,
        align: 'center',
        width: 'w-16',
        accessor: (row) => (
            <div className="flex items-center justify-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => onView(row)}>
                    <Eye size={15} />
                </Button>
            </div>
        )
    },
    
    // 3. ID (si aplica)
    idColumn(...),
    
    // 4. Fecha principal
    fechaColumn(...),
    
    // 5+ Resto de datos
    // ...
]
```

---

## 🔄 Plan de Migración

### Tablas Pendientes de Actualizar

| Tabla | Estado | Prioridad | Estimación |
|-------|--------|-----------|------------|
| MovimientosTable | ✅ Correcto | - | - |
| ReclasificarMovimientosPage | ✅ Corregido | - | - |
| ClasificarMovimientosPage | ⏳ Pendiente | Alta | 5 min |
| ConciliacionPage | ⏳ Pendiente | Media | 5 min |
| ReporteEgresosTerceroPage | ⏳ Pendiente | Media | 5 min |
| ReporteEgresosCentroCostoPage | ⏳ Pendiente | Media | 5 min |
| ReporteIngresosGastosMesPage | ⏳ Pendiente | Media | 5 min |
| CuentasTable | ⏳ Pendiente | Baja | 3 min |
| TercerosTable | ⏳ Pendiente | Baja | 3 min |
| Otras tablas CRUD | ⏳ Pendiente | Baja | 3 min c/u |

**Total estimado:** ~45 minutos para migrar todas

---

## 📝 Notas de Implementación

### Width de Columna de Acciones

```typescript
// 1 botón
width: 'w-16'

// 2 botones
width: 'w-20'

// 3 botones
width: 'w-24'

// 4+ botones (considerar dropdown)
width: 'w-28'
```

### Gap entre Botones

```typescript
<div className="flex items-center justify-center gap-1">
    {/* gap-1 para botones sm */}
</div>
```

### Condicionales

```typescript
// Mostrar solo si handler existe
{onView && (
    <Button onClick={() => onView(row)}>
        <Eye size={15} />
    </Button>
)}

// Mostrar solo si aplica lógica de negocio
{row.puede_editarse && (
    <Button onClick={() => onEdit(row)}>
        <Edit2 size={15} />
    </Button>
)}
```

---

## 🎓 Lecciones Aprendidas

### Por Qué a la Izquierda

1. **Flujo F-Pattern:** Los usuarios escanean de izquierda a derecha
2. **Primero la Acción:** Decision-first design - "¿Qué puedo hacer con esto?"
3. **Scroll Horizontal:** Columnas de la izquierda siempre visibles
4. **Mobile First:** En pantallas pequeñas, lo primero que ven
5. **Tab Order:** Navegación por teclado más lógica

### Comparación con Otros Sistemas

| Sistema | Posición Acciones | Razón |
|---------|------------------|-------|
| Gmail | Izquierda | Checkbox + Acciones juntas |
| Trello | Izquierda | Quick actions first |
| Jira | Izquierda | Context menu accesible |
| **Nuestra App** | **Izquierda** | **Consistencia y UX** |

---

## 🚀 Conclusión

**Estándar Establecido:** ✅

**Todas las tablas deben seguir este orden:**
```
[Selección] → [Acción] → [ID] → [Fecha] → [Datos...]
```

**Próximas acciones:**
1. Aplicar en ClasificarMovimientosPage (siguiente refactorización)
2. Migrar tablas existentes progresivamente
3. Documentar en component library

---

**Este estándar es oficial y debe aplicarse a TODAS las tablas nuevas y refactorizadas.**
