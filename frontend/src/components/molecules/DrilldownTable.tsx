import { useState, useMemo } from 'react';
import { DataTable, type DataTableProps } from './DataTable';
import { MovimientosDetailModal } from '../organisms/modals/MovimientosDetailModal';
import type { Movimiento } from '../../types';
import { TableHeaderCell } from '../atoms/TableHeaderCell';
import { Button } from '../atoms/Button';
import { Eye } from 'lucide-react';

interface DrilldownTableProps extends DataTableProps<Movimiento> {
}

/**
 * DrilldownTable
 * 
 * Un componente especializado que envuelve DataTable y añade automáticamente
 * una columna de acción para abrir el modal de detalle.
 */
export function DrilldownTable({ columns, ...props }: DrilldownTableProps) {
    const [selectedMovimiento, setSelectedMovimiento] = useState<Movimiento | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleViewDetail = (row: Movimiento) => {
        setSelectedMovimiento(row);
        setIsModalOpen(true);
    };

    const enhancedColumns = useMemo(() => [
        {
            key: 'view_detail',
            header: <TableHeaderCell>Ver</TableHeaderCell>,
            width: 'w-10',
            align: 'center' as const,
            accessor: (row: Movimiento) => (
                <Button
                    variant="ghost"
                    size="sm"
                    className="!p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => handleViewDetail(row)}
                >
                    <Eye size={14} />
                </Button>
            )
        },
        ...columns
    ], [columns]);

    return (
        <>
            <DataTable
                {...props}
                columns={enhancedColumns}
            />

            <MovimientosDetailModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                movimiento={selectedMovimiento}
            />
        </>
    );
}
