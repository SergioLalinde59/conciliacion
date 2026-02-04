import { useState, useEffect, useMemo } from 'react'
import { apiService } from '../services/api'
import { useReporteDesgloseGastos, useConfiguracionExclusion } from '../hooks/useReportes'
import { useSessionStorage } from '../hooks/useSessionStorage'
import { getMesActual, getPreviousPeriod } from '../utils/dateUtils'
import { FiltrosReporte } from '../components/organisms/FiltrosReporte'

import { CurrencyDisplay } from '../components/atoms/CurrencyDisplay'
import { DataTable } from '../components/molecules/DataTable'
import { Search, FileSpreadsheet, ArrowLeft, X, LayoutList, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, Minus, Eye } from 'lucide-react'
import * as XLSX from 'xlsx'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { Movimiento } from '../types'
import { TableHeaderCell } from '../components/atoms/TableHeaderCell'
import { fechaColumn, monedaColumn } from '../components/atoms/columnHelpers'
import { DrilldownTable } from '../components/molecules/DrilldownTable'

interface ItemDesglose {
    id: number
    nombre: string
    ingresos: number
    egresos: number
    saldo: number
}

interface DrilldownLevel {
    level: 'tercero' | 'centro_costo' | 'concepto'
    title: string
    parentId?: number
    parentName?: string
    grandParentId?: number
    grandParentName?: string
    data: ItemDesglose[]
    isOpen: boolean
    sortAsc: boolean
    sortField: 'nombre' | 'ingresos' | 'egresos' | 'saldo'
}



