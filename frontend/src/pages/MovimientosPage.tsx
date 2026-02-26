import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutList, Plus, Search, TrendingUp, TrendingDown, Wallet } from 'lucide-react'

import type { Movimiento } from '../types'
import { apiService } from '../services/api'
import { useSessionStorage } from '../hooks/useSessionStorage'
import { getMesActual, getPreviousPeriod } from '../utils/dateUtils'
import { flattenMovimientos, type MovimientoFlat } from '../utils/movimientoUtils'
import { FiltrosReporte } from '../components/organisms/FiltrosReporte'
import { MovimientosTable } from '../components/organisms/MovimientosTable'
import { MovimientoModal } from '../components/organisms/modals/MovimientoModal'
import { useReporteClasificacion } from '../hooks/useReportes'
import { usePerspectiva } from '../hooks/usePerspectiva'
import { StatCard } from '../components/molecules/StatCard'
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
    const [busqueda, setBusqueda] = useState('')

    // Perspectiva
    const { perspectivas, selectedSlug, setSelectedSlug, filterParams } = usePerspectiva()

    const [movimientos, setMovimientos] = useState<Movimiento[]>([])
    const [loading, setLoading] = useState(true)
    const [totalesGlobales, setTotalesGlobales] = useState<{ ingresos: number; egresos: number; saldo: number } | null>(null)
    const [totalPeriodo, setTotalPeriodo] = useState(0)

    // Comparative totals
    const prevPeriod = useMemo(() => getPreviousPeriod(desde, hasta), [desde, hasta])
    const { data: datosAnterior } = useReporteClasificacion({
        tipo: 'totales', desde: prevPeriod.inicio, hasta: prevPeriod.fin,
        cuenta_id: cuentaId ? Number(cuentaId) : undefined,
        ...filterParams
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

        // 1. Fetch filtered movements
        apiService.movimientos.listar({
            desde: finalDesde, hasta: finalHasta,
            cuenta_id: cuentaId ? Number(cuentaId) : undefined,
            tercero_id: terceroId ? Number(terceroId) : undefined,
            centro_costo_id: centroCostoId ? Number(centroCostoId) : undefined,
            concepto_id: conceptoId ? Number(conceptoId) : undefined,
            ...filterParams
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

    }, [desde, hasta, cuentaId, terceroId, centroCostoId, conceptoId, filterParams])


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
    }

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [movimientoToDelete, setMovimientoToDelete] = useState<Movimiento | null>(null)
    const [isViewModalOpen, setIsViewModalOpen] = useState(false)
    const [movimientoToView, setMovimientoToView] = useState<Movimiento | null>(null)

    // Lookup: dado un MovimientoFlat, encontrar el Movimiento original para modals
    const findOriginalMovimiento = useCallback((flat: MovimientoFlat): Movimiento | undefined => {
        return movimientos.find(m => m.id === flat.movimiento_id)
    }, [movimientos])

    const handleDeleteClick = (flat: MovimientoFlat) => {
        const mov = findOriginalMovimiento(flat)
        if (mov) {
            setMovimientoToDelete(mov)
            setIsDeleteModalOpen(true)
        }
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

    const handleViewClick = (flat: MovimientoFlat) => {
        const mov = findOriginalMovimiento(flat)
        if (mov) {
            setMovimientoToView(mov)
            setIsViewModalOpen(true)
        }
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

    // Aplanar movimientos: 1 fila = 1 detalle
    const filasDetalle = useMemo(() => flattenMovimientos(movimientos), [movimientos])

    // Detect USD: if valor sums to 0 but usd has values, use usd field
    const esUSD = useMemo(() => {
        if (filasDetalle.length === 0) return false
        const sumaValor = filasDetalle.reduce((acc, m) => acc + Math.abs(m.valor), 0)
        const sumaUsd = filasDetalle.reduce((acc, m) => acc + Math.abs(m.usd || 0), 0)
        return sumaValor === 0 && sumaUsd > 0
    }, [filasDetalle])

    const totalsDisplay = useMemo(() => {
        if (totalesGlobales && !esUSD) return totalesGlobales
        const getVal = (m: MovimientoFlat) => esUSD ? (m.usd || 0) : m.valor
        const sums = filasDetalle.reduce((acc, m) => {
            const v = getVal(m)
            if (v > 0) acc.ingresos += v
            else acc.egresos += Math.abs(v)
            return acc
        }, { ingresos: 0, egresos: 0 })
        return { ...sums, saldo: sums.ingresos - sums.egresos }
    }, [filasDetalle, totalesGlobales, esUSD])

    const filteredMovimientos = useMemo(() => {
        if (!busqueda) return filasDetalle
        const lowBus = busqueda.toLowerCase()
        return filasDetalle.filter(m =>
            m.descripcion?.toLowerCase().includes(lowBus) ||
            m.referencia?.toLowerCase().includes(lowBus) ||
            m.tercero_nombre?.toLowerCase().includes(lowBus)
        )
    }, [filasDetalle, busqueda])

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
                perspectivas={perspectivas}
                selectedSlug={selectedSlug}
                onPerspectivaChange={setSelectedSlug}
                onLimpiar={handleLimpiar}
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
                        label={esUSD ? "Total Ingresos (USD)" : "Total Ingresos"}
                        value={totalsDisplay.ingresos}
                        trend={calculateTrend(totalsDisplay.ingresos, totalesAnterior?.ingresos)}
                        icon={<TrendingUp className="w-5 h-5" />}
                        colorClass="text-emerald-600"
                        bgColorClass="bg-emerald-50"
                        borderColor="group-hover:border-emerald-200"
                        currency={esUSD ? 'USD' : 'COP'}
                    />
                    <StatCard
                        label={esUSD ? "Total Egresos (USD)" : "Total Egresos"}
                        value={totalsDisplay.egresos}
                        trend={calculateTrend(totalsDisplay.egresos, totalesAnterior?.egresos)}
                        isEgreso
                        icon={<TrendingDown className="w-5 h-5" />}
                        colorClass="text-rose-600"
                        bgColorClass="bg-rose-50"
                        borderColor="group-hover:border-rose-200"
                        currency={esUSD ? 'USD' : 'COP'}
                    />
                    <StatCard
                        label={esUSD ? "Saldo Neto (USD)" : "Saldo Neto"}
                        value={totalsDisplay.saldo}
                        trend={calculateTrend(totalsDisplay.saldo, totalesAnterior?.saldo)}
                        icon={<Wallet className="w-5 h-5" />}
                        colorClass={totalsDisplay.saldo >= 0 ? "text-indigo-600" : "text-rose-600"}
                        bgColorClass="bg-indigo-50"
                        borderColor="group-hover:border-indigo-200"
                        currency={esUSD ? 'USD' : 'COP'}
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
                            onEdit={(flat: MovimientoFlat) => navigate(`/movimientos/editar/${flat.movimiento_id}`)}
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

