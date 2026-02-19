import { Check, AlertTriangle, X } from 'lucide-react'

export type SemaphoreStatus = 'verde' | 'amarillo' | 'rojo'

const barGradient: Record<SemaphoreStatus, string> = {
    verde: 'bg-gradient-to-r from-emerald-200/70 to-emerald-300/70',
    amarillo: 'bg-gradient-to-r from-amber-200/70 to-amber-300/70',
    rojo: 'bg-gradient-to-r from-rose-200/70 to-rose-300/70',
}

const markerBorder: Record<SemaphoreStatus, string> = {
    verde: 'border-emerald-300',
    amarillo: 'border-amber-300',
    rojo: 'border-rose-300',
}

const badgeConfig: Record<SemaphoreStatus, { bg: string; icon: React.ReactNode }> = {
    verde: { bg: 'bg-emerald-300', icon: <Check className="w-3 h-3 text-white" strokeWidth={3} /> },
    amarillo: { bg: 'bg-amber-300', icon: <AlertTriangle className="w-3 h-3 text-white" strokeWidth={3} /> },
    rojo: { bg: 'bg-rose-300', icon: <X className="w-3 h-3 text-white" strokeWidth={3} /> },
}

interface SemaphoreProgressBarProps {
    /** Fill percentage (0-100). Clamped to 100 for display. */
    fillPct: number
    /** Semaphore status determines bar color and badge icon */
    status: SemaphoreStatus
    /** Bar height class. Default: "h-3" */
    heightClass?: string
    /** Show the circular marker on the bar. Default: true */
    showMarker?: boolean
    /** Show the semaphore badge at the end. Default: true */
    showBadge?: boolean
}

export const SemaphoreProgressBar = ({
    fillPct,
    status,
    heightClass = 'h-3',
    showMarker = true,
    showBadge = true,
}: SemaphoreProgressBarProps) => {
    const clampedFill = Math.min(Math.max(fillPct, 0), 100)
    const gradient = barGradient[status]
    const marker = markerBorder[status]
    const badge = badgeConfig[status]

    return (
        <div className="flex items-center gap-2.5">
            <div className={`flex-1 relative ${heightClass}`}>
                {/* Track */}
                <div className="absolute inset-0 bg-gray-100 rounded-full" />
                {/* Fill */}
                <div
                    className={`absolute inset-y-0 left-0 ${gradient} rounded-full transition-all duration-700 ease-out`}
                    style={{ width: `${Math.max(clampedFill, 2)}%` }}
                />
                {/* Circle marker */}
                {showMarker && (
                    <div
                        className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 ${marker} shadow-sm transition-all duration-700`}
                        style={{ left: `calc(${clampedFill}% - 8px)` }}
                    />
                )}
            </div>
            {/* Semaphore badge */}
            {showBadge && (
                <div className={`w-6 h-6 rounded-full ${badge.bg} flex items-center justify-center shrink-0 shadow-sm`}>
                    {badge.icon}
                </div>
            )}
        </div>
    )
}
