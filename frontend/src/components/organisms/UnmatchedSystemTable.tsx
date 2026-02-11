import { Edit2, Trash2, AlertCircle, Eye } from 'lucide-react'
import { Button } from '../atoms/Button'
import { DataTable } from '../molecules/DataTable'
import type { Column } from '../molecules/DataTable'
import { useMemo, useState } from 'react'
import { TableHeaderCell } from '../atoms/TableHeaderCell'
import { fechaColumn, textoColumn, monedaColumn } from '../atoms/columnHelpers'
import { Modal } from '../molecules/Modal'

interface UnmatchedSystemTableProps {
    records: any[]
    onEdit?: (mov: any) => void
    onDelete?: (id: number) => void
    permiteEditar?: boolean
    permiteBorrar?: boolean
}

export const UnmatchedSystemTable = ({
    records,
    onEdit,
    onDelete,
    permiteEditar = true,
    permiteBorrar = true
}: UnmatchedSystemTableProps) => {
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null)

    if (!records || records.length === 0) return null

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val)

    const { totalIngresos, totalEgresos, totalNeto } = useMemo(() => {
        const ingresos = records.reduce((sum, row) => sum + (Number(row.valor) > 0 ? Number(row.valor) : 0), 0)
        const egresos = records.reduce((sum, row) => sum + (Number(row.valor) < 0 ? Number(row.valor) : 0), 0)
        return { totalIngresos: ingresos, totalEgresos: egresos, totalNeto: ingresos + egresos }
    }, [records])

    const columns: Column<any>[] = useMemo(() => [
        {
            key: 'actions',
            header: <TableHeaderCell>Acciones</TableHeaderCell>,
            align: 'center',
            width: 'w-28',
            headerClassName: '!py-2.5 !px-0.5 text-[10px] font-bold text-gray-400 tracking-wide',
            cellClassName: '!py-0.5 !px-0.5',
            accessor: (row) => (
                <div className="flex justify-center gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedRecord(row)}
                        className="!p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                        title="Ver detalle"
                    >
                        <Eye size={15} />
                    </Button>
                    {onEdit && permiteEditar && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(row)}
                            className="!p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50"
                            title="Modificar"
                        >
                            <Edit2 size={15} />
                        </Button>
                    )}
                    {onDelete && permiteBorrar && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                if (confirm('¿Eliminar este movimiento? Solo hazlo si es un error.')) {
                                    onDelete(row.id)
                                }
                            }}
                            className="!p-1.5 text-gray-300 hover:text-rose-600 hover:bg-rose-50"
                            title="Eliminar (solo si es un error)"
                        >
                            <Trash2 size={15} />
                        </Button>
                    )}
                </div>
            )
        },
        fechaColumn<any>(
            'fecha',
            <TableHeaderCell>Fecha</TableHeaderCell>,
            row => row.fecha,
            { width: 'w-32' }
        ),
        textoColumn<any>(
            'tercero_nombre',
            <TableHeaderCell>Tercero</TableHeaderCell>,
            row => row.tercero_nombre || '',
            { width: 'w-auto' }
        ),
        textoColumn<any>(
            'descripcion',
            <TableHeaderCell>Descripción</TableHeaderCell>,
            row => row.descripcion,
            { width: 'w-auto' }
        ),
        textoColumn<any>(
            'referencia',
            <TableHeaderCell>Referencia</TableHeaderCell>,
            row => row.referencia || '-',
            { width: 'w-32' }
        ),
        monedaColumn<any>(
            'valor',
            <TableHeaderCell>Valor</TableHeaderCell>,
            row => row.valor,
            'COP',
            { width: 'w-40' }
        )
    ], [onEdit, onDelete, permiteEditar, permiteBorrar])

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="p-3 border-b border-gray-100 bg-blue-50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <AlertCircle className="text-blue-600" size={20} />
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Registros en Tránsito / Sin Match</h3>
                        <p className="text-xs text-blue-700">
                            Estos registros están en contabilidad pero no en el extracto (Partidas pendientes o Errores)
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-bold">
                        {records.length} registros
                    </span>
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
                        Ingresos: {formatCurrency(totalIngresos)}
                    </span>
                    <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold">
                        Egresos: {formatCurrency(totalEgresos)}
                    </span>
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">
                        Total: {formatCurrency(totalNeto)}
                    </span>
                </div>
            </div>

            <DataTable
                data={records}
                columns={columns}
                getRowKey={(row) => row.id}
                showActions={false}
                rounded={false}
                stickyHeader={true}
                className="border-none"
            />

            <div className="p-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 text-center">
                Si el registro es correcto (partida en tránsito), déjalo aquí. El sistema lo cruzará el próximo mes. Solo borra si es un error.
            </div>

            {/* Modal de detalle */}
            <Modal
                isOpen={!!selectedRecord}
                onClose={() => setSelectedRecord(null)}
                title="Detalle del Movimiento"
                size="md"
                footer={
                    <div className="flex justify-between w-full">
                        <div>
                            {onDelete && permiteBorrar && selectedRecord && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        if (confirm('¿Eliminar este movimiento? Solo hazlo si es un error.')) {
                                            onDelete(selectedRecord.id)
                                            setSelectedRecord(null)
                                        }
                                    }}
                                    className="text-gray-400 hover:text-rose-600 hover:bg-rose-50"
                                >
                                    <Trash2 size={15} />
                                    <span className="text-xs">Eliminar</span>
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            {onEdit && permiteEditar && selectedRecord && (
                                <Button
                                    variant="warning"
                                    size="sm"
                                    onClick={() => {
                                        onEdit(selectedRecord)
                                        setSelectedRecord(null)
                                    }}
                                >
                                    <Edit2 size={15} />
                                    Editar
                                </Button>
                            )}
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setSelectedRecord(null)}
                            >
                                Cerrar
                            </Button>
                        </div>
                    </div>
                }
            >
                {selectedRecord && (
                    <div className="space-y-4">
                        {/* Valor destacado */}
                        <div className="text-center py-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Valor</span>
                            <span className={`text-3xl font-black font-mono ${Number(selectedRecord.valor) > 0 ? 'text-emerald-700' : Number(selectedRecord.valor) < 0 ? 'text-red-700' : 'text-blue-700'}`}>
                                {formatCurrency(selectedRecord.valor)}
                            </span>
                        </div>

                        {/* Campos en grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <DetailField label="ID" value={selectedRecord.id} mono />
                            <DetailField label="Fecha" value={selectedRecord.fecha} />
                            <DetailField label="Tercero" value={selectedRecord.tercero_id ? `${selectedRecord.tercero_id} - ${selectedRecord.tercero_nombre || ''}` : selectedRecord.tercero_nombre || '-'} />
                            <DetailField label="Referencia" value={selectedRecord.referencia || '-'} mono />
                        </div>

                        {/* Descripción completa */}
                        <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Descripción</span>
                            <p className="text-sm text-gray-800 bg-slate-50 rounded-lg p-3 border border-slate-100">
                                {selectedRecord.descripcion || '-'}
                            </p>
                        </div>

                        {/* Nota informativa */}
                        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                            <AlertCircle size={14} className="text-blue-500 mt-0.5 shrink-0" />
                            <p className="text-xs text-blue-700">
                                Este registro está en contabilidad pero no tiene correspondencia en el extracto bancario.
                                Si es una partida en tránsito, se cruzará automáticamente el próximo mes.
                            </p>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}

const DetailField = ({ label, value, mono }: { label: string, value: string | number, mono?: boolean }) => (
    <div>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-0.5">{label}</span>
        <p className={`text-sm text-gray-800 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
)
