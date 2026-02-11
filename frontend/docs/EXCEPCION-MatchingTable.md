# ⚠️ EXCEPCIÓN APROBADA: MatchingTable

> **Tabla Custom HTML** que NO sigue el patrón estándar de DataTable  
> **Estado:** ✅ Aprobada como excepción permanente  
> **Razón:** Arquitectura dual-column con lógica de matching especializada  
> **Fecha de aprobación:** 2026-02-03

---

## 📋 Información General

| Propiedad | Valor |
|-----------|-------|
| **Archivo** | `components/organisms/MatchingTable.tsx` |
| **Líneas** | 641 |
| **Tipo** | Tabla HTML nativa (`<table>`) |
| **Usa DataTable** | ❌ No |
| **Usa Column Helpers** | ❌ No |
| **Usa TableHeaderCell** | ❌ No |
| **Patrón** | Custom HTML con lógica especializada |
| **Estado** | ✅ **EXCEPCIÓN APROBADA** |

---

## 🎯 ¿Por Qué es una Excepción?

MatchingTable tiene requisitos únicos que son **incompatibles** con el patrón estándar de DataTable:

### 1. **Dual-Column Layout**

Muestra datos de **dos fuentes lado a lado** para comparación:

```
┌──────────┬─────────────────────────────┬─────────────────────────────┬────────────┐
│  Estado  │    EXTRACTO BANCARIO        │         SISTEMA            │ Diferencia │
│          ├──────┬──────┬───────┬───┬───┼──────┬──────┬───────┬───┬───┤            │
│          │ Fecha│ Desc │ Valor │USD│TRM│ Fecha│ Desc │ Valor │USD│TRM│            │
├──────────┼──────┼──────┼───────┼───┼───┼──────┼──────┼───────┼───┼───┼────────────┤
│ PROBABLE │ ...  │ ...  │ ...   │...│...│ ...  │ ...  │ ...   │...│...│    $0      │
└──────────┴──────┴──────┴───────┴───┴───┴──────┴──────┴───────┴───┴───┴────────────┘
```

**HTML:**
```typescript
<thead>
    <tr>
        <th>Estado</th>
        <th colSpan={5}>Extracto Bancario</th>  {/* ← colSpan! */}
        <th colSpan={5}>Sistema</th>            {/* ← colSpan! */}
        <th>Diferencia</th>
    </tr>
    <tr>
        {/* Sub-headers individuales para cada columna */}
        <th>Fecha</th>
        <th>Descripción</th>
        <th>Valor</th>
        <th>USD</th>
        <th>TRM</th>
        {/* ... sistema columns */}
    </tr>
</thead>
```

**🚫 DataTable NO soporta `colSpan` en headers.**

---

### 2. **Filas Expandibles con Score Breakdown**

Cada fila puede expandirse para mostrar detalles de scoring:

```typescript
{isExpanded && (
    <tr className="bg-gray-50">
        <td colSpan={13}>
            <div>
                <div>Scores de Similitud:</div>
                <div>Fecha: {score_fecha}%</div>
                <div>Valor: {score_valor}%</div>
                <div>Descripción: {score_descripcion}%</div>
                <div>Total: {score_total}%</div>
            </div>
        </td>
    </tr>
)}
```

**State management:**
```typescript
const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

const toggleRow = (matchId: number) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(matchId)) {
        newExpanded.delete(matchId)
    } else {
        newExpanded.add(matchId)
    }
    setExpandedRows(newExpanded)
}
```

**🚫 DataTable tiene soporte limitado para filas expandibles custom.**

---

### 3. **Ordenamiento Custom Multi-Columna**

Permite ordenar por **cualquier columna** de extracto o sistema:

```typescript
type SortColumn = 
    | 'extracto_fecha' | 'extracto_descripcion' | 'extracto_valor' | 'extracto_usd' | 'extracto_trm'
    | 'sistema_fecha' | 'sistema_descripcion' | 'sistema_valor' | 'sistema_usd' | 'sistema_trm'
    | 'diferencia' | null

const getSortedMatches = () => {
    if (!sortColumn) return matches

    return [...matches].sort((a, b) => {
        let aVal, bVal
        switch (sortColumn) {
            case 'extracto_fecha':
                aVal = new Date(a.mov_extracto.fecha).getTime()
                bVal = new Date(b.mov_extracto.fecha).getTime()
                break
            case 'sistema_valor':
                aVal = a.mov_sistema?.valor || 0
                bVal = b.mov_sistema?.valor || 0
                break
            // ... 10 more cases
        }
        // ...
    })
}
```

**Headers con sorting:**
```typescript
<th onClick={() => handleSort('extracto_valor')}>
    <div>
        Valor
        <SortIcon column="extracto_valor" />
    </div>
</th>
```

**🚫 DataTable tiene sorting, pero no tan granular para dual-columns.**

---

### 4. **Filtrado Visual por Estado**

Chips interactivos que filtran matches por estado:

