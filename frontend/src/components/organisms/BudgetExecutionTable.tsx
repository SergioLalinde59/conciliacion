import { useMemo } from 'react'
import { CurrencyDisplay } from '../atoms/CurrencyDisplay'
import { SemaforoBadge } from '../atoms/SemaforoBadge'
import { Calendar } from 'lucide-react'
import type { ResumenMensualPresupuesto } from '../../types/Presupuesto'

interface BudgetExecutionTableProps {
    data: ResumenMensualPresupuesto[]
    semaforoVerde?: number
    semaforoAmarillo?: number
    compact?: boolean
}

export const BudgetExecutionTable = ({
    data,
    semaforoVerde = 10,
    semaforoAmarillo = 25,
    compact = false,
}: BudgetExecutionTableProps) => {

    const ytd = useMemo(() => {
        const presupuestado = data.reduce((s, r) => s + r.presupuestado, 0)
        const ejecutado = data.reduce((s, r) => s + r.ejecutado, 0)
        const variacion = ejecutado - presupuestado
        const variacion_pct = presupuestado > 0 ? ((variacion / presupuestado) * 100) : 0
        const consumo = presupuestado > 0 ? ((ejecutado / presupuestado) * 100) : 0
        const semaforo: 'verde' | 'amarillo' | 'rojo' =
            variacion_pct <= 0 ? 'verde'
            : variacion_pct <= semaforoVerde ? 'verde'
            : variacion_pct <= semaforoAmarillo ? 'amarillo'
            : 'rojo'
        return { presupuestado, ejecutado, variacion, variacion_pct, consumo, semaforo }
    }, [data, semaforoVerde, semaforoAmarillo])

    if (data.length === 0) return null

    const getVarColor = (pct: number) => {
        if (pct <= 0) return 'text-emerald-600'
        if (pct <= semaforoVerde) return 'text-emerald-600'
        if (pct <= semaforoAmarillo) return 'text-amber-600'
        return 'text-rose-600'
    }

    const thClass = 'text-right px-4 py-2.5 font-bold text-gray-400 text-[10px] uppercase tracking-wide'
    const tdMono = 'px-4 py-2.5 text-right font-mono text-xs'

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Calendar className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-800 tracking-tight text-sm">Resumen de Ejecuci&oacute;n Mensual</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="text-left px-4 py-2.5 font-bold text-gray-400 text-[10px] uppercase tracking-wide w-28">Per&iacute;odo</th>
                            <th className={thClass}>Presupuestado</th>
                            <th className={thClass}>Ejecutado Real</th>
                            <th className={thClass}>Variaci&oacute;n</th>
                            <th className={thClass}>Consumo</th>
                            <th className="text-center px-4 py-2.5 font-bold text-gray-400 text-[10px] uppercase tracking-wide w-24">Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map(row => {
                            const consumo = row.presupuestado > 0
                                ? (row.ejecutado / row.presupuestado * 100)
                                : 0
                            return (
                                <tr key={row.mes} className="border-b border-gray-50 hover:bg-slate-50/50 transition-colors">
                                    <td className="px-4 py-2.5 font-bold text-slate-700 text-xs">{row.mes_nombre}</td>
                                    <td className={`${tdMono} text-blue-600`}>
                                        <CurrencyDisplay value={row.presupuestado} colorize={false} decimals={0} compact={compact} />
                                    </td>
                                    <td className={`${tdMono} text-rose-600`}>
                                        <CurrencyDisplay value={row.ejecutado} colorize={false} decimals={0} compact={compact} />
                                    </td>
                                    <td className={tdMono}>
                                        <CurrencyDisplay value={row.variacion} decimals={0} compact={compact} />
                                    </td>
                                    <td className={`${tdMono} font-bold ${getVarColor(row.variacion_pct)}`}>
                                        {consumo.toFixed(1)}%
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                        <SemaforoBadge valor={row.semaforo} variacionPct={row.variacion_pct} size="sm" />
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                            <td className="px-4 py-3 uppercase text-slate-700 text-xs tracking-wide">
                                YTD ({data.length} {data.length === 1 ? 'mes' : 'meses'})
                            </td>
                            <td className={`${tdMono} text-blue-700 font-bold`}>
                                <CurrencyDisplay value={ytd.presupuestado} colorize={false} decimals={0} compact={compact} />
                            </td>
                            <td className={`${tdMono} text-rose-700 font-bold`}>
                                <CurrencyDisplay value={ytd.ejecutado} colorize={false} decimals={0} compact={compact} />
                            </td>
                            <td className={tdMono}>
                                <CurrencyDisplay value={ytd.variacion} decimals={0} compact={compact} />
                            </td>
                            <td className={`${tdMono} font-black ${getVarColor(ytd.variacion_pct)}`}>
                                {ytd.consumo.toFixed(1)}%
                            </td>
                            <td className="px-4 py-3 text-center">
                                <SemaforoBadge valor={ytd.semaforo} variacionPct={ytd.variacion_pct} size="sm" />
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    )
}