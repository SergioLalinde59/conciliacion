import type { ReactNode } from 'react'
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { CurrencyDisplay, type CurrencyType } from '../atoms/CurrencyDisplay'

export interface StatCardProps {
    label: string
    value: number
    icon: ReactNode
    colorClass: string
    bgColorClass: string
    borderColor: string
    trend?: number | null
    isEgreso?: boolean
    secondaryValue?: number | null
    isCurrency?: boolean
    currency?: CurrencyType
    subtitle?: string
}

export const StatCard = ({
    label,
    value,
    trend,
    icon,
    colorClass,
    bgColorClass,
    borderColor,
    isEgreso = false,
    secondaryValue = null,
    isCurrency = true,
    currency = 'COP',
    subtitle
}: StatCardProps) => {
    const isPositive = (trend ?? 0) > 0
    const isNearZero = Math.abs(trend ?? 0) < 0.1

    let trendColor = ""
    if (isEgreso) {
        trendColor = isPositive ? "text-rose-500 bg-rose-50" : "text-emerald-500 bg-emerald-50"
    } else {
        trendColor = isPositive ? "text-emerald-500 bg-emerald-50" : "text-rose-500 bg-rose-50"
    }
    if (isNearZero || trend === null || trend === undefined) trendColor = "text-slate-400 bg-slate-50"

    const defaultSubtitle = secondaryValue !== null
        ? 'Visible / Total en Periodo'
        : 'Periodo Actual'

    return (
        <div className={`group bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col transition-all duration-300 hover:shadow-md ${borderColor}`}>
            <div className="flex items-start justify-between mb-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                <div className="flex items-center gap-2">
                    {typeof trend === 'number' && (
                        <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${trendColor}`}>
                            {isNearZero ? <Minus size={8} /> : isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                            {Math.abs(trend).toFixed(1)}%
                        </div>
                    )}
                    <div className={`p-2.5 ${bgColorClass} ${colorClass} rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-sm shadow-inner`}>
                        {icon}
                    </div>
                </div>
            </div>
            <div className={`text-2xl font-black font-mono tracking-tight ${colorClass} flex items-baseline`}>
                {isCurrency && typeof value === 'number'
                    ? <CurrencyDisplay value={value} colorize={false} currency={currency} />
                    : <span>{value}</span>
                }
                {secondaryValue !== null && (
                    <span className="text-sm opacity-40 font-medium text-slate-400 font-sans ml-2">/ {secondaryValue}</span>
                )}
            </div>
            <div className="flex items-center gap-1 text-[9px] text-slate-400 font-medium mt-1">
                <span className="w-1 h-1 rounded-full bg-slate-200" />
                {subtitle || defaultSubtitle}
            </div>
        </div>
    )
}