export const ReporteEgresosTerceroPage = () => {
    // Filtros
    const [desde, setDesde] = useSessionStorage('rep_egresos_desde', getMesActual().inicio)
    const [hasta, setHasta] = useSessionStorage('rep_egresos_hasta', getMesActual().fin)
    const [cuentaId, setCuentaId] = useSessionStorage('rep_egresos_cuentaId', '')
    const [terceroId, setTerceroId] = useSessionStorage('rep_egresos_terceroId', '')
    const [centroCostoId, setCentroCostoId] = useSessionStorage('rep_egresos_centroCostoId', '')
    const [conceptoId, setConceptoId] = useSessionStorage('rep_egresos_conceptoId', '')
    const [mostrarIngresos, setMostrarIngresos] = useSessionStorage('rep_egresos_ingresos', false)
    const [mostrarEgresos, setMostrarEgresos] = useSessionStorage('rep_egresos_egresos', true)
    const [busqueda, setBusqueda] = useState('')

    // Dynamic Exclusion
    const { data: configExclusion = [] } = useConfiguracionExclusion()
    const [centrosCostosExcluidos, setCentrosCostosExcluidos] = useSessionStorage<number[] | null>('rep_egresos_centrosCostosExcluidos', null)
    const actualCentrosCostosExcluidos = centrosCostosExcluidos || []

    useEffect(() => {
        if (configExclusion.length > 0 && centrosCostosExcluidos === null) {
            const defaults = configExclusion.filter(d => d.activo_por_defecto).map(d => d.centro_costo_id)
            setCentrosCostosExcluidos(defaults)
        }
    }, [configExclusion, centrosCostosExcluidos, setCentrosCostosExcluidos])

    // Modals
    const [centroCostoModal, setCentroCostoModal] = useState<DrilldownLevel>({
        level: 'centro_costo', title: '', data: [], isOpen: false, sortAsc: false, sortField: 'egresos'
    })
    const [conceptoModal, setConceptoModal] = useState<DrilldownLevel>({
        level: 'concepto', title: '', data: [], isOpen: false, sortAsc: false, sortField: 'egresos'
    })
    const [detallesModal, setDetallesModal] = useState<{
        isOpen: boolean; title: string; data: Movimiento[]; loading: boolean;
        terceroId?: number; centroCostoId?: number; conceptoId?: number;
        terceroNombre?: string; centroCostoNombre?: string; conceptoNombre?: string;
    }>({ isOpen: false, title: '', data: [], loading: false })

    // Data Fetching
    const paramsReporte = useMemo(() => ({
        nivel: 'tercero', fecha_inicio: desde, fecha_fin: hasta,
        cuenta_id: cuentaId ? Number(cuentaId) : undefined,
        tercero_id: terceroId ? Number(terceroId) : undefined,
        centro_costo_id: centroCostoId ? Number(centroCostoId) : undefined,
        concepto_id: conceptoId ? Number(conceptoId) : undefined,
        centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined,
        ver_ingresos: mostrarIngresos,
        ver_egresos: mostrarEgresos
    }), [desde, hasta, cuentaId, terceroId, centroCostoId, conceptoId, actualCentrosCostosExcluidos, mostrarIngresos, mostrarEgresos])

    const { data: tercerosDataRaw, isLoading: loadingMain } = useReporteDesgloseGastos(paramsReporte)
    const tercerosData = (tercerosDataRaw as ItemDesglose[]) || []

    // Comparativa
    const prevPeriod = useMemo(() => getPreviousPeriod(desde, hasta), [desde, hasta])
    const paramsAnterior = useMemo(() => ({
        ...paramsReporte, fecha_inicio: prevPeriod.inicio, fecha_fin: prevPeriod.fin
    }), [paramsReporte, prevPeriod])
    const { data: anteriorDataRaw } = useReporteDesgloseGastos(paramsAnterior)
    const anteriorData = (anteriorDataRaw as ItemDesglose[]) || []
    const totalesAnterior = useMemo(() => ({
        ingresos: anteriorData.reduce((acc, curr) => acc + (curr.ingresos || 0), 0),
        egresos: anteriorData.reduce((acc, curr) => acc + (curr.egresos || 0), 0),
        saldo: anteriorData.reduce((acc, curr) => acc + (curr.saldo || 0), 0)
    }), [anteriorData])

    // Total Periodo (Registros) logic to match MovimientosPage (Unfiltered Count)
    const [totalTerceros, setTotalTerceros] = useState(0)
    useEffect(() => {
        apiService.movimientos.reporteDesgloseGastos({
            nivel: 'tercero',
            fecha_inicio: desde,
            fecha_fin: hasta,
            cuenta_id: cuentaId ? Number(cuentaId) : undefined,
            centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined
            // Explicitly excluding drill-down filters (tercero_id, centro_costo_id) to get the "Total" universe
        } as any).then(data => {
            if (Array.isArray(data)) setTotalTerceros(data.length)
        }).catch(console.error)
    }, [desde, hasta, cuentaId, actualCentrosCostosExcluidos])

    // Handlers
    const handleTerceroClick = async (item: ItemDesglose) => {
        setCentroCostoModal({
            level: 'centro_costo', title: `Centros de Costo: ${item.nombre}`,
            parentId: item.id, parentName: item.nombre, data: [], isOpen: true, sortAsc: false, sortField: 'egresos'
        })
        const data = await apiService.movimientos.reporteDesgloseGastos({ ...paramsReporte, nivel: 'centro_costo', tercero_id: item.id } as any)
        setCentroCostoModal(prev => ({ ...prev, data: (data as ItemDesglose[]) || [] }))
    }

    const handleCentroCostoClick = async (item: ItemDesglose) => {
        setConceptoModal({
            level: 'concepto', title: `Conceptos: ${item.nombre}`,
            parentId: item.id, parentName: item.nombre, grandParentId: centroCostoModal.parentId, grandParentName: centroCostoModal.parentName,
            data: [], isOpen: true, sortAsc: false, sortField: 'egresos'
        })
        const data = await apiService.movimientos.reporteDesgloseGastos({ ...paramsReporte, nivel: 'concepto', tercero_id: centroCostoModal.parentId, centro_costo_id: item.id } as any)
        setConceptoModal(prev => ({ ...prev, data: (data as ItemDesglose[]) || [] }))
    }

    const handleConceptoClick = (item: ItemDesglose) => {
        setDetallesModal({
            isOpen: true, title: `Movimientos: ${item.nombre}`, data: [], loading: true,
            terceroId: conceptoModal.grandParentId!, centroCostoId: conceptoModal.parentId!, conceptoId: item.id,
            terceroNombre: conceptoModal.grandParentName, centroCostoNombre: conceptoModal.parentName, conceptoNombre: item.nombre
        })
        apiService.movimientos.listar({
            tercero_id: conceptoModal.grandParentId!, centro_costo_id: conceptoModal.parentId!, concepto_id: item.id,
            desde, hasta, limit: 1000,
            ver_ingresos: mostrarIngresos, ver_egresos: mostrarEgresos,
            centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined
        } as any).then(response => {
            setDetallesModal(prev => ({ ...prev, data: (response as any).items || [], loading: false }))
        })
    }

    const handleLimpiar = () => {
        const mesActual = getMesActual()
        setDesde(mesActual.inicio); setHasta(mesActual.fin); setCuentaId(''); setTerceroId(''); setCentroCostoId(''); setConceptoId('')
        if (configExclusion.length > 0) setCentrosCostosExcluidos(configExclusion.filter(d => d.activo_por_defecto).map(d => d.centro_costo_id))
        else setCentrosCostosExcluidos([])
    }

    const filteredTerceros = useMemo(() => {
        const sorted = [...tercerosData].sort((a, b) => b.egresos - a.egresos)
        if (!busqueda) return sorted
        return sorted.filter(t => t.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    }, [tercerosData, busqueda])

    const top15 = useMemo(() => filteredTerceros.slice(0, 15), [filteredTerceros])
    const totales = useMemo(() => ({
        ingresos: tercerosData.reduce((acc, curr) => acc + curr.ingresos, 0),
        egresos: tercerosData.reduce((acc, curr) => acc + curr.egresos, 0),
        saldo: tercerosData.reduce((acc, curr) => acc + curr.saldo, 0)
    }), [tercerosData])

    const exportarExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filteredTerceros.map(t => ({ Nombre: t.nombre, Ingresos: t.ingresos, Egresos: t.egresos, Saldo: t.saldo })))
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Terceros")
        XLSX.writeFile(wb, `Reporte_Terceros_${desde}.xlsx`)
    }

    const calculateTrend = (current: number, previous?: number) => {
        if (previous === undefined || previous === null || previous === 0) return null
        return ((current - previous) / Math.abs(previous)) * 100
    }

    return (
        <div className="flex flex-col h-full bg-slate-50/50 overflow-hidden">
            <div className="px-6 pt-6 pb-2 bg-white">
                <h1 className="text-2xl font-bold text-slate-900">Egresos por Tercero</h1>
                <p className="text-slate-500 text-sm mt-1">Drilldown interactivo de egresos</p>
            </div>
            <FiltrosReporte
                desde={desde} setDesde={setDesde}
                hasta={hasta} setHasta={setHasta}
                cuentaId={cuentaId} setCuentaId={setCuentaId}
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
            />

            <div className="flex-1 min-h-0 p-4 space-y-4 overflow-hidden flex flex-col">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
                    {/* Card: Registros */}
                    <StatCard
                        label="Registros"
                        value={filteredTerceros.length}
                        secondaryValue={totalTerceros}
                        icon={<LayoutList className="w-5 h-5" />}
                        colorClass="text-slate-600"
                        bgColorClass="bg-slate-50"
                        borderColor="group-hover:border-slate-300"
                        isCurrency={false}
                    />

                    {/* Existing Cards */}
                    <StatCard
                        label="Total Ingresos"
                        value={totales.ingresos}
                        trend={calculateTrend(totales.ingresos, totalesAnterior?.ingresos)}
                        icon={<TrendingUp className="w-5 h-5" />}
                        colorClass="text-emerald-600"
                        bgColorClass="bg-emerald-50"
                        borderColor="group-hover:border-emerald-200"
                    />
                    <StatCard
                        label="Total Egresos"
                        value={totales.egresos}
                        trend={calculateTrend(totales.egresos, totalesAnterior?.egresos)}
                        isEgreso
                        icon={<TrendingDown className="w-5 h-5" />}
                        colorClass="text-rose-600"
                        bgColorClass="bg-rose-50"
                        borderColor="group-hover:border-rose-200"
                    />
                    <StatCard
                        label="Saldo Neto"
                        value={totales.saldo}
                        trend={calculateTrend(totales.saldo, totalesAnterior?.saldo)}
                        icon={<Wallet className="w-5 h-5" />}
                        colorClass={totales.saldo >= 0 ? "text-indigo-600" : "text-rose-600"}
                        bgColorClass="bg-indigo-50"
                        borderColor="group-hover:border-indigo-200"
                    />
                </div>

                <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Gráfica Top 10 */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 h-full flex flex-col overflow-hidden">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><FileSpreadsheet className="w-5 h-5" /></div>
                            <h3 className="font-bold text-slate-800 tracking-tight">Terceros (Top 15)</h3>
                        </div>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={top15}
                                    layout="vertical"
                                    margin={{ left: 20, right: 30 }}
                                    onClick={(d) => (d as any)?.activePayload && handleTerceroClick((d as any).activePayload[0].payload)}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="nombre" type="category" width={120} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }} style={{ cursor: 'pointer' }} />
                                    <Tooltip
                                        cursor={{ fill: '#f8fafc' }}
                                        content={({ active, payload }) => {
                                            if (active && payload?.[0]) {
                                                const d = payload[0].payload
                                                return (
                                                    <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs">
                                                        <p className="font-bold mb-1 uppercase tracking-wider">{d.nombre}</p>
                                                        <p className="flex justify-between gap-4"><span className="opacity-60 font-medium">Egresos:</span><span className="font-mono text-rose-400 font-bold"><CurrencyDisplay value={d.egresos} colorize={false} decimals={0} /></span></p>
                                                        <p className="mt-2 text-[10px] text-slate-400 animate-pulse italic text-center border-t border-slate-700 pt-2">Doble clic para explorar</p>
                                                    </div>
                                                )
                                            }
                                            return null
                                        }}
                                    />
                                    <Bar
                                        dataKey="egresos"
                                        fill="#6366f1"
                                        radius={[0, 4, 4, 0]}
                                        barSize={20}
                                        onDoubleClick={(d) => (d as any)?.payload && handleTerceroClick((d as any).payload)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {top15.map((_, index) => <Cell key={`c-${index}`} fill={index === 0 ? '#4f46e5' : '#6366f1'} opacity={1 - index * 0.05} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Tabla Principal */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden h-full">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-50 rounded-lg text-slate-500"><Search className="w-4 h-4" /></div>
                                <input type="text" placeholder="Buscar tercero..." className="w-48 pl-1 py-1 text-xs border-none outline-none" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                            </div>
                            <button onClick={exportarExcel} className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors"><FileSpreadsheet className="w-4 h-4" /></button>
                        </div>
                        <div className="flex-1 min-h-0 overflow-hidden">
                            <DataTable
                                data={filteredTerceros}
                                loading={loadingMain}
                                getRowKey={(row, idx) => row.id || idx}
                                rowPy="py-1.5"
                                stickyHeader
                                sortKey="egresos"
                                sortDirection="desc"
                                columns={[
                                    {
                                        header: <TableHeaderCell>Nombre</TableHeaderCell>,
                                        key: 'nombre',
                                        sortable: true,
                                        accessor: (row) => (
                                            <div className="flex items-center gap-2 group cursor-pointer" onClick={() => handleTerceroClick(row)}>
                                                <div className="w-6 h-6 rounded bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all"><Eye className="w-3 h-3" /></div>
                                                <span className="font-bold text-slate-700 group-hover:text-indigo-600 truncate max-w-[180px] text-[11px] uppercase tracking-tighter">{row.nombre}</span>
                                            </div>
                                        )
                                    },
                                    monedaColumn<ItemDesglose>(
                                        'ingresos',
                                        <TableHeaderCell>Ingresos</TableHeaderCell>,
                                        (row) => row.ingresos,
                                        'COP',
                                        { cellClassName: 'text-emerald-600 font-bold text-[11px]', decimals: 0 }
                                    ),
                                    monedaColumn<ItemDesglose>(
                                        'egresos',
                                        <TableHeaderCell>Egresos</TableHeaderCell>,
                                        (row) => row.egresos,
                                        'COP',
                                        { cellClassName: 'text-rose-600 font-bold text-[11px]', colorize: false, decimals: 0 }
                                    )
                                ]}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <DrilldownModal level={centroCostoModal} onClose={() => setCentroCostoModal(p => ({ ...p, isOpen: false }))} onNext={handleCentroCostoClick} />
            <DrilldownModal level={conceptoModal} onClose={() => setConceptoModal(p => ({ ...p, isOpen: false }))} onNext={handleConceptoClick} />
            <MovimientosModal state={detallesModal} onClose={() => setDetallesModal(p => ({ ...p, isOpen: false }))} />
        </div>
    )
}

// Reuse Internal Components
const DrilldownModal = ({ level, onClose, onNext }: any) => {
    const [q, setQ] = useState('')
    const [sort, setSort] = useState({ key: level.sortField || 'egresos', dir: 'desc' as 'asc' | 'desc' })
    if (!level.isOpen) return null
    const data = level.data.filter((d: any) => d.nombre.toLowerCase().includes(q.toLowerCase()))
    const sorted = [...data].sort((a: any, b: any) => {
        const factor = sort.dir === 'asc' ? 1 : -1
        if (sort.key === 'nombre') return factor * a.nombre.localeCompare(b.nombre)
        return factor * ((a[sort.key] || 0) - (b[sort.key] || 0))
    })

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <div className="w-full max-w-4xl h-[650px] bg-white shadow-2xl flex flex-col animate-in zoom-in duration-300 rounded-3xl overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><ArrowLeft className="w-5 h-5" /></button>
                        <div>
                            <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">
                                <span>Reporte</span>{level.grandParentName && <><span className="mx-1 opacity-30">/</span><span className="text-slate-500">{level.grandParentName}</span></>}<span className="mx-1 opacity-30">/</span><span className="text-indigo-600">{level.parentName}</span>
                            </div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">{level.title}</h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X className="w-5 h-5" /></button>
                </div>
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div className="relative flex-1 max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="text" placeholder="Buscar..." className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl outline-none" value={q} onChange={(e) => setQ(e.target.value)} autoFocus /></div>
                    <div className="flex gap-4 text-right">
                        <div><p className="text-[9px] text-slate-400 font-bold uppercase">Ingresos</p><p className="text-xs font-mono text-emerald-600 font-bold"><CurrencyDisplay value={sorted.reduce((acc, c) => acc + c.ingresos, 0)} colorize={false} /></p></div>
                        <div><p className="text-[9px] text-slate-400 font-bold uppercase">Egresos</p><p className="text-xs font-mono text-rose-600 font-bold"><CurrencyDisplay value={sorted.reduce((acc, c) => acc + c.egresos, 0)} colorize={false} /></p></div>
                    </div>
                </div>
                <div className="flex-1 overflow-auto p-2">
                    <DataTable
                        data={sorted}
                        getRowKey={(row, idx) => row.id || idx}
                        rowPy="py-1.5"
                        stickyHeader
                        sortKey={sort.key}
                        sortDirection={sort.dir}
                        onSort={(key, dir) => dir && setSort({ key, dir })}
                        columns={[
                            {
                                header: <TableHeaderCell>Descripción</TableHeaderCell>,
                                key: 'nombre',
                                sortable: true,
                                accessor: (row: any) => (
                                    <div className="flex items-center gap-3 group cursor-pointer" onClick={() => onNext(row)}>
                                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all"><Eye className="w-3.5 h-3.5" /></div>
                                        <span className="font-bold text-slate-700 group-hover:text-indigo-600 text-[10.5px] uppercase tracking-tighter underline decoration-slate-200 group-hover:decoration-indigo-200 underline-offset-4">{row.nombre}</span>
                                    </div>
                                )
                            },
                            monedaColumn<any>('ingresos', <TableHeaderCell>Ingresos</TableHeaderCell>, (row) => row.ingresos, 'COP', { cellClassName: 'text-[11px] text-emerald-600', decimals: 0 }),
                            monedaColumn<any>('egresos', <TableHeaderCell>Egresos</TableHeaderCell>, (row) => row.egresos, 'COP', { cellClassName: 'text-[11px] text-rose-600', colorize: false, decimals: 0 }),
                            monedaColumn<any>('saldo', <TableHeaderCell>Saldo</TableHeaderCell>, (row) => row.saldo, 'COP', { cellClassName: 'text-[11px]', decimals: 0 })
                        ]} />
                </div>
            </div>
        </div>
    )
}

