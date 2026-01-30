# Estándar de Reportes de Inteligencia de Negocios

Este documento define el patrón de diseño y funcionalidad para los reportes interactivos del sistema. Debe utilizarse como base de referencia ('Copy-Paste Reference') para crear o refactorizar reportes.

## 1. Gestión de Estado y Filtros
Utilizar `useSessionStorage` para persistencia al navegar y recargar.

```tsx
export const ReporteEjemploPage = () => {
    // 1. Filtros Básicos
    const [desde, setDesde] = useSessionStorage('rep_ejemplo_desde', getMesActual().inicio)
    const [hasta, setHasta] = useSessionStorage('rep_ejemplo_hasta', getMesActual().fin)
    const [cuentaId, setCuentaId] = useSessionStorage('rep_ejemplo_cuentaId', '')
    
    // 2. Filtros de Clasificación (según aplique)
    const [terceroId, setTerceroId] = useSessionStorage('rep_ejemplo_terceroId', '')
    const [centroCostoId, setCentroCostoId] = useSessionStorage('rep_ejemplo_centroCostoId', '')
    const [conceptoId, setConceptoId] = useSessionStorage('rep_ejemplo_conceptoId', '')
    
    // 3. Filtros Visuales (Ingresos/Egresos)
    const [mostrarIngresos, setMostrarIngresos] = useSessionStorage('rep_ejemplo_ingresos', false)
    const [mostrarEgresos, setMostrarEgresos] = useSessionStorage('rep_ejemplo_egresos', true)
    
    // 4. Exclusiones
    const { data: configExclusion = [] } = useConfiguracionExclusion()
    const [centrosCostosExcluidos, setCentrosCostosExcluidos] = useSessionStorage<number[] | null>('rep_ejemplo_excluidos', null)
    
    // ... Efecto para cargar exclusiones por defecto ...
```

## 2. Obtención de Datos (Hooks)
Centralizar los parámetros en un `useMemo` que incluya las banderas de `ver_ingresos` y `ver_egresos`.

```tsx
    const paramsReporte = useMemo(() => ({
        nivel: 'centro_costo', // o 'tercero', 'concepto'
        fecha_inicio: desde, 
        fecha_fin: hasta,
        cuenta_id: cuentaId ? Number(cuentaId) : undefined,
        // ... otros IDs opcionales
        centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined,
        ver_ingresos: mostrarIngresos,
        ver_egresos: mostrarEgresos
    }), [desde, hasta, cuentaId, /* ...deps */, mostrarIngresos, mostrarEgresos])

    const { data, isLoading } = useReporteDesgloseGastos(paramsReporte)
```

## 3. Estructura Visual (Layout)

```tsx
    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            {/* 1. Header de Filtros */}
            <FiltrosReporte
                // ... props de estado (desde, hasta, cuentaId, etc)
                mostrarIngresos={mostrarIngresos}
                setMostrarIngresos={setMostrarIngresos}
                mostrarEgresos={mostrarEgresos}
                setMostrarEgresos={setMostrarEgresos}
                centrosCostosExcluidos={actualCentrosCostosExcluidos}
                setCentrosCostosExcluidos={setCentrosCostosExcluidos}
            />

            <div className="flex-1 overflow-auto p-4 space-y-4">
                {/* 2. Totales y Comparativa */}
                <EstadisticasTotales ... />

                {/* 3. Grid: Gráfica + Tabla */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    
                    {/* Panel Izquierdo: Gráfica (Top 15) */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 h-[800px] flex flex-col">
                        <BarChart data={top15} ... />
                    </div>

                    {/* Panel Derecho: Tabla Completa */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden h-[800px]">
                        {/* Header Fijo con Buscador */}
                        <div className="...">...</div> 
                        
                        {/* Tabla con Scroll Interno Controlado */}
                        <div className="flex-1 min-h-0">
                            <DataTable
                                className="h-full overflow-y-auto"
                                data={filteredData} // Usar lista completa, NO slice
                                stickyHeader
                                ...
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. Modals */}
            <DrilldownModal ... />
            <MovimientosModal ... />
        </div>
    )
```

## 4. Requisitos Funcionales y UX

### Drilldown Patterns
*   **Interactividad**: Gráficas (Bars) y Labels del Eje Y deben ser clicables (`onClick`, `onDoubleClick`).
*   **Modals Reutilizables**: Definir componentes internos `DrilldownModal` y `MovimientosModal` en el mismo archivo para encapsular lógica.
*   **Sin Límites en Modals**: Los modales de drilldown deben mostrar **todos** los registros filtrados, no solo el top 15. Usar slice SOLO para la lógica de ordenamiento si es necesario, pero preferiblemente mostrar todo.
*   **Headers Dinámicos**: En `DrilldownModal`, la columna de nombre debe reflejar el nivel actual: `level === 'tercero' ? 'Tercero' : 'Concepto'`.

### Tablas (`DataTable`)
*   **Scroll & Sticky**: 
    -   Contenedor padre: `flex-1 min-h-0`.
    -   DataTable: `className="h-full overflow-y-auto"`.
    -   Prop: `stickyHeader={true}`.
*   **Formato de Moneda**: Usar `<CurrencyDisplay value={...} colorize={false} />` para columnas específicas.

### API & Detalle de Movimientos ("Nivel 4")
Al llamar a `apiService.movimientos.listar` para el detalle final:
1.  Pasar **TODOS** los filtros de contexto (ids padre/abuelo).
2.  Pasar `ver_ingresos` y `ver_egresos` explícitamente.
3.  Pasar `centros_costos_excluidos`.

```tsx
apiService.movimientos.listar({
    tercero_id: ... , 
    centro_costo_id: ... , 
    concepto_id: ... ,
    desde, hasta, limit: 1000,
    ver_ingresos: mostrarIngresos, 
    ver_egresos: mostrarEgresos,
    centros_costos_excluidos: ...
} as any)
```

## 5. Checklist de Migración
- [ ] Eliminar lógica de filtros manual y usar `FiltrosReporte` con props de toggle.
- [ ] Asegurar que `paramsReporte` incluya `ver_ingresos/egresos`.
- [ ] Actualizar layout a Grid 2 columnas (Gráfica Top 15 / Tabla Completa).
- [ ] Corregir CSS de tablas: contenedores `min-h-0` para sticky headers funcionales.
- [ ] Verificar que los Modals de Drilldown propaguen los filtros de ingresos/egresos a la API.
