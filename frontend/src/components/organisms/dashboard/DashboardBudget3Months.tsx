import { usePresupuestoWidget } from '../../../hooks/usePresupuesto'
import { useNavigate } from 'react-router-dom'
import { SemaphoreProgressBar } from '../../atoms/SemaphoreProgressBar'
import type { SemaphoreStatus } from '../../atoms/SemaphoreProgressBar'
import { CurrencyDisplay } from '../../atoms/CurrencyDisplay'
import { Target, Calendar, ArrowRight, TrendingDown, TrendingUp, Scale } from 'lucide-react'
import type { PresupuestoWidgetMes } from '../../../types/Presupuesto'

const accentBorder: Record<SemaphoreStatus, string> = {
    verde: 'border-emerald-200',
    amarillo: 'border-amber-200',
    rojo: 'border-rose-200',
}

interface MonthIngresoData {
    presupuestado: number
    ejecutado: number
    porcentaje: number
    semaforo: SemaphoreStatus
}

/** Calculate neto semaphore: inverted logic (more is better) */
const calcNetoSemaforo = (netoReal: number, netoPpto: number): SemaphoreStatus => {
    if (netoReal >= netoPpto) return 'verde'
    if (netoPpto !== 0 && netoReal >= netoPpto * 0.9) return 'amarillo'
    return 'rojo'
}

const calcNetoPct = (netoReal: number, netoPpto: number): number => {
    if (netoPpto > 0) return (netoReal / netoPpto) * 100
    if (netoPpto === 0) return netoReal >= 0 ? 100 : 0
    // netoPpto < 0 (expected deficit): less negative is better
    return netoPpto !== 0 ? (netoReal / netoPpto) * 100 : 0
}

interface MetricRowProps {
    label: string
    icon: React.ReactNode
    fillPct: number
    status: SemaphoreStatus
    ejecutado: number
    presupuestado: number
    compact?: boolean
    showPlusSign?: boolean
}

const pctColor: Record<SemaphoreStatus, string> = {
    verde: 'text-emerald-600',
    amarillo: 'text-amber-600',
    rojo: 'text-rose-500',
}

const MetricRow = ({ label, icon, fillPct, status, ejecutado, presupuestado, compact, showPlusSign }: MetricRowProps) => (
    <div className="space-y-1">
        {/* Label + Values on same line */}
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
                {icon}
                <span className="text-xs font-semibold text-slate-500 min-w-[4rem]">{label}</span>
                <div className="text-xs font-mono text-slate-600 flex items-center gap-0.5 ml-2">
                    <CurrencyDisplay value={ejecutado} colorize={false} decimals={0} compact={compact} showPlusSign={showPlusSign} />
                    <span className="text-slate-300">|</span>
                    <CurrencyDisplay value={presupuestado} colorize={false} decimals={0} compact={compact} showPlusSign={showPlusSign} />
                    <span className="text-slate-300">|</span>
                    <span className={`text-xs font-bold ${pctColor[status]}`}>
                        {Math.round(fillPct)}%
                    </span>
                </div>
            </div>
        </div>
        {/* Bar below */}
        <SemaphoreProgressBar
            fillPct={Math.min(fillPct, 100)}
            status={status}
            heightClass="h-2"
            showMarker={true}
            showBadge={true}
        />
    </div>
)

interface MonthSectionProps {
    mesNombre: string
    presupuestado: number
    ejecutado: number
    porcentaje: number
    semaforo: SemaphoreStatus
    isCurrent?: boolean
    diasRestantes?: number
    compact?: boolean
    ingresos?: MonthIngresoData
}

