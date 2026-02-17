import { useMemo } from 'react'
import { CurrencyDisplay } from '../../atoms/CurrencyDisplay'
import type { ClasificacionItem } from '../../../services/dashboard.service'

interface DashboardTopExpensesProps {
    data: ClasificacionItem[]
    isLoading?: boolean
    maxItems?: number
    compact?: boolean
}

export const DashboardTopExpenses = ({ data, isLoading, maxItems = 8, compact = false }: DashboardTopExpensesProps) => {
    const { items, totalEgresos } = useMemo(() => {
        if (!data?.length) return { items: [], totalEgresos: 0 }

        const sorted = [...data]
            .filter(d => d.egresos > 0)
            .sort((a, b) => b.egresos - a.egresos)

        const total = sorted.reduce((sum, d) => sum + d.egresos, 0)
        const top = sorted.slice(0, maxItems)

        // Add "Otros" if there are more items
        if (sorted.length > maxItems) {
            const otrosEgresos = sorted.slice(maxItems).reduce((sum, d) => sum + d.egresos, 0)
            top.push({ nombre: 'Otros', ingresos: 0, egresos: otrosEgresos, saldo: -otrosEgresos })
        }

        return { items: top, totalEgresos: total }
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

    const maxEgreso = items.length > 0 ? items[0].egresos : 1

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-slate-800 mb-1">¿A dónde va mi plata?</h3>
            <p className="text-xs text-slate-400 mb-5">Top egresos por centro de costo</p>

            {items.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Sin datos</div>
            ) : (
                <div className="space-y-3">
                    {items.reduce<{ acumulado: number; elements: React.ReactNode[] }>((acc, item) => {
                        const pct = totalEgresos > 0 ? (item.egresos / totalEgresos) * 100 : 0
                        const barWidth = (item.egresos / maxEgreso) * 100
                        const acumulado = acc.acumulado + item.egresos
                        const pctAcum = totalEgresos > 0 ? (acumulado / totalEgresos) * 100 : 0

                        acc.acumulado = acumulado
                        acc.elements.push(
                            <div key={item.nombre} className="group">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium text-slate-700 truncate max-w-[40%]">
                                        {item.nombre}
                                    </span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[11px] font-mono text-slate-400">
                                            {pct.toFixed(0)}%
                                        </span>
                                        <CurrencyDisplay
                                            value={item.egresos}
                                            colorize={false}
                                            decimals={0}
                                            className="text-sm font-mono font-bold text-slate-700 w-28 text-right"
                                            compact={compact}
                                        />
                                        <span className="text-[11px] font-mono text-slate-400 w-24 text-right" title="Acumulado">
                                            {pctAcum.toFixed(0)}% · <CurrencyDisplay
                                                value={acumulado}
                                                colorize={false}
                                                decimals={0}
                                                className="inline text-[11px] font-mono text-slate-400"
                                                compact={compact}
                                            />
                                        </span>
                                    </div>
                                </div>
                                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-400 to-indigo-600 rounded-full transition-all duration-700"
                                        style={{ width: `${barWidth}%` }}
                                    />
                                </div>
                            </div>
                        )
                        return acc
                    }, { acumulado: 0, elements: [] }).elements}
                </div>
            )}

            {/* Total */}
            {totalEgresos > 0 && (
                <div className="flex justify-between items-center mt-5 pt-4 border-t border-gray-100">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Egresos</span>
                    <CurrencyDisplay
                        value={totalEgresos}
                        colorize={false}
                        decimals={0}
                        className="text-sm font-mono font-black text-slate-800"
                        compact={compact}
                    />
                </div>
            )}
        </div>
    )
}
