---
description: Refactorizar un reporte estándar para seguir los lineamientos de diseño premium e interactividad de tres niveles.
---

Este workflow automatiza la aplicación de los estándares definidos en `GUIDELINES_REPORTES.md`.

### Pasos a seguir:

1. **Análisis de Tipos**
   - Verificar que el reporte use `ItemDesglose` para los drilldowns.
   - Asegurar que el hook del reporte sea compatible con parámetros de filtrado por niveles.

2. **Implementación de Comparativa (Tendencia)**
   - Importar `getPreviousPeriod` de `dateUtils.ts`.
   - Crear un memo `prevPeriod = getPreviousPeriod(desde, hasta)`.
   - Añadir una segunda llamada al hook del reporte para obtener `totalesAnterior`.
   - Actualizar `<EstadisticasTotales />` con las props de comparativa.

3. **Drilldown de Gráfica**
   - Añadir `onClick` al componente `<BarChart />`.
   - Añadir `onClick` al componente `<YAxis />` (ticks).
   - Ambos deben llamar al handler de navegación del primer nivel (ej: `handleTerceroClick`).

4. **Modals Reutilizables**
   - Asegurar que el componente `Modal` interno tenga breadcrumbs condicionales basados en el nivel actual.
   - Implementar un input de búsqueda local (`busquedaModal`) que filtre los datos del modal antes de pasarlos a su `DataTable`.

5. **Nivel de Movimientos (Nivel 4)**
   - Crear el componente `MovimientosModal` si no existe.
   - Usar `apiService.movimientos.listar` con filtros de `tercero_id`, `centro_costo_id` y `concepto_id`.
   - Importante: Sumar los valores de los detalles clasificados (`row.detalles.filter(...)`) para manejar correctamente movimientos divididos.

6. **Pulido Visual**
   - Ajustar `rowPy="py-1"` en todas las `DataTable`.
   - Verificar el uso de `font-mono` en columnas de moneda.
   - Añadir un icono de `Eye` en la tabla principal como indicador visual de acción.
