# 📋 Plan de Implementación: Refactorización de DataTables

> **Documento de Planificación** para la refactorización de todas las tablas de datos siguiendo el patrón de **Diseño Atómico** establecido en `datatable-componentes.md`
>
> **Fecha de creación:** 2026-02-03  
> **Documento de referencia:** `frontend/docs/datatable-componentes.md`  
> **Tabla de referencia:** `MovimientosTable.tsx` (✅ Ya implementada)

---

## 📊 Inventario de DataTables en la Aplicación

### ✅ Tablas Ya Implementadas Correctamente (1)

| # | Archivo | Estado | Nivel de Cumplimiento | Notas |
|---|---------|--------|----------------------|-------|
| 1 | `MovimientosTable.tsx` | ✅ COMPLETO | 100% | **Referencia principal**. Implementa todos los lineamientos. |

### 🔄 Tablas Parcialmente Implementadas (6)

| # | Archivo | Estado | Cumplimiento | Problemas Detectados |
|---|---------|--------|--------------|---------------------|
| 2 | `CuentasTable.tsx` | 🟡 PARCIAL | 70% | - Falta `TableHeaderCell` en headers<br>- No usa `useMemo` para columnas<br>- Headers no capitalizados |
| 3 | `TercerosTable.tsx` | 🟡 PARCIAL | 70% | - Falta `TableHeaderCell` en headers<br>- No usa `useMemo` para columnas<br>- Headers no capitalizados |
| 4 | `CentrosCostosTable.tsx` | 🟡 PARCIAL | 60% | - Usa helpers `idColumn`/`nombreColumn` (deprecados)<br>- Falta `TableHeaderCell`<br>- No está en carpeta correcta |
| 5 | `ConceptosTable.tsx` | 🟡 PARCIAL | 60% | - Falta `TableHeaderCell` en headers<br>- Estilos inline no reutilizables<br>- Faltan column helpers |
| 6 | `UnmatchedSystemTable.tsx` | 🟡 PARCIAL | 65% | - Headers en MAYÚSCULAS fijas (no usa TableHeaderCell)<br>- Estilos inline repetidos<br>- Falta usar column helpers moneda |
| 7 | `ExtractDetailsTable.tsx` | 🟡 PARCIAL | 50% | - Requiere revisión completa |

### ❌ Tablas NO Implementadas (Usan tabla HTML manual) (3)

| # | Archivo | Estado | Cumplimiento | Problemas Detectados |
|---|---------|--------|--------------|---------------------|
| 8 | `MonedasTable.tsx` | ❌ SIN IMPLEMENTAR | 0% | - Usa `<table>` HTML manual<br>- No usa DataTable<br>- Sin ordenamiento<br>- Sin consistencia de estilos |
| 9 | `TiposMovimientoTable.tsx` | ❌ SIN IMPLEMENTAR | 0% | - Usa `<table>` HTML manual<br>- No usa DataTable<br>- Sin ordenamiento<br>- Sin consistencia de estilos |
| 10 | `MovementsTable.tsx` | ⚠️ REVISAR | ? | - Requiere revisión (puede ser duplicado) |

### 🔍 Tablas Especiales (Requieren análisis específico) (5)

| # | Archivo | Estado | Tipo | Notas |
|---|---------|--------|------|-------|
| 11 | `MatchingTable.tsx` | 🔵 ESPECIAL | Tabla compleja | - 641 líneas, lógica compleja<br>- Implementación custom justificada<br>- Requiere evaluación individual |
| 12 | `ConfigFiltrosCentrosCostosTable.tsx` | 🔵 ESPECIAL | Tabla de configuración | - Requiere análisis |
| 13 | `ConfigValoresPendientesTable.tsx` | 🔵 ESPECIAL | Tabla de configuración | - Requiere análisis |
| 14 | `DashboardStatsTable.tsx` | 🔵 ESPECIAL | Dashboard | - Requiere análisis |
| 15 | `TerceroDescripcionesPage.tsx` (inline) | 🔵 ESPECIAL | DataTable en página | - Usa DataTable inline en página<br>- Considerar extraer a organismo |

