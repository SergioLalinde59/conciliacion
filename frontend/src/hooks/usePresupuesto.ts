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
    widget: (params?: Record<string, unknown>) => [...PRESUPUESTO_KEYS.all, 'widget', params] as const,
    clasificacionPreview: (anio: number, excluidos?: number[], direccion?: string) => [...PRESUPUESTO_KEYS.all, 'clasificacion-preview', anio, excluidos, direccion] as const,
    detalleMensual: (anio: number, ccId: number, conceptoId?: number | null, direccion?: string) => [...PRESUPUESTO_KEYS.all, 'detalle-mensual', anio, ccId, conceptoId, direccion] as const,
    simulacion: (id: number, version: number) => [...PRESUPUESTO_KEYS.all, 'simulacion', id, version] as const,
    versiones: (id: number) => [...PRESUPUESTO_KEYS.all, 'versiones', id] as const,
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
    centros_costos_excluidos?: number[];
    centros_costos_incluidos?: number[];
    excluir_estacionales?: boolean;
    direccion?: string
}) =>
    useQuery({
        queryKey: PRESUPUESTO_KEYS.comparacion(id, params as Record<string, unknown>),
        queryFn: () => presupuestoService.comparar(id, params),
        staleTime: 5 * 60 * 1000,
        enabled: !!id,
    })

export const usePresupuestoComparacionMensual = (id: number, params?: {
    centros_costos_excluidos?: number[]
    centros_costos_incluidos?: number[]
    centro_costo_id?: number; concepto_id?: number; tercero_id?: number;
    excluir_estacionales?: boolean
    direccion?: string
}) =>
    useQuery({
        queryKey: PRESUPUESTO_KEYS.comparacionMensual(id, params as Record<string, unknown>),
        queryFn: () => presupuestoService.compararMensual(id, params),
        staleTime: 5 * 60 * 1000,
        enabled: !!id,
    })

export const usePresupuestoWidget = (params?: {
    centros_costos_excluidos?: number[]
    centros_costos_incluidos?: number[]
    centro_costo_id?: number; concepto_id?: number; tercero_id?: number
    direccion?: string
}) =>
    useQuery({
        queryKey: PRESUPUESTO_KEYS.widget(params as Record<string, unknown>),
        queryFn: () => presupuestoService.widget(params),
        staleTime: 10 * 60 * 1000,
    })

export const useClasificacionPreview = (anio: number, centrosCostosExcluidos?: number[], direccion?: string, centrosCostosIncluidos?: number[]) =>
    useQuery({
        queryKey: PRESUPUESTO_KEYS.clasificacionPreview(anio, centrosCostosExcluidos, direccion),
        queryFn: () => presupuestoService.clasificacionPreview(anio, centrosCostosExcluidos, direccion, centrosCostosIncluidos),
        staleTime: 5 * 60 * 1000,
        enabled: !!anio,
    })

export const useDetalleMensual = (anio: number, centroCostoId: number, conceptoId?: number | null, direccion?: string) =>
    useQuery({
        queryKey: PRESUPUESTO_KEYS.detalleMensual(anio, centroCostoId, conceptoId, direccion),
        queryFn: () => presupuestoService.detalleMensual(anio, centroCostoId, conceptoId, direccion),
        staleTime: 5 * 60 * 1000,
        enabled: !!anio && !!centroCostoId,
    })

export const usePresupuestoVersiones = (id: number) =>
    useQuery({
        queryKey: PRESUPUESTO_KEYS.versiones(id),
        queryFn: () => presupuestoService.listarVersiones(id),
        staleTime: 5 * 60 * 1000,
        enabled: !!id,
    })
