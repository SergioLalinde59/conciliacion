import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { apiService } from '../services/api'
import { Download, Search, FileSpreadsheet, ArrowLeft, X, LayoutList, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, Minus, Eye } from 'lucide-react'
import { useReporteClasificacion, useConfiguracionExclusion } from '../hooks/useReportes'
import { useSessionStorage } from '../hooks/useSessionStorage'
import { getMesActual, getPreviousPeriod } from '../utils/dateUtils'
import { FiltrosReporte } from '../components/organisms/FiltrosReporte'

import { CurrencyDisplay } from '../components/atoms/CurrencyDisplay'
import { DataTable } from '../components/molecules/DataTable'
import * as XLSX from 'xlsx'
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
    grandGrandParentId?: number
    grandGrandParentName?: string
    data: ItemDesglose[]
    isOpen: boolean
    sortAsc: boolean
    sortField: 'nombre' | 'ingresos' | 'egresos' | 'saldo'
}

export const ReporteClasificacionesPage = () => {
    // ---- Filtros y Estado ----
    const [desde, setDesde] = useSessionStorage('rep_clasif_desde', getMesActual().inicio)
    const [hasta, setHasta] = useSessionStorage('rep_clasif_hasta', getMesActual().fin)
    const [cuentaId, setCuentaId] = useSessionStorage('rep_clasif_cuentaId', '')
    const [terceroId, setTerceroId] = useSessionStorage('rep_clasif_terceroId', '')
    const [centroCostoId, setCentroCostoId] = useSessionStorage('rep_clasif_centroCostoId', '')
    const [conceptoId, setConceptoId] = useSessionStorage('rep_clasif_conceptoId', '')
    const [busqueda, setBusqueda] = useState('')
    const [mostrarIngresos, setMostrarIngresos] = useSessionStorage('rep_clasif_ingresos', false)
    const [mostrarEgresos, setMostrarEgresos] = useSessionStorage('rep_clasif_egresos', true)

    // Dynamic Exclusion
    const { data: configExclusion = [] } = useConfiguracionExclusion()
    const [centrosCostosExcluidos, setCentrosCostosExcluidos] = useSessionStorage<number[] | null>('rep_clasif_cc_excluidos', null)
    const actualCentrosCostosExcluidos = centrosCostosExcluidos || []

    useEffect(() => {
        if (configExclusion.length > 0 && centrosCostosExcluidos === null) {
            const defaults = configExclusion.filter(d => d.activo_por_defecto).map(d => d.centro_costo_id)
            setCentrosCostosExcluidos(defaults)
        }
    }, [configExclusion, centrosCostosExcluidos, setCentrosCostosExcluidos])

    // Modals
    const [terceroModal, setTerceroModal] = useState<DrilldownLevel>({
        level: 'tercero', title: '', data: [], isOpen: false, sortAsc: false, sortField: 'egresos'
    })
    const [conceptoModal, setConceptoModal] = useState<DrilldownLevel>({
        level: 'concepto', title: '', data: [], isOpen: false, sortAsc: false, sortField: 'egresos'
    })
    const [detallesModal, setDetallesModal] = useState<{
        isOpen: boolean; title: string; data: Movimiento[]; loading: boolean;
        clasificacionId?: number; terceroId?: number; centroCostoId?: number; conceptoId?: number;
        clasificacionNombre?: string; terceroNombre?: string; centroCostoNombre?: string; conceptoNombre?: string;
    }>({ isOpen: false, title: '', data: [], loading: false })

    // ---- Data Fetching ----
    const paramsMain = useMemo(() => ({
        tipo: 'centro_costo', desde, hasta,
        cuenta_id: cuentaId ? Number(cuentaId) : undefined,
        tercero_id: terceroId ? Number(terceroId) : undefined,
        centro_costo_id: centroCostoId ? Number(centroCostoId) : undefined,
        concepto_id: conceptoId ? Number(conceptoId) : undefined,
        centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined,
        ver_ingresos: mostrarIngresos,
        ver_egresos: mostrarEgresos
    }), [desde, hasta, cuentaId, terceroId, centroCostoId, conceptoId, actualCentrosCostosExcluidos, mostrarIngresos, mostrarEgresos])

    const { data: gruposDataRaw, isLoading: loadingMain } = useReporteClasificacion(paramsMain)
    const gruposData = (gruposDataRaw as ItemDesglose[]) || []

    // Comparativa
    const prevPeriod = useMemo(() => getPreviousPeriod(desde, hasta), [desde, hasta])
    const paramsAnterior = useMemo(() => ({
        tipo: 'centro_costo', desde: prevPeriod.inicio, hasta: prevPeriod.fin,
        cuenta_id: cuentaId ? Number(cuentaId) : undefined,
        tercero_id: terceroId ? Number(terceroId) : undefined,
        centro_costo_id: centroCostoId ? Number(centroCostoId) : undefined,
        concepto_id: conceptoId ? Number(conceptoId) : undefined,
        centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined,
        ver_ingresos: mostrarIngresos,
        ver_egresos: mostrarEgresos
    }), [prevPeriod, cuentaId, terceroId, centroCostoId, conceptoId, actualCentrosCostosExcluidos, mostrarIngresos, mostrarEgresos])
    const { data: datosAnteriorRaw } = useReporteClasificacion(paramsAnterior)

    // ---- Handlers ----
    // Nivel 1: Click en Centro de Costo (Antes Grupo) -> Abre Terceros
    const handleGrupoClick = async (item: ItemDesglose) => {
        setTerceroModal({
            level: 'tercero',
            title: `Terceros: ${item.nombre}`,
            parentId: item.id,
            parentName: item.nombre,
            data: [],
            isOpen: true,
            sortAsc: false,
            sortField: 'egresos'
        })
        const data = await apiService.movimientos.reporteDesgloseGastos({
            nivel: 'tercero', fecha_inicio: desde, fecha_fin: hasta,
            cuenta_id: cuentaId ? Number(cuentaId) : undefined,
            centro_costo_id: item.id, // CORE FIX: Refactor Clasificacion -> Centro Costo
            tercero_id: terceroId ? Number(terceroId) : undefined,
            // centro_costo_id: centroCostoId ? Number(centroCostoId) : undefined, // Removed duplicate/conflicting param since item.id is the CC
            concepto_id: conceptoId ? Number(conceptoId) : undefined,
            centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined,
            ver_ingresos: mostrarIngresos, ver_egresos: mostrarEgresos
        } as any)
        setTerceroModal(prev => ({ ...prev, data: (data as ItemDesglose[]) || [] }))
    }

    // Nivel 2: Click en Tercero -> Abre Conceptos
    const handleTerceroClick = async (item: ItemDesglose) => {
        setConceptoModal({
            level: 'concepto',
            title: `Conceptos: ${item.nombre}`,
            parentId: item.id, // This is the Tercero ID
            parentName: item.nombre, // This is the Tercero Name
            grandParentId: terceroModal.parentId, // This is the L1 Centro Costo ID
            grandParentName: terceroModal.parentName, // This is the L1 Centro Costo Name
            data: [],
            isOpen: true,
            sortAsc: false,
            sortField: 'egresos'
        })
        const data = await apiService.movimientos.reporteDesgloseGastos({
            nivel: 'concepto',
            tercero_id: item.id,
            centro_costo_id: terceroModal.parentId, // CORE FIX: Use the L1 CC ID
            fecha_inicio: desde, fecha_fin: hasta,
            cuenta_id: cuentaId ? Number(cuentaId) : undefined,
            centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined,
            ver_ingresos: mostrarIngresos, ver_egresos: mostrarEgresos
        } as any)
        setConceptoModal(prev => ({ ...prev, data: (data as ItemDesglose[]) || [] }))
    }

    // handleCentroCostoClick removed as per new 3-level hierarchy: Centro Costo -> Tercero -> Concepto

    // Nivel 3 (Leaf): Click en Concepto -> Abre Movimientos
    const handleConceptoClick = (item: ItemDesglose) => {
        setDetallesModal({
            isOpen: true,
            title: `Movimientos: ${item.nombre}`,
            data: [],
            loading: true,
            centroCostoId: conceptoModal.grandParentId!, // L1 Centro Costo ID
            terceroId: conceptoModal.parentId!, // L2 Tercero ID
            conceptoId: item.id, // L3 Concepto ID
            centroCostoNombre: conceptoModal.grandParentName,
            terceroNombre: conceptoModal.parentName,
            conceptoNombre: item.nombre
        })
        apiService.movimientos.listar({
            centro_costo_id: conceptoModal.grandParentId!,
            tercero_id: conceptoModal.parentId!,
            concepto_id: item.id,
            desde, hasta, limit: 1000,
            ver_ingresos: mostrarIngresos, ver_egresos: mostrarEgresos,
            centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined
        } as any).then((response: any) => {
            setDetallesModal(prev => ({ ...prev, data: response.items || [], loading: false }))
        })
    }

    const handleLimpiar = () => {
        const mes = getMesActual()
        setDesde(mes.inicio); setHasta(mes.fin); setCuentaId('')
        setTerceroId(''); setCentroCostoId(''); setConceptoId('')
        if (configExclusion.length > 0) setCentrosCostosExcluidos(configExclusion.filter(d => d.activo_por_defecto).map(d => d.centro_costo_id))
        else setCentrosCostosExcluidos([])
    }

    const filteredGrupos = useMemo(() => {
        if (!gruposData || !Array.isArray(gruposData)) return []
        const data = gruposData || []
        if (!busqueda) return data
        return data.filter((g: any) => g.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    }, [gruposData, busqueda])

    // Calcular total actual sumando los items (ya que no viene un objeto resumen 'totalActual')
    const totalActual = useMemo(() => {
        const data = filteredGrupos as any[]
        return {
            ingresos: data.reduce((acc, curr) => acc + (curr.ingresos || 0), 0),
            egresos: data.reduce((acc, curr) => acc + (curr.egresos || 0), 0),
            saldo: data.reduce((acc, curr) => acc + (curr.saldo || 0), 0),
            grupos: data // Mantener referencia para conteo
        }
    }, [filteredGrupos])

    const totalesAnteriorResumen = useMemo(() => {
        if (!datosAnteriorRaw || !Array.isArray(datosAnteriorRaw)) return { ingresos: 0, egresos: 0, saldo: 0 }
        const data = datosAnteriorRaw as any[]
        return {
            ingresos: data.reduce((acc, curr) => acc + (curr.ingresos || 0), 0),
            egresos: data.reduce((acc, curr) => acc + (curr.egresos || 0), 0),
            saldo: data.reduce((acc, curr) => acc + (curr.saldo || 0), 0)
        }
    }, [datosAnteriorRaw])

    const plotData = useMemo(() => {
        return [...filteredGrupos].sort((a: any, b: any) => {
            return (b.egresos || 0) - (a.egresos || 0)
        }).slice(0, 15)
    }, [filteredGrupos])

    const tableData = useMemo(() => {
        return [...filteredGrupos].sort((a: any, b: any) => {
            return (b.egresos || 0) - (a.egresos || 0)
        })
    }, [filteredGrupos])

    const exportToExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filteredGrupos.map((g: any) => ({ Clasificación: g.nombre, Ingresos: g.ingresos, Egresos: g.egresos, Saldo: g.saldo })))
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Clasificaciones")
        XLSX.writeFile(wb, `Reporte_Clasificaciones_${desde}.xlsx`)
    }

    const getChartTitle = () => {
        if (conceptoId) return "Distribución (Concepto Filtrado)"
        if (centroCostoId) return "Distribución por Concepto (Filtrado)"
        if (terceroId) return "Distribución por Tercero (Filtrado)"
        return "Distribución por Centro de Costo"
    }

    const calculateTrend = (current: number, previous?: number) => {
        if (previous === undefined || previous === null || previous === 0) return null
        return ((current - previous) / Math.abs(previous)) * 100
    }

    return (
        <div className="flex flex-col h-full bg-slate-50/50 overflow-hidden">
            {/* Dashboard Header */}
            <div className="px-6 pt-6 pb-2 bg-white flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Reporte de Clasificación</h1>
                    <p className="text-slate-500 text-sm mt-1">Drilldown interactivo de egresos</p>
                </div>
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
                showClasificacionFilters={true}
                onLimpiar={handleLimpiar}
            />

            <div className="flex-1 min-h-0 p-4 space-y-4 overflow-hidden flex flex-col">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
                    {/* Card: Registros */}
                    <StatCard
                        label="Registros"
                        value={filteredGrupos.length}
                        secondaryValue={totalActual?.grupos?.length || 0}
                        icon={<LayoutList className="w-5 h-5" />}
                        colorClass="text-slate-600"
                        bgColorClass="bg-slate-50"
                        borderColor="group-hover:border-slate-300"
                        isCurrency={false}
                    />

                    <StatCard
                        label="Total Ingresos"
                        value={totalActual.ingresos}
                        trend={calculateTrend(totalActual.ingresos, totalesAnteriorResumen.ingresos)}
                        icon={<TrendingUp className="w-5 h-5" />}
                        colorClass="text-emerald-600"
                        bgColorClass="bg-emerald-50"
                        borderColor="group-hover:border-emerald-200"
                    />
                    <StatCard
                        label="Total Egresos"
                        value={totalActual.egresos}
                        trend={calculateTrend(totalActual.egresos, totalesAnteriorResumen.egresos)}
                        isEgreso
                        icon={<TrendingDown className="w-5 h-5" />}
                        colorClass="text-rose-600"
                        bgColorClass="bg-rose-50"
                        borderColor="group-hover:border-rose-200"
                    />
                    <StatCard
                        label="Saldo Neto"
                        value={totalActual.saldo}
                        trend={calculateTrend(totalActual.saldo, totalesAnteriorResumen.saldo)}
                        icon={<Wallet className="w-5 h-5" />}
                        colorClass={(totalActual.saldo || 0) >= 0 ? "text-indigo-600" : "text-rose-600"}
                        bgColorClass="bg-indigo-50"
                        borderColor="group-hover:border-indigo-200"
                    />
                </div>

                <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Visualización de Tendencia */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 h-full flex flex-col overflow-hidden">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><FileSpreadsheet className="w-5 h-5" /></div>
                            <h3 className="font-bold text-slate-800 tracking-tight">{getChartTitle()}</h3>
                        </div>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={plotData}
                                    layout="vertical"
                                    margin={{ left: 20, right: 30 }}
                                    onClick={(d) => (d as any)?.activePayload && handleGrupoClick((d as any).activePayload[0].payload)}
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
                                        onDoubleClick={(d) => (d as any)?.payload && handleGrupoClick((d as any).payload)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {plotData.map((_, index) => <Cell key={`c-${index}`} fill={index === 0 ? '#4f46e5' : '#6366f1'} opacity={1 - index * 0.05} />)}
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
                                <input type="text" placeholder="Buscar..." className="w-48 pl-1 py-1 text-xs border-none outline-none" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                            </div>
                            <button onClick={exportToExcel} className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors"><Download className="w-4 h-4" /></button>
                        </div>
                        <div className="flex-1 min-h-0 overflow-hidden">
                            <DataTable
                                data={tableData}
                                loading={loadingMain}
                                rowPy="py-1.5"
                                getRowKey={(row, idx) => row.nombre || idx}
                                stickyHeader
                                sortKey="egresos"
                                sortDirection="desc"
                                columns={[
                                    {
                                        header: <TableHeaderCell>Centro de Costo</TableHeaderCell>,
                                        key: 'nombre',
                                        sortable: true,
                                        accessor: (row) => (
                                            <div className="flex items-center gap-2 group cursor-pointer" onClick={() => handleGrupoClick(row)}>
                                                <div className="w-6 h-6 rounded bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all"><Eye className="w-3 h-3" /></div>
                                                <span className="font-bold text-slate-700 group-hover:text-indigo-600 truncate max-w-[180px] text-[11px] uppercase tracking-tighter">{row.nombre}</span>
                                            </div>
                                        )
                                    },
                                    monedaColumn<ItemDesglose>('ingresos', <TableHeaderCell>Ingresos</TableHeaderCell>, (row) => row.ingresos, 'COP', { cellClassName: 'text-emerald-600 text-[11px]', decimals: 0 }),
                                    monedaColumn<ItemDesglose>('egresos', <TableHeaderCell>Egresos</TableHeaderCell>, (row) => row.egresos, 'COP', { cellClassName: 'text-rose-600 text-[11px]', colorize: false, decimals: 0 }),
                                ]}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <DrilldownModal level={terceroModal} onClose={() => setTerceroModal(p => ({ ...p, isOpen: false }))} onNext={handleTerceroClick} />
            <DrilldownModal level={conceptoModal} onClose={() => setConceptoModal(p => ({ ...p, isOpen: false }))} onNext={handleConceptoClick} />
            <MovimientosModal state={detallesModal} onClose={() => setDetallesModal(p => ({ ...p, isOpen: false }))} />
        </div>
    )
}

