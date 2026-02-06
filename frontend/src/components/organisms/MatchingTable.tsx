/**
 * MatchingTable - Tabla de matches usando DataTable
 *
 * Migrado a DataTable para unidad y facilidad de mantenimiento.
 * Usa headerGroups para el layout dual-column (Extracto vs Sistema).
 */

import { useState, useMemo } from 'react'
import { CheckCheck, Unlink, X } from 'lucide-react'
import { Icon } from '../atoms/Icon'
import { Button } from '../atoms/Button'
import { MatchStatusBadge } from '../atoms/MatchStatusBadge'
import { DataTable, type Column, type HeaderGroup } from '../molecules/DataTable'
import type { MovimientoMatch } from '../../types/Matching'
import { MatchEstado } from '../../types/Matching'

interface MatchingTableProps {
    matches: MovimientoMatch[]
    selectedEstados: MatchEstado[]
    onEstadosChange: (estados: MatchEstado[]) => void
    onLimpiar: () => void
    onAprobar?: (match: MovimientoMatch) => void
    onAprobarTodo?: () => void
    onCrear?: (match: MovimientoMatch) => void
    onCrearTodo?: () => void
    onDesvincular?: (match: MovimientoMatch) => void
    onDesvincularTodo?: () => void
    loading?: boolean
    className?: string
}

type SortColumn = 'extracto_fecha' | 'extracto_descripcion' | 'extracto_valor' | 'extracto_usd' | 'extracto_trm' |
    'sistema_fecha' | 'sistema_descripcion' | 'sistema_valor' | 'sistema_usd' | 'sistema_trm' | 'diferencia' | null

// Funciones de formato
const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value)
}

const formatDifference = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value)
}

const formatUSD = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-'
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    }).format(value)
}

const formatTRM = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-'
    return new Intl.NumberFormat('es-CO', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value)
}

const formatDate = (date: Date | string) => {
    if (!date) return '-'
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const [year, month, day] = date.split('-')
        return `${day}/${month}/${year}`
    }
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'UTC'
    })
}

const getValueColor = (value: number): string => {
    if (value > 0) return 'text-green-600'
    if (value < 0) return 'text-red-600'
    return 'text-blue-600'
}

/**
 * Tabla de matches con datos del extracto y sistema lado a lado
 */
