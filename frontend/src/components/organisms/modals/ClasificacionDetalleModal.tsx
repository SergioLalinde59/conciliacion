import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { X, Save, BarChart3, ChevronRight } from 'lucide-react'
import { createPortal } from 'react-dom'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer, Legend
} from 'recharts'
import type { ClasificacionPreviewItem } from '../../../types/Presupuesto'
import type { TipoGasto } from '../../../types/TipoGasto'
import type { IndicadorEconomico } from '../../../types/IndicadorEconomico'
import { useDetalleMensual } from '../../../hooks/usePresupuesto'
import { useReglaPresupuestoMutations } from '../../../hooks/useReglasPresupuesto'
import { apiService } from '../../../services/api'
import { DataTable, type Column } from '../../molecules/DataTable'
import { DrilldownTable } from '../../molecules/DrilldownTable'
import { monedaColumn, textoColumn } from '../../atoms/columnHelpers'

interface Props {
    isOpen: boolean
    onClose: () => void
    row: ClasificacionPreviewItem
    anioFuente: number
    indicadorMap: Map<string, number>
    tiposGasto: TipoGasto[]
    indicadores: IndicadorEconomico[]
    onRuleChanged: () => void
}

const MES_NOMBRES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const tipoBadgeColor: Record<string, string> = {
    Fijo: 'bg-blue-100 text-blue-700',
    Variable: 'bg-green-100 text-green-700',
    Salarial: 'bg-purple-100 text-purple-700',
    Estacional: 'bg-amber-100 text-amber-700',
    'No Repetitivo': 'bg-red-100 text-red-700',
}

