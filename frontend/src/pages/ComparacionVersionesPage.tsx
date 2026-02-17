import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Eye, Search, X, Loader2, GitCompareArrows, TrendingUp, TrendingDown } from 'lucide-react'
import { presupuestoService } from '../services/presupuesto.service'
import { usePresupuestoVersiones } from '../hooks/usePresupuesto'
import { CurrencyDisplay } from '../components/atoms/CurrencyDisplay'
import { StatCard } from '../components/molecules/StatCard'
import { DataTableSortIcon } from '../components/atoms/DataTableSortIcon'
import type { Presupuesto, ComparacionVersion, PresupuestoVersionInfo } from '../types/Presupuesto'

type SortDir = 'asc' | 'desc'

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
    changed: { label: 'Cambio', bg: 'bg-blue-50', text: 'text-blue-700' },
    new: { label: 'Nuevo', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    removed: { label: 'Eliminado', bg: 'bg-rose-50', text: 'text-rose-700' },
    unchanged: { label: 'Sin cambio', bg: 'bg-gray-50', text: 'text-gray-500' },
}

const StatusBadge = ({ status }: { status: string }) => {
    const c = statusConfig[status] || statusConfig.unchanged
    return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.bg} ${c.text}`}>
            {c.label}
        </span>
    )
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

export const ComparacionVersionesPage = () => {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const presupuestoId = parseInt(id || '0')

    const [presupuesto, setPresupuesto] = useState<Presupuesto | null>(null)
    const { data: versiones = [] } = usePresupuestoVersiones(presupuestoId)

    const [versionA, setVersionA] = useState<number>(0)
    const [versionB, setVersionB] = useState<number>(0)
    const [data, setData] = useState<ComparacionVersion[]>([])
    const [loading, setLoading] = useState(false)
    const [busqueda, setBusqueda] = useState('')

    // Sort
    const [sortKey, setSortKey] = useState('delta')
    const [sortDir, setSortDir] = useState<SortDir>('desc')
    const toggleSort = (key: string) => {
        if (sortKey === key) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
        else { setSortKey(key); setSortDir(key === 'nombre' ? 'asc' : 'desc') }
    }

    // Drill-down modals
    const [conceptoModal, setConceptoModal] = useState<{
        isOpen: boolean; ccId: number; ccName: string; data: ComparacionVersion[]; loading: boolean
    }>({ isOpen: false, ccId: 0, ccName: '', data: [], loading: false })

    const [terceroModal, setTerceroModal] = useState<{
        isOpen: boolean; ccId: number; ccName: string
        conceptoId: number | null; conceptoName: string; data: ComparacionVersion[]; loading: boolean
    }>({ isOpen: false, ccId: 0, ccName: '', conceptoId: null, conceptoName: '', data: [], loading: false })

    // Load presupuesto
    useEffect(() => {
        if (!presupuestoId) return
        presupuestoService.obtener(presupuestoId).then(setPresupuesto).catch(() => toast.error('Error cargando presupuesto'))
    }, [presupuestoId])

    // Auto-select versions when loaded
    useEffect(() => {
        if (versiones.length >= 2 && versionA === 0 && versionB === 0) {
            setVersionA(versiones[versiones.length - 1].version) // oldest
            setVersionB(versiones[0].version) // newest
        } else if (versiones.length === 1 && versionA === 0) {
            setVersionA(versiones[0].version)
            setVersionB(versiones[0].version)
        }
    }, [versiones, versionA, versionB])

    // Fetch comparison
    const cargarComparacion = useCallback(async () => {
        if (!presupuestoId || !versionA || !versionB) return
        setLoading(true)
        try {
            const result = await presupuestoService.compararVersiones(presupuestoId, {
                version_a: versionA,
                version_b: versionB,
                nivel: 'centro_costo',
            })
            setData(result)
        } catch {
            toast.error('Error cargando comparación')
        } finally {
            setLoading(false)
        }
    }, [presupuestoId, versionA, versionB])

    useEffect(() => {
        cargarComparacion()
    }, [cargarComparacion])

    // Totals
    const totals = useMemo(() => {
        const totalA = data.reduce((s, d) => s + d.monto_version_a, 0)
        const totalB = data.reduce((s, d) => s + d.monto_version_b, 0)
        const newCount = data.filter(d => d.status === 'new').length
        const removedCount = data.filter(d => d.status === 'removed').length
        const changedCount = data.filter(d => d.status === 'changed').length
        return { totalA, totalB, delta: totalB - totalA, newCount, removedCount, changedCount }
    }, [data])

    // Filter & sort
    const filtered = useMemo(() => {
        const q = busqueda.trim().toLowerCase()
        let result = q ? data.filter(d => d.nombre.toLowerCase().includes(q)) : data
        return [...result].sort((a, b) => {
            const factor = sortDir === 'asc' ? 1 : -1
            if (sortKey === 'nombre') return factor * a.nombre.localeCompare(b.nombre)
            if (sortKey === 'status') return factor * a.status.localeCompare(b.status)
            const aVal = (a as any)[sortKey] ?? 0
            const bVal = (b as any)[sortKey] ?? 0
            return factor * (Math.abs(aVal) - Math.abs(bVal))
        })
    }, [data, busqueda, sortKey, sortDir])

    // Drill-down handlers
    const handleCCClick = async (row: ComparacionVersion) => {
        if (!row.id) return
        setConceptoModal({ isOpen: true, ccId: row.id, ccName: `${row.id} - ${row.nombre}`, data: [], loading: true })
        try {
            const result = await presupuestoService.compararVersiones(presupuestoId, {
                version_a: versionA, version_b: versionB,
                nivel: 'concepto', centro_costo_id: row.id,
            })
            setConceptoModal(prev => ({ ...prev, data: result, loading: false }))
        } catch {
            toast.error('Error cargando conceptos')
            setConceptoModal(prev => ({ ...prev, loading: false }))
        }
    }

    const handleConceptoClick = async (row: ComparacionVersion) => {
        setTerceroModal({
            isOpen: true, ccId: conceptoModal.ccId, ccName: conceptoModal.ccName,
            conceptoId: row.id, conceptoName: row.id ? `${row.id} - ${row.nombre}` : row.nombre,
            data: [], loading: true,
        })
        try {
            const result = await presupuestoService.compararVersiones(presupuestoId, {
                version_a: versionA, version_b: versionB,
                nivel: 'tercero', centro_costo_id: conceptoModal.ccId,
                concepto_id: row.id ?? undefined,
            })
            setTerceroModal(prev => ({ ...prev, data: result, loading: false }))
        } catch {
            toast.error('Error cargando terceros')
            setTerceroModal(prev => ({ ...prev, loading: false }))
        }
    }

    const versionLabel = (v: PresupuestoVersionInfo) =>
        `v${v.version}${v.version === presupuesto?.version_actual ? ' (actual)' : ''}`

    const estadoBadge = (estado: string) => {
        const config: Record<string, string> = {
            borrador: 'bg-gray-100 text-gray-700',
            activo: 'bg-emerald-100 text-emerald-700',
            cerrado: 'bg-rose-100 text-rose-700',
        }
        return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config[estado] || config.borrador}`}>{estado}</span>
    }

    return (
        <div className="flex flex-col h-full bg-slate-50/50 overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-2 bg-white border-b border-slate-200">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(`/presupuestos/${presupuestoId}/detalle`)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-gray-900">
                                {presupuesto?.nombre || 'Comparar Versiones'}
                            </h1>
                            {presupuesto && estadoBadge(presupuesto.estado)}
                        </div>
                        <p className="text-gray-500 text-sm mt-1 flex items-center gap-2">
                            <GitCompareArrows size={14} />
                            Comparar versiones del presupuesto
                        </p>
                    </div>
                </div>

                {/* Version selectors */}
                <div className="flex items-center gap-4 mt-4 pb-3">
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase">Version A</label>
                        <select
                            value={versionA}
                            onChange={e => setVersionA(Number(e.target.value))}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        >
                            {versiones.map(v => (
                                <option key={v.version} value={v.version}>{versionLabel(v)}</option>
                            ))}
                        </select>
                    </div>
                    <span className="text-gray-400 font-bold text-sm">vs</span>
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase">Version B</label>
                        <select
                            value={versionB}
                            onChange={e => setVersionB(Number(e.target.value))}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        >
                            {versiones.map(v => (
                                <option key={v.version} value={v.version}>{versionLabel(v)}</option>
                            ))}
                        </select>
                    </div>
                    {versionA === versionB && (
                        <span className="text-xs text-amber-600 font-medium">Misma versión seleccionada</span>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 p-4 space-y-4 overflow-auto">
                {/* StatCards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        label={`Total v${versionA}`}
                        value={totals.totalA}
                        icon={<TrendingUp className="w-5 h-5" />}
                        colorClass="text-blue-600"
                        bgColorClass="bg-blue-50"
                        borderColor="group-hover:border-blue-200"
                        subtitle="Version A"
                    />
                    <StatCard
                        label={`Total v${versionB}`}
                        value={totals.totalB}
                        icon={<TrendingUp className="w-5 h-5" />}
                        colorClass="text-purple-600"
                        bgColorClass="bg-purple-50"
                        borderColor="group-hover:border-purple-200"
                        subtitle="Version B"
                    />
                    <StatCard
                        label="Delta"
                        value={totals.delta}
                        icon={<TrendingDown className="w-5 h-5" />}
                        colorClass={totals.delta > 0 ? 'text-rose-600' : totals.delta < 0 ? 'text-emerald-600' : 'text-gray-500'}
                        bgColorClass="bg-slate-50"
                        borderColor="group-hover:border-slate-300"
                        subtitle={`B - A = ${totals.totalA > 0 ? ((totals.delta / totals.totalA) * 100).toFixed(1) : '0'}%`}
                    />
                    <StatCard
                        label="Cambios"
                        value={totals.changedCount + totals.newCount + totals.removedCount}
                        icon={<GitCompareArrows className="w-5 h-5" />}
                        colorClass="text-slate-600"
                        bgColorClass="bg-slate-50"
                        borderColor="group-hover:border-slate-300"
                        isCurrency={false}
                        subtitle={`${totals.changedCount} mod / +${totals.newCount} nuevos / -${totals.removedCount} elim`}
                    />
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* Search */}
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                        <div className="relative flex-1 max-w-xs">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={busqueda}
                                onChange={e => setBusqueda(e.target.value)}
                                placeholder="Buscar centro de costo..."
                                className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                autoFocus
                            />
                        </div>
                        <span className="text-xs text-gray-400">
                            {filtered.length} de {data.length} centros de costo
                        </span>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-16 text-gray-400">
                            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando comparación...
                        </div>
                    ) : (
                        <table className="w-full text-xs">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <SortHeader label="Centro de Costo" sortKey="nombre" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                                    <SortHeader label={`v${versionA}`} sortKey="monto_version_a" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} align="right" />
                                    <SortHeader label={`v${versionB}`} sortKey="monto_version_b" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} align="right" />
                                    <SortHeader label="Delta" sortKey="delta" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} align="right" />
                                    <SortHeader label="Delta %" sortKey="delta_pct" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} align="right" />
                                    <SortHeader label="Estado" sortKey="status" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} align="center" />
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-12 text-gray-400">Sin datos</td></tr>
                                ) : filtered.map((row, idx) => (
                                    <tr
                                        key={row.id ?? idx}
                                        className={`border-b border-gray-50 hover:bg-blue-50/30 transition-colors cursor-pointer
                                            ${row.status === 'new' ? 'bg-emerald-50/20' : ''}
                                            ${row.status === 'removed' ? 'bg-rose-50/20' : ''}
                                        `}
                                        onClick={() => handleCCClick(row)}
                                    >
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-2 group">
                                                <div className="w-5 h-5 rounded bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all shrink-0">
                                                    <Eye className="w-3 h-3" />
                                                </div>
                                                <span className="font-bold text-slate-700 uppercase tracking-tight">
                                                    {row.id ? `${row.id} - ${row.nombre}` : row.nombre}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono text-blue-600">
                                            {row.monto_version_a === 0 && row.status === 'new'
                                                ? <span className="text-gray-300">—</span>
                                                : <CurrencyDisplay value={row.monto_version_a} colorize={false} decimals={0} />}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono text-purple-600">
                                            {row.monto_version_b === 0 && row.status === 'removed'
                                                ? <span className="text-gray-300">—</span>
                                                : <CurrencyDisplay value={row.monto_version_b} colorize={false} decimals={0} />}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono">
                                            <CurrencyDisplay value={row.delta} decimals={0} />
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono">
                                            {row.delta_pct !== null ? (
                                                <span className={row.delta_pct > 0 ? 'text-rose-600' : row.delta_pct < 0 ? 'text-emerald-600' : 'text-gray-400'}>
                                                    {row.delta_pct > 0 ? '+' : ''}{row.delta_pct.toFixed(1)}%
                                                </span>
                                            ) : (
                                                <span className="text-gray-300">—</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                            <StatusBadge status={row.status} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            {filtered.length > 0 && (
                                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                                    <tr className="font-bold text-xs">
                                        <td className="px-3 py-2.5 text-slate-700 uppercase">Total</td>
                                        <td className="px-3 py-2.5 text-right font-mono text-blue-700">
                                            <CurrencyDisplay value={totals.totalA} colorize={false} decimals={0} />
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono text-purple-700">
                                            <CurrencyDisplay value={totals.totalB} colorize={false} decimals={0} />
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono">
                                            <CurrencyDisplay value={totals.delta} decimals={0} />
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono">
                                            {totals.totalA > 0 ? (
                                                <span className={totals.delta > 0 ? 'text-rose-600' : totals.delta < 0 ? 'text-emerald-600' : 'text-gray-400'}>
                                                    {totals.delta > 0 ? '+' : ''}{((totals.delta / totals.totalA) * 100).toFixed(1)}%
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td className="px-3 py-2.5 text-center text-gray-400">{data.length} CCs</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    )}
                </div>
            </div>

            {/* Modal Drill-down: Conceptos */}
            {conceptoModal.isOpen && (
                <DrilldownModal
                    title="Conceptos"
                    breadcrumb={[
                        { label: `v${versionA} vs v${versionB}` },
                        { label: conceptoModal.ccName, color: 'text-indigo-600' },
                    ]}
                    data={conceptoModal.data}
                    loading={conceptoModal.loading}
                    onClose={() => setConceptoModal(prev => ({ ...prev, isOpen: false }))}
                    onRowClick={handleConceptoClick}
                    clickable
                    versionA={versionA}
                    versionB={versionB}
                />
            )}

            {/* Modal Drill-down: Terceros */}
            {terceroModal.isOpen && (
                <DrilldownModal
                    title="Terceros"
                    breadcrumb={[
                        { label: `v${versionA} vs v${versionB}` },
                        { label: terceroModal.ccName, color: 'text-indigo-600' },
                        { label: terceroModal.conceptoName, color: 'text-purple-600' },
                    ]}
                    data={terceroModal.data}
                    loading={terceroModal.loading}
                    onClose={() => setTerceroModal(prev => ({ ...prev, isOpen: false }))}
                    onRowClick={() => { }}
                    clickable={false}
                    versionA={versionA}
                    versionB={versionB}
                />
            )}
        </div>
    )
}

// ============================================================
// Modal drill-down genérico para comparación de versiones
// ============================================================

interface BreadcrumbItem {
    label: string
    color?: string
}

interface DrilldownModalProps {
    title: string
    breadcrumb: BreadcrumbItem[]
    data: ComparacionVersion[]
    loading?: boolean
    onClose: () => void
    onRowClick: (item: ComparacionVersion) => void
    clickable?: boolean
    versionA: number
    versionB: number
}

const DrilldownModal = ({ title, breadcrumb, data, loading, onClose, onRowClick, clickable, versionA, versionB }: DrilldownModalProps) => {
    const [q, setQ] = useState('')
    const [sortKey, setSortKey] = useState('delta')
    const [sortDir, setSortDir] = useState<SortDir>('desc')
    const toggleSort = (key: string) => {
        if (sortKey === key) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
        else { setSortKey(key); setSortDir(key === 'nombre' ? 'asc' : 'desc') }
    }

    const filtered = useMemo(() => {
        const result = data.filter(d => d.nombre.toLowerCase().includes(q.toLowerCase()))
        return [...result].sort((a, b) => {
            const factor = sortDir === 'asc' ? 1 : -1
            if (sortKey === 'nombre') return factor * a.nombre.localeCompare(b.nombre)
            const aVal = (a as any)[sortKey] ?? 0
            const bVal = (b as any)[sortKey] ?? 0
            return factor * (Math.abs(aVal) - Math.abs(bVal))
        })
    }, [data, q, sortKey, sortDir])

    const totalA = filtered.reduce((s, r) => s + r.monto_version_a, 0)
    const totalB = filtered.reduce((s, r) => s + r.monto_version_b, 0)
    const totalDelta = totalB - totalA

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <div className="w-full max-w-5xl h-[650px] bg-white shadow-2xl flex flex-col animate-in zoom-in duration-300 rounded-3xl overflow-hidden">
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
                            <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">{title}</h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search + Totals */}
                <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" placeholder="Buscar..." className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl outline-none" value={q} onChange={e => setQ(e.target.value)} autoFocus />
                    </div>
                    <div className="flex gap-4 text-right">
                        <div><p className="text-[9px] text-slate-400 font-bold">V{versionA}</p><p className="text-xs font-mono text-blue-600 font-bold"><CurrencyDisplay value={totalA} colorize={false} decimals={0} /></p></div>
                        <div><p className="text-[9px] text-slate-400 font-bold">V{versionB}</p><p className="text-xs font-mono text-purple-600 font-bold"><CurrencyDisplay value={totalB} colorize={false} decimals={0} /></p></div>
                        <div><p className="text-[9px] text-slate-400 font-bold">DELTA</p><p className="text-xs font-mono font-bold"><CurrencyDisplay value={totalDelta} decimals={0} /></p></div>
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
                                    <SortHeader label="Nombre" sortKey="nombre" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                                    <SortHeader label={`v${versionA}`} sortKey="monto_version_a" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} align="right" />
                                    <SortHeader label={`v${versionB}`} sortKey="monto_version_b" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} align="right" />
                                    <SortHeader label="Delta" sortKey="delta" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} align="right" />
                                    <SortHeader label="Estado" sortKey="status" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} align="center" />
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center py-8 text-gray-400">Sin datos</td></tr>
                                ) : filtered.map((row, idx) => (
                                    <tr
                                        key={row.id ?? idx}
                                        className={`border-b border-gray-50 hover:bg-blue-50/30 transition-colors ${clickable ? 'cursor-pointer' : ''}`}
                                        onClick={() => clickable && onRowClick(row)}
                                    >
                                        <td className="px-3 py-2">
                                            <div className="flex items-center gap-2 group">
                                                {clickable && (
                                                    <div className="w-5 h-5 rounded bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                                        <Eye className="w-3 h-3" />
                                                    </div>
                                                )}
                                                <span className="font-bold text-slate-700 uppercase tracking-tight">
                                                    {row.id ? `${row.id} - ${row.nombre}` : row.nombre}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono text-blue-600">
                                            <CurrencyDisplay value={row.monto_version_a} colorize={false} decimals={0} />
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono text-purple-600">
                                            <CurrencyDisplay value={row.monto_version_b} colorize={false} decimals={0} />
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono">
                                            <CurrencyDisplay value={row.delta} decimals={0} />
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            <StatusBadge status={row.status} />
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
