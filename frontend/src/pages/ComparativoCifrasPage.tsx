import { useState, useEffect, useMemo, useCallback } from 'react'
import { usePresupuestos, usePresupuestoComparacionMensual } from '../hooks/usePresupuesto'
import { useConfiguracionExclusion } from '../hooks/useReportes'
import { dashboardService } from '../services/dashboard.service'
import type { FlujoCajaMes } from '../services/dashboard.service'
import { CurrencyDisplay } from '../components/atoms/CurrencyDisplay'
import { GitCompare, AlertTriangle, CheckCircle, Info } from 'lucide-react'

const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export const ComparativoCifrasPage = () => {
    const { data: presupuestos = [] } = usePresupuestos()
    const { data: configExclusion = [], isFetched: exclusionConfigLoaded } = useConfiguracionExclusion()

    const [presupuestoId, setPresupuestoId] = useState<number>(0)
    const [centrosCostosExcluidos, setCentrosCostosExcluidos] = useState<number[] | null>(null)
    const actualExcluidos = useMemo(() => centrosCostosExcluidos ?? [], [centrosCostosExcluidos])

    const selectedPresupuesto = presupuestos.find(p => p.id === presupuestoId)
    const anio = selectedPresupuesto?.anio || new Date().getFullYear()
    const currentMonth = new Date().getFullYear() === anio ? new Date().getMonth() + 1 : 12

    // Auto-select presupuesto activo
    useEffect(() => {
        if (presupuestos.length > 0 && !presupuestoId) {
            const activo = presupuestos.find(p => p.estado === 'activo')
            setPresupuestoId(activo?.id || presupuestos[0].id)
        }
    }, [presupuestos, presupuestoId])

    // Cargar exclusiones por defecto
    useEffect(() => {
        if (exclusionConfigLoaded && centrosCostosExcluidos === null) {
            setCentrosCostosExcluidos(
                configExclusion.filter(d => d.activo_por_defecto).map(d => d.centro_costo_id)
            )
        }
    }, [configExclusion, centrosCostosExcluidos, exclusionConfigLoaded])

    // ---- FUENTE 1: Dashboard (flujoMensual) ----
    const [flujo, setFlujo] = useState<FlujoCajaMes[]>([])
    const [loadingFlujo, setLoadingFlujo] = useState(true)

    const cargarFlujo = useCallback(() => {
        if (centrosCostosExcluidos === null) return
        setLoadingFlujo(true)
        const desde = `${anio}-01-01`
        const ultimoDia = new Date(anio, currentMonth, 0).getDate()
        const hasta = `${anio}-${String(currentMonth).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
        dashboardService.flujoMensual(desde, hasta, actualExcluidos.length > 0 ? actualExcluidos : undefined)
            .then(setFlujo)
            .catch(console.error)
            .finally(() => setLoadingFlujo(false))
    }, [anio, currentMonth, actualExcluidos, centrosCostosExcluidos])

    useEffect(() => { cargarFlujo() }, [cargarFlujo])

    // ---- FUENTE 2: Ppto vs Real (compararMensual) ----
    const mensualParams = useMemo(() => ({
        centros_costos_excluidos: actualExcluidos.length > 0 ? actualExcluidos : undefined,
    }), [actualExcluidos])

    const { data: pptoMensual = [], isLoading: loadingPpto } = usePresupuestoComparacionMensual(presupuestoId, mensualParams)

    // ---- MAPEAR Y COMPARAR ----
    const mesesAMostrar = useMemo(() => {
        const meses: number[] = []
        for (let i = 1; i <= currentMonth; i++) meses.push(i)
        return meses
    }, [currentMonth])

    const flujoMap = useMemo(() => {
        const map: Record<number, FlujoCajaMes> = {}
        flujo.forEach(f => {
            const mes = parseInt(f.mes.split('-')[1], 10)
            map[mes] = f
        })
        return map
    }, [flujo])

    const pptoMap = useMemo(() => {
        const map: Record<number, typeof pptoMensual[0]> = {}
        pptoMensual.forEach(p => { map[p.mes] = p })
        return map
    }, [pptoMensual])

    // Totales YTD
    const ytdDash = useMemo(() => flujo.reduce(
        (acc, m) => ({ ingresos: acc.ingresos + m.ingresos, egresos: acc.egresos + m.egresos, saldo: acc.saldo + m.saldo }),
        { ingresos: 0, egresos: 0, saldo: 0 }
    ), [flujo])

    const ytdPpto = useMemo(() => pptoMensual
        .filter(m => m.mes <= currentMonth)
        .reduce(
            (acc, m) => ({
                presupuestado: acc.presupuestado + m.presupuestado,
                ejecutado: acc.ejecutado + m.ejecutado,
                variacion: acc.variacion + m.variacion,
            }),
            { presupuestado: 0, ejecutado: 0, variacion: 0 }
        ), [pptoMensual, currentMonth])

    const isLoading = loadingFlujo || loadingPpto

    const thBase = 'px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide'
    const tdBase = 'px-4 py-2 text-right font-mono text-xs'

    const exclusionNames = useMemo(() => {
        return actualExcluidos.map(id => {
            const cfg = configExclusion.find(c => c.centro_costo_id === id)
            return cfg?.etiqueta || `CC #${id}`
        })
    }, [actualExcluidos, configExclusion])

    return (
        <div className="flex flex-col h-full bg-slate-50/50 overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-2 bg-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
                        <GitCompare className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Comparativo de Cifras</h1>
                        <p className="text-slate-500 text-sm mt-0.5">Cruce entre Dashboard y Presupuesto vs Real para identificar diferencias</p>
                    </div>
                </div>
                <select
                    value={presupuestoId}
                    onChange={e => setPresupuestoId(parseInt(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                >
                    {presupuestos.map(p => (
                        <option key={p.id} value={p.id}>
                            {p.nombre} ({p.anio}) - {p.estado}
                        </option>
                    ))}
                </select>
            </div>

            {/* Contenido */}
            <div className="flex-1 min-h-0 p-6 overflow-auto space-y-6">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20 text-slate-400">Cargando datos de ambas fuentes...</div>
                ) : (
                    <>
                        {/* TABLA PRINCIPAL */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className={`${thBase} text-left text-gray-400 w-48`}>Concepto</th>
                                            <th className={`${thBase} text-left text-gray-400 w-28`}>Fuente</th>
                                            {mesesAMostrar.map(m => (
                                                <th key={m} className={`${thBase} text-right text-gray-400`}>
                                                    {MESES[m]} {anio}
                                                </th>
                                            ))}
                                            <th className={`${thBase} text-right text-purple-600 bg-purple-50/50`}>YTD</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* SECCIÓN DASHBOARD */}
                                        <tr className="bg-blue-50/30">
                                            <td colSpan={mesesAMostrar.length + 3} className="px-4 py-2 text-[10px] font-black text-blue-700 uppercase tracking-widest">
                                                Dashboard
                                            </td>
                                        </tr>
                                        {/* Ingresos */}
                                        <tr className="border-b border-gray-50 hover:bg-slate-50/50">
                                            <td className="px-4 py-2 font-medium text-slate-600">Ingresos</td>
                                            <td className="px-4 py-2 text-[10px] text-slate-400">flujoMensual</td>
                                            {mesesAMostrar.map(m => (
                                                <td key={m} className={`${tdBase} text-emerald-600`}>
                                                    <CurrencyDisplay value={flujoMap[m]?.ingresos ?? 0} colorize={false} decimals={0} />
                                                </td>
                                            ))}
                                            <td className={`${tdBase} text-emerald-700 font-bold bg-purple-50/30`}>
                                                <CurrencyDisplay value={ytdDash.ingresos} colorize={false} decimals={0} />
                                            </td>
                                        </tr>
                                        {/* Egresos */}
                                        <tr className="border-b border-gray-50 hover:bg-slate-50/50">
                                            <td className="px-4 py-2 font-medium text-slate-600">Egresos</td>
                                            <td className="px-4 py-2 text-[10px] text-slate-400">flujoMensual</td>
                                            {mesesAMostrar.map(m => (
                                                <td key={m} className={`${tdBase} text-rose-600`}>
                                                    <CurrencyDisplay value={flujoMap[m]?.egresos ?? 0} colorize={false} decimals={0} />
                                                </td>
                                            ))}
                                            <td className={`${tdBase} text-rose-700 font-bold bg-purple-50/30`}>
                                                <CurrencyDisplay value={ytdDash.egresos} colorize={false} decimals={0} />
                                            </td>
                                        </tr>
                                        {/* Flujo Neto */}
                                        <tr className="border-b border-slate-200 hover:bg-slate-50/50">
                                            <td className="px-4 py-2 font-medium text-slate-600">Flujo Neto</td>
                                            <td className="px-4 py-2 text-[10px] text-slate-400">saldo</td>
                                            {mesesAMostrar.map(m => (
                                                <td key={m} className={tdBase}>
                                                    <CurrencyDisplay value={flujoMap[m]?.saldo ?? 0} decimals={0} />
                                                </td>
                                            ))}
                                            <td className={`${tdBase} font-bold bg-purple-50/30`}>
                                                <CurrencyDisplay value={ytdDash.saldo} decimals={0} />
                                            </td>
                                        </tr>

                                        {/* SECCIÓN PPTO VS REAL */}
                                        <tr className="bg-indigo-50/30">
                                            <td colSpan={mesesAMostrar.length + 3} className="px-4 py-2 text-[10px] font-black text-indigo-700 uppercase tracking-widest">
                                                Presupuesto vs Real
                                            </td>
                                        </tr>
                                        {/* Presupuestado */}
                                        <tr className="border-b border-gray-50 hover:bg-slate-50/50">
                                            <td className="px-4 py-2 font-medium text-slate-600">Presupuestado</td>
                                            <td className="px-4 py-2 text-[10px] text-slate-400">compararMensual</td>
                                            {mesesAMostrar.map(m => (
                                                <td key={m} className={`${tdBase} text-blue-600`}>
                                                    <CurrencyDisplay value={pptoMap[m]?.presupuestado ?? 0} colorize={false} decimals={0} />
                                                </td>
                                            ))}
                                            <td className={`${tdBase} text-blue-700 font-bold bg-purple-50/30`}>
                                                <CurrencyDisplay value={ytdPpto.presupuestado} colorize={false} decimals={0} />
                                            </td>
                                        </tr>
                                        {/* Ejecutado */}
                                        <tr className="border-b border-gray-50 hover:bg-slate-50/50">
                                            <td className="px-4 py-2 font-medium text-slate-600">Ejecutado</td>
                                            <td className="px-4 py-2 text-[10px] text-slate-400">compararMensual</td>
                                            {mesesAMostrar.map(m => (
                                                <td key={m} className={`${tdBase} text-rose-600`}>
                                                    <CurrencyDisplay value={pptoMap[m]?.ejecutado ?? 0} colorize={false} decimals={0} />
                                                </td>
                                            ))}
                                            <td className={`${tdBase} text-rose-700 font-bold bg-purple-50/30`}>
                                                <CurrencyDisplay value={ytdPpto.ejecutado} colorize={false} decimals={0} />
                                            </td>
                                        </tr>
                                        {/* Variación */}
                                        <tr className="border-b border-slate-200 hover:bg-slate-50/50">
                                            <td className="px-4 py-2 font-medium text-slate-600">Variaci&oacute;n</td>
                                            <td className="px-4 py-2 text-[10px] text-slate-400">ejec - ppto</td>
                                            {mesesAMostrar.map(m => (
                                                <td key={m} className={tdBase}>
                                                    <CurrencyDisplay value={pptoMap[m]?.variacion ?? 0} decimals={0} />
                                                </td>
                                            ))}
                                            <td className={`${tdBase} font-bold bg-purple-50/30`}>
                                                <CurrencyDisplay value={ytdPpto.variacion} decimals={0} />
                                            </td>
                                        </tr>

                                        {/* SECCIÓN EJECUCIÓN MENSUAL */}
                                        <tr className="bg-teal-50/30">
                                            <td colSpan={mesesAMostrar.length + 3} className="px-4 py-2 text-[10px] font-black text-teal-700 uppercase tracking-widest">
                                                Ejecuci&oacute;n Mensual
                                                <span className="ml-2 text-[9px] font-medium text-teal-500 normal-case">(misma API: compararMensual)</span>
                                            </td>
                                        </tr>
                                        {/* Presupuestado */}
                                        <tr className="border-b border-gray-50 hover:bg-slate-50/50">
                                            <td className="px-4 py-2 font-medium text-slate-600">Presupuestado</td>
                                            <td className="px-4 py-2 text-[10px] text-slate-400">compararMensual</td>
                                            {mesesAMostrar.map(m => (
                                                <td key={m} className={`${tdBase} text-blue-600`}>
                                                    <CurrencyDisplay value={pptoMap[m]?.presupuestado ?? 0} colorize={false} decimals={0} />
                                                </td>
                                            ))}
                                            <td className={`${tdBase} text-blue-700 font-bold bg-purple-50/30`}>
                                                <CurrencyDisplay value={ytdPpto.presupuestado} colorize={false} decimals={0} />
                                            </td>
                                        </tr>
                                        {/* Ejecutado */}
                                        <tr className="border-b border-gray-50 hover:bg-slate-50/50">
                                            <td className="px-4 py-2 font-medium text-slate-600">Ejecutado</td>
                                            <td className="px-4 py-2 text-[10px] text-slate-400">compararMensual</td>
                                            {mesesAMostrar.map(m => (
                                                <td key={m} className={`${tdBase} text-rose-600`}>
                                                    <CurrencyDisplay value={pptoMap[m]?.ejecutado ?? 0} colorize={false} decimals={0} />
                                                </td>
                                            ))}
                                            <td className={`${tdBase} text-rose-700 font-bold bg-purple-50/30`}>
                                                <CurrencyDisplay value={ytdPpto.ejecutado} colorize={false} decimals={0} />
                                            </td>
                                        </tr>
                                        {/* Consumo % */}
                                        <tr className="border-b border-slate-200 hover:bg-slate-50/50">
                                            <td className="px-4 py-2 font-medium text-slate-600">Consumo %</td>
                                            <td className="px-4 py-2 text-[10px] text-slate-400">ejec/ppto</td>
                                            {mesesAMostrar.map(m => {
                                                const ppto = pptoMap[m]?.presupuestado ?? 0
                                                const ejec = pptoMap[m]?.ejecutado ?? 0
                                                const consumo = ppto > 0 ? (ejec / ppto * 100) : 0
                                                return (
                                                    <td key={m} className={`${tdBase} font-bold ${consumo > 110 ? 'text-rose-600' : consumo > 100 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                        {consumo.toFixed(1)}%
                                                    </td>
                                                )
                                            })}
                                            {(() => {
                                                const consumoYtd = ytdPpto.presupuestado > 0 ? (ytdPpto.ejecutado / ytdPpto.presupuestado * 100) : 0
                                                return (
                                                    <td className={`${tdBase} font-black bg-purple-50/30 ${consumoYtd > 110 ? 'text-rose-600' : consumoYtd > 100 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                        {consumoYtd.toFixed(1)}%
                                                    </td>
                                                )
                                            })()}
                                        </tr>

                                        {/* SECCIÓN DIFERENCIAS */}
                                        <tr className="bg-amber-50/40">
                                            <td colSpan={mesesAMostrar.length + 3} className="px-4 py-2 text-[10px] font-black text-amber-700 uppercase tracking-widest">
                                                Cruce de Diferencias
                                            </td>
                                        </tr>
                                        {/* Diff: Dashboard Egresos vs Ppto Ejecutado */}
                                        <tr className="border-b border-gray-50 bg-amber-50/20">
                                            <td className="px-4 py-2 font-bold text-slate-700">Dash Egresos - Ppto Ejec.</td>
                                            <td className="px-4 py-2 text-[10px] text-amber-600">dash - ppto</td>
                                            {mesesAMostrar.map(m => {
                                                const diff = (flujoMap[m]?.egresos ?? 0) - (pptoMap[m]?.ejecutado ?? 0)
                                                const hasDiff = Math.abs(diff) > 100
                                                return (
                                                    <td key={m} className={`${tdBase} ${hasDiff ? 'text-amber-700 font-bold' : 'text-emerald-600'}`}>
                                                        <div className="flex items-center justify-end gap-1">
                                                            {hasDiff ? <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" /> : <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />}
                                                            <CurrencyDisplay value={diff} colorize={false} decimals={0} showPlusSign />
                                                        </div>
                                                    </td>
                                                )
                                            })}
                                            {(() => {
                                                const diff = ytdDash.egresos - ytdPpto.ejecutado
                                                const hasDiff = Math.abs(diff) > 100
                                                return (
                                                    <td className={`${tdBase} font-black bg-purple-50/30 ${hasDiff ? 'text-amber-700' : 'text-emerald-600'}`}>
                                                        <div className="flex items-center justify-end gap-1">
                                                            {hasDiff ? <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" /> : <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />}
                                                            <CurrencyDisplay value={diff} colorize={false} decimals={0} showPlusSign />
                                                        </div>
                                                    </td>
                                                )
                                            })()}
                                        </tr>
                                        {/* Diff: Dashboard Egresos vs Ejec Mensual */}
                                        <tr className="border-b border-gray-50 bg-amber-50/20">
                                            <td className="px-4 py-2 font-bold text-slate-700">Dash Egresos - Ejec. Mensual</td>
                                            <td className="px-4 py-2 text-[10px] text-amber-600">dash - ejec</td>
                                            {mesesAMostrar.map(m => {
                                                const diff = (flujoMap[m]?.egresos ?? 0) - (pptoMap[m]?.ejecutado ?? 0)
                                                const hasDiff = Math.abs(diff) > 100
                                                return (
                                                    <td key={m} className={`${tdBase} ${hasDiff ? 'text-amber-700 font-bold' : 'text-emerald-600'}`}>
                                                        <div className="flex items-center justify-end gap-1">
                                                            {hasDiff ? <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" /> : <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />}
                                                            <CurrencyDisplay value={diff} colorize={false} decimals={0} showPlusSign />
                                                        </div>
                                                    </td>
                                                )
                                            })}
                                            {(() => {
                                                const diff = ytdDash.egresos - ytdPpto.ejecutado
                                                const hasDiff = Math.abs(diff) > 100
                                                return (
                                                    <td className={`${tdBase} font-black bg-purple-50/30 ${hasDiff ? 'text-amber-700' : 'text-emerald-600'}`}>
                                                        <div className="flex items-center justify-end gap-1">
                                                            {hasDiff ? <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" /> : <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />}
                                                            <CurrencyDisplay value={diff} colorize={false} decimals={0} showPlusSign />
                                                        </div>
                                                    </td>
                                                )
                                            })()}
                                        </tr>
                                        {/* Diff: Ppto vs Ejec Mensual (should be 0 - same API) */}
                                        <tr className="border-b border-slate-200 bg-amber-50/20">
                                            <td className="px-4 py-2 font-bold text-slate-700">Ppto Ejec. - Ejec. Mensual</td>
                                            <td className="px-4 py-2 text-[10px] text-slate-400">misma API</td>
                                            {mesesAMostrar.map(m => (
                                                <td key={m} className={`${tdBase} text-emerald-600`}>
                                                    <div className="flex items-center justify-end gap-1">
                                                        <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
                                                        <span>$0</span>
                                                    </div>
                                                </td>
                                            ))}
                                            <td className={`${tdBase} font-black bg-purple-50/30 text-emerald-600`}>
                                                <div className="flex items-center justify-end gap-1">
                                                    <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
                                                    <span>$0</span>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* EXPLICACIÓN DE DIFERENCIAS */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Card: Por qué difieren */}
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                                        <Info className="w-4 h-4" />
                                    </div>
                                    <h3 className="font-bold text-slate-800 text-sm">Por qu&eacute; pueden diferir las cifras</h3>
                                </div>
                                <div className="space-y-3 text-xs text-slate-600">
                                    <div className="flex gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                                        <p><strong>Movimientos sin Centro de Costo:</strong> El Dashboard cuenta TODOS los egresos. El Presupuesto solo cuenta los que tienen centro de costo asignado (<code>centro_costo_id IS NOT NULL</code>).</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                                        <p><strong>Tipo de JOIN:</strong> Dashboard usa LEFT JOIN (incluye todo). Presupuesto usa INNER JOIN (solo registros con match en ambas tablas).</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                                        <p><strong>Signo del valor:</strong> Dashboard calcula ingresos (Valor &gt; 0) y egresos (Valor &lt; 0) por separado. Presupuesto solo filtra <code>Valor &lt; 0</code>.</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                                        <p><strong>Las 3 fuentes aplican:</strong> Exclusiones de Centros de Costos (filtros avanzados de reportes).</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5 shrink-0" />
                                        <p><strong>Ppto vs Real y Ejec. Mensual:</strong> Usan la misma API (<code>compararMensual</code>), mismos filtros. Sus cifras deben coincidir siempre.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Card: Filtros por fuente */}
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                                        <GitCompare className="w-4 h-4" />
                                    </div>
                                    <h3 className="font-bold text-slate-800 text-sm">Filtros aplicados por fuente</h3>
                                </div>
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-100">
                                            <th className="text-left py-2 text-slate-400 font-bold text-[10px] uppercase">Filtro</th>
                                            <th className="text-center py-2 text-blue-600 font-bold text-[10px] uppercase">Dashboard</th>
                                            <th className="text-center py-2 text-indigo-600 font-bold text-[10px] uppercase">Ppto vs Real</th>
                                            <th className="text-center py-2 text-teal-600 font-bold text-[10px] uppercase">Ejec. Mensual</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-slate-600">
                                        <tr className="border-b border-gray-50">
                                            <td className="py-2">Solo egresos (Valor &lt; 0)</td>
                                            <td className="py-2 text-center"><span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-bold">No</span></td>
                                            <td className="py-2 text-center"><span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">S&iacute;</span></td>
                                            <td className="py-2 text-center"><span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">S&iacute;</span></td>
                                        </tr>
                                        <tr className="border-b border-gray-50">
                                            <td className="py-2">centro_costo_id NOT NULL</td>
                                            <td className="py-2 text-center"><span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-bold">No</span></td>
                                            <td className="py-2 text-center"><span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">S&iacute;</span></td>
                                            <td className="py-2 text-center"><span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">S&iacute;</span></td>
                                        </tr>
                                        <tr className="border-b border-gray-50">
                                            <td className="py-2">Tipo de JOIN</td>
                                            <td className="py-2 text-center"><span className="text-[10px] font-mono text-slate-500">LEFT JOIN</span></td>
                                            <td className="py-2 text-center"><span className="text-[10px] font-mono text-slate-500">INNER JOIN</span></td>
                                            <td className="py-2 text-center"><span className="text-[10px] font-mono text-slate-500">INNER JOIN</span></td>
                                        </tr>
                                        <tr className="border-b border-gray-50">
                                            <td className="py-2">Exclusiones CC</td>
                                            <td className="py-2 text-center"><span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">S&iacute;</span></td>
                                            <td className="py-2 text-center"><span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">S&iacute;</span></td>
                                            <td className="py-2 text-center"><span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">S&iacute;</span></td>
                                        </tr>
                                        <tr className="border-b border-gray-50">
                                            <td className="py-2">Fuente de monto</td>
                                            <td className="py-2 text-center"><span className="text-[10px] font-mono text-slate-500">md.Valor</span></td>
                                            <td className="py-2 text-center"><span className="text-[10px] font-mono text-slate-500">md.Valor</span></td>
                                            <td className="py-2 text-center"><span className="text-[10px] font-mono text-slate-500">md.Valor</span></td>
                                        </tr>
                                        <tr>
                                            <td className="py-2">API endpoint</td>
                                            <td className="py-2 text-center"><span className="text-[10px] font-mono text-slate-500">flujoMensual</span></td>
                                            <td className="py-2 text-center"><span className="text-[10px] font-mono text-slate-500">compararMensual</span></td>
                                            <td className="py-2 text-center"><span className="text-[10px] font-mono text-slate-500">compararMensual</span></td>
                                        </tr>
                                    </tbody>
                                </table>

                                {actualExcluidos.length > 0 && (
                                    <div className="mt-4 pt-3 border-t border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">CC Excluidos activos:</p>
                                        <div className="flex flex-wrap gap-1">
                                            {exclusionNames.map((name, i) => (
                                                <span key={i} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px]">{name}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