export const ClasificacionDetalleModal = ({
    isOpen, onClose, row, anioFuente, indicadorMap,
    tiposGasto, indicadores, onRuleChanged
}: Props) => {
    // --- State ---
    const [tab, setTab] = useState<'mensual' | 'drilldown' | 'regla'>('mensual')
    const [tipoGasto, setTipoGasto] = useState(row.tipo_gasto)
    const [indicadorNombre, setIndicadorNombre] = useState(row.indicador_nombre)
    const [factorAjuste, setFactorAjuste] = useState(row.factor_ajuste)
    const [montoFijoMensual, setMontoFijoMensual] = useState<number | null>(row.monto_fijo_mensual ?? null)
    const [notas, setNotas] = useState('')
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [editingMonto, setEditingMonto] = useState<'mensual' | 'anual' | null>(null)
    const [rawMonto, setRawMonto] = useState('')

    const esFijo = tipoGasto === 'Fijo'
    const esExcluido = tipoGasto === 'No Repetitivo'

    // Drill-down state
    const [terceros, setTerceros] = useState<any[]>([])
    const [terceroLoading, setTerceroLoading] = useState(false)
    const [movimientos, setMovimientos] = useState<{ isOpen: boolean; data: any[]; loading: boolean; title: string }>({
        isOpen: false, data: [], loading: false, title: ''
    })

    // Hover popover state for month detail
    const [hoverMes, setHoverMes] = useState<{
        mes: number; data: any[]; loading: boolean
        pos: { top: number; left: number }
    } | null>(null)
    const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const hoverCache = useRef<Map<number, any[]>>(new Map())

    const showMesPopover = useCallback((mes: number, top: number, left: number) => {
        if (hoverTimer.current) clearTimeout(hoverTimer.current)
        hoverTimer.current = setTimeout(async () => {
            const cached = hoverCache.current.get(mes)
            setHoverMes({
                mes, data: cached || [], loading: !cached,
                pos: { top, left }
            })
            if (!cached) {
                try {
                    const lastDay = new Date(anioFuente, mes, 0).getDate()
                    const desde = `${anioFuente}-${String(mes).padStart(2, '0')}-01`
                    const hasta = `${anioFuente}-${String(mes).padStart(2, '0')}-${lastDay}`
                    const response = await apiService.movimientos.listar({
                        centro_costo_id: row.centro_costo_id,
                        concepto_id: row.concepto_id || undefined,
                        desde, hasta,
                        limit: 100,
                        ver_egresos: true,
                    } as any)
                    const items = (response as any).items || []
                    hoverCache.current.set(mes, items)
                    setHoverMes(prev => prev?.mes === mes ? { ...prev, data: items, loading: false } : prev)
                } catch {
                    setHoverMes(prev => prev?.mes === mes ? { ...prev, loading: false } : prev)
                }
            }
        }, 300)
    }, [anioFuente, row.centro_costo_id, row.concepto_id])

    const handleMesHover = useCallback((mes: number, e: React.MouseEvent) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        showMesPopover(mes, rect.bottom + 4, rect.left)
    }, [showMesPopover])

    const handleBarHover = useCallback((data: any, _index: number, e: React.MouseEvent) => {
        const mesNum = data?.mesNum as number
        if (mesNum) showMesPopover(mesNum, e.clientY + 12, e.clientX - 100)
    }, [showMesPopover])

    const handleMesLeave = useCallback(() => {
        if (hoverTimer.current) clearTimeout(hoverTimer.current)
        setHoverMes(null)
    }, [])

    // Clear cache when row changes
    useEffect(() => { hoverCache.current.clear() }, [row])

    const { crear, actualizar } = useReglaPresupuestoMutations()

    // Monthly breakdown
    const { data: detalleMensual = [] } = useDetalleMensual(anioFuente, row.centro_costo_id, row.concepto_id)

    // Unique indicator names
    const nombresIndicador = useMemo(() =>
        [...new Set(indicadores.map(i => i.indicador))],
        [indicadores]
    )

    // Reset form when row changes
    useEffect(() => {
        setTipoGasto(row.tipo_gasto)
        setIndicadorNombre(row.indicador_nombre)
        setFactorAjuste(row.factor_ajuste)
        setMontoFijoMensual(row.monto_fijo_mensual ?? null)
        setNotas('')
        setSaveError(null)
        setEditingMonto(null)
        setTab('mensual')
        setTerceros([])
        setMovimientos({ isOpen: false, data: [], loading: false, title: '' })
    }, [row])

    // Projected amount calculation
    const calcProjected = (base: number) => {
        if (esExcluido) return 0
        if (esFijo && montoFijoMensual != null && montoFijoMensual > 0) {
            return montoFijoMensual  // Monto fijo mensual directo
        }
        const pct = indicadorNombre ? (indicadorMap.get(indicadorNombre) || 0) : 0
        return base * (1 + (pct + factorAjuste) / 100)
    }

    const montoProjectedTotal = esExcluido
        ? 0
        : esFijo && montoFijoMensual != null && montoFijoMensual > 0
            ? montoFijoMensual * 12
            : calcProjected(row.monto_total)
    const indicadorPct = indicadorNombre ? (indicadorMap.get(indicadorNombre) || 0) : 0

    // Chart data
    const chartData = useMemo(() =>
        detalleMensual.map(d => ({
            mes: MES_NOMBRES[d.mes - 1],
            mesNum: d.mes,
            [`Base ${anioFuente}`]: Math.round(d.monto),
            [`Ppto ${anioFuente + 1}`]: Math.round(calcProjected(d.monto)),
        })),
        [detalleMensual, indicadorNombre, factorAjuste, montoFijoMensual, esFijo, anioFuente]
    )

    // Handle tipo change → update indicador_default
    const handleTipoChange = (tipo: string) => {
        setTipoGasto(tipo)
        const tipoObj = tiposGasto.find(t => t.tipo === tipo)
        if (tipo === 'No Repetitivo') {
            setMontoFijoMensual(null)
            setIndicadorNombre(null as any)
            setFactorAjuste(0)
        } else if (tipo === 'Fijo') {
            // Pre-llenar con promedio mensual como sugerencia
            if (montoFijoMensual == null) {
                setMontoFijoMensual(Math.round(row.monto_total / 12))
            }
        } else {
            setMontoFijoMensual(null)
            if (tipoObj) setIndicadorNombre(tipoObj.indicador_default)
        }
    }

    // Save rule
    const handleSave = async () => {
        setSaving(true)
        setSaveError(null)
        try {
            const sinIndicador = esExcluido || (esFijo && montoFijoMensual)
            const payload = {
                centro_costo_id: row.centro_costo_id,
                concepto_id: row.concepto_id,
                tipo_gasto: tipoGasto,
                indicador_nombre: sinIndicador ? null : indicadorNombre,
                factor_ajuste: sinIndicador ? 0 : factorAjuste,
                monto_fijo_mensual: esFijo ? montoFijoMensual : null,
                notas: notas || null,
            }
            if (row.regla_id) {
                await actualizar.mutateAsync({ id: row.regla_id, ...payload })
            } else {
                await crear.mutateAsync(payload)
            }
            onRuleChanged()
            onClose()
        } catch (err: any) {
            console.error('Error guardando regla:', err)
            setSaveError(err?.message || 'Error al guardar la regla')
        } finally {
            setSaving(false)
        }
    }

    // Drill-down: load terceros
    const loadTerceros = async () => {
        setTerceroLoading(true)
        try {
            const data = await apiService.movimientos.reporteDesgloseGastos({
                nivel: 'tercero',
                centro_costo_id: row.centro_costo_id,
                concepto_id: row.concepto_id || undefined,
                fecha_inicio: `${anioFuente}-01-01`,
                fecha_fin: `${anioFuente}-12-31`,
                ver_egresos: true,
            } as any)
            setTerceros(data as any[])
        } finally {
            setTerceroLoading(false)
        }
    }

    useEffect(() => {
        if (tab === 'drilldown' && terceros.length === 0 && !terceroLoading) {
            loadTerceros()
        }
    }, [tab])

    // Drill-down: load movimientos for a tercero
    const handleTerceroClick = async (tercero: any) => {
        setMovimientos({ isOpen: true, data: [], loading: true, title: tercero.nombre })
        try {
            const response = await apiService.movimientos.listar({
                centro_costo_id: row.centro_costo_id,
                concepto_id: row.concepto_id || undefined,
                tercero_id: tercero.id,
                desde: `${anioFuente}-01-01`,
                hasta: `${anioFuente}-12-31`,
                limit: 1000,
                ver_egresos: true,
            } as any)
            setMovimientos(prev => ({
                ...prev,
                data: (response as any).items || [],
                loading: false
            }))
        } catch {
            setMovimientos(prev => ({ ...prev, loading: false }))
        }
    }

    const formatMonto = (v: number) =>
        v.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

    // Monto fijo: display y cálculo bidireccional mensual ↔ anual
    const formatMiles = (v: number | null) =>
        v != null ? new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Math.round(v)) : ''
    const parseMonto = (text: string) => {
        const cleaned = text.replace(/[^\d]/g, '')
        return cleaned ? Number(cleaned) : null
    }
    const montoAnual = montoFijoMensual ? montoFijoMensual * 12 : null
    const mensualDisplay = editingMonto === 'mensual' ? rawMonto : formatMiles(montoFijoMensual)
    const anualDisplay = editingMonto === 'anual' ? rawMonto : formatMiles(montoAnual)

    const handleMensualFocus = () => { setEditingMonto('mensual'); setRawMonto(montoFijoMensual?.toString() ?? '') }
    const handleMensualChange = (text: string) => { setRawMonto(text); setMontoFijoMensual(parseMonto(text)) }
    const handleAnualFocus = () => { setEditingMonto('anual'); setRawMonto(montoAnual?.toString() ?? '') }
    const handleAnualChange = (text: string) => {
        setRawMonto(text)
        const anual = parseMonto(text)
        setMontoFijoMensual(anual ? Math.round(anual / 12) : null)
    }
    const handleMontoBlur = () => setEditingMonto(null)

    if (!isOpen) return null

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-5xl max-h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b bg-slate-50 flex items-center justify-between flex-shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">
                            {row.centro_costo_nombre}
                            {row.concepto_nombre && (
                                <span className="text-slate-500 font-normal"> / {row.concepto_nombre}</span>
                            )}
                        </h2>
                        <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                            <span>{row.meses_activos} meses activos</span>
                            <span>|</span>
                            <span className="font-medium text-slate-700">{formatMonto(row.monto_total)}</span>
                            <span>→</span>
                            <span className={`font-bold ${esExcluido ? 'text-red-600' : 'text-blue-700'}`}>
                                {esExcluido ? 'Excluido' : formatMonto(montoProjectedTotal)}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${tipoBadgeColor[tipoGasto] || 'bg-slate-100'}`}>
                                {tipoGasto}
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b px-6 flex-shrink-0">
                    {[
                        { key: 'mensual' as const, label: 'CC - Concepto Mes' },
                        { key: 'drilldown' as const, label: 'Por Tercero' },
                        { key: 'regla' as const, label: 'Editar Regla' },
                    ].map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors
                                ${tab === t.key ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {/* Tab: Editar Regla */}
                    {tab === 'regla' && (
                        <div className="space-y-6">
                            {/* Preview en vivo */}
                            <div className={`bg-gradient-to-r rounded-xl p-5 border ${esExcluido ? 'from-red-50 to-orange-50 border-red-100' : 'from-blue-50 to-indigo-50 border-blue-100'}`}>
                                <h3 className="text-sm font-bold text-slate-700 mb-3">Preview Presupuesto</h3>
                                {esExcluido ? (
                                    <div className="grid grid-cols-2 gap-4 text-center">
                                        <div>
                                            <p className="text-xs text-slate-500">Base {anioFuente}</p>
                                            <p className="text-lg font-bold text-slate-700">{formatMonto(row.monto_total)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500">Ppto {anioFuente + 1}</p>
                                            <p className="text-lg font-bold text-red-600">Excluido</p>
                                            <p className="text-xs text-red-400 mt-1">
                                                Este gasto no se incluye en el presupuesto
                                            </p>
                                        </div>
                                    </div>
                                ) : esFijo && montoFijoMensual != null && montoFijoMensual > 0 ? (
                                    <>
                                        <div className="grid grid-cols-3 gap-4 text-center">
                                            <div>
                                                <p className="text-xs text-slate-500">Base {anioFuente}</p>
                                                <p className="text-lg font-bold text-slate-700">{formatMonto(row.monto_total)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500">Monto Fijo Mensual</p>
                                                <p className="text-lg font-bold text-indigo-600">{formatMonto(montoFijoMensual)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500">Ppto {anioFuente + 1}</p>
                                                <p className="text-lg font-bold text-blue-700">{formatMonto(montoFijoMensual * 12)}</p>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-2 text-center">
                                            {formatMonto(montoFijoMensual)} x 12 meses = {formatMonto(montoFijoMensual * 12)}
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-4 gap-4 text-center">
                                            <div>
                                                <p className="text-xs text-slate-500">Base {anioFuente}</p>
                                                <p className="text-lg font-bold text-slate-700">{formatMonto(row.monto_total)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500">Indicador</p>
                                                <p className="text-lg font-bold text-indigo-600">{indicadorPct}%</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500">Factor</p>
                                                <p className="text-lg font-bold text-amber-600">{factorAjuste !== 0 ? `+${factorAjuste}%` : '0%'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500">Ppto {anioFuente + 1}</p>
                                                <p className="text-lg font-bold text-blue-700">{formatMonto(montoProjectedTotal)}</p>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-2 text-center">
                                            {formatMonto(row.monto_total)} x (1 + ({indicadorPct}% + {factorAjuste}%) / 100) = {formatMonto(montoProjectedTotal)}
                                        </p>
                                    </>
                                )}
                            </div>

                            {/* CC / Concepto del registro */}
                            <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-lg">
                                <div>
                                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Centro de Costo</span>
                                    <p className="text-sm font-medium text-slate-700">
                                        <span className="text-slate-400 font-mono">{row.centro_costo_id}</span>
                                        <span className="text-slate-300 mx-1">-</span>
                                        {row.centro_costo_nombre}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Concepto</span>
                                    <p className="text-sm font-medium text-slate-700">
                                        {row.concepto_id ? (
                                            <>
                                                <span className="text-slate-400 font-mono">{row.concepto_id}</span>
                                                <span className="text-slate-300 mx-1">-</span>
                                                {row.concepto_nombre}
                                            </>
                                        ) : (
                                            <span className="text-slate-400 italic">Sin concepto</span>
                                        )}
                                    </p>
                                </div>
                            </div>

                            {/* Formulario */}
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Gasto</label>
                                    <select value={tipoGasto} onChange={e => handleTipoChange(e.target.value)}
                                        className="w-full border rounded-lg px-3 py-2 text-sm">
                                        {tiposGasto.map(t => (
                                            <option key={t.tipo} value={t.tipo}>{t.tipo}</option>
                                        ))}
                                    </select>
                                </div>
                                {esExcluido ? (
                                    <div className="col-span-2 flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-100 text-sm text-red-600">
                                        Este gasto no genera presupuesto. No requiere indicador ni factor de ajuste.
                                    </div>
                                ) : esFijo ? (
                                    <>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Monto Fijo Mensual ($)
                                        </label>
                                        <input type="text" inputMode="numeric"
                                            value={mensualDisplay}
                                            onFocus={handleMensualFocus}
                                            onChange={e => handleMensualChange(e.target.value)}
                                            onBlur={handleMontoBlur}
                                            placeholder={`Ej: ${formatMiles(Math.round(row.monto_total / 12))}`}
                                            className="w-full border rounded-lg px-3 py-2 text-sm font-mono text-right" />
                                        <p className="text-xs text-slate-400 mt-1">
                                            Prom. {anioFuente}: {formatMonto(Math.round(row.monto_total / 12))}/mes
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Presupuesto Anual ($)
                                        </label>
                                        <input type="text" inputMode="numeric"
                                            value={anualDisplay}
                                            onFocus={handleAnualFocus}
                                            onChange={e => handleAnualChange(e.target.value)}
                                            onBlur={handleMontoBlur}
                                            placeholder={`Ej: ${formatMiles(row.monto_total)}`}
                                            className="w-full border rounded-lg px-3 py-2 text-sm font-mono text-right" />
                                        <p className="text-xs text-slate-400 mt-1">
                                            Base {anioFuente}: {formatMonto(row.monto_total)}
                                        </p>
                                    </div>
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Indicador Económico</label>
                                            <select value={indicadorNombre || ''} onChange={e => setIndicadorNombre(e.target.value)}
                                                className="w-full border rounded-lg px-3 py-2 text-sm">
                                                {nombresIndicador.map(n => (
                                                    <option key={n} value={n}>{n} ({indicadorMap.get(n) || 0}%)</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Factor Ajuste (%)</label>
                                            <input type="number" step="0.1" value={factorAjuste}
                                                onChange={e => setFactorAjuste(Number(e.target.value))}
                                                className="w-full border rounded-lg px-3 py-2 text-sm" />
                                        </div>
                                    </>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
                                <input value={notas} onChange={e => setNotas(e.target.value)}
                                    className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Opcional" />
                            </div>
                            {saveError && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                    {saveError}
                                </div>
                            )}
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-xs text-slate-400">
                                    {row.regla_id ? `Regla #${row.regla_id} (${row.nivel_match})` : `Sin regla explícita (${row.nivel_match})`}
                                </span>
                                <button onClick={handleSave} disabled={saving}
                                    className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
                                    <Save size={16} /> {saving ? 'Guardando...' : row.regla_id ? 'Actualizar Regla' : 'Crear Regla'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Tab 2: Desglose Mensual */}
                    {tab === 'mensual' && (
                        <div className="space-y-6">
                            {/* Chart */}
                            {chartData.length > 0 && (
                                <div className="bg-white border rounded-xl p-4">
                                    <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                        <BarChart3 size={16} /> Base {anioFuente} vs Ppto {anioFuente + 1}
                                    </h3>
                                    <ResponsiveContainer width="100%" height={280}>
                                        <BarChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                                            <YAxis tick={{ fontSize: 11 }} tickFormatter={v =>
                                                v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}K`
                                            } />
                                            <RechartsTooltip
                                                formatter={(value) => formatMonto(Number(value))}
                                            />
                                            <Legend />
                                            <Bar dataKey={`Base ${anioFuente}`} fill="#94a3b8" radius={[2, 2, 0, 0]}
                                                cursor="pointer"
                                                onMouseEnter={handleBarHover}
                                                onMouseLeave={handleMesLeave} />
                                            <Bar dataKey={`Ppto ${anioFuente + 1}`} fill="#3b82f6" radius={[2, 2, 0, 0]}
                                                cursor="pointer"
                                                onMouseEnter={handleBarHover}
                                                onMouseLeave={handleMesLeave} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* Table */}
                            <DataTable
                                data={detalleMensual}
                                columns={[
                                    {
                                        key: 'mes', header: 'Mes', sortable: true,
                                        accessor: (r) => (
                                            <span
                                                className="cursor-pointer text-blue-600 hover:text-blue-800 hover:underline"
                                                onMouseEnter={(e) => handleMesHover(r.mes, e)}
                                                onMouseLeave={handleMesLeave}
                                            >
                                                {MES_NOMBRES[r.mes - 1]}
                                            </span>
                                        ),
                                        sortValue: (r) => r.mes,
                                    },
                                    {
                                        key: 'registros', header: 'Reg.', sortable: true, align: 'center' as const,
                                        accessor: (r) => <span className="font-mono text-sm text-slate-500">{(r as any).registros ?? '-'}</span>,
                                        sortValue: (r) => (r as any).registros ?? 0,
                                        tooltip: 'Número de registros en el mes',
                                    },
                                    monedaColumn('base', `Base ${anioFuente}`, (r) => r.monto, 'COP', { colorize: false }),
                                    ...(esFijo && montoFijoMensual != null && montoFijoMensual > 0 ? [
                                        {
                                            key: 'monto_fijo', header: 'Monto Fijo', align: 'right' as const,
                                            accessor: () => <span className="font-mono text-sm text-indigo-600">{formatMonto(montoFijoMensual)}</span>,
                                        },
                                    ] : [
                                        {
                                            key: 'indicador_pct', header: 'Indicador%', align: 'right' as const,
                                            accessor: () => <span className="font-mono text-sm">{indicadorPct}%</span>,
                                        },
                                        {
                                            key: 'factor_pct', header: 'Factor%', align: 'right' as const,
                                            accessor: () => <span className="font-mono text-sm">{factorAjuste !== 0 ? `+${factorAjuste}%` : '-'}</span>,
                                        },
                                    ]),
                                    monedaColumn('proyectado', `Ppto ${anioFuente + 1}`,
                                        (r) => calcProjected(r.monto), 'COP', { colorize: false }),
                                ] as Column<{ mes: number; monto: number }>[]}
                                getRowKey={(r) => r.mes}
                                showActions={false}
                                loading={detalleMensual.length === 0}
                                loadingMessage="Cargando desglose mensual..."
                                emptyMessage="Sin datos mensuales"
                            />
                        </div>
                    )}

                    {/* Tab 3: Drill-down por Tercero */}
                    {tab === 'drilldown' && (
                        <div>
                            <DataTable
                                data={terceros}
                                columns={[
                                    textoColumn('nombre', 'Tercero', (r: any) => r.nombre),
                                    monedaColumn('egresos', 'Egresos', (r: any) => Math.abs(r.egresos || 0), 'COP', { colorize: false }),
                                    {
                                        key: 'action', header: '', align: 'center' as const, width: 'w-10',
                                        accessor: (r: any) => (
                                            <button onClick={() => handleTerceroClick(r)}
                                                className="text-blue-600 hover:bg-blue-50 p-1 rounded">
                                                <ChevronRight size={16} />
                                            </button>
                                        )
                                    }
                                ] as Column<any>[]}
                                getRowKey={(r: any) => r.id || r.nombre}
                                showActions={false}
                                loading={terceroLoading}
                                loadingMessage="Cargando terceros..."
                                emptyMessage="Sin terceros para esta combinación"
                                defaultSortKey="egresos"
                                defaultSortDirection="desc"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Hover popover: movimientos del mes */}
            {hoverMes && (
                <div
                    className="fixed z-[70] bg-white rounded-xl shadow-2xl border border-slate-200 w-[520px] max-h-[320px] flex flex-col overflow-hidden"
                    style={{ top: hoverMes.pos.top, left: Math.min(hoverMes.pos.left, window.innerWidth - 540) }}
                    onMouseEnter={() => { if (hoverTimer.current) clearTimeout(hoverTimer.current) }}
                    onMouseLeave={handleMesLeave}
                >
                    <div className="px-4 py-2 border-b bg-slate-50 flex items-center justify-between flex-shrink-0">
                        <span className="text-sm font-bold text-slate-700">
                            Movimientos {MES_NOMBRES[hoverMes.mes - 1]} {anioFuente}
                        </span>
                        <span className="text-xs text-slate-400">
                            {hoverMes.loading ? 'Cargando...' : `${hoverMes.data.length} registros`}
                        </span>
                    </div>
                    <div className="flex-1 overflow-auto">
                        {hoverMes.loading ? (
                            <div className="p-6 text-center text-slate-400 text-sm">Cargando movimientos...</div>
                        ) : hoverMes.data.length === 0 ? (
                            <div className="p-6 text-center text-slate-400 text-sm">Sin movimientos</div>
                        ) : (
                            <table className="w-full text-xs">
                                <thead className="bg-slate-50 sticky top-0">
                                    <tr>
                                        <th className="px-3 py-1.5 text-left font-medium text-slate-500">Fecha</th>
                                        <th className="px-3 py-1.5 text-left font-medium text-slate-500">Tercero</th>
                                        <th className="px-3 py-1.5 text-left font-medium text-slate-500">Descripción</th>
                                        <th className="px-3 py-1.5 text-right font-medium text-slate-500">Valor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {hoverMes.data.map((m: any, i: number) => (
                                        <tr key={m.id || i} className="border-t border-slate-50 hover:bg-slate-50">
                                            <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">
                                                {new Date(m.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                                            </td>
                                            <td className="px-3 py-1.5 text-slate-600 truncate max-w-[120px]">{m.tercero_nombre || '-'}</td>
                                            <td className="px-3 py-1.5 text-slate-600 truncate max-w-[160px]">{m.descripcion || '-'}</td>
                                            <td className="px-3 py-1.5 text-right font-mono text-slate-700">
                                                {formatMonto(Math.abs(m.valor || 0))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Sub-modal: Movimientos por tercero */}
            {movimientos.isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
                    <div className="w-full max-w-5xl max-h-[85vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">
                        <div className="px-6 py-3 border-b bg-slate-50 flex items-center justify-between flex-shrink-0">
                            <h3 className="text-sm font-bold text-slate-700">
                                Movimientos: {movimientos.title}
                                <span className="text-slate-400 font-normal"> ({row.centro_costo_nombre}
                                    {row.concepto_nombre ? ` / ${row.concepto_nombre}` : ''})</span>
                            </h3>
                            <button onClick={() => setMovimientos(prev => ({ ...prev, isOpen: false }))}
                                className="p-1.5 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <DrilldownTable
                                data={movimientos.data}
                                loading={movimientos.loading}
                                loadingMessage="Cargando movimientos..."
                                emptyMessage="Sin movimientos"
                                columns={[
                                    {
                                        key: 'fecha', header: 'Fecha', sortable: true,
                                        accessor: (r: any) => new Date(r.fecha).toLocaleDateString('es-CO'),
                                        sortValue: (r: any) => r.fecha,
                                    },
                                    {
                                        key: 'referencia', header: 'Referencia',
                                        accessor: (r: any) => (
                                            <span className="text-xs text-slate-500">{r.referencia || '-'}</span>
                                        ),
                                    },
                                    {
                                        key: 'descripcion', header: 'Descripción',
                                        accessor: (r: any) => (
                                            <span className="text-sm">{r.descripcion}</span>
                                        ),
                                    },
                                    monedaColumn('valor', 'Valor', (r: any) => r.valor, 'COP'),
                                ]}
                                getRowKey={(r: any) => r.id}
                                showActions={false}
                                defaultSortKey="fecha"
                                defaultSortDirection="desc"
                                maxHeight="calc(85vh - 80px)"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body
    )
}
