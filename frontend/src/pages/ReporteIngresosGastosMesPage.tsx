import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { X, Search, FileSpreadsheet, ArrowLeft, TrendingUp, Eye } from 'lucide-react'

import { FiltrosReporte } from '../components/organisms/FiltrosReporte'
import { EstadisticasTotales } from '../components/organisms/EstadisticasTotales'
import { CurrencyDisplay } from '../components/atoms/CurrencyDisplay'
import { apiService } from '../services/api'
import { useSessionStorage } from '../hooks/useSessionStorage'
import { formatDateISO, getAnioYTD, getPreviousPeriod } from '../utils/dateUtils'
import { useReporteIngresosGastosMes, useConfiguracionExclusion } from '../hooks/useReportes'
import { DataTable } from '../components/molecules/DataTable'
import type { Movimiento } from '../types'
import { TableHeaderCell } from '../components/atoms/TableHeaderCell'
import { fechaColumn, monedaColumn } from '../components/atoms/columnHelpers'
import { DrilldownTable } from '../components/molecules/DrilldownTable'

interface ItemReporteMes {
    mes: string
    ingresos: number
    egresos: number
    saldo: number
}

interface ItemDesglose {
    id: number
    nombre: string
    ingresos: number
    egresos: number
    saldo: number
}

interface DrilldownLevel {
    level: 'mes' | 'tercero' | 'centro_costo' | 'concepto'
    title: string
    mes?: string
    parentId?: number
    parentName?: string
    grandParentId?: number
    grandParentName?: string
    data: ItemDesglose[]
    isOpen: boolean
    sortAsc: boolean
    sortField: 'nombre' | 'ingresos' | 'egresos' | 'saldo'
}

