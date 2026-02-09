import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { StatCard } from '../molecules/StatCard'
import type { CurrencyType } from '../atoms/CurrencyDisplay'

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
    currency?: CurrencyType
}

export const EstadisticasTotales = ({
    ingresos,
    egresos,
    saldo,
    ingresosAnterior,
    egresosAnterior,
    saldoAnterior,
    comparativaAnterior,
    currency = 'COP'
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

    const suffix = currency !== 'COP' ? ` (${currency})` : ''

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
            <StatCard
                label={`Total Ingresos${suffix}`}
                value={ingresos}
                trend={trendIngresos}
                icon={<TrendingUp className="w-5 h-5" />}
                colorClass="text-emerald-600"
                bgColorClass="bg-emerald-50"
                borderColor="group-hover:border-emerald-200"
                currency={currency}
            />
            <StatCard
                label={`Total Egresos${suffix}`}
                value={egresos}
                trend={trendEgresos}
                isEgreso
                icon={<TrendingDown className="w-5 h-5" />}
                colorClass="text-rose-600"
                bgColorClass="bg-rose-50"
                borderColor="group-hover:border-rose-200"
                currency={currency}
            />
            <StatCard
                label={`Saldo Neto${suffix}`}
                value={saldo}
                trend={trendSaldo}
                icon={<Wallet className="w-5 h-5" />}
                colorClass={saldo >= 0 ? "text-indigo-600" : "text-rose-600"}
                bgColorClass="bg-indigo-50"
                borderColor="group-hover:border-indigo-200"
                currency={currency}
            />
        </div>
    )
}
