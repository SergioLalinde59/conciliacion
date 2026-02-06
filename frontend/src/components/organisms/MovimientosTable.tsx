import { Eye, LayoutList } from 'lucide-react'
import { EntityDisplay } from '../molecules/entities/EntityDisplay'
import { ClassificationDisplay } from '../molecules/entities/ClassificationDisplay'
import { Button } from '../atoms/Button'
import { DataTable } from '../molecules/DataTable'
import type { Column } from '../molecules/DataTable'
import { textoColumn, fechaColumn, monedaColumn, idColumn } from '../atoms/columnHelpers'
import { TableHeaderCell } from '../atoms/TableHeaderCell'
import { useState, useMemo, useEffect, useRef } from 'react'

import type { Movimiento } from '../../types'

// Props para la tabla de movimientos
interface MovimientosTableProps {
    movimientos: Movimiento[];
    loading?: boolean;
    onEdit?: (mov: Movimiento) => void;
    onView?: (mov: Movimiento) => void;
    onDelete?: (mov: Movimiento) => void;
}

export const MovimientosTable = ({ movimientos, loading, onView }: MovimientosTableProps) => {
    // Infinite scroll state
    const [visibleLimit, setVisibleLimit] = useState(15);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Reset limit when filters change (movimientos list changes)
    useEffect(() => {
        setVisibleLimit(15);
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }
    }, [movimientos]);

    // Handle infinite scroll
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        // Load more when scrolled near bottom (100px threshold)
        if (scrollHeight - scrollTop - clientHeight < 100) {
            if (visibleLimit < movimientos.length) {
                setVisibleLimit(prev => Math.min(prev + 15, movimientos.length));
            }
        }
    };

    // Columns definition (same as before)
    const columns: Column<Movimiento>[] = useMemo(() => [
        {
            key: 'actions',
            header: <TableHeaderCell>Acción</TableHeaderCell>,
            align: 'center',
            width: 'w-20',
            headerClassName: '!py-2.5 !px-0.5 text-[10px] font-bold text-gray-400 tracking-wide',
            cellClassName: '!py-0.5 !px-0.5',
            accessor: (row) => (
                <div className="flex items-center justify-center gap-1">
                    {onView && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onView(row)}
                            className="!p-1.5 text-blue-600 hover:text-blue-700"
                            title="Ver Detalles"
                        >
                            <Eye size={15} />
                        </Button>
                    )}
                </div>
            )
        },
        idColumn<Movimiento>('id', <TableHeaderCell>ID</TableHeaderCell>, row => `#${row.id}`, {
            width: 'w-10',
        }),
        fechaColumn<Movimiento>('fecha', <TableHeaderCell>Fecha</TableHeaderCell>, row => row.fecha, {
            width: 'w-18',
        }),
        {
            key: 'cuenta',
            header: <TableHeaderCell>Cuenta</TableHeaderCell>,
            sortable: true,
            sortKey: 'cuenta_nombre',
            width: 'w-30',
            headerClassName: '!py-2.5 !px-0.5 text-[10px] font-bold text-gray-400 tracking-wide',
            cellClassName: '!py-0.5 !px-0.5',
            accessor: (row) => (
                <EntityDisplay
                    id={row.cuenta_id}
                    nombre={row.cuenta_nombre || row.cuenta_display || ''}
                    nameClassName="text-[12px] text-gray-500"
                />
            )
        },
        {
            key: 'tercero',
            header: <TableHeaderCell>Tercero</TableHeaderCell>,
            sortable: true,
            sortKey: 'tercero_nombre',
            width: 'w-45',
            headerClassName: '!py-2.5 !px-0.5 text-[10px] font-bold text-gray-400 tracking-wide',
            cellClassName: '!py-0.5 !px-0.5',
            accessor: (row) => (
                <EntityDisplay
                    id={row.tercero_id || ''}
                    nombre={row.tercero_nombre || ''}
                    nameClassName="text-[12px] text-gray-600"
                    className="max-w-[200px]"
                />
            )
        },
        {
            key: 'clasificacion',
            header: <TableHeaderCell>Clasificación</TableHeaderCell>,
            sortable: true,
            sortKey: 'centro_costo_nombre',
            width: 'w-30',
            headerClassName: '!py-2.5 !px-0.5 text-[10px] font-bold text-gray-400 tracking-wide',
            cellClassName: '!py-0.5 !px-0.5',
            accessor: (row) => (
                <ClassificationDisplay
                    centroCosto={row.centro_costo_id ? { id: row.centro_costo_id, nombre: row.centro_costo_nombre || '' } : null}
                    concepto={row.concepto_id ? { id: row.concepto_id, nombre: row.concepto_nombre || '' } : null}
                    detallesCount={row.detalles?.length}
                />
            )
        },
        monedaColumn<Movimiento>('valor', <TableHeaderCell>Pesos</TableHeaderCell>, row => row.valor_filtrado ?? row.valor, 'COP', {
            width: 'w-24',
        }),
        monedaColumn<Movimiento>('usd', <TableHeaderCell>USD</TableHeaderCell>, row => row.usd ?? 0, 'USD', {
            width: 'w-20',
            decimals: 2,
        }),
        monedaColumn<Movimiento>('trm', <TableHeaderCell>Trm</TableHeaderCell>, row => row.trm ?? 0, 'TRM', {
            width: 'w-16',
            decimals: 2,
        }),
        textoColumn<Movimiento>('moneda', <TableHeaderCell>Moneda</TableHeaderCell>, row => row.moneda_display, {
            sortKey: 'moneda_nombre',
            width: 'w-20',
        }),
    ], [onView])




    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm flex flex-col">
            <div className="p-3 border-b border-gray-100 bg-gray-50/80 flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-2">
                    <LayoutList className="text-gray-400" size={20} />
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Listado de Movimientos</h3>
                        <p className="text-xs text-gray-500">
                            Transacciones registradas en el sistema para los filtros seleccionados
                        </p>
                    </div>
                </div>
            </div>
            <DataTable
                containerRef={scrollContainerRef}
                onScroll={handleScroll}
                data={movimientos}
                columns={columns}
                getRowKey={(row) => row.id}
                loading={loading}
                showActions={false}
                rounded={false}
                className="border-none"
                emptyMessage="No se encontraron movimientos con los filtros actuales."
                rowPy="py-1"
                stickyHeader={true}
                maxHeight={600}
                defaultSortKey="fecha"
                defaultSortDirection="desc"
            />
            <div className="p-3 bg-gray-50/50 border-t border-gray-100 text-[10px] text-gray-400 text-center capitalize tracking-wide font-medium flex-shrink-0">
                Gestión de Movimientos • Sistema de Conciliación Bancaria • Mostrando {Math.min(visibleLimit, movimientos.length)} de {movimientos.length}
            </div>
        </div>
    );
}