export const ReporteIngresosGastosMesPage = () => {
    // Filtros
    const [desde, setDesde] = useSessionStorage('rep_mes_filtro_desde', getAnioYTD().inicio)
    const [hasta, setHasta] = useSessionStorage('rep_mes_filtro_hasta', getAnioYTD().fin)
    const [cuentaId, setCuentaId] = useSessionStorage('rep_mes_filtro_cuentaId', '')
    const [terceroId, setTerceroId] = useSessionStorage('rep_mes_filtro_terceroId', '')
    const [centroCostoId, setCentroCostoId] = useSessionStorage('rep_mes_filtro_centroCostoId', '')
    const [conceptoId, setConceptoId] = useSessionStorage('rep_mes_filtro_conceptoId', '')
    const [mostrarIngresos, setMostrarIngresos] = useSessionStorage('rep_mes_filtro_ingresos', false)
    const [mostrarEgresos, setMostrarEgresos] = useSessionStorage('rep_mes_filtro_egresos', true)

    // Dynamic Exclusion
    const { data: configuracionExclusion = [] } = useConfiguracionExclusion()
    const [centrosCostosExcluidos, setCentrosCostosExcluidos] = useSessionStorage<number[] | null>('rep_mes_filtro_centrosCostosExcluidos', null)
    const actualCentrosCostosExcluidos = centrosCostosExcluidos || []

    // Load Exclusion Config Defaults
    useEffect(() => {
        if (configuracionExclusion.length > 0 && centrosCostosExcluidos === null) {
            const defaults = configuracionExclusion.filter(d => d.activo_por_defecto).map(d => d.centro_costo_id)
            setCentrosCostosExcluidos(defaults)
        }
    }, [configuracionExclusion, centrosCostosExcluidos])

    const paramsReporte = useMemo(() => ({
        fecha_inicio: desde,
        fecha_fin: hasta,
        cuenta_id: cuentaId ? Number(cuentaId) : undefined,
        tercero_id: terceroId ? Number(terceroId) : undefined,
        centro_costo_id: centroCostoId ? Number(centroCostoId) : undefined,
        concepto_id: conceptoId ? Number(conceptoId) : undefined,
        centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined,
        ver_ingresos: mostrarIngresos,
        ver_egresos: mostrarEgresos
    }), [desde, hasta, cuentaId, terceroId, centroCostoId, conceptoId, actualCentrosCostosExcluidos, mostrarIngresos, mostrarEgresos])

    const { data: datosRaw, isLoading: loading } = useReporteIngresosGastosMes(paramsReporte)
    const datos = useMemo(() => {
        if (!datosRaw) return []
        const dataTyped = datosRaw as ItemReporteMes[]
        const mesDesde = desde.substring(0, 7)
        const mesHasta = hasta.substring(0, 7)
        return dataTyped
            .filter(d => d.mes >= mesDesde && d.mes <= mesHasta)
            .sort((a, b) => a.mes.localeCompare(b.mes))
    }, [datosRaw, desde, hasta])

    // Comparative Logic
    const prevPeriod = useMemo(() => getPreviousPeriod(desde, hasta), [desde, hasta])
    const paramsAnterior = useMemo(() => ({
        fecha_inicio: prevPeriod.inicio, fecha_fin: prevPeriod.fin,
        cuenta_id: cuentaId ? Number(cuentaId) : undefined,
        centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined,
        ver_ingresos: mostrarIngresos,
        ver_egresos: mostrarEgresos
    }), [prevPeriod, cuentaId, actualCentrosCostosExcluidos, mostrarIngresos, mostrarEgresos])
    const { data: datosAnteriorRaw } = useReporteIngresosGastosMes(paramsAnterior)

    const totalesAnterior = useMemo(() => {
        if (!datosAnteriorRaw || !Array.isArray(datosAnteriorRaw)) return null
        return (datosAnteriorRaw as ItemReporteMes[]).reduce((acc, curr) => ({
            ingresos: acc.ingresos + curr.ingresos,
            egresos: acc.egresos + curr.egresos,
            saldo: acc.saldo + curr.saldo
        }), { ingresos: 0, egresos: 0, saldo: 0 })
    }, [datosAnteriorRaw])

    // State for Drilldown Modals
    const [terceroModal, setTerceroModal] = useState<DrilldownLevel>({
        level: 'tercero', title: '', data: [], isOpen: false, sortAsc: false, sortField: 'egresos'
    })
    const [centroCostoModal, setCentroCostoModal] = useState<DrilldownLevel>({
        level: 'centro_costo', title: '', data: [], isOpen: false, sortAsc: false, sortField: 'egresos'
    })
    const [detallesModal, setDetallesModal] = useState<{
        isOpen: boolean; title: string; data: Movimiento[]; loading: boolean;
        terceroId?: number; centroCostoId?: number; conceptoId?: number;
        terceroNombre?: string; centroCostoNombre?: string; conceptoNombre?: string;
    }>({ isOpen: false, title: '', data: [], loading: false })

    // Helper for date range from mes (YYYY-MM)
    const getMesRange = (mes: string) => {
        const [y, m] = mes.split('-')
        const inicio = new Date(parseInt(y), parseInt(m) - 1, 1)
        const fin = new Date(parseInt(y), parseInt(m), 0)
        return { inicio: formatDateISO(inicio), fin: formatDateISO(fin) }
    }

    // Handlers
    const handleLimpiar = () => {
        const rangoYTD = getAnioYTD()
        setDesde(rangoYTD.inicio)
        setHasta(rangoYTD.fin)
        setCuentaId('')
        setTerceroId('')
        setCentroCostoId('')
        setConceptoId('')
        if (configuracionExclusion.length > 0) {
            const defaults = configuracionExclusion.filter(d => d.activo_por_defecto).map(d => d.centro_costo_id)
            setCentrosCostosExcluidos(defaults)
        } else {
            setCentrosCostosExcluidos([])
        }
    }

    const handleMesClick = async (itemMes: ItemReporteMes) => {
        const range = getMesRange(itemMes.mes)
        setTerceroModal({
            level: 'tercero', title: `Terceros - ${itemMes.mes}`, mes: itemMes.mes,
            parentName: itemMes.mes, data: [], isOpen: true, sortAsc: false, sortField: 'egresos'
        })
        try {
            const data = await apiService.movimientos.reporteDesgloseGastos({
                nivel: 'tercero', fecha_inicio: range.inicio, fecha_fin: range.fin,
                cuenta_id: cuentaId ? Number(cuentaId) : undefined,
                centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined,
                ver_ingresos: mostrarIngresos,
                ver_egresos: mostrarEgresos
            } as any)
            setTerceroModal(prev => ({ ...prev, data: (data as ItemDesglose[]) || [] }))
        } catch (e) { console.error(e) }
    }

    const handleTerceroClick = async (item: ItemDesglose, parentName: string) => {
        const range = getMesRange(parentName)
        setCentroCostoModal({
            level: 'centro_costo', title: `Centros de Costo - ${item.nombre}`, mes: parentName,
            parentId: item.id, parentName: item.nombre, grandParentName: parentName,
            data: [], isOpen: true, sortAsc: false, sortField: 'egresos'
        })
        try {
            const data = await apiService.movimientos.reporteDesgloseGastos({
                nivel: 'centro_costo', fecha_inicio: range.inicio, fecha_fin: range.fin,
                tercero_id: item.id,
                cuenta_id: cuentaId ? Number(cuentaId) : undefined,
                centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined,
                ver_ingresos: mostrarIngresos,
                ver_egresos: mostrarEgresos
            } as any)
            setCentroCostoModal(prev => ({ ...prev, data: (data as ItemDesglose[]) || [] }))
        } catch (e) { console.error(e) }
    }

    const handleCentroCostoClick = async (item: ItemDesglose, context: { mes: string, terceroId: number, terceroNombre: string }) => {
        const range = getMesRange(context.mes)
        setDetallesModal({
            isOpen: true, title: `Movimientos: ${item.nombre}`, loading: true, data: [],
            terceroId: context.terceroId, centroCostoId: item.id,
            terceroNombre: context.terceroNombre, centroCostoNombre: item.nombre
        })
        try {
            const res = await apiService.movimientos.listar({
                desde: range.inicio, hasta: range.fin,
                tercero_id: context.terceroId, centro_costo_id: item.id,
                cuenta_id: cuentaId ? Number(cuentaId) : undefined,
                centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined
            } as any)
            setDetallesModal(prev => ({ ...prev, data: res.items, loading: false }))
        } catch (e) { console.error(e); setDetallesModal(prev => ({ ...prev, loading: false })) }
    }

    const totales = useMemo(() => {
        return datos.reduce((acc, curr) => ({
            ingresos: acc.ingresos + curr.ingresos,
            egresos: acc.egresos + curr.egresos,
            saldo: acc.saldo + curr.saldo
        }), { ingresos: 0, egresos: 0, saldo: 0 })
    }, [datos])

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            <div className="px-6 pt-6 pb-2 bg-white">
                <h1 className="text-2xl font-bold text-slate-900">Ingresos y Gastos</h1>
                <p className="text-slate-500 text-sm mt-1">Comparativo y evolución mensual de movimientos</p>
            </div>
            <FiltrosReporte
                desde={desde} setDesde={setDesde}
                hasta={hasta} setHasta={setHasta}
                cuentaId={cuentaId} setCuentaId={setCuentaId}
                terceroId={terceroId} setTerceroId={setTerceroId}
                centroCostoId={centroCostoId} setCentroCostoId={setCentroCostoId}
                conceptoId={conceptoId} setConceptoId={setConceptoId}
                configuracionExclusion={configuracionExclusion}
                centrosCostosExcluidos={actualCentrosCostosExcluidos}
                setCentrosCostosExcluidos={setCentrosCostosExcluidos}
                mostrarIngresos={mostrarIngresos}
                setMostrarIngresos={setMostrarIngresos}
                mostrarEgresos={mostrarEgresos}
                setMostrarEgresos={setMostrarEgresos}
                onLimpiar={handleLimpiar}
                showIngresosEgresos={true}
            />

            <div className="flex-1 overflow-auto p-4 space-y-4">
                <EstadisticasTotales
                    ingresos={totales.ingresos}
                    egresos={totales.egresos}
                    saldo={totales.saldo}
                    comparativaAnterior={totalesAnterior}
                />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Gráfica Evolución */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[650px]">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                    <TrendingUp className="w-5 h-5" />
                                </div>
                                <h3 className="font-bold text-slate-800 tracking-tight">Evolución Ingresos vs Gastos</h3>
                            </div>
                        </div>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={datos} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} onClick={(data) => (data as any)?.activePayload && handleMesClick((data as any).activePayload[0].payload)}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}M`} />
                                    <Tooltip
                                        cursor={{ fill: '#f8fafc' }}
                                        content={({ active, payload }) => {
                                            if (active && payload?.[0]) {
                                                const d = payload[0].payload
                                                return (
                                                    <div className="bg-slate-950 text-white p-4 rounded-xl shadow-2xl border border-slate-800 text-xs min-w-[180px]">
                                                        <p className="font-black mb-3 uppercase tracking-widest text-indigo-400">{d.mes}</p>
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg">
                                                                <span className="opacity-60">Ingresos:</span>
                                                                <span className="font-mono text-emerald-400 font-bold"><CurrencyDisplay value={d.ingresos} colorize={false} decimals={0} /></span>
                                                            </div>
                                                            <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg">
                                                                <span className="opacity-60">Egresos:</span>
                                                                <span className="font-mono text-rose-400 font-bold"><CurrencyDisplay value={d.egresos} colorize={false} decimals={0} /></span>
                                                            </div>
                                                            <div className="flex justify-between items-center border-t border-white/10 pt-2 mt-1">
                                                                <span className="opacity-60">Saldo:</span>
                                                                <span className={`font-mono font-black ${d.saldo >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}><CurrencyDisplay value={d.saldo} colorize={false} decimals={0} /></span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            }
                                            return null
                                        }}
                                    />
                                    <Bar dataKey="ingresos" fill="#10b981" radius={[4, 4, 0, 0]} barSize={24} />
                                    <Bar dataKey="egresos" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={24} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Tabla Resumen */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[650px]">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-sm">
                                    <FileSpreadsheet className="w-5 h-5 text-slate-600" />
                                </div>
                                <h3 className="font-bold text-slate-800 tracking-tight">Detalle Mensual</h3>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <DataTable
                                data={datos}
                                loading={loading}
                                getRowKey={(row, idx) => row.mes || idx}
                                columns={[
                                    {
                                        header: <TableHeaderCell>Mes</TableHeaderCell>,
                                        key: 'mes',
                                        accessor: (row) => (
                                            <div className="flex items-center gap-3 group cursor-pointer" onClick={() => handleMesClick(row as any)}>
                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                                    <Eye className="w-4 h-4" />
                                                </div>
                                                <span className="font-bold text-slate-700 group-hover:text-indigo-600 font-mono text-xs uppercase">{row.mes}</span>
                                            </div>
                                        )
                                    },
                                    monedaColumn<ItemReporteMes>('ingresos', <TableHeaderCell>Ingresos</TableHeaderCell>, (row) => row.ingresos, 'COP', { cellClassName: 'text-emerald-600 text-[11px]', decimals: 0 }),
                                    monedaColumn<ItemReporteMes>('egresos', <TableHeaderCell>Egresos</TableHeaderCell>, (row) => row.egresos, 'COP', { cellClassName: 'text-rose-600 text-[11px]', colorize: false, decimals: 0 }),
                                    monedaColumn<ItemReporteMes>('saldo', <TableHeaderCell>Saldo</TableHeaderCell>, (row) => row.saldo, 'COP', { cellClassName: 'font-bold text-[11px]', decimals: 0 })
                                ]}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Drilldown Modals */}
            <DrilldownModal
                level={terceroModal}
                onClose={() => setTerceroModal(prev => ({ ...prev, isOpen: false }))}
                onNext={(item) => handleTerceroClick(item, terceroModal.mes!)}
            />
            <DrilldownModal
                level={centroCostoModal}
                onClose={() => setCentroCostoModal(prev => ({ ...prev, isOpen: false }))}
                onNext={(item) => handleCentroCostoClick(item, { mes: centroCostoModal.mes!, terceroId: centroCostoModal.parentId!, terceroNombre: centroCostoModal.parentName! })}
            />
            <MovimientosModal
                state={detallesModal}
                onClose={() => setDetallesModal(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    )
}

