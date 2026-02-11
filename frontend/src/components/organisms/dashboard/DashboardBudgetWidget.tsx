import { usePresupuestoWidget } from '../../../hooks/usePresupuesto'
import { useNavigate } from 'react-router-dom'
import { SemaforoBadge } from '../../atoms/SemaforoBadge'
import { CurrencyDisplay } from '../../atoms/CurrencyDisplay'
import { Target, Calendar, ArrowRight } from 'lucide-react'

export const DashboardBudgetWidget = () => {
    const { data: widget, isLoading } = usePresupuestoWidget()
    const navigate = useNavigate()

    if (isLoading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
                <div className="h-8 bg-gray-200 rounded w-48 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-24" />
            </div>
        )
    }

    if (!widget || !widget.tiene_presupuesto) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
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

    const pct = widget.porcentaje_consumido
    const barColor = widget.semaforo === 'verde' ? 'bg-emerald-500' : widget.semaforo === 'amarillo' ? 'bg-amber-500' : 'bg-rose-500'
    const barBg = widget.semaforo === 'verde' ? 'bg-emerald-100' : widget.semaforo === 'amarillo' ? 'bg-amber-100' : 'bg-rose-100'

    return (
        <div
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate('/reportes/presupuesto-vs-real')}
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Target className="w-5 h-5" /></div>
                    <h3 className="font-bold text-slate-800 text-sm">Presupuesto {widget.mes_nombre}</h3>
                </div>
                <SemaforoBadge valor={widget.semaforo} variacionPct={pct - 100} size="sm" />
            </div>

            {/* Barra de progreso */}
            <div className={`w-full h-3 rounded-full ${barBg} mb-3`}>
                <div
                    className={`h-full rounded-full ${barColor} transition-all duration-500`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                />
            </div>

            {/* Montos */}
            <div className="flex justify-between text-xs mb-2">
                <div>
                    <span className="text-gray-400">Ejecutado: </span>
                    <span className="font-mono font-bold text-slate-700">
                        <CurrencyDisplay value={widget.ejecutado_mes_actual} colorize={false} decimals={0} />
                    </span>
                </div>
                <div>
                    <span className="text-gray-400">Presup.: </span>
                    <span className="font-mono font-bold text-slate-700">
                        <CurrencyDisplay value={widget.presupuesto_mes_actual} colorize={false} decimals={0} />
                    </span>
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-[10px] text-gray-400 pt-2 border-t border-gray-50">
                <span className="font-bold">{pct.toFixed(0)}% consumido</span>
                <span className="flex items-center gap-1"><Calendar size={10} />{widget.dias_restantes} días restantes</span>
            </div>
        </div>
    )
}
