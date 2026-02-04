import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutList, Plus, Search, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'

import type { Movimiento } from '../types'
import { apiService } from '../services/api'
import { useSessionStorage } from '../hooks/useSessionStorage'
import { getMesActual, getPreviousPeriod } from '../utils/dateUtils'
import { FiltrosReporte } from '../components/organisms/FiltrosReporte'
// import { EstadisticasTotales } from '../components/organisms/EstadisticasTotales' // Removed usage
import { MovimientosTable } from '../components/organisms/MovimientosTable'
import { MovimientoModal } from '../components/organisms/modals/MovimientoModal'
import { useReporteClasificacion, useConfiguracionExclusion } from '../hooks/useReportes'
import { CurrencyDisplay } from '../components/atoms/CurrencyDisplay'
import toast from 'react-hot-toast'

export const MovimientosPage = () => {
    const navigate = useNavigate()
    const lastRequestRef = useRef<number>(0)

    // Filtros persistentes con useSessionStorage
    const [desde, setDesde] = useSessionStorage('filtro_desde', getMesActual().inicio)
    const [hasta, setHasta] = useSessionStorage('filtro_hasta', getMesActual().fin)
    const [cuentaId, setCuentaId] = useSessionStorage('filtro_cuentaId', '')
    const [terceroId, setTerceroId] = useSessionStorage('filtro_terceroId', '')
    const [centroCostoId, setCentroCostoId] = useSessionStorage('filtro_centroCostoId', '')
    const [conceptoId, setConceptoId] = useSessionStorage('filtro_conceptoId', '')
    const [mostrarIngresos, setMostrarIngresos] = useSessionStorage('filtro_mostrarIngresos', true)
    const [mostrarEgresos, setMostrarEgresos] = useSessionStorage('filtro_mostrarEgresos', true)
    const [busqueda, setBusqueda] = useState('')

    // Dynamic Exclusion Logic
    const { data: configExclusion = [] } = useConfiguracionExclusion()
    const [centrosCostosExcluidos, setCentrosCostosExcluidos] = useSessionStorage<number[] | null>('filtro_centrosCostosExcluidos', null)

    const actualCentrosCostosExcluidos = useMemo(() => {
        return (centrosCostosExcluidos || []) as number[]
    }, [centrosCostosExcluidos])

    // Load exclusion defaults
    useEffect(() => {
        if (configExclusion.length > 0 && centrosCostosExcluidos === null) {
            const defaults = configExclusion.filter(d => d.activo_por_defecto).map(d => d.centro_costo_id)
            setCentrosCostosExcluidos(defaults)
        }
    }, [configExclusion, centrosCostosExcluidos])

    const [movimientos, setMovimientos] = useState<Movimiento[]>([])
    const [loading, setLoading] = useState(true)
    const [totalesGlobales, setTotalesGlobales] = useState<{ ingresos: number; egresos: number; saldo: number } | null>(null)
    const [totalPeriodo, setTotalPeriodo] = useState(0)

    // Comparative totals
    const prevPeriod = useMemo(() => getPreviousPeriod(desde, hasta), [desde, hasta])
    const { data: datosAnterior } = useReporteClasificacion({
        tipo: 'totales', desde: prevPeriod.inicio, hasta: prevPeriod.fin,
        cuenta_id: cuentaId ? Number(cuentaId) : undefined,
        centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined
    })

    const totalesAnterior = useMemo(() => {
        if (!datosAnterior || !Array.isArray(datosAnterior) || (datosAnterior as any[]).length === 0) return null
        return (datosAnterior as any[])[0]
    }, [datosAnterior])

    // Handlers
    const cargarMovimientos = useCallback((f_desde?: string, f_hasta?: string) => {
        const finalDesde = f_desde || desde
        const finalHasta = f_hasta || hasta

        if (finalDesde && finalHasta && finalDesde > finalHasta) return

        setLoading(true)
        const requestId = Date.now()
        lastRequestRef.current = requestId

        let tipoMovimiento: string | undefined = undefined
        if (mostrarIngresos && !mostrarEgresos) tipoMovimiento = 'ingresos'
        else if (!mostrarIngresos && mostrarEgresos) tipoMovimiento = 'egresos'

        // 1. Fetch filtered movements
        apiService.movimientos.listar({
            desde: finalDesde, hasta: finalHasta,
            cuenta_id: cuentaId ? Number(cuentaId) : undefined,
            tercero_id: terceroId ? Number(terceroId) : undefined,
            centro_costo_id: centroCostoId ? Number(centroCostoId) : undefined,
            concepto_id: conceptoId ? Number(conceptoId) : undefined,
            centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined,
            tipo_movimiento: tipoMovimiento
        } as any).then(response => {
            if (lastRequestRef.current !== requestId) return
            setMovimientos(response.items)
            if (response.totales) setTotalesGlobales(response.totales)
            setLoading(false)
        }).catch(err => {
            if (lastRequestRef.current !== requestId) return
            console.error("Error cargando movimientos:", err)
            setLoading(false)
        })

        // 2. Fetch total count for period (independent of other filters)
        apiService.movimientos.listar({
            desde: finalDesde,
            hasta: finalHasta,
            limit: 1
        } as any).then(response => {
            if (lastRequestRef.current !== requestId) return
            setTotalPeriodo(response.total)
        }).catch(err => console.error("Error cargando total periodo:", err))

    }, [desde, hasta, cuentaId, terceroId, centroCostoId, conceptoId, mostrarIngresos, mostrarEgresos, actualCentrosCostosExcluidos])


    useEffect(() => {
        cargarMovimientos()
    }, [cargarMovimientos])

    const handleLimpiar = () => {
        const mesActual = getMesActual()
        setDesde(mesActual.inicio)
        setHasta(mesActual.fin)
        setCuentaId('')
        setTerceroId('')
        setCentroCostoId('')
        setConceptoId('')
        if (configExclusion.length > 0) {
            const defaults = configExclusion.filter(d => d.activo_por_defecto).map(d => d.centro_costo_id)
            setCentrosCostosExcluidos(defaults)
        } else {
            setCentrosCostosExcluidos([])
        }
        setMostrarIngresos(true)
        setMostrarEgresos(true)
    }

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [movimientoToDelete, setMovimientoToDelete] = useState<Movimiento | null>(null)
    const [isViewModalOpen, setIsViewModalOpen] = useState(false)
    const [movimientoToView, setMovimientoToView] = useState<Movimiento | null>(null)

    const handleDeleteClick = (mov: Movimiento) => {
        setMovimientoToDelete(mov)
        setIsDeleteModalOpen(true)
    }

    const handleConfirmDelete = async () => {
        if (!movimientoToDelete) return
        try {
            await apiService.movimientos.eliminar(movimientoToDelete.id)
            toast.success('Movimiento eliminado correctamente')
            setIsDeleteModalOpen(false)
            setMovimientoToDelete(null)
            cargarMovimientos()
        } catch (error: any) {
            toast.error(error.message || 'Error al eliminar el movimiento')
        }
    }

    const handleViewClick = (mov: Movimiento) => {
        setMovimientoToView(mov)
        setIsViewModalOpen(true)
    }

    const handleSaveEdit = async (payload: any) => {
        if (!movimientoToView) return
        try {
            await apiService.movimientos.actualizar(movimientoToView.id, payload)
            toast.success('Movimiento actualizado correctamente')
            setIsViewModalOpen(false)
            setMovimientoToView(null)
            cargarMovimientos()
        } catch (error: any) {
            toast.error(error.message || 'Error al actualizar el movimiento')
            throw error
        }
    }

    const totalsDisplay = useMemo(() => {
        if (totalesGlobales) return totalesGlobales
        const sums = movimientos.reduce((acc, m) => {
            if (m.valor > 0) acc.ingresos += m.valor
            else acc.egresos += Math.abs(m.valor)
            return acc
        }, { ingresos: 0, egresos: 0 })
        return { ...sums, saldo: sums.ingresos - sums.egresos }
    }, [movimientos, totalesGlobales])

    const filteredMovimientos = useMemo(() => {
        if (!busqueda) return movimientos
        const lowBus = busqueda.toLowerCase()
        return movimientos.filter(m =>
            m.descripcion?.toLowerCase().includes(lowBus) ||
            m.referencia?.toLowerCase().includes(lowBus) ||
            m.tercero_nombre?.toLowerCase().includes(lowBus)
        )
    }, [movimientos, busqueda])

    const calculateTrend = (current: number, previous?: number) => {
        if (previous === undefined || previous === null || previous === 0) return null
        return ((current - previous) / Math.abs(previous)) * 100
    }

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            {/* Dashboard Header */}
            <div className="px-6 pt-6 pb-2 bg-white flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Movimientos</h1>
                    <p className="text-slate-500 text-sm mt-1">Drilldown Interactivo de Egresos</p>
                </div>
                <button
                    onClick={() => navigate('/movimientos/nuevo')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all font-bold text-sm tracking-tight active:scale-95 no-print"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo Movimiento
                </button>
            </div>

            {/* Header / Filtros */}
            <FiltrosReporte
                desde={desde} setDesde={setDesde}
                hasta={hasta} setHasta={setHasta}
                cuentaId={cuentaId} setCuentaId={setCuentaId}
                terceroId={terceroId} setTerceroId={setTerceroId}
                centroCostoId={centroCostoId} setCentroCostoId={setCentroCostoId}
                conceptoId={conceptoId} setConceptoId={setConceptoId}
                mostrarIngresos={mostrarIngresos} setMostrarIngresos={setMostrarIngresos}
                mostrarEgresos={mostrarEgresos} setMostrarEgresos={setMostrarEgresos}
                configuracionExclusion={configExclusion}
                centrosCostosExcluidos={actualCentrosCostosExcluidos}
                setCentrosCostosExcluidos={setCentrosCostosExcluidos}
                onLimpiar={handleLimpiar}
                showIngresosEgresos={true}
            />

            <div className="flex-1 overflow-auto p-4 space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
                    {/* New Card: Registros */}
                    <StatCard
                        label="Registros"
                        value={filteredMovimientos.length}
                        secondaryValue={totalPeriodo}
                        icon={<LayoutList className="w-5 h-5" />}
                        colorClass="text-slate-600"
                        bgColorClass="bg-slate-50"
                        borderColor="group-hover:border-slate-300"
                        isCurrency={false}
                    />

                    {/* Existing Cards */}
                    <StatCard
                        label="Total Ingresos"
                        value={totalsDisplay.ingresos}
                        trend={calculateTrend(totalsDisplay.ingresos, totalesAnterior?.ingresos)}
                        icon={<TrendingUp className="w-5 h-5" />}
                        colorClass="text-emerald-600"
                        bgColorClass="bg-emerald-50"
                        borderColor="group-hover:border-emerald-200"
                    />
                    <StatCard
                        label="Total Egresos"
                        value={totalsDisplay.egresos}
                        trend={calculateTrend(totalsDisplay.egresos, totalesAnterior?.egresos)}
                        isEgreso
                        icon={<TrendingDown className="w-5 h-5" />}
                        colorClass="text-rose-600"
                        bgColorClass="bg-rose-50"
                        borderColor="group-hover:border-rose-200"
                    />
                    <StatCard
                        label="Saldo Neto"
                        value={totalsDisplay.saldo}
                        trend={calculateTrend(totalsDisplay.saldo, totalesAnterior?.saldo)}
                        icon={<Wallet className="w-5 h-5" />}
                        colorClass={totalsDisplay.saldo >= 0 ? "text-indigo-600" : "text-rose-600"}
                        bgColorClass="bg-indigo-50"
                        borderColor="group-hover:border-indigo-200"
                    />
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-50 rounded-lg text-slate-500">
                                <Search className="w-4 h-4" />
                            </div>
                            <div className="relative group">
                                <input
                                    type="text"
                                    placeholder="Buscar por descripción, referencia o tercero..."
                                    className="w-80 pl-1 py-1.5 text-xs bg-transparent border-none focus:ring-0 outline-none placeholder:text-slate-400 font-medium"
                                    value={busqueda}
                                    onChange={(e) => setBusqueda(e.target.value)}
                                />
                                <div className="absolute bottom-0 left-0 w-0 h-0.5 bg-indigo-500 transition-all group-focus-within:w-full" />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-full font-bold">
                                {filteredMovimientos.length} REGISTROS
                            </span>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto">
                        <MovimientosTable
                            movimientos={filteredMovimientos}
                            loading={loading}
                            onView={handleViewClick}
                            onEdit={(mov: Movimiento) => navigate(`/movimientos/editar/${mov.id}`)}
                            onDelete={handleDeleteClick}
                        />
                    </div>
                </div>
            </div>

            {/* Modals */}
            <MovimientoModal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false)
                    setMovimientoToDelete(null)
                }}
                movimiento={movimientoToDelete}
                onSave={handleConfirmDelete}
                mode="delete"
            />

            <MovimientoModal
                isOpen={isViewModalOpen}
                onClose={() => {
                    setIsViewModalOpen(false)
                    setMovimientoToView(null)
                }}
                movimiento={movimientoToView}
                onSave={handleSaveEdit}
                mode="edit"
            />
        </div >
    )
}