const DrilldownModal = ({ level, onClose, onNext }: { level: DrilldownLevel, onClose: () => void, onNext: (item: ItemDesglose) => void }) => {
    const [busqueda, setBusqueda] = useState('')
    if (!level.isOpen) return null

    const dataFiltered = level.data.filter(d => d.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    const sorted = [...dataFiltered].sort((a, b) => {
        if (level.sortField === 'nombre') {
            return level.sortAsc ? a.nombre.localeCompare(b.nombre) : b.nombre.localeCompare(a.nombre)
        }
        return level.sortAsc ? (a[level.sortField] || 0) - (b[level.sortField] || 0) : (b[level.sortField] || 0) - (a[level.sortField] || 0)
    })

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-4xl h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><ArrowLeft className="w-5 h-5" /></button>
                        <div>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
                                <span>Reporte</span>
                                {level.grandParentName && <><span className="text-slate-200">/</span><span className="text-slate-500">{level.grandParentName}</span></>}
                                <span className="text-slate-200">/</span>
                                <span className="text-indigo-600 font-black">{level.parentName}</span>
                            </div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">{level.title}</h2>
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar en el listado..."
                            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 bg-white px-3 py-1.5 rounded-full border border-slate-200">{sorted.length} ITEMS</div>
                </div>

                <div className="flex-1 overflow-auto p-2">
                    <DataTable
                        data={sorted}
                        getRowKey={(row, idx) => row.id || idx}
                        columns={[
                            {
                                header: <TableHeaderCell>Descripción</TableHeaderCell>,
                                key: 'nombre',
                                accessor: (row) => (
                                    <div className="flex items-center gap-3 group cursor-pointer" onClick={() => onNext(row)}>
                                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-sm">
                                            <Eye className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="font-bold text-slate-700 group-hover:text-indigo-600 transition-colors uppercase text-[11px] underline decoration-slate-200 group-hover:decoration-indigo-200 underline-offset-4">{row.nombre}</span>
                                    </div>
                                )
                            },
                            monedaColumn<any>('ingresos', <TableHeaderCell>Ingresos</TableHeaderCell>, (row) => row.ingresos, 'COP', { cellClassName: 'text-emerald-600 text-[11px]', decimals: 0 }),
                            monedaColumn<any>('egresos', <TableHeaderCell>Egresos</TableHeaderCell>, (row) => row.egresos, 'COP', { cellClassName: 'text-rose-600 text-[11px]', colorize: false, decimals: 0 }),
                            monedaColumn<any>('saldo', <TableHeaderCell>Saldo</TableHeaderCell>, (row) => row.saldo, 'COP', { cellClassName: 'font-bold text-[11px]', decimals: 0 })
                        ]}
                    />
                </div>
            </div>
        </div>
    )
}

