import { useMemo, useState } from 'react'
import { useBudgetFormat } from '../../atoms/CurrencyDisplay'
import type { ClasificacionItem } from '../../../services/dashboard.service'

interface DashboardTopExpensesProps {
    data: ClasificacionItem[]
    isLoading?: boolean
    maxItems?: number
    compact?: boolean
}

interface RowData {
    item: ClasificacionItem
    pct: number
    barWidth: number
    acumulado: number
    pctAcum: number
    isPareto: boolean
}

export const DashboardTopExpenses = ({ data, isLoading, maxItems = 8 }: DashboardTopExpensesProps) => {
    const fmt = useBudgetFormat()
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

    const { rows, totalEgresos } = useMemo(() => {
        if (!data?.length) return { rows: [] as RowData[], totalEgresos: 0 }

        const sorted = [...data]
            .filter(d => d.egresos > 0)
            .sort((a, b) => b.egresos - a.egresos)

        const total = sorted.reduce((sum, d) => sum + d.egresos, 0)
        const top = sorted.slice(0, maxItems)

        if (sorted.length > maxItems) {
            const otrosEgresos = sorted.slice(maxItems).reduce((sum, d) => sum + d.egresos, 0)
            top.push({ id: null, nombre: 'Otros', ingresos: 0, egresos: otrosEgresos, saldo: -otrosEgresos })
        }

        const maxEgreso = top.length > 0 ? top[0].egresos : 1
        let acumulado = 0
        let prevPctAcum = 0
        const built: RowData[] = top.map(item => {
            const pct = total > 0 ? (item.egresos / total) * 100 : 0
            const barWidth = (item.egresos / maxEgreso) * 100
            acumulado += item.egresos
            const pctAcum = total > 0 ? (acumulado / total) * 100 : 0
            const isPareto = prevPctAcum < 80
            prevPctAcum = pctAcum
            return { item, pct, barWidth, acumulado, pctAcum, isPareto }
        })

        return { rows: built, totalEgresos: total }
    }, [data, maxItems])

    if (isLoading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="h-5 bg-gray-200 rounded w-48 mb-4 animate-pulse" />
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-8 bg-gray-50 rounded animate-pulse" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-slate-800 mb-1">¿A dónde va mi plata?</h3>
            <p className="text-xs text-slate-400 mb-5">Top egresos por centro de costo</p>

            {rows.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Sin datos</div>
            ) : (
                <div className="space-y-3">
                    {rows.map((row, idx) => {
                        const { item, barWidth, pct, acumulado, pctAcum, isPareto } = row
                        const acumColor = isPareto ? 'text-purple-500' : 'text-slate-500'

                        return (
                            <div
                                key={item.nombre}
                                className="relative"
                                onMouseEnter={() => setHoveredIdx(idx)}
                                onMouseLeave={() => setHoveredIdx(null)}
                            >
                                <span className="text-sm font-semibold text-slate-700 truncate block mb-1">
                                    {item.id ? `${item.id} - ${item.nombre}` : item.nombre}
                                </span>
                                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-400 to-indigo-600 rounded-full transition-all duration-700"
                                        style={{ width: `${barWidth}%` }}
                                    />
                                </div>

                                {/* Tooltip */}
                                {hoveredIdx === idx && (
                                    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white rounded-xl shadow-lg border border-gray-200 px-4 py-3 whitespace-nowrap pointer-events-none">
                                        <div className="font-semibold text-slate-800 text-sm mb-2">
                                            {item.id ? `${item.id} - ${item.nombre}` : item.nombre}
                                        </div>
                                        <table className="text-[13px]">
                                            <tbody>
                                                <tr>
                                                    <td className="pr-4 text-slate-500">Monto</td>
                                                    <td className="text-right font-mono font-bold text-slate-700">{fmt(item.egresos)}</td>
                                                </tr>
                                                <tr>
                                                    <td className="pr-4 text-slate-500">% del total</td>
                                                    <td className="text-right font-mono text-slate-700">{pct.toFixed(1)}%</td>
                                                </tr>
                                                <tr>
                                                    <td className={`pr-4 ${acumColor}`}>Acumulado</td>
                                                    <td className={`text-right font-mono font-bold ${acumColor}`}>{fmt(acumulado)}</td>
                                                </tr>
                                                <tr>
                                                    <td className={`pr-4 ${acumColor}`}>% acumulado</td>
                                                    <td className={`text-right font-mono ${acumColor}`}>{pctAcum.toFixed(1)}%</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-white" />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Total */}
            {totalEgresos > 0 && (
                <div className="flex justify-between items-center mt-5 pt-4 border-t border-gray-100">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Egresos</span>
                    <span className="text-sm font-mono font-black text-slate-800">{fmt(totalEgresos)}</span>
                </div>
            )}
        </div>
    )
}
