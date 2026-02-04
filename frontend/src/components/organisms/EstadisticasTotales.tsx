import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { CurrencyDisplay } from '../atoms/CurrencyDisplay'

interface Comparativa {
    ingresos: number
    egresos: number
    saldo: number
}

interface EstadisticasTotalesProps {
    ingresos: number
    egresos: number
    saldo: number
    ingresosAnterior?: number
    egresosAnterior?: number
    saldoAnterior?: number
    comparativaAnterior?: Comparativa | null
}

export const EstadisticasTotales = ({
    ingresos,
    egresos,
    saldo,
    ingresosAnterior,
    egresosAnterior,
    saldoAnterior,
    comparativaAnterior
}: EstadisticasTotalesProps) => {

    const prevIngresos = comparativaAnterior?.ingresos ?? ingresosAnterior
    const prevEgresos = comparativaAnterior?.egresos ?? egresosAnterior
    const prevSaldo = comparativaAnterior?.saldo ?? saldoAnterior

    const calculateTrend = (current: number, previous?: number) => {
        if (previous === undefined || previous === null || previous === 0) return null
        return ((current - previous) / Math.abs(previous)) * 100
    }

    const trendIngresos = calculateTrend(ingresos, prevIngresos)
    const trendEgresos = calculateTrend(egresos, prevEgresos)
    const trendSaldo = calculateTrend(saldo, prevSaldo)

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
            <StatCard
                label="Total Ingresos"
                value={ingresos}
                trend={trendIngresos}
                icon={<TrendingUp className="w-5 h-5" />}
                colorClass="text-emerald-600"
                bgColorClass="bg-emerald-50"
                borderColor="group-hover:border-emerald-200"
            />
            <StatCard
                label="Total Egresos"
                value={egresos}
                trend={trendEgresos}
                isEgreso
                icon={<TrendingDown className="w-5 h-5" />}
                colorClass="text-rose-600"
                bgColorClass="bg-rose-50"
                borderColor="group-hover:border-rose-200"
            />
            <StatCard
                label="Saldo Neto"
                value={saldo}
                trend={trendSaldo}
                icon={<Wallet className="w-5 h-5" />}
                colorClass={saldo >= 0 ? "text-indigo-600" : "text-rose-600"}
                bgColorClass="bg-indigo-50"
                borderColor="group-hover:border-indigo-200"
            />
        </div>
    )
}

const StatCard = ({ label, value, trend, icon, colorClass, bgColorClass, borderColor, isEgreso = false }: any) => {
    const isPositive = trend > 0
    const isNearZero = Math.abs(trend ?? 0) < 0.1

    // For egresos, an increase is "bad" (red), decrease is "good" (green)
    // For others, increase is "good" (green), decrease is "bad" (red)
    let trendColor = ""
    if (isEgreso) {
        trendColor = isPositive ? "text-rose-500 bg-rose-50" : "text-emerald-500 bg-emerald-50"
    } else {
        trendColor = isPositive ? "text-emerald-500 bg-emerald-50" : "text-rose-500 bg-rose-50"
    }

    if (isNearZero || trend === null) trendColor = "text-slate-400 bg-slate-50"

    return (
        <div className={`group bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 flex items-center justify-between transition-all duration-300 hover:shadow-md ${borderColor}`}>
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                    {trend !== null && (
                        <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${trendColor}`}>
                            {isNearZero ? <Minus size={8} /> : isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                            {Math.abs(trend).toFixed(1)}%
                        </div>
                    )}
                </div>
                <div className={`text-2xl font-black font-mono tracking-tight ${colorClass}`}>
                    <CurrencyDisplay value={value} colorize={false} decimals={0} />
                </div>
                <div className="flex items-center gap-1 text-[9px] text-slate-400 font-medium">
                    <span className="w-1 h-1 rounded-full bg-slate-200" />
                    Periodo Actual
                </div>
            </div>
            <div className={`p-3.5 ${bgColorClass} ${colorClass} rounded-2xl group-hover:scale-110 transition-transform duration-300 shadow-sm shadow-inner`}>
                {icon}
            </div>
        </div>
    )
}