```typescript
const estadosOptions = [
    { value: MatchEstado.SIN_MATCH, label: 'Sin Match', color: 'gray' },
    { value: MatchEstado.PROBABLE, label: 'Probable', color: 'amber' },
    { value: MatchEstado.OK, label: 'OK', color: 'emerald' }
]

// Chips en header
{estadosOptions.map(({ value, label, color }) => (
    <button
        onClick={() => toggleEstado(value)}
        className={isSelected ? 'bg-{color}-100' : 'bg-white'}
    >
        {label}
    </button>
))}
```

**Filtrado aplicado:**
```typescript
const matchesFiltrados = useMemo(() => {
    if (selectedEstados.length > 0) {
        return matches.filter(m => selectedEstados.includes(m.estado))
    }
    return matches
}, [matches, selectedEstados])
```

**✅ DataTable tiene filtrado, pero esta UI es custom.**

---

### 5. **Acciones Contextuales según Estado**

Diferentes botones según el estado del match:

| Estado | Acciones Disponibles |
|--------|---------------------|
| **PROBABLE** | ✅ Aprobar, 🔗 Desvincular, 👁️ Ver detalles |
| **SIN_MATCH** | ➕ Crear movimiento |
| **OK** | 🔗 Desvincular, 👁️ Ver detalles |

```typescript
{/* Aprobar (solo PROBABLE) */}
{match.estado === MatchEstado.PROBABLE && onAprobar && (
    <Button onClick={() => onAprobar(match)}>
        <Icon name="Check" />
    </Button>
)}

{/* Crear (solo SIN_MATCH sin sistema) */}
{match.estado === MatchEstado.SIN_MATCH && onCrear && (
    <Button onClick={() => onCrear(match)}>
        <Icon name="Check" />
    </Button>
)}

{/* Desvincular (solo si tiene sistema) */}
{hasSystemMovement && onDesvincular && (
    <Button onClick={() => onDesvincular(match)}>
        <Icon name="Unlink" />
    </Button>
)}
```

**✅ DataTable soporta acciones custom, pero esta lógica es muy específica.**

---

### 6. **Color Coding Inteligente**

Valores se colorean según sean positivos/negativos/cero:

```typescript
const getValueColor = (value: number): string => {
    if (value > 0) return 'text-green-600'   // Ingresos
    if (value < 0) return 'text-red-600'     // Egresos
    return 'text-blue-600'                    // Neutral
}

// Aplicado a celdas
<td className={getValueColor(match.mov_extracto.valor)}>
    {formatCurrency(match.mov_extracto.valor)}
</td>
```

**✅ DataTable soporta custom rendering, pero esto es muy específico.**

---

## 📐 Arquitectura Actual

### Componentes

```
MatchingTable
├── Props
│   ├── matches: MovimientoMatch[]
│   ├── selectedEstados: MatchEstado[]
│   ├── onEstadosChange: (estados) => void
│   ├── onAprobar?: (match) => void
│   ├── onCrear?: (match) => void
│   ├── onDesvincular?: (match) => void
│   └── onAprobarTodo, onCrearTodo, onDesvincularTodo
│
├── State
│   ├── expandedRows: Set<number>        // Filas expandidas
│   ├── sortColumn: SortColumn           // Columna de ordenamiento
│   └── sortDirection: 'asc' | 'desc'    // Dirección de ordenamiento
│
├── Funciones Helper
│   ├── formatDate(date)                 // Formato DD/MM/YYYY
│   ├── formatCurrency(value)            // Formato $123,456
│   ├── formatUSD(value)                 // Formato $123.45 USD
│   ├── formatTRM(value)                 // Formato 1,234.56
│   ├── formatDifference(value)          // Formato $123.45 (2 decimales)
│   └── getValueColor(value)             // Color según signo
│
├── Render
│   ├── Loading state
│   ├── Header con filtros (chips de estado)
│   ├── Acciones masivas (Aprobar todo, Crear todo, Desvincular todo)
│   ├── Tabla HTML
│   │   ├── Headers con colSpan
│   │   ├── Sub-headers con sorting
│   │   └── Cuerpo con filas + expandible
│   └── Empty state
```

---

## ✅ ¿Cuándo Está Bien Crear Tablas Custom como Esta?

### SÍ crear tabla custom cuando:

1. ✅ **Dual/Multi-column comparison**
   - Necesitas mostrar datos de 2+ fuentes lado a lado
   - Comparación visual es crítica para la UX

2. ✅ **Layout complejo con colSpan/rowSpan**
   - Headers multinivel
   - Agrupación visual de columnas
   - Celdas que abarcan múltiples filas

3. ✅ **Interactividad muy específica**
   - Filas expandibles con contenido custom (como score breakdown)
   - Acciones que cambian dinámicamente según estado
   - Drag & drop entre filas

4. ✅ **Performance crítica**
   - 1000s de filas con virtualización custom
   - Rendering optimizado específico del dominio

5. ✅ **Lógica de negocio única**
   - Matching, scoring, comparación automática
   - Algoritmos específicos de la industria

---

### ❌ NO crear tabla custom cuando:

1. ❌ **Tabla simple 1 registro = 1 fila**
   - Usa DataTable + column helpers

2. ❌ **Solo necesitas ordenamiento/filtrado básico**
   - DataTable ya lo tiene built-in

