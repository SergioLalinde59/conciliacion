import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react'

interface SemaforoBadgeProps {
    valor: 'verde' | 'amarillo' | 'rojo' | string
    variacionPct?: number
    showValue?: boolean
    size?: 'sm' | 'md'
}

const CONFIG = {
    verde: {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        label: 'OK',
        Icon: CheckCircle,
    },
    amarillo: {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        label: 'Alerta',
        Icon: AlertTriangle,
    },
    rojo: {
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-200',
        label: 'Excedido',
        Icon: XCircle,
    },
}

export const SemaforoBadge = ({ valor, variacionPct, showValue = true, size = 'sm' }: SemaforoBadgeProps) => {
    const config = CONFIG[valor as keyof typeof CONFIG] || CONFIG.verde
    const { bg, text, border, label, Icon } = config
    const iconSize = size === 'sm' ? 14 : 16
    const textSize = size === 'sm' ? 'text-xs' : 'text-sm'

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${bg} ${text} ${border} ${textSize} font-medium`}>
            <Icon size={iconSize} />
            {showValue && variacionPct !== undefined ? (
                <span>{variacionPct > 0 ? '+' : ''}{variacionPct.toFixed(1)}%</span>
            ) : (
                <span>{label}</span>
            )}
        </span>
    )
}
