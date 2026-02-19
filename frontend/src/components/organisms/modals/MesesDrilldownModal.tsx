import { useState, useMemo } from 'react'
import { ArrowLeft, X, Loader2 } from 'lucide-react'
import { CurrencyDisplay } from '../../atoms/CurrencyDisplay'
import { SemaforoBadge } from '../../atoms/SemaforoBadge'
import { DataTableSortIcon } from '../../atoms/DataTableSortIcon'
import { useSettings } from '../../../context/SettingsContext'
import type { ResumenMensualPresupuesto } from '../../../types/Presupuesto'

export interface BreadcrumbItem {
    label: string
    color?: string
}

type SortDir = 'asc' | 'desc'

export const useSort = (defaultKey: string, defaultDir: SortDir = 'desc') => {
    const [sortKey, setSortKey] = useState(defaultKey)
    const [sortDir, setSortDir] = useState<SortDir>(defaultDir)
    const toggle = (key: string) => {
        if (sortKey === key) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortKey(key)
            setSortDir(key === 'nombre' || key === 'mes' || key === 'mes_nombre' ? 'asc' : 'desc')
        }
    }
    return { sortKey, sortDir, toggle }
}

const SortHeader = ({ label, sortKey, currentKey, currentDir, onSort, align = 'left' }: {
    label: string; sortKey: string; currentKey: string; currentDir: SortDir
    onSort: (key: string) => void; align?: 'left' | 'right' | 'center'
}) => (
    <th
        className={`px-3 py-2 cursor-pointer select-none hover:bg-gray-100/50 transition-colors ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}
        onClick={() => onSort(sortKey)}
    >
        <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
            <span className="font-bold text-gray-400 capitalize text-[10px] tracking-wide">{label}</span>
            <DataTableSortIcon active={currentKey === sortKey} direction={currentKey === sortKey ? currentDir : null} size={12} />
        </div>
    </th>
)

interface MesesDrilldownModalProps {
    breadcrumb: BreadcrumbItem[]
    data: ResumenMensualPresupuesto[]
    loading?: boolean
    onClose: () => void
    direccion?: string
}

export const MesesDrilldownModal = ({ breadcrumb, data, loading, onClose, direccion: _direccion }: MesesDrilldownModalProps) => {
    const { cifrasEnMillones } = useSettings()
    const sort = useSort('mes', 'asc')
    const totalPresup = data.reduce((s, m) => s + m.presupuestado, 0)
    const totalEjec = data.reduce((s, m) => s + m.ejecutado, 0)

    const sorted = useMemo(() => {
        return [...data].sort((a, b) => {
            const factor = sort.sortDir === 'asc' ? 1 : -1
            if (sort.sortKey === 'mes_nombre') return factor * a.mes_nombre.localeCompare(b.mes_nombre)
            const aVal = (a as any)[sort.sortKey] ?? 0
            const bVal = (b as any)[sort.sortKey] ?? 0
            return factor * (aVal - bVal)
        })
    }, [data, sort.sortKey, sort.sortDir])

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300 p-4">
            <div className="w-full max-w-4xl h-[650px] bg-white shadow-2xl flex flex-col animate-in zoom-in duration-300 rounded-3xl overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">
                                {breadcrumb.map((b, i) => (
                                    <span key={i} className="flex items-center gap-1">
                                        {i > 0 && <span className="mx-1 opacity-30">/</span>}
                                        <span className={b.color || ''}>{b.label}</span>
                                    </span>
                                ))}
                            </div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">Detalle Mensual</h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Totals */}
                <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-end">
                    <div className="flex gap-4 text-right">
                        <div><p className="text-[9px] text-slate-400 font-bold capitalize">Presupuestado</p><p className="text-xs font-mono text-blue-600 font-bold"><CurrencyDisplay value={totalPresup} colorize={false} decimals={0} compact={cifrasEnMillones} /></p></div>
                        <div><p className="text-[9px] text-slate-400 font-bold capitalize">Ejecutado</p><p className="text-xs font-mono text-rose-600 font-bold"><CurrencyDisplay value={totalEjec} colorize={false} decimals={0} compact={cifrasEnMillones} /></p></div>
                        <div><p className="text-[9px] text-slate-400 font-bold capitalize">Variación</p><p className="text-xs font-mono font-bold"><CurrencyDisplay value={totalEjec - totalPresup} decimals={0} compact={cifrasEnMillones} /></p></div>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-slate-400">
                            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando...
                        </div>
                    ) : (
                        <table className="w-full text-xs">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <SortHeader label="Mes" sortKey="mes" currentKey={sort.sortKey} currentDir={sort.sortDir} onSort={sort.toggle} />
                                    <SortHeader label="Presupuestado" sortKey="presupuestado" currentKey={sort.sortKey} currentDir={sort.sortDir} onSort={sort.toggle} align="right" />
                                    <SortHeader label="Ejecutado" sortKey="ejecutado" currentKey={sort.sortKey} currentDir={sort.sortDir} onSort={sort.toggle} align="right" />
                                    <SortHeader label="Estado" sortKey="variacion_pct" currentKey={sort.sortKey} currentDir={sort.sortDir} onSort={sort.toggle} align="center" />
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.length === 0 ? (
                                    <tr><td colSpan={4} className="text-center py-8 text-gray-400">Sin datos</td></tr>
                                ) : sorted.map(d => (
                                    <tr key={d.mes} className="border-b border-gray-50 hover:bg-slate-50/50 transition-colors">
                                        <td className="px-3 py-2.5 font-medium text-slate-700">{d.mes_nombre}</td>
                                        <td className="px-3 py-2.5 text-right font-mono text-blue-600">
                                            <CurrencyDisplay value={d.presupuestado} colorize={false} decimals={0} compact={cifrasEnMillones} />
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono text-rose-600">
                                            <CurrencyDisplay value={d.ejecutado} colorize={false} decimals={0} compact={cifrasEnMillones} />
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                            <SemaforoBadge valor={d.semaforo} variacionPct={d.variacion_pct} size="sm" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    )
}
