import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { presupuestoService } from '../services/presupuesto.service'
import { usePresupuestos, usePresupuestoComparacion, usePresupuestoVersiones } from '../hooks/usePresupuesto'
import { usePerspectiva } from '../hooks/usePerspectiva'
import PerspectiveSelector from '../components/molecules/PerspectiveSelector'
import { SemaforoBadge } from '../components/atoms/SemaforoBadge'
import { useBudgetFormat } from '../components/atoms/CurrencyDisplay'
import { DarkStatCard } from '../components/molecules/DarkStatCard'
import { EntitySelector } from '../components/molecules/entities/EntitySelector'
import { BudgetComparisonBars } from '../components/organisms/BudgetComparisonBars'
import { PresupuestoDrilldownModal } from '../components/organisms/modals/PresupuestoDrilldownModal'
import { MesesDrilldownModal } from '../components/organisms/modals/MesesDrilldownModal'
import type { BreadcrumbItem } from '../components/organisms/modals/MesesDrilldownModal'
import { useSettings } from '../context/SettingsContext'
import { ReglasPendientesBanner } from '../components/molecules/ReglasPendientesBanner'
import { Target, TrendingDown, TrendingUp, BarChart3, AlertTriangle, ChevronDown } from 'lucide-react'
import { Button } from '../components/atoms/Button'
import * as XLSX from 'xlsx'
import type { ComparacionPresupuesto, ResumenMensualPresupuesto } from '../types/Presupuesto'
import { FechaDisplay } from '../components/atoms/FechaDisplay'

