import { useState, useRef, useEffect } from 'react'
import { TrendingUp, TrendingDown, Activity, AlertTriangle, BarChart3 } from 'lucide-react'
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
import type { Perspectiva } from '../../../types'

interface RealAnterior {
    ingresos: number
    egresos: number
    saldo: number
}

export interface SinPptoItem {
    nombre: string
    monto: number
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
    sinPptoDetalle?: SinPptoItem[]
    desde: string
    hasta: string
    onDesdeChange: (val: string) => void
    onHastaChange: (val: string) => void
    loading?: boolean
    compact?: boolean
    perspectivas?: Perspectiva[]
    selectedSlug?: string
    onPerspectivaChange?: (slug: string) => void
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

/* ── Click popover (close on outside click) ── */
const ClickPopover = ({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) => {
    const ref = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (!open) return
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose()
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open, onClose])
    if (!open) return null
    return (
        <div ref={ref} className="absolute z-50 top-full mt-2 left-1/2 -translate-x-1/2 bg-slate-800 border border-white/15 rounded-xl shadow-2xl p-4 min-w-[240px] animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-slate-800 border-l border-t border-white/15" />
            {children}
        </div>
    )
}

/* ── Deviation bar: center = on plan, left = worse, right = better ── */
const DeviationBar = ({ pct, better }: { pct: number; better: boolean }) => {
    const clamped = Math.min(Math.abs(pct), 100)
    const barColor = better ? 'bg-blue-400' : 'bg-orange-400'
    return (
        <div className="w-full h-1.5 bg-white/10 rounded-full mt-2 relative overflow-hidden">
            {/* center tick */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/25" />
            {/* deviation fill */}
            <div
                className={`absolute top-0 bottom-0 rounded-full transition-all duration-700 ${barColor}`}
                style={better
                    ? { left: '50%', width: `${clamped / 2}%` }
                    : { right: '50%', width: `${clamped / 2}%` }
                }
            />
        </div>
    )
}

export const DashboardHero = ({
    realAnterior, anioAnterior,
    presupuesto, presupuestoIngresos = 0,
    ingresos, egresos, flujoNeto, gastosSinPpto = 0,
    sinPptoDetalle = [],
    desde, hasta, onDesdeChange, onHastaChange,
    loading, compact = false,
    perspectivas = [], selectedSlug = '', onPerspectivaChange,
}: DashboardHeroProps) => {
    const [showSinPpto, setShowSinPpto] = useState(false)
    const [showDesviacion, setShowDesviacion] = useState(false)

    const setRango = (rango: { inicio: string; fin: string }) => {
        onDesdeChange(rango.inicio)
        onHastaChange(rango.fin)
    }

    const hasRealAnterior = realAnterior && (realAnterior.egresos > 0 || realAnterior.ingresos > 0)
    const perspectivaActiva = perspectivas.find(p => p.slug === selectedSlug)

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
            <div className="flex items-center gap-6 mb-8">
                <div className="shrink-0">
                    <h1 className="text-2xl font-bold tracking-tight">Flujo de Caja</h1>
                    <p className="text-slate-400 text-sm mt-0.5">
                        Panorama financiero{perspectivaActiva ? ` — ${perspectivaActiva.nombre}` : ''}
                    </p>
                </div>
                <div className="flex flex-col items-start gap-2">
                    {/* Perspectiva pills */}
                    {perspectivas.length > 1 && onPerspectivaChange && (
                        <div className="flex items-center gap-1">
                            {perspectivas.map(p => (
                                <button
                                    key={p.slug}
                                    onClick={() => onPerspectivaChange(p.slug)}
                                    className={`
                                        text-[11px] px-3 py-1.5 rounded-lg border transition-all duration-200 font-semibold
                                        ${selectedSlug === p.slug
                                            ? 'bg-indigo-500/30 border-indigo-400/40 text-indigo-200 shadow-lg shadow-indigo-500/10'
                                            : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                                        }
                                    `}
                                >
                                    {p.nombre}
                                </button>
                            ))}
                        </div>
                    )}
                    {/* Date range pills */}
                    <div className="flex items-center gap-1.5">
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
            </div>

            {/* ════ KPI: Ingresos | Egresos | Flujo Neto ════ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 items-stretch mb-5">

                {/* ── INGRESOS ── */}
                {(() => {
                    const diffIng = ingresos - presupuestoIngresos
                    const ingPositivo = diffIng >= 0
                    const hasPpto = presupuestoIngresos > 0
                    return (
                        <div className="bg-white/[0.06] rounded-xl p-5 border border-white/10">
                            <div className="flex items-center gap-2 mb-3">
                                <TrendingUp className="text-emerald-400" size={16} />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ingresos</span>
                            </div>
                            {loading ? <Skeleton /> : (
                                <>
                                    <CurrencyDisplay
                                        value={ingresos}
                                        className="text-2xl md:text-3xl font-black text-emerald-400 font-mono tracking-tight"
                                        colorize={false} decimals={0} compact={compact}
                                    />
                                    {hasPpto && (
                                        <>
                                            <MiniBar pct={pctIngresos} color="bg-emerald-400" />
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-xs text-slate-400">
                                                    Ppto <CurrencyDisplay value={presupuestoIngresos} className="inline text-xs text-slate-300" colorize={false} decimals={0} compact={true} />
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <CurrencyDisplay
                                                        value={diffIng}
                                                        className={`text-xs font-bold font-mono ${ingPositivo ? 'text-emerald-400/70' : 'text-rose-400/70'}`}
                                                        colorize={false} decimals={0} compact={true} showPlusSign={ingPositivo}
                                                    />
                                                    <span className="text-sm font-bold text-emerald-400/80 font-mono">{pctIngresos.toFixed(0)}%</span>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    )
                })()}

                {/* ── EGRESOS ── */}
                {(() => {
                    const diffEgr = presupuesto - egresos
                    const egrBajo = diffEgr >= 0
                    const hasPpto = presupuesto > 0
                    return (
                        <div className="bg-white/[0.06] rounded-xl p-5 border border-white/10">
                            <div className="flex items-center gap-2 mb-3">
                                <TrendingDown className="text-rose-400" size={16} />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Egresos</span>
                            </div>
                            {loading ? <Skeleton /> : (
                                <>
                                    <CurrencyDisplay
                                        value={egresos}
                                        className="text-2xl md:text-3xl font-black text-rose-400 font-mono tracking-tight"
                                        colorize={false} decimals={0} compact={compact}
                                    />
                                    {hasPpto && (
                                        <>
                                            <MiniBar pct={pctEgresos} color={pctEgresos > 100 ? 'bg-rose-400' : 'bg-blue-400'} />
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-xs text-slate-400">
                                                    Ppto <CurrencyDisplay value={presupuesto} className="inline text-xs text-slate-300" colorize={false} decimals={0} compact={true} />
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <CurrencyDisplay
                                                        value={diffEgr}
                                                        className={`text-xs font-bold font-mono ${egrBajo ? 'text-blue-400/70' : 'text-rose-400/70'}`}
                                                        colorize={false} decimals={0} compact={true} showPlusSign={egrBajo}
                                                    />
                                                    <span className={`text-sm font-bold font-mono ${pctEgresos > 100 ? 'text-rose-400/80' : 'text-blue-400/80'}`}>{pctEgresos.toFixed(0)}%</span>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    )
                })()}

                {/* ── FLUJO NETO (resultado = Ingresos - Egresos) ── */}
                {(() => {
                    const hasPptoNeto = presupuesto > 0 || presupuestoIngresos > 0
                    return (
                        <div className="bg-white/[0.08] rounded-xl p-5 border border-white/15">
                            <div className="flex items-center gap-2 mb-3">
                                <Activity className={flujoNeto >= 0 ? 'text-blue-400' : 'text-orange-400'} size={16} />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Flujo Neto</span>
                            </div>
                            {loading ? <Skeleton /> : (
                                <>
                                    <CurrencyDisplay
                                        value={flujoNeto}
                                        className={`text-2xl md:text-3xl font-black font-mono tracking-tight ${flujoNeto >= 0 ? 'text-blue-400' : 'text-orange-400'}`}
                                        colorize={false} decimals={0} showPlusSign={flujoNeto > 0} compact={compact}
                                    />
                                    {hasPptoNeto && (
                                        <>
                                            <DeviationBar pct={diferenciaPct} better={netoMejor} />
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-xs text-slate-400">
                                                    Ppto <CurrencyDisplay value={netoPpto} className="inline text-xs text-slate-300" colorize={false} decimals={0} compact={true} showPlusSign={netoPpto > 0} />
                                                </span>
                                                <div className="flex items-center gap-2 relative">
                                                    <button
                                                        onClick={() => setShowDesviacion(v => !v)}
                                                        className={`flex items-center gap-1 cursor-pointer hover:underline underline-offset-2`}
                                                    >
                                                        <CurrencyDisplay
                                                            value={diferenciaNeta}
                                                            className={`text-xs font-bold font-mono ${netoMejor ? 'text-blue-400/70' : 'text-orange-400/70'}`}
                                                            colorize={false} decimals={0} compact={true} showPlusSign={netoMejor}
                                                        />
                                                    </button>
                                                    <span className={`text-sm font-bold font-mono ${netoMejor ? 'text-blue-400/80' : 'text-orange-400/80'}`}>
                                                        {diferenciaPct > 0 ? '+' : ''}{diferenciaPct.toFixed(0)}%
                                                    </span>
                                                    <ClickPopover open={showDesviacion} onClose={() => setShowDesviacion(false)}>
                                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-3">Descomposición</p>
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between gap-4">
                                                                <div className="flex items-center gap-1.5">
                                                                    <TrendingUp size={12} className="text-emerald-400" />
                                                                    <span className="text-xs text-slate-300">Ingresos</span>
                                                                </div>
                                                                <CurrencyDisplay
                                                                    value={ingresos - presupuestoIngresos}
                                                                    className={`text-xs font-bold font-mono ${ingresos >= presupuestoIngresos ? 'text-emerald-400' : 'text-rose-400'}`}
                                                                    colorize={false} decimals={0} compact={true} showPlusSign={ingresos >= presupuestoIngresos}
                                                                />
                                                            </div>
                                                            <div className="flex items-center justify-between gap-4">
                                                                <div className="flex items-center gap-1.5">
                                                                    <TrendingDown size={12} className="text-rose-400" />
                                                                    <span className="text-xs text-slate-300">Egresos</span>
                                                                </div>
                                                                <CurrencyDisplay
                                                                    value={presupuesto - egresos}
                                                                    className={`text-xs font-bold font-mono ${egresos <= presupuesto ? 'text-emerald-400' : 'text-rose-400'}`}
                                                                    colorize={false} decimals={0} compact={true} showPlusSign={egresos <= presupuesto}
                                                                />
                                                            </div>
                                                            <div className="border-t border-white/10 pt-2 flex items-center justify-between gap-4">
                                                                <span className="text-xs text-slate-300 font-semibold">Neto</span>
                                                                <CurrencyDisplay
                                                                    value={diferenciaNeta}
                                                                    className={`text-xs font-bold font-mono ${netoMejor ? 'text-blue-400' : 'text-orange-400'}`}
                                                                    colorize={false} decimals={0} compact={true} showPlusSign={netoMejor}
                                                                />
                                                            </div>
                                                        </div>
                                                    </ClickPopover>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    )
                })()}
            </div>

            {/* ════ Contexto: Real anterior + Sin Ppto ════ */}
            <div className="flex items-center gap-6 flex-wrap">
                {hasRealAnterior && !loading && (
                    <div className="flex items-center gap-3">
                        <BarChart3 className="text-slate-500" size={16} />
                        <span className="text-xs text-slate-500 font-semibold uppercase">Real {anioAnterior}:</span>
                        <span className="text-xs text-emerald-400/70">
                            Ing <CurrencyDisplay value={realAnterior.ingresos} className="inline text-xs text-emerald-400/70" colorize={false} decimals={0} compact={true} />
                        </span>
                        <span className="text-xs text-rose-400/70">
                            Egr <CurrencyDisplay value={realAnterior.egresos} className="inline text-xs text-rose-400/70" colorize={false} decimals={0} compact={true} />
                        </span>
                        <span className={`text-xs font-bold ${realAnterior.saldo >= 0 ? 'text-blue-400/70' : 'text-orange-400/70'}`}>
                            Neto <CurrencyDisplay value={realAnterior.saldo} className={`inline text-xs font-bold ${realAnterior.saldo >= 0 ? 'text-blue-400/70' : 'text-orange-400/70'}`} colorize={false} decimals={0} compact={true} showPlusSign={realAnterior.saldo > 0} />
                        </span>
                    </div>
                )}
                {gastosSinPpto > 0 && !loading && (
                    <div className="relative">
                        <button
                            onClick={() => sinPptoDetalle.length > 0 && setShowSinPpto(v => !v)}
                            className={`flex items-center gap-2 ${sinPptoDetalle.length > 0 ? 'cursor-pointer hover:opacity-80' : ''}`}
                        >
                            <AlertTriangle className="text-amber-400" size={16} />
                            <span className="text-xs text-slate-500 font-semibold uppercase">Sin Ppto:</span>
                            <CurrencyDisplay value={gastosSinPpto} className="text-sm font-bold text-amber-400" colorize={false} decimals={0} compact={compact} />
                        </button>
                        <ClickPopover open={showSinPpto} onClose={() => setShowSinPpto(false)}>
                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-3">Sin Presupuesto por Centro</p>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                {sinPptoDetalle.map(item => {
                                    const pct = gastosSinPpto > 0 ? (item.monto / gastosSinPpto) * 100 : 0
                                    return (
                                        <div key={item.nombre} className="flex items-center justify-between gap-4">
                                            <span className="text-[11px] text-slate-300 truncate max-w-[140px]">{item.nombre}</span>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <CurrencyDisplay value={item.monto} className="text-[11px] font-bold font-mono text-amber-400" colorize={false} decimals={0} compact={true} />
                                                <span className="text-[9px] text-slate-500 font-mono w-8 text-right">{pct.toFixed(0)}%</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </ClickPopover>
                    </div>
                )}
            </div>
        </div>
    )
}
