import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Zap, Filter, Eye, Pencil, PlusCircle, X, TrendingUp, TrendingDown, Trash2, Loader2 } from 'lucide-react'
import { useReglasPresupuesto, useReglaPresupuestoMutations } from '../hooks/useReglasPresupuesto'
import { useTiposGasto } from '../hooks/useTiposGasto'
import { useIndicadores } from '../hooks/useIndicadores'
import { useConfiguracionExclusion } from '../hooks/useReportes'
import { usePresupuestos, useClasificacionPreview, PRESUPUESTO_KEYS } from '../hooks/usePresupuesto'
import { presupuestoService } from '../services/presupuesto.service'
import { reglasPresupuestoService } from '../services/reglasPresupuesto.service'
import type { ReglaPresupuesto } from '../types/ReglaPresupuesto'
import type { ClasificacionPreviewItem } from '../types/Presupuesto'
import { useQuery } from '@tanstack/react-query'
import { API_BASE_URL, handleResponse } from '../services/httpClient'
import { DataTable } from '../components/molecules/DataTable'
import type { Column } from '../components/molecules/DataTable'
import { FilterToggles } from '../components/molecules/FilterToggles'
import { MessageModal } from '../components/molecules/MessageModal'
import toast from 'react-hot-toast'

const formatMiles = (value: number | null): string => {
    if (value == null) return ''
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Math.round(value))
}

const parseMonto = (text: string): number | null => {
    const cleaned = text.replace(/[^\d]/g, '')
    return cleaned ? Number(cleaned) : null
}

const INITIAL_FORM = {
    centro_costo_id: null as number | null,
    concepto_id: null as number | null,
    tipo_gasto: 'Variable',
    indicador_nombre: 'IPC Colombia' as string | null,
    factor_ajuste: 0,
    monto_fijo_mensual: null as number | null,
    notas: '' as string | null,
}

const tipoBadgeColor: Record<string, string> = {
    Fijo: 'bg-blue-100 text-blue-700',
    Variable: 'bg-green-100 text-green-700',
    Salarial: 'bg-purple-100 text-purple-700',
    Estacional: 'bg-amber-100 text-amber-700',
    'No Repetitivo': 'bg-red-100 text-red-700',
}

interface CCGroup {
    cc_id: number
    cc_nombre: string
    conceptos: ClasificacionPreviewItem[]
    tipos: string[]
    totalAnual: number
    cantConceptos: number
    actual: number
    diferencia: number
    diferencia_pct: number
    gapCount: number
}

