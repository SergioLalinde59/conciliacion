import { usePresupuestoWidget } from '../../../hooks/usePresupuesto'
import { useNavigate } from 'react-router-dom'
import { SemaforoBadge } from '../../atoms/SemaforoBadge'
import { CurrencyDisplay } from '../../atoms/CurrencyDisplay'
import { Target, Calendar, ArrowRight } from 'lucide-react'
import type { PresupuestoWidgetMes } from '../../../types/Presupuesto'

const barColors = {
    verde: { bar: 'bg-emerald-500', bg: 'bg-emerald-100', accent: 'border-emerald-200' },
    amarillo: { bar: 'bg-amber-500', bg: 'bg-amber-100', accent: 'border-amber-200' },
    rojo: { bar: 'bg-rose-500', bg: 'bg-rose-100', accent: 'border-rose-200' },
}

interface MonthCardProps {
    mesNombre: string
    presupuestado: number
    ejecutado: number
    porcentaje: number
    semaforo: 'verde' | 'amarillo' | 'rojo'
    isCurrent?: boolean
    diasRestantes?: number
    compact?: boolean
}

const MonthCard = ({ mesNombre, presupuestado, ejecutado, porcentaje, semaforo, isCurrent, diasRestantes, compact = false }: MonthCardProps) => {
    const colors = barColors[semaforo] || barColors.verde

    return (
        <div className={`
            bg-white rounded-xl border p-5 transition-all
            ${isCurrent ? `border-2 ${colors.accent} shadow-md` : 'border-gray-100 shadow-sm'}
        `}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    {isCurrent && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
                    <h4 className={`font-bold ${isCurrent ? 'text-slate-900 text-base' : 'text-slate-600 text-sm'}`}>
                        {mesNombre}
                    </h4>
                </div>
                <SemaforoBadge valor={semaforo} size="sm" />
            </div>

            {/* Progress bar */}
            <div className={`w-full ${isCurrent ? 'h-4' : 'h-3'} rounded-full ${colors.bg} mb-3`}>
                <div
                    className={`h-full rounded-full ${colors.bar} transition-all duration-700`}
                    style={{ width: `${Math.min(porcentaje, 100)}%` }}
                />
            </div>

            {/* Percentage */}
            <div className="text-center mb-3">
                <span className={`font-mono font-black ${isCurrent ? 'text-2xl' : 'text-xl'} text-slate-800`}>
                    {porcentaje.toFixed(0)}%
                </span>
            </div>

            {/* Amounts */}
            <div className="space-y-1">
                <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Ejecutado</span>
                    <span className="font-mono font-bold text-slate-700">
                        <CurrencyDisplay value={ejecutado} colorize={false} decimals={0} compact={compact} />
                    </span>
                </div>
                <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Presupuesto</span>
                    <span className="font-mono font-bold text-slate-500">
                        <CurrencyDisplay value={presupuestado} colorize={false} decimals={0} compact={compact} />
                    </span>
                </div>
            </div>

            {/* Days remaining (only current) */}
            {isCurrent && diasRestantes !== undefined && (
                <div className="flex items-center justify-center gap-1 mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-400">
                    <Calendar size={12} />
                    <span className="font-semibold">{diasRestantes} días restantes</span>
                </div>
            )}
        </div>
    )
}

interface DashboardBudget3MonthsProps {
    centrosExcluidos?: number[]
    compact?: boolean
}

export const DashboardBudget3Months = ({ centrosExcluidos, compact = false }: DashboardBudget3MonthsProps) => {
    const { data: widget, isLoading } = usePresupuestoWidget({
        centros_costos_excluidos: centrosExcluidos?.length ? centrosExcluidos : undefined,
    })
    const navigate = useNavigate()

    if (isLoading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-48 mb-6" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-48 bg-gray-100 rounded-xl" />
                    ))}
                </div>
            </div>
        )
    }

    if (!widget || !widget.tiene_presupuesto) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-slate-50 text-slate-400 rounded-lg"><Target className="w-5 h-5" /></div>
                    <h3 className="font-bold text-slate-800">Presupuesto</h3>
                </div>
                <p className="text-sm text-gray-400">No hay presupuesto activo para este año.</p>
                <button
                    onClick={() => navigate('/presupuestos')}
                    className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                    Crear presupuesto <ArrowRight size={14} />
                </button>
            </div>
        )
    }

    // Build month array from widget: mes corrido (Jan=1, Feb=2, Mar+=3 sliding)
    const allMonths: (PresupuestoWidgetMes & { isCurrent?: boolean; diasRestantes?: number })[] = []
    const prevMonths = (widget.meses || []).filter(m => m.mes_nombre !== widget.mes_nombre)
    prevMonths.forEach(m => allMonths.push(m))
    allMonths.push({
        mes: 0,
        mes_nombre: widget.mes_nombre,
        presupuestado: widget.presupuesto_mes_actual,
        ejecutado: widget.ejecutado_mes_actual,
        porcentaje: widget.porcentaje_consumido,
        semaforo: widget.semaforo,
        isCurrent: true,
        diasRestantes: widget.dias_restantes,
    })

    const monthCount = allMonths.length

    return (
        <div
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate('/reportes/presupuesto-vs-real')}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <Target className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-slate-800">
                        Presupuesto {monthCount === 1 ? `— ${allMonths[0].mes_nombre}` : `— Últimos ${monthCount} Meses`}
                    </h3>
                </div>
                <span className="text-xs text-slate-400 flex items-center gap-1 hover:text-blue-600">
                    Ver detalle <ArrowRight size={14} />
                </span>
            </div>

            {/* Month Cards */}
            <div className={`grid grid-cols-1 ${monthCount >= 3 ? 'md:grid-cols-3' : monthCount === 2 ? 'md:grid-cols-2' : 'md:grid-cols-1 max-w-sm'} gap-4`}>
                {allMonths.map((m) => (
                    <MonthCard
                        key={m.mes_nombre}
                        mesNombre={m.mes_nombre}
                        presupuestado={m.presupuestado}
                        ejecutado={m.ejecutado}
                        porcentaje={m.porcentaje}
                        semaforo={m.semaforo}
                        isCurrent={m.isCurrent}
                        diasRestantes={m.diasRestantes}
                        compact={compact}
                    />
                ))}
            </div>
        </div>
    )
}
