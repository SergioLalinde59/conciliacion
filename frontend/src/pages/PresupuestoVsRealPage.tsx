import { useState, useEffect, useMemo } from 'react'
import { presupuestoService } from '../services/presupuesto.service'
import { usePresupuestos, usePresupuestoComparacion } from '../hooks/usePresupuesto'
import { useConfiguracionExclusion } from '../hooks/useReportes'
import { SemaforoBadge } from '../components/atoms/SemaforoBadge'
import { CurrencyDisplay } from '../components/atoms/CurrencyDisplay'
import { StatCard } from '../components/molecules/StatCard'
import { FiltrosReporte } from '../components/organisms/FiltrosReporte'
import { BudgetComparisonBars } from '../components/organisms/BudgetComparisonBars'
import { ArrowLeft, X, Target, TrendingDown, TrendingUp, BarChart3, Eye } from 'lucide-react'
import { Button } from '../components/atoms/Button'
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

    // CC Exclusion
    const [centrosCostosExcluidos, setCentrosCostosExcluidos] = useState<number[] | null>(null)
    const [excluirEstacionales, setExcluirEstacionales] = useState(false)
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
    const compact = selectedPresupuesto?.cifras_en_millones ?? false

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

    // Queries
    const { data: comparacion = [], isLoading } = usePresupuestoComparacion(presupuestoId, {
        nivel: 'centro_costo',
        mes_inicio: mesInicio,
        mes_fin: mesFin,
        centro_costo_id: ccIdFilter,
        concepto_id: conceptoIdFilter,
        centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined,
        excluir_estacionales: excluirEstacionales || undefined
    })

    // Totales
    const totales = useMemo(() => ({
        presupuestado: comparacion.reduce((s, r) => s + r.presupuestado, 0),
        ejecutado: comparacion.reduce((s, r) => s + r.ejecutado, 0),
        variacion: comparacion.reduce((s, r) => s + r.variacion, 0),
    }), [comparacion])

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
        setExcluirEstacionales(false)
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
                centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined,
                excluir_estacionales: excluirEstacionales || undefined
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
                centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined,
                excluir_estacionales: excluirEstacionales || undefined
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
            handleCcClick({ id: drillCcId!, nombre: drillCcName, presupuestado: 0, ejecutado: 0, variacion: 0, variacion_pct: 0, semaforo: 'verde' })
        } else {
            setDrillOpen(false)
        }
    }

    // Excel export
    const exportarExcel = () => {
        const sorted = [...comparacion].sort((a, b) => b.ejecutado - a.ejecutado)
        const total = sorted.reduce((s, r) => s + r.ejecutado, 0)
        let acum = 0
        const rows = sorted.map(r => {
            acum += r.ejecutado
            return {
                Nombre: r.nombre,
                Presupuestado: r.presupuestado,
                Ejecutado: r.ejecutado,
                'Variación $': r.variacion,
                'Variación %': r.variacion_pct,
                'Acumulado $': acum,
                'Acumulado %': total > 0 ? Math.round((acum / total) * 100) : 0,
            }
        })
        const ws = XLSX.utils.json_to_sheet(rows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Presupuesto vs Real')
        XLSX.writeFile(wb, `Presupuesto_vs_Real.xlsx`)
    }

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
                    <label className="ml-4 flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={excluirEstacionales}
                            onChange={e => setExcluirEstacionales(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-[11px] font-medium text-slate-500">Excluir Estacionales</span>
                    </label>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                    <StatCard
                        label="Presupuestado"
                        value={totales.presupuestado}
                        icon={<Target className="w-5 h-5" />}
                        colorClass="text-blue-600"
                        bgColorClass="bg-blue-50"
                        borderColor="group-hover:border-blue-200"
                        subtitle={`${selectedPresupuesto?.nombre || ''} (${MESES[mesInicio]}-${MESES[mesFin]})`}
                        compact={compact}
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
                        compact={compact}
                    />
                    <StatCard
                        label="Variación"
                        value={totales.variacion}
                        icon={<TrendingUp className="w-5 h-5" />}
                        colorClass={totales.variacion <= 0 ? 'text-emerald-600' : 'text-rose-600'}
                        bgColorClass={totales.variacion <= 0 ? 'bg-emerald-50' : 'bg-rose-50'}
                        borderColor={totales.variacion <= 0 ? 'group-hover:border-emerald-200' : 'group-hover:border-rose-200'}
                        subtitle="Ejecutado - Presupuestado"
                        compact={compact}
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

                {/* CC Comparison Bars */}
                <div className="flex-1 min-h-0">
                    <BudgetComparisonBars
                        data={comparacion}
                        loading={isLoading}
                        title="Semáforo Presupuestal"
                        onRowClick={handleCcClick}
                        onExport={exportarExcel}
                    />
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
                            <div><p className="text-[9px] text-slate-400 font-bold capitalize">Presupuestado</p><p className="text-xs font-mono text-blue-600 font-bold"><CurrencyDisplay value={drillData.reduce((s, r) => s + r.presupuestado, 0)} colorize={false} compact={compact} /></p></div>
                            <div><p className="text-[9px] text-slate-400 font-bold capitalize">Ejecutado</p><p className="text-xs font-mono text-rose-600 font-bold"><CurrencyDisplay value={drillData.reduce((s, r) => s + r.ejecutado, 0)} colorize={false} compact={compact} /></p></div>
                            <div><p className="text-[9px] text-slate-400 font-bold capitalize">Variación</p><p className="text-xs font-mono font-bold"><CurrencyDisplay value={drillData.reduce((s, r) => s + r.variacion, 0)} compact={compact} /></p></div>
                        </div>

                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="text-left px-3 py-2 font-bold text-gray-400 capitalize text-[10px] tracking-wide">Nombre</th>
                                        <th className="text-right px-3 py-2 font-bold text-gray-400 capitalize text-[10px] tracking-wide">Presupuestado</th>
                                        <th className="text-right px-3 py-2 font-bold text-gray-400 capitalize text-[10px] tracking-wide">Ejecutado</th>
                                        <th className="text-right px-3 py-2 font-bold text-gray-400 capitalize text-[10px] tracking-wide">Variación $</th>
                                        <th className="text-right px-3 py-2 font-bold text-gray-400 capitalize text-[10px] tracking-wide">Var %</th>
                                        <th className="text-center px-3 py-2 font-bold text-gray-400 capitalize text-[10px] tracking-wide">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {drillLoading ? (
                                        <tr><td colSpan={6} className="text-center py-8 text-gray-400">Cargando...</td></tr>
                                    ) : drillData.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-8 text-gray-400">Sin datos</td></tr>
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
                                                    {row.es_estacional && (
                                                        <span className="text-[8px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                                            Estacional
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-blue-600">
                                                <CurrencyDisplay value={row.presupuestado} colorize={false} decimals={0} compact={compact} />
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-rose-600">
                                                <CurrencyDisplay value={row.ejecutado} colorize={false} decimals={0} compact={compact} />
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono">
                                                <CurrencyDisplay value={row.variacion} decimals={0} compact={compact} />
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