export const ReglasPresupuestoPage = () => {
    const { data: reglas = [] } = useReglasPresupuesto()
    const { crear, actualizar, eliminar } = useReglaPresupuestoMutations()
    const { data: tiposGasto = [] } = useTiposGasto()
    const { data: indicadores = [] } = useIndicadores()
    const [showReglaModal, setShowReglaModal] = useState(false)
    const [editando, setEditando] = useState<ReglaPresupuesto | null>(null)
    const [form, setForm] = useState(INITIAL_FORM)
    const [editingMonto, setEditingMonto] = useState<'mensual' | 'anual' | null>(null)
    const [rawMonto, setRawMonto] = useState('')
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null)

    // CC detail modal — almacena solo el ID, se deriva de ccGroups para que sea reactivo
    const [selectedCCId, setSelectedCCId] = useState<number | null>(null)

    // Presupuesto activo o borrador
    const currentYear = new Date().getFullYear()
    const { data: presupuestos = [] } = usePresupuestos(currentYear)
    const presupuestoActivo = useMemo(
        () => presupuestos.find(p => p.estado === 'activo') || presupuestos.find(p => p.estado === 'borrador'),
        [presupuestos]
    )
    const anioFuente = presupuestoActivo ? presupuestoActivo.anio - 1 : currentYear - 1
    const anioDestino = presupuestoActivo?.anio ?? currentYear

    // Filtros avanzados
    const { data: configExclusion = [] } = useConfiguracionExclusion()
    const [centrosCostosExcluidos, setCentrosCostosExcluidos] = useState<number[] | null>(null)
    const actualExcluidos = centrosCostosExcluidos || []

    useEffect(() => {
        if (configExclusion.length > 0 && centrosCostosExcluidos === null) {
            const defaults = configExclusion.filter(d => d.activo_por_defecto).map(d => d.centro_costo_id)
            setCentrosCostosExcluidos(defaults)
        }
    }, [configExclusion, centrosCostosExcluidos])

    // Datos de clasificacion-preview (fuente principal izquierda)
    const { data: previewItems = [], isLoading: loadingPreview } = useClasificacionPreview(anioFuente, actualExcluidos)

    // Indicadores del año destino para calcular presupuesto anual
    const { data: indicadoresTarget = [] } = useIndicadores(anioDestino)
    const indicadorMap = useMemo(() => {
        const map = new Map<string, number>()
        indicadoresTarget.forEach(i => map.set(i.indicador, i.valor_porcentaje))
        return map
    }, [indicadoresTarget])

    // Simulación de impacto (datos de presupuesto actual por CC)
    const { data: simulacionData } = useQuery({
        queryKey: PRESUPUESTO_KEYS.simulacion(presupuestoActivo?.id ?? 0, 0),
        queryFn: () => presupuestoService.simularReglas(presupuestoActivo!.id, {
            anio_fuente: anioFuente,
            centros_costos_excluidos: actualExcluidos,
        }),
        staleTime: 0,
        enabled: !!presupuestoActivo,
    })

    // Cálculo de presupuesto anual por fila
    const calcRowPpto = useCallback((r: ClasificacionPreviewItem) => {
        if (r.tipo_gasto === 'No Repetitivo') return 0
        if (r.monto_fijo_mensual != null) return r.monto_fijo_mensual * 12
        const pct = r.indicador_nombre ? (indicadorMap.get(r.indicador_nombre) || 0) : 0
        return r.monto_total * (1 + (pct + r.factor_ajuste) / 100)
    }, [indicadorMap])

    // Agrupar por CC (Pareto: mayor totalAnual primero)
    // No Repetitivos se muestran en el drill-down pero NO suman al total
    const ccGroups = useMemo<CCGroup[]>(() => {
        const map = new Map<number, { items: ClasificacionPreviewItem[]; nombre: string }>()
        previewItems.forEach(item => {
            const existing = map.get(item.centro_costo_id)
            if (existing) {
                existing.items.push(item)
            } else {
                map.set(item.centro_costo_id, { items: [item], nombre: item.centro_costo_nombre })
            }
        })

        // Mapa de actual por CC desde simulación
        const actualMap = new Map<number, number>()
        if (simulacionData?.detalle_por_cc) {
            simulacionData.detalle_por_cc.forEach(d => actualMap.set(d.cc_id, d.actual))
        }

        const groups: CCGroup[] = []
        map.forEach((val, ccId) => {
            const tipos = [...new Set(val.items.map(i => i.tipo_gasto))]
            const totalAnual = val.items
                .filter(i => i.tipo_gasto !== 'No Repetitivo')
                .reduce((sum, i) => sum + calcRowPpto(i), 0)
            const actual = actualMap.get(ccId) ?? 0
            const diferencia = totalAnual - actual
            const diferencia_pct = actual !== 0 ? Math.round(diferencia / actual * 1000) / 10 : (totalAnual > 0 ? 100 : 0)
            const gapCount = val.items.filter(i => i.nivel_match === 'Auto' || i.nivel_match === 'Default').length
            groups.push({
                cc_id: ccId,
                cc_nombre: val.nombre,
                conceptos: val.items.sort((a, b) => calcRowPpto(b) - calcRowPpto(a)),
                tipos,
                totalAnual,
                cantConceptos: val.items.length,
                actual,
                diferencia,
                diferencia_pct,
                gapCount,
            })
        })
        return groups.sort((a, b) => b.totalAnual - a.totalAnual)
    }, [previewItems, calcRowPpto, simulacionData])

    // CC seleccionado derivado de ccGroups (reactivo a cambios de datos)
    const selectedCC = useMemo(
        () => selectedCCId !== null ? ccGroups.find(g => g.cc_id === selectedCCId) ?? null : null,
        [selectedCCId, ccGroups]
    )

    // Reglas globales (sin CC)
    const reglasGlobales = useMemo(
        () => reglas.filter(r => !r.centro_costo_id),
        [reglas]
    )

    // Centros de costo y conceptos para el modal de crear
    const { data: centrosCosto = [] } = useQuery({
        queryKey: ['centros-costo-select'],
        queryFn: () => fetch(`${API_BASE_URL}/api/centros-costos`).then(handleResponse) as Promise<{ id: number; nombre: string }[]>,
        staleTime: 10 * 60 * 1000,
    })
    const { data: conceptos = [] } = useQuery({
        queryKey: ['conceptos-select'],
        queryFn: () => fetch(`${API_BASE_URL}/api/conceptos`).then(handleResponse) as Promise<{ id: number; nombre: string; centro_costo_id?: number }[]>,
        staleTime: 10 * 60 * 1000,
    })
    const conceptosForm = useMemo(() =>
        form.centro_costo_id ? conceptos.filter(c => c.centro_costo_id === form.centro_costo_id) : conceptos
    , [conceptos, form.centro_costo_id])

    const nombresIndicador = [...new Set(indicadores.map(i => i.indicador))]

    // --- Acciones ---

    const openCrear = (ccId?: number | null, conceptoId?: number | null) => {
        setEditando(null)
        setForm({ ...INITIAL_FORM, centro_costo_id: ccId ?? null, concepto_id: conceptoId ?? null })
        setEditingMonto(null)
        setShowReglaModal(true)
    }

    const openCrearDesdePreview = (item: ClasificacionPreviewItem) => {
        setEditando(null)
        const tipoGasto = tiposGasto.find(t => t.tipo === item.tipo_gasto)
        setForm({
            centro_costo_id: item.centro_costo_id,
            concepto_id: item.concepto_id,
            tipo_gasto: item.tipo_gasto,
            indicador_nombre: tipoGasto?.indicador_default ? (item.indicador_nombre || tipoGasto.indicador_default) : null,
            factor_ajuste: item.factor_ajuste,
            monto_fijo_mensual: item.monto_fijo_mensual,
            notas: '',
        })
        setEditingMonto(null)
        setShowReglaModal(true)
    }

    const openEditar = (r: ReglaPresupuesto) => {
        setEditando(r)
        setForm({
            centro_costo_id: r.centro_costo_id,
            concepto_id: r.concepto_id,
            tipo_gasto: r.tipo_gasto,
            indicador_nombre: r.indicador_nombre,
            factor_ajuste: r.factor_ajuste,
            monto_fijo_mensual: r.monto_fijo_mensual,
            notas: r.notas || '',
        })
        setEditingMonto(null)
        setShowReglaModal(true)
    }

    const openEditarDesdePreview = (item: ClasificacionPreviewItem) => {
        const regla = reglas.find(r => r.id === item.regla_id)
        if (regla) openEditar(regla)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            if (editando) {
                await actualizar.mutateAsync({
                    id: editando.id,
                    ...form,
                    centro_costo_nombre: undefined,
                    concepto_nombre: undefined,
                } as ReglaPresupuesto)
            } else {
                await crear.mutateAsync(form)
            }
            setShowReglaModal(false)
            // Si se creó desde sugerencias, remover de la lista
            if (editingSugerenciaKey) {
                setSugerencias(prev => prev.filter(s => s.key !== editingSugerenciaKey))
                setEditingSugerenciaKey(null)
            }
        } catch (err: any) {
            setErrorMsg(err?.message || 'Error al guardar la regla')
        }
    }

    const handleEliminar = async (id: number) => {
        await eliminar.mutateAsync(id)
    }

    // --- Modal de sugerencias en lote ---
    interface SugerenciaItem {
        key: string
        centro_costo_id: number
        concepto_id: number | null
        concepto_nombre: string | null
        tipo_gasto: string
        monto_total: number
        meses_activos: number
        selected: boolean
    }

    const [showSugerenciasModal, setShowSugerenciasModal] = useState(false)
    const [sugerencias, setSugerencias] = useState<SugerenciaItem[]>([])
    const [creandoLote, setCreandoLote] = useState(false)
    const [editingSugerenciaKey, setEditingSugerenciaKey] = useState<string | null>(null)

    const handleAbrirSugerencias = () => {
        if (!selectedCC) return
        const gaps = selectedCC.conceptos.filter(c =>
            c.nivel_match === 'Auto' || c.nivel_match === 'Default'
        )
        const items: SugerenciaItem[] = gaps.map(g => ({
            key: `${g.centro_costo_id}-${g.concepto_id}`,
            centro_costo_id: g.centro_costo_id,
            concepto_id: g.concepto_id,
            concepto_nombre: g.concepto_nombre,
            tipo_gasto: g.tipo_gasto,
            monto_total: g.monto_total,
            meses_activos: g.meses_activos,
            selected: true,
        }))
        setSugerencias(items)
        setShowSugerenciasModal(true)
    }

    const toggleSugerencia = (key: string) => {
        setSugerencias(prev => prev.map(s => s.key === key ? { ...s, selected: !s.selected } : s))
    }

    const toggleAllSugerencias = () => {
        const allSelected = sugerencias.every(s => s.selected)
        setSugerencias(prev => prev.map(s => ({ ...s, selected: !allSelected })))
    }

    const cambiarTipoSugerencia = (key: string, tipo: string) => {
        setSugerencias(prev => prev.map(s => s.key === key ? { ...s, tipo_gasto: tipo } : s))
    }

    const handleEditarSugerencia = (s: SugerenciaItem) => {
        const tipoGasto = tiposGasto.find(t => t.tipo === s.tipo_gasto)
        setEditando(null)
        setForm({
            centro_costo_id: s.centro_costo_id,
            concepto_id: s.concepto_id,
            tipo_gasto: s.tipo_gasto,
            indicador_nombre: tipoGasto?.indicador_default ? (tipoGasto.indicador_default) : null,
            factor_ajuste: 0,
            monto_fijo_mensual: null,
            notas: '',
        })
        setEditingMonto(null)
        setEditingSugerenciaKey(s.key)
        setShowReglaModal(true)
    }

    const handleConfirmarSugerencias = async () => {
        const seleccionadas = sugerencias.filter(s => s.selected)
        if (seleccionadas.length === 0) return
        setCreandoLote(true)
        try {
            const reglas = seleccionadas.map(s => {
                const tipoGasto = tiposGasto.find(t => t.tipo === s.tipo_gasto)
                return {
                    centro_costo_id: s.centro_costo_id,
                    concepto_id: s.concepto_id,
                    tipo_gasto: s.tipo_gasto,
                    indicador_nombre: tipoGasto?.indicador_default || null,
                    factor_ajuste: 0,
                    monto_fijo_mensual: null as number | null,
                    notas: 'Sugerida automáticamente',
                }
            })
            const res = await reglasPresupuestoService.crearLote(reglas)
            toast.success(`${res.creadas} reglas creadas${res.omitidas > 0 ? `, ${res.omitidas} omitidas` : ''}`)
            setShowSugerenciasModal(false)
        } catch (err: any) {
            setErrorMsg(err?.message || 'Error al crear reglas')
        } finally {
            setCreandoLote(false)
        }
    }

    // Tipo de gasto ↔ indicador/monto fijo
    const handleTipoChange = (tipo: string) => {
        const tipoGasto = tiposGasto.find(t => t.tipo === tipo)
        if (tipoGasto?.indicador_default) {
            setForm({ ...form, tipo_gasto: tipo, indicador_nombre: tipoGasto.indicador_default, monto_fijo_mensual: null })
        } else {
            setForm({ ...form, tipo_gasto: tipo, indicador_nombre: null, monto_fijo_mensual: form.monto_fijo_mensual })
        }
    }

    const tipoSeleccionado = tiposGasto.find(t => t.tipo === form.tipo_gasto)
    const usaMontoFijo = !tipoSeleccionado?.indicador_default

    // Monto fijo bidireccional
    const montoAnual = form.monto_fijo_mensual ? form.monto_fijo_mensual * 12 : null
    const mensualDisplay = editingMonto === 'mensual' ? rawMonto : formatMiles(form.monto_fijo_mensual)
    const anualDisplay = editingMonto === 'anual' ? rawMonto : formatMiles(montoAnual)
    const handleMensualFocus = () => { setEditingMonto('mensual'); setRawMonto(form.monto_fijo_mensual != null ? Math.round(form.monto_fijo_mensual).toString() : '') }
    const handleMensualChange = (text: string) => { setRawMonto(text); setForm({ ...form, monto_fijo_mensual: parseMonto(text) }) }
    const handleAnualFocus = () => { setEditingMonto('anual'); setRawMonto(montoAnual != null ? Math.round(montoAnual).toString() : '') }
    const handleAnualChange = (text: string) => { setRawMonto(text); const a = parseMonto(text); setForm({ ...form, monto_fijo_mensual: a ? a / 12 : null }) }
    const handleMontoBlur = () => setEditingMonto(null)


    // --- Tabla CC agrupada ---

    const ccColumns = useMemo<Column<CCGroup>[]>(() => [
        {
            key: 'eye',
            header: '',
            width: '40px',
            accessor: (r) => (
                <button onClick={() => setSelectedCCId(r.cc_id)} className="p-0.5">
                    <Eye size={16} className="text-slate-400 hover:text-blue-600 cursor-pointer" />
                </button>
            ),
        },
        {
            key: 'cc',
            header: 'Centro de Costo',
            sortable: true,
            sortValue: (r) => r.cc_nombre,
            accessor: (r) => (
                <div className="flex items-center gap-2">
                    <span className={`font-medium text-sm ${r.gapCount > 0 ? 'text-red-600' : ''}`}>
                        {r.cc_id} - {r.cc_nombre}
                    </span>
                    {r.gapCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold">
                            +{r.gapCount}
                        </span>
                    )}
                </div>
            ),
        },
        {
            key: 'cant',
            header: '#',
            sortable: true,
            sortValue: (r) => r.cantConceptos,
            align: 'center' as const,
            width: '50px',
            accessor: (r) => <span className="text-xs text-slate-500 font-mono">{r.cantConceptos}</span>,
        },
        {
            key: 'tipos',
            header: 'Tipos',
            accessor: (r) => (
                <div className="flex flex-wrap gap-1">
                    {r.tipos.map(t => (
                        <span key={t} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${tipoBadgeColor[t] || 'bg-slate-100 text-slate-700'}`}>
                            {t}
                        </span>
                    ))}
                </div>
            ),
        },
        {
            key: 'actual',
            header: 'Actual',
            sortable: true,
            sortValue: (r) => r.actual,
            align: 'right' as const,
            cellClassName: 'font-mono text-sm',
            accessor: (r) => `$${formatMiles(r.actual)}`,
        },
        {
            key: 'totalAnual',
            header: 'Proyectado',
            sortable: true,
            sortValue: (r) => r.totalAnual,
            align: 'right' as const,
            cellClassName: 'font-mono text-sm font-semibold',
            accessor: (r) => `$${formatMiles(r.totalAnual)}`,
        },
        {
            key: 'diferencia',
            header: 'Dif $',
            sortable: true,
            sortValue: (r) => r.diferencia,
            align: 'right' as const,
            cellClassName: 'font-mono text-sm',
            accessor: (r) => {
                const color = r.diferencia > 0 ? 'text-rose-600' : r.diferencia < 0 ? 'text-emerald-600' : 'text-slate-500'
                const prefix = r.diferencia > 0 ? '+' : ''
                return <span className={color}>{prefix}{formatMiles(r.diferencia)}</span>
            },
        },
        {
            key: 'diferencia_pct',
            header: '%',
            sortable: true,
            sortValue: (r) => r.diferencia_pct,
            align: 'right' as const,
            cellClassName: 'font-mono text-xs',
            accessor: (r) => {
                const color = r.diferencia_pct > 0 ? 'text-rose-600' : r.diferencia_pct < 0 ? 'text-emerald-600' : 'text-slate-500'
                const prefix = r.diferencia_pct > 0 ? '+' : ''
                return <span className={color}>{prefix}{r.diferencia_pct}%</span>
            },
        },
    ], [])

    // Columnas del drill-down por concepto
    const conceptoColumns = useMemo<Column<ClasificacionPreviewItem>[]>(() => [
        {
            key: 'acciones',
            header: '',
            width: '50px',
            accessor: (item) => {
                const tieneReglaEspecifica = item.regla_id != null && ['CC+Concepto', 'CC'].includes(item.nivel_match)
                return tieneReglaEspecifica ? (
                    <button onClick={(e) => { e.stopPropagation(); openEditarDesdePreview(item) }}
                        className="p-1 text-blue-600 hover:text-blue-800" title="Editar regla">
                        <Pencil size={14} />
                    </button>
                ) : (
                    <button onClick={(e) => { e.stopPropagation(); openCrearDesdePreview(item) }}
                        className="p-1 text-emerald-600 hover:text-emerald-800" title="Crear regla">
                        <PlusCircle size={14} />
                    </button>
                )
            },
        },
        {
            key: 'concepto',
            header: 'Concepto',
            sortable: true,
            sortValue: (item) => item.concepto_nombre || '',
            accessor: (item) => <span className="text-slate-700">{item.concepto_nombre || <span className="italic text-slate-400">Sin concepto</span>}</span>,
        },
        {
            key: 'regla',
            header: 'Regla',
            sortable: true,
            sortValue: (item) => item.nivel_match,
            accessor: (item) => (
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    item.nivel_match === 'CC+Concepto' ? 'bg-blue-50 text-blue-600' :
                    item.nivel_match === 'CC' ? 'bg-indigo-50 text-indigo-600' :
                    item.nivel_match === 'Global' ? 'bg-slate-100 text-slate-600' :
                    'bg-yellow-50 text-yellow-700'
                }`}>
                    {item.nivel_match}
                </span>
            ),
        },
        {
            key: 'tipo',
            header: 'Tipo',
            sortable: true,
            sortValue: (item) => item.tipo_gasto,
            accessor: (item) => (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${tipoBadgeColor[item.tipo_gasto] || 'bg-slate-100 text-slate-700'}`}>
                    {item.tipo_gasto}
                </span>
            ),
        },
        {
            key: 'base',
            header: 'Base Anual',
            sortable: true,
            sortValue: (item) => item.monto_total,
            align: 'right' as const,
            cellClassName: 'font-mono text-slate-500 text-xs',
            accessor: (item) => `$${formatMiles(item.monto_total)}`,
        },
        {
            key: 'ppto',
            header: 'Ppto Anual',
            sortable: true,
            sortValue: (item) => calcRowPpto(item),
            align: 'right' as const,
            cellClassName: 'font-mono font-medium',
            accessor: (item) => {
                const anual = calcRowPpto(item)
                const esNoRepetitivo = item.tipo_gasto === 'No Repetitivo'
                return <span className={esNoRepetitivo ? 'text-red-400' : 'text-slate-700'}>
                    ${formatMiles(anual)}
                </span>
            },
        },
    ], [calcRowPpto, reglas, tiposGasto])

    // Totales calculados desde ccGroups (tabla unificada)
    const totalActual = useMemo(() => ccGroups.reduce((sum, g) => sum + g.actual, 0), [ccGroups])
    const totalProyectado = useMemo(() => ccGroups.reduce((sum, g) => sum + g.totalAnual, 0), [ccGroups])
    const totalDiferencia = totalProyectado - totalActual
    const totalDiferenciaPct = totalActual !== 0 ? Math.round(totalDiferencia / totalActual * 1000) / 10 : 0

    // --- Render ---

    const hayDiferencia = totalDiferencia !== 0
    const DiffIcon = totalDiferencia > 0 ? TrendingUp : TrendingDown

    return (
        <div className="p-6 flex flex-col h-[calc(100vh-64px)]">
            {/* Header */}
            <div className="flex justify-between items-center mb-3 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Zap size={24} /> Reglas de Presupuesto
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Vista por Centro de Costo — Año fuente {anioFuente} → Ppto {anioDestino}
                    </p>
                </div>
                {presupuestoActivo && (
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                        presupuestoActivo.estado === 'activo' ? 'bg-green-100 text-green-700' :
                        presupuestoActivo.estado === 'borrador' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-slate-100 text-slate-600'
                    }`}>
                        {presupuestoActivo.nombre} — {presupuestoActivo.estado}
                    </span>
                )}
            </div>

            {/* Filtros avanzados */}
            {configExclusion.length > 0 && (
                <div className="bg-white rounded-xl shadow p-3 mb-3 flex-shrink-0">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 text-slate-400">
                            <Filter size={14} className="opacity-50" />
                            <span className="text-[9px] font-black uppercase tracking-[0.2em]">Filtros Avanzados</span>
                        </div>
                        <FilterToggles
                            configuracionExclusion={configExclusion}
                            centrosCostosExcluidos={actualExcluidos}
                            onCentrosCostosExcluidosChange={setCentrosCostosExcluidos}
                        />
                    </div>
                </div>
            )}

            {/* Cinta de resumen con totales */}
            {presupuestoActivo && (
                <div className="bg-white rounded-xl shadow px-6 py-4 mb-3 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-8">
                            <div className="text-center min-w-[120px]">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Ppto Actual</p>
                                <p className="text-lg font-bold text-slate-700 font-mono">
                                    ${formatMiles(totalActual)}
                                </p>
                            </div>
                            <div className="w-px h-10 bg-slate-200" />
                            <div className="text-center min-w-[120px]">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Proyectado</p>
                                <p className="text-lg font-bold text-slate-700 font-mono">
                                    ${formatMiles(totalProyectado)}
                                </p>
                            </div>
                            <div className="w-px h-10 bg-slate-200" />
                            <div className="text-center min-w-[140px]">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Diferencia</p>
                                <p className={`text-lg font-bold font-mono ${
                                    totalDiferencia > 0 ? 'text-rose-600' : totalDiferencia < 0 ? 'text-emerald-600' : 'text-slate-700'
                                }`}>
                                    {totalDiferencia > 0 ? '+' : ''}{formatMiles(totalDiferencia)}
                                    <span className="text-sm ml-1.5 font-semibold">({totalDiferenciaPct > 0 ? '+' : ''}{totalDiferenciaPct}%)</span>
                                </p>
                            </div>
                            {hayDiferencia && (
                                <>
                                    <div className="w-px h-10 bg-slate-200" />
                                    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
                                        totalDiferencia > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                                    }`}>
                                        <DiffIcon size={16} />
                                        <span>
                                            {totalDiferencia > 0 ? 'Aumentaría' : 'Reduciría'} <strong>${formatMiles(Math.abs(totalDiferencia))}</strong>
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                            Auto-regenerado al guardar reglas
                        </div>
                    </div>
                </div>
            )}

            {/* Tabla unificada */}
            <div className="flex-1 min-h-0 overflow-auto">
                <DataTable<CCGroup>
                    data={ccGroups}
                    columns={ccColumns}
                    loading={loadingPreview}
                    emptyMessage="No hay datos de gastos para el año fuente"
                    getRowKey={(r) => r.cc_id}
                    defaultSortKey="totalAnual"
                    defaultSortDirection="desc"
                    rowPy="py-2"
                    stickyHeader
                />

                {/* Reglas Globales */}
                {reglasGlobales.length > 0 && (
                    <div className="mt-4 bg-blue-50/50 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Reglas Globales (aplican a todos los CCs sin regla específica)
                            </h3>
                            <button onClick={() => openCrear()}
                                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                                <PlusCircle size={12} /> Nueva Global
                            </button>
                        </div>
                        <div className="space-y-2">
                            {reglasGlobales.map(r => (
                                <div key={r.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${tipoBadgeColor[r.tipo_gasto] || 'bg-slate-100 text-slate-700'}`}>
                                            {r.tipo_gasto}
                                        </span>
                                        <span className="text-sm text-slate-700">
                                            {r.monto_fijo_mensual
                                                ? `$${formatMiles(r.monto_fijo_mensual)}/mes`
                                                : r.indicador_nombre || '-'}
                                        </span>
                                        {r.factor_ajuste !== 0 && !r.monto_fijo_mensual && (
                                            <span className="text-xs text-slate-500">+{r.factor_ajuste}%</span>
                                        )}
                                        {r.notas && <span className="text-xs text-slate-400">{r.notas}</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => openEditar(r)}
                                            className="text-blue-600 hover:text-blue-800" title="Editar">
                                            <Pencil size={14} />
                                        </button>
                                        <button onClick={() => setConfirmModal({
                                            message: '¿Eliminar esta regla global?',
                                            onConfirm: () => { setConfirmModal(null); handleEliminar(r.id) }
                                        })}
                                            className="text-red-500 hover:text-red-700" title="Eliminar">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal detalle CC (drill-down por conceptos) */}
            {selectedCC && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedCCId(null)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">{selectedCC.cc_id} - {selectedCC.cc_nombre}</h2>
                                <p className="text-sm text-slate-500">
                                    {selectedCC.cantConceptos} conceptos — Total anual: <span className="font-mono font-semibold">${formatMiles(selectedCC.totalAnual)}</span>
                                    {selectedCC.conceptos.some(c => c.tipo_gasto === 'No Repetitivo') && (
                                        <span className="text-xs text-red-400 ml-2">(excluye No Repetitivos)</span>
                                    )}
                                    {selectedCC.gapCount > 0 && (
                                        <span className="text-red-500 font-semibold ml-2">({selectedCC.gapCount} sin regla)</span>
                                    )}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedCC.gapCount > 0 && (
                                    <button onClick={handleAbrirSugerencias}
                                        className="flex items-center gap-1.5 text-sm bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600">
                                        <Zap size={14} /> Crear {selectedCC.gapCount} sugeridas
                                    </button>
                                )}
                                <button onClick={() => openCrear(selectedCC.cc_id)}
                                    className="flex items-center gap-1.5 text-sm bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700">
                                    <PlusCircle size={14} /> Nueva Regla
                                </button>
                                <button onClick={() => setSelectedCCId(null)} className="text-slate-400 hover:text-slate-600">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        {/* Conceptos DataTable */}
                        <div className="flex-1 overflow-auto px-6 py-4">
                            <DataTable<ClasificacionPreviewItem>
                                data={selectedCC.conceptos}
                                columns={conceptoColumns}
                                getRowKey={(item, idx) => `${item.centro_costo_id}-${item.concepto_id}-${idx}`}
                                defaultSortKey="ppto"
                                defaultSortDirection="desc"
                                stickyHeader
                                rowPy="py-2"
                                rounded={false}
                                maxHeight="100%"
                                getRowClassName={(item) =>
                                    item.tipo_gasto === 'No Repetitivo' ? 'opacity-50' :
                                    (item.nivel_match === 'Auto' || item.nivel_match === 'Default') ? 'bg-red-50' : ''
                                }
                                emptyMessage="No hay conceptos para este centro de costo"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Modal sugerencias en lote */}
            {showSugerenciasModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[55]" onClick={() => !creandoLote && setShowSugerenciasModal(false)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">Reglas Sugeridas</h2>
                                <p className="text-sm text-slate-500">
                                    {selectedCC && <>{selectedCC.cc_id} - {selectedCC.cc_nombre} — </>}
                                    {sugerencias.filter(s => s.selected).length} de {sugerencias.length} seleccionadas
                                </p>
                            </div>
                            <button onClick={() => setShowSugerenciasModal(false)} className="text-slate-400 hover:text-slate-600" disabled={creandoLote}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto px-6 py-4">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left text-xs text-slate-500 uppercase tracking-wider">
                                        <th className="pb-2 pr-2 w-8">
                                            <input type="checkbox"
                                                checked={sugerencias.every(s => s.selected)}
                                                onChange={toggleAllSugerencias}
                                                className="rounded border-slate-300 accent-amber-500"
                                            />
                                        </th>
                                        <th className="pb-2 pr-2 w-8"></th>
                                        <th className="pb-2 pr-2">Concepto</th>
                                        <th className="pb-2 pr-2 w-36">Tipo</th>
                                        <th className="pb-2 pr-2 w-20 text-right">Base Anual</th>
                                        <th className="pb-2 w-16 text-center">Meses</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sugerencias.map(s => (
                                        <tr key={s.key} className={`border-b border-slate-100 ${!s.selected ? 'opacity-40' : ''}`}>
                                            <td className="py-2 pr-2">
                                                <input type="checkbox"
                                                    checked={s.selected}
                                                    onChange={() => toggleSugerencia(s.key)}
                                                    className="rounded border-slate-300 accent-amber-500"
                                                />
                                            </td>
                                            <td className="py-2 pr-2">
                                                <button onClick={() => handleEditarSugerencia(s)}
                                                    className="p-1 text-blue-500 hover:text-blue-700" title="Editar detalle">
                                                    <Pencil size={13} />
                                                </button>
                                            </td>
                                            <td className="py-2 pr-2 text-slate-700">
                                                {s.concepto_nombre || <span className="italic text-slate-400">Sin concepto</span>}
                                            </td>
                                            <td className="py-2 pr-2">
                                                <select
                                                    value={s.tipo_gasto}
                                                    onChange={e => cambiarTipoSugerencia(s.key, e.target.value)}
                                                    className={`w-full border rounded px-2 py-1 text-xs font-medium ${tipoBadgeColor[s.tipo_gasto] || 'bg-slate-50 text-slate-700'}`}
                                                >
                                                    {tiposGasto.map(t => (
                                                        <option key={t.tipo} value={t.tipo}>{t.tipo}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="py-2 pr-2 text-right font-mono text-slate-600">
                                                ${formatMiles(s.monto_total)}
                                            </td>
                                            <td className="py-2 text-center font-mono text-slate-400">
                                                {s.meses_activos}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex items-center justify-between px-6 py-4 border-t bg-slate-50 rounded-b-xl">
                            <span className="text-sm text-slate-500">
                                {sugerencias.filter(s => s.selected).length} reglas se crearán
                            </span>
                            <div className="flex items-center gap-3">
                                <button onClick={() => setShowSugerenciasModal(false)}
                                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                                    disabled={creandoLote}>
                                    Cancelar
                                </button>
                                <button onClick={handleConfirmarSugerencias}
                                    className="flex items-center gap-1.5 px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
                                    disabled={creandoLote || sugerencias.filter(s => s.selected).length === 0}>
                                    {creandoLote ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                                    Crear {sugerencias.filter(s => s.selected).length} reglas
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal crear/editar regla */}
            {showReglaModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
                    <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-2xl">
                        <h2 className="text-lg font-bold mb-4">{editando ? 'Editar' : 'Nueva'} Regla</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                {editando ? (
                                    <>
                                        <div>
                                            <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Centro de Costo</span>
                                            <p className="border rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-700 font-medium">
                                                {editando.centro_costo_nombre || <span className="text-slate-400 italic">Todos (Global)</span>}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Concepto</span>
                                            <p className="border rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-700 font-medium">
                                                {editando.concepto_nombre || <span className="text-slate-400 italic">Todos</span>}
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Centro de Costo</label>
                                            <select value={form.centro_costo_id ?? ''}
                                                onChange={e => setForm({ ...form, centro_costo_id: e.target.value ? Number(e.target.value) : null, concepto_id: null })}
                                                className="w-full border rounded-lg px-3 py-2 text-sm">
                                                <option value="">Todos (Global)</option>
                                                {centrosCosto.map(cc => (
                                                    <option key={cc.id} value={cc.id}>{cc.id} - {cc.nombre}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Concepto</label>
                                            <select value={form.concepto_id ?? ''}
                                                onChange={e => setForm({ ...form, concepto_id: e.target.value ? Number(e.target.value) : null })}
                                                className="w-full border rounded-lg px-3 py-2 text-sm">
                                                <option value="">Todos</option>
                                                {conceptosForm.map(c => (
                                                    <option key={c.id} value={c.id}>{c.id} - {c.nombre}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className={!usaMontoFijo ? 'grid grid-cols-2 gap-4' : ''}>
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
                                {!usaMontoFijo && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Indicador</label>
                                        <select value={form.indicador_nombre ?? ''}
                                            onChange={e => setForm({ ...form, indicador_nombre: e.target.value })}
                                            className="w-full border rounded-lg px-3 py-2 text-sm">
                                            {nombresIndicador.map(n => (
                                                <option key={n} value={n}>{n}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                            {usaMontoFijo && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Monto Fijo Mensual ($)</label>
                                        <input type="text" inputMode="numeric"
                                            value={mensualDisplay}
                                            onFocus={handleMensualFocus}
                                            onChange={e => handleMensualChange(e.target.value)}
                                            onBlur={handleMontoBlur}
                                            className="w-full border rounded-lg px-3 py-2 text-sm text-right" placeholder="ej: 1.410.000" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Presupuesto Anual ($)</label>
                                        <input type="text" inputMode="numeric"
                                            value={anualDisplay}
                                            onFocus={handleAnualFocus}
                                            onChange={e => handleAnualChange(e.target.value)}
                                            onBlur={handleMontoBlur}
                                            className="w-full border rounded-lg px-3 py-2 text-sm text-right" placeholder="ej: 16.920.000" />
                                    </div>
                                </div>
                            )}
                            {!usaMontoFijo && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Factor Ajuste Adicional (%)</label>
                                    <input type="number" step="0.01" value={form.factor_ajuste}
                                        onChange={e => setForm({ ...form, factor_ajuste: Number(e.target.value) })}
                                        className="w-full border rounded-lg px-3 py-2 text-sm" />
                                    <p className="text-xs text-slate-400 mt-1">Porcentaje adicional sobre el indicador. Ej: 2.0 = +2% extra</p>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
                                <input value={form.notas || ''} onChange={e => setForm({ ...form, notas: e.target.value })}
                                    className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Opcional" />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setShowReglaModal(false)}
                                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                                <button type="submit"
                                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                    {editando ? 'Guardar' : 'Crear'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <MessageModal message={errorMsg} onClose={() => setErrorMsg(null)} />
            <MessageModal
                message={confirmModal?.message ?? null}
                type="confirm"
                onClose={() => setConfirmModal(null)}
                onConfirm={confirmModal?.onConfirm}
            />
        </div>
    )
}
