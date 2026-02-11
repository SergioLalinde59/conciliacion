import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { indicadoresService } from '../services/indicadores.service'
import type { IndicadorEconomico } from '../types/IndicadorEconomico'

const KEYS = {
    all: ['indicadores-economicos'] as const,
    lista: (anio?: number) => [...KEYS.all, 'lista', anio] as const,
}

export const useIndicadores = (anio?: number) =>
    useQuery({
        queryKey: KEYS.lista(anio),
        queryFn: () => indicadoresService.listar(anio),
        staleTime: 5 * 60 * 1000,
    })

export const useIndicadorMutations = () => {
    const qc = useQueryClient()
    const invalidate = () => qc.invalidateQueries({ queryKey: KEYS.all })

    const crear = useMutation({
        mutationFn: (dto: Omit<IndicadorEconomico, 'id'>) => indicadoresService.crear(dto),
        onSuccess: invalidate,
    })

    const actualizar = useMutation({
        mutationFn: ({ id, ...dto }: IndicadorEconomico) => indicadoresService.actualizar(id, dto),
        onSuccess: invalidate,
    })

    const eliminar = useMutation({
        mutationFn: (id: number) => indicadoresService.eliminar(id),
        onSuccess: invalidate,
    })

    return { crear, actualizar, eliminar }
}
