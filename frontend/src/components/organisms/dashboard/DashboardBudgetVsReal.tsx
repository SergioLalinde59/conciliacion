import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, TrendingUp, TrendingDown } from 'lucide-react'
import { useBudgetFormat } from '../../atoms/CurrencyDisplay'
import type { ComparacionPresupuesto } from '../../../types/Presupuesto'

interface DashboardBudgetVsRealProps {
    dataEgresos: ComparacionPresupuesto[]
    dataIngresos: ComparacionPresupuesto[]
    presupuestoEgresos?: number
    presupuestoIngresos?: number
    egresosReales?: number
    ingresosReales?: number
    isLoading?: boolean
    maxItems?: number
}

const semaforoGradient: Record<string, string> = {
    verde: 'bg-gradient-to-r from-emerald-400 to-emerald-500',
    amarillo: 'bg-gradient-to-r from-amber-400 to-amber-500',
    rojo: 'bg-gradient-to-r from-rose-400 to-rose-500',
}

export const DashboardBudgetVsReal = ({
    dataEgresos, dataIngresos,
    isLoading, maxItems = 8
}: DashboardBudgetVsRealProps) => {
    const navigate = useNavigate()
    const fmt = useBudgetFormat()
    const [direccion, setDireccion] = useState<'egreso' | 'ingreso'>('egreso')
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
    const [titleHovered, setTitleHovered] = useState(false)

    const data = direccion === 'egreso' ? dataEgresos : dataIngresos

    // Unified CC order: merge both datasets so the same CC appears at the same row
    const unifiedOrder = useMemo(() => {
        const ccMap = new Map<string, { key: string; maxEjecutado: number }>()
        const merge = (list: ComparacionPresupuesto[]) => {
            list.filter(d => d.presupuestado > 0 || d.ejecutado > 0).forEach(d => {
                const key = d.id ? String(d.id) : d.nombre
                const prev = ccMap.get(key)
                ccMap.set(key, {
                    key,
                    maxEjecutado: Math.max(prev?.maxEjecutado ?? 0, d.ejecutado),
                })
            })
        }
        merge(dataEgresos ?? [])
        merge(dataIngresos ?? [])
        return [...ccMap.values()]
            .sort((a, b) => b.maxEjecutado - a.maxEjecutado)
            .slice(0, maxItems)
            .map(c => c.key)
    }, [dataEgresos, dataIngresos, maxItems])

    const items = useMemo(() => {
        if (!data?.length) return []
        const filtered = data.filter(d => d.presupuestado > 0 || d.ejecutado > 0)
        // Map CCs by their key for lookup
        const byKey = new Map(filtered.map(d => [d.id ? String(d.id) : d.nombre, d]))
        // Return items in unified order, skipping CCs not present in current direction
        return unifiedOrder
            .filter(key => byKey.has(key))
            .map(key => byKey.get(key)!)
    }, [data, unifiedOrder])

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
            direccion === 'egreso'
                ? (variPct <= 10 ? 'verde' : variPct <= 25 ? 'amarillo' : 'rojo')
                : (variPct >= -10 ? 'verde' : variPct >= -25 ? 'amarillo' : 'rojo')
        return { totalPpto, totalConPpto, totalSinPpto, variPct, semaforo }
    }, [data, direccion])

    const totalVisible = data
        ? data.filter(d => d.presupuestado > 0 || d.ejecutado > 0).length
        : 0
    const remaining = totalVisible - items.length

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
            {/* Header + Direction tabs */}
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-3">
                    <div
                        className="relative"
                        onMouseEnter={() => setTitleHovered(true)}
                        onMouseLeave={() => setTitleHovered(false)}
                    >
                        <h3 className="font-bold text-slate-800 cursor-default">Presupuesto vs Real</h3>
                        {titleHovered && summary && summary.totalPpto > 0 && (
                            <div className="absolute z-50 top-full left-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 px-4 py-3 whitespace-nowrap pointer-events-none">
                                <div className="font-semibold text-slate-800 text-sm mb-2">
                                    Resumen {direccion === 'egreso' ? 'Egresos' : 'Ingresos'}
                                </div>
                                <table className="text-[13px]">
                                    <tbody>
                                        <tr>
                                            <td className="pr-4 text-slate-500">Ejecutado</td>
                                            <td className="text-right font-mono font-bold text-slate-700">{fmt(summary.totalConPpto)}</td>
                                        </tr>
                                        <tr>
                                            <td className="pr-4 text-slate-500">Presupuesto</td>
                                            <td className="text-right font-mono text-slate-700">{fmt(summary.totalPpto)}</td>
                                        </tr>
                                        <tr>
                                            <td className="pr-4 text-slate-500">Variación</td>
                                            <td className={`text-right font-mono font-bold ${
                                                summary.semaforo === 'verde' ? 'text-emerald-600' :
                                                summary.semaforo === 'amarillo' ? 'text-amber-600' : 'text-rose-600'
                                            }`}>
                                                {summary.variPct > 0 ? '+' : ''}{summary.variPct.toFixed(1)}%
                                            </td>
                                        </tr>
                                        {summary.totalSinPpto > 0 && (
                                            <tr>
                                                <td className="pr-4 text-amber-500">Sin presupuesto</td>
                                                <td className="text-right font-mono font-bold text-amber-500">{fmt(summary.totalSinPpto)}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                                <div className="absolute left-8 -top-1.5 w-3 h-3 rotate-45 bg-white border-l border-t border-gray-200" />
                            </div>
                        )}
                    </div>
                    {dataIngresos.length > 0 && (
                        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
                            <button
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium transition-all ${
                                    direccion === 'egreso'
                                        ? 'bg-white shadow-sm text-slate-800'
                                        : 'text-slate-400 hover:text-slate-600'
                                }`}
                                onClick={() => setDireccion('egreso')}
                            >
                                <TrendingDown size={13} />
                                Egresos
                            </button>
                            <button
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium transition-all ${
                                    direccion === 'ingreso'
                                        ? 'bg-white shadow-sm text-slate-800'
                                        : 'text-slate-400 hover:text-slate-600'
                                }`}
                                onClick={() => setDireccion('ingreso')}
                            >
                                <TrendingUp size={13} />
                                Ingresos
                            </button>
                        </div>
                    )}
                </div>
                <button
                    onClick={() => navigate('/reportes/presupuesto-vs-real')}
                    className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1 font-medium transition-colors"
                >
                    Ver detalle <ArrowRight size={14} />
                </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">Por centro de costo</p>

            {/* CC rows */}
            {items.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                    Sin datos de presupuesto
                </div>
            ) : (
                <div className="space-y-3">
                    {items.map((item, idx) => {
                        const conPpto = item.ejecutado_con_ppto ?? item.ejecutado
                        const sinPpto = item.ejecutado_sin_ppto ?? 0
                        const ppto = item.presupuestado
                        const isOver = conPpto > ppto && ppto > 0
                        const fillPct = ppto > 0
                            ? Math.min((conPpto / ppto) * 100, 100)
                            : (conPpto > 0 ? 100 : 0)
                        const gradient = semaforoGradient[item.semaforo] || semaforoGradient.verde
                        const variPct = item.variacion_pct ?? (ppto > 0 ? ((conPpto - ppto) / ppto) * 100 : 0)

                        return (
                            <div
                                key={item.id ?? item.nombre}
                                className="relative cursor-pointer"
                                onMouseEnter={() => setHoveredIdx(idx)}
                                onMouseLeave={() => setHoveredIdx(null)}
                                onClick={() => navigate('/reportes/presupuesto-vs-real')}
                            >
                                <span className="text-sm font-semibold text-slate-700 truncate block mb-1">
                                    {item.id ? `${item.id} - ${item.nombre}` : item.nombre}
                                </span>
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

                                {/* Tooltip */}
                                {hoveredIdx === idx && (
                                    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white rounded-xl shadow-lg border border-gray-200 px-4 py-3 whitespace-nowrap pointer-events-none">
                                        <div className="font-semibold text-slate-800 text-sm mb-2">
                                            {item.id ? `${item.id} - ${item.nombre}` : item.nombre}
                                        </div>
                                        <table className="text-[13px]">
                                            <tbody>
                                                <tr>
                                                    <td className="pr-4 text-slate-500">Ejecutado</td>
                                                    <td className="text-right font-mono font-bold text-slate-700">{fmt(conPpto)}</td>
                                                </tr>
                                                <tr>
                                                    <td className="pr-4 text-slate-500">Presupuesto</td>
                                                    <td className="text-right font-mono text-slate-700">{fmt(ppto)}</td>
                                                </tr>
                                                <tr>
                                                    <td className="pr-4 text-slate-500">Variación</td>
                                                    <td className={`text-right font-mono font-bold ${
                                                        item.semaforo === 'verde' ? 'text-emerald-600' :
                                                        item.semaforo === 'amarillo' ? 'text-amber-600' : 'text-rose-600'
                                                    }`}>
                                                        {variPct > 0 ? '+' : ''}{variPct.toFixed(1)}%
                                                    </td>
                                                </tr>
                                                {sinPpto > 0 && (
                                                    <tr>
                                                        <td className="pr-4 text-amber-500">Sin presupuesto</td>
                                                        <td className="text-right font-mono font-bold text-amber-500">{fmt(sinPpto)}</td>
                                                    </tr>
                                                )}
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

            {/* Total */}
            {summary && summary.totalPpto > 0 && (
                <div className="flex justify-between items-center mt-5 pt-4 border-t border-gray-100">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Total {direccion === 'egreso' ? 'Egresos' : 'Ingresos'}
                    </span>
                    <span className="text-sm font-mono font-black text-slate-800">
                        {fmt(summary.totalConPpto)} / {fmt(summary.totalPpto)}
                        <span className={`ml-2 text-xs font-bold ${
                            summary.semaforo === 'verde' ? 'text-emerald-600' :
                            summary.semaforo === 'amarillo' ? 'text-amber-600' : 'text-rose-600'
                        }`}>
                            {summary.variPct > 0 ? '+' : ''}{summary.variPct.toFixed(1)}%
                        </span>
                    </span>
                </div>
            )}
        </div>
    )
}
