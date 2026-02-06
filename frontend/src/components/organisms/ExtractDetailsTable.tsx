import { useMemo, useState, useEffect } from 'react'
import { Edit2, CheckCircle2, FileStack, AlertTriangle, Filter } from 'lucide-react'
import { Button } from '../atoms/Button'
import type { Column } from '../molecules/DataTable'
import { DataTable } from '../molecules/DataTable'
import { TableHeaderCell } from '../atoms/TableHeaderCell'

export interface ExtractDetailRow {
    id?: number | string
    fecha: string
    descripcion: string
    referencia?: string
    valor: number
    moneda?: string
    raw_text?: string
    usd?: number
    trm?: number
    es_duplicado?: boolean
    numero_linea?: number
    es_candidato?: boolean // Marcado internamente
}

export type ExtractFilterType = 'todos' | 'a_cargar' | 'duplicados' | 'candidatos'

interface ExtractDetailsTableProps {
    records: ExtractDetailRow[]
    onEdit?: (record: ExtractDetailRow, index: number) => void
    /** Diferencias del descuadre para identificar candidatos */
    diferencias?: {
        entradas: number
        salidas: number
        rendimientos: number
        retenciones: number
    }
    /** Filtro inicial (si no se especifica, se calcula automáticamente) */
    filtroInicial?: ExtractFilterType
    /** Indica si la cuenta es en USD (para mostrar columna USD en vez de COP) */
    esUSD?: boolean
}

/** Tolerancia para considerar un valor como candidato (en pesos) */
const TOLERANCIA_CANDIDATO = 100

