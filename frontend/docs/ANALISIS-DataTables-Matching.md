# 📊 DataTables en Matching Inteligente

> **Análisis de las DataTables** presentes en la página de Matching Inteligente
>
> **Fecha:** 2026-02-03  
> **Página:** `ConciliacionMatchingPage.tsx`  
> **Total de DataTables:** 2

---

## 🎯 Resumen Ejecutivo

La página de **Matching Inteligente** contiene **2 DataTables principales**:

1. **MatchingTable** - Tabla principal de matching (641 líneas) 🔴 **SUPER COMPLEJA**
2. **UnmatchedSystemTable** - Registros en tránsito (150 líneas) ✅ **SIMPLE**

---

## 📋 DataTable 1: MatchingTable

**Archivo:** `components/organisms/MatchingTable.tsx`  
**Líneas:** 641 líneas  
**Complejidad:** 🔴 **SUPER ALTA**  
**Prioridad:** 🟡 **MEDIA-BAJA** (Es altamente especializada)

### Características

- ✅ **YA usa DataTable** - No necesita refactor de componente base
- ✅ **NO usa column helpers** - Gran oportunidad de mejora
- ❌ **Estilos inline masivos** - Duplicación de código
- ❌ **Lógica compleja** - Tabla customizada con muchas features

### Estructura Actual

```typescript
export const MatchingTable = ({
    matches,
    selectedEstados,
    onEstadosChange,
    onLimpiar,
    onAprobar,
    onAprobarTodo,
    onCrear,
    onCrearTodo,
    onDesvincular,
    onDesvincularTodo,
    loading = false,
    className = ''
}: MatchingTableProps) => {
    // State management
    const [expandedRows, setExpandedRows] = useState<Set<number | null>>(new Set())
    const [sortColumn, setSortColumn] = useState<SortColumn>('score')
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

    // ... 600+ líneas de lógica
}
```

### Funcionalidades Únicas

1. **Dual Column Layout** - Muestra extracto y sistema lado a lado
2. **Expandable Rows** - Filas expandibles con detalles
3. **Match Scoring** - Score visual de coincidencia
4. **Estado de Matching** - Badges de estado (OK, PROBABLE, SIN_MATCH, etc.)
5. **Ordenamiento Custom** - Por múltiples campos
6. **Filtrado por Estado** - Chips de filtro interactivos
7. **Acciones Masivas** - Aprobar todo, Crear todo, Desvincular todo
8. **Actions por Fila** - Aprobar, Crear, Desvincular

### Columnas (sin usar helpers)

| Columna | Tipo | Helper Posible | Impacto |
|---------|------|---------------|---------|
| Estado | Badge | `badgeColumn` | Alto |
| Fecha Extracto | Fecha | `fechaColumn` | Alto |
| Descripción Extracto | Texto | `textoColumn` | Medio |
| Valor Extracto | Moneda | `monedaColumn` | Alto |
| USD Extracto | Moneda | `monedaColumn` | Alto |
| TRM Extracto | Cifra | `cifraColumn` | Alto |
| Fecha Sistema | Fecha | `fechaColumn` | Alto |
| Descripción Sistema | Texto | `textoColumn` | Medio |
| Valor Sistema | Moneda | `monedaColumn` | Alto |
| USD Sistema | Moneda | `monedaColumn` | Alto |
| TRM Sistema | Cifra | `cifraColumn` | Alto |
| Diferencia | Cifra | `cifraColumn` | Alto |
| Score | Badge/Cifra | Custom | Alto |
| Actions | Custom | - | - |

**Total:** ~14 columnas que podrían usar helpers

---

### Evaluación vs Patrón Atómico

| Criterio | Estado | Cumplimiento |
|----------|--------|--------------|
| Usa DataTable (molécula) | ✅ | 100% |
| Usa TableHeaderCell | ❌ | 0% |
| Usa column helpers | ❌ | 0% |
| Usa EntityDisplay | ❌ | 0% |
| Usa ClassificationDisplay | ❌ | N/A |
| useMemo en columnas | ❌ | 0% |
| Estilos centralizados | ❌ | 0% |
| **TOTAL** | **14%** | 🔴 **Muy bajo** |

### Código Actual (Ejemplo)

```typescript
// ❌ SIN column helpers - Código inline
{
    key: 'fecha_extracto',
    header: 'FECHA',
    sortable: true,
    width: 'w-32',
    cellClassName: '!py-0.5',
    accessor: (row) => <span className="font-medium text-gray-900">{formatDate(row.mov_extracto.fecha)}</span>
},
{
    key: 'valor_extracto',
    header: 'VALOR',
    sortable: true,
    align: 'right',
    width: 'w-40',
    cellClassName: '!py-0.5',
    accessor: (row) => (
        <span className={getValueColor(row.mov_extracto.valor)}>
            {formatCurrency(row.mov_extracto.valor)}
        </span>
    )
}
```

