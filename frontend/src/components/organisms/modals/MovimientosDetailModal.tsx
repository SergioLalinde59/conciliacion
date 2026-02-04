import React from 'react';
import type { Movimiento } from '../../../types';
import { CurrencyDisplay } from '../../atoms/CurrencyDisplay';
import { EntityDisplay } from '../../molecules/entities/EntityDisplay';
import { ClassificationDisplay } from '../../molecules/entities/ClassificationDisplay';
import { Modal } from '../../molecules/Modal';
import { Calendar, Hash, Tag } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    movimiento: Movimiento | null;
}

/**
 * MovimientosDetailModal
 * 
 * Modal para visualizar el detalle completo de un movimiento en modo lectura.
 * Útil para drilldowns desde reportes estadísticos.
 */
export const MovimientosDetailModal: React.FC<Props> = ({
    isOpen,
    onClose,
    movimiento
}) => {
    if (!movimiento) return null;

    const isUsd = movimiento.cuenta_display?.toLowerCase().includes('usd') || (movimiento.usd && movimiento.usd !== 0);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Detalle del Movimiento"
            size="lg"
        >
            <div className="space-y-6">
                {/* Header con Valor Principal */}
                <div className="bg-blue-50 -mx-6 -mt-6 p-8 border-b border-blue-100 flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-2 text-blue-600 mb-1">
                            <Hash size={16} />
                            <span className="text-xs font-bold uppercase tracking-wider">ID #{movimiento.id}</span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 line-clamp-2 max-w-md">
                            {movimiento.descripcion}
                        </h3>
                    </div>
                    <div className="text-right">
                        <CurrencyDisplay
                            value={isUsd ? (movimiento.usd || 0) : movimiento.valor}
                            currency={isUsd ? 'USD' : 'COP'}
                            className="text-3xl font-black text-blue-700"
                        />
                        <p className="text-xs font-medium text-blue-500 uppercase tracking-widest mt-1">
                            {movimiento.cuenta_display}
                        </p>
                    </div>
                </div>

                {/* Grid de Información Básica */}
                <div className="grid grid-cols-2 gap-6">
                    <InfoItem
                        icon={<Calendar size={18} className="text-gray-400" />}
                        label="Fecha"
                        value={movimiento.fecha}
                    />
                    <InfoItem
                        icon={<Tag size={18} className="text-gray-400" />}
                        label="Referencia"
                        value={movimiento.referencia || 'Sin referencia'}
                    />
                    <div className="col-span-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">
                            Tercero / Identidad
                        </label>
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <EntityDisplay
                                id={movimiento.tercero_id || ''}
                                nombre={movimiento.tercero_nombre || 'No asignado'}
                                nameClassName="text-sm font-semibold"
                            />
                        </div>
                    </div>
                </div>

                {/* Clasificación */}
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">
                        Clasificación Contable
                    </label>
                    <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                        <ClassificationDisplay
                            centroCosto={movimiento.centro_costo_id ? { id: movimiento.centro_costo_id, nombre: movimiento.centro_costo_nombre || '' } : null}
                            concepto={movimiento.concepto_id ? { id: movimiento.concepto_id, nombre: movimiento.concepto_nombre || '' } : null}
                            detallesCount={movimiento.detalles?.length}
                        />
                    </div>
                </div>

                {/* Detalles si existen */}
                {movimiento.detalles && movimiento.detalles.length > 0 && (
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">
                            Desglose de Detalles ({movimiento.detalles.length})
                        </label>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                            {movimiento.detalles.map((det: any, index: number) => (
                                <div key={index} className="flex justify-between items-center p-2.5 bg-white border border-gray-100 rounded-lg text-sm shadow-sm">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-gray-700">{det.centro_costo_nombre}</span>
                                        <span className="text-xs text-gray-400">{det.concepto_nombre}</span>
                                    </div>
                                    <CurrencyDisplay value={det.valor} className="font-bold underline decoration-slate-200" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

const InfoItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
    <div className="flex items-start gap-3 p-3 bg-gray-50/50 rounded-xl border border-gray-100">
        <div className="shrink-0 mt-0.5">{icon}</div>
        <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">{label}</label>
            <span className="text-sm font-semibold text-gray-700">{value}</span>
        </div>
    </div>
);
