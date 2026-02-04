import { useMemo } from 'react';
import { DataTable, type DataTableProps } from './DataTable';
import { selectionColumn } from '../atoms/columnHelpers';

interface SelectableDataTableProps<T extends Record<string, any>> extends Omit<DataTableProps<T>, 'columns'> {
    columns: any[]; // We use any[] here to allow the column type from columnHelpers
    selectedIds: Set<string | number>;
    onSelectionChange: (selected: Set<string | number>) => void;
    getRowId: (row: T) => string | number;
}

/**
 * SelectableDataTable
 * 
 * Una extensión de DataTable que inyecta automáticamente la lógica de selección múltiple.
 * Maneja el checkbox del encabezado y de cada fila.
 */
export function SelectableDataTable<T extends Record<string, any>>({
    data,
    columns,
    selectedIds,
    onSelectionChange,
    getRowId,
    ...props
}: SelectableDataTableProps<T>) {

    // Inyectar la columna de selección al inicio
    const selectableColumns = useMemo(() => {
        const isHeaderSelected = data.length > 0 && selectedIds.size === data.length;

        const selectionCol = selectionColumn<T>(
            (row) => selectedIds.has(getRowId(row)),
            (row, checked) => {
                const newSelection = new Set(selectedIds);
                const id = getRowId(row);
                if (checked) {
                    newSelection.add(id);
                } else {
                    newSelection.delete(id);
                }
                onSelectionChange(newSelection);
            },
            isHeaderSelected,
            (checked) => {
                if (checked) {
                    onSelectionChange(new Set(data.map(row => getRowId(row))));
                } else {
                    onSelectionChange(new Set());
                }
            }
        );

        return [selectionCol, ...columns];
    }, [data, columns, selectedIds, onSelectionChange, getRowId]);

    return (
        <DataTable
            {...props}
            data={data}
            columns={selectableColumns}
        />
    );
}
