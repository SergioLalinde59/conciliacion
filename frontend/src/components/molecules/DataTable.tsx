import React from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { DataTableSortIcon } from '../atoms/DataTableSortIcon';
import { useState, useMemo } from 'react'
import { Button } from '../atoms/Button'

/**
 * Definición de una columna para DataTable
 */
export interface Column<T> {
    key?: string;
    header: React.ReactNode;
    accessor?: (row: T, index?: number) => React.ReactNode;
    render?: (row: T, index?: number) => React.ReactNode;
    sortKey?: keyof T;
    sortValue?: (row: T) => number | string;
    sortable?: boolean;
    width?: string;
    align?: 'left' | 'center' | 'right';
    className?: string;
    cellClassName?: string;
    headerClassName?: string;
    type?: 'number' | 'string' | 'date' | 'custom';
    tooltip?: string;
}

/**
 * Definición de un grupo de encabezados
 */
export interface HeaderGroup {
    /** Título del grupo */
    title: React.ReactNode
    /** Cuantas columnas abarca */
    colSpan: number
    /** Clases CSS adicionales */
    className?: string
}

/**
 * Props para DataTable
 */
export interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    headerGroups?: HeaderGroup[];
    loading?: boolean;
    loadingMessage?: string;
    emptyMessage?: string;
    getRowKey: (row: T, index: number) => string | number;
    onEdit?: (row: T) => void;
    onDelete?: (row: T) => void;
    deleteConfirmMessage?: string | ((row: T) => string);
    showActions?: boolean;
    className?: string;
    rounded?: boolean;
    stickyHeader?: boolean;
    defaultSortKey?: string;
    defaultSortDirection?: SortDirection;
    sortKey?: string | null;
    sortDirection?: SortDirection;
    onSort?: (key: string, direction: SortDirection) => void;
    rowPy?: string;
    containerRef?: React.RefObject<HTMLDivElement | null>;
    onScroll?: React.UIEventHandler<HTMLDivElement>;
    style?: React.CSSProperties;
    maxHeight?: string | number;
    responsive?: boolean;
    /** Filas expandibles: renderiza contenido debajo de la fila si está expandida */
    renderExpandedRow?: (row: T, index: number) => React.ReactNode | null;
    /** Keys de las filas actualmente expandidas */
    expandedKeys?: Set<string | number>;
    /** Callback cuando se hace click en una fila para expandir/colapsar */
    onToggleExpand?: (key: string | number) => void;
    /** Clase CSS para filas expandidas */
    expandedRowClassName?: string;
}

type SortDirection = 'asc' | 'desc' | null

/**
 * Componente DataTable genérico y reutilizable
 * 
 * @example
 * <DataTable
 *   data={grupos}
 *   loading={loading}
 *   columns={[
 *     { key: 'id', header: 'ID', width: 'w-20' },
 *     { key: 'nombre', header: 'Nombre', sortable: true },
 *   ]}
 *   getRowKey={(g) => g.id}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 * />
 */