### 📄 Tablas en Páginas (DataTable inline) (≥10)

Estas páginas usan `DataTable` directamente sin crear un componente organismo específico:

| # | Archivo | Ubicación | Notas |
|---|---------|-----------|-------|
| 16 | `TerceroDescripcionesPage.tsx` | Pages | - DataTable inline con lógica compleja |
| 17 | `ReporteIngresosGastosMesPage.tsx` | Reportes | - 3 DataTables en la misma página |
| 18 | `ReporteEgresosTerceroPage.tsx` | Reportes | - 3 DataTables en la misma página |
| 19 | `ReporteEgresosCentroCostoPage.tsx` | Reportes | - 3 DataTables en la misma página |
| 20 | `ReporteClasificacionesPage.tsx` | Reportes | - 3 DataTables en la misma página |
| 21 | `ReglasPage.tsx` | Pages | - DataTable inline |
| 22 | `ReglasNormalizacionPage.tsx` | Pages | - DataTable inline |
| 23 | `ReclasificarMovimientosPage.tsx` | Mantenimiento | - DataTable inline |
| 24 | `CuentaExtractoresPage.tsx` | Pages | - DataTable inline |
| 25 | `ConciliacionPage.tsx` | Pages | - DataTable inline |
| 26 | `ClasificarMovimientosPage.tsx` | Pages | - DataTable inline |

---

## 🎯 Objetivos de la Refactorización

### Objetivos Principales

1. ✅ **Consistencia Visual** - Todas las tablas deben verse y comportarse igual
2. ✅ **Mantenibilidad** - Cambios centralizados en componentes atómicos
3. ✅ **Reutilización** - Evitar código duplicado mediante column helpers
4. ✅ **Diseño Atómico** - Seguir estrictamente la jerarquía Átomos → Moléculas → Organismos
5. ✅ **Type Safety** - Tipado fuerte con TypeScript
6. ✅ **Performance** - Memoización adecuada y scroll infinito donde aplique

### Lineamientos Clave a Implementar

- ✅ Usar `TableHeaderCell` para **todos** los headers de columnas
- ✅ Usar `useMemo()` para la definición de columnas
- ✅ Usar column helpers (`monedaColumn`, `fechaColumn`, `textoColumn`, etc.) en lugar de estilos inline
- ✅ Eliminar estilos duplicados - centralizar en helpers
- ✅ Implementar scroll infinito en tablas grandes (>15 registros)
- ✅ Estructura consistente: Header → DataTable → Footer
- ✅ Migrar tablas HTML `<table>` a componente `DataTable`

---

## 📝 Plan de Ejecución

### Estrategia de Implementación

Implementaremos las tablas **UNA A LA VEZ**, siguiendo este proceso:

1. **Analizar** - Revisar el código actual y definir cambios necesarios
2. **Refactorizar** - Aplicar cambios siguiendo los lineamientos
3. **Probar** - Verificar funcionamiento en la UI
4. **Comentar** - Documentar cambios y lecciones aprendidas
5. **Siguiente** - Pasar a la siguiente tabla

### Orden de Implementación

#### 🔥 Fase 1: Tablas Simples (Prioridad Alta) - CRUD Básicos

Estas tablas son simples, de alta visibilidad y bajo riesgo.

| Orden | Tabla | Estimación | Complejidad |
|-------|-------|------------|-------------|
| 1️⃣ | `MonedasTable.tsx` | 30 min | ⭐ Baja |
| 2️⃣ | `TiposMovimientoTable.tsx` | 30 min | ⭐ Baja |
| 3️⃣ | `TercerosTable.tsx` | 20 min | ⭐ Baja |
| 4️⃣ | `CuentasTable.tsx` | 30 min | ⭐⭐ Media |
| 5️⃣ | `CentrosCostosTable.tsx` | 25 min | ⭐ Baja |
| 6️⃣ | `ConceptosTable.tsx` | 40 min | ⭐⭐ Media |

**Total Fase 1:** ~3 horas

---

