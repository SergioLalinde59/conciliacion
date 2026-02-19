import { useMemo } from 'react'
import { ArrowLeft, X, Eye } from 'lucide-react'
import { SemaforoBadge } from '../../atoms/SemaforoBadge'
import { CurrencyDisplay } from '../../atoms/CurrencyDisplay'
import type { ComparacionPresupuesto } from '../../../types/Presupuesto'

interface Props {
    open: boolean
    level: 'concepto' | 'tercero'
    ccId?: number
    ccName: string
    conceptoName: string
    data: ComparacionPresupuesto[]
    loading: boolean
    compact: boolean
    semaforoVerde?: number
    semaforoAmarillo?: number
    onBack: () => void
    onClose: () => void
    onConceptoClick: (item: ComparacionPresupuesto) => void
    onTerceroClick?: (item: ComparacionPresupuesto) => void
    direccion?: string
}

export const PresupuestoDrilldownModal = ({
    open, level, ccId, ccName, conceptoName,
    data, loading, compact,
    semaforoVerde = 5, semaforoAmarillo = 15,
    onBack, onClose, onConceptoClick, onTerceroClick, direccion: _direccion,
}: Props) => {
    const totales = useMemo(() => ({
        presupuestado: data.reduce((s, r) => s + r.presupuestado, 0),
        ejecutado: data.reduce((s, r) => s + r.ejecutado, 0),
        variacion: data.reduce((s, r) => s + r.variacion, 0),
    }), [data])

    if (!open) return null

    const title = level === 'concepto'
        ? `${ccId} - ${ccName} — Conceptos`
        : `${ccId} - ${ccName} - ${conceptoName} — Terceros`

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <div className="w-full max-w-4xl h-[600px] bg-white shadow-2xl flex flex-col rounded-3xl overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">
                                <span>Presupuesto</span>
                            </div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">
                                {title}
                            </h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Summary row */}
                <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex gap-6 text-right">
                    <div>
                        <p className="text-[9px] text-slate-400 font-bold capitalize">Presupuestado</p>
                        <p className="text-xs font-mono text-blue-600 font-bold">
                            <CurrencyDisplay value={totales.presupuestado} colorize={false} compact={compact} />
                        </p>
                    </div>
                    <div>
                        <p className="text-[9px] text-slate-400 font-bold capitalize">Ejecutado</p>
                        <p className="text-xs font-mono text-rose-600 font-bold">
                            <CurrencyDisplay value={totales.ejecutado} colorize={false} compact={compact} />
                        </p>
                    </div>
                    <div>
                        <p className="text-[9px] text-slate-400 font-bold capitalize">Variación</p>
                        <p className="text-xs font-mono font-bold">
                            <CurrencyDisplay value={totales.variacion} compact={compact} />
                        </p>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th className="text-left px-3 py-2 font-bold text-gray-400 capitalize text-[10px] tracking-wide">Nombre</th>
                                <th className="text-right px-3 py-2 font-bold text-gray-400 capitalize text-[10px] tracking-wide">Presupuestado</th>
                                <th className="text-right px-3 py-2 font-bold text-gray-400 capitalize text-[10px] tracking-wide">Ejecutado</th>
                                <th className="text-right px-3 py-2 font-bold text-gray-400 capitalize text-[10px] tracking-wide">Variación $</th>
                                <th className="text-right px-3 py-2 font-bold text-gray-400 capitalize text-[10px] tracking-wide">Var %</th>
                                <th className="text-center px-3 py-2 font-bold text-gray-400 capitalize text-[10px] tracking-wide">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Cargando...</td></tr>
                            ) : data.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Sin datos</td></tr>
                            ) : data.map((row, idx) => {
                                const isClickable = level === 'concepto' || (level === 'tercero' && !!onTerceroClick)
                                const handleRowClick = () => {
                                    if (level === 'concepto') onConceptoClick(row)
                                    else if (level === 'tercero' && onTerceroClick) onTerceroClick(row)
                                }
                                return (
                                <tr
                                    key={row.id ?? idx}
                                    className={`border-b border-gray-50 hover:bg-blue-50/30 transition-colors ${isClickable ? 'cursor-pointer' : ''}`}
                                    onClick={isClickable ? handleRowClick : undefined}
                                >
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-2 group">
                                            {isClickable && (
                                                <div className="w-5 h-5 rounded bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                                    <Eye className="w-3 h-3" />
                                                </div>
                                            )}
                                            <span className="font-bold text-slate-700 uppercase tracking-tight">{row.nombre}</span>
                                            {row.es_estacional && (
                                                <span className="text-[8px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                                    Estacional
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-blue-600">
                                        <CurrencyDisplay value={row.presupuestado} colorize={false} decimals={0} compact={compact} />
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-rose-600">
                                        <CurrencyDisplay value={row.ejecutado} colorize={false} decimals={0} compact={compact} />
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono">
                                        <CurrencyDisplay value={row.variacion} decimals={0} compact={compact} />
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono">
                                        <span className={row.variacion_pct > semaforoAmarillo ? 'text-rose-600' : row.variacion_pct > semaforoVerde ? 'text-amber-600' : 'text-emerald-600'}>
                                            {row.variacion_pct > 0 ? '+' : ''}{row.variacion_pct.toFixed(1)}%
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <SemaforoBadge valor={row.semaforo} variacionPct={row.variacion_pct} size="sm" />
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
