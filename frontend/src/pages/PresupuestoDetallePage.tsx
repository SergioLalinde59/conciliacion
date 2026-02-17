import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Plus, SlidersHorizontal, Save, X, Eye, Search, LayoutList, TrendingUp, TrendingDown, Wallet, Loader2, ChevronDown } from 'lucide-react'
import { DataTableSortIcon } from '../components/atoms/DataTableSortIcon'
import { presupuestoService } from '../services/presupuesto.service'
import { centrosCostosService, conceptosService } from '../services/catalogs.service'
import { Button } from '../components/atoms/Button'
import { CsvExportButton } from '../components/molecules/CsvExportButton'
import { PresupuestoAjusteModal } from '../components/organisms/modals/PresupuestoAjusteModal'
import { CurrencyDisplay } from '../components/atoms/CurrencyDisplay'
import { SemaforoBadge } from '../components/atoms/SemaforoBadge'
import { FiltrosReporte } from '../components/organisms/FiltrosReporte'
import { StatCard } from '../components/molecules/StatCard'
import { BudgetComparisonBars } from '../components/organisms/BudgetComparisonBars'
import { useConfiguracionExclusion } from '../hooks/useReportes'
import { usePresupuestoVersiones } from '../hooks/usePresupuesto'
import { formatCompact } from '../utils/formatters'
import type { Presupuesto, ComparacionPresupuesto, ResumenMensualPresupuesto } from '../types/Presupuesto'
import type { CentroCosto, Concepto } from '../types'

const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// --- Utilidades ---

type SortDir = 'asc' | 'desc'

