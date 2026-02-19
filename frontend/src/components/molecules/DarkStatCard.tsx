import type { ReactNode } from 'react'
import { CurrencyDisplay } from '../atoms/CurrencyDisplay'

interface DarkStatCardProps {
    label: string
    value: number
    icon: ReactNode
    colorClass: string
    iconBgClass: string
    subtitle?: string
    compact?: boolean
    /** Override the value display (e.g. for "66.8%") */
    renderValue?: ReactNode
}

export const DarkStatCard = ({
    label,
    value,
    icon,
    colorClass,
    iconBgClass,
    subtitle,
    compact = false,
    renderValue
}: DarkStatCardProps) => (
    <div className="group bg-white/10 backdrop-blur p-5 rounded-2xl border border-white/10 flex items-center justify-between transition-all duration-300 hover:bg-white/15">
        <div className="space-y-1 min-w-0">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
            <div className={`text-2xl font-black font-mono tracking-tight ${colorClass}`}>
                {renderValue ?? <CurrencyDisplay value={value} colorize={false} compact={compact} />}
            </div>
            {subtitle && (
                <p className="text-[9px] text-slate-500 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-slate-600" />{subtitle}
                </p>
            )}
        </div>
        <div className={`p-3.5 ${iconBgClass} rounded-2xl group-hover:scale-110 transition-transform duration-300 shrink-0`}>
            {icon}
        </div>
    </div>
)
