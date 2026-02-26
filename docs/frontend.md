# Arquitectura Frontend - Conciliacion Bancaria (Mvtos)

## Stack Tecnologico

- **Framework:** React 19.2.3
- **Lenguaje:** TypeScript 5.9.3 (strict mode)
- **Build Tool:** Vite 7.2.4
- **Estilos:** Tailwind CSS 4.1.18
- **Estado Servidor:** TanStack React Query 5.90.16
- **Estado Global:** Context API (SettingsContext)
- **Routing:** React Router DOM 7.11.0
- **Iconos:** Lucide React
- **Notificaciones:** react-hot-toast 2.6.0
- **Graficos:** Recharts 3.6.0
- **Exportacion:** jsPDF + jspdf-autotable (PDF), xlsx (Excel)

## Estructura del Proyecto

```
frontend/src/
├── main.tsx                 # Punto de entrada (React Query + SettingsProvider)
├── App.tsx                  # Router principal (40+ rutas)
├── index.css                # Import de Tailwind CSS
│
├── components/              # Atomic Design
│   ├── atoms/               # Componentes base (13)
│   ├── molecules/           # Componentes compuestos (20+)
│   │   └── entities/        # Selectores y displays de entidades
│   ├── organisms/           # Componentes complejos (40+)
│   └── templates/           # Layouts (MainLayout)
│
├── pages/                   # Vistas (40+ paginas)
│   └── mantenimiento/       # Sub-paginas de mantenimiento
│
├── services/                # Clientes HTTP y logica de API (16 archivos)
├── hooks/                   # Hooks personalizados (8 archivos)
├── context/                 # Context API (SettingsContext)
├── types/                   # Definiciones TypeScript
└── utils/                   # Funciones utilitarias (5 archivos)
```

## Punto de Entrada

**`main.tsx`** configura:
1. `QueryClient` con staleTime de 5 minutos y 1 reintento
2. `QueryClientProvider` para React Query
3. `SettingsProvider` para configuracion global
4. `StrictMode` habilitado

**`App.tsx`** define todas las rutas dentro de `MainLayout`.

## Atomic Design - Componentes

### Atoms (13 componentes)

Componentes base sin logica de negocio:

| Componente | Descripcion |
|------------|-------------|
| `Button.tsx` | Boton con variantes (primary, secondary, danger), tamanios y estado loading |
| `Input.tsx` | Campo de formulario con label, icono y error |
| `Select.tsx` | Dropdown con opciones, label e icono |
| `Badge.tsx` | Etiqueta de estado con variantes de color |
| `Card.tsx` | Contenedor con sombra y padding |
| `Checkbox.tsx` | Checkbox estilizado con label |
| `Icon.tsx` | Wrapper de iconos Lucide |
| `CurrencyDisplay.tsx` | Formateador de moneda con colorizacion (190 lineas) |
| `MatchStatusBadge.tsx` | Badge de estado de matching (EXACTO, PROBABLE, etc.) |
| `ScoreIndicator.tsx` | Barra de progreso con puntaje |
| `SemaforoBadge.tsx` | Semaforo (verde/amarillo/rojo) |
| `TableHeaderCell.tsx` | Celda de encabezado de tabla formateada |
| `DataTableSortIcon.tsx` | Indicador de direccion de ordenamiento |

### Molecules (20+ componentes)

Combinaciones de atoms con logica de presentacion:

| Componente | Descripcion |
|------------|-------------|
| `Modal.tsx` | Modal base reutilizable (175 lineas) |
| `DataTable.tsx` | Tabla generica con ordenamiento y paginacion (385 lineas) |
| `Pagination.tsx` | Navegacion de paginas |
| `ComboBox.tsx` | Dropdown con busqueda (293 lineas) |
| `CurrencyInput.tsx` | Input numerico para moneda (150 lineas) |
| `ClassificationFilters.tsx` | Filtros de clasificacion en 3 columnas |
| `MatchScoreBreakdown.tsx` | Desglose de puntaje de matching |
| `FilterToggles.tsx` | Botones toggle para filtros |
| `MovimientoExtractoCard.tsx` | Tarjeta de movimiento del extracto |
| `MovimientoSistemaCard.tsx` | Tarjeta de movimiento del sistema |
| `SelectableDataTable.tsx` | DataTable con checkboxes de seleccion |
| `DrilldownTable.tsx` | Tabla jerarquica con drill-down |
| `LoadResultSummary.tsx` | Resumen de resultado de carga (254 lineas) |
| `DateRangeSelector.tsx` | Selector de rango de fechas |
| `StatCard.tsx` | Tarjeta de estadistica |
| `CsvExportButton.tsx` | Boton de exportacion a CSV |
| `SelectorCuenta.tsx` | Selector de cuenta bancaria |
| `entities/EntityDisplay.tsx` | Display de entidad (ID + nombre) |
| `entities/EntitySelector.tsx` | ComboBox para seleccion de entidades |
| `entities/ClassificationDisplay.tsx` | Display de clasificacion |

