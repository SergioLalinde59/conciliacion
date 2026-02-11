# 🎯 PLAN MAESTRO: Visión Única de DataTables

> **Documento Maestro** que unifica la implementación de TODAS las DataTables en la aplicación
>
> **Fecha:** 2026-02-03  
> **Referencia:** `datatable-componentes.md`
> **Filosofía:** Una sola forma de hacer las cosas, componentes reutilizables, cero duplicación

---

## 🎨 Visión y Filosofía

### Principio Rector

**"Una DataTable, Un Patrón"** - Todas las tablas en la aplicación deben:
- ✅ Usar los mismos column helpers
- ✅ Tener el mismo look & feel
- ✅ Compartir componentes moleculares cuando sea posible
- ✅ Seguir el diseño atómico estrictamente

### Componentes Base Únicos (El Core)

Estos son los **únicos** componentes que usaremos para construir TODAS las tablas:

```
🔬 ÁTOMOS
├─ TableHeaderCell        → Todos los headers
├─ columnHelpers          → Todas las columnas tipadas
│  ├─ monedaColumn
│  ├─ fechaColumn  
│  ├─ textoColumn
│  ├─ idColumn
│  ├─ cifraColumn
│  ├─ selectionColumn     → [NUEVO] Checkboxes
│  └─ badgeColumn         → [NUEVO] Badges de estado

🧪 MOLÉCULAS
├─ DataTable              → Motor base (ya existe)
├─ EntityDisplay          → ID + Nombre (ya existe)
├─ ClassificationDisplay  → Centro Costo + Concepto (ya existe)
├─ SelectableDataTable    → [NUEVO] DataTable + selección múltiple
├─ DrilldownTable         → [NUEVO] Para reportes con drill-down
└─ MovimientosDetailModal → [NUEVO] Modal estándar de movimientos

🦠 ORGANISMOS
└─ Tablas específicas de negocio (MovimientosTable, etc.)
```

---

## 📊 Inventario Completo de Páginas con DataTables

### Grupo 1: Página Principal - MOVIMIENTOS ⭐ **MANTENER COMO REFERENCIA**

| Página | Componente Usado | Estado | Acción |
|--------|------------------|--------|--------|
| `MovimientosPage.tsx` | `MovimientosTable` | ✅ **REFERENCIA** | Mantener como está - es el estándar |

**Características:**
- Usa `MovimientosTable` (organismo bien implementado)
- Tiene filtros, estadísticas, gráficas
- Modal de detalle `MovimientoModal`
- **Esta es nuestra tabla de referencia #1**

---

### Grupo 2: Procesos de Clasificación (Alto Impacto)

| # | Página | Complejidad | DataTables | Problemas |
|---|--------|-------------|------------|-----------|
| 1 | `ClasificarMovimientosPage.tsx` | ⭐⭐⭐⭐ | 2 inline (principal + modal lote) | Sin TableHeaderCell, sin helpers, selección manual |
| 2 | `ReclasificarMovimientosPage.tsx` | ⭐⭐⭐⭐ | 1 inline | Sin TableHeaderCell, sin helpers, selección manual |

**Patrón común:** Ambas necesitan selección múltiple

**Solución:** Crear `SelectableDataTable` y aplicar en ambas

---

### Grupo 3: Conciliación y Matching (Complejidad Especializada)

| # | Página | Complejidad | DataTables | Decisión |
|---|--------|-------------|------------|----------|
| 3 | `ConciliacionPage.tsx` | ⭐⭐⭐ | 1 inline con headerGroups | Refactorizar inline (mantener headerGroups) |
| 4 | `ConciliacionMatchingPage.tsx` | ⭐⭐⭐⭐⭐ | `MatchingTable` (641 líneas custom) | **NO TOCAR** - Complejidad justificada |

**Nota:** MatchingTable es especial - tiene lógica única de matching que no se reutiliza

---

### Grupo 4: Reportes Drilldown (Código Duplicado)

| # | Página | Líneas | Similitud | Oportunidad |
|---|--------|--------|-----------|-------------|
| 5 | `ReporteEgresosTerceroPage.tsx` | 492 | 85% | Base para DrilldownTable |
| 6 | `ReporteEgresosCentroCostoPage.tsx` | 490 | 85% | Reutilizar DrilldownTable |
| 7 | `ReporteIngresosGastosMesPage.tsx` | 483 | 80% | Reutilizar DrilldownTable |