#### 🌟 Fase 2: Tablas de Configuración (Prioridad Media)

| Orden | Tabla | Estimación | Complejidad |
|-------|-------|------------|-------------|
| 7️⃣ | `ConfigFiltrosCentrosCostosTable.tsx` | 45 min | ⭐⭐ Media |
| 8️⃣ | `ConfigValoresPendientesTable.tsx` | 45 min | ⭐⭐ Media |

**Total Fase 2:** ~1.5 horas

---

#### 📊 Fase 3: Tablas de Reportes Inline (Prioridad Media)

Estas requieren evaluación: ¿extraer a organismos o mantener inline?

| Orden | Página | DataTables | Recomendación | Estimación |
|-------|--------|------------|---------------|------------|
| 9️⃣ | `ReporteIngresosGastosMesPage.tsx` | 3 | 🔍 Evaluar | 60 min |
| 🔟 | `ReporteEgresosTerceroPage.tsx` | 3 | 🔍 Evaluar | 60 min |
| 1️⃣1️⃣ | `ReporteEgresosCentroCostoPage.tsx` | 3 | 🔍 Evaluar | 60 min |
| 1️⃣2️⃣ | `ReporteClasificacionesPage.tsx` | 3 | 🔍 Evaluar | 60 min |

**Total Fase 3:** ~4 horas

---

#### 🔧 Fase 4: Tablas en Páginas (Prioridad Baja)

| Orden | Página | Acción | Estimación |
|-------|--------|--------|------------|
| 1️⃣3️⃣ | `TerceroDescripcionesPage.tsx` | Refactorizar inline o extraer | 45 min |
| 1️⃣4️⃣ | `ReglasPage.tsx` | Refactorizar inline | 40 min |
| 1️⃣5️⃣ | `ReglasNormalizacionPage.tsx` | Refactorizar inline | 40 min |
| 1️⃣6️⃣ | `CuentaExtractoresPage.tsx` | Refactorizar inline | 40 min |
| 1️⃣7️⃣ | `ReclasificarMovimientosPage.tsx` | Refactorizar inline | 50 min |
| 1️⃣8️⃣ | `ConciliacionPage.tsx` | Refactorizar inline | 50 min |
| 1️⃣9️⃣ | `ClasificarMovimientosPage.tsx` | Refactorizar inline | 50 min |

**Total Fase 4:** ~5 horas

---

#### 🔍 Fase 5: Tablas Especiales (Prioridad Variable)

| Orden | Tabla | Acción | Estimación |
|-------|-------|--------|------------|
| 2️⃣0️⃣ | `MatchingTable.tsx` | **Análisis profundo** - 641 líneas custom | 2-3 horas |
| 2️⃣1️⃣ | `UnmatchedSystemTable.tsx` | Refactorizar | 45 min |
| 2️⃣2️⃣ | `ExtractDetailsTable.tsx` | Refactorizar | 45 min |
| 2️⃣3️⃣ | `DashboardStatsTable.tsx` | Evaluar necesidad | 30 min |
| 2️⃣4️⃣ | `MovementsTable.tsx` | Verificar si es duplicado | 15 min |

**Total Fase 5:** ~5 horas

---

### ⏱️ Estimación Total

| Fase | Tablas | Tiempo Estimado |
|------|--------|-----------------|
| Fase 1: Simples | 6 | 3 horas |
| Fase 2: Config | 2 | 1.5 horas |
| Fase 3: Reportes | 4 | 4 horas |
| Fase 4: Páginas | 7 | 5 horas |
| Fase 5: Especiales | 5 | 5 horas |
| **TOTAL** | **24 tablas** | **~18.5 horas** |

---

## 📐 Template de Implementación

Para cada tabla, seguir este checklist:

### ✅ Checklist de Refactorización

