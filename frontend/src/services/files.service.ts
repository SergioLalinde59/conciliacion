import { API_BASE_URL, handleResponse } from './httpClient'

/**
 * Servicio para operaciones de archivos (carga y análisis)
 */
export const archivosService = {
    cargar: (file: File, tipo_cuenta: string, cuenta_id: number, actualizar_descripciones: boolean = false): Promise<any> => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('tipo_cuenta', tipo_cuenta)
        formData.append('cuenta_id', cuenta_id.toString())
        formData.append('actualizar_descripciones', actualizar_descripciones.toString())

        return fetch(`${API_BASE_URL}/api/archivos/cargar`, {
            method: 'POST',
            body: formData
        }).then(handleResponse)
    },

    analizar: (file: File, tipo_cuenta: string, cuenta_id?: number): Promise<any> => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('tipo_cuenta', tipo_cuenta)
        if (cuenta_id) formData.append('cuenta_id', cuenta_id.toString())

        return fetch(`${API_BASE_URL}/api/archivos/analizar`, {
            method: 'POST',
            body: formData
        }).then(handleResponse)
    },

    listarDirectorios: (tipo: 'movimientos' | 'extractos'): Promise<string[]> => {
        return fetch(`${API_BASE_URL}/api/archivos/listar-directorios?tipo=${tipo}`)
            .then(handleResponse)
    },

    procesarLocal: (
        filename: string,
        tipo: 'movimientos' | 'extractos',
        tipo_cuenta: string,
        cuenta_id?: number,
        actualizar_descripciones: boolean = false,
        year?: number,
        month?: number,
        accion: 'analizar' | 'cargar' = 'analizar',
        overrides?: {
            saldo_anterior?: number
            entradas?: number
            rendimientos?: number
            salidas?: number
            retenciones?: number
            saldo_final?: number
        },
        movimientos?: any[] // New: Confirmed movements
    ): Promise<any> => {
        const formData = new FormData()
        formData.append('filename', filename)
        formData.append('tipo', tipo)
        formData.append('tipo_cuenta', tipo_cuenta)
        if (cuenta_id) formData.append('cuenta_id', cuenta_id.toString())
        formData.append('actualizar_descripciones', actualizar_descripciones.toString())
        if (year) formData.append('year', year.toString())
        if (month) formData.append('month', month.toString())
        formData.append('accion', accion)

        // Append overrides if present
        if (overrides) {
            if (overrides.saldo_anterior !== undefined) formData.append('saldo_anterior', overrides.saldo_anterior.toString())
            if (overrides.entradas !== undefined) formData.append('entradas', overrides.entradas.toString())
            if (overrides.rendimientos !== undefined) formData.append('rendimientos', overrides.rendimientos.toString())
            if (overrides.salidas !== undefined) formData.append('salidas', overrides.salidas.toString())
            if (overrides.retenciones !== undefined) formData.append('retenciones', overrides.retenciones.toString())
            if (overrides.saldo_final !== undefined) formData.append('saldo_final', overrides.saldo_final.toString())
        }

        // Append movements JSON if present
        if (movimientos) {
            formData.append('movimientos_json', JSON.stringify(movimientos))
        }

        return fetch(`${API_BASE_URL}/api/archivos/procesar-local`, {
            method: 'POST',
            body: formData
        }).then(handleResponse)
    },

    buscarPaginaResumen: (filename: string, moneda: 'PESOS' | 'DOLARES' = 'PESOS'): Promise<{ pagina: number }> => {
        return fetch(`${API_BASE_URL}/api/archivos/buscar-pagina-resumen?filename=${encodeURIComponent(filename)}&moneda=${moneda}`)
            .then(handleResponse)
    },

    obtenerExtractosPorCuenta: (cuenta_id: number, limit: number = 100): Promise<{
        total: number
        mostrados: number
        registros: Array<{
            id: number
            cuenta_id: number
            fecha: string
            descripcion: string
            referencia: string
            valor: number
            usd: number | null
            year: number
            month: number
        }>
    }> => {
        return fetch(`${API_BASE_URL}/api/archivos/extractos-cuenta/${cuenta_id}?limit=${limit}`)
            .then(handleResponse)
    },

    obtenerExtractosTodasCuentas: (limitPorCuenta: number = 50): Promise<Record<number, {
        cuenta_nombre: string
        total: number
        ingresos: number
        egresos: number
        ingresos_usd: number | null
        egresos_usd: number | null
        registros: Array<{
            id: number
            cuenta_id: number
            fecha: string
            descripcion: string
            referencia: string
            valor: number
            usd: number | null
            year: number
            month: number
        }>
    }>> => {
        return fetch(`${API_BASE_URL}/api/archivos/extractos-todas-cuentas?limit_por_cuenta=${limitPorCuenta}`)
            .then(handleResponse)
    }
}