const MonthSection = ({
    mesNombre, presupuestado, ejecutado, porcentaje, semaforo,
    isCurrent, diasRestantes, compact = false, ingresos
}: MonthSectionProps) => {
    const hasIngresos = ingresos && ingresos.presupuestado > 0

    // Neto calculations
    const netoReal = hasIngresos ? ingresos.ejecutado - ejecutado : 0
    const netoPpto = hasIngresos ? ingresos.presupuestado - presupuestado : 0
    const netoSemaforo = hasIngresos ? calcNetoSemaforo(netoReal, netoPpto) : 'verde' as SemaphoreStatus
    const netoPct = hasIngresos ? calcNetoPct(netoReal, netoPpto) : 0

    return (
        <div className={`
            rounded-xl border p-4 transition-all
            ${isCurrent ? `border-2 ${accentBorder[semaforo]} bg-white shadow-md` : 'border-gray-100 bg-gray-50/50 shadow-sm'}
        `}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    {isCurrent && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
                    <h4 className={`font-bold ${isCurrent ? 'text-slate-900 text-sm' : 'text-slate-600 text-sm'}`}>
                        {mesNombre}
                    </h4>
                </div>
                {isCurrent && diasRestantes !== undefined && (
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Calendar size={12} />
                        <span className="font-semibold">{diasRestantes} días restantes</span>
                    </div>
                )}
            </div>

            {/* Metric Rows */}
            <div className="space-y-2.5">
                {/* Ingresos */}
                {hasIngresos && (
                    <MetricRow
                        label="Ingresos"
                        icon={<TrendingUp size={13} className="text-emerald-500" />}
                        fillPct={ingresos.porcentaje}
                        status={ingresos.semaforo}
                        ejecutado={ingresos.ejecutado}
                        presupuestado={ingresos.presupuestado}
                        compact={compact}
                    />
                )}

                {/* Egresos */}
                <MetricRow
                    label="Egresos"
                    icon={<TrendingDown size={13} className="text-rose-400" />}
                    fillPct={porcentaje}
                    status={semaforo}
                    ejecutado={ejecutado}
                    presupuestado={presupuestado}
                    compact={compact}
                />

                {/* Neto */}
                {hasIngresos && (
                    <>
                        <div className="border-t border-gray-200/60 my-1" />
                        <MetricRow
                            label="Neto"
                            icon={<Scale size={13} className="text-blue-500" />}
                            fillPct={netoPct}
                            status={netoSemaforo}
                            ejecutado={netoReal}
                            presupuestado={netoPpto}
                            compact={compact}
                            showPlusSign
                        />
                    </>
                )}
            </div>
        </div>
    )
}

interface DashboardBudget3MonthsProps {
    centrosExcluidos?: number[]
    centrosIncluidos?: number[]
    compact?: boolean
}

export const DashboardBudget3Months = ({ centrosExcluidos, centrosIncluidos, compact = false }: DashboardBudget3MonthsProps) => {
    const { data: widgetEgresos, isLoading: loadingEgresos } = usePresupuestoWidget({
        centros_costos_excluidos: centrosExcluidos?.length ? centrosExcluidos : undefined,
        centros_costos_incluidos: centrosIncluidos?.length ? centrosIncluidos : undefined,
    })
    const { data: widgetIngresos, isLoading: loadingIngresos } = usePresupuestoWidget({
        centros_costos_excluidos: centrosExcluidos?.length ? centrosExcluidos : undefined,
        centros_costos_incluidos: centrosIncluidos?.length ? centrosIncluidos : undefined,
        direccion: 'ingreso',
    })
    const navigate = useNavigate()

    const isLoading = loadingEgresos || loadingIngresos

    if (isLoading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-48 mb-6" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2].map(i => (
                        <div key={i} className="h-40 bg-gray-100 rounded-xl" />
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

            {/* Month Sections - horizontal grid */}
            <div className={`grid grid-cols-1 ${monthCount >= 3 ? 'md:grid-cols-3' : monthCount === 2 ? 'md:grid-cols-2' : 'md:grid-cols-1 max-w-lg'} gap-4`}>
                {allMonths.map((m) => (
                    <MonthSection
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
