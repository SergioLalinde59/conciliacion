import { useQuery } from '@tanstack/react-query'
import { presupuestoService } from '../services/presupuesto.service'

export const PRESUPUESTO_KEYS = {
    all: ['presupuestos'] as const,
    lista: (anio?: number) => [...PRESUPUESTO_KEYS.all, 'lista', anio] as const,
    detalle: (id: number, params?: Record<string, unknown>) => [...PRESUPUESTO_KEYS.all, 'detalle', id, params] as const,
    comparacion: (id: number, params?: Record<string, unknown>) => [...PRESUPUESTO_KEYS.all, 'comparacion', id, params] as const,
    comparacionMensual: (id: number, params?: Record<string, unknown>) => [...PRESUPUESTO_KEYS.all, 'comparacion-mensual', id, params] as const,
    resumenCC: (id: number) => [...PRESUPUESTO_KEYS.all, 'resumen-cc', id] as const,
    resumenMensual: (id: number) => [...PRESUPUESTO_KEYS.all, 'resumen-mensual', id] as const,
    widget: () => [...PRESUPUESTO_KEYS.all, 'widget'] as const,
    clasificacionPreview: (anio: number, excluidos?: number[]) => [...PRESUPUESTO_KEYS.all, 'clasificacion-preview', anio, excluidos] as const,
    detalleMensual: (anio: number, ccId: number, conceptoId?: number | null) => [...PRESUPUESTO_KEYS.all, 'detalle-mensual', anio, ccId, conceptoId] as const,
}

export const usePresupuestos = (anio?: number) =>
    useQuery({
        queryKey: PRESUPUESTO_KEYS.lista(anio),
        queryFn: () => presupuestoService.listar(anio),
        staleTime: 5 * 60 * 1000,
    })

export const usePresupuestoDetalle = (id: number, params?: {
    centro_costo_id?: number; concepto_id?: number; tercero_id?: number; mes?: number
}) =>
    useQuery({
        queryKey: PRESUPUESTO_KEYS.detalle(id, params as Record<string, unknown>),
        queryFn: () => presupuestoService.listarDetalle(id, params),
        staleTime: 5 * 60 * 1000,
        enabled: !!id,
    })

export const usePresupuestoComparacion = (id: number, params: {
    nivel?: string; mes_inicio?: number; mes_fin?: number;
    centro_costo_id?: number; concepto_id?: number;
    centros_costos_excluidos?: number[]
}) =>
    useQuery({
        queryKey: PRESUPUESTO_KEYS.comparacion(id, params as Record<string, unknown>),
        queryFn: () => presupuestoService.comparar(id, params),
        staleTime: 5 * 60 * 1000,
        enabled: !!id,
    })

export const usePresupuestoComparacionMensual = (id: number, params?: {
    centros_costos_excluidos?: number[]
    centro_costo_id?: number; concepto_id?: number; tercero_id?: number
}) =>
    useQuery({
        queryKey: PRESUPUESTO_KEYS.comparacionMensual(id, params as Record<string, unknown>),
        queryFn: () => presupuestoService.compararMensual(id, params),
        staleTime: 5 * 60 * 1000,
        enabled: !!id,
    })

export const usePresupuestoWidget = () =>
    useQuery({
        queryKey: PRESUPUESTO_KEYS.widget(),
        queryFn: () => presupuestoService.widget(),
        staleTime: 10 * 60 * 1000,
    })

export const useClasificacionPreview = (anio: number, centrosCostosExcluidos?: number[]) =>
    useQuery({
        queryKey: PRESUPUESTO_KEYS.clasificacionPreview(anio, centrosCostosExcluidos),
        queryFn: () => presupuestoService.clasificacionPreview(anio, centrosCostosExcluidos),
        staleTime: 5 * 60 * 1000,
        enabled: !!anio,
    })

export const useDetalleMensual = (anio: number, centroCostoId: number, conceptoId?: number | null) =>
    useQuery({
        queryKey: PRESUPUESTO_KEYS.detalleMensual(anio, centroCostoId, conceptoId),
        queryFn: () => presupuestoService.detalleMensual(anio, centroCostoId, conceptoId),
        staleTime: 5 * 60 * 1000,
        enabled: !!anio && !!centroCostoId,
    })
