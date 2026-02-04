import { useMemo } from 'react'
import { Edit2, CheckCircle2, FileStack } from 'lucide-react'
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
    es_duplicado?: boolean
    numero_linea?: number
}

interface ExtractDetailsTableProps {
    records: ExtractDetailRow[]
    onEdit?: (record: ExtractDetailRow, index: number) => void
    isGrouped?: boolean
    showOnlyNew?: boolean
}

export const ExtractDetailsTable = ({ records, onEdit, showOnlyNew = false }: ExtractDetailsTableProps) => {
    // Ordenar por fecha descendente y filtrar si es necesario
    const sortedRecords = useMemo(() => {
        let filtered = [...records]
        if (showOnlyNew) {
            filtered = filtered.filter(r => !r.es_duplicado)
        }
        return filtered.sort((a, b) => {
            const dateA = new Date(a.fecha).getTime()
            const dateB = new Date(b.fecha).getTime()
            return dateB - dateA
        })
    }, [records, showOnlyNew])

    const displayData = useMemo(() => {
        return sortedRecords.map((r) => ({
            ...r,
            valor: Number(r.valor),
            estado_label: r.es_duplicado ? 'Duplicado' : 'A Cargar',
            originalIndex: records.indexOf(r) // Mantener el índice original para el edit
        }))
    }, [sortedRecords, records])

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
            accessor: (row) => onEdit && (
                <Button
                    variant="ghost-warning"
                    size="sm"
                    onClick={() => onEdit(row, row.originalIndex)}
                    className="!p-1 h-7 w-7"
                    title="Modificar movimiento"
                >
                    <Edit2 size={12} />
                </Button>
            )
        },
        {
            key: 'estado_label',
            header: <TableHeaderCell>Estado</TableHeaderCell>,
            sortable: true,
            sortKey: 'es_duplicado',
            width: 'w-16',
            align: 'center',
            cellClassName: '!py-1',
            accessor: (row) => row.es_duplicado ? (
                <div title="Duplicado - Ya existe en el sistema" className="flex justify-center">
                    <FileStack size={14} className="text-slate-500" />
                </div>
            ) : (
                <div title="Nuevo - Se cargará al sistema" className="flex justify-center">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                </div>
            )
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
                    <span className="font-medium text-slate-800 break-words leading-tight" title={row.descripcion}>{row.descripcion}</span>
                    {row.referencia && <span className="text-[9px] text-slate-400 font-mono">Ref: {row.referencia}</span>}
                </div>
            )
        },
        {
            key: 'valor',
            header: <TableHeaderCell>Valor (COP)</TableHeaderCell>,
            sortable: true,
            align: 'right',
            width: 'w-28',
            cellClassName: '!py-1 text-[11px]',
            accessor: (row) => {
                const val = Number(row.valor)
                const colorClass = val > 0 ? 'text-emerald-600' : 'text-rose-600'
                return (
                    <span className={`font-mono font-black ${colorClass}`}>
                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val)}
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
                <div className="font-mono text-slate-400 truncate max-w-[460px] leading-tight" title={row.raw_text}>
                    {row.raw_text || '-'}
                </div>
            )
        }
    ], [onEdit])

    return (
        <div className="h-full flex flex-col bg-white overflow-hidden">
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

