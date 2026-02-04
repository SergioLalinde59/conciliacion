# 🔄 Decisión de Refactorización: MatchingTable

> **Evaluación Post-Análisis** de MatchingTable para refactor Opción B
>
> **Fecha:** 2026-02-03  
> **Archivo:** `components/organisms/MatchingTable.tsx`  
> **Líneas:** 641

---

## 🔍 Hallazgo Importante

Después de analizar el código completo de MatchingTable, encontré que **NO usa el componente DataTable**. 

En cambio, usa una **tabla HTML nativa** (`<table>`) con lógica altamente especializada:

```typescript
<table className="w-full">
    <thead>
        <tr>
            <th>Estado</th>
            <th colSpan={5}>Extracto Bancario</th>  {/* ← Dual column */}
            <th colSpan={5}>Sistema</th>            {/* ← Dual column */}
            <th>Diferencia</th>
            <th>Acciones</th>
        </tr>
        <tr>
            {/* Sub-headers con ordenamiento */}
        </tr>
    </thead>
    <tbody>
        {/* Filas con expansión para scores */}
    </tbody>
</table>
```

---

## 📊 Características Únicas

| Feature | Implementación | Tipo |
|---------|---------------|------|
| **Estructura** | `<table>` HTML nativo | Custom |
| ** Dual-column layout** | `colSpan` en headers | No estándar |
| **Expandible** | `expandedRows` state | Custom |
| **Ordenamiento** | `sortColumn` + función custom | Custom |
| **Filtrado visual** | Chips de estado | Custom |
| **Score breakdown** | Fila expandida con detalles | Único |
| **Acciones contextuales** | Según estado del match | Complejo |
| **Color coding** | Por valor (positivo/negativo/cero) | Custom |

---

## 🎯 Oportunidades de Refactor

### ❌ Lo que NO podemos refactorizar

1. **No usar DataTable** - La estructura dual-column no es compatible
2. **No usar column helpers** - No hay definición de `Column[]`
3. **No usar TableHeaderCell** - Los headers tienen doble nivel (`colSpan`)
4. **No mover acciones** - Ya están en posición lógica (extremo derecho)

### ✅ Lo que SÍ podemos mejorar

#### Opción 1: Refactor de Funciones Helper (Bajo Impacto)

**Antes:**
```typescript
const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value)
}

const formatUSD = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-'
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    }).format(value)
}

const formatTRM = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-'
    return new Intl.NumberFormat('es-CO', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value)
}
```

**Después:**
```typescript
import { formatMoney, formatNumber } from '../../utils/formatters'

// Eliminar formatCurrency, formatUSD, formatTRM
// Usar directamente formatMoney('COP', value), formatMoney('USD', value)
```

**Reducción estimada:** ~30 líneas (-5%)

#### Opción 2: Documentar como "Tabla Especializada - Excepción" (Recomendada)

Crear documento oficial que:
1. Explica POR QUÉ esta tabla es diferente
2. Documenta los patrones custom que usa
3. Establece que es una **excepción válida** al estándar
4. Define cuándo está bien crear tablas custom similares

**Beneficios:**
- ✅ Cero riesgo de romper funcionalidad
- ✅ Claridad para futuros desarrolladores
- ✅ Establece precedente para otras tablas especializadas
- ✅ Ahorra tiempo (0 horas vs 2-3 horas)

---

## 🤔 Análisis Costo-Beneficio

### Opción 1: Refactor Funciones Helper

| Aspecto | Valor |
|---------|-------|
| **Tiempo** | 1-2 horas |
| **Riesgo** | Bajo-Medio |
| **Reducción de código** | ~30 líneas (-5%) |
| **Mejora de mantenibilidad** | Mínima |
| **ROI** | **Bajo** |

### Opción 2: Documentar como Excepción ✅

| Aspecto | Valor |
|---------|-------|
| **Tiempo** | 30 minutos |
| **Riesgo** | **Cero** |
| **Reducción de código** | 0 líneas |
| **Mejora de mantenibilidad** | **Alta** (claridad) |
| **ROI** | **Alto** |

---

## 💡 Recomendación Final

### **Opción 2: Documentar como Excepción**

**Razones:**

1. **Tabla altamente especializada** - No sigue el patrón DataTable estándar
2. **Estructura única** - Dual-column con `colSpan` no es reutilizable
3. **Funcionalidad compleja** - Expandible, scoring, filtrado visual
4. **Bajo ROI de refactor** - Solo 5% reducción por mucho esfuerzo
5. **Riesgo innecesario** - Funciona perfectamente como está

### Lo que SÍ haremos:

✅ Crear documento `EXCEPCION-MatchingTable.md` que explique:
- Por qué es diferente
- Qué patrones custom usa
- Cuándo está bien crear tablas similares
- Guía de mantenimiento

✅ Agregar comentarios en el código clarificando la arquitectura

✅ Mantener pruebas de funcionalidad existentes

---

## 📝 Documento de Excepción a Crear

```markdown
# ⚠️ Excepción: MatchingTable

**Tipo:** Tabla Custom HTML (No usa DataTable)  
**Razón:** Dual-column layout con lógica de matching especializada  
**Estado:** Aprobada como excepción permanente

## ¿Por qué es diferente?

MatchingTable requiere:
1. Dual-column layout (Extracto vs Sistema)
2. Headers con colSpan
3. Filas expandibles con scoring details
4. Ordenamiento custom multi-columna
5. Filtrado visual por estado
6. Acciones contextuales según estado

Ninguna de estas features es compatible con el patrón DataTable estándar.

## ¿Cuándo está bien crear tablas custom similares?

✅ SÍ crear custom si:
- Necesitas dual/multi-column comparison
- Layout con colSpan/rowSpan complejo
- Interactividad muy específica (expansión con scoring)
- Performance crítica con 1000s de filas

❌ NO crear custom si:
- Es una tabla simple de 1 registro = 1 fila
- Solo necesitas ordenamiento/filtrado básico
- Puedes usar column helpers estándar

## Mantenimiento

- Mantener funciones helper locales (formatCurrency, etc.)
- NO intentar refactorizar a DataTable
- Documentar cualquier cambio de lógica de matching
```

---

## 🚀 Plan de Acción

1. **AHORA:** Crear documento `EXCEPCION-MatchingTable.md`  
2. **AHORA:** Agregar comentarios explicativos en `MatchingTable.tsx`  
3. **DESPUÉS:** Continuar con refactor de otras tablas estándar

---

## ✅ Decisión

**MatchingTable se marca como EXCEPCIÓN APROBADA al estándar de DataTables**

**No se refactorizará** - Se documentará su arquitectura única para futura referencia.

**Tiempo ahorrado:** 2-3 horas que se pueden usar en otras tablas con mayor ROI.

---

**Próxima acción:** ¿Proceder a crear el documento de excepción y continuar con otras tablas?
