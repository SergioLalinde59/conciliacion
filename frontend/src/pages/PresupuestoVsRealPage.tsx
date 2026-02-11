import { useState, useEffect, useMemo } from 'react'
import { presupuestoService } from '../services/presupuesto.service'
import { usePresupuestos, usePresupuestoComparacion, usePresupuestoComparacionMensual } from '../hooks/usePresupuesto'
import { useConfiguracionExclusion } from '../hooks/useReportes'
import { SemaforoBadge } from '../components/atoms/SemaforoBadge'
import { CurrencyDisplay } from '../components/atoms/CurrencyDisplay'
import { StatCard } from '../components/molecules/StatCard'
import { FiltrosReporte } from '../components/organisms/FiltrosReporte'
import { ArrowLeft, X, Target, TrendingDown, TrendingUp, BarChart3, Eye, FileSpreadsheet, Search, History } from 'lucide-react'
import { Button } from '../components/atoms/Button'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import * as XLSX from 'xlsx'
import type { ComparacionPresupuesto } from '../types/Presupuesto'

const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export const PresupuestoVsRealPage = () => {
    const { data: presupuestos = [] } = usePresupuestos()
    const { data: configExclusion = [], isFetched: exclusionConfigLoaded } = useConfiguracionExclusion()

    // Estado presupuesto
    const [presupuestoId, setPresupuestoId] = useState<number>(0)

    // Filtros
    const currentMonth = new Date().getMonth() + 1
    const currentYear = new Date().getFullYear()
    const [mesDesde, setMesDesde] = useState(1)
    const [mesHasta, setMesHasta] = useState(currentMonth)
    const [selectedRange, setSelectedRange] = useState('YTD')
    const [cuentaId, setCuentaId] = useState('')
    const [terceroId, setTerceroId] = useState('')
    const [centroCostoId, setCentroCostoId] = useState('')
    const [conceptoId, setConceptoId] = useState('')
    const [mostrarIngresos, setMostrarIngresos] = useState(true)
    const [mostrarEgresos, setMostrarEgresos] = useState(true)
    const [busqueda, setBusqueda] = useState('')
    const [ocultarNoMateriales, setOcultarNoMateriales] = useState(true)

    // CC Exclusion
    const [centrosCostosExcluidos, setCentrosCostosExcluidos] = useState<number[] | null>(null)
    const actualCentrosCostosExcluidos = useMemo(() => centrosCostosExcluidos ?? [], [centrosCostosExcluidos])

    // Drill-down
    const [drillLevel, setDrillLevel] = useState<'centro_costo' | 'concepto' | 'tercero'>('centro_costo')
    const [drillCcId, setDrillCcId] = useState<number | undefined>()
    const [drillCcName, setDrillCcName] = useState('')
    const [, setDrillConceptoId] = useState<number | undefined>()
    const [drillConceptoName, setDrillConceptoName] = useState('')
    const [drillData, setDrillData] = useState<ComparacionPresupuesto[]>([])
    const [drillLoading, setDrillLoading] = useState(false)
    const [drillOpen, setDrillOpen] = useState(false)

    // Seleccionar presupuesto activo por defecto
    const selectedPresupuesto = presupuestos.find(p => p.id === presupuestoId)

    useEffect(() => {
        if (presupuestos.length > 0 && !presupuestoId) {
            const activo = presupuestos.find(p => p.estado === 'activo')
            setPresupuestoId(activo?.id || presupuestos[0].id)
        }
    }, [presupuestos, presupuestoId])

    // Init range from presupuesto year
    useEffect(() => {
        if (selectedPresupuesto) {
            const isCurrentYear = selectedPresupuesto.anio === currentYear
            setMesDesde(1)
            setMesHasta(isCurrentYear ? currentMonth : 12)
            setSelectedRange(isCurrentYear ? 'YTD' : 'Año Completo')
        }
    }, [selectedPresupuesto, currentYear, currentMonth])

    // Cargar exclusiones por defecto
    useEffect(() => {
        if (exclusionConfigLoaded && centrosCostosExcluidos === null) {
            const defaults = configExclusion.filter(d => d.activo_por_defecto).map(d => d.centro_costo_id)
            setCentrosCostosExcluidos(defaults)
        }
    }, [configExclusion, centrosCostosExcluidos, exclusionConfigLoaded])

    const mesInicio = mesDesde
    const mesFin = mesHasta

    // Numeric filter IDs
    const ccIdFilter = centroCostoId ? Number(centroCostoId) : undefined
    const conceptoIdFilter = conceptoId ? Number(conceptoId) : undefined
    const terceroIdFilter = terceroId ? Number(terceroId) : undefined

    // Queries
    const { data: comparacion = [], isLoading } = usePresupuestoComparacion(presupuestoId, {
        nivel: 'centro_costo',
        mes_inicio: mesInicio,
        mes_fin: mesFin,
        centro_costo_id: ccIdFilter,
        concepto_id: conceptoIdFilter,
        centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined
    })

    const mensualParams = useMemo(() => ({
        centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined,
        centro_costo_id: ccIdFilter,
        concepto_id: conceptoIdFilter,
        tercero_id: terceroIdFilter,
    }), [actualCentrosCostosExcluidos, ccIdFilter, conceptoIdFilter, terceroIdFilter])

    const { data: mensual = [] } = usePresupuestoComparacionMensual(presupuestoId, mensualParams)

    // Separar materiales / no-materiales
    const { materiales, noMateriales } = useMemo(() => {
        const numMeses = mesFin - mesInicio + 1
        const umbralMes = selectedPresupuesto?.umbral_minimo_mensual ?? 0
        const umbralAnual = selectedPresupuesto?.umbral_minimo_anual ?? 0

        let data = comparacion
        if (busqueda) data = data.filter(r => r.nombre.toLowerCase().includes(busqueda.toLowerCase()))

        return data.reduce<{ materiales: ComparacionPresupuesto[]; noMateriales: ComparacionPresupuesto[] }>((acc, row) => {
            const promMes = numMeses > 0 ? row.presupuestado / numMeses : 0
            const noMaterial = (umbralMes > 0 && promMes < umbralMes)
                || (umbralAnual > 0 && promMes * 12 < umbralAnual)
            if (noMaterial) acc.noMateriales.push(row)
            else acc.materiales.push(row)
            return acc
        }, { materiales: [], noMateriales: [] })
    }, [comparacion, busqueda, mesInicio, mesFin, selectedPresupuesto])

    const displayData = ocultarNoMateriales ? materiales : [...materiales, ...noMateriales]
    const noMaterialSet = useMemo(() => new Set(noMateriales.map(r => r.id)), [noMateriales])

    // Totales (solo materiales)
    const totales = useMemo(() => ({
        ejecutado_anterior: materiales.reduce((s, r) => s + r.ejecutado_anterior, 0),
        presupuestado: materiales.reduce((s, r) => s + r.presupuestado, 0),
        ejecutado: materiales.reduce((s, r) => s + r.ejecutado, 0),
        variacion: materiales.reduce((s, r) => s + r.variacion, 0),
    }), [materiales])

    const pctGlobal = totales.presupuestado > 0
        ? ((totales.ejecutado / totales.presupuestado) * 100).toFixed(1)
        : '0'

    // Limpiar filtros
    const handleLimpiar = () => {
        const anio = selectedPresupuesto?.anio || currentYear
        const isCurrentYear = anio === currentYear
        setMesDesde(1)
        setMesHasta(isCurrentYear ? currentMonth : 12)
        setSelectedRange(isCurrentYear ? 'YTD' : 'Año Completo')
        setCuentaId('')
        setTerceroId('')
        setCentroCostoId('')
        setConceptoId('')
        setMostrarIngresos(true)
        setMostrarEgresos(true)
        if (configExclusion.length > 0) {
            setCentrosCostosExcluidos(configExclusion.filter(d => d.activo_por_defecto).map(d => d.centro_costo_id))
        } else {
            setCentrosCostosExcluidos([])
        }
    }

    // Drill-down handlers
    const handleCcClick = async (item: ComparacionPresupuesto) => {
        if (!item.id) return
        setDrillLevel('concepto')
        setDrillCcId(item.id)
        setDrillCcName(item.nombre)
        setDrillConceptoId(undefined)
        setDrillConceptoName('')
        setDrillOpen(true)
        setDrillLoading(true)
        try {
            const data = await presupuestoService.comparar(presupuestoId, {
                nivel: 'concepto',
                mes_inicio: mesInicio,
                mes_fin: mesFin,
                centro_costo_id: item.id,
                centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined
            })
            setDrillData(data)
        } catch { setDrillData([]) }
        finally { setDrillLoading(false) }
    }

    const handleConceptoClick = async (item: ComparacionPresupuesto) => {
        setDrillLevel('tercero')
        setDrillConceptoId(item.id ?? undefined)
        setDrillConceptoName(item.nombre)
        setDrillLoading(true)
        try {
            const data = await presupuestoService.comparar(presupuestoId, {
                nivel: 'tercero',
                mes_inicio: mesInicio,
                mes_fin: mesFin,
                centro_costo_id: drillCcId,
                concepto_id: item.id ?? undefined,
                centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined
            })
            setDrillData(data)
        } catch { setDrillData([]) }
        finally { setDrillLoading(false) }
    }

    const handleDrillBack = () => {
        if (drillLevel === 'tercero') {
            setDrillLevel('concepto')
            setDrillConceptoId(undefined)
            setDrillConceptoName('')
            handleCcClick({ id: drillCcId!, nombre: drillCcName, presupuestado: 0, ejecutado: 0, ejecutado_anterior: 0, variacion: 0, variacion_pct: 0, semaforo: 'verde' })
        } else {
            setDrillOpen(false)
        }
    }

    // Excel export
    const exportarExcel = () => {
        const rows = displayData.map(r => ({
            Nombre: r.nombre,
            'Ejec. Anterior': r.ejecutado_anterior,
            Presupuestado: r.presupuestado,
            Ejecutado: r.ejecutado,
            Variacion: r.variacion,
            'Variacion %': r.variacion_pct,
            Semaforo: r.semaforo
        }))
        const ws = XLSX.utils.json_to_sheet(rows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Presupuesto vs Real')
        XLSX.writeFile(wb, `Presupuesto_vs_Real.xlsx`)
    }

    // Chart data mensual
    const chartData = useMemo(() =>
        mensual.map(m => ({
            mes: m.mes_nombre,
            Anterior: m.ejecutado_anterior,
            Presupuestado: m.presupuestado,
            Ejecutado: m.ejecutado,
        }))
    , [mensual])

    return (
        <div className="flex flex-col h-full bg-slate-50/50 overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-2 bg-white flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Presupuesto vs Real</h1>
                    <p className="text-slate-500 text-sm mt-1">Comparación del presupuesto contra gastos reales con semáforos</p>
                </div>
                <select
                    value={presupuestoId}
                    onChange={e => {
                        setPresupuestoId(parseInt(e.target.value))
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                    {presupuestos.map(p => (
                        <option key={p.id} value={p.id}>
                            {p.nombre} ({p.anio}) - {p.estado}
                        </option>
                    ))}
                </select>
            </div>

            {/* Botones de rango mensual + Filtros */}
            <div className="bg-white/90 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-30 px-6 pt-3 shadow-sm">
                <div className="flex items-center gap-2 flex-wrap mb-2">
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
                        {MESES[mesInicio]} - {MESES[mesFin]} {selectedPresupuesto?.anio}
                    </span>
                </div>
            </div>
            <FiltrosReporte
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
                showIngresosEgresos={false}
                showClasificacionFilters={true}
                soloConciliables={false}
            />

            {/* Contenido */}
            <div className="flex-1 min-h-0 p-4 flex flex-col gap-4">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 shrink-0">
                    <StatCard
                        label="Ejec. Año Anterior"
                        value={totales.ejecutado_anterior}
                        icon={<History className="w-5 h-5" />}
                        colorClass="text-slate-600"
                        bgColorClass="bg-slate-50"
                        borderColor="group-hover:border-slate-300"
                        isEgreso
                        subtitle={`Gastos ${(selectedPresupuesto?.anio || new Date().getFullYear()) - 1}`}
                    />
                    <StatCard
                        label="Presupuestado"
                        value={totales.presupuestado}
                        icon={<Target className="w-5 h-5" />}
                        colorClass="text-blue-600"
                        bgColorClass="bg-blue-50"
                        borderColor="group-hover:border-blue-200"
                        subtitle={`${selectedPresupuesto?.nombre || ''} (${MESES[mesInicio]}-${MESES[mesFin]})`}
                    />
                    <StatCard
                        label="Ejecutado Real"
                        value={totales.ejecutado}
                        icon={<TrendingDown className="w-5 h-5" />}
                        colorClass="text-rose-600"
                        bgColorClass="bg-rose-50"
                        borderColor="group-hover:border-rose-200"
                        isEgreso
                        subtitle="Gastos reales del periodo"
                    />
                    <StatCard
                        label="Variación"
                        value={totales.variacion}
                        icon={<TrendingUp className="w-5 h-5" />}
                        colorClass={totales.variacion <= 0 ? 'text-emerald-600' : 'text-rose-600'}
                        bgColorClass={totales.variacion <= 0 ? 'bg-emerald-50' : 'bg-rose-50'}
                        borderColor={totales.variacion <= 0 ? 'group-hover:border-emerald-200' : 'group-hover:border-rose-200'}
                        subtitle="Ejecutado - Presupuestado"
                    />
                    <div className="group bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 flex items-center justify-between transition-all duration-300 hover:shadow-md">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">% Consumido</p>
                            <div className="text-2xl font-black font-mono tracking-tight text-slate-700">
                                {pctGlobal}%
                            </div>
                            <SemaforoBadge
                                valor={parseFloat(pctGlobal) > 100 + (selectedPresupuesto?.semaforo_amarillo_hasta ?? 15) ? 'rojo' : parseFloat(pctGlobal) > 100 + (selectedPresupuesto?.semaforo_verde_hasta ?? 5) ? 'amarillo' : 'verde'}
                                size="sm"
                            />
                        </div>
                        <div className="p-3.5 bg-slate-50 text-slate-600 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                            <BarChart3 className="w-5 h-5" />
                        </div>
                    </div>
                </div>

                {/* Chart + Table */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
                    {/* Chart Mensual */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col min-h-0">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><BarChart3 className="w-5 h-5" /></div>
                            <h3 className="font-bold text-slate-800 tracking-tight">Comparativo Mensual</h3>
                        </div>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ left: 10, right: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000000).toFixed(0)}M`} />
                                    <Tooltip
                                        formatter={(value, name) => [
                                            new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value) || 0),
                                            String(name)
                                        ]}
                                    />
                                    <Legend />
                                    <Bar dataKey="Anterior" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Presupuestado" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Ejecutado" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Tabla CC */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden min-h-0">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-50 rounded-lg text-slate-500"><Search className="w-4 h-4" /></div>
                                <input
                                    type="text"
                                    placeholder="Buscar centro de costo..."
                                    className="w-48 pl-1 py-1 text-xs border-none outline-none"
                                    value={busqueda}
                                    onChange={e => setBusqueda(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                {noMateriales.length > 0 && (
                                    <label className="flex items-center gap-1.5 text-[10px] text-gray-500 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={ocultarNoMateriales}
                                            onChange={e => setOcultarNoMateriales(e.target.checked)}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        Ocultar mínimos ({noMateriales.length})
                                    </label>
                                )}
                                <button onClick={exportarExcel} className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors" title="Exportar Excel">
                                    <FileSpreadsheet className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-gray-50 sticky top-0 z-10">
                                    <tr>
                                        <th className="text-left px-3 py-2 font-bold text-gray-400 capitalize text-[10px] tracking-wide">Centro Costo</th>
                                        <th className="text-right px-3 py-2 font-bold text-gray-400 capitalize text-[10px] tracking-wide">Ejec. Ant.</th>
                                        <th className="text-right px-3 py-2 font-bold text-gray-400 capitalize text-[10px] tracking-wide">Presup.</th>
                                        <th className="text-right px-3 py-2 font-bold text-gray-400 capitalize text-[10px] tracking-wide">Ejecut.</th>
                                        <th className="text-right px-3 py-2 font-bold text-gray-400 capitalize text-[10px] tracking-wide">Var %</th>
                                        <th className="text-center px-3 py-2 font-bold text-gray-400 capitalize text-[10px] tracking-wide">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr><td colSpan={6} className="text-center py-8 text-gray-400">Cargando...</td></tr>
                                    ) : displayData.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-8 text-gray-400">Sin datos</td></tr>
                                    ) : displayData.map((row, idx) => {
                                        const esNoMaterial = noMaterialSet.has(row.id)
                                        return (
                                        <tr
                                            key={row.id ?? idx}
                                            className={`border-b border-gray-50 hover:bg-blue-50/30 cursor-pointer transition-colors ${esNoMaterial ? 'opacity-40' : ''}`}
                                            onClick={() => handleCcClick(row)}
                                        >
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-2 group">
                                                    <div className="w-5 h-5 rounded bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                                        <Eye className="w-3 h-3" />
                                                    </div>
                                                    <span className={`font-bold uppercase tracking-tight ${esNoMaterial ? 'text-gray-400' : 'text-slate-700'}`}>{row.nombre}</span>
                                                </div>
                                            </td>
                                            <td className={`px-3 py-2 text-right font-mono ${esNoMaterial ? 'text-gray-400' : 'text-slate-500'}`}>
                                                <CurrencyDisplay value={row.ejecutado_anterior} colorize={false} decimals={0} />
                                            </td>
                                            <td className={`px-3 py-2 text-right font-mono ${esNoMaterial ? 'text-gray-400' : 'text-blue-600'}`}>
                                                <CurrencyDisplay value={row.presupuestado} colorize={false} decimals={0} />
                                            </td>
                                            <td className={`px-3 py-2 text-right font-mono ${esNoMaterial ? 'text-gray-400' : 'text-rose-600'}`}>
                                                <CurrencyDisplay value={row.ejecutado} colorize={false} decimals={0} />
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono">
                                                {esNoMaterial ? (
                                                    <span className="text-gray-400">{row.variacion_pct > 0 ? '+' : ''}{row.variacion_pct.toFixed(1)}%</span>
                                                ) : (
                                                    <span className={row.variacion_pct > (selectedPresupuesto?.semaforo_amarillo_hasta ?? 15) ? 'text-rose-600' : row.variacion_pct > (selectedPresupuesto?.semaforo_verde_hasta ?? 5) ? 'text-amber-600' : 'text-emerald-600'}>
                                                        {row.variacion_pct > 0 ? '+' : ''}{row.variacion_pct.toFixed(1)}%
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                {esNoMaterial ? (
                                                    <span className="text-[10px] text-gray-300">-</span>
                                                ) : (
                                                    <SemaforoBadge valor={row.semaforo} variacionPct={row.variacion_pct} size="sm" />
                                                )}
                                            </td>
                                        </tr>
                                        )
                                    })}
                                </tbody>
                                {displayData.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                                            <td className="px-3 py-2 uppercase text-slate-600">Total</td>
                                            <td className="px-3 py-2 text-right font-mono text-slate-600">
                                                <CurrencyDisplay value={totales.ejecutado_anterior} colorize={false} decimals={0} />
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-blue-700">
                                                <CurrencyDisplay value={totales.presupuestado} colorize={false} decimals={0} />
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-rose-700">
                                                <CurrencyDisplay value={totales.ejecutado} colorize={false} decimals={0} />
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono">
                                                {totales.presupuestado > 0
                                                    ? `${(((totales.ejecutado - totales.presupuestado) / totales.presupuestado) * 100).toFixed(1)}%`
                                                    : '-'}
                                            </td>
                                            <td />
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Drill-down Modal */}
            {drillOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
                    <div className="w-full max-w-4xl h-[600px] bg-white shadow-2xl flex flex-col rounded-3xl overflow-hidden">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <button onClick={handleDrillBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                                <div>
                                    <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">
                                        <span>Presupuesto</span>
                                        <span className="mx-1 opacity-30">/</span>
                                        <span className="text-indigo-600">{drillCcName}</span>
                                        {drillLevel === 'tercero' && drillConceptoName && (
                                            <>
                                                <span className="mx-1 opacity-30">/</span>
                                                <span className="text-purple-600">{drillConceptoName}</span>
                                            </>
                                        )}
                                    </div>
                                    <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">
                                        {drillLevel === 'concepto' ? 'Conceptos' : 'Terceros'}
                                    </h2>
                                </div>
                            </div>
                            <button onClick={() => setDrillOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Summary row */}
                        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex gap-6 text-right">
                            <div><p className="text-[9px] text-slate-400 font-bold capitalize">Ejec. Anterior</p><p className="text-xs font-mono text-slate-500 font-bold"><CurrencyDisplay value={drillData.reduce((s, r) => s + r.ejecutado_anterior, 0)} colorize={false} /></p></div>
                            <div><p className="text-[9px] text-slate-400 font-bold capitalize">Presupuestado</p><p className="text-xs font-mono text-blue-600 font-bold"><CurrencyDisplay value={drillData.reduce((s, r) => s + r.presupuestado, 0)} colorize={false} /></p></div>
                            <div><p className="text-[9px] text-slate-400 font-bold capitalize">Ejecutado</p><p className="text-xs font-mono text-rose-600 font-bold"><CurrencyDisplay value={drillData.reduce((s, r) => s + r.ejecutado, 0)} colorize={false} /></p></div>
                            <div><p className="text-[9px] text-slate-400 font-bold capitalize">Variación</p><p className="text-xs font-mono font-bold"><CurrencyDisplay value={drillData.reduce((s, r) => s + r.variacion, 0)} /></p></div>
                        </div>

                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="text-left px-3 py-2 font-bold text-gray-400 capitalize text-[10px] tracking-wide">Nombre</th>
                                        <th className="text-right px-3 py-2 font-bold text-gray-400 capitalize text-[10px] tracking-wide">Ejec. Ant.</th>
                                        <th className="text-right px-3 py-2 font-bold text-gray-400 capitalize text-[10px] tracking-wide">Presup.</th>
                                        <th className="text-right px-3 py-2 font-bold text-gray-400 capitalize text-[10px] tracking-wide">Ejecut.</th>
                                        <th className="text-right px-3 py-2 font-bold text-gray-400 capitalize text-[10px] tracking-wide">Variación</th>
                                        <th className="text-right px-3 py-2 font-bold text-gray-400 capitalize text-[10px] tracking-wide">Var %</th>
                                        <th className="text-center px-3 py-2 font-bold text-gray-400 capitalize text-[10px] tracking-wide">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {drillLoading ? (
                                        <tr><td colSpan={7} className="text-center py-8 text-gray-400">Cargando...</td></tr>
                                    ) : drillData.length === 0 ? (
                                        <tr><td colSpan={7} className="text-center py-8 text-gray-400">Sin datos</td></tr>
                                    ) : drillData.map((row, idx) => (
                                        <tr
                                            key={row.id ?? idx}
                                            className={`border-b border-gray-50 hover:bg-blue-50/30 transition-colors ${drillLevel === 'concepto' ? 'cursor-pointer' : ''}`}
                                            onClick={() => drillLevel === 'concepto' && handleConceptoClick(row)}
                                        >
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-2 group">
                                                    {drillLevel === 'concepto' && (
                                                        <div className="w-5 h-5 rounded bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                                            <Eye className="w-3 h-3" />
                                                        </div>
                                                    )}
                                                    <span className="font-bold text-slate-700 uppercase tracking-tight">{row.nombre}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-slate-500">
                                                <CurrencyDisplay value={row.ejecutado_anterior} colorize={false} decimals={0} />
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-blue-600">
                                                <CurrencyDisplay value={row.presupuestado} colorize={false} decimals={0} />
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-rose-600">
                                                <CurrencyDisplay value={row.ejecutado} colorize={false} decimals={0} />
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono">
                                                <CurrencyDisplay value={row.variacion} decimals={0} />
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono">
                                                <span className={row.variacion_pct > (selectedPresupuesto?.semaforo_amarillo_hasta ?? 15) ? 'text-rose-600' : row.variacion_pct > (selectedPresupuesto?.semaforo_verde_hasta ?? 5) ? 'text-amber-600' : 'text-emerald-600'}>
                                                    {row.variacion_pct > 0 ? '+' : ''}{row.variacion_pct.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <SemaforoBadge valor={row.semaforo} variacionPct={row.variacion_pct} size="sm" />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
