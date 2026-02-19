import { usePresupuestoWidget } from '../../../hooks/usePresupuesto'
import { useNavigate } from 'react-router-dom'
import { SemaforoBadge } from '../../atoms/SemaforoBadge'
import { CurrencyDisplay } from '../../atoms/CurrencyDisplay'
import { Target, Calendar, ArrowRight } from 'lucide-react'
import { useSettings } from '../../../context/SettingsContext'
import type { PresupuestoWidgetMes } from '../../../types/Presupuesto'

interface DashboardBudgetWidgetProps {
    centrosCostosExcluidos?: number[]
    centroCostoId?: string
    conceptoId?: string
    terceroId?: string
}

const barColors = {
    verde: { bar: 'bg-emerald-500', bg: 'bg-emerald-100' },
    amarillo: { bar: 'bg-amber-500', bg: 'bg-amber-100' },
    rojo: { bar: 'bg-rose-500', bg: 'bg-rose-100' },
}

const MiniMesBar = ({ mes, compact }: { mes: PresupuestoWidgetMes; compact?: boolean }) => {
    const colors = barColors[mes.semaforo] || barColors.verde
    return (
        <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-gray-500 truncate">{mes.mes_nombre}</span>
                <span className="text-[10px] font-mono font-bold text-gray-600">{mes.porcentaje.toFixed(0)}%</span>
            </div>
            <div className={`w-full h-1.5 rounded-full ${colors.bg}`}>
                <div
                    className={`h-full rounded-full ${colors.bar} transition-all duration-500`}
                    style={{ width: `${Math.min(mes.porcentaje, 100)}%` }}
                />
            </div>
            <div className="flex justify-between mt-0.5">
                <span className="text-[9px] text-gray-400 font-mono">
                    <CurrencyDisplay value={mes.ejecutado} colorize={false} decimals={0} compact={compact} />
                </span>
                <span className="text-[9px] text-gray-400 font-mono">
                    <CurrencyDisplay value={mes.presupuestado} colorize={false} decimals={0} compact={compact} />
                </span>
            </div>
        </div>
    )
}

export const DashboardBudgetWidget = ({ centrosCostosExcluidos, centroCostoId, conceptoId, terceroId }: DashboardBudgetWidgetProps) => {
    const { cifrasEnMillones } = useSettings()
    const { data: widget, isLoading } = usePresupuestoWidget({
        centros_costos_excluidos: centrosCostosExcluidos?.length ? centrosCostosExcluidos : undefined,
        centro_costo_id: centroCostoId ? Number(centroCostoId) : undefined,
        concepto_id: conceptoId ? Number(conceptoId) : undefined,
        tercero_id: terceroId ? Number(terceroId) : undefined,
    })
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
    const colors = barColors[widget.semaforo] || barColors.verde

    // Meses anteriores (excluir el actual que ya se muestra prominente)
    const mesesAnteriores = (widget.meses || []).filter(m => m.mes_nombre !== widget.mes_nombre)

    return (
        <div
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate('/reportes/presupuesto-vs-real')}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Target className="w-5 h-5" /></div>
                    <h3 className="font-bold text-slate-800 text-sm">Presupuesto {widget.mes_nombre}</h3>
                </div>
                <SemaforoBadge valor={widget.semaforo} variacionPct={pct - 100} size="sm" />
            </div>

            {/* Barra de progreso mes actual */}
            <div className={`w-full h-3 rounded-full ${colors.bg} mb-3`}>
                <div
                    className={`h-full rounded-full ${colors.bar} transition-all duration-500`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                />
            </div>

            {/* Montos mes actual */}
            <div className="flex justify-between text-xs mb-2">
                <div>
                    <span className="text-gray-400">Ejecutado: </span>
                    <span className="font-mono font-bold text-slate-700">
                        <CurrencyDisplay value={widget.ejecutado_mes_actual} colorize={false} decimals={0} compact={cifrasEnMillones} />
                    </span>
                </div>
                <div>
                    <span className="text-gray-400">Presup.: </span>
                    <span className="font-mono font-bold text-slate-700">
                        <CurrencyDisplay value={widget.presupuesto_mes_actual} colorize={false} decimals={0} compact={cifrasEnMillones} />
                    </span>
                </div>
            </div>

            {/* Footer mes actual */}
            <div className="flex items-center justify-between text-[10px] text-gray-400 pt-2 border-t border-gray-50">
                <span className="font-bold">{pct.toFixed(0)}% consumido</span>
                <span className="flex items-center gap-1"><Calendar size={10} />{widget.dias_restantes} días restantes</span>
            </div>

            {/* Meses anteriores */}
            {mesesAnteriores.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex gap-4">
                        {mesesAnteriores.map(m => (
                            <MiniMesBar key={m.mes} mes={m} compact={cifrasEnMillones} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
