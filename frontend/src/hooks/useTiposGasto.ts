import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tiposGastoService } from '../services/tiposGasto.service'
import type { TipoGasto } from '../types/TipoGasto'

const KEYS = {
    all: ['tipos-gasto'] as const,
    lista: () => [...KEYS.all, 'lista'] as const,
}

export const useTiposGasto = () =>
    useQuery({
        queryKey: KEYS.lista(),
        queryFn: () => tiposGastoService.listar(),
        staleTime: 5 * 60 * 1000,
    })

export const useTipoGastoMutations = () => {
    const qc = useQueryClient()
    const invalidate = () => qc.invalidateQueries({ queryKey: KEYS.all })

    const crear = useMutation({
        mutationFn: (dto: Omit<TipoGasto, 'id'>) => tiposGastoService.crear(dto),
        onSuccess: invalidate,
    })

    const actualizar = useMutation({
        mutationFn: ({ id, ...dto }: TipoGasto) => tiposGastoService.actualizar(id, dto),
        onSuccess: invalidate,
    })

    const eliminar = useMutation({
        mutationFn: (id: number) => tiposGastoService.eliminar(id),
        onSuccess: invalidate,
    })

    return { crear, actualizar, eliminar }
}
