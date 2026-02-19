import { usePresupuestoWidget } from '../../../hooks/usePresupuesto'
import { useNavigate } from 'react-router-dom'
import { SemaforoBadge } from '../../atoms/SemaforoBadge'
import { CurrencyDisplay } from '../../atoms/CurrencyDisplay'
import { Target, Calendar, ArrowRight, TrendingDown, TrendingUp } from 'lucide-react'
import type { PresupuestoWidgetMes } from '../../../types/Presupuesto'

const barColors = {
    verde: { bar: 'bg-emerald-500', bg: 'bg-emerald-100', accent: 'border-emerald-200' },
    amarillo: { bar: 'bg-amber-500', bg: 'bg-amber-100', accent: 'border-amber-200' },
    rojo: { bar: 'bg-rose-500', bg: 'bg-rose-100', accent: 'border-rose-200' },
}

const ingresosBarColors = {
    verde: { bar: 'bg-emerald-400', bg: 'bg-emerald-50' },
    amarillo: { bar: 'bg-amber-400', bg: 'bg-amber-50' },
    rojo: { bar: 'bg-rose-400', bg: 'bg-rose-50' },
}

interface MonthIngresoData {
    presupuestado: number
    ejecutado: number
    porcentaje: number
    semaforo: 'verde' | 'amarillo' | 'rojo'
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
    ingresos?: MonthIngresoData
}

