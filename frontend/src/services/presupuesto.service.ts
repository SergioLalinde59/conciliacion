import { API_BASE_URL, handleResponse, buildQueryParams } from './httpClient'
import type {
    Presupuesto,
    PresupuestoDetalle,
    ComparacionPresupuesto,
    ResumenMensualPresupuesto,
    PresupuestoWidget,
    ClasificacionPreviewItem,
    SimulacionImpacto,
    GastosSinPresupuestoResponse
} from '../types/Presupuesto'

export const presupuestoService = {
    // --- Maestro CRUD ---

    listar: async (anio?: number): Promise<Presupuesto[]> => {
        const params = anio ? `?anio=${anio}` : ''
        return fetch(`${API_BASE_URL}/api/presupuestos${params}`).then(handleResponse)
    },

    obtener: async (id: number): Promise<Presupuesto> => {
        return fetch(`${API_BASE_URL}/api/presupuestos/${id}`).then(handleResponse)
    },

    crear: async (dto: { anio: number; nombre: string; semaforo_verde_hasta: number; semaforo_amarillo_hasta: number; umbral_minimo_mensual?: number; umbral_minimo_anual?: number; umbral_no_repetitivo?: number; umbral_estacional?: number; umbral_pareto?: number; cifras_en_millones?: boolean; notas?: string }): Promise<Presupuesto> => {
        return fetch(`${API_BASE_URL}/api/presupuestos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto)
        }).then(handleResponse)
    },

    actualizar: async (id: number, dto: { nombre?: string; notas?: string; semaforo_verde_hasta?: number; semaforo_amarillo_hasta?: number; umbral_minimo_mensual?: number; umbral_minimo_anual?: number; umbral_no_repetitivo?: number; umbral_estacional?: number; umbral_pareto?: number; cifras_en_millones?: boolean }): Promise<Presupuesto> => {
        return fetch(`${API_BASE_URL}/api/presupuestos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto)
        }).then(handleResponse)
    },

    eliminar: async (id: number): Promise<void> => {
        await fetch(`${API_BASE_URL}/api/presupuestos/${id}`, { method: 'DELETE' }).then(handleResponse)
    },

    activar: async (id: number): Promise<Presupuesto> => {
        return fetch(`${API_BASE_URL}/api/presupuestos/${id}/activar`, { method: 'POST' }).then(handleResponse)
    },

    cerrar: async (id: number): Promise<Presupuesto> => {
        return fetch(`${API_BASE_URL}/api/presupuestos/${id}/cerrar`, { method: 'POST' }).then(handleResponse)
    },

    revertir: async (id: number): Promise<Presupuesto> => {
        return fetch(`${API_BASE_URL}/api/presupuestos/${id}/revertir`, { method: 'POST' }).then(handleResponse)
    },

    // --- Clasificación Preview ---

    clasificacionPreview: async (anio: number, centrosCostosExcluidos?: number[], direccion: string = 'egreso'): Promise<ClasificacionPreviewItem[]> => {
        let url = `${API_BASE_URL}/api/presupuestos/clasificacion-preview?anio=${anio}&direccion=${direccion}`
        if (centrosCostosExcluidos?.length) {
            url += centrosCostosExcluidos.map(id => `&centros_costos_excluidos=${id}`).join('')
        }
        return fetch(url).then(handleResponse)
    },

    detalleMensual: async (anio: number, centroCostoId: number, conceptoId?: number | null, direccion: string = 'egreso'): Promise<{ mes: number; monto: number }[]> => {
        let url = `${API_BASE_URL}/api/presupuestos/clasificacion-preview/detalle-mensual?anio=${anio}&centro_costo_id=${centroCostoId}&direccion=${direccion}`
        if (conceptoId != null) url += `&concepto_id=${conceptoId}`
        return fetch(url).then(handleResponse)
    },

    // --- Generación ---

    previsualizar: async (id: number, dto: {
        anio_fuente: number; centros_costos_excluidos?: number[]; umbral?: number; umbral_estacional?: number
    }): Promise<import('../types/Presupuesto').GeneracionPreview> => {
        return fetch(`${API_BASE_URL}/api/presupuestos/${id}/previsualizar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto)
        }).then(handleResponse)
    },

    generar: async (id: number, dto: {
        anio_fuente: number; centros_costos_excluidos?: number[];
        umbral?: number; umbral_estacional?: number; no_repetitivos_incluidos?: Record<string, unknown>[];
        montos_fijos?: { centro_costo_id: number; concepto_id: number | null; tercero_id: number | null; monto_fijo: number }[]
    }): Promise<import('../types/Presupuesto').GeneracionResult> => {
        return fetch(`${API_BASE_URL}/api/presupuestos/${id}/generar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto)
        }).then(handleResponse)
    },

    // --- Detalle CRUD ---

    listarDetalle: async (id: number, params?: {
        centro_costo_id?: number; concepto_id?: number; tercero_id?: number; mes?: number; version?: number
    }): Promise<PresupuestoDetalle[]> => {
        const qp = params ? `?${buildQueryParams(params as Record<string, unknown>)}` : ''
        return fetch(`${API_BASE_URL}/api/presupuestos/${id}/detalle${qp}`).then(handleResponse)
    },

    crearDetalle: async (id: number, dto: {
        centro_costo_id: number; concepto_id?: number; tercero_id?: number;
        mes: number; monto_presupuestado: number; tipo?: string; notas?: string
    }): Promise<{ id: number }> => {
        return fetch(`${API_BASE_URL}/api/presupuestos/${id}/detalle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto)
        }).then(handleResponse)
    },

    actualizarDetalle: async (id: number, detalleId: number, dto: Record<string, unknown>): Promise<{ id: number }> => {
        return fetch(`${API_BASE_URL}/api/presupuestos/${id}/detalle/${detalleId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto)
        }).then(handleResponse)
    },

    eliminarDetalle: async (id: number, detalleId: number): Promise<void> => {
        await fetch(`${API_BASE_URL}/api/presupuestos/${id}/detalle/${detalleId}`, { method: 'DELETE' }).then(handleResponse)
    },

    // --- Ajustes ---

    ajusteGlobal: async (id: number, porcentaje: number): Promise<{ lineas_afectadas: number }> => {
        return fetch(`${API_BASE_URL}/api/presupuestos/${id}/ajuste/global`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ porcentaje })
        }).then(handleResponse)
    },

    ajusteCentroCosto: async (id: number, centro_costo_id: number, porcentaje: number): Promise<{ lineas_afectadas: number }> => {
        return fetch(`${API_BASE_URL}/api/presupuestos/${id}/ajuste/centro-costo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ centro_costo_id, porcentaje })
        }).then(handleResponse)
    },

    ajusteLinea: async (id: number, detalleId: number, monto: number): Promise<{ id: number }> => {
        return fetch(`${API_BASE_URL}/api/presupuestos/${id}/detalle/${detalleId}/ajustar`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ monto })
        }).then(handleResponse)
    },

    // --- Comparación ---

    comparar: async (id: number, params: {
        nivel?: string; mes_inicio?: number; mes_fin?: number;
        centro_costo_id?: number; concepto_id?: number;
        centros_costos_excluidos?: number[];
        excluir_estacionales?: boolean;
        direccion?: string
    }): Promise<ComparacionPresupuesto[]> => {
        const qp = buildQueryParams(params as Record<string, unknown>)
        return fetch(`${API_BASE_URL}/api/presupuestos/${id}/comparacion?${qp}`).then(handleResponse)
    },

    compararMensual: async (id: number, params?: {
        centros_costos_excluidos?: number[]
        centro_costo_id?: number; concepto_id?: number; tercero_id?: number;
        excluir_estacionales?: boolean;
        direccion?: string
    }): Promise<ResumenMensualPresupuesto[]> => {
        const qp = params ? buildQueryParams(params as Record<string, unknown>) : ''
        const qs = qp.toString() ? `?${qp}` : ''
        return fetch(`${API_BASE_URL}/api/presupuestos/${id}/comparacion/mensual${qs}`).then(handleResponse)
    },

    // --- Versiones ---

    listarVersiones: async (id: number): Promise<import('../types/Presupuesto').PresupuestoVersionInfo[]> => {
        return fetch(`${API_BASE_URL}/api/presupuestos/${id}/versiones`).then(handleResponse)
    },

    // --- Resúmenes ---

    resumenCentroCosto: async (id: number, mesInicio = 1, mesFin = 12): Promise<{ id: number; nombre: string; presupuestado: number }[]> => {
        return fetch(`${API_BASE_URL}/api/presupuestos/${id}/resumen/centro-costo?mes_inicio=${mesInicio}&mes_fin=${mesFin}`).then(handleResponse)
    },

    resumenMensual: async (id: number): Promise<{ mes: number; mes_nombre: string; presupuestado: number }[]> => {
        return fetch(`${API_BASE_URL}/api/presupuestos/${id}/resumen/mensual`).then(handleResponse)
    },

    // --- Simulación e Impacto ---

    simularReglas: async (id: number, dto?: { anio_fuente?: number; centros_costos_excluidos?: number[]; direccion?: string }): Promise<SimulacionImpacto> => {
        return fetch(`${API_BASE_URL}/api/presupuestos/${id}/simular-reglas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto || {})
        }).then(handleResponse)
    },

    regenerar: async (id: number, dto?: {
        anio_fuente?: number; centros_costos_excluidos?: number[];
        umbral?: number; umbral_estacional?: number;
        no_repetitivos_incluidos?: Record<string, unknown>[];
        montos_fijos?: { centro_costo_id: number; concepto_id: number | null; tercero_id: number | null; monto_fijo: number }[]
    }): Promise<import('../types/Presupuesto').GeneracionResult> => {
        return fetch(`${API_BASE_URL}/api/presupuestos/${id}/regenerar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto || {})
        }).then(handleResponse)
    },

    // --- Comparación entre versiones ---

    compararVersiones: async (id: number, params: {
        version_a: number; version_b: number;
        nivel?: string; centro_costo_id?: number; concepto_id?: number
    }): Promise<import('../types/Presupuesto').ComparacionVersion[]> => {
        const qp = buildQueryParams(params as Record<string, unknown>)
        return fetch(`${API_BASE_URL}/api/presupuestos/${id}/comparar-versiones${qp}`).then(handleResponse)
    },

    // --- Reglas Pendientes ---

    reglasPendientes: async (id: number): Promise<{ pendientes: number; detalle: { regla_id: number; centro_costo_nombre: string; concepto_nombre: string; tipo_gasto: string }[] }> => {
        return fetch(`${API_BASE_URL}/api/presupuestos/${id}/reglas-pendientes`).then(handleResponse)
    },

    // --- Gastos Sin Presupuesto ---

    gastosSinPresupuesto: async (id: number, centrosCostosExcluidos?: number[], direccion: string = 'egreso'): Promise<GastosSinPresupuestoResponse> => {
        let url = `${API_BASE_URL}/api/presupuestos/${id}/gastos-sin-presupuesto?direccion=${direccion}`
        if (centrosCostosExcluidos?.length) {
            url += '&' + centrosCostosExcluidos.map(ccId => `centros_costos_excluidos=${ccId}`).join('&')
        }
        return fetch(url).then(handleResponse)
    },

    // --- Widget Dashboard ---

    widget: async (params?: {
        centros_costos_excluidos?: number[]
        centro_costo_id?: number; concepto_id?: number; tercero_id?: number
        direccion?: string
    }): Promise<PresupuestoWidget> => {
        const qp = params ? buildQueryParams(params as Record<string, unknown>) : ''
        const qs = qp.toString() ? `?${qp}` : ''
        return fetch(`${API_BASE_URL}/api/dashboard/presupuesto-widget${qs}`).then(handleResponse)
    },
}
