import { useMemo } from 'react'
import { Search, Loader2, FileSpreadsheet } from 'lucide-react'
import { SemaforoBadge } from '../atoms/SemaforoBadge'
import { BudgetBarRow } from '../molecules/BudgetBarRow'
import { useBudgetFormat } from '../atoms/CurrencyDisplay'
import type { ComparacionPresupuesto } from '../../types/Presupuesto'

type SortDir = 'asc' | 'desc'

interface BudgetComparisonBarsProps {
    data: ComparacionPresupuesto[]
    loading?: boolean
    title?: string
    busqueda?: string
    setBusqueda?: (v: string) => void
    sortKey?: string
    sortDir?: SortDir
    onSort?: (key: string) => void
    onRowClick: (item: ComparacionPresupuesto) => void
    onExport?: () => void
    direccion?: string
}

const getConsumo = (cc: ComparacionPresupuesto) =>
    cc.presupuestado > 0 ? cc.ejecutado / cc.presupuestado : (cc.ejecutado > 0 ? Infinity : 0)

export const BudgetComparisonBars = ({
    data, loading, title, busqueda, setBusqueda,
    sortKey, sortDir, onSort, onRowClick, onExport, direccion,
}: BudgetComparisonBarsProps) => {
    const fmt = useBudgetFormat()
    const hasSearch = busqueda !== undefined && setBusqueda !== undefined
    const hasSort = sortKey !== undefined && sortDir !== undefined && onSort !== undefined

    // Effective sort (default: ejecutado desc)
    const effectiveSortKey = sortKey ?? 'ejecutado'
    const effectiveSortDir = sortDir ?? 'desc'

    // Filter + sort + pareto
    const allCCs = useMemo(() => {
        let filtered = data
        if (hasSearch && busqueda) {
            filtered = filtered.filter(cc => cc.nombre.toLowerCase().includes(busqueda.toLowerCase()))
        }

        // Pareto map (always ejecutado desc, independent of sort)
        const allByEjec = [...filtered].sort((a, b) => b.ejecutado - a.ejecutado)
        const totalEjec = allByEjec.reduce((s, d) => s + d.ejecutado, 0)
        let acum = 0
        const paretoMap = new Map<number | null, { pct: number; value: number }>()
        for (const cc of allByEjec) {
            acum += cc.ejecutado
            paretoMap.set(cc.id, {
                pct: totalEjec > 0 ? Math.round((acum / totalEjec) * 100) : 0,
                value: acum,
            })
        }

        // Sort
        const sorted = [...filtered].sort((a, b) => {
            const factor = effectiveSortDir === 'asc' ? 1 : -1
            if (effectiveSortKey === 'nombre') return factor * a.nombre.localeCompare(b.nombre)
            if (effectiveSortKey === 'consumo') return factor * (getConsumo(a) - getConsumo(b))
            if (effectiveSortKey === 'cumPct') return factor * ((paretoMap.get(a.id)?.pct ?? 0) - (paretoMap.get(b.id)?.pct ?? 0))
            const aVal = (a as any)[effectiveSortKey] ?? 0
            const bVal = (b as any)[effectiveSortKey] ?? 0
            return factor * (aVal - bVal)
        })

        // Attach cumPct + cumValue
        return sorted.map(cc => ({
            ...cc,
            cumPct: paretoMap.get(cc.id)?.pct ?? 0,
            cumValue: paretoMap.get(cc.id)?.value ?? 0,
        }))
    }, [data, hasSearch, busqueda, effectiveSortKey, effectiveSortDir])

    // Totals
    const totales = useMemo(() => {
        const filtered = (hasSearch && busqueda)
            ? data.filter(cc => cc.nombre.toLowerCase().includes(busqueda.toLowerCase()))
            : data
        return filtered.reduce((acc, d) => ({
            presupuestado: acc.presupuestado + d.presupuestado,
            ejecutado: acc.ejecutado + d.ejecutado,
        }), { presupuestado: 0, ejecutado: 0 })
    }, [data, hasSearch, busqueda])

    const variacionTotalPct = totales.presupuestado === 0
        ? (totales.ejecutado === 0 ? 0 : 100)
        : ((totales.ejecutado - totales.presupuestado) / Math.abs(totales.presupuestado)) * 100

    const consumoTotal = totales.presupuestado > 0
        ? Math.round((totales.ejecutado / totales.presupuestado) * 100)
        : 0

    if (loading) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <div className="flex items-center justify-center text-slate-400 gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" /> Cargando...
                </div>
            </div>
        )
    }

    const showHeader = title || hasSearch || hasSort || onExport

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
            {/* Header */}
            {showHeader && (
                <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        {title && (
                            <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
                        )}
                        {hasSearch && (
                            <>
                                <div className="p-2 bg-slate-50 rounded-lg text-slate-500"><Search className="w-4 h-4" /></div>
                                <input
                                    type="text"
                                    placeholder="Buscar centro de costo..."
                                    className="w-48 pl-1 py-1 text-xs border-none outline-none"
                                    value={busqueda}
                                    onChange={e => setBusqueda!(e.target.value)}
                                />
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {onExport && (
                            <button onClick={onExport} className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors" title="Exportar Excel">
                                <FileSpreadsheet className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Rows */}
            <div className="flex-1 overflow-auto px-5 py-1">
                {allCCs.length === 0 ? (
                    <div className="flex items-center justify-center py-12 text-slate-400 text-sm">Sin datos</div>
                ) : (
                    <div>
                        {allCCs.map(cc => (
                            <BudgetBarRow
                                key={cc.id}
                                cc={cc}
                                onClick={() => onRowClick(cc)}
                                direccion={direccion}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Footer total */}
            {allCCs.length > 0 && (
                <div className="flex justify-between items-center mx-5 py-4 border-t-2 border-slate-200">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total</span>
                    <div className="flex items-center gap-3">
                        <span className="text-[11px] text-slate-400">
                            Ppto <span className="font-mono text-blue-500">{fmt(totales.presupuestado)}</span>
                        </span>
                        <span className="text-[11px] text-slate-400">
                            Ejec <span className="font-mono text-rose-500 font-bold">{fmt(totales.ejecutado)}</span>
                        </span>
                        <span className="text-sm font-bold text-slate-700">
                            {consumoTotal}%
                        </span>
                        <SemaforoBadge
                            valor={Math.abs(variacionTotalPct) <= 10 ? 'verde' : Math.abs(variacionTotalPct) <= 25 ? 'amarillo' : 'rojo'}
                            variacionPct={variacionTotalPct}
                            size="sm"
                        />
                        <span className="text-[11px] font-mono text-indigo-500 font-bold">
                            {fmt(totales.ejecutado)} · 100%
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}