const MovimientosModal = ({ state, onClose }: any) => {
    if (!state.isOpen) return null
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300 p-4">
            <div className="w-full max-w-5xl h-[650px] bg-white shadow-2xl flex flex-col animate-in zoom-in duration-300 rounded-3xl overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500"><X className="w-6 h-6" /></button>
                        <div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
                                <span>Transacciones</span><span className="opacity-30">/</span><span>{state.terceroNombre}</span>{state.centroCostoNombre && <><span className="opacity-30">/</span><span>{state.centroCostoNombre}</span></>}
                            </div>
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3"><FileSpreadsheet className="w-6 h-6 text-indigo-500" />{state.conceptoNombre}</h2>
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-auto bg-slate-50/30">
                    <DrilldownTable
                        data={state.data}
                        loading={state.loading}
                        getRowKey={(row, idx) => row.id || idx}
                        rowPy="py-1.5"
                        stickyHeader
                        columns={[
                            fechaColumn<Movimiento>('fecha', <TableHeaderCell>Fecha</TableHeaderCell>, (row) => row.fecha, { width: 'w-24' }),
                            {
                                header: <TableHeaderCell>Referencia / Descripción</TableHeaderCell>,
                                key: 'descripcion',
                                sortable: true,
                                accessor: (row) => (
                                    <div className="flex flex-col">
                                        <span className="text-[11px] font-bold text-slate-700">{row.referencia || 'SIN REF'}</span>
                                        <span className="text-[9px] text-slate-400 font-medium uppercase truncate max-w-[300px] mt-0.5">{row.descripcion}</span>
                                    </div>
                                )
                            },
                            monedaColumn<Movimiento>('valor', <TableHeaderCell>Total</TableHeaderCell>, (row) => row.valor, 'COP', { cellClassName: 'text-[11px]', decimals: 0 }),
                            monedaColumn<Movimiento>('valor_calculado', <TableHeaderCell>Valor Asignado</TableHeaderCell>, (row) => {
                                const relevante = row.detalles?.filter((d: any) =>
                                    (state.conceptoId && d.concepto_id === state.conceptoId) &&
                                    (state.centroCostoId && d.centro_costo_id === state.centroCostoId)
                                ) || []
                                const suma = relevante.reduce((acc: number, curr: any) => acc + curr.valor, 0)
                                return suma || row.valor
                            }, 'COP', { cellClassName: 'text-[11px]', decimals: 0 })
                        ]}
                    />
                </div>
            </div>
        </div>
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
                <div className={`text-2xl font-black font-mono tracking-tight ${colorClass} flex items-baseline gap-2`}>
                    {isCurrency && typeof value === 'number' ? <CurrencyDisplay value={value} colorize={false} decimals={0} /> : <span>{value}</span>}
                    {secondaryValue !== null && (
                        <span className="text-sm opacity-40 font-medium text-slate-400 font-sans">/ {secondaryValue}</span>
                    )}
                </div>
                <div className="flex items-center gap-1 text-[9px] text-slate-400 font-medium">
                    <span className="w-1 h-1 rounded-full bg-slate-200" />
                    {secondaryValue !== null ? 'Visible / Total' : 'Periodo Actual'}
                </div>
            </div>
            <div className={`p-3.5 ${bgColorClass} ${colorClass} rounded-2xl group-hover:scale-110 transition-transform duration-300 shadow-sm shadow-inner`}>
                {icon}
            </div>
        </div>
    )
}

