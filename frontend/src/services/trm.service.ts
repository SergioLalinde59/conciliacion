import { API_BASE_URL, handleResponse } from './httpClient'

export interface TrmResponse {
    fecha: string
    valor: number
    fuente: string | null
}

export interface AplicarTrmRequest {
    cuenta_id: number
    fecha_pago: string
    fecha_inicio: string
    fecha_fin: string
}

export interface AplicarTrmResult {
    trm_aplicada: number
    fecha_trm: string
    movimientos_actualizados: number
    valor_total_cop: number
}

export const trmService = {
    consultar: async (fecha: string): Promise<TrmResponse> => {
        return fetch(`${API_BASE_URL}/api/trm/consultar?fecha=${fecha}`).then(handleResponse)
    },

    aplicar: async (request: AplicarTrmRequest): Promise<AplicarTrmResult> => {
        return fetch(`${API_BASE_URL}/api/trm/aplicar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
        }).then(handleResponse)
    }
}
