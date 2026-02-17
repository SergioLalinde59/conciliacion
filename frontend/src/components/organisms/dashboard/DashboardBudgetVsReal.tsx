import { useMemo } from 'react'
import { SemaforoBadge } from '../../atoms/SemaforoBadge'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, AlertTriangle } from 'lucide-react'
import { formatCompact } from '../../../utils/formatters'
import type { ComparacionPresupuesto } from '../../../types/Presupuesto'

interface DashboardBudgetVsRealProps {
    data: ComparacionPresupuesto[]
    isLoading?: boolean
    maxItems?: number
}

const semaforoGradient: Record<string, string> = {
    verde: 'bg-gradient-to-r from-emerald-400 to-emerald-500',
    amarillo: 'bg-gradient-to-r from-amber-400 to-amber-500',
    rojo: 'bg-gradient-to-r from-rose-400 to-rose-500',
}

export const DashboardBudgetVsReal = ({ data, isLoading, maxItems = 6 }: DashboardBudgetVsRealProps) => {
    const navigate = useNavigate()

    const items = useMemo(() => {
        if (!data?.length) return []
        return [...data]
            .filter(d => d.presupuestado > 0 || d.ejecutado > 0)
            .sort((a, b) => b.ejecutado - a.ejecutado)
            .slice(0, maxItems)
    }, [data, maxItems])

    const summary = useMemo(() => {
        if (!data?.length) return null
        const relevant = data.filter(d => d.presupuestado > 0 || d.ejecutado > 0)
        const totalPpto = relevant.reduce((s, d) => s + d.presupuestado, 0)
        const totalConPpto = relevant.reduce((s, d) => s + (d.ejecutado_con_ppto ?? d.ejecutado), 0)
        const totalSinPpto = relevant.reduce((s, d) => s + (d.ejecutado_sin_ppto ?? 0), 0)
        if (totalPpto === 0 && totalConPpto === 0) return null
        const variPct = totalPpto > 0
            ? Math.round(((totalConPpto - totalPpto) / totalPpto) * 1000) / 10
            : 0
        const semaforo: 'verde' | 'amarillo' | 'rojo' =
            variPct <= 10 ? 'verde' : variPct <= 25 ? 'amarillo' : 'rojo'
        return { totalPpto, totalConPpto, totalSinPpto, variPct, semaforo }
    }, [data])

    const totalVisible = data
        ? data.filter(d => d.presupuestado > 0 || d.ejecutado > 0).length
        : 0
    const remaining = totalVisible - Math.min(totalVisible, maxItems)

    if (isLoading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="h-5 bg-gray-200 rounded w-48 mb-4 animate-pulse" />
                <div className="h-10 bg-gray-50 rounded-lg mb-5 animate-pulse" />
                <div className="space-y-5">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="space-y-2">
                            <div className="flex justify-between">
                                <div className="h-4 bg-gray-100 rounded w-28 animate-pulse" />
                                <div className="h-4 bg-gray-100 rounded w-20 animate-pulse" />
                            </div>
                            <div className="h-2.5 bg-gray-100 rounded-full animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-slate-800">Presupuesto vs Real</h3>
                <button
                    onClick={() => navigate('/reportes/presupuesto-vs-real')}
                    className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1 font-medium transition-colors"
                >
                    Ver detalle <ArrowRight size={14} />
                </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">Por centro de costo</p>

            {/* Summary strip */}
            {summary && summary.totalPpto > 0 && (
                <div className="bg-slate-50 rounded-lg px-3 py-2.5 mb-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">
                                {formatCompact(summary.totalConPpto)} de {formatCompact(summary.totalPpto)}
                            </span>
                            <SemaforoBadge
                                valor={summary.semaforo}
                                variacionPct={summary.variPct}
                                size="sm"
                            />
                        </div>
                        {summary.totalSinPpto > 0 && (
                            <span className="flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                                <AlertTriangle size={12} />
                                {formatCompact(summary.totalSinPpto)} sin ppto
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* CC rows */}
            {items.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                    Sin datos de presupuesto
                </div>
            ) : (
                <div className="space-y-3.5">
                    {items.map((item) => {
                        const conPpto = item.ejecutado_con_ppto ?? item.ejecutado
                        const sinPpto = item.ejecutado_sin_ppto ?? 0
                        const ppto = item.presupuestado
                        const isOver = conPpto > ppto && ppto > 0
                        const fillPct = ppto > 0
                            ? Math.min((conPpto / ppto) * 100, 100)
                            : (conPpto > 0 ? 100 : 0)
                        const gradient = semaforoGradient[item.semaforo] || semaforoGradient.verde

                        return (
                            <div
                                key={item.id ?? item.nombre}
                                className="group cursor-pointer hover:bg-slate-50 rounded-lg px-2 py-2 -mx-2 transition-all duration-200"
                                onClick={() => navigate('/reportes/presupuesto-vs-real')}
                            >
                                {/* Line 1: Name + amounts + badge */}
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-sm font-medium text-slate-700 truncate max-w-[45%]">
                                        {item.nombre}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-mono text-slate-400">
                                            {formatCompact(conPpto)}
                                            <span className="text-slate-300"> / </span>
                                            {formatCompact(ppto)}
                                        </span>
                                        <SemaforoBadge
                                            valor={item.semaforo}
                                            variacionPct={item.variacion_pct}
                                            size="sm"
                                        />
                                    </div>
                                </div>

                                {/* Line 2: Progress bar */}
                                <div className="relative w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${gradient} rounded-full transition-all duration-700 ease-out`}
                                        style={{ width: `${isOver ? 100 : fillPct}%` }}
                                    />
                                    {isOver && ppto > 0 && (
                                        <div
                                            className="absolute top-0 bottom-0 w-0.5 bg-white/80"
                                            style={{ left: `${Math.min((ppto / conPpto) * 100, 99)}%` }}
                                        />
                                    )}
                                </div>

                                {/* Line 3 (conditional): Unbudgeted warning */}
                                {sinPpto > 0 && (
                                    <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-500">
                                        <AlertTriangle size={11} className="shrink-0" />
                                        <span>+{formatCompact(sinPpto)} sin presupuesto</span>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Footer: remaining */}
            {remaining > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                    <button
                        onClick={() => navigate('/reportes/presupuesto-vs-real')}
                        className="text-xs text-slate-400 hover:text-blue-600 font-medium transition-colors"
                    >
                        y {remaining} más...
                    </button>
                </div>
            )}
        </div>
    )
}
