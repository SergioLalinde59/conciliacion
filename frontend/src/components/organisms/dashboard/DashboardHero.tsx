import { TrendingUp, TrendingDown, Activity, AlertTriangle, BarChart3, Gauge } from 'lucide-react'
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

interface RealAnterior {
    ingresos: number
    egresos: number
    saldo: number
}

interface DashboardHeroProps {
    realAnterior?: RealAnterior
    anioAnterior?: number
    presupuesto: number
    presupuestoIngresos?: number
    anioCurrent?: number
    ingresos: number
    egresos: number
    flujoNeto: number
    gastosSinPpto?: number
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

/* ── Mini progress bar (used inside hero cards) ── */
const MiniBar = ({ pct, color }: { pct: number; color: string }) => (
    <div className="w-full h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
        <div
            className={`h-full rounded-full transition-all duration-700 ${color}`}
            style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
        />
    </div>
)

export const DashboardHero = ({
    realAnterior, anioAnterior,
    presupuesto, presupuestoIngresos = 0,
    ingresos, egresos, flujoNeto, gastosSinPpto = 0,
    desde, hasta, onDesdeChange, onHastaChange,
    loading, compact = false
}: DashboardHeroProps) => {

    const setRango = (rango: { inicio: string; fin: string }) => {
        onDesdeChange(rango.inicio)
        onHastaChange(rango.fin)
    }

    const hasRealAnterior = realAnterior && (realAnterior.egresos > 0 || realAnterior.ingresos > 0)

    // Budget percentages
    const pctIngresos = presupuestoIngresos > 0 ? (ingresos / presupuestoIngresos) * 100 : 0
    const pctEgresos = presupuesto > 0 ? (egresos / presupuesto) * 100 : 0

    // Net calculations
    const netoPpto = presupuestoIngresos - presupuesto
    const diferenciaNeta = flujoNeto - netoPpto
    const diferenciaPct = netoPpto !== 0 ? (diferenciaNeta / Math.abs(netoPpto)) * 100 : 0
    const netoMejor = diferenciaNeta >= 0

    const Skeleton = () => <div className="h-8 w-28 bg-white/10 rounded animate-pulse mt-1" />

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

            {/* ════ FILA 1: 3 tarjetas principales ════ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">

                {/* ── INGRESOS ── */}
                <div className="bg-white/[0.07] backdrop-blur rounded-xl p-5 border border-white/10">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-emerald-500/20 rounded-xl">
                            <TrendingUp className="text-emerald-400" size={22} />
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ingresos</p>
                    </div>
                    {loading ? <Skeleton /> : (
                        <>
                            <CurrencyDisplay
                                value={ingresos}
                                className="text-2xl md:text-3xl font-black text-emerald-400 font-mono tracking-tight"
                                colorize={false}
                                decimals={0}
                                compact={compact}
                            />
                            {presupuestoIngresos > 0 && (
                                <>
                                    <MiniBar pct={pctIngresos} color="bg-emerald-400" />
                                    <div className="flex items-center justify-between mt-2">
                                        <span className="text-[10px] text-slate-500">
                                            Ppto <CurrencyDisplay
                                                value={presupuestoIngresos}
                                                className="inline text-[10px] text-slate-400"
                                                colorize={false} decimals={0} compact={true}
                                            />
                                        </span>
                                        <span className="text-[11px] font-bold text-emerald-400/80 font-mono">
                                            {pctIngresos.toFixed(0)}%
                                        </span>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* ── EGRESOS ── */}
                <div className="bg-white/[0.07] backdrop-blur rounded-xl p-5 border border-white/10">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-rose-500/20 rounded-xl">
                            <TrendingDown className="text-rose-400" size={22} />
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Egresos</p>
                    </div>
                    {loading ? <Skeleton /> : (
                        <>
                            <CurrencyDisplay
                                value={egresos}
                                className="text-2xl md:text-3xl font-black text-rose-400 font-mono tracking-tight"
                                colorize={false}
                                decimals={0}
                                compact={compact}
                            />
                            {presupuesto > 0 && (
                                <>
                                    <MiniBar pct={pctEgresos} color={pctEgresos > 100 ? 'bg-rose-400' : 'bg-blue-400'} />
                                    <div className="flex items-center justify-between mt-2">
                                        <span className="text-[10px] text-slate-500">
                                            Ppto <CurrencyDisplay
                                                value={presupuesto}
                                                className="inline text-[10px] text-slate-400"
                                                colorize={false} decimals={0} compact={true}
                                            />
                                        </span>
                                        <span className={`text-[11px] font-bold font-mono ${pctEgresos > 100 ? 'text-rose-400/80' : 'text-blue-400/80'}`}>
                                            {pctEgresos.toFixed(0)}%
                                        </span>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* ── FLUJO NETO ── */}
                <div className="bg-white/[0.07] backdrop-blur rounded-xl p-5 border border-white/10">
                    <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2.5 rounded-xl ${flujoNeto >= 0 ? 'bg-blue-500/20' : 'bg-orange-500/20'}`}>
                            <Activity className={flujoNeto >= 0 ? 'text-blue-400' : 'text-orange-400'} size={22} />
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Flujo Neto</p>
                    </div>
                    {loading ? <Skeleton /> : (
                        <>
                            <CurrencyDisplay
                                value={flujoNeto}
                                className={`text-2xl md:text-3xl font-black font-mono tracking-tight ${flujoNeto >= 0 ? 'text-blue-400' : 'text-orange-400'}`}
                                colorize={false}
                                decimals={0}
                                showPlusSign={flujoNeto > 0}
                                compact={compact}
                            />
                            {(presupuesto > 0 || presupuestoIngresos > 0) && (
                                <div className="mt-2 space-y-1">
                                    <div className="text-[10px] text-slate-500">
                                        Ppto Neto{' '}
                                        <CurrencyDisplay
                                            value={netoPpto}
                                            className="inline text-[10px] text-slate-400"
                                            colorize={false} decimals={0} compact={true}
                                            showPlusSign={netoPpto > 0}
                                        />
                                    </div>
                                    <div className={`flex items-center gap-1.5 text-[11px] font-bold ${netoMejor ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${netoMejor ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                        <CurrencyDisplay
                                            value={Math.abs(diferenciaNeta)}
                                            className={`inline text-[11px] font-bold ${netoMejor ? 'text-emerald-400' : 'text-rose-400'}`}
                                            colorize={false} decimals={0} compact={true}
                                        />
                                        <span>{netoMejor ? 'mejor' : 'peor'} que plan</span>
                                        {diferenciaPct !== 0 && (
                                            <span className="text-[10px] opacity-70">
                                                ({diferenciaPct > 0 ? '+' : ''}{diferenciaPct.toFixed(0)}%)
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* ════ FILA 2: 3 tarjetas contextuales ════ */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">

                {/* ── Real Año Anterior ── */}
                {hasRealAnterior ? (
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-slate-500/20 rounded-xl">
                            <BarChart3 className="text-slate-400" size={20} />
                        </div>
                        <div>
                            <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider">
                                Real {anioAnterior}
                            </p>
                            {loading ? <Skeleton /> : (
                                <>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-rose-400/70">
                                            Egr <CurrencyDisplay
                                                value={realAnterior.egresos}
                                                className="inline text-[10px] text-rose-400/70"
                                                colorize={false} decimals={0} compact={true}
                                            />
                                        </span>
                                        <span className="text-[10px] text-emerald-400/70">
                                            Ing <CurrencyDisplay
                                                value={realAnterior.ingresos}
                                                className="inline text-[10px] text-emerald-400/70"
                                                colorize={false} decimals={0} compact={true}
                                            />
                                        </span>
                                    </div>
                                    <span className={`text-xs font-bold ${realAnterior.saldo >= 0 ? 'text-blue-400/80' : 'text-orange-400/80'}`}>
                                        Neto <CurrencyDisplay
                                            value={realAnterior.saldo}
                                            className={`inline text-xs font-bold ${realAnterior.saldo >= 0 ? 'text-blue-400/80' : 'text-orange-400/80'}`}
                                            colorize={false} decimals={0} compact={true}
                                            showPlusSign={realAnterior.saldo > 0}
                                        />
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    <div /> /* empty placeholder to keep grid aligned */
                )}

                {/* ── Sin Presupuestar ── */}
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-500/20 rounded-xl">
                        <AlertTriangle className="text-amber-400" size={20} />
                    </div>
                    <div>
                        <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider">Sin Ppto</p>
                        {loading ? <Skeleton /> : (
                            <CurrencyDisplay
                                value={gastosSinPpto}
                                className="text-lg font-bold text-amber-400"
                                colorize={false}
                                decimals={0}
                                compact={compact}
                            />
                        )}
                    </div>
                </div>

                {/* ── Variación vs Plan ── */}
                {(presupuesto > 0 || presupuestoIngresos > 0) && (
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/20 rounded-xl">
                            <Gauge className="text-indigo-400" size={20} />
                        </div>
                        <div>
                            <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider">Ejecución</p>
                            {loading ? <Skeleton /> : (
                                <div className="space-y-0.5">
                                    {presupuestoIngresos > 0 && (
                                        <div className="text-[10px]">
                                            <span className="text-emerald-400/80 font-bold">{pctIngresos.toFixed(0)}%</span>
                                            <span className="text-slate-500"> ingresos</span>
                                        </div>
                                    )}
                                    {presupuesto > 0 && (
                                        <div className="text-[10px]">
                                            <span className={`font-bold ${pctEgresos > 100 ? 'text-rose-400/80' : 'text-blue-400/80'}`}>
                                                {pctEgresos.toFixed(0)}%
                                            </span>
                                            <span className="text-slate-500"> egresos</span>
                                        </div>
                                    )}
                                    {(presupuesto > 0 || presupuestoIngresos > 0) && (
                                        <div className="text-[10px]">
                                            <span className={`font-bold ${netoMejor ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>
                                                {diferenciaPct > 0 ? '+' : ''}{diferenciaPct.toFixed(0)}%
                                            </span>
                                            <span className="text-slate-500"> neto</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
