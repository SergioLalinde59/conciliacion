import { useState, useEffect, useMemo } from 'react'
import { usePresupuestos, usePresupuestoComparacion, usePresupuestoComparacionMensual } from '../hooks/usePresupuesto'
import { usePerspectiva } from '../hooks/usePerspectiva'
import PerspectiveSelector from '../components/molecules/PerspectiveSelector'
import { EjecucionMensualChart } from '../components/organisms/EjecucionMensualChart'
import { BudgetAccumulatedChart } from '../components/organisms/BudgetAccumulatedChart'
import { EntitySelector } from '../components/molecules/entities/EntitySelector'
import { DarkStatCard } from '../components/molecules/DarkStatCard'
import { SemaforoBadge } from '../components/atoms/SemaforoBadge'
import { useBudgetFormat } from '../components/atoms/CurrencyDisplay'
import { useSettings } from '../context/SettingsContext'
import { Target, TrendingDown, TrendingUp, BarChart3, AlertTriangle } from 'lucide-react'

export const EjecucionMensualPage = () => {
    const { data: presupuestos = [] } = usePresupuestos()
    const fmt = useBudgetFormat()

    const [presupuestoId, setPresupuestoId] = useState<number>(0)
    const [centroCostoId, setCentroCostoId] = useState('')

    // Perspectiva
    const { perspectivas, selectedSlug, setSelectedSlug, filterParams } = usePerspectiva()

    const selectedPresupuesto = presupuestos.find(p => p.id === presupuestoId)
    const { cifrasEnMillones } = useSettings()
    const compact = cifrasEnMillones

    useEffect(() => {
        if (presupuestos.length > 0 && !presupuestoId) {
            const activo = presupuestos.find(p => p.estado === 'activo')
            setPresupuestoId(activo?.id || presupuestos[0].id)
        }
    }, [presupuestos, presupuestoId])

    const ccIdFilter = centroCostoId ? Number(centroCostoId) : undefined

    const queryParams = useMemo(() => ({
        ...filterParams,
        centro_costo_id: ccIdFilter,
    }), [filterParams, ccIdFilter])

    const egresoParams = useMemo(() => ({ ...queryParams, direccion: 'egreso' as const }), [queryParams])
    const ingresoParams = useMemo(() => ({ ...queryParams, direccion: 'ingreso' as const }), [queryParams])

    const { data: mensualEgreso = [], isLoading } = usePresupuestoComparacionMensual(presupuestoId, egresoParams)
    const { data: mensualIngreso = [] } = usePresupuestoComparacionMensual(presupuestoId, ingresoParams)

    // CC list from budget comparison (sorted by ejecutado desc)
    const ccQueryParams = useMemo(() => ({
        nivel: 'centro_costo',
        direccion: 'egreso',
        ...filterParams,
    }), [filterParams])
    const { data: ccComparacion = [] } = usePresupuestoComparacion(presupuestoId, ccQueryParams)

    // KPI totales
    const semaforoVerde = selectedPresupuesto?.semaforo_verde_hasta ?? 10
    const semaforoAmarillo = selectedPresupuesto?.semaforo_amarillo_hasta ?? 25

    // KPIs for both directions
    // direccion: 'egreso' = gastar más es malo, 'ingreso' = cobrar más es bueno
    const calcKpis = (data: typeof mensualEgreso, direccion: 'egreso' | 'ingreso') => {
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
        // Semáforo dirección-aware:
        // Egresos: variación positiva (gastó más) = malo
        // Ingresos: variación negativa (cobró menos) = malo → invertir
        const desvio = direccion === 'ingreso' ? -variacionPct : variacionPct
        const semaforo: 'verde' | 'amarillo' | 'rojo' =
            desvio <= 0 ? 'verde'
            : desvio <= semaforoVerde ? 'verde'
            : desvio <= semaforoAmarillo ? 'amarillo'
            : 'rojo'
        return { presupuestado, pptoEjecutado, ejecutado, variacion, variacionPct, consumo, mesesConDatos, mesesEjecutados: mesesEjecutados.length, mesesAlerta, semaforo }
    }

    const egr = useMemo(() => calcKpis(mensualEgreso, 'egreso'), [mensualEgreso, semaforoVerde, semaforoAmarillo]) // eslint-disable-line
    const ing = useMemo(() => calcKpis(mensualIngreso, 'ingreso'), [mensualIngreso, semaforoVerde, semaforoAmarillo]) // eslint-disable-line

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
                {/* Row 1: Title + Perspectiva */}
                <div className="flex items-center gap-4 mb-3">
                    <h1 className="text-2xl font-bold tracking-tight shrink-0">Ejecución Mensual</h1>
                    <div className="[&_div.flex]:bg-white/10 [&_div.flex]:p-1 [&_button]:text-slate-300 [&_button]:hover:text-white [&_button.bg-white]:bg-white/20 [&_button.bg-white]:text-white [&_button.bg-white]:font-semibold">
                        <PerspectiveSelector
                            perspectivas={perspectivas}
                            selectedSlug={selectedSlug}
                            onChange={setSelectedSlug}
                        />
                    </div>
                </div>

                {/* Row 2: Filters */}
                <div className="flex items-center gap-3 mb-4">
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
                                    <span className="text-emerald-400 text-lg font-black font-mono">{fmt(ing.pptoEjecutado)}</span>
                                    <span className="text-[9px] text-slate-500 uppercase font-bold">Ing</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-rose-400 text-lg font-black font-mono">{fmt(egr.pptoEjecutado)}</span>
                                    <span className="text-[9px] text-slate-500 uppercase font-bold">Egr</span>
                                </div>
                            </div>
                        }
                        subtitle={`${Math.max(ing.mesesEjecutados, egr.mesesEjecutados)} meses con ejecución`}
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
                                    {ing.variacion >= 0
                                        ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                                        : <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                                    }
                                    <span className={`text-lg font-black font-mono ${ing.variacion >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt(ing.variacion)}</span>
                                    <span className="text-[9px] text-slate-500 uppercase font-bold">Ing</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {egr.variacion <= 0
                                        ? <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                                        : <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
                                    }
                                    <span className={`text-lg font-black font-mono ${egr.variacion <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt(egr.variacion)}</span>
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
                            <div className="space-y-1.5">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-emerald-400 text-lg font-black font-mono">{ing.consumo.toFixed(1)}%</span>
                                        <SemaforoBadge valor={ing.semaforo} size="sm" />
                                        <span className="text-[9px] text-slate-500 uppercase font-bold">Ing</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-white/10 rounded-full mt-1">
                                        <div
                                            className={`h-full rounded-full transition-all ${ing.semaforo === 'verde' ? 'bg-emerald-400' : ing.semaforo === 'amarillo' ? 'bg-amber-400' : 'bg-rose-400'}`}
                                            style={{ width: `${Math.min(ing.consumo, 100)}%` }}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-rose-400 text-lg font-black font-mono">{egr.consumo.toFixed(1)}%</span>
                                        <SemaforoBadge valor={egr.semaforo} size="sm" />
                                        <span className="text-[9px] text-slate-500 uppercase font-bold">Egr</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-white/10 rounded-full mt-1">
                                        <div
                                            className={`h-full rounded-full transition-all ${egr.semaforo === 'verde' ? 'bg-emerald-400' : egr.semaforo === 'amarillo' ? 'bg-amber-400' : 'bg-rose-400'}`}
                                            style={{ width: `${Math.min(egr.consumo, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        }
                        compact={compact}
                    />
                    <DarkStatCard
                        label="Alertas"
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
                        <BudgetAccumulatedChart
                            dataEgreso={mensualEgreso}
                            dataIngreso={mensualIngreso}
                            semaforoVerde={semaforoVerde}
                            semaforoAmarillo={semaforoAmarillo}
                            compact={compact}
                        />
                    </>
                )}
            </div>
        </div>
    )
}