const DrilldownModal = ({ level, onClose, onNext }: { level: DrilldownLevel, onClose: () => void, onNext: (item: ItemDesglose) => void }) => {
    const [q, setQ] = useState('')
    const [sort, setSort] = useState({ key: level.sortField || 'egresos', dir: 'desc' as 'asc' | 'desc' })
    if (!level.isOpen) return null
    const dataFiltered = level.data.filter(d => d.nombre.toLowerCase().includes(q.toLowerCase()))
    const sorted = [...dataFiltered].sort((a, b) => {
        const factor = sort.dir === 'asc' ? 1 : -1
        if (sort.key === 'nombre') return factor * a.nombre.localeCompare(b.nombre)
        return factor * ((a[sort.key as keyof ItemDesglose] || 0) as number - ((b[sort.key as keyof ItemDesglose] || 0) as number))
    })

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <div className="w-full max-w-4xl h-[650px] bg-white shadow-2xl flex flex-col animate-in zoom-in duration-300 rounded-3xl overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><ArrowLeft className="w-5 h-5" /></button>
                        <div>
                            <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">
                                <span>Reporte</span>
                                {level.grandGrandParentName && <><span className="mx-1 opacity-30">/</span><span className="text-slate-500">{level.grandGrandParentName}</span></>}
                                {level.grandParentName && <><span className="mx-1 opacity-30">/</span><span className="text-slate-500">{level.grandParentName}</span></>}
                                <span className="mx-1 opacity-30">/</span><span className="text-indigo-600">{level.parentName}</span>
                            </div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">{level.title}</h2>
                        </div>
                    </div>
                </div>
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div className="relative flex-1 max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="text" placeholder="Buscar..." className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl outline-none" value={q} onChange={(e) => setQ(e.target.value)} autoFocus /></div>
                    <div className="flex gap-4 text-right">
                        <div><p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Ingresos</p><p className="text-xs font-mono text-emerald-600 font-black"><CurrencyDisplay value={sorted.reduce((acc, c) => acc + c.ingresos, 0)} colorize={false} /></p></div>
                        <div><p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Egresos</p><p className="text-xs font-mono text-rose-600 font-black"><CurrencyDisplay value={sorted.reduce((acc, c) => acc + c.egresos, 0)} colorize={false} /></p></div>
                    </div>
                </div>
                <div className="flex-1 overflow-auto p-2">
                    <DataTable
                        data={sorted}
                        rowPy="py-1.5"
                        stickyHeader
                        getRowKey={(row, idx) => row.id || idx}
                        sortKey={sort.key}
                        sortDirection={sort.dir}
                        onSort={(key, dir) => dir && setSort({ key: key as any, dir })}
                        columns={[
                            {
                                header: <TableHeaderCell>Descripción</TableHeaderCell>,
                                key: 'nombre',
                                sortable: true,
                                accessor: (row: ItemDesglose) => (
                                    <div className="flex items-center gap-3 group cursor-pointer" onClick={() => onNext(row)}>
                                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-sm shadow-indigo-100/50"><Eye className="w-3.5 h-3.5" /></div>
                                        <span className="font-bold text-slate-700 group-hover:text-indigo-600 text-[10.5px] uppercase tracking-tighter underline decoration-slate-200 group-hover:decoration-indigo-200 underline-offset-4">{row.nombre}</span>
                                    </div>
                                )
                            },
                            monedaColumn<ItemDesglose>('ingresos', <TableHeaderCell>Ingresos</TableHeaderCell>, (row) => row.ingresos, 'COP', { cellClassName: 'text-emerald-600 text-[11px]', decimals: 0 }),
                            monedaColumn<ItemDesglose>('egresos', <TableHeaderCell>Egresos</TableHeaderCell>, (row) => row.egresos, 'COP', { cellClassName: 'text-rose-600 text-[11px]', colorize: false, decimals: 0 }),
                            monedaColumn<ItemDesglose>('saldo', <TableHeaderCell>Saldo</TableHeaderCell>, (row) => row.saldo, 'COP', { cellClassName: 'font-bold text-[11px]', decimals: 0 })
                        ]} />
                </div>
            </div>
        </div>
    )
}