3. ❌ **Puedes usar column helpers estándar**
   - fechaColumn, monedaColumn, textoColumn, etc.

4. ❌ **No hay lógica de negocio compleja**
   - CRUD simple, listados, reportes básicos

5. ❌ **El tiempo de desarrollo es crítico**
   - DataTable es 5x más rápido de implementar

---

## 🔧 Mantenimiento

### Reglas para Modificar MatchingTable

1. ✅ **Mantener funciones helper locales**
   - NO extraer a utils globales
   - Son específicas de matching

2. ✅ **Documentar cambios de lógica**
   - Cualquier cambio en scoring
   - Nuevos estados de match
   - Modificaciones a algoritmo

3. ❌ **NO intentar refactorizar a DataTable**
   - Ya evaluado y rechazado
   - Incompatibilidad estructural

4. ✅ **Agregar tests para lógica crítica**
   - Sorting multi-columna
   - Filtrado por estado
   - Cálculo de diferencias

5. ✅ **Optimizar performance si es necesario**
   - useMemo para cálculos pesados
   - useCallback para handlers
   - React.memo para sub-componentes

---

## 📊 Comparación con DataTable Estándar

| Aspecto | MatchingTable | DataTable Estándar |
|---------|---------------|-------------------|
| **Estructura** | HTML custom `<table>` | Componente DataTable |
| **Columnas** | Dual-column con colSpan | Single-record rows |
| **Headers** | Multinivel manual | TableHeaderCell |
| **Estilos** | Inline y custom | Column helpers |
| **Ordenamiento** | Función custom | Built-in |
| **Filtrado** | Chips custom | Prop-based |
| **Acciones** | Contextuales custom | Column-based |
| **Expansión** | State custom | Limited support |
| **Líneas de código** | 641 | ~150-200 típico |
| **Tiempo dev** | 3-4 días | 1 día |
| **Mantenibilidad** | Media | Alta |
| **Flexibilidad** | Altísima | Alta |
| **Consistencia** | Baja (custom) | Alta (patrón) |

---

## 🎓 Lecciones Aprendidas

### Por Qué Esta Excepción es Válida

1. **Requisitos únicos** - Dual-column comparison no es un caso común
2. **Lógica de negocio especializada** - Matching automático con scoring
3. **Performance ya optimizada** - Funciona bien como está
4. **Costo-beneficio negativo** - Refactor tomaría 3+ días sin beneficio real

### Cuándo Aplicar Este Precedente

Esta excepción establece que **está bien** crear tablas custom cuando:
- Los requisitos son genuinamente únicos
- DataTable no puede soportar la estructura
- El valor de negocio justifica el código custom
- La funcionalidad ya está probada y funciona

### Cuándo NO Aplicar

No uses esta excepción como justificación para:
- Evitar aprender el patrón DataTable
- "Reinventar la rueda" por preferencia personal
- Tablas simples que DataTable puede manejar
- Casos donde el patrón estándar funciona

---

## 📝 Ejemplo de Uso

```typescript
import { MatchingTable } from '@/components/organisms/MatchingTable'

<MatchingTable
    matches={matchingResult.matches}
    selectedEstados={[MatchEstado.SIN_MATCH, MatchEstado.PROBABLE]}
    onEstadosChange={setSelectedEstados}
    onLimpiar={() => setSelectedEstados([])}
    onAprobar={(match) => vincularMutation.mutate(match)}
    onCrear={(match) => createMovementsMutation.mutate([match])}
    onDesvincular={(match) => desvincularMutation.mutate(match.id)}
    onAprobarTodo={() => aprobarTodosMutation.mutate()}
    onCrearTodo={() => crearTodosMutation.mutate()}
    onDesvincularTodo={() => desvincularTodoMutation.mutate()}
    loading={isLoading}
/>
```

---

## 🚀 Alternativas Consideradas

### Opción A: Refactor Completo a DataTable
- **Tiempo:** 3-4 días
- **Riesgo:** Alto
- **Viabilidad:** ❌ Imposible (colSpan no soportado)

### Opción B: Refactor Parcial (funciones helper)
- **Tiempo:** 1-2 horas
- **Reducción:** ~5% (30 líneas)
- **ROI:** Bajo
- **Decisión:** ❌ Rechazado

### Opción C: Documentar como Excepción ✅
- **Tiempo:** 30 minutos
- **Riesgo:** Cero
- **Claridad:** Alta
- **Decisión:** ✅ **APROBADO**

---

## ✅ Conclusión

**MatchingTable es una EXCEPCIÓN VÁLIDA al patrón estándar de DataTables.**

**Aprobada por:**
- Requisitos únicos incompatibles con DataTable
- Lógica de negocio altamente especializada
- Funcionalidad existente probada y efectiva
- Análisis costo-beneficio negativo para refactor

**Estado:** ✅ **Aprobada como excepción permanente**

**Acción requerida:** Ninguna. Mantener como está.

**Documentación:** Este documento sirve como referencia oficial.

---

**Última actualización:** 2026-02-03  
**Próxima revisión:** Solo si cambian requisitos de matching