const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export const PresupuestoVsRealPage = () => {
    const navigate = useNavigate()
    const fmt = useBudgetFormat()
    const { data: presupuestos = [] } = usePresupuestos()
    // Perspectiva
    const { perspectivas, selectedSlug, setSelectedSlug, filterParams } = usePerspectiva()

    // Estado presupuesto
    const [presupuestoId, setPresupuestoId] = useState<number>(0)

    // Dirección (egresos / ingresos)
    const [direccion, setDireccion] = useState<'egreso' | 'ingreso'>('egreso')

    // Filtros
    const currentMonth = new Date().getMonth() + 1
    const currentYear = new Date().getFullYear()
    const [mesDesde, setMesDesde] = useState(1)
    const [mesHasta, setMesHasta] = useState(currentMonth)
    const [selectedRange, setSelectedRange] = useState('YTD')
    // TODO: conectar filtros a UI
    // const [terceroId, setTerceroId] = useState('')
    const [centroCostoId, setCentroCostoId] = useState('')
    const [conceptoId] = useState('')
    // const [mostrarIngresos, setMostrarIngresos] = useState(true)
    // const [mostrarEgresos, setMostrarEgresos] = useState(true)

    // Search & Sort (Paso 4)
    const [busqueda, setBusqueda] = useState('')
    const [sortKey, setSortKey] = useState('ejecutado')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
    const toggleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortKey(key)
            setSortDir(key === 'nombre' ? 'asc' : 'desc')
        }
    }

    const [excluirEstacionales, setExcluirEstacionales] = useState(false)

    // Drill-down
    const [drillLevel, setDrillLevel] = useState<'centro_costo' | 'concepto' | 'tercero'>('centro_costo')
    const [drillCcId, setDrillCcId] = useState<number | undefined>()
    const [drillCcName, setDrillCcName] = useState('')
    const [drillConceptoId, setDrillConceptoId] = useState<number | undefined>()
    const [drillConceptoName, setDrillConceptoName] = useState('')
    const [drillData, setDrillData] = useState<ComparacionPresupuesto[]>([])
    const [drillLoading, setDrillLoading] = useState(false)
    const [drillOpen, setDrillOpen] = useState(false)

    // Meses drill-down (4to nivel - Paso 3)
    const [mesesData, setMesesData] = useState<ResumenMensualPresupuesto[]>([])
    const [mesesLoading, setMesesLoading] = useState(false)
    const [mesesOpen, setMesesOpen] = useState(false)
    const [mesesBreadcrumb, setMesesBreadcrumb] = useState<BreadcrumbItem[]>([])

    // Versiones (Paso 2)
    const selectedPresupuesto = presupuestos.find(p => p.id === presupuestoId)
    const { cifrasEnMillones } = useSettings()
    const compact = cifrasEnMillones
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

    const mesInicio = mesDesde
    const mesFin = mesHasta

    // Numeric filter IDs
    const ccIdFilter = centroCostoId ? Number(centroCostoId) : undefined
    const conceptoIdFilter = conceptoId ? Number(conceptoId) : undefined

    // Queries
    const { data: comparacion = [], isLoading, refetch: refetchComparacion } = usePresupuestoComparacion(presupuestoId, {
        nivel: 'centro_costo',
        mes_inicio: mesInicio,
        mes_fin: mesFin,
        centro_costo_id: ccIdFilter,
        concepto_id: conceptoIdFilter,
        ...filterParams,
        excluir_estacionales: excluirEstacionales || undefined,
        direccion
    })

    // CC options from semáforo data (same order)
    const ccOptions = useMemo(() =>
        comparacion.filter(r => r.id != null).map(r => ({ id: r.id as number, nombre: r.nombre })),
        [comparacion]
    )

    // Totales
    const totales = useMemo(() => ({
        presupuestado: comparacion.reduce((s, r) => s + r.presupuestado, 0),
        ejecutado: comparacion.reduce((s, r) => s + r.ejecutado, 0),
        variacion: comparacion.reduce((s, r) => s + r.variacion, 0),
        sinPresupuesto: comparacion.reduce((s, r) => s + (r.ejecutado_sin_ppto ?? 0), 0),
    }), [comparacion])

    const pctGlobal = totales.presupuestado > 0
        ? ((totales.ejecutado / totales.presupuestado) * 100).toFixed(1)
        : '0'

    // TODO: Limpiar filtros — conectar a botón en UI
    // const handleLimpiar = () => {
    //     const anio = selectedPresupuesto?.anio || currentYear
    //     const isCurrentYear = anio === currentYear
    //     setMesDesde(1)
    //     setMesHasta(isCurrentYear ? currentMonth : 12)
    //     setSelectedRange(isCurrentYear ? 'YTD' : 'Año Completo')
    //     setTerceroId('')
    //     setCentroCostoId('')
    //     setConceptoId('')
    //     setMostrarIngresos(true)
    //     setMostrarEgresos(true)
    //     setExcluirEstacionales(false)
    //     setBusqueda('')
    //     if (configExclusion.length > 0) {
    //         setCentrosCostosExcluidos(configExclusion.filter(d => d.activo_por_defecto).map(d => d.centro_costo_id))
    //     } else {
    //         setCentrosCostosExcluidos([])
    //     }
    // }

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
                ...filterParams,
                excluir_estacionales: excluirEstacionales || undefined,
                direccion
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
                ...filterParams,
                excluir_estacionales: excluirEstacionales || undefined,
                direccion
            })
            setDrillData(data)
        } catch { setDrillData([]) }
        finally { setDrillLoading(false) }
    }

    // 4to nivel: Tercero → Meses
    const handleTerceroClick = async (item: ComparacionPresupuesto) => {
        setMesesBreadcrumb([
            { label: 'Presupuesto' },
            { label: drillCcName, color: 'text-indigo-600' },
            { label: drillConceptoName, color: 'text-purple-600' },
            { label: item.id ? `${item.id} - ${item.nombre}` : item.nombre, color: 'text-amber-600' },
        ])
        setMesesOpen(true)
        setMesesLoading(true)
        try {
            const data = await presupuestoService.compararMensual(presupuestoId, {
                centro_costo_id: drillCcId,
                concepto_id: drillConceptoId,
                tercero_id: item.id ?? undefined,
                direccion
            })
            setMesesData(data)
        } catch { setMesesData([]) }
        finally { setMesesLoading(false) }
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
            {/* Hero: Header + Range + Stats */}
            <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 px-6 pt-6 pb-5 text-white">
                {/* Title row */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Presupuesto vs Real</h1>
                        <p className="text-slate-400 text-sm mt-0.5">Comparación del presupuesto contra gastos reales con semáforos</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={presupuestoId}
                            onChange={e => setPresupuestoId(parseInt(e.target.value))}
                            className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none [&>option]:text-slate-900"
                        >
                            {presupuestos.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.nombre} ({p.anio}) - {p.estado}
                                </option>
                            ))}
                        </select>
                        {/* Version dropdown */}
                        {selectedPresupuesto && selectedPresupuesto.version_actual > 1 && (
                            <div className="relative" ref={versionDropdownRef}>
                                <button
                                    onClick={() => setVersionDropdownOpen(!versionDropdownOpen)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 text-purple-300 text-xs font-semibold hover:bg-white/20 transition-colors border border-white/20"
                                >
                                    v{selectedPresupuesto.version_actual}
                                    <ChevronDown size={12} className={`transition-transform ${versionDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {versionDropdownOpen && versiones.length > 0 && (
                                    <div className="absolute top-full right-0 mt-1 w-72 bg-white rounded-xl shadow-lg border border-gray-200 z-50 py-1">
                                        <div className="px-3 py-2 border-b border-gray-100">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Historial de versiones</p>
                                        </div>
                                        {versiones.map(v => (
                                            <div
                                                key={v.version}
                                                className={`px-3 py-2 text-xs ${v.version === selectedPresupuesto.version_actual ? 'bg-purple-50' : 'hover:bg-gray-50'}`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="font-semibold text-gray-700">
                                                        v{v.version}
                                                        {v.version === selectedPresupuesto.version_actual && (
                                                            <span className="ml-1.5 text-[10px] text-purple-600 font-bold">ACTUAL</span>
                                                        )}
                                                    </span>
                                                    <span className="text-gray-400 text-[10px]">
                                                        {v.created_at ? <FechaDisplay value={v.created_at} /> : ''}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 mt-0.5 text-gray-500">
                                                    <span>{v.lineas_generadas} líneas</span>
                                                    <span>{fmt(v.total_presupuestado)}</span>
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
                </div>

                {/* Banner reglas pendientes */}
                {presupuestoId > 0 && (
                    <div className="mb-4">
                        <ReglasPendientesBanner presupuestoId={presupuestoId} onRegenerated={() => refetchComparacion()} />
                    </div>
                )}

                {/* Range buttons */}
                <div className="flex items-center gap-1.5 flex-wrap mb-6">
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
                                variant="ghost"
                                size="sm"
                                disabled={disabled}
                                onClick={() => { if (!disabled) { setMesDesde(btn.d); setMesHasta(btn.h); setSelectedRange(btn.label) } }}
                                className={`text-[11px] px-3 py-1.5 rounded-lg border transition-all duration-200 font-semibold ${isActive
                                    ? 'bg-white/20 border-white/30 text-white shadow-lg shadow-white/5'
                                    : disabled
                                        ? 'bg-white/5 border-white/5 text-slate-600 cursor-not-allowed'
                                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                                }`}
                            >
                                {btn.label}
                            </Button>
                        )
                    })}
                    <span className="ml-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        {MESES[mesInicio]} - {MESES[mesFin]} {selectedPresupuesto?.anio}
                    </span>
                    <label className="ml-4 flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={excluirEstacionales}
                            onChange={e => setExcluirEstacionales(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-white/30 bg-white/10 text-purple-500 focus:ring-purple-400"
                        />
                        <span className="text-[11px] font-medium text-slate-400">Excluir Estacionales</span>
                    </label>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <DarkStatCard
                        label="Presupuestado"
                        value={totales.presupuestado}
                        icon={<Target className="w-5 h-5" />}
                        colorClass="text-blue-400"
                        iconBgClass="bg-blue-500/20 text-blue-400"
                        subtitle={`${selectedPresupuesto?.nombre || ''} (${MESES[mesInicio]}-${MESES[mesFin]})`}
                        compact={compact}
                    />
                    <DarkStatCard
                        label="Ejecutado Real"
                        value={totales.ejecutado}
                        icon={<TrendingDown className="w-5 h-5" />}
                        colorClass="text-rose-400"
                        iconBgClass="bg-rose-500/20 text-rose-400"
                        subtitle="Gastos reales del periodo"
                        compact={compact}
                    />
                    <DarkStatCard
                        label="Variación"
                        value={totales.variacion}
                        icon={<TrendingUp className="w-5 h-5" />}
                        colorClass={totales.variacion <= 0 ? 'text-emerald-400' : 'text-rose-400'}
                        iconBgClass={totales.variacion <= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}
                        subtitle="Ejecutado - Presupuestado"
                        compact={compact}
                    />
                    <DarkStatCard
                        label="% Consumido"
                        value={0}
                        icon={<BarChart3 className="w-5 h-5" />}
                        colorClass="text-white"
                        iconBgClass="bg-white/10 text-slate-300"
                        renderValue={<>
                            {pctGlobal}%
                            <div className="mt-1"><SemaforoBadge
                                valor={parseFloat(pctGlobal) > 100 + (selectedPresupuesto?.semaforo_amarillo_hasta ?? 15) ? 'rojo' : parseFloat(pctGlobal) > 100 + (selectedPresupuesto?.semaforo_verde_hasta ?? 5) ? 'amarillo' : 'verde'}
                                size="sm"
                            /></div>
                        </>}
                        compact={compact}
                    />
                    <DarkStatCard
                        label="Sin Presupuesto"
                        value={totales.sinPresupuesto}
                        icon={<AlertTriangle className="w-5 h-5" />}
                        colorClass="text-amber-400"
                        iconBgClass="bg-amber-500/20 text-amber-400"
                        subtitle="Gastos reales sin ppto asignado"
                        compact={compact}
                    />
                </div>
            </div>

            {/* Egresos / Ingresos toggle + CC filter */}
            <div className="px-4 pt-4">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-4 py-3 flex items-center gap-4">
                    <PerspectiveSelector perspectivas={perspectivas} selectedSlug={selectedSlug} onChange={setSelectedSlug} />
                    <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
                        {(['egreso', 'ingreso'] as const).map(dir => (
                            <button
                                key={dir}
                                onClick={() => setDireccion(dir)}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                                    direccion === dir
                                        ? 'bg-white text-slate-800 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {dir === 'egreso' ? 'Egresos' : 'Ingresos'}
                            </button>
                        ))}
                    </div>
                    <div className="w-64">
                        <EntitySelector
                            label=""
                            options={ccOptions}
                            value={centroCostoId}
                            onChange={setCentroCostoId}
                            placeholder="Todos los centros de costo"
                        />
                    </div>
                </div>
            </div>

            {/* Contenido */}
            <div className="flex-1 min-h-0 flex flex-col gap-0">
                {/* CC Comparison Bars */}
                <div className="flex-1 min-h-0 p-4">
                    <BudgetComparisonBars
                        data={comparacion}
                        loading={isLoading}
                        title="Semáforo Presupuestal"
                        busqueda={busqueda}
                        setBusqueda={setBusqueda}
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={toggleSort}
                        onRowClick={handleCcClick}
                        onExport={exportarExcel}
                        direccion={direccion}
                    />
                </div>
            </div>

            {/* Drill-down Modal */}
            <PresupuestoDrilldownModal
                open={drillOpen}
                level={drillLevel as 'concepto' | 'tercero'}
                ccId={drillCcId}
                ccName={drillCcName}
                conceptoName={drillConceptoName}
                data={drillData}
                loading={drillLoading}
                compact={compact}
                semaforoVerde={selectedPresupuesto?.semaforo_verde_hasta}
                semaforoAmarillo={selectedPresupuesto?.semaforo_amarillo_hasta}
                onBack={handleDrillBack}
                onClose={() => setDrillOpen(false)}
                onConceptoClick={handleConceptoClick}
                onTerceroClick={handleTerceroClick}
                direccion={direccion}
            />

            {/* Meses Drill-down Modal (4to nivel) */}
            {mesesOpen && (
                <MesesDrilldownModal
                    breadcrumb={mesesBreadcrumb}
                    data={mesesData}
                    loading={mesesLoading}
                    onClose={() => setMesesOpen(false)}
                    direccion={direccion}
                />
            )}
        </div>
    )
}
