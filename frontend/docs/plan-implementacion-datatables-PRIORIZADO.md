# 🎯 Plan PRIORIZADO: Refactorización DataTables - Páginas de Alto Valor

> **Plan Actualizado** enfocado en páginas de procesos de negocio principales
>
> **Fecha:** 2026-02-03  
> **Referencia:** `datatable-componentes.md`
> **Estrategia:** Mejorar primero donde hay más impacto

---

## 📊 Páginas Priorizadas (Alto Impacto de Negocio)

### Resumen de Análisis

| # | Página | DataTables | Líneas | Complejidad | Problemas Principales |
|---|---------|------------|--------|-------------|-----------------------|
| 1️⃣ | **Matching Inteligente** | MatchingTable (custom 641 líneas) + inline | 422 | ⭐⭐⭐⭐⭐ | - MatchingTable es compleja y especial<br>- ConciliacionPage tiene DataTable inline<br>- Headers no consistentes |
| 2️⃣ | **Reclasificar Movimientos** | 1 DataTable inline | 616 | ⭐⭐⭐⭐ | - DataTable inline complejo<br>- Sin TableHeaderCell<br>- Sin column helpers<br>- Lógica de selección múltiple |
| 3️⃣ | **Por Clasificar** | 1 DataTable inline | 767 | ⭐⭐⭐⭐ | - DataTable inline muy grande<br>- Sin TableHeaderCell<br>- Sin column helpers<br>- Modal con tabla adicional |
| 4️⃣ | **Egresos por Tercero** | 3 DataTables (Tercero + CentroCosto + Concepto) + Movimientos | 492 | ⭐⭐⭐ | - Tablas drilldown inline<br>- Estilos duplicados<br>- Sin helpers consistentes |
| 5️⃣ | **Egresos por Centro Costos** | 3 DataTables (CentroCosto + Tercero + Concepto) + Movimientos | 490 | ⭐⭐⭐ | - Casi idéntico a Egresos Tercero<br>- Oportunidad de componentización |
| 6️⃣ | **Ingresos y Gastos** | 3 DataTables (Mes + Tercero + CentroCosto/Concepto) + Movimientos | 483 | ⭐⭐⭐ | - Similar a otras reportes<br>- Drilldown complejo |

---

## 🎯 Nuevo Plan de Implementación

### Fase 1: Análisis y Componentes Base (1 sesión - 3 horas)

**Objetivo:** Definir componentes reutilizables para evitar duplicación

#### Actividades:

1. **Identificar Patrones Comunes**
   - ✅ Columna de selección (checkbox)
   - ✅ Formato de moneda
   - ✅ Formato de fecha
   - ✅ Drilldown pattern (reportes)
   - ✅ Modal de movimientos

2. **Crear Componentes Atómicos Faltantes**
   - [ ] `SelectionColumn` helper - Para checkboxes de selección
   - [ ] `BadgeColumn` helper - Para badges de estado

3. **Crear Componentes Moleculares Nuevos**
   - [ ] `SelectableDataTable` - DataTable con selección múltiple built-in
   - [ ] `MovimientosDetailModal` - Modal estandarizado de movimientos
   - [ ] `DrilldownTable` - Reutilizable para reportes drilldown

---

### Fase 2: Matching Inteligente (2-3 sesiones - 1.5 horas)

#### Página 1.1: `ConciliacionPage.tsx` 

**Estado actual:**
- DataTable inline con headers agrupados
- Usa `CurrencyDisplay` (átomo)
- Tiene headerGroups (buena práctica)
- ❌ Sin TableHeaderCell
- ❌ Sin column helpers

**Refactorización:**
```
Estimación: 1.5 horas
Prioridad: ALTA
Complejidad: ⭐⭐⭐
```

**Cambios requeridos:**
1. Envolver headers en `TableHeaderCell`
2. Considerar extraer a componente organismo: `ConciliacionSummaryTable`
3. Aplicar column helpers para moneda
4. Mantener headerGroups (están bien)

#### Página 1.2: `ConciliacionMatchingPage.tsx` (con MatchingTable)

**Estado actual:**
- Usa `MatchingTable` (641 líneas custom)
- Lógica altamente especializada
- Características únicas: estado de match, lado a lado extracto/sistema

**Decisión:**
```
⚠️ NO REFACTORIZAR MatchingTable por ahora
✅ Solo verificar que sigue buenas prácticas internas
```

**Razón:** La complejidad del matching justifica una implementación custom.

---

### Fase 3: Reclasificar Movimientos (1-2 sesiones - 2.5 horas)

#### Página: `ReclasificarMovimientosPage.tsx`

