import { useMemo } from 'react'
import { CurrencyDisplay } from '../atoms/CurrencyDisplay'
import { SemaforoBadge } from '../atoms/SemaforoBadge'
import { Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { ResumenMensualPresupuesto } from '../../types/Presupuesto'

interface BudgetExecutionTableProps {
    dataEgreso: ResumenMensualPresupuesto[]
    dataIngreso: ResumenMensualPresupuesto[]
    semaforoVerde?: number
    semaforoAmarillo?: number
    compact?: boolean
    anioAnterior?: number
}

interface MonthGroup {
    mes: number
    mes_nombre: string
    ing: ResumenMensualPresupuesto | null
    egr: ResumenMensualPresupuesto | null
    neto: {
        ejecutado_anterior: number
        presupuestado: number
        ejecutado: number
        variacion: number
    }
}

export const BudgetExecutionTable = ({
    dataEgreso,
    dataIngreso,
    semaforoVerde = 10,
    semaforoAmarillo = 25,
    compact = false,
    anioAnterior,
}: BudgetExecutionTableProps) => {

    // Merge both directions into month groups
    const groups = useMemo(() => {
        const allMeses = new Set<number>()
        dataEgreso.forEach(r => allMeses.add(r.mes))
        dataIngreso.forEach(r => allMeses.add(r.mes))

        const egrMap = new Map(dataEgreso.map(r => [r.mes, r]))
        const ingMap = new Map(dataIngreso.map(r => [r.mes, r]))

        return Array.from(allMeses).sort((a, b) => a - b).map(mes => {
            const egr = egrMap.get(mes) ?? null
            const ing = ingMap.get(mes) ?? null
            const mesNombre = ing?.mes_nombre ?? egr?.mes_nombre ?? `Mes ${mes}`

            return {
                mes,
                mes_nombre: mesNombre,
                ing,
                egr,
                neto: {
                    ejecutado_anterior: (ing?.ejecutado_anterior ?? 0) - (egr?.ejecutado_anterior ?? 0),
                    presupuestado: (ing?.presupuestado ?? 0) - (egr?.presupuestado ?? 0),
                    ejecutado: (ing?.ejecutado ?? 0) - (egr?.ejecutado ?? 0),
                    variacion: ((ing?.ejecutado ?? 0) - (egr?.ejecutado ?? 0)) - ((ing?.presupuestado ?? 0) - (egr?.presupuestado ?? 0)),
                },
            } as MonthGroup
        })
    }, [dataEgreso, dataIngreso])

    // Pareto per direction (% vs presupuesto anual)
    const paretoIng = useMemo(() => {
        const pptoAnual = dataIngreso.reduce((s, r) => s + r.presupuestado, 0)
        let acum = 0
        const map = new Map<number, { acumulado: number; acumuladoPct: number }>()
        groups.forEach(g => {
            acum += g.ing?.ejecutado ?? 0
            map.set(g.mes, { acumulado: acum, acumuladoPct: pptoAnual > 0 ? (acum / pptoAnual) * 100 : 0 })
        })
        return map
    }, [dataIngreso, groups])

    const paretoEgr = useMemo(() => {
        const pptoAnual = dataEgreso.reduce((s, r) => s + r.presupuestado, 0)
        let acum = 0
        const map = new Map<number, { acumulado: number; acumuladoPct: number }>()
        groups.forEach(g => {
            acum += g.egr?.ejecutado ?? 0
            map.set(g.mes, { acumulado: acum, acumuladoPct: pptoAnual > 0 ? (acum / pptoAnual) * 100 : 0 })
        })
        return map
    }, [dataEgreso, groups])

    const paretoNeto = useMemo(() => {
        let acum = 0
        const map = new Map<number, number>()
        groups.forEach(g => {
            acum += g.neto.ejecutado
            map.set(g.mes, acum)
        })
        return map
    }, [groups])

    // YTD totals (variación pro-rata: solo meses con ejecución)
    const ytd = useMemo(() => {
        const calc = (data: ResumenMensualPresupuesto[]) => {
            const ejecutadoAnterior = data.reduce((s, r) => s + (r.ejecutado_anterior ?? 0), 0)
            const presupuestado = data.reduce((s, r) => s + r.presupuestado, 0)
            const ejecutado = data.reduce((s, r) => s + r.ejecutado, 0)
            const mesesEjecutados = data.filter(m => m.ejecutado > 0)
            const pptoEjecutado = mesesEjecutados.reduce((s, r) => s + r.presupuestado, 0)
            const variacion = ejecutado - pptoEjecutado
            const variacion_pct = pptoEjecutado > 0 ? ((variacion / pptoEjecutado) * 100) : 0
            const consumo = pptoEjecutado > 0 ? ((ejecutado / pptoEjecutado) * 100) : 0
            const acumPct = presupuestado > 0 ? ((ejecutado / presupuestado) * 100) : 0
            const semaforo: 'verde' | 'amarillo' | 'rojo' =
                variacion_pct <= 0 ? 'verde'
                : variacion_pct <= semaforoVerde ? 'verde'
                : variacion_pct <= semaforoAmarillo ? 'amarillo'
                : 'rojo'
            return { ejecutadoAnterior, presupuestado, ejecutado, variacion, variacion_pct, consumo, acumPct, semaforo }
        }
        const ingYtd = calc(dataIngreso)
        const egrYtd = calc(dataEgreso)
        const neto = {
            ejecutadoAnterior: ingYtd.ejecutadoAnterior - egrYtd.ejecutadoAnterior,
            presupuestado: ingYtd.presupuestado - egrYtd.presupuestado,
            ejecutado: ingYtd.ejecutado - egrYtd.ejecutado,
            variacion: (ingYtd.ejecutado - egrYtd.ejecutado) - (ingYtd.presupuestado - egrYtd.presupuestado),
        }
        return { ing: ingYtd, egr: egrYtd, neto }
    }, [dataEgreso, dataIngreso, semaforoVerde, semaforoAmarillo])

    if (groups.length === 0) return null

    const hasAnterior = dataEgreso.some(r => (r.ejecutado_anterior ?? 0) > 0)
        || dataIngreso.some(r => (r.ejecutado_anterior ?? 0) > 0)

    const getVarColor = (pct: number) => {
        if (pct <= 0) return 'text-emerald-600'
        if (pct <= semaforoVerde) return 'text-emerald-600'
        if (pct <= semaforoAmarillo) return 'text-amber-600'
        return 'text-rose-600'
    }

    const thClass = 'text-right px-3 py-2.5 font-bold text-gray-400 text-[10px] uppercase tracking-wide'
    const tdMono = 'px-3 py-2 text-right font-mono text-xs'

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Calendar className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-800 tracking-tight text-sm">Resumen de Ejecución Mensual</h3>
            </div>
            <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0 z-10 shadow-[0_1px_0_0_#e2e8f0]">
                        <tr>
                            <th className="text-left px-3 py-2.5 font-bold text-gray-400 text-[10px] uppercase tracking-wide w-24">Período</th>
                            <th className="text-left px-3 py-2.5 font-bold text-gray-400 text-[10px] uppercase tracking-wide w-20">Tipo</th>
                            {hasAnterior && (
                                <th className={thClass}>{anioAnterior ?? 'Anterior'}</th>
                            )}
                            <th className={thClass}>Presupuestado</th>
                            <th className={thClass}>Ejecutado</th>
                            <th className={thClass}>Variación</th>
                            <th className={thClass}>Consumo</th>
                            <th className="text-center px-3 py-2.5 font-bold text-gray-400 text-[10px] uppercase tracking-wide w-20">Estado</th>
                            <th className={thClass}>Acumulado</th>
                            <th className={thClass}>Acum %</th>
                        </tr>
                        {/* YTD Summary (sticky with header) */}
                        {/* YTD Ingreso */}
                        <tr className="bg-slate-100 font-bold border-b border-slate-200">
                            <td rowSpan={3} className="px-3 py-2.5 uppercase text-slate-700 text-xs tracking-wide align-top border-r border-gray-200 bg-slate-100">
                                YTD ({groups.length} {groups.length === 1 ? 'mes' : 'meses'})
                            </td>
                            <td className="px-3 py-2">
                                <span className="flex items-center gap-1 text-emerald-600 font-bold text-[11px]">
                                    <TrendingUp className="w-3 h-3" />
                                    Ingreso
                                </span>
                            </td>
                            {hasAnterior && (
                                <td className={`${tdMono} text-slate-600 font-bold`}>
                                    <CurrencyDisplay value={ytd.ing.ejecutadoAnterior} colorize={false} decimals={0} compact={compact} />
                                </td>
                            )}
                            <td className={`${tdMono} text-blue-700 font-bold`}>
                                <CurrencyDisplay value={ytd.ing.presupuestado} colorize={false} decimals={0} compact={compact} />
                            </td>
                            <td className={`${tdMono} text-emerald-700 font-bold`}>
                                <CurrencyDisplay value={ytd.ing.ejecutado} colorize={false} decimals={0} compact={compact} />
                            </td>
                            <td className={`${tdMono} font-bold`}>
                                <CurrencyDisplay value={ytd.ing.variacion} decimals={0} compact={compact} />
                            </td>
                            <td className={`${tdMono} font-black ${getVarColor(ytd.ing.variacion_pct)}`}>
                                {ytd.ing.consumo.toFixed(1)}%
                            </td>
                            <td className="px-3 py-2 text-center">
                                <SemaforoBadge valor={ytd.ing.semaforo} variacionPct={ytd.ing.variacion_pct} size="sm" />
                            </td>
                            <td className={`${tdMono} text-emerald-700 font-bold`}>
                                <CurrencyDisplay value={ytd.ing.ejecutado} colorize={false} decimals={0} compact={compact} />
                            </td>
                            <td className={`${tdMono} font-black text-emerald-700`}>
                                {ytd.ing.acumPct.toFixed(1)}%
                            </td>
                        </tr>

                        {/* YTD Egreso */}
                        <tr className="bg-slate-100 font-bold border-b border-slate-200">
                            <td className="px-3 py-2">
                                <span className="flex items-center gap-1 text-rose-600 font-bold text-[11px]">
                                    <TrendingDown className="w-3 h-3" />
                                    Egreso
                                </span>
                            </td>
                            {hasAnterior && (
                                <td className={`${tdMono} text-slate-600 font-bold`}>
                                    <CurrencyDisplay value={ytd.egr.ejecutadoAnterior} colorize={false} decimals={0} compact={compact} />
                                </td>
                            )}
                            <td className={`${tdMono} text-blue-700 font-bold`}>
                                <CurrencyDisplay value={ytd.egr.presupuestado} colorize={false} decimals={0} compact={compact} />
                            </td>
                            <td className={`${tdMono} text-rose-700 font-bold`}>
                                <CurrencyDisplay value={ytd.egr.ejecutado} colorize={false} decimals={0} compact={compact} />
                            </td>
                            <td className={`${tdMono} font-bold`}>
                                <CurrencyDisplay value={ytd.egr.variacion} decimals={0} compact={compact} />
                            </td>
                            <td className={`${tdMono} font-black ${getVarColor(ytd.egr.variacion_pct)}`}>
                                {ytd.egr.consumo.toFixed(1)}%
                            </td>
                            <td className="px-3 py-2 text-center">
                                <SemaforoBadge valor={ytd.egr.semaforo} variacionPct={ytd.egr.variacion_pct} size="sm" />
                            </td>
                            <td className={`${tdMono} text-rose-700 font-bold`}>
                                <CurrencyDisplay value={ytd.egr.ejecutado} colorize={false} decimals={0} compact={compact} />
                            </td>
                            <td className={`${tdMono} font-black text-rose-700`}>
                                {ytd.egr.acumPct.toFixed(1)}%
                            </td>
                        </tr>

                        {/* YTD Neto */}
                        <tr className="bg-indigo-50/50 font-bold border-b-2 border-slate-300">
                            <td className="px-3 py-2">
                                <span className="flex items-center gap-1 text-indigo-600 font-bold text-[11px]">
                                    <Minus className="w-3 h-3" />
                                    Neto
                                </span>
                            </td>
                            {hasAnterior && (
                                <td className={`${tdMono} text-indigo-700 font-bold`}>
                                    <CurrencyDisplay value={ytd.neto.ejecutadoAnterior} decimals={0} compact={compact} />
                                </td>
                            )}
                            <td className={`${tdMono} text-indigo-700 font-bold`}>
                                <CurrencyDisplay value={ytd.neto.presupuestado} decimals={0} compact={compact} />
                            </td>
                            <td className={`${tdMono} text-indigo-700 font-black`}>
                                <CurrencyDisplay value={ytd.neto.ejecutado} decimals={0} compact={compact} />
                            </td>
                            <td className={`${tdMono} text-indigo-700 font-bold`}>
                                <CurrencyDisplay value={ytd.neto.variacion} decimals={0} compact={compact} />
                            </td>
                            <td className={`${tdMono} text-slate-300`}>—</td>
                            <td className="px-3 py-2 text-center text-slate-300">—</td>
                            <td className={`${tdMono} text-indigo-700 font-bold`}>
                                <CurrencyDisplay value={ytd.neto.ejecutado} decimals={0} compact={compact} />
                            </td>
                            <td className={`${tdMono} text-slate-300`}>—</td>
                        </tr>
                    </thead>
                    {groups.map((g) => {
                        const ingRow = g.ing
                        const egrRow = g.egr
                        const pIng = paretoIng.get(g.mes)
                        const pEgr = paretoEgr.get(g.mes)
                        const netoAcum = paretoNeto.get(g.mes) ?? 0

                        const consumoIng = ingRow && ingRow.presupuestado > 0
                            ? (ingRow.ejecutado / ingRow.presupuestado * 100) : 0
                        const consumoEgr = egrRow && egrRow.presupuestado > 0
                            ? (egrRow.ejecutado / egrRow.presupuestado * 100) : 0

                        return (
                            <tbody key={g.mes}>
                                    {/* Ingreso row */}
                                    <tr className="border-b border-gray-50 hover:bg-emerald-50/30 transition-colors">
                                        <td rowSpan={3} className="px-3 py-2 font-bold text-slate-700 text-xs align-top border-r border-gray-100">
                                            {g.mes_nombre}
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className="flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                                                <TrendingUp className="w-3 h-3" />
                                                Ingreso
                                            </span>
                                        </td>
                                        {hasAnterior && (
                                            <td className={`${tdMono} text-slate-500`}>
                                                <CurrencyDisplay value={ingRow?.ejecutado_anterior ?? 0} colorize={false} decimals={0} compact={compact} />
                                            </td>
                                        )}
                                        <td className={`${tdMono} text-blue-600`}>
                                            <CurrencyDisplay value={ingRow?.presupuestado ?? 0} colorize={false} decimals={0} compact={compact} />
                                        </td>
                                        <td className={`${tdMono} text-emerald-700`}>
                                            <CurrencyDisplay value={ingRow?.ejecutado ?? 0} colorize={false} decimals={0} compact={compact} />
                                        </td>
                                        <td className={tdMono}>
                                            <CurrencyDisplay value={ingRow?.variacion ?? 0} decimals={0} compact={compact} />
                                        </td>
                                        <td className={`${tdMono} font-bold ${ingRow ? getVarColor(ingRow.variacion_pct) : 'text-slate-400'}`}>
                                            {consumoIng.toFixed(1)}%
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            {ingRow && <SemaforoBadge valor={ingRow.semaforo} variacionPct={ingRow.variacion_pct} size="sm" />}
                                        </td>
                                        <td className={`${tdMono} text-slate-600`}>
                                            <CurrencyDisplay value={pIng?.acumulado ?? 0} colorize={false} decimals={0} compact={compact} />
                                        </td>
                                        <td className={`${tdMono} font-semibold text-emerald-600`}>
                                            {(pIng?.acumuladoPct ?? 0).toFixed(1)}%
                                        </td>
                                    </tr>

                                    {/* Egreso row */}
                                    <tr className="border-b border-gray-50 hover:bg-rose-50/30 transition-colors">
                                        <td className="px-3 py-2">
                                            <span className="flex items-center gap-1 text-rose-600 font-semibold text-[11px]">
                                                <TrendingDown className="w-3 h-3" />
                                                Egreso
                                            </span>
                                        </td>
                                        {hasAnterior && (
                                            <td className={`${tdMono} text-slate-500`}>
                                                <CurrencyDisplay value={egrRow?.ejecutado_anterior ?? 0} colorize={false} decimals={0} compact={compact} />
                                            </td>
                                        )}
                                        <td className={`${tdMono} text-blue-600`}>
                                            <CurrencyDisplay value={egrRow?.presupuestado ?? 0} colorize={false} decimals={0} compact={compact} />
                                        </td>
                                        <td className={`${tdMono} text-rose-700`}>
                                            <CurrencyDisplay value={egrRow?.ejecutado ?? 0} colorize={false} decimals={0} compact={compact} />
                                        </td>
                                        <td className={tdMono}>
                                            <CurrencyDisplay value={egrRow?.variacion ?? 0} decimals={0} compact={compact} />
                                        </td>
                                        <td className={`${tdMono} font-bold ${egrRow ? getVarColor(egrRow.variacion_pct) : 'text-slate-400'}`}>
                                            {consumoEgr.toFixed(1)}%
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            {egrRow && <SemaforoBadge valor={egrRow.semaforo} variacionPct={egrRow.variacion_pct} size="sm" />}
                                        </td>
                                        <td className={`${tdMono} text-slate-600`}>
                                            <CurrencyDisplay value={pEgr?.acumulado ?? 0} colorize={false} decimals={0} compact={compact} />
                                        </td>
                                        <td className={`${tdMono} font-semibold text-rose-600`}>
                                            {(pEgr?.acumuladoPct ?? 0).toFixed(1)}%
                                        </td>
                                    </tr>

                                    {/* Neto row */}
                                    <tr className="border-b-2 border-slate-200 bg-indigo-50/30 hover:bg-indigo-50/50 transition-colors">
                                        <td className="px-3 py-1.5">
                                            <span className="flex items-center gap-1 text-indigo-600 font-semibold text-[11px]">
                                                <Minus className="w-3 h-3" />
                                                Neto
                                            </span>
                                        </td>
                                        {hasAnterior && (
                                            <td className={`${tdMono} text-indigo-600`}>
                                                <CurrencyDisplay value={g.neto.ejecutado_anterior} decimals={0} compact={compact} />
                                            </td>
                                        )}
                                        <td className={`${tdMono} text-indigo-600`}>
                                            <CurrencyDisplay value={g.neto.presupuestado} decimals={0} compact={compact} />
                                        </td>
                                        <td className={`${tdMono} text-indigo-700 font-bold`}>
                                            <CurrencyDisplay value={g.neto.ejecutado} decimals={0} compact={compact} />
                                        </td>
                                        <td className={`${tdMono} text-indigo-600`}>
                                            <CurrencyDisplay value={g.neto.variacion} decimals={0} compact={compact} />
                                        </td>
                                        <td className={`${tdMono} text-slate-300`}>—</td>
                                        <td className="px-3 py-1.5 text-center text-slate-300">—</td>
                                        <td className={`${tdMono} text-indigo-600`}>
                                            <CurrencyDisplay value={netoAcum} decimals={0} compact={compact} />
                                        </td>
                                        <td className={`${tdMono} text-slate-300`}>—</td>
                                    </tr>
                            </tbody>
                        )
                    })}
                </table>
            </div>
        </div>
    )
}
