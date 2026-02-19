import { useState, useEffect, useMemo } from 'react'
import { usePresupuestos, usePresupuestoComparacion, usePresupuestoComparacionMensual } from '../hooks/usePresupuesto'
import { useConfiguracionExclusion } from '../hooks/useReportes'
import { BudgetExecutionTable } from '../components/organisms/BudgetExecutionTable'
import { EjecucionMensualChart } from '../components/organisms/EjecucionMensualChart'
import { EntitySelector } from '../components/molecules/entities/EntitySelector'
import { DarkStatCard } from '../components/molecules/DarkStatCard'
import { SemaforoBadge } from '../components/atoms/SemaforoBadge'
import { useBudgetFormat } from '../components/atoms/CurrencyDisplay'
import { useSettings } from '../context/SettingsContext'
import { Target, TrendingDown, TrendingUp, BarChart3, AlertTriangle } from 'lucide-react'

export const EjecucionMensualPage = () => {
    const { data: presupuestos = [] } = usePresupuestos()
    const { data: configExclusion = [], isFetched: exclusionConfigLoaded } = useConfiguracionExclusion()
    const fmt = useBudgetFormat()

    const [presupuestoId, setPresupuestoId] = useState<number>(0)
    const [centroCostoId, setCentroCostoId] = useState('')

    // CC Exclusion (default business rule)
    const [centrosCostosExcluidos, setCentrosCostosExcluidos] = useState<number[] | null>(null)
    const actualCentrosCostosExcluidos = useMemo(() => centrosCostosExcluidos ?? [], [centrosCostosExcluidos])

    const selectedPresupuesto = presupuestos.find(p => p.id === presupuestoId)
    const { cifrasEnMillones } = useSettings()
    const compact = cifrasEnMillones

    useEffect(() => {
        if (presupuestos.length > 0 && !presupuestoId) {
            const activo = presupuestos.find(p => p.estado === 'activo')
            setPresupuestoId(activo?.id || presupuestos[0].id)
        }
    }, [presupuestos, presupuestoId])

    useEffect(() => {
        if (exclusionConfigLoaded && centrosCostosExcluidos === null) {
            const defaults = configExclusion.filter(d => d.activo_por_defecto).map(d => d.centro_costo_id)
            setCentrosCostosExcluidos(defaults)
        }
    }, [configExclusion, centrosCostosExcluidos, exclusionConfigLoaded])

    const ccIdFilter = centroCostoId ? Number(centroCostoId) : undefined

    const queryParams = useMemo(() => ({
        centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined,
        centro_costo_id: ccIdFilter,
    }), [actualCentrosCostosExcluidos, ccIdFilter])

    const egresoParams = useMemo(() => ({ ...queryParams, direccion: 'egreso' as const }), [queryParams])
    const ingresoParams = useMemo(() => ({ ...queryParams, direccion: 'ingreso' as const }), [queryParams])

    const { data: mensualEgreso = [], isLoading } = usePresupuestoComparacionMensual(presupuestoId, egresoParams)
    const { data: mensualIngreso = [] } = usePresupuestoComparacionMensual(presupuestoId, ingresoParams)

    // CC list from budget comparison (sorted by ejecutado desc)
    const ccQueryParams = useMemo(() => ({
        nivel: 'centro_costo',
        direccion: 'egreso',
        centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined,
    }), [actualCentrosCostosExcluidos])
    const { data: ccComparacion = [] } = usePresupuestoComparacion(presupuestoId, ccQueryParams)

    // KPI totales
    const semaforoVerde = selectedPresupuesto?.semaforo_verde_hasta ?? 10
    const semaforoAmarillo = selectedPresupuesto?.semaforo_amarillo_hasta ?? 25

    // KPIs for both directions
    const calcKpis = (data: typeof mensualEgreso) => {
        const presupuestado = data.reduce((s, r) => s + r.presupuestado, 0)
        const ejecutado = data.reduce((s, r) => s + r.ejecutado, 0)
        // Pro-rata: solo comparar ppto de meses con ejecución real
        const mesesEjecutados = data.filter(m => m.ejecutado > 0)
        const pptoEjecutado = mesesEjecutados.reduce((s, r) => s + r.presupuestado, 0)
        const variacion = ejecutado - pptoEjecutado
        const variacionPct = pptoEjecutado > 0 ? ((variacion / pptoEjecutado) * 100) : 0
        const consumo = pptoEjecutado > 0 ? ((ejecutado / pptoEjecutado) * 100) : 0
        const mesesConDatos = data.filter(m => m.presupuestado > 0 || m.ejecutado > 0).length
        const mesesAlerta = data.filter(m => m.semaforo === 'amarillo' || m.semaforo === 'rojo').length
        const semaforo: 'verde' | 'amarillo' | 'rojo' =
            variacionPct <= 0 ? 'verde'
            : variacionPct <= semaforoVerde ? 'verde'
            : variacionPct <= semaforoAmarillo ? 'amarillo'
            : 'rojo'
        return { presupuestado, ejecutado, variacion, variacionPct, consumo, mesesConDatos, mesesAlerta, semaforo }
    }

    const egr = useMemo(() => calcKpis(mensualEgreso), [mensualEgreso, semaforoVerde, semaforoAmarillo]) // eslint-disable-line
    const ing = useMemo(() => calcKpis(mensualIngreso), [mensualIngreso, semaforoVerde, semaforoAmarillo]) // eslint-disable-line

    // CC options from budget data, sorted by ejecutado desc
    const ccOptions = useMemo(() =>
        ccComparacion
            .filter(cc => cc.id != null)
            .sort((a, b) => b.ejecutado - a.ejecutado)
            .map(cc => ({ id: cc.id!, nombre: cc.nombre })),
        [ccComparacion]
    )

    return (
        <div className="flex flex-col h-full bg-slate-50/50 overflow-hidden">
            {/* Hero: Header + Stats */}
            <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 px-6 pt-6 pb-5 text-white">
                {/* Title row */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Ejecución Mensual</h1>
                        <p className="text-slate-400 text-sm mt-0.5">Detalle mes a mes: presupuestado, ejecutado, variación y consumo</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-56 [&_input]:bg-white/10 [&_input]:border-white/20 [&_input]:text-white [&_input]:placeholder-slate-400">
                            <EntitySelector
                                options={ccOptions}
                                value={centroCostoId}
                                onChange={setCentroCostoId}
                                placeholder="Todos los CC"
                            />
                        </div>
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
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <DarkStatCard
                        label="Presupuestado"
                        value={0}
                        icon={<Target className="w-5 h-5" />}
                        colorClass="text-blue-400"
                        iconBgClass="bg-blue-500/20 text-blue-400"
                        renderValue={
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-emerald-400 text-lg font-black font-mono">{fmt(ing.presupuestado)}</span>
                                    <span className="text-[9px] text-slate-500 uppercase font-bold">Ing</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-rose-400 text-lg font-black font-mono">{fmt(egr.presupuestado)}</span>
                                    <span className="text-[9px] text-slate-500 uppercase font-bold">Egr</span>
                                </div>
                            </div>
                        }
                        subtitle={`${Math.max(egr.mesesConDatos, ing.mesesConDatos)} meses con datos`}
                        compact={compact}
                    />
                    <DarkStatCard
                        label="Ejecutado Real"
                        value={0}
                        icon={<TrendingDown className="w-5 h-5" />}
                        colorClass="text-rose-400"
                        iconBgClass="bg-rose-500/20 text-rose-400"
                        renderValue={
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-emerald-400 text-lg font-black font-mono">{fmt(ing.ejecutado)}</span>
                                    <span className="text-[9px] text-slate-500 uppercase font-bold">Ing</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-rose-400 text-lg font-black font-mono">{fmt(egr.ejecutado)}</span>
                                    <span className="text-[9px] text-slate-500 uppercase font-bold">Egr</span>
                                </div>
                            </div>
                        }
                        subtitle="Acumulado del periodo"
                        compact={compact}
                    />
                    <DarkStatCard
                        label="Variación"
                        value={0}
                        icon={<TrendingUp className="w-5 h-5" />}
                        colorClass="text-indigo-400"
                        iconBgClass="bg-indigo-500/20 text-indigo-400"
                        renderValue={
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-emerald-400 text-lg font-black font-mono">{fmt(ing.variacion)}</span>
                                    <span className="text-[9px] text-slate-500 uppercase font-bold">Ing</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-rose-400 text-lg font-black font-mono">{fmt(egr.variacion)}</span>
                                    <span className="text-[9px] text-slate-500 uppercase font-bold">Egr</span>
                                </div>
                            </div>
                        }
                        subtitle="Ejecutado − Presupuestado"
                        compact={compact}
                    />
                    <DarkStatCard
                        label="% Consumido"
                        value={0}
                        icon={<BarChart3 className="w-5 h-5" />}
                        colorClass="text-white"
                        iconBgClass="bg-white/10 text-slate-300"
                        renderValue={
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-emerald-400 text-lg font-black font-mono">{ing.consumo.toFixed(1)}%</span>
                                    <SemaforoBadge valor={ing.semaforo} size="sm" />
                                    <span className="text-[9px] text-slate-500 uppercase font-bold">Ing</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-rose-400 text-lg font-black font-mono">{egr.consumo.toFixed(1)}%</span>
                                    <SemaforoBadge valor={egr.semaforo} size="sm" />
                                    <span className="text-[9px] text-slate-500 uppercase font-bold">Egr</span>
                                </div>
                            </div>
                        }
                        compact={compact}
                    />
                    <DarkStatCard
                        label="Meses en Alerta"
                        value={0}
                        icon={<AlertTriangle className="w-5 h-5" />}
                        colorClass={Math.max(egr.mesesAlerta, ing.mesesAlerta) === 0 ? 'text-emerald-400' : 'text-amber-400'}
                        iconBgClass={Math.max(egr.mesesAlerta, ing.mesesAlerta) === 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}
                        renderValue={
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <span className={`text-lg font-black font-mono ${ing.mesesAlerta === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>{ing.mesesAlerta}</span>
                                    <span className="text-sm font-normal text-slate-400">de {ing.mesesConDatos}</span>
                                    <span className="text-[9px] text-slate-500 uppercase font-bold">Ing</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-lg font-black font-mono ${egr.mesesAlerta === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>{egr.mesesAlerta}</span>
                                    <span className="text-sm font-normal text-slate-400">de {egr.mesesConDatos}</span>
                                    <span className="text-[9px] text-slate-500 uppercase font-bold">Egr</span>
                                </div>
                            </div>
                        }
                        subtitle={Math.max(egr.mesesAlerta, ing.mesesAlerta) === 0 ? 'Todos los meses en verde' : 'Meses con semáforo amarillo o rojo'}
                        compact={compact}
                    />
                </div>
            </div>

            {/* Contenido scrollable */}
            <div className="flex-1 min-h-0 p-6 overflow-auto space-y-6">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20 text-slate-400">Cargando datos...</div>
                ) : (
                    <>
                        <EjecucionMensualChart
                            mensualEgreso={mensualEgreso}
                            mensualIngreso={mensualIngreso}
                            compact={compact}
                        />
                        <BudgetExecutionTable
                            dataEgreso={mensualEgreso}
                            dataIngreso={mensualIngreso}
                            semaforoVerde={semaforoVerde}
                            semaforoAmarillo={semaforoAmarillo}
                            compact={compact}
                            anioAnterior={selectedPresupuesto ? selectedPresupuesto.anio - 1 : undefined}
                        />
                    </>
                )}
            </div>
        </div>
    )
}