const StatCard = ({ label, value, trend, icon, colorClass, bgColorClass, borderColor, isEgreso = false, secondaryValue = null, isCurrency = true }: any) => {
    const isPositive = trend > 0
    const isNearZero = Math.abs(trend ?? 0) < 0.1

    let trendColor = ""
    if (isEgreso) {
        trendColor = isPositive ? "text-rose-500 bg-rose-50" : "text-emerald-500 bg-emerald-50"
    } else {
        trendColor = isPositive ? "text-emerald-500 bg-emerald-50" : "text-rose-500 bg-rose-50"
    }

    if (isNearZero || trend === null) trendColor = "text-slate-400 bg-slate-50"

    return (
        <div className={`group bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 flex items-center justify-between transition-all duration-300 hover:shadow-md ${borderColor}`}>
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                    {typeof trend === 'number' && (
                        <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${trendColor}`}>
                            {isNearZero ? <Minus size={8} /> : isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                            {Math.abs(trend).toFixed(1)}%
                        </div>
                    )}
                </div>
                <div className={`text-2xl font-black tracking-tight ${colorClass} flex items-baseline`}>
                    {isCurrency && typeof value === 'number' ? <CurrencyDisplay value={value} colorize={false} /> : <span>{value}</span>}
                    {secondaryValue !== null && (
                        <span className="text-sm opacity-40 font-medium text-slate-400 ml-2">/ {secondaryValue}</span>
                    )}
                </div>
                <div className="flex items-center gap-1 text-[9px] text-slate-400 font-medium">
                    <span className="w-1 h-1 rounded-full bg-slate-200" />
                    {secondaryValue !== null ? 'Visible / Total en Periodo' : 'Periodo Actual'}
                </div>
            </div>
            <div className={`p-3.5 ${bgColorClass} ${colorClass} rounded-2xl group-hover:scale-110 transition-transform duration-300 shadow-sm shadow-inner`}>
                {icon}
            </div>
        </div>
    )
}