```markdown
## Tabla: [Nombre]

### 1. Análisis Inicial
- [ ] Revisar código actual
- [ ] Identificar columnas y tipos de datos
- [ ] Identificar lógica especial (ordenamiento custom, cálculos, etc.)
- [ ] Identificar dependencias y props

### 2. Refactorización
- [ ] Importar componentes atómicos necesarios
  - [ ] `TableHeaderCell`
  - [ ] Column helpers (`monedaColumn`, `fechaColumn`, etc.)
  - [ ] `Button` (si tiene acciones)
  - [ ] Componentes moleculares (`EntityDisplay`, `ClassificationDisplay`, etc.)
- [ ] Definir interface de Props con tipos fuertes
- [ ] Convertir columnas usando column helpers
- [ ] Aplicar `useMemo()` en definición de columnas
- [ ] Implementar estructura completa (Header → DataTable → Footer) si aplica
- [ ] Implementar scroll infinito si hay >15 registros típicamente
- [ ] Eliminar código duplicado

### 3. Validación
- [ ] Verificar que compila sin errores TypeScript
- [ ] Probar en UI: visualización correcta
- [ ] Probar: ordenamiento funciona
- [ ] Probar: acciones (editar/eliminar) funcionan
- [ ] Probar: estados (loading, empty) funcionan
- [ ] Comparar visualmente con MovimientosTable (referencia)

### 4. Documentación
- [ ] Comentar cambios significativos
- [ ] Actualizar este documento con lecciones aprendidas
```

---

## 🧩 Componentes Atómicos a Crear/Mejorar

Durante la refactorización, podrían identificarse necesidades de nuevos componentes:

### Posibles Nuevos Column Helpers

- [ ] `booleanColumn` - Para checkmarks/boolean con CheckCircle/XCircle
- [ ] `badgeColumn` - Para badges de estado
- [ ] `accionesColumn` - Para columna de acciones estandarizada

### Posibles Nuevos Componentes Moleculares

- [ ] `BooleanDisplay` - Componente para mostrar boolean consistentemente
- [ ] `MultiValueDisplay` - Para valores múltiples (ej: clasificaciones múltiples)

---

## 🎨 Principios de Diseño Atómico a Mantener

1. **Átomos** (`atoms/`) - Componentes indivisibles
   - `Button.tsx`
   - `TableHeaderCell.tsx`
   - `DataTableSortIcon.tsx`
   - `columnHelpers.tsx`

2. **Moléculas** (`molecules/`) - Combinan átomos
   - `DataTable.tsx`
   - `EntityDisplay.tsx`
   - `ClassificationDisplay.tsx`

3. **Organismos** (`organisms/`) - Lógica de negocio completa
   - Todas las tablas deben estar aquí
   - Subcarpeta `organisms/tables/` para tablas CRUD
   - Raíz de `organisms/` para tablas complejas

---

## 📖 Referencias

- **Documento de Lineamientos:** `frontend/docs/datatable-componentes.md`
- **Tabla de Referencia:** `frontend/src/components/organisms/MovimientosTable.tsx`
- **DataTable API:** `frontend/docs/DataTable_Guia.md` (si existe)

---

## 📝 Notas de Implementación

### Decisiones de Arquitectura

1. **Tablas en Reportes:** Evaluar caso por caso si extraer a organismos o mantener inline
   - Si la tabla es única del reporte → OK mantener inline
   - Si la tabla podría reutilizarse → Extraer a organismo

2. **MatchingTable:** No refactorizar por ahora. Es una tabla altamente especializada con lógica única.

3. **Scroll Infinito:** Implementar solo en tablas que típicamente tienen >15 registros

---

## ✅ Criterios de Éxito

Una tabla se considera **completamente refactorizada** cuando:

1. ✅ Usa `TableHeaderCell` en todos los headers
2. ✅ Usa column helpers en lugar de estilos inline
3. ✅ Tiene columnas definidas con `useMemo()`
4. ✅ Tiene tipos TypeScript fuertes
5. ✅ Sigue la estructura estándar de organismos
6. ✅ No tiene código duplicado
7. ✅ Funcionalmente idéntica a la versión anterior
8. ✅ Visualmente consistente con `MovimientosTable`

---

**Próximo paso:** Comenzar con la Fase 1 - Tabla #1: `MonedasTable.tsx`
