import React from 'react';
import type { Movimiento } from '../../types';
import { SelectableDataTable } from '../molecules/SelectableDataTable';
import { TableHeaderCell } from '../atoms/TableHeaderCell';
import { idColumn, fechaColumn, textoColumn, monedaColumn } from '../atoms/columnHelpers';

interface Props {
    movimientos: Movimiento[];
    selectedIds: Set<number>;
    onSelectionChange: (selectedIds: Set<number | string>) => void;
    loading?: boolean;
}

/**
 * BatchClassificationPreviewTable
 * 
 * Organismo que muestra la previsualización de movimientos a clasificar en lote.
 * Utiliza SelectableDataTable para manejar la selección múltiple.
 */
export const BatchClassificationPreviewTable: React.FC<Props> = ({
    movimientos,
    selectedIds,
    onSelectionChange,
    loading = false
}) => {

    const columns = [
        idColumn<Movimiento>(
            'id',
            <TableHeaderCell>ID</TableHeaderCell>,
            (m) => m.id,
            { width: 'w-16' }
        ),
        fechaColumn<Movimiento>(
            'fecha',
            <TableHeaderCell>Fecha</TableHeaderCell>,
            (m) => m.fecha,
            { width: 'w-24' }
        ),
        textoColumn<Movimiento>(
            'descripcion',
            <TableHeaderCell>Descripción</TableHeaderCell>,
            (m) => m.descripcion,
            { cellClassName: 'truncate max-w-xs' }
        ),
        monedaColumn<Movimiento>(
            'valor',
            <TableHeaderCell>Valor</TableHeaderCell>,
            (row) => {
                const isUsd = row.cuenta_display?.toLowerCase().includes('usd') || (row.usd && row.usd !== 0);
                return isUsd ? (row.usd || 0) : row.valor;
            },
            (row) => {
                const isUsd = row.cuenta_display?.toLowerCase().includes('usd') || (row.usd && row.usd !== 0);
                return isUsd ? 'USD' : 'COP';
            },
            { sortable: true }
        )
    ];

    return (
        <SelectableDataTable
            data={movimientos}
            columns={columns}
            selectedIds={selectedIds}
            onSelectionChange={onSelectionChange}
            getRowId={(m) => m.id}
            loading={loading}
            emptyMessage="No hay movimientos que coincidan con el patrón"
            getRowKey={(m) => m.id}
            showActions={false}
            className="max-h-[400px]"
        />
    );
};
