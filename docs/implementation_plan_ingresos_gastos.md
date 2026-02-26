# Plan de Implementación: Actualización de Reporte Ingresos y Gastos Mes

## Objetivo
Actualizar `ReporteIngresosGastosMesPage.tsx` para incluir un título de página estandarizado y completar la configuración de filtros avanzados, alineándolo con el diseño de `ReporteEgresosTerceroPage.tsx`.

## Cambios Propuestos

### 1. Agregar Título de Página
Insertar un bloque de título en la parte superior del contenedor principal para mejorar la consistencia visual.

```tsx
<div className="px-6 pt-6 pb-2 bg-white">
    <h1 className="text-2xl font-bold text-slate-900">Ingresos y Gastos</h1>
    <p className="text-slate-500 text-sm mt-1">Evolución y comparación mensual</p>
</div>
```

### 2. Actualizar Filtros Avanzados
Pasar las propiedades faltantes al componente `FiltrosReporte` para habilitar la funcionalidad completa de filtros, incluyendo las exclusiones dinámicas y los selectores de tipo de movimiento.

- Agregar prop `configuracionExclusion={configuracionExclusion}`.
- Agregar prop `showIngresosEgresos={true}`.

## Archivos Afectados
- `frontend/src/pages/ReporteIngresosGastosMesPage.tsx`

## Verificación
- Verificar que el título aparezca correctamente en la parte superior.
- Verificar que los filtros de exclusión (checkboxes) sean visibles y funcionales.
- Verificar que los selectores de Ingresos/Egresos estén disponibles si son requeridos por el componente de filtros.
