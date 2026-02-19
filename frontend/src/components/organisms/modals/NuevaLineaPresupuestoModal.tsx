import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Save, X } from 'lucide-react'
import { Button } from '../../atoms/Button'
import { presupuestoService } from '../../../services/presupuesto.service'
import { centrosCostosService, conceptosService } from '../../../services/catalogs.service'
import type { CentroCosto, Concepto } from '../../../types'

const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

interface Props {
    isOpen: boolean
    presupuestoId: number
    onClose: () => void
    onSuccess: () => void
}

export const NuevaLineaPresupuestoModal = ({ isOpen, presupuestoId, onClose, onSuccess }: Props) => {
    const [centrosCostos, setCentrosCostos] = useState<CentroCosto[]>([])
    const [conceptos, setConceptos] = useState<Concepto[]>([])
    const [ccId, setCcId] = useState('')
    const [conceptoId, setConceptoId] = useState('')
    const [mes, setMes] = useState('1')
    const [monto, setMonto] = useState('')
    const [tipo, setTipo] = useState('variable')

    useEffect(() => {
        if (!isOpen) return
        setCcId(''); setConceptoId(''); setMes('1'); setMonto(''); setTipo('variable')
        Promise.all([centrosCostosService.listar(), conceptosService.listar()])
            .then(([ccs, cons]) => { setCentrosCostos(ccs); setConceptos(cons) })
            .catch(() => toast.error('Error cargando catálogos'))
    }, [isOpen])

    const handleSave = async () => {
        if (!ccId || !monto) { toast.error('Centro de Costo y Monto son requeridos'); return }
        try {
            await presupuestoService.crearDetalle(presupuestoId, {
                centro_costo_id: parseInt(ccId),
                concepto_id: conceptoId ? parseInt(conceptoId) : undefined,
                mes: parseInt(mes),
                monto_presupuestado: parseFloat(monto),
                tipo,
            })
            toast.success('Línea agregada')
            onSuccess()
        } catch (err: any) {
            toast.error(err.message || 'Error al agregar línea')
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">Nueva Línea de Presupuesto</h3>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-full"><X size={20} /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider ml-0.5">Centro de Costo *</label>
                        <select value={ccId} onChange={e => setCcId(e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                            <option value="">Seleccione...</option>
                            {centrosCostos.map(cc => <option key={cc.id} value={cc.id}>{cc.id} - {cc.nombre}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider ml-0.5">Concepto</label>
                        <select value={conceptoId} onChange={e => setConceptoId(e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                            <option value="">Sin concepto</option>
                            {conceptos.map(c => <option key={c.id} value={c.id}>{c.id} - {c.nombre}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider ml-0.5">Mes *</label>
                            <select value={mes} onChange={e => setMes(e.target.value)}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                    <option key={m} value={m}>{MESES[m]}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider ml-0.5">Tipo</label>
                            <select value={tipo} onChange={e => setTipo(e.target.value)}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                                <option value="variable">Variable</option>
                                <option value="fijo">Fijo</option>
                                <option value="estacional">Estacional</option>
                            </select>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider ml-0.5">Monto Presupuestado *</label>
                        <input type="number" value={monto} onChange={e => setMonto(e.target.value)}
                            placeholder="0.00" step="0.01"
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                    </div>
                </div>
                <div className="flex justify-end gap-3 p-4 border-t border-gray-100 bg-gray-50">
                    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSave} icon={Save} disabled={!ccId || !monto}>Guardar</Button>
                </div>
            </div>
        </div>
    )
}