export const ExtractDetailsTable = ({
    records,
    onEdit,
    diferencias,
    filtroInicial,
    esUSD = false
}: ExtractDetailsTableProps) => {

    // Calcular candidatos basados en las diferencias
    const { recordsConCandidatos, conteos } = useMemo(() => {
        const diffs = diferencias || { entradas: 0, salidas: 0, rendimientos: 0, retenciones: 0 }
        const diffValues = [
            Math.abs(diffs.entradas),
            Math.abs(diffs.salidas),
            Math.abs(diffs.rendimientos),
            Math.abs(diffs.retenciones)
        ].filter(v => v > TOLERANCIA_CANDIDATO)

        let candidatosCount = 0
        let duplicadosCount = 0
        let aCargarCount = 0

        const marcados = records.map(r => {
            // Para cuentas USD, usar el campo usd; para COP, usar valor
            const valorAbs = esUSD ? Math.abs(Number(r.usd ?? 0)) : Math.abs(Number(r.valor))
            // Es candidato si su valor coincide con alguna diferencia
            const esCandidato = diffValues.some(diff =>
                Math.abs(valorAbs - diff) < TOLERANCIA_CANDIDATO
            )

            if (r.es_duplicado) duplicadosCount++
            else aCargarCount++
            if (esCandidato && !r.es_duplicado) candidatosCount++

            return { ...r, es_candidato: esCandidato && !r.es_duplicado }
        })

        return {
            recordsConCandidatos: marcados,
            conteos: {
                todos: records.length,
                a_cargar: aCargarCount,
                duplicados: duplicadosCount,
                candidatos: candidatosCount
            }
        }
    }, [records, diferencias, esUSD])

    // Determinar filtro por defecto
    const filtroDefault: ExtractFilterType = useMemo(() => {
        if (filtroInicial) return filtroInicial
        // Prioridad: a_cargar > duplicados > todos
        if (conteos.a_cargar > 0) return 'a_cargar'
        if (conteos.duplicados > 0) return 'duplicados'
        return 'todos'
    }, [filtroInicial, conteos.a_cargar, conteos.duplicados])

    const [filtroActivo, setFiltroActivo] = useState<ExtractFilterType>(filtroDefault)

    // Actualizar filtro cuando cambie el default
    useEffect(() => {
        setFiltroActivo(filtroDefault)
    }, [filtroDefault])

    // Filtrar y ordenar registros
    const displayData = useMemo(() => {
        let filtered = [...recordsConCandidatos]

        switch (filtroActivo) {
            case 'a_cargar':
                filtered = filtered.filter(r => !r.es_duplicado)
                break
            case 'duplicados':
                filtered = filtered.filter(r => r.es_duplicado)
                break
            case 'candidatos':
                filtered = filtered.filter(r => r.es_candidato)
                break
            // 'todos' no filtra
        }

        // Ordenar por fecha descendente
        filtered.sort((a, b) => {
            const dateA = new Date(a.fecha).getTime()
            const dateB = new Date(b.fecha).getTime()
            return dateB - dateA
        })

        return filtered.map((r) => ({
            ...r,
            valor: Number(r.valor),
            originalIndex: records.indexOf(r)
        }))
    }, [recordsConCandidatos, filtroActivo, records])

    if (!records || records.length === 0) return (
        <div className="p-8 text-center text-gray-500">
            No hay registros para mostrar.
        </div>
    )

    const columns: Column<any>[] = useMemo(() => [
        {
            key: 'actions',
            header: <TableHeaderCell>Acción</TableHeaderCell>,
            align: 'center',
            width: 'w-12',
            cellClassName: '!py-1',
            accessor: (row) => {
                // Solo permitir edición para candidatos (posibles errores de lectura)
                const puedeEditar = row.es_candidato && onEdit
                return puedeEditar ? (
                    <Button
                        variant="ghost-warning"
                        size="sm"
                        onClick={() => onEdit(row, row.originalIndex)}
                        className="!p-1 h-7 w-7"
                        title="Corregir error de lectura"
                    >
                        <Edit2 size={12} />
                    </Button>
                ) : null
            }
        },
        {
            key: 'estado_label',
            header: <TableHeaderCell>Estado</TableHeaderCell>,
            sortable: true,
            sortKey: 'es_duplicado',
            width: 'w-16',
            align: 'center',
            cellClassName: '!py-1',
            accessor: (row) => {
                if (row.es_candidato) {
                    return (
                        <div title="Candidato - Podría explicar el descuadre" className="flex justify-center">
                            <AlertTriangle size={14} className="text-amber-500" />
                        </div>
                    )
                }
                if (row.es_duplicado) {
                    return (
                        <div title="Duplicado - Ya existe en el sistema" className="flex justify-center">
                            <FileStack size={14} className="text-slate-400" />
                        </div>
                    )
                }
                return (
                    <div title="Nuevo - Se cargará al sistema" className="flex justify-center">
                        <CheckCircle2 size={14} className="text-emerald-500" />
                    </div>
                )
            }
        },
        {
            key: 'fecha',
            header: <TableHeaderCell>Fecha</TableHeaderCell>,
            sortable: true,
            width: 'w-24',
            cellClassName: '!py-1 text-[11px] font-mono',
            accessor: (row) => <span className="font-medium text-slate-700">{row.fecha}</span>
        },
        {
            key: 'descripcion',
            header: <TableHeaderCell>Descripción</TableHeaderCell>,
            sortable: true,
            width: 'w-64',
            cellClassName: '!py-1 text-[11px]',
            accessor: (row) => (
                <div className="flex flex-col">
                    <span className={`font-medium break-words leading-tight ${row.es_candidato ? 'text-amber-700' : 'text-slate-800'}`} title={row.descripcion}>
                        {row.descripcion}
                    </span>
                    {row.referencia && <span className="text-[9px] text-slate-400 font-mono">Ref: {row.referencia}</span>}
                </div>
            )
        },
        {
            key: 'valor',
            header: <TableHeaderCell>{esUSD ? 'Valor (USD)' : 'Valor (COP)'}</TableHeaderCell>,
            sortable: true,
            align: 'right',
            width: 'w-28',
            cellClassName: '!py-1 text-[11px]',
            accessor: (row) => {
                // Para cuentas USD, usar el campo usd; para COP, usar valor
                const val = esUSD ? Number(row.usd ?? 0) : Number(row.valor)
                let colorClass = val > 0 ? 'text-emerald-600' : 'text-rose-600'
                if (row.es_candidato) {
                    colorClass = 'text-amber-600 bg-amber-50 px-1 rounded'
                }
                const formatter = esUSD
                    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
                    : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
                return (
                    <span className={`font-mono font-black ${colorClass}`}>
                        {formatter.format(val)}
                    </span>
                )
            }
        },
        {
            key: 'raw_text',
            header: <TableHeaderCell>Original</TableHeaderCell>,
            sortable: true,
            width: 'w-[480px]',
            cellClassName: '!py-1 text-[10px]',
            accessor: (row) => (
                <div className={`font-mono truncate max-w-[460px] leading-tight ${row.es_candidato ? 'text-amber-600' : 'text-slate-400'}`} title={row.raw_text}>
                    {row.raw_text || '-'}
                </div>
            )
        }
    ], [onEdit, esUSD])

    const FilterChip = ({ tipo, label, count, isActive, color }: {
        tipo: ExtractFilterType,
        label: string,
        count: number,
        isActive: boolean,
        color: string
    }) => (
        <button
            onClick={() => setFiltroActivo(tipo)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all flex items-center gap-1.5
                ${isActive
                    ? `${color} shadow-sm`
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
        >
            {label}
            <span className={`px-1.5 py-0.5 rounded text-[9px] ${isActive ? 'bg-white/30' : 'bg-slate-200'}`}>
                {count}
            </span>
        </button>
    )

    return (
        <div className="h-full flex flex-col bg-white overflow-hidden">
            {/* Barra de filtros */}
            <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <Filter size={12} className="text-slate-400" />
                    <FilterChip
                        tipo="todos"
                        label="Todos"
                        count={conteos.todos}
                        isActive={filtroActivo === 'todos'}
                        color="bg-slate-600 text-white"
                    />
                    <FilterChip
                        tipo="a_cargar"
                        label="A Cargar"
                        count={conteos.a_cargar}
                        isActive={filtroActivo === 'a_cargar'}
                        color="bg-emerald-500 text-white"
                    />
                    <FilterChip
                        tipo="duplicados"
                        label="Duplicados"
                        count={conteos.duplicados}
                        isActive={filtroActivo === 'duplicados'}
                        color="bg-slate-500 text-white"
                    />
                    {conteos.candidatos > 0 && (
                        <FilterChip
                            tipo="candidatos"
                            label="Candidatos"
                            count={conteos.candidatos}
                            isActive={filtroActivo === 'candidatos'}
                            color="bg-amber-500 text-white"
                        />
                    )}
                </div>
                {filtroActivo === 'candidatos' && conteos.candidatos > 0 && (
                    <span className="text-[10px] text-amber-600 font-medium">
                        Estos registros podrían explicar el descuadre. Verifique el texto original.
                    </span>
                )}
            </div>

            <DataTable
                data={displayData}
                columns={columns}
                getRowKey={(row, index) => `${row.descripcion || row.fecha}-${index}`}
                showActions={false}
                rounded={false}
                stickyHeader={true}
                className="flex-1"
                rowPy="py-1"
                maxHeight="100%"
                defaultSortKey="fecha"
                defaultSortDirection="desc"
            />
        </div>
    )
}