**Patrón común:** 
- Tabla nivel 1 → Modal nivel 2 → Modal nivel 3 → Modal de movimientos
- ~60% del código es idéntico

**Solución:** 
- Crear `DrilldownTable` (molécula)
- Crear `MovimientosDetailModal` (molécula)
- Reducir cada página de ~490 líneas a ~150 líneas

---

### Grupo 5: Páginas Secundarias (Menor Prioridad)

| Página | Uso | Prioridad |
|--------|-----|-----------|
| `DescargarMovimientosPage.tsx` | Download | Baja |
| `ReporteClasificacionesPage.tsx` | Reportes | Media |
| `TerceroDescripcionesPage.tsx` | CRUD | Baja |
| Otras páginas con DataTable inline | Varios | Baja |

---

## 🎯 PLAN DE IMPLEMENTACIÓN UNIFICADO

### FASE 0: Establecer el Estándar (Documentación)

**Objetivo:** Documentar MovimientosTable como referencia oficial

**Acciones:**
- ✅ Ya existe: `MovimientosTable.tsx`
- ✅ Ya existe: `datatable-componentes.md`
- [ ] Validar que MovimientosTable sigue todos los lineamientos 100%

**Tiempo:** 30 min (validación solo)

---

### FASE 1: Componentes Base Reutilizables (Fundación)

**Objetivo:** Crear bloques fundamentales únicos

#### 1.1 Átomos Nuevos

**`columnHelpers.tsx` - Agregar helpers faltantes:**

```typescript
// Helper para columnas de selección
export const selectionColumn = <T,>(
    selectedIds: number[],
    onToggle: (id: number) => void,
    getId: (row: T) => number,
    options?: ColumnOptions
): Column<T>

// Helper para badges de estado
export const badgeColumn<T>(
    key: string,
    header: React.ReactNode,
    getValue: (row: T) => string,
    colorMap?: Record<string, string>,
    options?: ColumnOptions
): Column<T>
```

**Tiempo:** 1 hora

---

#### 1.2 Moléculas Core

**A) `SelectableDataTable.tsx`** (Molécula nueva - Prioridad ALTA)

```typescript
interface SelectableDataTableProps<T> {
    data: T[]
    columns: Column<T>[]
    selectedIds: number[]
    onSelectionChange: (ids: number[]) => void
    getRowId: (row: T) => number
    // ... resto de props de DataTable
}
```

**Características:**
- Checkbox en header (select all)
- Checkbox en cada fila
- Maneja estado de selección
- Compatible con DataTable existente

**Usado en:**
- ClasificarMovimientosPage
- ReclasificarMovimientosPage

**Tiempo:** 2 horas

---

**B) `MovimientosDetailModal.tsx`** (Molécula nueva)

```typescript
interface MovimientosDetailModalProps {
    isOpen: boolean
    onClose: () => void
    movimientos: Movimiento[]
    title: string
    subtitle?: string
    contextInfo?: {
        tercero?: string
        centroCosto?: string
        concepto?: string
        mes?: string
    }
    onMovimientoClick?: (mov: Movimiento) => void
}
```

**Características:**
- Modal con DataTable de movimientos
- Info de contexto en header
- Totales en footer
- Estilos consistentes

**Usado en:**
- MovimientosPage (existente)
- Todos los reportes drilldown
- Páginas de clasificación

**Tiempo:** 2 horas

---

**C) `DrilldownTable.tsx`** (Molécula nueva)

```typescript
interface DrilldownTableProps<T> {
    data: T[]
    onDrilldown: (item: T) => void
    level: 'tercero' | 'centro_costo' | 'concepto' | 'mes'
    showTotals?: boolean
    customColumns?: Column<T>[]
}
```

**Características:**
- Tabla con click para drill-down
- Columnas predefinidas (Nombre, Ingresos, Egresos, Saldo)
- Row totals en footer
- Click handler para ir al siguiente nivel

**Usado en:**
- Los 3 reportes de egresos/ingresos

**Tiempo:** 2.5 horas

---

**Total FASE 1:** ~7.5 horas

---

### FASE 2: Aplicar en Páginas de Clasificación (Quick Wins)

#### 2.1 ReclasificarMovimientosPage

**Cambios:**
1. Reemplazar DataTable inline por `SelectableDataTable`
2. Aplicar `TableHeaderCell` a todos los headers
3. Usar column helpers (fecha, moneda, EntityDisplay, ClassificationDisplay)
4. Simplificar lógica de selección (ahora está en el componente)

