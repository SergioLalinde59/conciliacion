import { useState, useMemo } from 'react'
import { Eye, Plus, CheckCircle, AlertTriangle, Save } from 'lucide-react'
import { useClasificacionPreview, usePresupuestos, PRESUPUESTO_KEYS } from '../hooks/usePresupuesto'
import { useReglaPresupuestoMutations } from '../hooks/useReglasPresupuesto'
import { useTiposGasto } from '../hooks/useTiposGasto'
import { useIndicadores } from '../hooks/useIndicadores'
import { usePerspectiva } from '../hooks/usePerspectiva'
import PerspectiveSelector from '../components/molecules/PerspectiveSelector'
import { useQueryClient } from '@tanstack/react-query'
import type { ClasificacionPreviewItem } from '../types/Presupuesto'
import { DataTable, type Column } from '../components/molecules/DataTable'
import { selectionColumn, textoColumn, cifraColumn, monedaColumn } from '../components/atoms/columnHelpers'
import { EntitySelector } from '../components/molecules/entities/EntitySelector'
import { ClasificacionDetalleModal } from '../components/organisms/modals/ClasificacionDetalleModal'

const CURRENT_YEAR = new Date().getFullYear()

const tipoBadgeColor: Record<string, string> = {
    Fijo: 'bg-blue-100 text-blue-700',
    Variable: 'bg-green-100 text-green-700',
    Salarial: 'bg-purple-100 text-purple-700',
    Estacional: 'bg-amber-100 text-amber-700',
    'No Repetitivo': 'bg-red-100 text-red-700',
}

const nivelBadgeColor: Record<string, string> = {
    'CC+Concepto': 'bg-emerald-100 text-emerald-700',
    'CC': 'bg-blue-100 text-blue-700',
    'Global': 'bg-indigo-100 text-indigo-700',
    'Auto': 'bg-cyan-100 text-cyan-700',
    'Default': 'bg-amber-100 text-amber-700',
}

const nivelMatchTooltip: Record<string, string> = {
    'CC+Concepto': 'Regla explícita para esta combinación exacta de CC + Concepto',
    'CC': 'Regla asignada a todo el centro de costo',
    'Global': 'Regla general que aplica a todas las combinaciones',
    'Auto': 'Clasificado inteligentemente por patrones de nombre y frecuencia',
    'Default': 'Sin clasificación específica, usa regla por defecto',
}

const tipoRowBg: Record<string, string> = {
    Fijo: 'bg-blue-50/40',
    Variable: '',
    Salarial: 'bg-purple-50/40',
    Estacional: 'bg-amber-50/30',
    'No Repetitivo': 'bg-red-50/25',
}

const rowKey = (r: ClasificacionPreviewItem) => `${r.centro_costo_id}-${r.concepto_id}`