const MovimientosModal = ({ state, onClose }: { state: any, onClose: () => void }) => {
    if (!state.isOpen) return null
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300 p-4">
            <div className="w-full max-w-5xl h-[650px] bg-white shadow-2xl flex flex-col animate-in zoom-in duration-300 rounded-3xl overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-transform hover:rotate-90"><X className="w-6 h-6" /></button>
                        <div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
                                <span>Operaciones</span><span className="opacity-30">/</span><span>{state.clasificacionNombre}</span><span className="opacity-30">/</span><span>{state.terceroNombre}</span><span className="opacity-30">/</span><span>{state.centroCostoNombre}</span>
                            </div>
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3"><FileSpreadsheet className="w-6 h-6 text-indigo-500" />{state.conceptoNombre}</h2>
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-auto bg-slate-50/30">
                    <DrilldownTable data={state.data} loading={state.loading} rowPy="py-1.5" stickyHeader getRowKey={(row, idx) => row.id || idx} columns={[
                        fechaColumn<Movimiento>('fecha', <TableHeaderCell>Fecha</TableHeaderCell>, (row) => row.fecha, { width: 'w-24' }),
                        {
                            header: <TableHeaderCell>Referencia / Descripción</TableHeaderCell>,
                            key: 'descripcion',
                            sortable: true,
                            accessor: (row: any) => (
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-black text-slate-700 tracking-tight">{row.referencia || 'SIN REF'}</span>
                                    <span className="text-[9px] text-slate-400 font-medium uppercase truncate max-w-[300px] mt-0.5 leading-tight">{row.descripcion}</span>
                                </div>
                            )
                        },
                        monedaColumn<Movimiento>('valor', <TableHeaderCell>Total</TableHeaderCell>, (row) => row.valor, 'COP', { cellClassName: 'text-[11px]', decimals: 0 }),
                        monedaColumn<Movimiento>('valor_calculado', <TableHeaderCell>Valor Asignado</TableHeaderCell>, (row: any) => {
                            const relevante = row.detalles?.filter((d: any) => (state.conceptoId && d.concepto_id === state.conceptoId) && (state.centroCostoId && d.centro_costo_id === state.centroCostoId)) || []
                            const suma = relevante.reduce((acc: number, curr: any) => acc + curr.valor, 0)
                            return suma || row.valor
                        }, 'COP', { cellClassName: 'text-[11px] font-bold', decimals: 0 })
                    ]} />
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
                <div className={`text-2xl font-black font-mono tracking-tight ${colorClass} flex items-baseline`}>
                    {isCurrency && typeof value === 'number' ? <CurrencyDisplay value={value} colorize={false} decimals={0} /> : <span>{value}</span>}
                    {secondaryValue !== null && (
                        <span className="text-sm opacity-40 font-medium text-slate-400 font-sans ml-2">/ {secondaryValue}</span>
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