**Resultado:**
- ~616 líneas → ~450 líneas (-25%)
- Selección múltiple estandarizada
- Visual consistente con MovimientosTable

**Tiempo:** 2 horas

---

#### 2.2 ClasificarMovimientosPage

**Cambios:**
1. Tabla principal: Usar `SelectableDataTable`
2. Modal de lote: Usar `SelectableDataTable` también
3. Aplicar helpers en ambas tablas
4. Considerar extraer a organismo `BatchClassificationTable`

**Resultado:**
- ~767 líneas → ~580 líneas (-25%)
- 2 tablas con selección estandarizada
- Menos código duplicado

**Tiempo:** 2.5 horas

---

**Total FASE 2:** ~4.5 horas

---

### FASE 3: Conciliación (Alineación)

#### 3.1 ConciliacionPage

**Cambios:**
1. Envolver headers en `TableHeaderCell`
2. Usar `monedaColumn` helpers donde aplique
3. Mantener `headerGroups` (está bien así)
4. Considerar extraer a `ConciliacionSummaryTable` (opcional)

**Resultado:**
- Headers consistentes
- Mismo patrón que otras tablas
- Sin cambios funcionales

**Tiempo:** 1.5 horas

---

#### 3.2 MatchingTable

**Decisión final:** **NO REFACTORIZAR**

**Justificación:**
- 641 líneas de lógica única y especializada
- No se reutiliza en ningún otro lado
- Complejidad del matching justifica implementación custom
- Funciona bien

**Acción:** Solo validar que sigue buenas prácticas internas (TableHeaderCell, etc.)

**Tiempo:** 30 min (revisión)

---

**Total FASE 3:** ~2 horas

---

### FASE 4: Reportes Drilldown (Mayor Impacto)

#### 4.1 Reporte Egresos por Tercero (Base)

**Estrategia:** Usar este como base para crear DrilldownTable

**Cambios:**
1. Nivel 1 (Terceros): Usar `DrilldownTable`
2. Modal nivel 2 (Centros Costo): Usar `DrilldownTable`
3. Modal nivel 3 (Conceptos): Usar `DrilldownTable`
4. Modal movimientos: Usar `MovimientosDetailModal`

**Resultado:**
- ~492 líneas → ~180 líneas (-63%)
- Código altamente reutilizable
- Base para otros 2 reportes

**Tiempo:** 2.5 horas

---

#### 4.2 Reporte Egresos por Centro Costo

**Cambios:**
- Reemplazar todas las tablas inline por componentes reutilizables
- Casi copy-paste de Egresos por Tercero

**Resultado:**
- ~490 líneas → ~180 líneas (-63%)

**Tiempo:** 1.5 horas

---

#### 4.3 Reporte Ingresos y Gastos por Mes

**Cambios:**
- Similar a los anteriores
- Nivel inicial diferente (Mes en lugar de Tercero)

**Resultado:**
- ~483 líneas → ~190 líneas (-61%)

**Tiempo:** 1.5 horas

---

**Total FASE 4:** ~5.5 horas

---

## ⏱️ RESUMEN TOTAL

| Fase | Descripción | Tiempo |
|------|-------------|--------|
| Fase 0 | Validación MovimientosTable | 0.5h |
| Fase 1 | Componentes base (3 moléculas + helpers) | 7.5h |
| Fase 2 | Clasificación (2 páginas) | 4.5h |
| Fase 3 | Conciliación (1 página + validación) | 2h |
| Fase 4 | Reportes drilldown (3 páginas) | 5.5h |
| **TOTAL** | **7 páginas refactorizadas + 3 componentes nuevos** | **20h** |

---

## 📦 Componentes a Crear (Inventario Final)

### Átomos
- [x] TableHeaderCell (existe)
- [x] columnHelpers base (existe)
- [ ] **selectionColumn** helper (nuevo)
- [ ] **badgeColumn** helper (nuevo)

### Moléculas
- [x] DataTable (existe)
- [x] EntityDisplay (existe)
- [x] ClassificationDisplay (existe)
- [ ] **SelectableDataTable** (nuevo) - ⭐ Alta prioridad
- [ ] **DrilldownTable** (nuevo) - ⭐ Alta prioridad
- [ ] **MovimientosDetailModal** (nuevo) - ⭐ Alta prioridad