export const ClasificacionGastosPreviewPage = () => {
    const [anio, setAnio] = useState(CURRENT_YEAR - 1)
    const [filtroCCId, setFiltroCCId] = useState<number | null>(null)
    const [filtroConceptoId, setFiltroConceptoId] = useState<number | null>(null)
    const [soloSinRegla, setSoloSinRegla] = useState(true)
    const [filtroMontoMin, setFiltroMontoMin] = useState(false)
    const [filtroTipoGasto, setFiltroTipoGasto] = useState<string | null>(null)
    const [showModal, setShowModal] = useState(false)
    const [prefilledRow, setPrefilledRow] = useState<ClasificacionPreviewItem | null>(null)
    const [selected, setSelected] = useState<Set<string | number>>(new Set())
    const [bulkMode, setBulkMode] = useState(false)
    const [detalleRow, setDetalleRow] = useState<ClasificacionPreviewItem | null>(null)

    // Perspectiva
    const { perspectivas, selectedSlug, setSelectedSlug, filterParams } = usePerspectiva()

    const { data: items = [], isLoading } = useClasificacionPreview(anio, filterParams.centros_costos_excluidos, undefined, filterParams.centros_costos_incluidos)
    const { data: presupuestos = [] } = usePresupuestos()
    const umbralMinimoAnual = (presupuestos.find(p => p.estado === 'activo') ?? presupuestos[0])?.umbral_minimo_anual ?? 0
    const { crear, crearLote: crearLoteMutation } = useReglaPresupuestoMutations()
    const { data: tiposGasto = [] } = useTiposGasto()
    const { data: indicadores = [] } = useIndicadores()
    const { data: indicadoresTarget = [] } = useIndicadores(anio + 1)
    const qc = useQueryClient()

    const nombresIndicador = [...new Set(indicadores.map(i => i.indicador))]

    // Map indicador_nombre → valor_porcentaje del año destino para calcular presupuesto
    const indicadorMap = useMemo(() => {
        const map = new Map<string, number>()
        indicadoresTarget.forEach(i => map.set(i.indicador, i.valor_porcentaje))
        return map
    }, [indicadoresTarget])

    // Map tipo → descripción para tooltips
    const tipoDescMap = useMemo(() => {
        const map = new Map<string, string>()
        tiposGasto.forEach(t => map.set(t.tipo, t.descripcion || t.tipo))
        return map
    }, [tiposGasto])

    const [form, setForm] = useState({
        centro_costo_id: null as number | null,
        concepto_id: null as number | null,
        tipo_gasto: 'Variable',
        indicador_nombre: 'IPC Colombia',
        factor_ajuste: 0,
        notas: '' as string | null,
    })

    // Opciones únicas de CC y Concepto derivadas de los datos
    const opcionesCC = useMemo(() => {
        const map = new Map<number, string>()
        items.forEach(r => { if (!map.has(r.centro_costo_id)) map.set(r.centro_costo_id, r.centro_costo_nombre) })
        return [...map.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre))
    }, [items])

    const opcionesConcepto = useMemo(() => {
        const base = filtroCCId !== null ? items.filter(r => r.centro_costo_id === filtroCCId) : items
        const map = new Map<number, string>()
        base.forEach(r => {
            if (r.concepto_id !== null && !map.has(r.concepto_id))
                map.set(r.concepto_id, r.concepto_nombre || '')
        })
        return [...map.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre))
    }, [items, filtroCCId])

    // Filtrar en 2 etapas: base (CC/Concepto/sinRegla) y final (+tipoGasto)
    const baseFiltered = useMemo(() => {
        let result = items
        if (soloSinRegla) result = result.filter(r => !['CC+Concepto', 'CC'].includes(r.nivel_match))
        if (filtroMontoMin && umbralMinimoAnual > 0) result = result.filter(r => r.monto_total > umbralMinimoAnual)
        if (filtroCCId !== null) result = result.filter(r => r.centro_costo_id === filtroCCId)
        if (filtroConceptoId !== null) result = result.filter(r => r.concepto_id === filtroConceptoId)
        return result
    }, [items, soloSinRegla, filtroMontoMin, umbralMinimoAnual, filtroCCId, filtroConceptoId])

    // Conteos por tipo de gasto (sobre baseFiltered, sin filtro de tipo)
    const tipoCounts = useMemo(() => {
        const map = new Map<string, number>()
        baseFiltered.forEach(r => map.set(r.tipo_gasto, (map.get(r.tipo_gasto) || 0) + 1))
        return map
    }, [baseFiltered])

    const filtered = useMemo(() => {
        if (filtroTipoGasto === null) return baseFiltered
        return baseFiltered.filter(r => r.tipo_gasto === filtroTipoGasto)
    }, [baseFiltered, filtroTipoGasto])

    // Calcular proyección de una fila
    const calcRowPpto = (r: ClasificacionPreviewItem) => {
        if (r.monto_fijo_mensual != null) return r.monto_fijo_mensual * 12
        const pct = r.indicador_nombre ? (indicadorMap.get(r.indicador_nombre) || 0) : 0
        return r.monto_total * (1 + (pct + r.factor_ajuste) / 100)
    }

    // Resumen (basado en datos filtrados)
    const resumen = useMemo(() => {
        const total = filtered.length
        const conRegla = filtered.filter(r => ['CC+Concepto', 'CC'].includes(r.nivel_match)).length
        const autoClasificado = filtered.filter(r => r.nivel_match === 'Auto').length
        const sinRegla = total - conRegla - autoClasificado
        const cobertura = total > 0 ? Math.round(((conRegla + autoClasificado) / total) * 100) : 0
        const totalAnterior = filtered.reduce((sum, r) => sum + r.monto_total, 0)
        const totalPpto = filtered.reduce((sum, r) => sum + calcRowPpto(r), 0)
        const aumentoPromedio = totalAnterior > 0 ? ((totalPpto - totalAnterior) / totalAnterior) * 100 : 0
        return { total, conRegla, autoClasificado, sinRegla, cobertura, totalAnterior, totalPpto, aumentoPromedio }
    }, [filtered, indicadorMap])

    const handleTipoChange = (tipo: string) => {
        const tipoGasto = tiposGasto.find(t => t.tipo === tipo)
        setForm({
            ...form,
            tipo_gasto: tipo,
            indicador_nombre: tipoGasto?.indicador_default || form.indicador_nombre
        })
    }

    const openBulkCrear = () => {
        setBulkMode(true)
        setPrefilledRow(null)
        const tipoDefault = tiposGasto.length > 0 ? tiposGasto[0] : null
        setForm({
            centro_costo_id: null,
            concepto_id: null,
            tipo_gasto: tipoDefault?.tipo || 'Variable',
            indicador_nombre: tipoDefault?.indicador_default || 'IPC Colombia',
            factor_ajuste: 0,
            notas: '',
        })
        setShowModal(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (bulkMode) {
            const selItems = items.filter(r => selected.has(rowKey(r)))
            for (const item of selItems) {
                await crear.mutateAsync({
                    centro_costo_id: item.centro_costo_id,
                    concepto_id: item.concepto_id,
                    tipo_gasto: form.tipo_gasto,
                    indicador_nombre: form.indicador_nombre,
                    factor_ajuste: form.factor_ajuste,
                    monto_fijo_mensual: null,
                    notas: form.notas,
                })
            }
            setSelected(new Set())
        } else {
            await crear.mutateAsync({ ...form, monto_fijo_mensual: null })
        }
        setShowModal(false)
        qc.invalidateQueries({ queryKey: PRESUPUESTO_KEYS.clasificacionPreview(anio, filterParams.centros_costos_excluidos) })
    }

    // Crear regla rápida con los valores de auto-clasificación actuales
    const handleQuickCreate = async (row: ClasificacionPreviewItem) => {
        await crear.mutateAsync({
            centro_costo_id: row.centro_costo_id,
            concepto_id: row.concepto_id,
            tipo_gasto: row.tipo_gasto,
            indicador_nombre: row.indicador_nombre,
            factor_ajuste: row.factor_ajuste,
            monto_fijo_mensual: row.monto_fijo_mensual,
            notas: 'Auto-clasificado',
        })
        qc.invalidateQueries({ queryKey: PRESUPUESTO_KEYS.clasificacionPreview(anio, filterParams.centros_costos_excluidos) })
    }

    // Guardar seleccionadas como reglas (batch con auto-clasificación)
    const handleBulkQuickSave = async () => {
        const selItems = items.filter(r => selected.has(rowKey(r)) && !['CC+Concepto', 'CC'].includes(r.nivel_match))
        await crearLoteMutation.mutateAsync(selItems.map(item => ({
            centro_costo_id: item.centro_costo_id,
            concepto_id: item.concepto_id,
            tipo_gasto: item.tipo_gasto,
            indicador_nombre: item.indicador_nombre,
            factor_ajuste: item.factor_ajuste,
            monto_fijo_mensual: item.monto_fijo_mensual,
            notas: 'Auto-clasificado (lote)',
        })))
        setSelected(new Set())
        qc.invalidateQueries({ queryKey: PRESUPUESTO_KEYS.clasificacionPreview(anio, filterParams.centros_costos_excluidos) })
    }

    // Guardar TODA la auto-clasificación visible como reglas (batch)
    const handleSaveAllAuto = async () => {
        const autoItems = filtered.filter(r => r.nivel_match === 'Auto')
        await crearLoteMutation.mutateAsync(autoItems.map(item => ({
            centro_costo_id: item.centro_costo_id,
            concepto_id: item.concepto_id,
            tipo_gasto: item.tipo_gasto,
            indicador_nombre: item.indicador_nombre,
            factor_ajuste: item.factor_ajuste,
            monto_fijo_mensual: item.monto_fijo_mensual,
            notas: 'Auto-clasificado',
        })))
        qc.invalidateQueries({ queryKey: PRESUPUESTO_KEYS.clasificacionPreview(anio, filterParams.centros_costos_excluidos) })
    }

    const [savingAll, setSavingAll] = useState(false)

    const years = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 1 - i)

    const selectedItems = useMemo(
        () => items.filter(r => selected.has(rowKey(r))),
        [items, selected]
    )

    const formatMonto = (v: number) =>
        v.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

    // --- Columnas DataTable ---
    const columns: Column<ClasificacionPreviewItem>[] = useMemo(() => [
        selectionColumn<ClasificacionPreviewItem>(
            (row) => selected.has(rowKey(row)),
            (row, checked) => {
                const next = new Set(selected)
                const key = rowKey(row)
                if (checked) next.add(key); else next.delete(key)
                setSelected(next)
            },
            filtered.length > 0 && filtered.every(r => selected.has(rowKey(r))),
            (checked) => {
                if (checked) setSelected(new Set(filtered.map(rowKey)))
                else setSelected(new Set())
            }
        ),
        {
            key: 'accion',
            header: (
                <div className="flex flex-col items-center gap-0.5">
                    <span>Acción</span>
                    {selected.size > 0 && (
                        <button onClick={(e) => { e.stopPropagation(); handleBulkQuickSave() }}
                            className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded hover:bg-emerald-700"
                            title={`Guardar ${selected.size} reglas seleccionadas`}>
                            ++
                        </button>
                    )}
                </div>
            ),
            sortable: false,
            align: 'center' as const,
            width: 'w-20',
            accessor: (row: ClasificacionPreviewItem) => (
                <div className="flex items-center justify-center gap-1">
                    {['CC+Concepto', 'CC'].includes(row.nivel_match) ? (
                        <CheckCircle size={14} className="text-emerald-500" />
                    ) : (
                        <button onClick={(e) => { e.stopPropagation(); handleQuickCreate(row) }}
                            className="w-6 h-6 flex items-center justify-center text-blue-600 hover:bg-blue-100 rounded"
                            title="Crear regla con auto-clasificación actual">
                            <Plus size={14} />
                        </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); setDetalleRow(row) }}
                        className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded"
                        title="Ver detalle y editar regla">
                        <Eye size={14} />
                    </button>
                </div>
            ),
        },
        textoColumn<ClasificacionPreviewItem>('centro_costo', 'Centro Costo',
            (row) => row.centro_costo_nombre || '',
            {
                accessor: (row) => (
                    <span className="text-[13px]">
                        <span className="text-gray-400 font-mono">{row.centro_costo_id}</span>
                        <span className="text-gray-300 mx-1">-</span>
                        <span className="text-gray-700">{row.centro_costo_nombre}</span>
                    </span>
                ),
            }
        ),
        textoColumn<ClasificacionPreviewItem>('concepto', 'Concepto',
            (row) => row.concepto_nombre || '',
            {
                accessor: (row) => row.concepto_id != null
                    ? <span className="text-[13px]">
                        <span className="text-gray-400 font-mono">{row.concepto_id}</span>
                        <span className="text-gray-300 mx-1">-</span>
                        <span className="text-gray-600">{row.concepto_nombre}</span>
                      </span>
                    : <span className="text-gray-400 italic text-[13px]">Sin concepto</span>,
            }
        ),
        cifraColumn<ClasificacionPreviewItem>('meses', 'Meses',
            (row) => row.meses_activos,
            {
                colorize: false, align: 'center',
                accessor: (row) => (
                    <span className={`font-mono text-sm font-bold ${row.meses_activos <= 4 ? 'text-amber-600' : ''}`}>
                        {row.meses_activos}
                    </span>
                ),
            }
        ),
        monedaColumn<ClasificacionPreviewItem>('monto_total', `Total ${anio}`,
            (row) => row.monto_total, 'COP', { colorize: false }
        ),
        {
            key: 'nivel_match',
            header: 'Match',
            sortable: true,
            sortValue: (row: ClasificacionPreviewItem) => row.nivel_match,
            align: 'center' as const,
            tooltip: 'Nivel de coincidencia con reglas de clasificación',
            accessor: (row: ClasificacionPreviewItem) => (
                <span className={`px-2 py-1 rounded text-xs font-medium cursor-help ${nivelBadgeColor[row.nivel_match] || 'bg-slate-100'}`}
                    title={nivelMatchTooltip[row.nivel_match] || ''}>
                    {row.nivel_match}
                </span>
            ),
        },
        {
            key: 'tipo_gasto',
            header: 'Tipo Gasto',
            sortable: true,
            sortValue: (row: ClasificacionPreviewItem) => row.tipo_gasto,
            align: 'left' as const,
            tooltip: 'Categoría del gasto que determina el indicador económico aplicable',
            accessor: (row: ClasificacionPreviewItem) => (
                <span className={`px-2 py-1 rounded text-xs font-medium cursor-help ${tipoBadgeColor[row.tipo_gasto] || 'bg-slate-100 text-slate-700'}`}
                    title={tipoDescMap.get(row.tipo_gasto) || row.tipo_gasto}>
                    {row.tipo_gasto}
                </span>
            ),
        },
        {
            key: 'indicador',
            header: 'Indicador',
            sortable: true,
            sortValue: (row: ClasificacionPreviewItem) => row.monto_fijo_mensual != null ? 'Monto Fijo' : (row.indicador_nombre || ''),
            align: 'left' as const,
            tooltip: 'Indicador económico usado para proyectar el presupuesto',
            accessor: (row: ClasificacionPreviewItem) => {
                if (row.monto_fijo_mensual != null) {
                    return (
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium cursor-help"
                            title={`Monto fijo: ${formatMonto(row.monto_fijo_mensual)}/mes`}>
                            Fijo ({formatMonto(row.monto_fijo_mensual)}/mes)
                        </span>
                    )
                }
                const pct = row.indicador_nombre ? indicadorMap.get(row.indicador_nombre) : undefined
                return (
                    <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-medium cursor-help"
                        title={pct != null ? `${row.indicador_nombre}: ${pct}% para ${anio + 1}` : (row.indicador_nombre || '')}>
                        {row.indicador_nombre}{pct != null ? ` (${pct}%)` : ''}
                    </span>
                )
            },
        },
        {
            key: 'factor',
            header: 'Factor',
            sortable: true,
            type: 'number' as const,
            sortValue: (row: ClasificacionPreviewItem) => row.factor_ajuste,
            align: 'right' as const,
            cellClassName: 'font-mono text-sm',
            tooltip: 'Ajuste adicional sobre el indicador. Ppto = Base × (1 + (Indicador% + Factor%) / 100)',
            accessor: (row: ClasificacionPreviewItem) => (
                <span>{row.factor_ajuste !== 0 ? `+${row.factor_ajuste}%` : '-'}</span>
            ),
        },
        {
            key: 'presupuesto',
            header: `Ppto ${anio + 1}`,
            sortable: true,
            type: 'number' as const,
            sortValue: (row: ClasificacionPreviewItem) => calcRowPpto(row),
            align: 'right' as const,
            tooltip: `Presupuesto proyectado ${anio + 1}`,
            accessor: (row: ClasificacionPreviewItem) => {
                const projected = calcRowPpto(row)
                return (
                    <span className="font-mono text-sm font-semibold text-slate-700">
                        {projected.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}
                    </span>
                )
            },
        },
    ], [selected, filtered, indicadorMap, anio, tipoDescMap])

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Eye size={24} /> Clasificación de Gastos
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Preview de reglas aplicadas a cada combinación CC/Concepto del año fuente
                    </p>
                </div>
                <select value={anio} onChange={e => setAnio(Number(e.target.value))}
                    className="border rounded-lg px-3 py-2 text-sm font-medium">
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-xl shadow p-4 mb-4">
                <div className="flex items-center gap-3 flex-wrap">
                    <EntitySelector
                        value={filtroCCId ?? ''}
                        onChange={(val) => {
                            setFiltroCCId(val ? Number(val) : null)
                            setFiltroConceptoId(null)
                        }}
                        options={opcionesCC}
                        showAllOption
                        allOptionLabel="Todos los Centros de Costo"
                        placeholder="Centro de Costo..."
                        className="min-w-[220px]"
                    />
                    <EntitySelector
                        value={filtroConceptoId ?? ''}
                        onChange={(val) => setFiltroConceptoId(val ? Number(val) : null)}
                        options={opcionesConcepto}
                        showAllOption
                        allOptionLabel="Todos los Conceptos"
                        placeholder="Concepto..."
                        className="min-w-[220px]"
                    />
                    {selected.size > 0 && (
                        <button onClick={openBulkCrear}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm ml-auto">
                            <Plus size={16} /> Crear Regla ({selected.size})
                        </button>
                    )}
                </div>
                {(perspectivas.length > 0 || resumen.autoClasificado > 0) && (
                    <div className="flex items-center gap-6 mt-3 pt-3 border-t border-slate-100">
                        {perspectivas.length > 0 && (
                            <PerspectiveSelector
                                perspectivas={perspectivas}
                                selectedSlug={selectedSlug}
                                onChange={setSelectedSlug}
                            />
                        )}
                        {resumen.autoClasificado > 0 && (
                            <button onClick={async () => {
                                if (!confirm(`¿Guardar las ${resumen.autoClasificado} auto-clasificaciones como reglas explícitas?`)) return
                                setSavingAll(true)
                                try { await handleSaveAllAuto() } finally { setSavingAll(false) }
                            }}
                                disabled={savingAll}
                                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50 ml-auto">
                                <Save size={16} /> {savingAll ? 'Guardando...' : `Guardar (${resumen.autoClasificado})`}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Resumen */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Tarjeta 1: Totales numéricos */}
                <div className="bg-white rounded-xl shadow p-4">
                    <div className="grid grid-cols-4 gap-4">
                        <div>
                            <p className="text-[10px] text-slate-400 uppercase font-semibold">Combinaciones</p>
                            <p className="text-xl font-bold text-slate-800">{resumen.total}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-400 uppercase font-semibold">Regla Explícita</p>
                            <p className="text-xl font-bold text-emerald-600">{resumen.conRegla}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-400 uppercase font-semibold">Auto-clasificado</p>
                            <p className="text-xl font-bold text-cyan-600">{resumen.autoClasificado}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-400 uppercase font-semibold">Cobertura</p>
                            <p className={`text-xl font-bold ${resumen.cobertura >= 80 ? 'text-emerald-600' : resumen.cobertura >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                {resumen.cobertura}%
                            </p>
                        </div>
                    </div>
                </div>
                {/* Tarjeta 2: Montos y aumento */}
                <div className="bg-white rounded-xl shadow p-4">
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <p className="text-[10px] text-slate-400 uppercase font-semibold">Total {anio}</p>
                            <p className="text-xl font-bold text-slate-800 font-mono">
                                {resumen.totalAnterior.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-400 uppercase font-semibold">Ppto {anio + 1}</p>
                            <p className="text-xl font-bold text-indigo-600 font-mono">
                                {resumen.totalPpto.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-400 uppercase font-semibold">Aumento Promedio</p>
                            <p className={`text-xl font-bold ${resumen.aumentoPromedio > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {resumen.aumentoPromedio > 0 ? '+' : ''}{resumen.aumentoPromedio.toFixed(1)}%
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabla */}
            <div className="bg-white rounded-xl shadow overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 space-y-2">
                    <h2 className="text-base font-bold text-slate-700">
                        Combinaciones CC / Concepto
                        <span className="text-slate-400 font-normal ml-2 text-sm">({filtered.length} de {items.length})</span>
                    </h2>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                                <input type="checkbox" checked={soloSinRegla} onChange={e => setSoloSinRegla(e.target.checked)}
                                    className="rounded" />
                                Solo sin regla explícita ({items.filter(r => !['CC+Concepto', 'CC'].includes(r.nivel_match)).length})
                            </label>
                            {umbralMinimoAnual > 0 && (
                                <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer"
                                    title={`Ocultar combinaciones con Total ${anio} ≤ ${formatMonto(umbralMinimoAnual)}`}>
                                    <input type="checkbox" checked={filtroMontoMin} onChange={e => setFiltroMontoMin(e.target.checked)}
                                        className="rounded" />
                                    &gt; Monto Mín. ({formatMonto(umbralMinimoAnual)})
                                </label>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {[...tipoCounts.entries()]
                                .sort(([a], [b]) => a.localeCompare(b))
                                .map(([tipo, count]) => (
                                    <button
                                        key={tipo}
                                        onClick={() => setFiltroTipoGasto(filtroTipoGasto === tipo ? null : tipo)}
                                        className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                                            filtroTipoGasto === tipo
                                                ? `${tipoBadgeColor[tipo] || 'bg-slate-200 text-slate-700'} ring-2 ring-offset-1 ring-current`
                                                : filtroTipoGasto === null
                                                    ? `${tipoBadgeColor[tipo] || 'bg-slate-100 text-slate-700'}`
                                                    : `${tipoBadgeColor[tipo] || 'bg-slate-100 text-slate-700'} opacity-40`
                                        }`}
                                        title={tipoDescMap.get(tipo) || tipo}
                                    >
                                        {tipo} ({count})
                                    </button>
                                ))}
                        </div>
                    </div>
                </div>
                <DataTable<ClasificacionPreviewItem>
                    data={filtered}
                    columns={columns}
                    loading={isLoading}
                    loadingMessage={`Cargando gastos de ${anio}...`}
                    emptyMessage={items.length === 0
                        ? `No se encontraron gastos para ${anio}`
                        : 'No hay resultados con los filtros actuales'}
                    getRowKey={(row) => rowKey(row)}
                    showActions={false}
                    defaultSortKey="monto_total"
                    defaultSortDirection="desc"
                    rowPy="py-2"
                    getRowClassName={(row) => tipoRowBg[row.tipo_gasto] || ''}
                />
                {filtered.length > 0 && (
                    <div className="px-4 py-3 bg-slate-50 text-xs text-slate-500 flex items-center gap-2">
                        <AlertTriangle size={14} className="text-cyan-500" />
                        Las filas "Auto" fueron clasificadas inteligentemente por patrones de nombre y frecuencia. Cree reglas explícitas (CC o CC+Concepto) para mayor control.
                    </div>
                )}
            </div>

            {/* Modal Crear Regla (individual o bulk) */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl">
                        <h2 className="text-lg font-bold mb-4">
                            {bulkMode ? `Crear Regla para ${selectedItems.length} combinaciones` : 'Crear Regla'}
                        </h2>

                        {/* Info de filas */}
                        {bulkMode ? (
                            <div className="mb-4 p-3 bg-slate-50 rounded-lg text-sm max-h-32 overflow-y-auto space-y-1">
                                {selectedItems.map(item => (
                                    <div key={rowKey(item)} className="flex justify-between">
                                        <span>
                                            <span className="font-medium">{item.centro_costo_nombre}</span>
                                            {item.concepto_nombre && <span className="text-slate-500"> / {item.concepto_nombre}</span>}
                                        </span>
                                        <span className="text-slate-400 text-xs">{item.meses_activos}m</span>
                                    </div>
                                ))}
                            </div>
                        ) : prefilledRow && (
                            <div className="mb-4 p-3 bg-slate-50 rounded-lg text-sm">
                                <span className="font-medium">{prefilledRow.centro_costo_nombre}</span>
                                {prefilledRow.concepto_nombre && (
                                    <> / <span className="font-medium">{prefilledRow.concepto_nombre}</span></>
                                )}
                                <span className="text-slate-500 ml-2">
                                    ({prefilledRow.meses_activos} meses, {formatMonto(prefilledRow.monto_total)})
                                </span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Gasto</label>
                                    <select value={form.tipo_gasto}
                                        onChange={e => handleTipoChange(e.target.value)}
                                        className="w-full border rounded-lg px-3 py-2 text-sm">
                                        {tiposGasto.map(t => (
                                            <option key={t.tipo} value={t.tipo}>{t.tipo}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Indicador</label>
                                    <select value={form.indicador_nombre}
                                        onChange={e => setForm({ ...form, indicador_nombre: e.target.value })}
                                        className="w-full border rounded-lg px-3 py-2 text-sm">
                                        {nombresIndicador.map(n => (
                                            <option key={n} value={n}>{n}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Factor Ajuste Adicional (%)</label>
                                <input type="number" step="0.01" value={form.factor_ajuste}
                                    onChange={e => setForm({ ...form, factor_ajuste: Number(e.target.value) })}
                                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                                <p className="text-xs text-slate-400 mt-1">Porcentaje adicional sobre el indicador</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
                                <input value={form.notas || ''} onChange={e => setForm({ ...form, notas: e.target.value })}
                                    className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Opcional" />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                                <button type="submit"
                                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                    {bulkMode ? `Crear ${selectedItems.length} Reglas` : 'Crear Regla'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Detalle (editar regla + desglose mensual + drill-down) */}
            {detalleRow && (
                <ClasificacionDetalleModal
                    isOpen={!!detalleRow}
                    onClose={() => setDetalleRow(null)}
                    row={detalleRow}
                    anioFuente={anio}
                    indicadorMap={indicadorMap}
                    tiposGasto={tiposGasto}
                    indicadores={indicadores}
                    onRuleChanged={() => {
                        qc.invalidateQueries({ queryKey: ['presupuestos', 'clasificacion-preview'] })
                    }}
                />
            )}
        </div>
    )
}
