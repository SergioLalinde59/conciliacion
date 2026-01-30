import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { apiService } from '../services/api'
import { Download, Search, FileSpreadsheet, ArrowLeft, X } from 'lucide-react'
import { useReporteClasificacion, useConfiguracionExclusion } from '../hooks/useReportes'
import { useSessionStorage } from '../hooks/useSessionStorage'
import { getMesActual, getPreviousPeriod } from '../utils/dateUtils'
import { FiltrosReporte } from '../components/organisms/FiltrosReporte'
import { EstadisticasTotales } from '../components/organisms/EstadisticasTotales'
import { CurrencyDisplay } from '../components/atoms/CurrencyDisplay'
import { DataTable } from '../components/molecules/DataTable'
import * as XLSX from 'xlsx'
import type { Movimiento } from '../types'

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

    // ---- Data Fetching ----
    const paramsMain = useMemo(() => ({
        tipo: 'totales', desde, hasta,
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
        tipo: 'totales', desde: prevPeriod.inicio, hasta: prevPeriod.fin,
        cuenta_id: cuentaId ? Number(cuentaId) : undefined,
        tercero_id: terceroId ? Number(terceroId) : undefined,
        centro_costo_id: centroCostoId ? Number(centroCostoId) : undefined,
        concepto_id: conceptoId ? Number(conceptoId) : undefined,
        centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined,
        ver_ingresos: mostrarIngresos,
        ver_egresos: mostrarEgresos
    }), [prevPeriod, cuentaId, terceroId, centroCostoId, conceptoId, actualCentrosCostosExcluidos, mostrarIngresos, mostrarEgresos])
    const { data: datosAnteriorRaw } = useReporteClasificacion(paramsAnterior)
    const totalesAnterior = useMemo(() => {
        if (!datosAnteriorRaw || !Array.isArray(datosAnteriorRaw) || datosAnteriorRaw.length === 0) return null
        return datosAnteriorRaw[0] as any
    }, [datosAnteriorRaw])

    // ---- Handlers ----
    const handleTerceroClick = async (item: ItemDesglose) => {
        setTerceroModal({ level: 'tercero', title: `Terceros: ${item.nombre}`, parentId: item.id, parentName: item.nombre, data: [], isOpen: true, sortAsc: false, sortField: 'egresos' })
        const data = await apiService.movimientos.reporteDesgloseGastos({
            nivel: 'tercero', fecha_inicio: desde, fecha_fin: hasta,
            cuenta_id: cuentaId ? Number(cuentaId) : undefined,
            tercero_id: terceroId ? Number(terceroId) : undefined,
            centro_costo_id: centroCostoId ? Number(centroCostoId) : undefined,
            concepto_id: conceptoId ? Number(conceptoId) : undefined,
            centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined,
            ver_ingresos: mostrarIngresos, ver_egresos: mostrarEgresos
        } as any)
        setTerceroModal(prev => ({ ...prev, data: (data as ItemDesglose[]) || [] }))
    }

    const handleCentroCostoClick = async (item: ItemDesglose) => {
        setCentroCostoModal({ level: 'centro_costo', title: `Centros de Costo: ${item.nombre}`, parentId: item.id, parentName: item.nombre, grandParentId: terceroModal.parentId, grandParentName: terceroModal.parentName, data: [], isOpen: true, sortAsc: false, sortField: 'egresos' })
        const data = await apiService.movimientos.reporteDesgloseGastos({
            nivel: 'centro_costo', tercero_id: item.id, fecha_inicio: desde, fecha_fin: hasta,
            cuenta_id: cuentaId ? Number(cuentaId) : undefined,
            centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined,
            ver_ingresos: mostrarIngresos, ver_egresos: mostrarEgresos
        } as any)
        setCentroCostoModal(prev => ({ ...prev, data: (data as ItemDesglose[]) || [] }))
    }

    const handleConceptoClick = async (item: ItemDesglose) => {
        setConceptoModal({ level: 'concepto', title: `Conceptos: ${item.nombre}`, parentId: item.id, parentName: item.nombre, grandParentId: centroCostoModal.parentId, grandParentName: centroCostoModal.parentName, data: [], isOpen: true, sortAsc: false, sortField: 'egresos' })
        const data = await apiService.movimientos.reporteDesgloseGastos({
            nivel: 'concepto', tercero_id: centroCostoModal.parentId, centro_costo_id: item.id, fecha_inicio: desde, fecha_fin: hasta,
            cuenta_id: cuentaId ? Number(cuentaId) : undefined,
            centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined,
            ver_ingresos: mostrarIngresos, ver_egresos: mostrarEgresos
        } as any)
        setConceptoModal(prev => ({ ...prev, data: (data as ItemDesglose[]) || [] }))
    }

    const handleDetallesClick = (item: ItemDesglose) => {
        setDetallesModal({ isOpen: true, title: `Movimientos: ${item.nombre}`, data: [], loading: true, terceroId: conceptoModal.grandParentId!, centroCostoId: conceptoModal.parentId!, conceptoId: item.id, terceroNombre: conceptoModal.grandParentName, centroCostoNombre: conceptoModal.parentName, conceptoNombre: item.nombre })
        apiService.movimientos.listar({
            tercero_id: conceptoModal.grandParentId!, centro_costo_id: conceptoModal.parentId!, concepto_id: item.id,
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
        if (!gruposData || !Array.isArray(gruposData) || gruposData.length === 0) return []
        const data = (gruposData[0] as any).grupos || []
        if (!busqueda) return data
        return data.filter((g: any) => g.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    }, [gruposData, busqueda])

    const totalActual = gruposData[0] as any

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
        if (terceroId) return "Distribución por Centro de Costo (Filtrado)"
        return "Distribución por Grupo"
    }

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            <FiltrosReporte
                desde={desde} setDesde={setDesde}
                hasta={hasta} setHasta={setHasta}
                cuentaId={cuentaId} setCuentaId={setCuentaId}
                terceroId={terceroId} setTerceroId={setTerceroId}
                centroCostoId={centroCostoId} setCentroCostoId={setCentroCostoId}
                conceptoId={conceptoId} setConceptoId={setConceptoId}
                centrosCostosExcluidos={actualCentrosCostosExcluidos}
                setCentrosCostosExcluidos={setCentrosCostosExcluidos}
                mostrarIngresos={mostrarIngresos}
                setMostrarIngresos={setMostrarIngresos}
                mostrarEgresos={mostrarEgresos}
                setMostrarEgresos={setMostrarEgresos}
                showClasificacionFilters={true}
                onLimpiar={handleLimpiar}
            />

            <div className="flex-1 overflow-auto p-4 space-y-4">
                <EstadisticasTotales
                    ingresos={totalActual?.ingresos || 0}
                    egresos={totalActual?.egresos || 0}
                    saldo={totalActual?.saldo || 0}
                    comparativaAnterior={totalesAnterior}
                />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Visualización de Tendencia */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 h-[800px] flex flex-col">
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
                                                        <p className="flex justify-between gap-4"><span className="opacity-60 font-medium">Egresos:</span><span className="font-mono text-rose-400 font-bold"><CurrencyDisplay value={d.egresos} /></span></p>
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
                                        {plotData.map((_, index) => <Cell key={`c-${index}`} fill={index === 0 ? '#4f46e5' : '#6366f1'} opacity={1 - index * 0.05} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Tabla Principal */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden h-[800px]">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-50 rounded-lg text-slate-500"><Search className="w-4 h-4" /></div>
                                <input type="text" placeholder="Buscar..." className="w-48 pl-1 py-1 text-xs border-none outline-none" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                            </div>
                            <button onClick={exportToExcel} className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors"><Download className="w-4 h-4" /></button>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <DataTable
                                data={tableData}
                                loading={loadingMain}
                                rowPy="py-1.5"
                                getRowKey={(row, idx) => row.nombre || idx}
                                stickyHeader
                                columns={[
                                    {
                                        header: 'Grupo / Clasificación',
                                        key: 'nombre',
                                        sortable: true,
                                        render: (row) => (
                                            <div className="flex items-center gap-2 group cursor-pointer" onClick={() => handleTerceroClick(row)}>
                                                <div className="w-6 h-6 rounded bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all"><Search className="w-3 h-3" /></div>
                                                <span className="font-bold text-slate-700 group-hover:text-indigo-600 truncate max-w-[180px] text-[11px] uppercase tracking-tighter">{row.nombre}</span>
                                            </div>
                                        )
                                    },
                                    { header: 'Ingresos', key: 'ingresos', sortable: true, className: 'text-right font-mono text-emerald-600 text-[11px]', render: (row) => <div className="text-emerald-600"><CurrencyDisplay value={row.ingresos} colorize={false} /></div> },
                                    { header: 'Egresos', key: 'egresos', sortable: true, className: 'text-right font-mono text-rose-600 text-[11px]', render: (row) => <div className="text-rose-600"><CurrencyDisplay value={row.egresos} colorize={false} /></div> },
                                ]}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <DrilldownModal level={terceroModal} onClose={() => setTerceroModal(p => ({ ...p, isOpen: false }))} onNext={handleCentroCostoClick} />
            <DrilldownModal level={centroCostoModal} onClose={() => setCentroCostoModal(p => ({ ...p, isOpen: false }))} onNext={handleConceptoClick} />
            <DrilldownModal level={conceptoModal} onClose={() => setConceptoModal(p => ({ ...p, isOpen: false }))} onNext={handleDetallesClick} />
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
            <div className="w-full max-w-4xl h-[800px] bg-white shadow-2xl flex flex-col animate-in zoom-in duration-300 rounded-3xl overflow-hidden">
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
                                header: 'Descripción', key: 'nombre', sortable: true, render: (row: ItemDesglose) => (
                                    <div className="flex items-center gap-3 group cursor-pointer" onClick={() => onNext(row)}>
                                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-sm shadow-indigo-100/50"><Search className="w-3.5 h-3.5" /></div>
                                        <span className="font-bold text-slate-700 group-hover:text-indigo-600 text-[10.5px] uppercase tracking-tighter underline decoration-slate-200 group-hover:decoration-indigo-200 underline-offset-4">{row.nombre}</span>
                                    </div>
                                )
                            },
                            { header: 'Ingresos', key: 'ingresos', sortable: true, className: 'text-right font-mono text-[11px]', render: (row: ItemDesglose) => <div className="text-emerald-600"><CurrencyDisplay value={row.ingresos} colorize={false} /></div> },
                            { header: 'Egresos', key: 'egresos', sortable: true, className: 'text-right font-mono text-[11px]', render: (row: ItemDesglose) => <div className="text-rose-600"><CurrencyDisplay value={row.egresos} colorize={false} /></div> },
                            { header: 'Saldo', key: 'saldo', sortable: true, className: 'text-right font-mono font-bold text-[11px]', render: (row: ItemDesglose) => <CurrencyDisplay value={row.saldo} colorize /> }
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
            <div className="w-full max-w-5xl h-[800px] bg-white shadow-2xl flex flex-col animate-in zoom-in duration-300 rounded-3xl overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-transform hover:rotate-90"><X className="w-6 h-6" /></button>
                        <div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
                                <span>Operaciones</span><span className="opacity-30">/</span><span>{state.terceroNombre}</span><span className="opacity-30">/</span><span>{state.centroCostoNombre}</span>
                            </div>
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3"><FileSpreadsheet className="w-6 h-6 text-indigo-500" />{state.conceptoNombre}</h2>
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-auto bg-slate-50/30">
                    <DataTable data={state.data} loading={state.loading} rowPy="py-1.5" stickyHeader getRowKey={(row, idx) => row.id || idx} columns={[
                        { header: 'Fecha', key: 'fecha', sortable: true, render: (row: any) => <span className="text-[10px] font-bold text-slate-400 font-mono tracking-tighter">{new Date(row.fecha).toLocaleDateString()}</span> },
                        { header: 'Referencia / Descripción', key: 'descripcion', sortable: true, render: (row: any) => <div className="flex flex-col"><span className="text-[11px] font-black text-slate-700 tracking-tight">{row.referencia || 'SIN REF'}</span><span className="text-[9px] text-slate-400 font-medium uppercase truncate max-w-[300px] mt-0.5 leading-tight">{row.descripcion}</span></div> },
                        { header: 'Total', key: 'valor', sortable: true, className: 'text-right font-mono text-[11px]', render: (row: any) => <CurrencyDisplay value={row.valor} colorize /> },
                        {
                            header: 'Valor Asignado', key: 'valor_calculado', sortable: true, className: 'text-right font-mono text-[11px]', render: (row: any) => {
                                const relevante = row.detalles?.filter((d: any) => (state.conceptoId && d.concepto_id === state.conceptoId) && (state.centroCostoId && d.centro_costo_id === state.centroCostoId)) || []
                                const suma = relevante.reduce((acc: number, curr: any) => acc + curr.valor, 0)
                                return <div className="font-bold"><CurrencyDisplay value={suma || row.valor} colorize /></div>
                            }
                        }
                    ]} />
                </div>
            </div>
        </div>
    )
}