export const MatchingTable = ({
    matches,
    selectedEstados,
    onEstadosChange,
    onLimpiar,
    onAprobar,
    onAprobarTodo,
    onCrear,
    onCrearTodo,
    onDesvincular,
    onDesvincularTodo,
    loading = false,
    className = ''
}: MatchingTableProps) => {
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
    const [sortKey, setSortKey] = useState<SortColumn>(null)
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>('desc')

    const toggleEstado = (estado: MatchEstado) => {
        if (selectedEstados.includes(estado)) {
            onEstadosChange(selectedEstados.filter(e => e !== estado))
        } else {
            onEstadosChange([...selectedEstados, estado])
        }
    }

    const toggleRow = (key: string | number) => {
        const id = typeof key === 'string' ? parseInt(key) : key
        if (isNaN(id)) return
        const newExpanded = new Set(expandedRows)
        if (newExpanded.has(id)) {
            newExpanded.delete(id)
        } else {
            newExpanded.add(id)
        }
        setExpandedRows(newExpanded)
    }

    const handleSort = (key: string, direction: 'asc' | 'desc' | null) => {
        setSortKey(key as SortColumn)
        setSortDirection(direction)
    }

    const totalDifference = useMemo(() => {
        return matches.reduce((sum, m) => {
            const diff = m.mov_extracto.valor - (m.mov_sistema?.valor || 0)
            return sum + diff
        }, 0)
    }, [matches])

    const estadosOptions = [
        { value: MatchEstado.SIN_MATCH, label: 'Sin Match', color: 'gray' },
        { value: MatchEstado.PROBABLE, label: 'Probable', color: 'amber' },
        { value: MatchEstado.OK, label: 'OK', color: 'emerald' }
    ]

    // Header Groups para el layout dual-column
    const headerGroups: HeaderGroup[] = useMemo(() => [
        {
            title: (
                <div className="flex flex-col items-center justify-center gap-1">
                    <span>Acciones</span>
                    <div className="flex items-center gap-2">
                        {onAprobarTodo && matches.some(m => m.estado === MatchEstado.PROBABLE) && (
                            <button
                                onClick={onAprobarTodo}
                                className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                                title="Aprobar todos los probables"
                            >
                                <CheckCheck size={16} />
                            </button>
                        )}
                        {onCrearTodo && matches.some(m => m.estado === MatchEstado.SIN_MATCH && !m.mov_sistema) && (
                            <button
                                onClick={onCrearTodo}
                                className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                                title="Crear todos los faltantes"
                            >
                                <CheckCheck size={16} />
                            </button>
                        )}
                        {onDesvincularTodo && matches.some(m => m.id !== null) && (
                            <button
                                onClick={onDesvincularTodo}
                                className="p-1 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
                                title="Desvincular TODO y reiniciar"
                            >
                                <Unlink size={16} />
                            </button>
                        )}
                    </div>
                </div>
            ),
            colSpan: 1,
            className: 'text-center'
        },
        { title: 'Estado', colSpan: 1, className: 'text-left border-l border-gray-200' },
        { title: 'Extracto Bancario', colSpan: 5, className: 'text-left border-l border-gray-200 bg-emerald-50' },
        { title: 'Sistema', colSpan: 5, className: 'text-left border-l border-gray-200 bg-blue-50' },
        { title: 'Diferencia', colSpan: 1, className: 'text-center border-l border-gray-200 bg-purple-50' }
    ], [matches, onAprobarTodo, onCrearTodo, onDesvincularTodo])

    // Definición de columnas
    const columns: Column<MovimientoMatch>[] = useMemo(() => [
        // Acciones
        {
            key: 'actions',
            header: '',
            width: 'w-32',
            align: 'center',
            headerClassName: '!py-1.5 !px-2',
            cellClassName: '!py-0.5 !px-2',
            accessor: (match) => {
                const hasSystemMovement = match.mov_sistema !== null
                const isExpanded = match.id ? expandedRows.has(match.id) : false
                return (
                    <div className="flex items-center justify-center gap-1">
                        {hasSystemMovement && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); match.id && toggleRow(match.id) }}
                                className="!p-1 text-gray-400 hover:text-gray-600"
                                title={isExpanded ? "Ocultar detalles" : "Ver detalles"}
                            >
                                {isExpanded ? <Icon name="ChevronUp" size={15} /> : <Icon name="ChevronDown" size={15} />}
                            </Button>
                        )}
                        {match.estado === MatchEstado.PROBABLE && onAprobar && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); onAprobar(match) }}
                                className="!p-1 text-green-600 hover:text-green-700 bg-green-50 border-green-100"
                                title="Aprobar vinculación"
                            >
                                <Icon name="Check" size={15} />
                            </Button>
                        )}
                        {match.estado === MatchEstado.SIN_MATCH && onCrear && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); onCrear(match) }}
                                className="!p-1 !text-blue-600 hover:!text-blue-700 bg-blue-50 border-blue-100"
                                title="Crear movimiento en sistema"
                            >
                                <Icon name="Check" size={15} />
                            </Button>
                        )}
                        {hasSystemMovement && onDesvincular && (
                            <Button
                                variant="ghost-warning"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); onDesvincular(match) }}
                                className="!p-1"
                                title="Desvincular (Eliminar vinculación)"
                            >
                                <Icon name="Unlink" size={15} />
                            </Button>
                        )}
                    </div>
                )
            }
        },
        // Estado
        {
            key: 'estado',
            header: '',
            width: 'w-24',
            headerClassName: '!py-1.5 !px-2 border-l border-gray-200',
            cellClassName: '!py-0.5 !px-2 border-l border-gray-100',
            accessor: (match) => <MatchStatusBadge estado={match.estado} size="sm" />
        },
        // Extracto - Fecha
        {
            key: 'extracto_fecha',
            header: 'Fecha',
            width: 'w-24',
            sortable: true,
            sortValue: (match) => new Date(match.mov_extracto.fecha).getTime(),
            headerClassName: '!py-1.5 !px-2 border-l border-gray-200 bg-emerald-50 text-xs font-medium text-gray-600',
            cellClassName: '!py-0.5 !px-2 border-l border-gray-100 text-sm text-gray-900',
            accessor: (match) => formatDate(match.mov_extracto.fecha)
        },
        // Extracto - Descripción
        {
            key: 'extracto_descripcion',
            header: 'Descripción',
            sortable: true,
            sortValue: (match) => match.mov_extracto.descripcion.toLowerCase(),
            headerClassName: '!py-1.5 !px-2 bg-emerald-50 text-xs font-medium text-gray-600',
            cellClassName: '!py-0.5 !px-2 text-sm text-gray-900 max-w-xs',
            accessor: (match) => (
                <div className="truncate" title={match.mov_extracto.descripcion}>
                    {match.mov_extracto.descripcion}
                </div>
            )
        },
        // Extracto - Valor
        {
            key: 'extracto_valor',
            header: 'Valor',
            align: 'right',
            sortable: true,
            sortValue: (match) => match.mov_extracto.valor,
            headerClassName: '!py-1.5 !px-2 bg-emerald-50 text-xs font-medium text-gray-600',
            cellClassName: '!py-0.5 !px-2 text-sm font-medium',
            accessor: (match) => (
                <span className={getValueColor(match.mov_extracto.valor)}>
                    {formatCurrency(match.mov_extracto.valor)}
                </span>
            )
        },
        // Extracto - USD
        {
            key: 'extracto_usd',
            header: 'USD',
            align: 'right',
            sortable: true,
            sortValue: (match) => match.mov_extracto.usd || 0,
            headerClassName: '!py-1.5 !px-2 bg-emerald-50 text-xs font-medium text-gray-600',
            cellClassName: '!py-0.5 !px-2 text-sm',
            accessor: (match) => {
                const usd = match.mov_extracto.usd
                return (
                    <span className={usd !== null && usd !== undefined ? getValueColor(usd) : 'text-gray-600'}>
                        {formatUSD(usd)}
                    </span>
                )
            }
        },
        // Extracto - TRM
        {
            key: 'extracto_trm',
            header: 'TRM',
            align: 'right',
            sortable: true,
            sortValue: (match) => match.mov_extracto.trm || 0,
            headerClassName: '!py-1.5 !px-2 bg-emerald-50 text-xs font-medium text-gray-600',
            cellClassName: '!py-0.5 !px-2 text-sm text-gray-600',
            accessor: (match) => formatTRM(match.mov_extracto.trm)
        },
        // Sistema - Fecha
        {
            key: 'sistema_fecha',
            header: 'Fecha',
            width: 'w-24',
            sortable: true,
            sortValue: (match) => match.mov_sistema ? new Date(match.mov_sistema.fecha).getTime() : 0,
            headerClassName: '!py-1.5 !px-2 border-l border-gray-200 bg-blue-50 text-xs font-medium text-gray-600',
            cellClassName: '!py-0.5 !px-2 border-l border-gray-100 text-sm text-gray-900',
            accessor: (match) => match.mov_sistema ? formatDate(match.mov_sistema.fecha) : '-'
        },
        // Sistema - Descripción
        {
            key: 'sistema_descripcion',
            header: 'Descripción',
            sortable: true,
            sortValue: (match) => match.mov_sistema?.descripcion.toLowerCase() || '',
            headerClassName: '!py-1.5 !px-2 bg-blue-50 text-xs font-medium text-gray-600',
            cellClassName: '!py-0.5 !px-2 text-sm text-gray-900 max-w-xs',
            accessor: (match) => match.mov_sistema ? (
                <div className="truncate" title={match.mov_sistema.descripcion}>
                    {match.mov_sistema.descripcion}
                </div>
            ) : (
                <span className="text-gray-400 italic">Sin vinculación</span>
            )
        },
        // Sistema - Valor
        {
            key: 'sistema_valor',
            header: 'Valor',
            align: 'right',
            sortable: true,
            sortValue: (match) => match.mov_sistema?.valor || 0,
            headerClassName: '!py-1.5 !px-2 bg-blue-50 text-xs font-medium text-gray-600',
            cellClassName: '!py-0.5 !px-2 text-sm font-medium',
            accessor: (match) => match.mov_sistema ? (
                <span className={getValueColor(match.mov_sistema.valor)}>
                    {formatCurrency(match.mov_sistema.valor)}
                </span>
            ) : '-'
        },
        // Sistema - USD
        {
            key: 'sistema_usd',
            header: 'USD',
            align: 'right',
            sortable: true,
            sortValue: (match) => match.mov_sistema?.usd || 0,
            headerClassName: '!py-1.5 !px-2 bg-blue-50 text-xs font-medium text-gray-600',
            cellClassName: '!py-0.5 !px-2 text-sm',
            accessor: (match) => {
                if (!match.mov_sistema) return '-'
                const usd = match.mov_sistema.usd
                return (
                    <span className={usd !== null && usd !== undefined ? getValueColor(usd) : 'text-gray-600'}>
                        {formatUSD(usd)}
                    </span>
                )
            }
        },
        // Sistema - TRM
        {
            key: 'sistema_trm',
            header: 'TRM',
            align: 'right',
            sortable: true,
            sortValue: (match) => match.mov_sistema?.trm || 0,
            headerClassName: '!py-1.5 !px-2 bg-blue-50 text-xs font-medium text-gray-600',
            cellClassName: '!py-0.5 !px-2 text-sm text-gray-600',
            accessor: (match) => match.mov_sistema ? formatTRM(match.mov_sistema.trm) : '-'
        },
        // Diferencia
        {
            key: 'diferencia',
            header: 'Dif',
            align: 'right',
            sortable: true,
            sortValue: (match) => match.mov_extracto.valor - (match.mov_sistema?.valor || 0),
            headerClassName: '!py-1.5 !px-2 border-l border-gray-200 bg-purple-50 text-xs font-medium text-gray-600',
            cellClassName: '!py-0.5 !px-2 border-l border-gray-100 text-sm font-medium',
            accessor: (match) => {
                if (!match.mov_sistema) return <span className="text-gray-400">-</span>
                const diff = match.mov_extracto.valor - match.mov_sistema.valor
                return (
                    <span className={getValueColor(diff)}>
                        {formatDifference(diff)}
                    </span>
                )
            }
        }
    ], [expandedRows, onAprobar, onCrear, onDesvincular])

    // Renderizado de fila expandida
    const renderExpandedRow = (match: MovimientoMatch) => {
        if (!match.mov_sistema) return null
        return (
            <div className="flex items-center gap-6 text-sm">
                <div className="font-semibold text-gray-700">Scores de Similitud:</div>
                <div className="flex items-center gap-1">
                    <span className="text-gray-600">Fecha:</span>
                    <span className="font-medium">{(match.score_fecha * 100).toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="text-gray-600">Valor:</span>
                    <span className="font-medium">{(match.score_valor * 100).toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="text-gray-600">Descripción:</span>
                    <span className="font-medium">{(match.score_descripcion * 100).toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-1 ml-auto">
                    <span className="text-gray-600">Total:</span>
                    <span className="font-bold text-blue-600">{(match.score_total * 100).toFixed(0)}%</span>
                </div>
                {match.notas && (
                    <div className="flex items-center gap-1 px-3 py-1 bg-amber-100 rounded">
                        <span className="text-amber-800 text-xs">📝 {match.notas}</span>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm ${className}`}>
            {/* Header con filtros de estado */}
            <div className="p-3 border-b border-gray-100 bg-emerald-50 flex justify-between items-center">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <Unlink className="text-amber-600" size={20} />
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 leading-none">Matches Encontrados</h3>
                            <p className="text-xs text-emerald-700 mt-1">
                                Vinculaciones detectadas
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 pl-4 border-l border-emerald-200">
                        {estadosOptions.map(({ value, label, color }) => {
                            const isSelected = selectedEstados.includes(value)
                            const activeClass = `bg-${color}-100 text-${color}-700 border-${color}-300 ring-1 ring-${color}-300`
                            const inactiveClass = 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'

                            return (
                                <button
                                    key={value}
                                    onClick={() => toggleEstado(value)}
                                    className={`
                                        px-3 py-1 rounded-md text-xs font-semibold border transition-all
                                        ${isSelected ? activeClass : inactiveClass}
                                    `}
                                >
                                    {label}
                                </button>
                            )
                        })}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {selectedEstados.length > 0 && (
                        <button
                            onClick={onLimpiar}
                            className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-600 transition-colors"
                        >
                            <X size={14} />
                            Limpiar
                        </button>
                    )}
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
                        {matches.length} registros
                    </span>
                    <span className={`px-3 py-1 bg-purple-100 rounded-full text-xs font-bold ${getValueColor(totalDifference)}`}>
                        Dif: {formatDifference(totalDifference)}
                    </span>
                </div>
            </div>

            {/* DataTable */}
            <DataTable
                data={matches}
                columns={columns}
                headerGroups={headerGroups}
                loading={loading}
                emptyMessage="No se encontraron matches con los filtros aplicados"
                getRowKey={(match, index) => match.id || `match-${index}`}
                showActions={false}
                rounded={false}
                stickyHeader={true}
                maxHeight="70vh"
                rowPy="py-0.5"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
                expandedKeys={expandedRows as Set<string | number>}
                onToggleExpand={toggleRow}
                renderExpandedRow={renderExpandedRow}
                expandedRowClassName="bg-gray-50"
            />
        </div>
    )
}