### Organisms (40+ componentes)

Componentes complejos con logica de negocio:

**Modales CRUD (18+):**
- `CentroCostoModal`, `MonedaModal`, `TipoMovimientoModal`, `TerceroModal`
- `ConceptoModal`, `CuentaModal`, `TipoCuentaModal`
- `ConfigValorPendienteModal`, `ConfigFiltroCentroCostoModal`
- `ClassificationModal`, `EditExtractMovementModal`
- `MovimientoModal` (747 lineas), `MovimientosDetailModal`
- `PresupuestoGenerarModal` (615 lineas), `PresupuestoAjusteModal`, `PresupuestoSemaforoModal`
- `PreviewDataModal` (754 lineas), `ClasificacionDetalleModal` (746 lineas)
- `MatchesIncorrectosModal`, `CostCenterDetailsModal`

**Tablas:**
- `CentrosCostosTable`, `MonedasTable`, `TiposMovimientoTable`
- `ConceptosTable`, `TercerosTable`, `CuentasTable`, `TiposCuentaTable`
- `ConfigFiltrosCentrosCostosTable`, `ConfigValoresPendientesTable`
- `MovementsTable`, `MovimientosTable`
- `MatchingTable` (549 lineas), `ExtractDetailsTable` (340 lineas)
- `UnmatchedSystemTable`, `BatchClassificationPreviewTable`

**Dashboard:**
- `DashboardSummaryRibbon`, `DashboardAccountChart`
- `DashboardAccountStats`, `DashboardBudgetWidget`, `DashboardStatsTable`

**Otros:**
- `Sidebar.tsx` (278 lineas) - Navegacion lateral
- `DualPanelComparison.tsx` - Comparacion sistema vs extracto
- `ConfiguracionMatchingForm.tsx` - Formulario de configuracion matching
- `ConciliacionMovimientosTab.tsx` (420 lineas) - Tab de movimientos en conciliacion
- `MatchingFilters.tsx`, `MatchingStatsCard.tsx`
- `FiltrosReporte.tsx`, `EstadisticasTotales.tsx`

### Templates (1)

- `MainLayout.tsx` - Layout principal con Sidebar y area de contenido

## Paginas (40+ rutas)

### Organizacion por Modulo

**Dashboard:** `/`
- `DashboardPage` - Resumen general con estadisticas y graficos

**Maestros:** `/maestros/*`
- `MonedasPage`, `CuentasPage`, `TiposMovimientoPage`, `TiposCuentaPage`
- `TercerosPage`, `TerceroDescripcionesPage`
- `CentrosCostosPage`, `ConceptosPage`
- `ConfigFiltrosCentrosCostosPage`, `ConfigValoresPendientesPage`
- `ReglasPage`, `ReglasNormalizacionPage`
- `CuentaExtractoresPage`, `MatchingConfigPage`
- `PresupuestoConfigPage`

**Movimientos:** `/movimientos/*`
- `MovimientosPage` - Listado principal
- `MovimientoFormPage` - Crear/editar movimiento
- `UploadMovimientosPage` (719 lineas) - Carga masiva
- `ClasificarMovimientosPage` (925 lineas) - Clasificacion
- `SugerenciasReclasificacionPage` - Sugerencias de reclasificacion

**Conciliacion:** `/conciliacion/*`
- `ConciliacionPage` - Vista principal de conciliacion
- `ConciliacionMatchingPage` (672 lineas) - Matching interactivo
- `UploadExtractoPage` (931 lineas) - Carga de extracto bancario

**Reportes:** `/reportes/*`
- `ReporteClasificacionesPage` - Reporte de clasificaciones
- `ReporteIngresosGastosMesPage` - Ingresos vs gastos mensual
- `ReporteEgresosTerceroPage` - Egresos por tercero
- `ReporteEgresosCentroCostoPage` - Egresos por centro de costo
- `DescargarMovimientosPage` - Exportar movimientos
- `PresupuestoVsRealPage` - Presupuesto vs ejecucion real

