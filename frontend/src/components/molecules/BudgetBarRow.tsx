import { Eye } from 'lucide-react'
import { useBudgetFormat } from '../atoms/CurrencyDisplay'
import { SemaphoreProgressBar } from '../atoms/SemaphoreProgressBar'
import type { SemaphoreStatus } from '../atoms/SemaphoreProgressBar'
import type { ComparacionPresupuesto } from '../../types/Presupuesto'

interface BudgetBarRowProps {
    cc: ComparacionPresupuesto & { cumPct: number; cumValue: number }
    onClick: () => void
    direccion?: string
}

export const BudgetBarRow = ({ cc, onClick, direccion }: BudgetBarRowProps) => {
    const fmt = useBudgetFormat()
    const consumo = cc.presupuestado > 0
        ? Math.round((cc.ejecutado / cc.presupuestado) * 100)
        : (cc.ejecutado > 0 ? 999 : 0)

    const isOver = cc.ejecutado > cc.presupuestado && cc.presupuestado > 0
    // For income, the backend already inverts the semaphore, so trust cc.semaforo directly
    const semaforo: SemaphoreStatus = direccion === 'ingreso'
        ? (cc.semaforo || 'verde')
        : (isOver ? 'rojo' : (cc.semaforo || 'verde'))
    const fillPct = cc.presupuestado > 0
        ? Math.min((cc.ejecutado / cc.presupuestado) * 100, 100)
        : (cc.ejecutado > 0 ? 100 : 0)

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
                <span className="w-[240px] text-sm font-semibold text-slate-700 truncate shrink-0 flex items-center gap-1.5">
                    {cc.id} - {cc.nombre}
                    {cc.presupuestado === 0 && cc.ejecutado > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-600 shrink-0">
                            SIN PPTO
                        </span>
                    )}
                </span>
                <div className="flex items-center text-xs text-slate-500">
                    <span className="w-[80px]">
                        Ppto <span className="font-mono font-semibold text-blue-600">{fmt(cc.presupuestado)}</span>
                    </span>
                    <span className="text-slate-300 mx-2">|</span>
                    <span className="w-[120px]">
                        Ejec <span className="font-mono font-semibold text-rose-600">{fmt(cc.ejecutado)}</span>
                        <span className="ml-1 text-slate-300">-</span>
                        <span className="ml-1 font-bold text-slate-600">{consumo}%</span>
                    </span>
                    <span className="text-slate-300 mx-2">|</span>
                    <span className="w-[120px]">
                        Var <span className={`font-mono font-semibold ${cc.variacion >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{cc.variacion >= 0 ? '' : '-'}{fmt(Math.abs(cc.variacion))}</span>
                        <span className="ml-1 text-slate-300">-</span>
                        <span className="ml-1 font-bold text-slate-600">{Math.round(cc.variacion_pct)}%</span>
                    </span>
                    <span className="text-slate-300 mx-2">|</span>
                    <span className="w-[120px]">
                        Acum <span className="font-mono font-bold text-indigo-600">{fmt(cc.cumValue)}</span>
                        <span className="ml-1 text-slate-300">-</span>
                        <span className="ml-1 font-bold text-indigo-700">{cc.cumPct}%</span>
                    </span>
                </div>
            </div>

            {/* Line 2: Progress bar with semaphore */}
            <SemaphoreProgressBar fillPct={fillPct} status={semaforo} />
        </div>
    )
}