### Código Ideal (Con helpers)

```typescript
// ✅ CON column helpers - Centralizado
fechaColumn<MovimientoMatch>(
    'fecha_extracto',
    <TableHeaderCell>Fecha</TableHeaderCell>,
    row => row.mov_extracto.fecha,
    { width: 'w-32' }
),
monedaColumn<MovimientoMatch>(
    'valor_extracto',
    <TableHeaderCell>Valor</TableHeaderCell>,
    row => row.mov_extracto.valor,
    'COP',
    { width: 'w-40' }
)
```

**Reducción estimada:** ~250 líneas (40%)

---

## 📋 DataTable 2: UnmatchedSystemTable

**Archivo:** `components/organisms/UnmatchedSystemTable.tsx`  
**Líneas:** 150 líneas  
**Complejidad:** 🟢 **BAJA**  
**Prioridad:** 🟢 **ALTA** (Fácil y rápida)

### Características

- ✅ **YA usa DataTable** correctamente
- ✅ **Structure simple** - No tiene lógica compleja
- ❌ **NO usa column helpers** - Pero sería fácil aplicarlos
- ❌ **NO usa TableHeaderCell** - Headers en mayúsculas directas
- ✅ **Acciones a la derecha** - Necesita mover a la izquierda (estándar)

### Estructura Actual

```typescript
export const UnmatchedSystemTable = ({ records, onEdit, onDelete }: UnmatchedSystemTableProps) => {
    // Cálculos simples
    const { totalIngresos, totalEgresos, totalNeto } = useMemo(() => {
        const ingresos = records.reduce((sum, row) => sum + (Number(row.valor) > 0 ? Number(row.valor) : 0), 0)
        const egresos = records.reduce((sum, row) => sum + (Number(row.valor) < 0 ? Number(row.valor) : 0), 0)
        return { totalIngresos: ingresos, totalEgresos: egresos, totalNeto: ingresos + egresos }
    }, [records])

    // Columnas (22-104)
    const columns: Column<any>[] = useMemo(() => [...], [onEdit, onDelete])

    return (
        <div>
            {/* Header con estadísticas */}
            <DataTable data={records} columns={columns} ... />
            {/* Footer */}
        </div>
    )
}
```

### Columnas (6 columnas)

| # | Columna | Tipo | Helper Ideal | Impacto | Líneas Actuales | Líneas Con Helper |
|---|---------|------|--------------|---------|-----------------|-------------------|
| 1 | Fecha | Fecha | `fechaColumn` | Alto | 7 | 5 |
| 2 | Tercero | Texto | `textoColumn` | Medio | 7 | 5 |
| 3 | Descripción | Texto | `textoColumn` | Medio | 7 | 5 |
| 4 | Referencia | Texto | `textoColumn` | Medio | 7 | 5 |
| 5 | Valor | Moneda | `monedaColumn` | Alto | 13 | 6 |
| 6 | Acciones | Custom | - | - | 30 | 25 (mover) |

**Reducción estimada:** ~25 líneas (25%)

---

### Evaluación vs Patrón Atómico

| Criterio | Estado | Cumplimiento |
|----------|--------|--------------|
| Usa DataTable (molécula) | ✅ | 100% |
| Usa TableHeaderCell | ❌ | 0% |
| Usa column helpers | ❌ | 0% |
| useMemo en columnas | ✅ | 100% |
| Acciones a la izquierda | ❌ | 0% |
| Headers en mayúsculas | ❌ | Incorrecto |
| **TOTAL** | **40%** | 🟡 **Medio** |

### Issues Identificados

1. ❌ **Headers en MAYÚSCULAS directas**
   ```typescript
   // ❌ MAL - Headers hardcoded en mayúsculas
   header: 'FECHA'
   header: 'TERCERO'
   header: 'DESCRIPCIÓN'
   ```

   **Debería ser:**
   ```typescript
   // ✅ BIEN - TableHeaderCell con capitalize automático
   header: <TableHeaderCell>Fecha</TableHeaderCell>
   header: <TableHeaderCell>Tercero</TableHeaderCell>
   header: <TableHeaderCell>Descripción</TableHeaderCell>
   ```

2. ❌ **Acciones al final**
   ```typescript
   // ❌ MAL - Acciones como última columna
   const columns = [
       fechaColumn,
       terceroColumn,
       // ...
       actionsColumn  // ← Al final
   ]
   ```

   **Debería ser:**
   ```typescript
   // ✅ BIEN - Acciones al inicio
   const columns = [
       actionsColumn,  // ← Primera columna
       fechaColumn,
       terceroColumn,
       // ...
   ]
   ```

---

## 📊 Comparación de Complejidad

| Aspecto | MatchingTable | UnmatchedSystemTable |
|---------|---------------|---------------------|
| **Líneas de código** | 641 | 150 |
| **Columnas** | ~14 | 6 |
| **Lógica de negocio** | Muy compleja | Simple |
| **State management** | Alto | Bajo |
| **Tiempo de refactor** | 6-8 horas | 30 minutos |
| **ROI de refactorización** | Medio | Alto |
| **Prioridad** | Media-Baja | Alta |