const MovimientosModal = ({ state, onClose }: { state: any, onClose: () => void }) => {
    if (!state.isOpen) return null

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-end bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-5xl h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-500 hover:text-indigo-600 hover:rotate-90 duration-300">
                            <X className="w-6 h-6" />
                        </button>
                        <div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mb-1.5">
                                <span>TRANSACCIONES</span>
                                <span className="text-slate-200">/</span>
                                <span className="text-slate-500 uppercase">{state.terceroNombre}</span>
                            </div>
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                                <FileSpreadsheet className="w-6 h-6 text-indigo-500" />
                                {state.centroCostoNombre}
                            </h2>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-auto bg-slate-50/30 font-sans">
                    <DrilldownTable
                        data={state.data}
                        loading={state.loading}
                        getRowKey={(row, idx) => row.id || idx}
                        columns={[
                            fechaColumn<Movimiento>('fecha', <TableHeaderCell>Fecha</TableHeaderCell>, (row) => row.fecha, { width: 'w-24' }),
                            {
                                header: <TableHeaderCell>Referencia / Tercero</TableHeaderCell>,
                                key: 'descripcion',
                                accessor: (row: any) => (
                                    <div className="flex flex-col">
                                        <span className="text-[11px] font-bold text-slate-700 tracking-tight">{row.referencia || 'SIN REF'}</span>
                                        <span className="text-[9px] text-slate-400 font-medium uppercase truncate max-w-[300px] leading-tight mt-0.5">{row.descripcion}</span>
                                    </div>
                                )
                            },
                            monedaColumn<Movimiento>('valor', <TableHeaderCell>Total</TableHeaderCell>, (row) => row.valor, 'COP', { cellClassName: 'text-[11px]', decimals: 0 }),
                            monedaColumn<Movimiento>('valor_calculado', <TableHeaderCell>Valor Asignado</TableHeaderCell>, (row: any) => {
                                const relevante = row.detalles?.filter((d: any) => d.centro_costo_id === state.centroCostoId) || []
                                const suma = relevante.reduce((acc: number, curr: any) => acc + curr.valor, 0)
                                return suma || row.valor
                            }, 'COP', { cellClassName: 'text-[11px] font-bold', decimals: 0 })
                        ]}
                    />
                </div>
            </div>
        </div>
    )
}
