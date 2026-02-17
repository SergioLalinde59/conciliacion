import { Check, AlertTriangle, X, Eye } from 'lucide-react'
import { formatCompact } from '../../utils/formatters'
import type { ComparacionPresupuesto } from '../../types/Presupuesto'

const barGradient: Record<string, string> = {
    verde: 'bg-gradient-to-r from-emerald-300 to-emerald-400',
    amarillo: 'bg-gradient-to-r from-amber-300 to-amber-400',
    rojo: 'bg-gradient-to-r from-rose-300 to-rose-400',
}

const markerBorder: Record<string, string> = {
    verde: 'border-emerald-400',
    amarillo: 'border-amber-400',
    rojo: 'border-rose-400',
}

const badgeStyle: Record<string, { bg: string; icon: React.ReactNode }> = {
    verde: { bg: 'bg-emerald-400', icon: <Check className="w-3 h-3 text-white" strokeWidth={3} /> },
    amarillo: { bg: 'bg-amber-400', icon: <AlertTriangle className="w-3 h-3 text-white" strokeWidth={3} /> },
    rojo: { bg: 'bg-rose-400', icon: <X className="w-3 h-3 text-white" strokeWidth={3} /> },
}

interface BudgetBarRowProps {
    cc: ComparacionPresupuesto & { cumPct: number; cumValue: number }
    onClick: () => void
}

export const BudgetBarRow = ({ cc, onClick }: BudgetBarRowProps) => {
    const consumo = cc.presupuestado > 0
        ? Math.round((cc.ejecutado / cc.presupuestado) * 100)
        : (cc.ejecutado > 0 ? 999 : 0)

    const isOver = cc.ejecutado > cc.presupuestado && cc.presupuestado > 0
    const semaforo = isOver ? 'rojo' : (cc.semaforo || 'verde')
    const fillPct = cc.presupuestado > 0
        ? Math.min((cc.ejecutado / cc.presupuestado) * 100, 100)
        : (cc.ejecutado > 0 ? 100 : 0)

    const gradient = barGradient[semaforo] || barGradient.verde
    const marker = markerBorder[semaforo] || markerBorder.verde
    const badge = badgeStyle[semaforo] || badgeStyle.verde

    return (
        <div
            className="group cursor-pointer py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors px-1"
            onClick={onClick}
        >
            {/* Line 1: Eye + ID - Name (1/3) + financial data (2/3) */}
            <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all shrink-0">
                    <Eye className="w-3.5 h-3.5" />
                </div>
                <span className="w-[240px] text-sm font-semibold text-slate-700 truncate shrink-0">
                    {cc.id} - {cc.nombre}
                </span>
                <div className="flex items-center text-xs text-slate-500">
                    <span className="w-[80px]">
                        Ppto <span className="font-mono font-semibold text-blue-600">{formatCompact(cc.presupuestado)}</span>
                    </span>
                    <span className="text-slate-300 mx-2">|</span>
                    <span className="w-[120px]">
                        Ejec <span className="font-mono font-semibold text-rose-600">{formatCompact(cc.ejecutado)}</span>
                        <span className="ml-1 text-slate-300">-</span>
                        <span className="ml-1 font-bold text-slate-600">{consumo}%</span>
                    </span>
                    <span className="text-slate-300 mx-2">|</span>
                    <span className="w-[120px]">
                        Var <span className={`font-mono font-semibold ${cc.variacion >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{cc.variacion >= 0 ? '' : '-'}{formatCompact(Math.abs(cc.variacion))}</span>
                        <span className="ml-1 text-slate-300">-</span>
                        <span className="ml-1 font-bold text-slate-600">{Math.round(cc.variacion_pct)}%</span>
                    </span>
                    <span className="text-slate-300 mx-2">|</span>
                    <span className="w-[120px]">
                        Acum <span className="font-mono font-semibold text-blue-600">{formatCompact(cc.cumValue)}</span>
                        <span className="ml-1 text-slate-300">-</span>
                        <span className="ml-1 font-bold text-slate-700">{cc.cumPct}%</span>
                    </span>
                </div>
            </div>

            {/* Line 2: Progress bar + circle marker + semaphore badge */}
            <div className="flex items-center gap-2.5">
                <div className="flex-1 relative h-3">
                    {/* Track */}
                    <div className="absolute inset-0 bg-gray-100 rounded-full" />
                    {/* Fill */}
                    <div
                        className={`absolute inset-y-0 left-0 ${gradient} rounded-full transition-all duration-700 ease-out`}
                        style={{ width: `${Math.max(fillPct, 2)}%` }}
                    />
                    {/* Circle marker */}
                    <div
                        className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 ${marker} shadow-sm transition-all duration-700`}
                        style={{ left: `calc(${fillPct}% - 8px)` }}
                    />
                </div>
                {/* Semaphore badge */}
                <div className={`w-6 h-6 rounded-full ${badge.bg} flex items-center justify-center shrink-0 shadow-sm`}>
                    {badge.icon}
                </div>
            </div>
        </div>
    )
}
