import { useState, useEffect, useMemo, useCallback } from 'react'
import { Zap, Eye, Pencil, PlusCircle, X, TrendingUp, TrendingDown, Trash2, Loader2, AlertTriangle, Target, BarChart3, Wallet } from 'lucide-react'
import { useReglasPresupuesto, useReglaPresupuestoMutations } from '../hooks/useReglasPresupuesto'
import { useTiposGasto } from '../hooks/useTiposGasto'
import { useIndicadores } from '../hooks/useIndicadores'
import { useConfiguracionExclusion } from '../hooks/useReportes'
import { usePresupuestos, useClasificacionPreview, PRESUPUESTO_KEYS } from '../hooks/usePresupuesto'
import { presupuestoService } from '../services/presupuesto.service'
import { reglasPresupuestoService } from '../services/reglasPresupuesto.service'
import { dashboardService } from '../services/dashboard.service'
import type { ReglaPresupuesto } from '../types/ReglaPresupuesto'
import type { ClasificacionPreviewItem, GastoSinPresupuesto } from '../types/Presupuesto'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { DataTable } from '../components/molecules/DataTable'
import type { Column } from '../components/molecules/DataTable'
import { MessageModal } from '../components/molecules/MessageModal'
import { ReglasPendientesBanner } from '../components/molecules/ReglasPendientesBanner'
import { ReglaPresupuestoModal } from '../components/organisms/modals/ReglaPresupuestoModal'
import type { ReglaFormData } from '../components/organisms/modals/ReglaPresupuestoModal'
import { PresupuestoActionToolbar } from '../components/organisms/PresupuestoActionToolbar'
import { PresupuestoFormModal } from '../components/organisms/modals/PresupuestoFormModal'
import { PresupuestoGenerarModal } from '../components/organisms/modals/PresupuestoGenerarModal'
import { PresupuestoAjusteModal } from '../components/organisms/modals/PresupuestoAjusteModal'
import { NuevaLineaPresupuestoModal } from '../components/organisms/modals/NuevaLineaPresupuestoModal'
import { usePresupuestoActions } from '../hooks/usePresupuestoActions'
import { formatMiles } from '../utils/formatters'
import { DarkStatCard } from '../components/molecules/DarkStatCard'
import { useSettings } from '../context/SettingsContext'
import toast from 'react-hot-toast'

const tipoBadgeColor: Record<string, string> = {
    Fijo: 'bg-blue-100 text-blue-700',
    Variable: 'bg-green-100 text-green-700',
    Salarial: 'bg-purple-100 text-purple-700',
    Estacional: 'bg-amber-100 text-amber-700',
    'No Repetitivo': 'bg-red-100 text-red-700',
    'No Repetitivo - Ingresos': 'bg-red-100 text-red-700',
}

const esNoRepetitivo = (tipo: string) => tipo.includes('No Repetitivo')

interface CCGroup {
    cc_id: number
    cc_nombre: string
    conceptos: ClasificacionPreviewItem[]
    tipos: string[]
    baseAnual: number
    flujoFuente: number
    totalAnual: number
    cantConceptos: number
    actual: number
    diferencia: number
    diferencia_pct: number
    gapCount: number
    paretoAcum: number
    paretoPct: number
}

const formatMillones = (value: number): string => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
    return `$${formatMiles(value)}`
}

