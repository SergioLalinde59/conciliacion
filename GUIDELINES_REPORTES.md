# Estándar de Reportes de Inteligencia de Negocios

Este documento define el patrón de diseño y funcionalidad para los reportes interactivos del sistema. Debe utilizarse como base de referencia ('Copy-Paste Reference') para crear o refactorizar reportes.

La referencia de implementación actual es: `frontend/src/pages/ReporteEgresosCentroCostoPage.tsx`.

## 1. Definición de Tipos e Interfaces

Estandarizar las interfaces para los niveles de desglose y el estado de los modales.

```tsx
interface ItemDesglose {
    id: number
    nombre: string
    ingresos: number
    egresos: number
    saldo: number
    // ... otros campos
}

interface DrilldownLevel {
    level: 'centro_costo' | 'tercero' | 'concepto' // Ajustar según reporte
    title: string
    parentId?: number
    grandParentId?: number
    data: ItemDesglose[]
    isOpen: boolean
    sortAsc: boolean
    sortField: string
}

type SortField = 'nombre' | 'ingresos' | 'egresos' | 'saldo'
```

## 2. Gestión de Estado y Filtros

Utilizar `useSessionStorage` para persistencia de filtros principales y `useState` para el estado local (ordenamiento, modales).

```tsx
export const ReporteEstandarPage = () => {
    // 1. Filtros Persistentes
    const [desde, setDesde] = useSessionStorage('rep_std_desde', getMesActual().inicio)
    const [hasta, setHasta] = useSessionStorage('rep_std_hasta', getMesActual().fin)
    const [cuentaId, setCuentaId] = useSessionStorage('rep_std_cuentaId', '')
    
    // Clasificaciones
    const [terceroId, setTerceroId] = useSessionStorage('rep_std_terceroId', '')
    const [centroCostoId, setCentroCostoId] = useSessionStorage('rep_std_centroCostoId', '')
    const [conceptoId, setConceptoId] = useSessionStorage('rep_std_conceptoId', '')
    
    // Toggles Visuales
    const [mostrarIngresos, setMostrarIngresos] = useSessionStorage('rep_std_ingresos', false)
    const [mostrarEgresos, setMostrarEgresos] = useSessionStorage('rep_std_egresos', true)

    // 2. Exclusiones Dinámicas
    const [centrosCostosExcluidos, setCentrosCostosExcluidos] = useSessionStorage<number[] | null>('rep_std_excluidos', null)
    const actualCentrosCostosExcluidos = centrosCostosExcluidos || []
    const { data: configuracionExclusion = [] } = useConfiguracionExclusion()

    // Cargar exclusiones por defecto
    useEffect(() => {
        if (configuracionExclusion.length > 0 && centrosCostosExcluidos === null) {
            const defaults = (configuracionExclusion as ConfigFiltroExclusion[])
                .filter(d => d.activo_por_defecto)
                .map(d => d.centro_costo_id)
            setCentrosCostosExcluidos(defaults)
        }
    }, [configuracionExclusion, centrosCostosExcluidos, setCentrosCostosExcluidos])

    // 3. Estado de Modales (Drilldown)
    const [modalState, setModalState] = useState<DrilldownLevel>({
        level: 'tercero',
        title: '',
        data: [],
        isOpen: false,
        sortAsc: false,
        sortField: 'egresos'
    })
```

## 3. Obtención y Procesamiento de Datos

Usar hooks dedicados para la data principal y `useMemo` para ordenamiento en cliente.

```tsx
    // Parámetros para el hook
    const paramsReporte = {
        nivel: 'centro_costo', // Nivel inicial
        fecha_inicio: desde,
        fecha_fin: hasta,
        cuenta_id: cuentaId ? Number(cuentaId) : undefined,
        tercero_id: terceroId ? Number(terceroId) : undefined,
        centro_costo_id: centroCostoId ? Number(centroCostoId) : undefined,
        concepto_id: conceptoId ? Number(conceptoId) : undefined,
        centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined
    }

    const { data: rawData, isLoading } = useReporteDesgloseGastos(paramsReporte)
    
    // Lógica de Ordenamiento (Reutilizable)
    const sortData = (data: ItemDesglose[], field: SortField, asc: boolean) => {
        return [...data].sort((a, b) => {
            if (field === 'nombre') {
                return asc ? a.nombre.localeCompare(b.nombre) : b.nombre.localeCompare(a.nombre)
            }
            const valueA = a[field as keyof ItemDesglose] as number
            const valueB = b[field as keyof ItemDesglose] as number
            return asc ? valueA - valueB : valueB - valueA
        })
    }

    // Datos Ordenados para Tabla Principal
    const sortedData = useMemo(() => {
        return sortData((rawData as ItemDesglose[]) || [], sortField, sortAsc)
    }, [rawData, sortField, sortAsc])
```