### Organismos
- [x] MovimientosTable (existe - referencia)
- [ ] ConciliacionSummaryTable (opcional)
- [ ] BatchClassificationTable (opcional)

---

## ✅ Criterios de Éxito Global

Al finalizar, TODA la aplicación debe cumplir:

### Consistencia Visual
- ✅ 100% de headers usan `TableHeaderCell`
- ✅ 100% de columnas tipadas usan column helpers
- ✅ 0 estilos inline duplicados
- ✅ Look & feel idéntico entre tablas

### Arquitectura
- ✅ Máximo 3 moléculas de tabla (DataTable, Selectable, Drilldown)
- ✅ Cero duplicación de lógica de selección
- ✅ Cero duplicación de modales
- ✅ Jerarquía átomo → molécula → organismo clara

### Código
- ✅ Reducción de ~30-60% en páginas refactorizadas
- ✅ Componentes reutilizables con mínimo 2 usos
- ✅ Type-safety 100%
- ✅ Performance igual o mejor

---

## 🚀 Propuesta de Ejecución

### Opción A: **Secuencial Completa** (Recomendada)
1. Fase 1 → Crear los 3 componentes base
2. Fase 2 → Aplicar en clasificación
3. Fase 3 → Alinear conciliación
4. Fase 4 → Transformar reportes

**Ventaja:** Base sólida, cada fase build sobre la anterior  
**Tiempo:** 4 semanas (5h/semana)

---

### Opción B: **Quick Win First**
1. Fase 1.2.A → Crear solo SelectableDataTable
2. Fase 2 → Aplicar en 2 páginas clasificación (impacto visual)
3. Fase 1.2.B+C → Crear resto de componentes
4. Fase 4 → Reportes
5. Fase 3 → Conciliación

**Ventaja:** Victoria rápida, impacto visible en 1 semana  
**Tiempo:** 4 semanas

---

### Opción C: **Paralelo (Solo si hay 2+ developers)**
- Dev 1: Componentes base (Fase 1)
- Dev 2: Clasificación con componentes stub (Fase 2)
- Merge: Semana 2

**Ventaja:** 50% más rápido  
**Tiempo:** 2 semanas  
**Riesgo:** Requiere coordinación

---

## 💡 Mi Recomendación

**Opción A - Secuencial**, Fase por Fase:

**Semana 1:**
- Fase 1: Crear SelectableDataTable + helpers de selección
- Probar en componente aislado

**Semana 2:**
- Fase 2.1: Reclasificar Movimientos (primera aplicación real)
- Validar que funciona perfectamente

**Semana 3:**
- Fase 2.2: Clasificar Movimientos
- Fase 3: Conciliación

**Semana 4:**
- Fase 1 (resto): DrilldownTable + MovimientosDetailModal
- Fase 4.1: Primer reporte

**Semana 5:**
- Fase 4.2 + 4.3: Otros 2 reportes
- Testing final QA

---

## 📝 Beneficios de Esta Visión Única

### Técnicos
- 🎯 **Una sola forma de hacer las cosas** - No más "¿cómo hago esto?"
- 📦 **3 componentes moleculares** cubren el 90% de casos de uso
- ♻️ **Reducción de ~1500 líneas de código** en total
- 🔧 **Mantenimiento centralizado** - 1 fix = todas las tablas

### De Negocio
- ⚡ **Desarrollo 75% más rápido** de nuevas tablas
- 🎨 **Experiencia de usuario consistente** en toda la app
- 🐛 **Menos bugs** por código centralizado
- 📚 **Onboarding simplificado** para nuevos desarrolladores

### A Futuro
- 🚀 **Escalabilidad** - Agregar features en minutos, no horas
- 🔄 **Cambios globales** - Ej: cambiar estilo de headers everywhere
- 📊 **Metrics** - Una tabla = sabemos exactamente cómo se usa
- 🎓 **Knowledge base** - Documentación viva

---

## ❓ Siguiente Paso

**¿Estás de acuerdo con esta visión unificada?**

Si sí, propongo:

1. ✅ **Validar que MovimientosTable** es realmente el estándar que queremos
2. 🚀 **Comenzar con Fase 1** - Crear SelectableDataTable
3. 🎯 **Aplicar inmediatamente** en ReclasificarMovimientos para validar

¿Te parece? ¿O prefieres ajustar algo del plan?