**Estado actual:**
- 616 líneas totales
- 1 DataTable inline complejo
- Lógica de selección múltiple manual
- ❌ Headers en MAYÚSCULAS sin TableHeaderCell
- ❌ Sin column helpers
- ❌ Estilos inline duplicados

**Refactorización:**
```
Estimación: 2.5 horas
Prioridad: ALTA
Complejidad: ⭐⭐⭐⭐
```

**Pasos:**

1. **Crear `SelectableDataTable` molécula** (nuevo componente reutilizable)
   - Maneja estado de selección interno
   - Props: `onSelectionChange`, `allowMultiple`
   - Incluye checkbox  en header y rows
   - ~80 líneas

2. **Refactorizar columnas**
   - Aplicar `TableHeaderCell` a todos los headers
   - Usar `fechaColumn` para fecha
   - Usar `monedaColumn` para valores
   - Usar `EntityDisplay` para tercero/cuenta
   - Usar `ClassificationDisplay` para clasificación

3. **Opcional: Extraer a organismo**
   - Evaluar si vale la pena extraer a `ReclasificacionMovimientosTable.tsx`
   - Considerar reutilización en otras páginas

**Beneficios:**
- Componente reutilizable de selección
- Código más limpio y mantenible
- Patrón replicable en otras páginas

---

### Fase 4: Por Clasificar (2 sesiones - 2.5 horas)

#### Página: `ClasificarMovimientosPage.tsx`

**Estado actual:**
- 767 líneas (la más grande)
- 1 DataTable principal inline
- 1 DataTable en modal de lote
- Lógica compleja de sugerencias
- ❌ Sin TableHeaderCell
- ❌ Sin column helpers

**Refactorización:**
```
Estimación: 2.5 horas
Prioridad: ALTA
Complejidad: ⭐⭐⭐⭐
```

**Pasos:**

1. **Reutilizar `SelectableDataTable`** (ya creado en Fase 3)

2. **Refactorizar DataTable principal**
   - Aplicar `TableHeaderCell`
   - Usar column helpers
   - Usar `EntityDisplay` y `ClassificationDisplay`

3. **Refactorizar DataTable del modal**
   - Mismos lineamientos
   - Podría ser un organismo separado: `BatchClassificationPreviewTable`

4. **Considerar extraer lógica**
   - Gran cantidad de lógica de negocio
   - Evaluar custom hooks para clasificación

---

### Fase 5: Reportes de Egresos (2-3 sesiones - 7.5 horas)

#### Patrón Común Identificado

Las 3 páginas de reportes comparten estructura casi idéntica:

1. **Tabla 1:** Datos agregados (Tercero/CentroCosto/Mes)
2. **Modal Drilldown 1:** Segundo nivel de detalle
3. **Modal Drilldown 2:** Tercer nivel de detalle  
4. **Modal Movimientos:** Detalle individual de movimientos

**Oportunidad:** Crear componentes reutilizables

#### Paso 5.1: Crear Componentes Maestros Reutilizables

**Nuevo componente:** `DrilldownReporteTable.tsx`

```typescript
interface DrilldownReporteTableProps<T> {
    data: T[]
    onDrilldown: (item: T) => void
    columns: DrilldownColumn<T>[]
    title: string
    // Más props para customización
}
```

**Nuevo componente:** `MovimientosDetailModal.tsx`

```typescript
interface MovimientosDetailModalProps {
    movimientos: Movimiento[]
    onClose: () => void
    title: string
    contextInfo?: {
        tercero?: string
        centroCosto?: string
        concepto?: string
        mes?: string
    }
}
```

**Estimación:** 3 horas para componentes base

#### Paso 5.2: Refactorizar Reportes

**Páginas a refactorizar:**
1. `ReporteEgresosTerceroPage.tsx`
2. `ReporteEgresosCentroCostoPage.tsx`
3. `ReporteIngresosGastosMesPage.tsx`

**Estrategia:**
- Usar componentes reutilizables recién creados
- Reducir ~60% del código duplicado
- Mantener lógica de negocio específica de cada reporte

**Estimación por página:** 1.5 horas

**Total Fase 5:** ~7.5 horas

---

## 📋 Resumen de Componentes a Crear

### Nivel Átomo (atoms/)

| Componente | Archivo | Descripción | Estimación |
|------------|---------|-------------|------------|
| SelectionColumn helper | `columnHelpers.tsx` | Helper para columnas de checkbox | 30 min |
| BadgeColumn helper | `columnHelpers.tsx` | Helper para badges de estado | 20 min |

### Nivel Molécula (molecules/)

| Componente | Archivo | Descripción | Estimación |
|------------|---------|-------------|------------|
| SelectableDataTable | `SelectableDataTable.tsx` | DataTable con selección múltiple | 2 horas |
| MovimientosDetailModal | `MovimientosDetailModal.tsx` | Modal estandarizado de movimientos | 2 horas |
| DrilldownTable | `DrilldownTable.tsx` | Tabla drilldown para reportes | 2 horas |