---

## 🎯 Recomendaciones de Refactorización

### Orden Sugerido

1. **UnmatchedSystemTable** (30 min) 🟢
   - ✅ Fácil y rápida
   - ✅ Alto ROI
   - ✅ Valida el patrón en contexto de Matching
   
2. **MatchingTable** (6-8 horas) 🟡
   - ⚠️ Compleja pero efectiva
   - ⚠️ Muchas columnas = muchos helpers
   - ⚠️ Requiere análisis cuidadoso

---

## 📋 Plan de Acción para UnmatchedSystemTable

### Cambios a Realizar

1. **Import column helpers**
   ```typescript
   import { fechaColumn, textoColumn, monedaColumn } from '../atoms/columnHelpers'
   import { TableHeaderCell } from '../atoms/TableHeaderCell'
   ```

2. **Mover columna de acciones al inicio**
   ```typescript
   const columns = [
       actionsColumn,     // ← Mover aquí
       fechaColumn(...),
       // ... resto
   ]
   ```

3. **Reemplazar columnas con helpers**
   - Fecha → `fechaColumn`
   - Tercero → `textoColumn`
   - Descripción → `textoColumn`
   - Referencia → `textoColumn`
   - Valor → `monedaColumn`

4. **Actualizar headers con TableHeaderCell**
   - Todos los headers en MAYÚSCULAS → TableHeaderCell con capitalize

### Estimación

| Tarea | Tiempo |
|-------|--------|
| Refactor columnas | 15 min |
| Mover acciones | 5 min |
| Testing | 5 min |
| Documentación | 5 min |
| **TOTAL** | **30 min** |

---

## 📋 Plan de Acción para MatchingTable (Futuro)

### Consideraciones Especiales

MatchingTable es una tabla **altamente especializada** con lógica de negocio compleja:

1. **Dual-column design** - Extracto y Sistema lado a lado
2. **Expandable rows** - Detalles adicionales
3. **Color coding** - Por score de matching
4. **Multiple states** - Badges dinámicos
5. **Custom sorting** - Por score, fecha, estado

### Estrategia Recomendada

**Opción A: Refactor Completo** (6-8 horas)
- Aplicar todos los column helpers
- Mantener lógica de negocio
- **Riesgo:** Medio-Alto
- **Beneficio:** Consistencia total

**Opción B: Refactor Parcial** (2-3 horas)
- Solo columnas de fecha, moneda, cifra
- Mantener customs (estado, score, diferencia)
- **Riesgo:** Bajo
- **Beneficio:** Mejora significativa con bajo riesgo

**Opción C: Mantener Actual** (0 horas)
- Marcar como "Especializada - Excepción"
- Documentar patrones especiales
- **Riesgo:** Cero
- **Beneficio:** Cero

### Recomendación: **Opción B - Refactor Parcial**

Aplicar helpers solo en columnas estándar:
- ✅ `fechaColumn` para fechas extracto/sistema
- ✅ `monedaColumn` para valores extracto/sistema
- ✅ `cifraColumn` para TRM y diferencias
- ❌ Mantener custom para estado, score, expandible

**Reducción estimada:** ~150 líneas (25%) con riesgo bajo

---

## 🚀 Decisión Final

### Empezar con UnmatchedSystemTable

**Razones:**
1. ✅ Tabla simple y directa (150 líneas)
2. ✅ Alto ROI (25% reducción en 30 min)
3. ✅ valida el patrón en contexto de Matching
4. ✅ Riesgo bajo, impacto alto
5. ✅ Sigue el estándar de "acciones a la izquierda"

**Próximos pasos:**
1. Refactorizar UnmatchedSystemTable (30 min)
2. Evaluar resultados
3. Decidir sobre MatchingTable (Opción B recomendada)

---

## 📝 Notas Importantes

### MatchingTable es Especial

Esta tabla tiene características únicas que la hacen diferente:

1. **Dual Layout** - No es una tabla simple de 1 registro = 1 fila
2. **Expansión** - Filas expandibles con detalles adicionales
3. **Scoring Visual** - Barra de score + color coding
4. **Estado Dinámico** - Badges que cambian según lógica
5. **Acciones Contextuales** - Diferentes según estado

**No todas las tablas deben seguir el patrón 100%**. MatchingTable es un candidato para **"Excepción Documentada"**.

### Filosofía de Refactorización

> "Mejora incremental > Perfección absoluta"

- ✅ Refactorizar lo que es fácil y de alto impacto
- ⚠️ Ser pragmático con código complejo y especializado
- ✅ Documentar excepciones y razones

---

**Conclusión:** Empezar con UnmatchedSystemTable para validar el patrón en contexto de Matching.