export const ReglasPresupuestoPage = () => {
    const queryClient = useQueryClient()
    const { cifrasEnMillones } = useSettings()
    const compact = cifrasEnMillones
    const [direccion, setDireccion] = useState<'egreso' | 'ingreso'>('egreso')
    const { data: reglas = [] } = useReglasPresupuesto(direccion)
    const { crear, actualizar, eliminar } = useReglaPresupuestoMutations()
    const { data: tiposGasto = [] } = useTiposGasto()
    const [reglaModal, setReglaModal] = useState<{
        isOpen: boolean
        editando: ReglaPresupuesto | null
        initialForm: Partial<ReglaFormData>
    }>({ isOpen: false, editando: null, initialForm: {} })
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [filterCcId, setFilterCcId] = useState<number | ''>('')
    const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null)

    // CC detail modal — almacena solo el ID, se deriva de ccGroups para que sea reactivo
    const [selectedCCId, setSelectedCCId] = useState<number | null>(null)

    // Presupuesto selector
    const currentYear = new Date().getFullYear()
    const { data: presupuestos = [], refetch: refetchPresupuestos } = usePresupuestos()
    const [presupuestoId, setPresupuestoId] = useState<number>(0)

    // Auto-seleccionar activo al cargar
    useEffect(() => {
        if (presupuestos.length > 0 && !presupuestoId) {
            const activo = presupuestos.find(p => p.estado === 'activo')
            setPresupuestoId(activo?.id || presupuestos[0].id)
        }
    }, [presupuestos, presupuestoId])

    const presupuestoActivo = presupuestos.find(p => p.id === presupuestoId) || null
    const anioFuente = presupuestoActivo ? presupuestoActivo.anio - 1 : currentYear - 1
    const anioDestino = presupuestoActivo?.anio ?? currentYear

    // Acciones de gestión del presupuesto
    const handleRefreshAll = useCallback(() => {
        refetchPresupuestos()
        queryClient.invalidateQueries({ queryKey: ['clasificacion-preview'] })
        queryClient.invalidateQueries({ queryKey: ['gastos-sin-presupuesto'] })
        queryClient.invalidateQueries({ queryKey: PRESUPUESTO_KEYS.all })
    }, [refetchPresupuestos, queryClient])

    const pptoActions = usePresupuestoActions(handleRefreshAll)

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

    // Gasto real total del año fuente (misma fuente que el Dashboard)
    const { data: flujoFuente } = useQuery({
        queryKey: ['flujo-anual-fuente', anioFuente, actualExcluidos, filterCcId, direccion],
        queryFn: () => dashboardService.flujoMensual(
            `${anioFuente}-01-01`, `${anioFuente}-12-31`,
            actualExcluidos,
            filterCcId || undefined
        ),
        enabled: anioFuente > 0,
    })
    const gastoRealAnterior = useMemo(
        () => flujoFuente?.reduce((sum, m) => sum + m.egresos, 0) ?? 0,
        [flujoFuente]
    )

    // Datos de clasificacion-preview (fuente principal izquierda)
    const { data: previewItems = [], isLoading: loadingPreview } = useClasificacionPreview(anioFuente, actualExcluidos, direccion)

    // Indicadores del año destino para calcular presupuesto anual
    const { data: indicadoresTarget = [] } = useIndicadores(anioDestino)
    const indicadorMap = useMemo(() => {
        const map = new Map<string, number>()
        indicadoresTarget.forEach(i => map.set(i.indicador, i.valor_porcentaje))
        return map
    }, [indicadoresTarget])

    // Simulación de impacto (datos de presupuesto actual por CC)
    const { data: simulacionData } = useQuery({
        queryKey: [...PRESUPUESTO_KEYS.simulacion(presupuestoActivo?.id ?? 0, 0), direccion],
        queryFn: () => presupuestoService.simularReglas(presupuestoActivo!.id, {
            anio_fuente: anioFuente,
            centros_costos_excluidos: actualExcluidos,
            direccion,
        }),
        staleTime: 0,
        enabled: !!presupuestoActivo,
    })

    // Gastos sin presupuesto (año actual)
    const { data: gastosSinPpto } = useQuery({
        queryKey: ['gastos-sin-presupuesto', presupuestoActivo?.id, actualExcluidos, direccion],
        queryFn: () => presupuestoService.gastosSinPresupuesto(presupuestoActivo!.id, actualExcluidos, direccion),
        staleTime: 0,
        enabled: !!presupuestoActivo,
    })

    // Cálculo de presupuesto anual por fila
    const calcRowPpto = useCallback((r: ClasificacionPreviewItem) => {
        if (esNoRepetitivo(r.tipo_gasto)) return 0
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
            const itemsSinNR = val.items.filter(i => !esNoRepetitivo(i.tipo_gasto))
            const baseAnual = itemsSinNR.reduce((sum, i) => sum + i.monto_total, 0)
            const flujoFuente = val.items.reduce((sum, i) => sum + i.monto_total, 0)
            const totalAnual = itemsSinNR.reduce((sum, i) => sum + calcRowPpto(i), 0)
            const actual = actualMap.get(ccId) ?? 0
            const diferencia = totalAnual - flujoFuente
            const diferencia_pct = flujoFuente !== 0 ? Math.round(diferencia / flujoFuente * 1000) / 10 : (totalAnual > 0 ? 100 : 0)
            const gapCount = val.items.filter(i => i.nivel_match === 'Auto' || i.nivel_match === 'Default').length
            groups.push({
                cc_id: ccId,
                cc_nombre: val.nombre,
                conceptos: val.items.sort((a, b) => calcRowPpto(b) - calcRowPpto(a)),
                tipos,
                baseAnual,
                flujoFuente,
                totalAnual,
                cantConceptos: val.items.length,
                actual,
                diferencia,
                diferencia_pct,
                gapCount,
            })
        })
        const sorted = groups.sort((a, b) => b.totalAnual - a.totalAnual)
        const grandTotal = sorted.reduce((sum, g) => sum + g.totalAnual, 0)
        let acum = 0
        for (const g of sorted) {
            acum += g.totalAnual
            g.paretoAcum = acum
            g.paretoPct = grandTotal !== 0 ? Math.round(acum / grandTotal * 1000) / 10 : 0
        }
        return sorted
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

    // --- Acciones ---

    const closeReglaModal = () => setReglaModal({ isOpen: false, editando: null, initialForm: {} })

    const openCrear = (ccId?: number | null, conceptoId?: number | null) => {
        setReglaModal({
            isOpen: true,
            editando: null,
            initialForm: { centro_costo_id: ccId ?? null, concepto_id: conceptoId ?? null },
        })
    }

    const openCrearDesdePreview = (item: ClasificacionPreviewItem) => {
        const tipoGasto = tiposGasto.find(t => t.tipo === item.tipo_gasto)
        setReglaModal({
            isOpen: true,
            editando: null,
            initialForm: {
                centro_costo_id: item.centro_costo_id,
                concepto_id: item.concepto_id,
                tipo_gasto: item.tipo_gasto,
                indicador_nombre: tipoGasto?.indicador_default ? (item.indicador_nombre || tipoGasto.indicador_default) : null,
                factor_ajuste: item.factor_ajuste,
                monto_fijo_mensual: item.monto_fijo_mensual,
                notas: '',
            },
        })
    }

    const openEditar = (r: ReglaPresupuesto) => {
        let monto = r.monto_fijo_mensual
        if (monto == null) {
            const items = previewItems.filter(i => i.regla_id === r.id && !esNoRepetitivo(i.tipo_gasto))
            if (items.length > 0) {
                const totalAnual = items.reduce((sum, i) => sum + calcRowPpto(i), 0)
                monto = totalAnual / 12
            }
        }
        setReglaModal({
            isOpen: true,
            editando: r,
            initialForm: {
                centro_costo_id: r.centro_costo_id,
                concepto_id: r.concepto_id,
                tipo_gasto: r.tipo_gasto,
                indicador_nombre: r.indicador_nombre,
                factor_ajuste: r.factor_ajuste,
                monto_fijo_mensual: monto,
                notas: r.notas || '',
            },
        })
    }

    const openEditarDesdePreview = (item: ClasificacionPreviewItem) => {
        const regla = reglas.find(r => r.id === item.regla_id)
        if (regla) openEditar(regla)
    }

    const handleSaveRegla = async (formData: ReglaFormData) => {
        try {
            if (reglaModal.editando) {
                await actualizar.mutateAsync({
                    id: reglaModal.editando.id,
                    ...formData,
                    centro_costo_nombre: undefined,
                    concepto_nombre: undefined,
                } as ReglaPresupuesto)
            } else {
                await crear.mutateAsync(formData)
            }
            closeReglaModal()
            // Si se creó desde sugerencias, remover de la lista
            if (editingSugerenciaKey) {
                setSugerencias(prev => prev.filter(s => s.key !== editingSugerenciaKey))
                setEditingSugerenciaKey(null)
            }
            // Si se creó desde gastos sin ppto, remover de la lista y refrescar
            if (editingGastoSinPptoKey) {
                setGastosSinPptoItems(prev => prev.filter(s => s.key !== editingGastoSinPptoKey))
                setEditingGastoSinPptoKey(null)
                queryClient.invalidateQueries({ queryKey: ['gastos-sin-presupuesto'] })
            }
        } catch (err: any) {
            setErrorMsg(err?.message || 'Error al guardar la regla')
            throw err  // Re-throw so modal knows save failed
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
        setEditingSugerenciaKey(s.key)
        setReglaModal({
            isOpen: true,
            editando: null,
            initialForm: {
                centro_costo_id: s.centro_costo_id,
                concepto_id: s.concepto_id,
                tipo_gasto: s.tipo_gasto,
                indicador_nombre: tipoGasto?.indicador_default ? (tipoGasto.indicador_default) : null,
                factor_ajuste: 0,
                monto_fijo_mensual: null,
                notas: '',
            },
        })
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
                    direccion,
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

    // --- Modal Gastos Sin Presupuesto ---
    type GastoCategoria = 'sin_regla' | 'no_repetitivo' | 'pendiente_regen'

    interface GastoSinPptoItem extends GastoSinPresupuesto {
        key: string
        selected: boolean
        tipo_gasto_seleccionado: string
        categoria: GastoCategoria
    }

    const getCategoria = (g: GastoSinPresupuesto): GastoCategoria => {
        if (!g.tiene_regla) return 'sin_regla'
        if (esNoRepetitivo(g.regla_tipo_gasto || '')) return 'no_repetitivo'
        return 'pendiente_regen'
    }

    const [showGastosSinPptoModal, setShowGastosSinPptoModal] = useState(false)
    const [gastosSinPptoItems, setGastosSinPptoItems] = useState<GastoSinPptoItem[]>([])
    const [creandoGastosSinPpto, setCreandoGastosSinPpto] = useState(false)
    const [editingGastoSinPptoKey, setEditingGastoSinPptoKey] = useState<string | null>(null)

    const handleAbrirGastosSinPpto = () => {
        if (!gastosSinPpto?.items?.length) return
        const items: GastoSinPptoItem[] = gastosSinPpto.items
            .map(g => ({
                ...g,
                key: `${g.centro_costo_id}-${g.concepto_id}`,
                selected: !g.tiene_regla,
                tipo_gasto_seleccionado: g.regla_tipo_gasto || 'Fijo',
                categoria: getCategoria(g),
            }))
            // Orden: sin_regla primero (Pareto), luego pendiente_regen, luego no_repetitivo
            .sort((a, b) => {
                const order: Record<GastoCategoria, number> = { sin_regla: 0, pendiente_regen: 1, no_repetitivo: 2 }
                const catDiff = order[a.categoria] - order[b.categoria]
                return catDiff !== 0 ? catDiff : b.monto_acumulado - a.monto_acumulado
            })
        setGastosSinPptoItems(items)
        setShowGastosSinPptoModal(true)
    }

    const toggleGastoSinPpto = (key: string) => {
        setGastosSinPptoItems(prev => prev.map(s =>
            s.key === key && !s.tiene_regla ? { ...s, selected: !s.selected } : s
        ))
    }

    const toggleAllGastosSinPpto = () => {
        const selectables = gastosSinPptoItems.filter(s => !s.tiene_regla)
        const allSelected = selectables.every(s => s.selected)
        setGastosSinPptoItems(prev => prev.map(s =>
            s.tiene_regla ? s : { ...s, selected: !allSelected }
        ))
    }

    const cambiarTipoGastoSinPpto = (key: string, tipo: string) => {
        setGastosSinPptoItems(prev => prev.map(s => s.key === key ? { ...s, tipo_gasto_seleccionado: tipo } : s))
    }

    const handleEditarGastoSinPpto = (g: GastoSinPptoItem) => {
        const tipo = g.tipo_gasto_seleccionado || 'Fijo'
        const tipoGasto = tiposGasto.find(t => t.tipo === tipo)
        const usaMonto = !tipoGasto?.indicador_default
        setEditingSugerenciaKey(null)
        setEditingGastoSinPptoKey(g.key)
        setReglaModal({
            isOpen: true,
            editando: null,
            initialForm: {
                centro_costo_id: g.centro_costo_id,
                concepto_id: g.concepto_id,
                tipo_gasto: tipo,
                indicador_nombre: tipoGasto?.indicador_default || null,
                factor_ajuste: 0,
                monto_fijo_mensual: usaMonto ? g.monto_acumulado / 12 : null,
                notas: '',
            },
        })
    }

    const handleConfirmarGastosSinPpto = async () => {
        const seleccionados = gastosSinPptoItems.filter(s => s.selected && !s.tiene_regla)
        if (seleccionados.length === 0) return
        setCreandoGastosSinPpto(true)
        try {
            const reglasNuevas = seleccionados.map(s => {
                const tipoGasto = tiposGasto.find(t => t.tipo === s.tipo_gasto_seleccionado)
                const usaMonto = !tipoGasto?.indicador_default
                return {
                    centro_costo_id: s.centro_costo_id,
                    concepto_id: s.concepto_id,
                    tipo_gasto: s.tipo_gasto_seleccionado,
                    indicador_nombre: tipoGasto?.indicador_default || null,
                    factor_ajuste: 0,
                    monto_fijo_mensual: usaMonto ? Math.round(s.monto_acumulado / 12) : null,
                    notas: 'Gasto sin presupuesto detectado',
                    direccion,
                }
            })
            const res = await reglasPresupuestoService.crearLote(reglasNuevas)
            toast.success(`${res.creadas} reglas creadas${res.omitidas > 0 ? `, ${res.omitidas} omitidas` : ''}`)
            setShowGastosSinPptoModal(false)
            queryClient.invalidateQueries({ queryKey: ['gastos-sin-presupuesto'] })
            queryClient.invalidateQueries({ queryKey: ['reglas-presupuesto'] })
        } catch (err: any) {
            setErrorMsg(err?.message || 'Error al crear reglas')
        } finally {
            setCreandoGastosSinPpto(false)
        }
    }


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
                    {[...r.tipos].sort((a, b) => Number(esNoRepetitivo(a)) - Number(esNoRepetitivo(b))).map(t => (
                        <span key={t} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${tipoBadgeColor[t] || 'bg-slate-100 text-slate-700'}`}>
                            {t}
                        </span>
                    ))}
                </div>
            ),
        },
        {
            key: 'flujoFuente',
            header: `Flujo ${anioFuente}`,
            sortable: true,
            sortValue: (r) => r.flujoFuente,
            align: 'right' as const,
            cellClassName: 'font-mono text-sm text-cyan-700',
            accessor: (r) => `$${formatMiles(r.flujoFuente)}`,
        },
        {
            key: 'actual',
            header: 'Actual',
            sortable: true,
            sortValue: (r) => r.actual,
            align: 'right' as const,
            cellClassName: 'font-mono text-sm text-slate-500',
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
        {
            key: 'paretoAcum',
            header: 'Pareto $',
            sortable: true,
            sortValue: (r) => r.paretoAcum,
            align: 'right' as const,
            cellClassName: 'font-mono text-xs',
            accessor: (r) => {
                const color = r.paretoPct <= 80 ? 'text-indigo-600' : 'text-indigo-400'
                return <span className={color}>${formatMiles(r.paretoAcum)}</span>
            },
        },
        {
            key: 'paretoPct',
            header: 'Pareto %',
            sortable: true,
            sortValue: (r) => r.paretoPct,
            align: 'right' as const,
            cellClassName: 'font-mono text-xs',
            accessor: (r) => {
                const color = r.paretoPct <= 80 ? 'text-indigo-600' : 'text-indigo-400'
                return <span className={color}>{r.paretoPct.toFixed(1)}%</span>
            },
        },
    ], [anioFuente])

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
                const esNR = esNoRepetitivo(item.tipo_gasto)
                return <span className={esNR ? 'text-red-400' : 'text-slate-700'}>
                    ${formatMiles(anual)}
                </span>
            },
        },
    ], [calcRowPpto, reglas, tiposGasto])

    // Filtrar por CC seleccionado
    const filteredCcGroups = useMemo(
        () => filterCcId ? ccGroups.filter(g => g.cc_id === filterCcId) : ccGroups,
        [ccGroups, filterCcId]
    )

    // Totales calculados desde filteredCcGroups
    const totalFlujoFuente = useMemo(() => filteredCcGroups.reduce((sum, g) => sum + g.flujoFuente, 0), [filteredCcGroups])
    const totalActual = useMemo(() => filteredCcGroups.reduce((sum, g) => sum + g.actual, 0), [filteredCcGroups])
    const totalProyectado = useMemo(() => filteredCcGroups.reduce((sum, g) => sum + g.totalAnual, 0), [filteredCcGroups])
    const totalDiferencia = totalProyectado - totalFlujoFuente
    const totalDiferenciaPct = totalFlujoFuente !== 0 ? Math.round(totalDiferencia / totalFlujoFuente * 1000) / 10 : 0

    // --- Render ---

    const hayDiferencia = totalDiferencia !== 0
    const DiffIcon = totalDiferencia > 0 ? TrendingUp : TrendingDown

    return (
        <div className="flex flex-col h-full bg-slate-50/50 overflow-hidden">
            {/* Hero: Header + Stats */}
            <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 px-6 pt-5 pb-5 text-white flex-shrink-0">
                {/* Title row */}
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <Zap size={24} /> Reglas de Presupuesto
                        </h1>
                        <p className="text-slate-400 text-sm mt-0.5">
                            Vista por Centro de Costo — Año fuente {anioFuente} → Ppto {anioDestino}
                        </p>
                    </div>
                    <div className="flex items-center gap-3" />
                </div>
                {/* Toolbar de acciones del presupuesto */}
                <div className="mt-3 mb-1">
                    <PresupuestoActionToolbar
                        presupuestos={presupuestos}
                        selectedPresupuesto={presupuestoActivo}
                        presupuestoId={presupuestoId}
                        onSelectPresupuesto={setPresupuestoId}
                        onCrear={pptoActions.handleCrear}
                        onEditar={pptoActions.handleEditar}
                        onGenerar={pptoActions.handleGenerar}
                        onActivar={pptoActions.handleActivar}
                        onEliminar={pptoActions.handleEliminar}
                        onRevertir={pptoActions.handleRevertir}
                        onCerrar={pptoActions.handleCerrar}
                        onAjuste={() => pptoActions.setAjusteModalOpen(true)}
                        onNuevaLinea={() => pptoActions.setNuevaLineaModalOpen(true)}
                    />
                </div>

                {/* Banner reglas pendientes */}
                {presupuestoActivo && (
                    <div className="mb-4">
                        <ReglasPendientesBanner
                            presupuestoId={presupuestoActivo.id}
                            onRegenerated={() => {
                                queryClient.invalidateQueries({ queryKey: ['clasificacion-preview'] })
                                queryClient.invalidateQueries({ queryKey: ['gastos-sin-presupuesto'] })
                            }}
                        />
                    </div>
                )}

                {/* KPI Cards */}
                {presupuestoActivo && (
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <DarkStatCard
                            label={`Flujo ${anioFuente}`}
                            value={gastoRealAnterior}
                            icon={<Wallet className="w-5 h-5" />}
                            colorClass="text-cyan-400"
                            iconBgClass="bg-cyan-500/20 text-cyan-400"
                            subtitle={`Gasto real año ${anioFuente}`}
                            compact={compact}
                        />
                        <DarkStatCard
                            label="Ppto Actual"
                            value={totalActual}
                            icon={<Target className="w-5 h-5" />}
                            colorClass="text-blue-400"
                            iconBgClass="bg-blue-500/20 text-blue-400"
                            subtitle={`Presupuesto ${anioDestino} vigente`}
                            compact={compact}
                        />
                        <DarkStatCard
                            label="Proyectado"
                            value={totalProyectado}
                            icon={<BarChart3 className="w-5 h-5" />}
                            colorClass="text-slate-200"
                            iconBgClass="bg-white/10 text-slate-300"
                            subtitle="Con reglas actuales"
                            compact={compact}
                        />
                        <DarkStatCard
                            label="Diferencia"
                            value={totalDiferencia}
                            icon={<DiffIcon className="w-5 h-5" />}
                            colorClass={totalDiferencia > 0 ? 'text-rose-400' : totalDiferencia < 0 ? 'text-emerald-400' : 'text-slate-400'}
                            iconBgClass={totalDiferencia > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}
                            subtitle="Proyectado - Actual"
                            compact={compact}
                        />
                        <DarkStatCard
                            label="% Impacto"
                            value={0}
                            icon={<DiffIcon className="w-5 h-5" />}
                            colorClass={totalDiferencia > 0 ? 'text-rose-400' : totalDiferencia < 0 ? 'text-emerald-400' : 'text-slate-400'}
                            iconBgClass={totalDiferencia > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}
                            renderValue={<>{totalDiferenciaPct > 0 ? '+' : ''}{totalDiferenciaPct}%</>}
                            subtitle={hayDiferencia ? `${totalDiferencia > 0 ? 'Aumentaría' : 'Reduciría'} el presupuesto` : 'Sin cambios'}
                            compact={compact}
                        />
                        <div className={gastosSinPpto?.count ? 'cursor-pointer' : ''} onClick={gastosSinPpto?.count ? handleAbrirGastosSinPpto : undefined}>
                            <DarkStatCard
                                label="Sin Presupuestar"
                                value={gastosSinPpto?.total_sin_ppto ?? 0}
                                icon={<AlertTriangle className="w-5 h-5" />}
                                colorClass="text-amber-400"
                                iconBgClass="bg-amber-500/20 text-amber-400"
                                subtitle={gastosSinPpto?.count
                                    ? `${gastosSinPpto.count} combinaciones detectadas`
                                    : 'Sin gastos pendientes'}
                                compact={compact}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Filtros */}
            <div className="flex items-center gap-4 px-4 pt-4 pb-2 flex-shrink-0">
                <div className="flex gap-1 bg-white border border-slate-200 p-1 rounded-lg shadow-sm">
                    {(['egreso', 'ingreso'] as const).map(dir => (
                        <button
                            key={dir}
                            onClick={() => setDireccion(dir)}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                                direccion === dir
                                    ? 'bg-slate-800 text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                            {dir === 'egreso' ? 'Egresos' : 'Ingresos'}
                        </button>
                    ))}
                </div>
                <select
                    value={filterCcId}
                    onChange={e => setFilterCcId(e.target.value ? Number(e.target.value) : '')}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 shadow-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none"
                >
                    <option value="">Todos los CCs</option>
                    {ccGroups.map(g => (
                        <option key={g.cc_id} value={g.cc_id}>
                            {g.cc_id} - {g.cc_nombre}
                        </option>
                    ))}
                </select>
                <button
                    onClick={() => openCrear(filterCcId || undefined)}
                    className="flex items-center gap-1.5 text-sm bg-emerald-600 text-white px-3 py-2 rounded-lg hover:bg-emerald-700 shadow-sm whitespace-nowrap"
                >
                    <PlusCircle size={14} /> Nueva Regla
                </button>
            </div>

            {/* Tabla unificada */}
            <div className="flex-1 min-h-0 overflow-auto px-4 pb-4">
                <DataTable<CCGroup>
                    data={filteredCcGroups}
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
                                    {selectedCC.conceptos.some(c => esNoRepetitivo(c.tipo_gasto)) && (
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
                                    esNoRepetitivo(item.tipo_gasto) ? 'opacity-50' :
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

            {/* Modal Gastos Sin Presupuesto */}
            {showGastosSinPptoModal && (() => {
                const categorias: { key: GastoCategoria; label: string; desc: string; color: string; bgRow: string }[] = [
                    { key: 'sin_regla', label: 'Sin Regla', desc: 'Necesitan regla para presupuestar', color: 'bg-red-100 text-red-600 border-red-200', bgRow: '' },
                    { key: 'pendiente_regen', label: 'Pendiente Regenerar', desc: 'Tienen regla, falta regenerar presupuesto', color: 'bg-amber-100 text-amber-700 border-amber-200', bgRow: 'bg-amber-50/30' },
                    { key: 'no_repetitivo', label: 'No Repetitivo', desc: 'Excluidos del presupuesto por diseño', color: 'bg-orange-100 text-orange-600 border-orange-200', bgRow: 'bg-orange-50/30' },
                ]
                const porCat = (cat: GastoCategoria) => gastosSinPptoItems.filter(g => g.categoria === cat)
                const sinReglaItems = porCat('sin_regla')

                return (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[55]" onClick={() => !creandoGastosSinPpto && setShowGastosSinPptoModal(false)}>
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between px-6 py-4 border-b">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                        <AlertTriangle size={20} className="text-orange-500" />
                                        Gastos Sin Presupuesto — {anioDestino}
                                    </h2>
                                    <p className="text-sm text-slate-500 mt-0.5">
                                        {gastosSinPptoItems.length} combinaciones — Total: <span className="font-mono font-semibold">{formatMillones(gastosSinPptoItems.reduce((sum, s) => sum + s.monto_acumulado, 0))}</span>
                                    </p>
                                </div>
                                <button onClick={() => setShowGastosSinPptoModal(false)} className="text-slate-400 hover:text-slate-600" disabled={creandoGastosSinPpto}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto px-6 py-4">
                                {categorias.map(cat => {
                                    const items = porCat(cat.key)
                                    if (items.length === 0) return null
                                    const subtotal = items.reduce((s, i) => s + i.monto_acumulado, 0)
                                    const isActionable = cat.key === 'sin_regla'

                                    return (
                                        <div key={cat.key} className="mb-5 last:mb-0">
                                            {/* Section header */}
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${cat.color}`}>
                                                    {cat.label}
                                                </span>
                                                <span className="text-xs text-slate-500">
                                                    {items.length} items — <span className="font-mono font-semibold">{formatMillones(subtotal)}</span>
                                                </span>
                                                <span className="text-[10px] text-slate-400 italic">{cat.desc}</span>
                                            </div>
                                            <table className="w-full text-sm">
                                                {isActionable && (
                                                    <thead>
                                                        <tr className="border-b text-left text-xs text-slate-500 uppercase tracking-wider">
                                                            <th className="pb-2 pr-2 w-8">
                                                                <input type="checkbox"
                                                                    checked={sinReglaItems.length > 0 && sinReglaItems.every(s => s.selected)}
                                                                    onChange={toggleAllGastosSinPpto}
                                                                    className="rounded border-slate-300 accent-orange-500"
                                                                />
                                                            </th>
                                                            <th className="pb-2 pr-2 w-8"></th>
                                                            <th className="pb-2 pr-2">Centro de Costo</th>
                                                            <th className="pb-2 pr-2">Concepto</th>
                                                            <th className="pb-2 pr-2 w-28 text-right">Acumulado</th>
                                                            <th className="pb-2 w-14 text-center">Meses</th>
                                                            <th className="pb-2 w-32">Tipo Sugerido</th>
                                                        </tr>
                                                    </thead>
                                                )}
                                                <tbody>
                                                    {items.map(g => (
                                                        <tr key={g.key} className={`border-b border-slate-100 ${cat.bgRow} ${isActionable && !g.selected ? 'opacity-40' : ''} ${!isActionable ? 'opacity-60' : ''}`}>
                                                            {isActionable ? (
                                                                <>
                                                                    <td className="py-2 pr-2">
                                                                        <input type="checkbox"
                                                                            checked={g.selected}
                                                                            onChange={() => toggleGastoSinPpto(g.key)}
                                                                            className="rounded border-slate-300 accent-orange-500"
                                                                        />
                                                                    </td>
                                                                    <td className="py-2 pr-2">
                                                                        <button onClick={() => handleEditarGastoSinPpto(g)}
                                                                            className="p-1 text-blue-500 hover:text-blue-700" title="Crear regla con detalle">
                                                                            <Pencil size={13} />
                                                                        </button>
                                                                    </td>
                                                                </>
                                                            ) : (
                                                                <td className="py-2 pr-2" colSpan={2}></td>
                                                            )}
                                                            <td className="py-2 pr-2 text-slate-700 text-xs">
                                                                {g.centro_costo_nombre}
                                                            </td>
                                                            <td className="py-2 pr-2 text-slate-700">
                                                                {g.concepto_nombre || <span className="italic text-slate-400">Sin concepto</span>}
                                                            </td>
                                                            <td className="py-2 pr-2 text-right font-mono text-slate-700 font-medium">
                                                                ${formatMiles(g.monto_acumulado)}
                                                            </td>
                                                            <td className="py-2 text-center font-mono text-slate-400">
                                                                {g.meses_con_gasto}
                                                            </td>
                                                            <td className="py-2">
                                                                {isActionable ? (
                                                                    <select
                                                                        value={g.tipo_gasto_seleccionado}
                                                                        onChange={e => cambiarTipoGastoSinPpto(g.key, e.target.value)}
                                                                        className={`w-full border rounded px-2 py-1 text-xs font-medium ${tipoBadgeColor[g.tipo_gasto_seleccionado] || 'bg-slate-50 text-slate-700'}`}
                                                                    >
                                                                        {tiposGasto.map(t => (
                                                                            <option key={t.tipo} value={t.tipo}>{t.tipo}</option>
                                                                        ))}
                                                                    </select>
                                                                ) : (
                                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${tipoBadgeColor[g.regla_tipo_gasto || ''] || 'bg-slate-100 text-slate-700'}`}>
                                                                        {g.regla_tipo_gasto}
                                                                    </span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="flex items-center justify-between px-6 py-4 border-t bg-slate-50 rounded-b-xl">
                                <span className="text-sm text-slate-500">
                                    {sinReglaItems.filter(s => s.selected).length} reglas se crearán
                                    {' — '}
                                    <span className="font-mono">
                                        {formatMillones(sinReglaItems.filter(s => s.selected).reduce((sum, s) => sum + s.monto_acumulado, 0))}
                                    </span>
                                </span>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setShowGastosSinPptoModal(false)}
                                        className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                                        disabled={creandoGastosSinPpto}>
                                        Cancelar
                                    </button>
                                    <button onClick={handleConfirmarGastosSinPpto}
                                        className="flex items-center gap-1.5 px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
                                        disabled={creandoGastosSinPpto || sinReglaItems.filter(s => s.selected).length === 0}>
                                        {creandoGastosSinPpto ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                                        Crear {sinReglaItems.filter(s => s.selected).length} reglas
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })()}

            {/* Modal crear/editar regla */}
            <ReglaPresupuestoModal
                isOpen={reglaModal.isOpen}
                onClose={closeReglaModal}
                editando={reglaModal.editando}
                initialForm={reglaModal.initialForm}
                onSave={handleSaveRegla}
                direccion={direccion}
            />

            <MessageModal message={errorMsg} onClose={() => setErrorMsg(null)} />
            <MessageModal
                message={confirmModal?.message ?? null}
                type="confirm"
                onClose={() => setConfirmModal(null)}
                onConfirm={confirmModal?.onConfirm}
            />

            {/* Modales de gestión del presupuesto */}
            <PresupuestoFormModal
                isOpen={pptoActions.formModalOpen}
                editando={pptoActions.formEditando}
                onClose={() => pptoActions.setFormModalOpen(false)}
                onSaved={pptoActions.handleFormSaved}
            />
            {pptoActions.presupuestoGenerar && (
                <PresupuestoGenerarModal
                    isOpen={pptoActions.generarModalOpen}
                    presupuesto={pptoActions.presupuestoGenerar}
                    onClose={() => pptoActions.setGenerarModalOpen(false)}
                    onSuccess={pptoActions.handleGenerarSuccess}
                    mode={pptoActions.generarMode}
                />
            )}
            {presupuestoActivo && (
                <PresupuestoAjusteModal
                    isOpen={pptoActions.ajusteModalOpen}
                    presupuestoId={presupuestoActivo.id}
                    onClose={() => pptoActions.setAjusteModalOpen(false)}
                    onSuccess={() => { pptoActions.setAjusteModalOpen(false); handleRefreshAll() }}
                />
            )}
            {presupuestoActivo && (
                <NuevaLineaPresupuestoModal
                    isOpen={pptoActions.nuevaLineaModalOpen}
                    presupuestoId={presupuestoActivo.id}
                    onClose={() => pptoActions.setNuevaLineaModalOpen(false)}
                    onSuccess={() => { pptoActions.setNuevaLineaModalOpen(false); handleRefreshAll() }}
                />
            )}
            <MessageModal
                message={pptoActions.confirmMsg}
                type="confirm"
                onClose={pptoActions.closeConfirm}
                onConfirm={pptoActions.confirmAction || undefined}
            />
        </div>
    )
}