### Nivel Organismo (organisms/)

| Componente | Archivo | Descripción | Estimación |
|------------|---------|-------------|------------|
| ConciliacionSummaryTable | `ConciliacionSummaryTable.tsx` | Tabla resumen de conciliación | 1 hora |
| BatchClassificationPreviewTable | `BatchClassificationPreviewTable.tsx` | Preview de clasificación por lote | 1 hora |

---

## ⏱️ Estimación Total

| Fase | Descripción | Tiempo |
|------|-------------|--------|
| Fase 1 | Análisis y componentes base | 3 horas |
| Fase 2 | Matching Inteligente | 1.5 horas |
| Fase 3 | Reclasificar Movimientos | 2.5 horas |
| Fase 4 | Por Clasificar | 2.5 horas |
| Fase 5 | Reportes (3 páginas) | 7.5 horas |
| **TOTAL** | | **17 horas** |

---

## 🎯 Orden de Ejecución Propuesto

### Sprint 1: Fundamentos (1 semana)

1. **Fase 1:** Crear componentes base reutilizables
   - SelectionColumn helper
   - BadgeColumn helper
   - SelectableDataTable
   
### Sprint 2: Procesos Core (1 semana)

2. **Fase 2:** Conciliación Page (DataTable inline)
3. **Fase 3:** Reclasificar Movimientos

### Sprint 3: Clasificación (1 semana)

4. **Fase 4:** Por Clasificar

### Sprint 4: Reportes (1-2 semanas)

5. **Fase 5:** 
   - Componentes base drilldown
   - Reporte Egresos por Tercero
   - Reporte Egresos por Centro Costo
   - Reporte Ingresos y Gastos

---

## ✅ Criterios de Éxito por Fase

### Para Componentes Base:
- ✅ Reutilizables en múltiples contextos
- ✅ Tipado fuerte TypeScript
- ✅ Props documentadas
- ✅ Mínimo 2 usos confirmados

### Para Páginas Refactorizadas:
- ✅ Usa TableHeaderCell en todos los headers
- ✅ Usa column helpers apropiados
- ✅ Sin código duplicado VS otras páginas
- ✅ Funcionalidad idéntica a versión anterior
- ✅ Performance igual o mejor

---

## 🔍 Beneficios Esperados

### Corto Plazo
- 📉 **Reducción de código:** ~40% en páginas de reportes
- 🎨 **Consistencia visual:** 100% de tablas con mismo look & feel
- 🐛 **Menos bugs:** Lógica centralizada = menos errores

### Mediano Plazo
- 🚀 **Desarrollo más rápido:** Nuevas tablas en ~25% del tiempo
- 🔧 **Mantenimiento centralizado:** Cambios globales en minutos
- 📚 **Onboarding simplificado:** Patrones claros para nuevos devs

### Largo Plazo
- 🏗️ **Base escalable:** Arquitectura sólida para crecimiento
- 🎓 **Knowledge base:** Documentación de patrones
- ⚡ **Performance:** Optimizaciones centralizadas benefician todo

---

## 📝 Notas de Implementación

### Decisiones Clave

1. **MatchingTable:** No refactorizar. Su complejidad justifica implementación custom.
   
2. **Reportes Drilldown:** Priorizar componentización antes de refactorizar páginas individuales.

3. **Selección Múltiple:** Crear componente reutilizable antes de aplicar en múltiples páginas.

4. **DataTables inline vs Organismos:** Evaluar caso por caso. Si la tabla es única del contexto, OK mantener inline pero refactorizada.

### Riesgos y Mitigación

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Componentes muy genéricos pierden flexibilidad | Media | Medio | Props configurables + escape hatches |
| Refactorización rompe funcionalidad existente | Baja | Alto | Testing exhaustivo antes de commit |
| Overhead de componentes innecesarios | Media | Bajo | Validar reuso real antes de crear |

---

## 🚀 Próximo Paso

**Estoy listo para comenzar con la Fase que prefieras:**

### Opción A: **Fase 1 - Componentes Base** (Recomendado)
- Crear fundamentos reutilizables
- Base sólida para todo lo demás
- ~3 horas

### Opción B: **Fase 3 - Reclasificar Movimientos** (Quick Win)
- Página de alto uso
- Impacto visual inmediato
- Crea SelectableDataTable en el proceso
- ~2.5 horas

### Opción C: **Fase 2 - Conciliación** (Más Simple)
- Refactorización directa, sin componentes nuevos
- Buen punto de inicio
- ~1.5 horas

---

**¿Cuál fase prefieres que comencemos?** 🎯
