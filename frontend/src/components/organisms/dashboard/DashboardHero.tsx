import { TrendingUp, TrendingDown, Activity, Target } from 'lucide-react'
import { CurrencyDisplay } from '../../atoms/CurrencyDisplay'
import { Button } from '../../atoms/Button'
import {
    getMesActual,
    getMesAnterior,
    getUltimos3Meses,
    getUltimos6Meses,
    getAnioYTD,
    getAnioCompleto,
} from '../../../utils/dateUtils'

interface DashboardHeroProps {
    presupuesto: number
    ingresos: number
    egresos: number
    flujoNeto: number
    desde: string
    hasta: string
    onDesdeChange: (val: string) => void
    onHastaChange: (val: string) => void
    loading?: boolean
    compact?: boolean
}

const rangos = [
    { label: 'Mes', action: getMesActual },
    { label: 'Mes Ant.', action: getMesAnterior },
    { label: '3M', action: getUltimos3Meses },
    { label: '6M', action: getUltimos6Meses },
    { label: 'YTD', action: getAnioYTD },
    { label: 'Año', action: getAnioCompleto },
]

export const DashboardHero = ({
    presupuesto, ingresos, egresos, flujoNeto,
    desde, hasta, onDesdeChange, onHastaChange,
    loading, compact = false
}: DashboardHeroProps) => {

    const setRango = (rango: { inicio: string; fin: string }) => {
        onDesdeChange(rango.inicio)
        onHastaChange(rango.fin)
    }

    return (
        <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 rounded-2xl p-6 md:p-8 text-white">
            {/* Header row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Flujo de Caja</h1>
                    <p className="text-slate-400 text-sm mt-0.5">Panorama financiero global</p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                    {rangos.map((btn) => {
                        const range = btn.action()
                        const isActive = desde === range.inicio && hasta === range.fin
                        return (
                            <Button
                                key={btn.label}
                                variant="ghost"
                                size="sm"
                                onClick={() => setRango(range)}
                                className={`
                                    text-[11px] px-3 py-1.5 rounded-lg border transition-all duration-200 font-semibold
                                    ${isActive
                                        ? 'bg-white/20 border-white/30 text-white shadow-lg shadow-white/5'
                                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                                    }
                                `}
                            >
                                {btn.label}
                            </Button>
                        )
                    })}
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {/* Presupuesto */}
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/20 rounded-xl">
                        <Target className="text-indigo-400" size={24} />
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Presupuesto</p>
                        {loading ? (
                            <div className="h-8 w-36 bg-white/10 rounded animate-pulse mt-1" />
                        ) : (
                            <CurrencyDisplay
                                value={presupuesto}
                                className="text-2xl md:text-3xl font-bold text-indigo-400"
                                colorize={false}
                                decimals={0}
                                compact={compact}
                            />
                        )}
                    </div>
                </div>

                {/* Ingresos */}
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/20 rounded-xl">
                        <TrendingUp className="text-emerald-400" size={24} />
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Ingresos</p>
                        {loading ? (
                            <div className="h-8 w-36 bg-white/10 rounded animate-pulse mt-1" />
                        ) : (
                            <CurrencyDisplay
                                value={ingresos}
                                className="text-2xl md:text-3xl font-bold text-emerald-400"
                                colorize={false}
                                decimals={0}
                                compact={compact}
                            />
                        )}
                    </div>
                </div>

                {/* Egresos */}
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-rose-500/20 rounded-xl">
                        <TrendingDown className="text-rose-400" size={24} />
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Egresos</p>
                        {loading ? (
                            <div className="h-8 w-36 bg-white/10 rounded animate-pulse mt-1" />
                        ) : (
                            <CurrencyDisplay
                                value={egresos}
                                className="text-2xl md:text-3xl font-bold text-rose-400"
                                colorize={false}
                                decimals={0}
                                compact={compact}
                            />
                        )}
                    </div>
                </div>

                {/* Flujo Neto */}
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${flujoNeto >= 0 ? 'bg-blue-500/20' : 'bg-orange-500/20'}`}>
                        <Activity className={flujoNeto >= 0 ? 'text-blue-400' : 'text-orange-400'} size={24} />
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Flujo Neto</p>
                        {loading ? (
                            <div className="h-8 w-36 bg-white/10 rounded animate-pulse mt-1" />
                        ) : (
                            <CurrencyDisplay
                                value={flujoNeto}
                                className={`text-2xl md:text-3xl font-bold ${flujoNeto >= 0 ? 'text-blue-400' : 'text-orange-400'}`}
                                colorize={false}
                                decimals={0}
                                showPlusSign={flujoNeto > 0}
                                compact={compact}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
