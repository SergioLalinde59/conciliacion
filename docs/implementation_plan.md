# Análisis y Plan: Reporte de Clasificaciones

## Comparativa con Estándar (ReporteEgresosTerceroPage)

Al revisar `ReporteClasificacionesPage.tsx` contra el estándar `ReporteEgresosTerceroPage.tsx`, se han identificado las siguientes discrepancias críticas en la carga de movimientos y la navegación (drilldown):

### 1. Pérdida de Contexto Jerárquico (Crítico)
*   **Estándar (`ReporteEgresosTerceroPage`)**: La jerarquía es `Tercero -> Centro Costo -> Concepto`. En cada paso, se preservan los IDs de los niveles superiores. Al cargar los movimientos finales, se aplican filtros de `tercero_id`, `centro_costo_id` y `concepto_id`.
*   **Problema en `ReporteClasificacionesPage`**: La jerarquía es `Grupo -> Tercero -> Centro Costo -> Concepto`.
    *   Al hacer clic en un **Grupo**, se abre el modal de Terceros, pero **NO se está filtrando por el Grupo seleccionado**. La llamada a la API carga terceros generales (filtrados solo por fechas), ignorando el grupo padre.
    *   Esta pérdida de contexto se propaga hacia abajo, por lo que la lista final de movimientos puede incluir registros que no pertenecen al Grupo original.

### 2. Inconsistencia de Nomenclatura
*   **Estándar**: La función que carga los detalles finales se llama `handleConceptoClick` (porque se ejecuta al hacer clic en un Concepto).
*   **Actual**: Se llama `handleDetallesClick`.

### 3. Gestión de Estado de Modales
*   Los objetos de estado (`terceroModal`, etc.) no tienen campos para almacenar el `grupoId` o `grupoNombre`, rompiendo la cadena de trazabilidad necesaria para el título del modal ("Reporte / Grupo X / Tercero Y...") y para el filtrado API.

---

## Plan de Implementación

Para alinear este reporte con el estándar y corregir la lógica de datos, se realizarán los siguientes cambios en `ReporteClasificacionesPage.tsx`:

### Paso 1: Actualizar Interfaces y Estado
Ampliar las interfaces de estado de los modales para incluir `grandGrandParentId` (para el Grupo) o reestructurar para mantener la cadena completa.

### Paso 2: Corregir Cadena de Drilldown
1.  **`handleTerceroClick`**:
    *   Pasar explícitamente el `item.id` (Grupo ID) como filtro a la API. **Nota**: Se verificará si el endpoint soporta `clasificacion_id` o `grupo_id`.
    *   Guardar `grupoId` y `grupoNombre` en el estado de `terceroModal`.
2.  **`handleCentroCostoClick`**:
    *   Propagar `grupoId` desde `terceroModal` a `centroCostoModal`.
3.  **`handleConceptoClick` (antes `handleDetallesClick`)**:
    *   Recibir el `grupoId` y pasarlo a `apiService.movimientos.listar`.

### Paso 3: Estandarización Visual
*   Actualizar los "breadcrumbs" (migas de pan) en los encabezados de los modales para mostrar la jerarquía completa 4 niveles: `Reporte / Grupo / Tercero / Centro Costo`.

### Paso 4: Carga de Movimientos
*   Refactorizar `handleDetallesClick` a `handleConceptoClick`.
*   Asegurar que `MovimientosModal` reciba la data correctamente filtrada.

*(Este plan asume que la API soporta el filtrado por Grupo/Clasificación en los endpoints de desglose y listado. Si no es así, se requiere trabajo de backend, pero el frontend se dejará preparado con la estructura correcta).*