const SortHeader = ({ label, sortKey, currentKey, currentDir, onSort, align = 'left' }: {
    label: string; sortKey: string; currentKey: string; currentDir: SortDir
    onSort: (key: string) => void; align?: 'left' | 'right' | 'center'
}) => (
    <th
        className={`px-3 py-2 cursor-pointer select-none hover:bg-gray-100/50 transition-colors ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}
        onClick={() => onSort(sortKey)}
    >
        <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
            <span className="font-bold text-gray-400 capitalize text-[10px] tracking-wide">{label}</span>
            <DataTableSortIcon active={currentKey === sortKey} direction={currentKey === sortKey ? currentDir : null} size={12} />
        </div>
    </th>
)

const useSort = (defaultKey: string, defaultDir: SortDir = 'desc') => {
    const [sortKey, setSortKey] = useState(defaultKey)
    const [sortDir, setSortDir] = useState<SortDir>(defaultDir)
    const toggle = (key: string) => {
        if (sortKey === key) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortKey(key)
            setSortDir(key === 'nombre' || key === 'mes' || key === 'mes_nombre' ? 'asc' : 'desc')
        }
    }
    return { sortKey, sortDir, toggle }
}

// --- Componente principal ---

export const PresupuestoDetallePage = () => {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const presupuestoId = parseInt(id || '0')

    const [presupuesto, setPresupuesto] = useState<Presupuesto | null>(null)
    const [ccData, setCCData] = useState<ComparacionPresupuesto[]>([])
    const [loading, setLoading] = useState(true)
    const [centrosCostos, setCentrosCostos] = useState<CentroCosto[]>([])
    const [conceptos, setConceptos] = useState<Concepto[]>([])

    // Filtros
    const currentMonth = new Date().getMonth() + 1
    const currentYear = new Date().getFullYear()
    const [mesDesde, setMesDesde] = useState(1)
    const [mesHasta, setMesHasta] = useState(currentMonth)
    const [selectedRange, setSelectedRange] = useState('YTD')
    const [terceroId, setTerceroId] = useState('')
    const [centroCostoId, setCentroCostoId] = useState('')
    const [conceptoId, setConceptoId] = useState('')
    const [mostrarIngresos, setMostrarIngresos] = useState(true)
    const [mostrarEgresos, setMostrarEgresos] = useState(true)
    const [busqueda, setBusqueda] = useState('')
    const ccSort = useSort('ejecutado')

    // CC Exclusion
    const { data: configExclusion = [], isFetched: exclusionConfigLoaded } = useConfiguracionExclusion()
    const [centrosCostosExcluidos, setCentrosCostosExcluidos] = useState<number[] | null>(null)
    const actualCentrosCostosExcluidos = useMemo(() => centrosCostosExcluidos ?? [], [centrosCostosExcluidos])

    useEffect(() => {
        if (exclusionConfigLoaded && centrosCostosExcluidos === null) {
            const defaults = configExclusion.filter(d => d.activo_por_defecto).map(d => d.centro_costo_id)
            setCentrosCostosExcluidos(defaults)
        }
    }, [configExclusion, centrosCostosExcluidos, exclusionConfigLoaded])

    // Modales drilldown
    const [conceptoModal, setConceptoModal] = useState<{
        isOpen: boolean; ccId: number; ccName: string; data: ComparacionPresupuesto[]; loading: boolean
    }>({ isOpen: false, ccId: 0, ccName: '', data: [], loading: false })

    const [terceroModal, setTerceroModal] = useState<{
        isOpen: boolean; ccId: number; ccName: string
        conceptoId: number | null; conceptoName: string; data: ComparacionPresupuesto[]; loading: boolean
    }>({ isOpen: false, ccId: 0, ccName: '', conceptoId: null, conceptoName: '', data: [], loading: false })

    const [mesesModal, setMesesModal] = useState<{
        isOpen: boolean; ccName: string; conceptoName: string
        terceroName: string; data: ResumenMensualPresupuesto[]; loading: boolean
    }>({ isOpen: false, ccName: '', conceptoName: '', terceroName: '', data: [], loading: false })

    // Modales de gestión
    const [ajusteModalOpen, setAjusteModalOpen] = useState(false)
    const [addModalOpen, setAddModalOpen] = useState(false)

    // Form nueva línea
    const [newCcId, setNewCcId] = useState('')
    const [newConceptoId, setNewConceptoId] = useState('')
    const [newMes, setNewMes] = useState('1')
    const [newMonto, setNewMonto] = useState('')
    const [newTipo, setNewTipo] = useState('variable')

    const esBorrador = presupuesto?.estado === 'borrador'
    const { data: versiones = [] } = usePresupuestoVersiones(presupuestoId)
    const [versionDropdownOpen, setVersionDropdownOpen] = useState(false)
    const versionDropdownRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!versionDropdownOpen) return
        const handler = (e: MouseEvent) => {
            if (versionDropdownRef.current && !versionDropdownRef.current.contains(e.target as Node)) {
                setVersionDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [versionDropdownOpen])

    // Init default YTD cuando se carga el presupuesto
    useEffect(() => {
        if (!presupuestoId) return
        Promise.all([
            presupuestoService.obtener(presupuestoId),
            centrosCostosService.listar(),
            conceptosService.listar()
        ]).then(([p, ccs, cons]) => {
            setPresupuesto(p)
            setCentrosCostos(ccs)
            setConceptos(cons)
            // Default YTD si es año actual, sino año completo
            setMesDesde(1)
            setMesHasta(p.anio === currentYear ? currentMonth : 12)
            setSelectedRange(p.anio === currentYear ? 'YTD' : 'Año Completo')
        }).catch(err => {
            console.error(err)
            toast.error('Error cargando datos')
        })
    }, [presupuestoId])

    // --- Fetch CC comparison (presupuesto vs real) ---
    const cargarComparacion = useCallback(async () => {
        if (!presupuestoId || centrosCostosExcluidos === null) return
        setLoading(true)
        try {
            const data = await presupuestoService.comparar(presupuestoId, {
                nivel: 'centro_costo',
                mes_inicio: mesDesde,
                mes_fin: mesHasta,
                centros_costos_excluidos: actualCentrosCostosExcluidos.length ? actualCentrosCostosExcluidos : undefined,
            })
            setCCData(data)
        } catch {
            toast.error('Error cargando comparacion')
        } finally {
            setLoading(false)
        }
    }, [presupuestoId, mesDesde, mesHasta, actualCentrosCostosExcluidos, centrosCostosExcluidos])

    useEffect(() => {
        cargarComparacion()
    }, [cargarComparacion])

    // --- Totals (todos los CCs) ---
    const totales = useMemo(() => {
        return ccData.reduce((acc, d) => ({
            presupuestado: acc.presupuestado + d.presupuestado,
            ejecutado: acc.ejecutado + d.ejecutado,
        }), { presupuestado: 0, ejecutado: 0 })
    }, [ccData])

    const variacionTotal = totales.presupuestado === 0
        ? (totales.ejecutado === 0 ? 0 : 100)
        : ((totales.ejecutado - totales.presupuestado) / Math.abs(totales.presupuestado)) * 100

    // --- Drilldown handlers (fetch on click) ---
    const handleCCClick = async (cc: ComparacionPresupuesto) => {
        setConceptoModal({ isOpen: true, ccId: cc.id!, ccName: `${cc.id} - ${cc.nombre}`, data: [], loading: true })
        try {
            const data = await presupuestoService.comparar(presupuestoId, {
                nivel: 'concepto',
                centro_costo_id: cc.id!,
                mes_inicio: mesDesde,
                mes_fin: mesHasta,
            })
            setConceptoModal(prev => ({ ...prev, data, loading: false }))
        } catch {
            toast.error('Error cargando conceptos')
            setConceptoModal(prev => ({ ...prev, loading: false }))
        }
    }

    const handleConceptoClick = async (item: ComparacionPresupuesto) => {
        setTerceroModal({
            isOpen: true,
            ccId: conceptoModal.ccId,
            ccName: conceptoModal.ccName,
            conceptoId: item.id,
            conceptoName: item.id ? `${item.id} - ${item.nombre}` : item.nombre,
            data: [],
            loading: true
        })
        try {
            const data = await presupuestoService.comparar(presupuestoId, {
                nivel: 'tercero',
                centro_costo_id: conceptoModal.ccId,
                concepto_id: item.id ?? undefined,
                mes_inicio: mesDesde,
                mes_fin: mesHasta,
            })
            setTerceroModal(prev => ({ ...prev, data, loading: false }))
        } catch {
            toast.error('Error cargando terceros')
            setTerceroModal(prev => ({ ...prev, loading: false }))
        }
    }

    const handleTerceroClick = async (item: ComparacionPresupuesto) => {
        setMesesModal({
            isOpen: true,
            ccName: terceroModal.ccName,
            conceptoName: terceroModal.conceptoName,
            terceroName: item.id ? `${item.id} - ${item.nombre}` : item.nombre,
            data: [],
            loading: true
        })
        try {
            const data = await presupuestoService.compararMensual(presupuestoId, {
                centro_costo_id: terceroModal.ccId,
                concepto_id: terceroModal.conceptoId ?? undefined,
                tercero_id: item.id ?? undefined,
            })
            setMesesModal(prev => ({ ...prev, data, loading: false }))
        } catch {
            toast.error('Error cargando detalle mensual')
            setMesesModal(prev => ({ ...prev, loading: false }))
        }
    }

    // --- Limpiar filtros ---
    const handleLimpiar = () => {
        const anio = presupuesto?.anio || currentYear
        setMesDesde(1)
        setMesHasta(anio === currentYear ? currentMonth : 12)
        setTerceroId('')
        setCentroCostoId('')
        setConceptoId('')
        setMostrarIngresos(true)
        setMostrarEgresos(true)
        setBusqueda('')
        if (configExclusion.length > 0) {
            setCentrosCostosExcluidos(configExclusion.filter(d => d.activo_por_defecto).map(d => d.centro_costo_id))
        } else {
            setCentrosCostosExcluidos([])
        }
    }

    // --- Add line handler ---
    const handleAddLine = async () => {
        if (!newCcId || !newMonto) { toast.error('Centro de Costo y Monto son requeridos'); return }
        try {
            await presupuestoService.crearDetalle(presupuestoId, {
                centro_costo_id: parseInt(newCcId),
                concepto_id: newConceptoId ? parseInt(newConceptoId) : undefined,
                mes: parseInt(newMes),
                monto_presupuestado: parseFloat(newMonto),
                tipo: newTipo
            })
            toast.success('Linea agregada')
            setAddModalOpen(false)
            setNewCcId(''); setNewConceptoId(''); setNewMes('1'); setNewMonto(''); setNewTipo('variable')
            cargarComparacion()
        } catch (err: any) {
            toast.error(err.message || 'Error al agregar linea')
        }
    }

    // CSV from CC comparison
    const csvColumns = [
        { key: 'nombre' as const, label: 'Centro Costo' },
        { key: 'presupuestado' as const, label: 'Presupuestado' },
        { key: 'ejecutado' as const, label: 'Ejecutado' },
        { key: 'variacion_pct' as const, label: 'Var %' },
        { key: 'semaforo' as const, label: 'Estado' },
    ]

    const estadoBadge = (estado: string) => {
        const config: Record<string, string> = {
            borrador: 'bg-gray-100 text-gray-700',
            activo: 'bg-emerald-100 text-emerald-700',
            cerrado: 'bg-rose-100 text-rose-700',
        }
        return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config[estado] || config.borrador}`}>{estado}</span>
    }

    return (
        <div className="flex flex-col h-full bg-slate-50/50 overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-2 bg-white">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/presupuestos')} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-gray-900">
                                {presupuesto?.nombre || 'Detalle Presupuesto'}
                            </h1>
                            {presupuesto && estadoBadge(presupuesto.estado)}
                            {presupuesto && presupuesto.version_actual > 1 && (
                                <div className="relative" ref={versionDropdownRef}>
                                    <button
                                        onClick={() => setVersionDropdownOpen(!versionDropdownOpen)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold hover:bg-purple-100 transition-colors"
                                    >
                                        v{presupuesto.version_actual}
                                        <ChevronDown size={12} className={`transition-transform ${versionDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    {versionDropdownOpen && versiones.length > 0 && (
                                        <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-xl shadow-lg border border-gray-200 z-50 py-1">
                                            <div className="px-3 py-2 border-b border-gray-100">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Historial de versiones</p>
                                            </div>
                                            {versiones.map(v => (
                                                <div
                                                    key={v.version}
                                                    className={`px-3 py-2 text-xs ${v.version === presupuesto.version_actual ? 'bg-purple-50' : 'hover:bg-gray-50'}`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-semibold text-gray-700">
                                                            v{v.version}
                                                            {v.version === presupuesto.version_actual && (
                                                                <span className="ml-1.5 text-[10px] text-purple-600 font-bold">ACTUAL</span>
                                                            )}
                                                        </span>
                                                        <span className="text-gray-400 text-[10px]">
                                                            {v.created_at ? new Date(v.created_at).toLocaleDateString('es-CO') : ''}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-0.5 text-gray-500">
                                                        <span>{v.lineas_generadas} líneas</span>
                                                        <span>{formatCompact(v.total_presupuestado)}</span>
                                                        {v.notas && <span className="truncate">{v.notas}</span>}
                                                    </div>
                                                </div>
                                            ))}
                                            {versiones.length > 1 && (
                                                <button
                                                    onClick={() => { setVersionDropdownOpen(false); navigate(`/presupuestos/${presupuestoId}/comparar-versiones`) }}
                                                    className="w-full px-3 py-2 text-xs font-semibold text-purple-600 hover:bg-purple-50 border-t border-gray-100 text-left transition-colors"
                                                >
                                                    Comparar versiones
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <p className="text-gray-500 text-sm mt-1">
                            Ano {presupuesto?.anio} — {ccData.length} centros de costo
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <CsvExportButton data={ccData} columns={csvColumns} filenamePrefix={`presupuesto_${presupuestoId}_comparacion`} />
                        {esBorrador && (
                            <>
                                <Button variant="secondary" icon={SlidersHorizontal} onClick={() => setAjusteModalOpen(true)}>
                                    Ajuste %
                                </Button>
                                <Button icon={Plus} onClick={() => setAddModalOpen(true)}>
                                    Nueva Linea
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Botones de rango mensual */}
            <div className="bg-white/90 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-30 px-6 py-3 shadow-sm">
                <div className="flex items-center gap-2 flex-wrap">
                    {([
                        { label: 'Mes Actual', d: currentMonth, h: currentMonth },
                        { label: 'Mes Ant.', d: Math.max(1, currentMonth - 1), h: Math.max(1, currentMonth - 1) },
                        { label: 'Últ. 3 Meses', d: currentMonth - 2, h: currentMonth, minMonth: 4 },
                        { label: 'Últ. 6 Meses', d: currentMonth - 5, h: currentMonth, minMonth: 7 },
                        { label: 'YTD', d: 1, h: currentMonth },
                        { label: 'Año Completo', d: 1, h: 12 },
                    ] as { label: string; d: number; h: number; minMonth?: number }[]).map(btn => {
                        const isActive = selectedRange === btn.label
                        const disabled = !!btn.minMonth && currentMonth < btn.minMonth
                        return (
                            <Button
                                key={btn.label}
                                variant={isActive ? 'primary' : 'secondary'}
                                size="sm"
                                disabled={disabled}
                                onClick={() => { if (!disabled) { setMesDesde(btn.d); setMesHasta(btn.h); setSelectedRange(btn.label) } }}
                                className={`${isActive
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-100 font-bold scale-105'
                                    : disabled
                                        ? 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed'
                                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300 font-medium'
                                } transition-all duration-200 text-[11px] px-3 py-1.5 rounded-lg border`}
                            >
                                {btn.label}
                            </Button>
                        )
                    })}
                    <span className="ml-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {MESES[mesDesde]} - {MESES[mesHasta]} {presupuesto?.anio}
                    </span>
                </div>

                {/* Filtros avanzados */}
                <FiltrosReporte
                    terceroId={terceroId} setTerceroId={setTerceroId}
                    centroCostoId={centroCostoId} setCentroCostoId={setCentroCostoId}
                    conceptoId={conceptoId} setConceptoId={setConceptoId}
                    configuracionExclusion={configExclusion}
                    centrosCostosExcluidos={actualCentrosCostosExcluidos}
                    setCentrosCostosExcluidos={setCentrosCostosExcluidos}
                    mostrarIngresos={mostrarIngresos}
                    setMostrarIngresos={setMostrarIngresos}
                    mostrarEgresos={mostrarEgresos}
                    setMostrarEgresos={setMostrarEgresos}
                    onLimpiar={handleLimpiar}
                    showIngresosEgresos={true}
                    showClasificacionFilters={true}
                    soloConciliables={false}
                />
            </div>

            {/* Contenido */}
            <div className="flex-1 min-h-0 p-4 space-y-4 overflow-auto">
                {/* StatCards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        label="Centros de Costo"
                        value={ccData.length}
                        icon={<LayoutList className="w-5 h-5" />}
                        colorClass="text-slate-600"
                        bgColorClass="bg-slate-50"
                        borderColor="group-hover:border-slate-300"
                        isCurrency={false}
                        subtitle="Total"
                    />
                    <StatCard
                        label="Total Presupuestado"
                        value={totales.presupuestado}
                        icon={<TrendingUp className="w-5 h-5" />}
                        colorClass="text-blue-600"
                        bgColorClass="bg-blue-50"
                        borderColor="group-hover:border-blue-200"
                        subtitle={`${MESES[mesDesde] || 'Ene'} - ${MESES[mesHasta] || 'Dic'}`}
                    />
                    <StatCard
                        label="Total Ejecutado"
                        value={totales.ejecutado}
                        isEgreso
                        icon={<TrendingDown className="w-5 h-5" />}
                        colorClass="text-rose-600"
                        bgColorClass="bg-rose-50"
                        borderColor="group-hover:border-rose-200"
                        subtitle={`${MESES[mesDesde] || 'Ene'} - ${MESES[mesHasta] || 'Dic'}`}
                    />
                    <StatCard
                        label="Variacion"
                        value={totales.ejecutado - totales.presupuestado}
                        trend={totales.presupuestado !== 0 ? variacionTotal : null}
                        isEgreso
                        icon={<Wallet className="w-5 h-5" />}
                        colorClass={variacionTotal > (presupuesto?.semaforo_amarillo_hasta ?? 15) ? 'text-rose-600' : variacionTotal > (presupuesto?.semaforo_verde_hasta ?? 5) ? 'text-amber-600' : 'text-emerald-600'}
                        bgColorClass="bg-indigo-50"
                        borderColor="group-hover:border-indigo-200"
                        subtitle="Ejecutado - Presupuestado"
                    />
                </div>

                {/* Gráfico de barras CC */}
                <BudgetComparisonBars
                    data={ccData}
                    loading={loading}
                    busqueda={busqueda}
                    setBusqueda={setBusqueda}
                    sortKey={ccSort.sortKey}
                    sortDir={ccSort.sortDir}
                    onSort={ccSort.toggle}
                    onRowClick={handleCCClick}
                />
            </div>

            {/* Modal Drilldown: Conceptos */}
            {conceptoModal.isOpen && (
                <PresupuestoDrilldownModal
                    title="Conceptos"
                    breadcrumb={[{ label: 'Presupuesto' }, { label: conceptoModal.ccName, color: 'text-indigo-600' }]}
                    data={conceptoModal.data}
                    loading={conceptoModal.loading}
                    onClose={() => setConceptoModal(prev => ({ ...prev, isOpen: false }))}
                    onRowClick={handleConceptoClick}
                    clickable
                />
            )}

            {/* Modal Drilldown: Terceros */}
            {terceroModal.isOpen && (
                <PresupuestoDrilldownModal
                    title="Terceros"
                    breadcrumb={[
                        { label: 'Presupuesto' },
                        { label: terceroModal.ccName, color: 'text-indigo-600' },
                        { label: terceroModal.conceptoName, color: 'text-purple-600' },
                    ]}
                    data={terceroModal.data}
                    loading={terceroModal.loading}
                    onClose={() => setTerceroModal(prev => ({ ...prev, isOpen: false }))}
                    onRowClick={handleTerceroClick}
                    clickable
                />
            )}

            {/* Modal Drilldown: Meses */}
            {mesesModal.isOpen && (
                <MesesDrilldownModal
                    breadcrumb={[
                        { label: 'Presupuesto' },
                        { label: mesesModal.ccName, color: 'text-indigo-600' },
                        { label: mesesModal.conceptoName, color: 'text-purple-600' },
                        { label: mesesModal.terceroName, color: 'text-amber-600' },
                    ]}
                    data={mesesModal.data}
                    loading={mesesModal.loading}
                    onClose={() => setMesesModal(prev => ({ ...prev, isOpen: false }))}
                />
            )}

            {/* Modal Ajuste */}
            <PresupuestoAjusteModal
                isOpen={ajusteModalOpen}
                presupuestoId={presupuestoId}
                onClose={() => setAjusteModalOpen(false)}
                onSuccess={() => { setAjusteModalOpen(false); cargarComparacion() }}
            />

            {/* Modal Agregar Linea */}
            {addModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
                        <div className="flex justify-between items-center p-4 border-b border-gray-100">
                            <h3 className="text-lg font-semibold text-gray-900">Nueva Linea de Presupuesto</h3>
                            <button onClick={() => setAddModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-full">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider ml-0.5">Centro de Costo *</label>
                                <select value={newCcId} onChange={e => setNewCcId(e.target.value)}
                                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                                    <option value="">Seleccione...</option>
                                    {centrosCostos.map(cc => <option key={cc.id} value={cc.id}>{cc.id} - {cc.nombre}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider ml-0.5">Concepto</label>
                                <select value={newConceptoId} onChange={e => setNewConceptoId(e.target.value)}
                                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                                    <option value="">Sin concepto</option>
                                    {conceptos.map(c => <option key={c.id} value={c.id}>{c.id} - {c.nombre}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider ml-0.5">Mes *</label>
                                    <select value={newMes} onChange={e => setNewMes(e.target.value)}
                                        className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                            <option key={m} value={m}>{MESES[m]}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider ml-0.5">Tipo</label>
                                    <select value={newTipo} onChange={e => setNewTipo(e.target.value)}
                                        className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                                        <option value="variable">Variable</option>
                                        <option value="fijo">Fijo</option>
                                        <option value="estacional">Estacional</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider ml-0.5">Monto Presupuestado *</label>
                                <input
                                    type="number"
                                    value={newMonto}
                                    onChange={e => setNewMonto(e.target.value)}
                                    placeholder="0.00"
                                    step="0.01"
                                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 p-4 border-t border-gray-100 bg-gray-50">
                            <Button variant="secondary" onClick={() => setAddModalOpen(false)}>Cancelar</Button>
                            <Button onClick={handleAddLine} icon={Save} disabled={!newCcId || !newMonto}>Guardar</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ============================================================
// Modal drilldown generico (Conceptos / Terceros)
// ============================================================

interface BreadcrumbItem {
    label: string
    color?: string
}

interface PresupuestoDrilldownModalProps {
    title: string
    breadcrumb: BreadcrumbItem[]
    data: ComparacionPresupuesto[]
    loading?: boolean
    onClose: () => void
    onRowClick: (item: ComparacionPresupuesto) => void
    clickable?: boolean
}

const PresupuestoDrilldownModal = ({ title, breadcrumb, data, loading, onClose, onRowClick, clickable }: PresupuestoDrilldownModalProps) => {
    const [q, setQ] = useState('')
    const sort = useSort('presupuestado')
    const filtered = useMemo(() => {
        const result = data.filter(d => d.nombre.toLowerCase().includes(q.toLowerCase()))
        return [...result].sort((a, b) => {
            const factor = sort.sortDir === 'asc' ? 1 : -1
            if (sort.sortKey === 'nombre') return factor * a.nombre.localeCompare(b.nombre)
            const aVal = (a as any)[sort.sortKey] ?? 0
            const bVal = (b as any)[sort.sortKey] ?? 0
            return factor * (aVal - bVal)
        })
    }, [data, q, sort.sortKey, sort.sortDir])
    const totalPresup = filtered.reduce((s, r) => s + r.presupuestado, 0)
    const totalEjec = filtered.reduce((s, r) => s + r.ejecutado, 0)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <div className="w-full max-w-4xl h-[650px] bg-white shadow-2xl flex flex-col animate-in zoom-in duration-300 rounded-3xl overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">
                                {breadcrumb.map((b, i) => (
                                    <span key={i} className="flex items-center gap-1">
                                        {i > 0 && <span className="mx-1 opacity-30">/</span>}
                                        <span className={b.color || ''}>{b.label}</span>
                                    </span>
                                ))}
                            </div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">{title}</h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search + Totals */}
                <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" placeholder="Buscar..." className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl outline-none" value={q} onChange={e => setQ(e.target.value)} autoFocus />
                    </div>
                    <div className="flex gap-4 text-right">
                        <div><p className="text-[9px] text-slate-400 font-bold capitalize">Presupuestado</p><p className="text-xs font-mono text-blue-600 font-bold"><CurrencyDisplay value={totalPresup} colorize={false} decimals={0} /></p></div>
                        <div><p className="text-[9px] text-slate-400 font-bold capitalize">Ejecutado</p><p className="text-xs font-mono text-rose-600 font-bold"><CurrencyDisplay value={totalEjec} colorize={false} decimals={0} /></p></div>
                        <div><p className="text-[9px] text-slate-400 font-bold capitalize">Variacion</p><p className="text-xs font-mono font-bold"><CurrencyDisplay value={totalEjec - totalPresup} decimals={0} /></p></div>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-slate-400">
                            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando...
                        </div>
                    ) : (
                        <table className="w-full text-xs">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <SortHeader label="Nombre" sortKey="nombre" currentKey={sort.sortKey} currentDir={sort.sortDir} onSort={sort.toggle} />
                                    <SortHeader label="Presup." sortKey="presupuestado" currentKey={sort.sortKey} currentDir={sort.sortDir} onSort={sort.toggle} align="right" />
                                    <SortHeader label="Ejecutado" sortKey="ejecutado" currentKey={sort.sortKey} currentDir={sort.sortDir} onSort={sort.toggle} align="right" />
                                    <SortHeader label="Estado" sortKey="variacion_pct" currentKey={sort.sortKey} currentDir={sort.sortDir} onSort={sort.toggle} align="center" />
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={4} className="text-center py-8 text-gray-400">Sin datos</td></tr>
                                ) : filtered.map((row, idx) => (
                                    <tr
                                        key={row.id ?? idx}
                                        className={`border-b border-gray-50 hover:bg-blue-50/30 transition-colors ${clickable ? 'cursor-pointer' : ''}`}
                                        onClick={() => clickable && onRowClick(row)}
                                    >
                                        <td className="px-3 py-2">
                                            <div className="flex items-center gap-2 group">
                                                {clickable && (
                                                    <div className="w-5 h-5 rounded bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                                        <Eye className="w-3 h-3" />
                                                    </div>
                                                )}
                                                <span className="font-bold text-slate-700 uppercase tracking-tight">
                                                    {row.id ? `${row.id} - ${row.nombre}` : row.nombre}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono text-blue-600">
                                            <CurrencyDisplay value={row.presupuestado} colorize={false} decimals={0} />
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono text-rose-600">
                                            <CurrencyDisplay value={row.ejecutado} colorize={false} decimals={0} />
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            <SemaforoBadge valor={row.semaforo} variacionPct={row.variacion_pct} size="sm" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    )
}

// ============================================================
// Modal drilldown: Meses (presupuesto vs real mensual)
// ============================================================

interface MesesDrilldownModalProps {
    breadcrumb: BreadcrumbItem[]
    data: ResumenMensualPresupuesto[]
    loading?: boolean
    onClose: () => void
}

const MesesDrilldownModal = ({ breadcrumb, data, loading, onClose }: MesesDrilldownModalProps) => {
    const sort = useSort('mes', 'asc')
    const totalPresup = data.reduce((s, m) => s + m.presupuestado, 0)
    const totalEjec = data.reduce((s, m) => s + m.ejecutado, 0)

    const sorted = useMemo(() => {
        return [...data].sort((a, b) => {
            const factor = sort.sortDir === 'asc' ? 1 : -1
            if (sort.sortKey === 'mes_nombre') return factor * a.mes_nombre.localeCompare(b.mes_nombre)
            const aVal = (a as any)[sort.sortKey] ?? 0
            const bVal = (b as any)[sort.sortKey] ?? 0
            return factor * (aVal - bVal)
        })
    }, [data, sort.sortKey, sort.sortDir])

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300 p-4">
            <div className="w-full max-w-4xl h-[650px] bg-white shadow-2xl flex flex-col animate-in zoom-in duration-300 rounded-3xl overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">
                                {breadcrumb.map((b, i) => (
                                    <span key={i} className="flex items-center gap-1">
                                        {i > 0 && <span className="mx-1 opacity-30">/</span>}
                                        <span className={b.color || ''}>{b.label}</span>
                                    </span>
                                ))}
                            </div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">Detalle Mensual</h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Totals */}
                <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-end">
                    <div className="flex gap-4 text-right">
                        <div><p className="text-[9px] text-slate-400 font-bold capitalize">Presupuestado</p><p className="text-xs font-mono text-blue-600 font-bold"><CurrencyDisplay value={totalPresup} colorize={false} decimals={0} /></p></div>
                        <div><p className="text-[9px] text-slate-400 font-bold capitalize">Ejecutado</p><p className="text-xs font-mono text-rose-600 font-bold"><CurrencyDisplay value={totalEjec} colorize={false} decimals={0} /></p></div>
                        <div><p className="text-[9px] text-slate-400 font-bold capitalize">Variacion</p><p className="text-xs font-mono font-bold"><CurrencyDisplay value={totalEjec - totalPresup} decimals={0} /></p></div>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-slate-400">
                            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando...
                        </div>
                    ) : (
                        <table className="w-full text-xs">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <SortHeader label="Mes" sortKey="mes" currentKey={sort.sortKey} currentDir={sort.sortDir} onSort={sort.toggle} />
                                    <SortHeader label="Presupuestado" sortKey="presupuestado" currentKey={sort.sortKey} currentDir={sort.sortDir} onSort={sort.toggle} align="right" />
                                    <SortHeader label="Ejecutado" sortKey="ejecutado" currentKey={sort.sortKey} currentDir={sort.sortDir} onSort={sort.toggle} align="right" />
                                    <SortHeader label="Estado" sortKey="variacion_pct" currentKey={sort.sortKey} currentDir={sort.sortDir} onSort={sort.toggle} align="center" />
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.length === 0 ? (
                                    <tr><td colSpan={4} className="text-center py-8 text-gray-400">Sin datos</td></tr>
                                ) : sorted.map(d => (
                                    <tr key={d.mes} className="border-b border-gray-50 hover:bg-slate-50/50 transition-colors">
                                        <td className="px-3 py-2.5 font-medium text-slate-700">
                                            {d.mes_nombre}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono text-blue-600">
                                            <CurrencyDisplay value={d.presupuestado} colorize={false} decimals={0} />
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono text-rose-600">
                                            <CurrencyDisplay value={d.ejecutado} colorize={false} decimals={0} />
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                            <SemaforoBadge valor={d.semaforo} variacionPct={d.variacion_pct} size="sm" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    )
}