export function DataTable<T extends Record<string, any>>({
    data,
    columns,
    headerGroups,
    loading = false,
    loadingMessage = 'Cargando...',
    emptyMessage = 'No hay datos para mostrar.',
    getRowKey,
    onEdit,
    onDelete,
    deleteConfirmMessage = '¿Estás seguro de eliminar este registro?',
    showActions = true,
    className = '',
    rounded = true,
    stickyHeader = false,
    defaultSortKey,
    defaultSortDirection,
    sortKey: controlledSortKey,
    sortDirection: controlledSortDirection,
    onSort,
    rowPy = 'py-3',
    containerRef,
    onScroll,
    style,
    maxHeight,
    responsive = true,
    renderExpandedRow,
    expandedKeys,
    onToggleExpand,
    expandedRowClassName = 'bg-gray-50',
}: DataTableProps<T>) {
    // Determinar columna y dirección de ordenamiento por defecto
    const initialSortKey = defaultSortKey ?? columns.find(c => c.sortable)?.key ?? null;
    const initialSortDirection: SortDirection = defaultSortDirection
        ?? (columns.find(c => c.key === initialSortKey)?.type === 'number' ? 'desc' : 'asc');

    // Estado interno solo si no se controla externamente
    const [internalSortKey, setInternalSortKey] = useState<string | null>(initialSortKey);
    const [internalSortDirection, setInternalSortDirection] = useState<SortDirection>(initialSortDirection);

    // Determinar qué estado usar
    const isControlled = controlledSortKey !== undefined;
    const currentSortKey = isControlled ? controlledSortKey : internalSortKey;
    const currentSortDirection = isControlled ? controlledSortDirection : internalSortDirection;

    // Ordenar datos (solo si no es controlado)
    const sortedData = useMemo(() => {
        if (isControlled) return data;
        if (!currentSortKey || !currentSortDirection) return data;
        const column = columns.find(c => c.key === currentSortKey);
        if (!column) return data;
        const key = column.sortKey ?? column.key;
        const getSortValue = column.sortValue
            ? column.sortValue
            : (row: T) => row[key as keyof T];
        return [...data].sort((a, b) => {
            const aVal = getSortValue(a);
            const bVal = getSortValue(b);
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return currentSortDirection === 'asc' ? 1 : -1;
            if (bVal == null) return currentSortDirection === 'asc' ? -1 : 1;
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return currentSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
            }
            return currentSortDirection === 'asc'
                ? String(aVal).localeCompare(String(bVal))
                : String(bVal).localeCompare(String(aVal));
        });
    }, [data, currentSortKey, currentSortDirection, columns, isControlled]);

    // Toggle ordenamiento
    const handleSort = (columnKey: string) => {
        const column = columns.find(c => c.key === columnKey);
        if (!column?.sortable) return;
        let newDirection: SortDirection = column.type === 'number' ? 'desc' : 'asc';
        let newKey: string | null = columnKey;
        if (currentSortKey === columnKey) {
            // Ciclar: asc <-> desc
            if (currentSortDirection === 'asc') newDirection = 'desc';
            else newDirection = 'asc';
        }
        if (isControlled && onSort) {
            onSort(newKey || '', newDirection);
        } else {
            setInternalSortKey(newKey);
            setInternalSortDirection(newDirection);
        }
    };

    // Manejar eliminación con confirmación
    const handleDelete = (row: T) => {
        const message = typeof deleteConfirmMessage === 'function'
            ? deleteConfirmMessage(row)
            : deleteConfirmMessage

        if (confirm(message)) {
            onDelete?.(row)
        }
    }

    // Renderizar celda
    const renderCell = (row: T, column: Column<T>, index: number) => {
        const renderer = column.render || column.accessor
        if (renderer) {
            return renderer(row, index)
        }
        return column.key ? row[column.key as keyof T] : null
    }

    // Estado loading
    if (loading) {
        return (
            <div className="p-8 text-center text-gray-500">
                <div className="inline-block w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mr-2" />
                {loadingMessage}
            </div>
        )
    }

    // Estado vacío
    if (data.length === 0) {
        return (
            <div className="p-8 text-center text-gray-500">
                {emptyMessage}
            </div>
        )
    }

    const showActionsColumn = showActions && (onEdit || onDelete);

    return (
        <div
            ref={containerRef}
            onScroll={onScroll}
            style={{
                ...style,
                maxHeight: maxHeight || 'calc(100vh - 220px)',
                overflowY: 'auto',
                width: responsive ? '100%' : undefined,
            }}
            className={`overflow-x-auto ${rounded ? 'rounded-lg' : ''} ${className}`}
        >
            <table className="w-full text-left border-collapse">
                <thead>
                    {headerGroups && (
                        <tr className={`bg-gray-50 border-b border-gray-200 ${stickyHeader ? 'sticky top-0 z-10' : ''}`}>
                            {headerGroups.map((group, index) => (
                                <th
                                    key={index}
                                    colSpan={group.colSpan}
                                    className={`py-2 px-4 text-xs font-bold uppercase tracking-wider ${group.className ?? ''}`}
                                >
                                    {group.title}
                                </th>
                            ))}
                        </tr>
                    )}
                    <tr className={`border-b border-gray-200 bg-gray-50 ${stickyHeader ? (headerGroups ? 'sticky top-[25px] z-10' : 'sticky top-0 z-10') : ''}`}>
                        {showActionsColumn && (
                            <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-left w-32 sticky left-0 bg-gray-50 z-20">
                                Acciones
                            </th>
                        )}
                        {columns.map((column) => (
                            <th
                                key={column.key}
                                className={`
                                    py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider
                                    ${column.width ?? ''}
                                    ${column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left'}
                                    ${column.sortable ? 'cursor-pointer select-none hover:bg-gray-100 transition-colors' : ''}
                                    ${column.headerClassName ?? ''}
                                `}
                                onClick={() => column.sortable && column.key && handleSort(column.key)}
                                title={column.tooltip}
                            >
                                <div className={`flex items-center gap-1 ${column.align === 'right' ? 'justify-end' : column.align === 'center' ? 'justify-center' : ''}`}>
                                    {column.header}
                                    {column.sortable && (
                                        <DataTableSortIcon
                                            active={currentSortKey === column.key}
                                            direction={currentSortKey === column.key ? currentSortDirection : null}
                                        />
                                    )}
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {sortedData.map((row, index) => {
                        const rowKey = getRowKey(row, index);
                        const isExpanded = expandedKeys?.has(rowKey) ?? false;
                        const expandedContent = renderExpandedRow?.(row, index);
                        const totalColumns = columns.length + (showActionsColumn ? 1 : 0);

                        return (
                            <React.Fragment key={rowKey}>
                                <tr
                                    className={`hover:bg-gray-50 transition-colors ${onToggleExpand ? 'cursor-pointer' : ''}`}
                                    onClick={() => onToggleExpand?.(rowKey)}
                                >
                                    {showActionsColumn && (
                                        <td className={`${rowPy} px-4 text-left sticky left-0 bg-white z-10`}>
                                            <div className="flex gap-2">
                                                {onEdit && (
                                                    <Button
                                                        variant="ghost-warning"
                                                        size="sm"
                                                        onClick={(e) => { e.stopPropagation(); onEdit(row); }}
                                                        className="!p-1.5"
                                                        title="Editar"
                                                    >
                                                        <Pencil size={15} />
                                                    </Button>
                                                )}
                                                {onDelete && (
                                                    <Button
                                                        variant="ghost-danger"
                                                        size="sm"
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(row); }}
                                                        className="!p-1.5"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={15} />
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                    {columns.map((column) => (
                                        <td
                                            key={column.key}
                                            className={`
                                                ${rowPy} px-4 text-sm
                                                ${column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left'}
                                                ${column.className ?? ''}
                                                ${column.cellClassName ?? ''}
                                            `}
                                        >
                                            {renderCell(row, column, index)}
                                        </td>
                                    ))}
                                </tr>
                                {isExpanded && expandedContent && (
                                    <tr className={expandedRowClassName}>
                                        <td colSpan={totalColumns} className="px-4 py-3">
                                            {expandedContent}
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

/**
 * Helper para crear columnas fácilmente
 */
export const createColumn = <T,>(column: Column<T>): Column<T> => column

/**
 * Columna de ID preconfigurada
 */
export const idColumn = <T extends { id: number }>(overrides?: Partial<Column<T>>): Column<T> => ({
    key: 'id',
    header: 'ID',
    width: 'w-20',
    accessor: (row) => <span className="font-mono text-gray-600">#{row.id}</span>,
    sortable: true,
    ...overrides,
})

/**
 * Columna de nombre preconfigurada
 */
export const nombreColumn = <T extends { nombre: string }>(overrides?: Partial<Column<T>>): Column<T> => ({
    key: 'nombre',
    header: 'Nombre',
    accessor: (row) => <span className="font-medium text-gray-900">{row.nombre}</span>,
    sortable: true,
    ...overrides,
})