**Presupuestos:** `/presupuestos/*`
- `PresupuestosPage` - Listado de presupuestos
- `PresupuestoDetallePage` (956 lineas) - Detalle del presupuesto
- `TiposGastoPage` - Categorias de gasto
- `IndicadoresEconomicosPage` - Indicadores economicos
- `ReglasPresupuestoPage` - Reglas presupuestales
- `ClasificacionGastosPreviewPage` (744 lineas) - Preview de clasificacion

**Herramientas:** `/herramientas/*`
- `CentroControlDatosPage` - Centro de control de datos
- `ReconciliationResetPage` - Reset de periodo
- `ReclasificarMovimientosPage` - Reclasificacion masiva

**Admin:** `/admin/*`
- `ResetDemoPage` - Reset de datos demo

## Servicios HTTP (16 archivos)

| Servicio | Descripcion |
|----------|-------------|
| `httpClient.ts` | Cliente HTTP centralizado (fetch wrapper) |
| `api.ts` | API principal con endpoints comunes |
| `movements.service.ts` | Movimientos CRUD |
| `catalogs.service.ts` | Datos maestros (catalogos) |
| `conciliacionService.ts` | Conciliacion bancaria |
| `matching.service.ts` | Matching sistema vs extracto |
| `dashboard.service.ts` | Datos del dashboard |
| `config.service.ts` | Configuracion |
| `extractores.service.ts` | Configuracion de extractores |
| `files.service.ts` | Carga/descarga de archivos |
| `admin.service.ts` | Operaciones administrativas |
| `presupuesto.service.ts` | Presupuestos |
| `tiposGasto.service.ts` | Tipos de gasto |
| `indicadores.service.ts` | Indicadores economicos |
| `reglasPresupuesto.service.ts` | Reglas presupuestales |
| `trm.service.ts` | Tasa representativa del mercado |

## Hooks Personalizados (8)

| Hook | Descripcion |
|------|-------------|
| `useCatalogo.ts` | React Query wrapper para catalogos (staleTime: 10min) |
| `useReportes.ts` | Hooks para reportes (clasificacion, ingresos/gastos, desglose) |
| `useCachedData.ts` | Cache en memoria con TTL (sistema alternativo a React Query) |
| `useSessionStorage.ts` | Persistencia en sessionStorage |
| `useTiposGasto.ts` | Hook para tipos de gasto |
| `useIndicadores.ts` | Hook para indicadores economicos |
| `usePresupuesto.ts` | Hook para presupuestos |
| `useReglasPresupuesto.ts` | Hook para reglas presupuestales |

## Utilidades (5 archivos)

| Archivo | Funciones Principales |
|---------|----------------------|
| `formatters.ts` | `formatCurrency()`, `formatDate()`, `getNumberColorClass()` |
| `dateUtils.ts` | Utilidades de manipulacion de fechas |
| `cache.ts` | `appCache` singleton para cache en memoria |
| `cn.ts` | Utilidad para combinar clases CSS (classnames) |
| `queryClient.ts` | Registro global de QueryClient para uso en servicios |

## Tipos TypeScript

| Archivo | Contenido |
|---------|-----------|
| `types/Conciliacion.ts` | Tipos de conciliacion y matching |
| `types/Matching.ts` | Tipos del sistema de matching |
| `types/filters.ts` | Tipos de filtros |

## Context API

- `SettingsContext.tsx` - Configuracion global de la aplicacion (moneda por defecto, preferencias)

## Patrones Principales

1. **React Query** para todo el estado del servidor (fetching, caching, mutations)
2. **Atomic Design** para jerarquia de componentes
3. **Named exports** para todos los componentes
4. **Tailwind CSS** como unico sistema de estilos (sin CSS custom)
5. **Servicios centralizados** por dominio funcional
6. **TypeScript strict** para seguridad de tipos

## Convenciones

- Componentes: `PascalCase.tsx` con named export
- Servicios: `camelCase.service.ts`
- Hooks: `usePascalCase.ts`
- Tipos/Interfaces: `PascalCase` (ej. `ButtonProps`)
- Utilidades: `camelCase.ts`
- Estilos: Solo clases Tailwind inline