## 4. Estructura Visual y Componentes

### Layout Principal

El layout debe ser limpio, con un header de filtros, estadísticas totales y una tabla principal contenida en un área de altura fija y estilos `min-h-0` para permitir scroll interno.

```tsx
    return (
        <div className="max-w-7xl mx-auto pb-12">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Título del Reporte</h1>
                <p className="text-gray-500 text-sm mt-1">Descripción corta</p>
            </div>

            {/* 1. Filtros */}
            <FiltrosReporte
                desde={desde}
                onDesdeChange={setDesde}
                hasta={hasta}
                onHastaChange={setHasta}
                // ... pasar resto de props de estado y setters (onCuentaChange, etc)
                configuracionExclusion={configuracionExclusion}
                centrosCostosExcluidos={actualCentrosCostosExcluidos}
                onCentrosCostosExcluidosChange={setCentrosCostosExcluidos}
                onLimpiar={handleLimpiar}
            />

            {/* 2. Estadísticas */}
            <EstadisticasTotales
                ingresos={totales.ingresos}
                egresos={totales.egresos}
                saldo={totales.saldo}
            />

            {/* 3. Tabla Principal Stick Header Agrupada */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="px-4 py-2 border-b border-gray-50 bg-gray-50 rounded-t-xl">
                   <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Detalle</h3>
                </div>

                <div style={{ height: '700px', display: 'flex', flexDirection: 'column', background: '#fcfcfc' }}>
                    <DataTable
                        data={sortedData}
                        columns={columns}
                        getRowKey={(row) => row.id}
                        loading={isLoading}
                        stickyHeader={true}
                        rowPy="py-1" // Filas compactas
                        rounded={false}
                        className="flex-1 overflow-y-auto w-full scrollbar-thin"
                        style={{ height: '100%' }}
                    />
                </div>
            </div>

            {/* 4. Modals */}
            <Modal modalState={modalState} setModalState={setModalState} />
        </div>
    )
```

### Componente Modal Interno

Definir un componente `Modal` dentro del archivo de la página para encapsular la lógica de visualización de drilldowns. Este modal debe:
1.  Manejar su propio ordenamiento.
2.  Recalcular totales de los datos mostrados.
3.  Utilizar `DataTable` con las mismas propiedades de diseño (compacto, sticky).

```tsx
    const Modal = ({ modalState, setModalState, onRowClick }: { ... }) => {
        if (!modalState.isOpen) return null
        
        // ... Lógica de renderizado (Header, Totales Summary, DataTable)
        // Ver implementación en ReporteEgresosCentroCostoPage.tsx
    }
```

## 5. Patrón Drilldown (Interactividad)

Para navegar entre niveles (ej. Centro Costo -> Tercero -> Concepto), manejar el click en la fila (`onRowClick`) para actualizar el estado del modal correspondiente y disparar la carga de datos.

```tsx
    const handleNivelSuperiorClick = (item: ItemDesglose) => {
        // 1. Configurar Modal
        setProximoNivelModal({
            level: 'tercero',
            title: `Subnivel para: ${item.nombre}`,
            parentId: item.id,
            data: [], // Limpiar data previa
            isOpen: true,
            // ... defaults sort
        })

        // 2. Fetch Data (API Directa)
        apiService.movimientos.reporteDesgloseGastos({
            nivel: 'tercero', // Siguiente nivel
            fecha_inicio: desde,
            fecha_fin: hasta,
            centro_costo_id: item.id, // Pasar contexto padre
            // ... pasar resto de filtros activos
        } as any).then(data => {
            setProximoNivelModal(prev => ({ ...prev, data: data || [] }))
        })
    }
```

## 6. Configuración de Columnas (DataTable)

*   **CurrencyDisplay**: Usar `showCurrency={false}` en tablas densas para reducir ruido visual, y `showCurrency={true}` en cabeceras de totales.
*   **Alineación**: Números siempre `align: 'right'`.
*   **Acciones**: Incluir columna de acción explicita (ChevronRight) para indicar interactividad.

```tsx
    const createColumns = (onRowClick) => [
        { 
            key: 'nombre', 
            accessor: (row) => <span onClick={() => onRowClick(row)} ...>{row.nombre}</span> 
        },
        { 
            key: 'egresos', 
            align: 'right', 
            accessor: (row) => <CurrencyDisplay value={-row.egresos} showCurrency={false} /> 
        }
        // ...
    ]
```