const MonthCard = ({
    mesNombre, presupuestado, ejecutado, porcentaje, semaforo,
    isCurrent, diasRestantes, compact = false, ingresos
}: MonthCardProps) => {
    const colors = barColors[semaforo] || barColors.verde

    // Net calculations
    const hasIngresos = ingresos && ingresos.presupuestado > 0
    const netoReal = hasIngresos ? ingresos.ejecutado - ejecutado : 0
    const netoPpto = hasIngresos ? ingresos.presupuestado - presupuestado : 0
    const diferenciaNeta = netoReal - netoPpto
    const netoMejor = diferenciaNeta >= 0

    return (
        <div className={`
            bg-white rounded-xl border p-3.5 transition-all
            ${isCurrent ? `border-2 ${colors.accent} shadow-md` : 'border-gray-100 shadow-sm'}
        `}>
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    {isCurrent && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
                    <h4 className={`font-bold ${isCurrent ? 'text-slate-900 text-sm' : 'text-slate-600 text-xs'}`}>
                        {mesNombre}
                    </h4>
                </div>
                <SemaforoBadge valor={semaforo} size="sm" />
            </div>

            {/* ── EGRESOS section ── */}
            <div className="mb-2.5">
                <div className="flex items-center gap-1 mb-1">
                    <TrendingDown size={11} className="text-rose-400" />
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Egresos</span>
                </div>
                <div className={`w-full ${isCurrent ? 'h-2.5' : 'h-2'} rounded-full ${colors.bg}`}>
                    <div
                        className={`h-full rounded-full ${colors.bar} transition-all duration-700`}
                        style={{ width: `${Math.min(porcentaje, 100)}%` }}
                    />
                </div>
                <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] font-mono text-slate-400">
                        <CurrencyDisplay value={ejecutado} colorize={false} decimals={0} compact={compact} />
                        <span className="text-slate-300"> / </span>
                        <CurrencyDisplay value={presupuestado} colorize={false} decimals={0} compact={compact} />
                    </span>
                    <span className="text-[10px] font-bold font-mono text-slate-500">{porcentaje.toFixed(0)}%</span>
                </div>
            </div>

            {/* ── INGRESOS section (if available) ── */}
            {hasIngresos && (
                <div className="mb-2.5">
                    <div className="flex items-center gap-1 mb-1">
                        <TrendingUp size={11} className="text-emerald-500" />
                        <span className="text-[10px] font-semibold text-slate-400 uppercase">Ingresos</span>
                    </div>
                    <div className={`w-full ${isCurrent ? 'h-2.5' : 'h-2'} rounded-full ${ingresosBarColors[ingresos.semaforo]?.bg || ingresosBarColors.verde.bg}`}>
                        <div
                            className={`h-full rounded-full ${ingresosBarColors[ingresos.semaforo]?.bar || ingresosBarColors.verde.bar} transition-all duration-700`}
                            style={{ width: `${Math.min(ingresos.porcentaje, 100)}%` }}
                        />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] font-mono text-slate-400">
                            <CurrencyDisplay value={ingresos.ejecutado} colorize={false} decimals={0} compact={compact} />
                            <span className="text-slate-300"> / </span>
                            <CurrencyDisplay value={ingresos.presupuestado} colorize={false} decimals={0} compact={compact} />
                        </span>
                        <span className="text-[10px] font-bold font-mono text-emerald-600">{ingresos.porcentaje.toFixed(0)}%</span>
                    </div>
                </div>
            )}

            {/* ── NETO summary (if both available) ── */}
            {hasIngresos && (
                <div className="border-t border-gray-100 pt-2 mt-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">Neto</span>
                        <span className={`text-[11px] font-bold font-mono ${netoReal >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                            <CurrencyDisplay value={netoReal} colorize={false} decimals={0} compact={compact} showPlusSign={netoReal > 0} />
                        </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[10px] text-slate-300">Ppto</span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-slate-400">
                                <CurrencyDisplay value={netoPpto} colorize={false} decimals={0} compact={compact} showPlusSign={netoPpto > 0} />
                            </span>
                            <span className={`text-[9px] font-bold ${netoMejor ? 'text-emerald-600' : 'text-rose-500'}`}>
                                {netoMejor ? '▲' : '▼'}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Days remaining (only current) */}
            {isCurrent && diasRestantes !== undefined && (
                <div className="flex items-center justify-center gap-1 mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-400">
                    <Calendar size={11} />
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
    const { data: widgetEgresos, isLoading: loadingEgresos } = usePresupuestoWidget({
        centros_costos_excluidos: centrosExcluidos?.length ? centrosExcluidos : undefined,
    })
    const { data: widgetIngresos, isLoading: loadingIngresos } = usePresupuestoWidget({
        centros_costos_excluidos: centrosExcluidos?.length ? centrosExcluidos : undefined,
        direccion: 'ingreso',
    })
    const navigate = useNavigate()

    const isLoading = loadingEgresos || loadingIngresos

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

    if (!widgetEgresos || !widgetEgresos.tiene_presupuesto) {
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

    // Build ingreso lookup by mes_nombre
    const ingresosMap = new Map<string, PresupuestoWidgetMes>()
    if (widgetIngresos?.tiene_presupuesto) {
        widgetIngresos.meses?.forEach(m => ingresosMap.set(m.mes_nombre, m))
        // Add current month from widget top-level
        if (widgetIngresos.mes_nombre) {
            ingresosMap.set(widgetIngresos.mes_nombre, {
                mes: 0,
                mes_nombre: widgetIngresos.mes_nombre,
                presupuestado: widgetIngresos.presupuesto_mes_actual,
                ejecutado: widgetIngresos.ejecutado_mes_actual,
                porcentaje: widgetIngresos.porcentaje_consumido,
                semaforo: widgetIngresos.semaforo,
            })
        }
    }

    // Build month array from egresos widget
    const allMonths: (PresupuestoWidgetMes & { isCurrent?: boolean; diasRestantes?: number; ingresos?: MonthIngresoData })[] = []
    const prevMonths = (widgetEgresos.meses || []).filter(m => m.mes_nombre !== widgetEgresos.mes_nombre)
    prevMonths.forEach(m => {
        const ing = ingresosMap.get(m.mes_nombre)
        allMonths.push({
            ...m,
            ingresos: ing ? { presupuestado: ing.presupuestado, ejecutado: ing.ejecutado, porcentaje: ing.porcentaje, semaforo: ing.semaforo } : undefined,
        })
    })

    const currentIng = ingresosMap.get(widgetEgresos.mes_nombre)
    allMonths.push({
        mes: 0,
        mes_nombre: widgetEgresos.mes_nombre,
        presupuestado: widgetEgresos.presupuesto_mes_actual,
        ejecutado: widgetEgresos.ejecutado_mes_actual,
        porcentaje: widgetEgresos.porcentaje_consumido,
        semaforo: widgetEgresos.semaforo,
        isCurrent: true,
        diasRestantes: widgetEgresos.dias_restantes,
        ingresos: currentIng ? { presupuestado: currentIng.presupuestado, ejecutado: currentIng.ejecutado, porcentaje: currentIng.porcentaje, semaforo: currentIng.semaforo } : undefined,
    })

    const monthCount = allMonths.length

    return (
        <div
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate('/reportes/presupuesto-vs-real')}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
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
                        ingresos={m.ingresos}
                    />
                ))}
            </div>
        </div>
    )
}
