import { useState, useEffect } from 'react'
import { Percent } from 'lucide-react'
import { Modal } from '../../molecules/Modal'
import { Button } from '../../atoms/Button'
import { Input } from '../../atoms/Input'
import { presupuestoService } from '../../../services/presupuesto.service'
import type { CentroCosto } from '../../../types'
import toast from 'react-hot-toast'
import { centrosCostosService } from '../../../services/catalogs.service'

interface Props {
    isOpen: boolean
    presupuestoId: number
    onClose: () => void
    onSuccess: () => void
}

export const PresupuestoAjusteModal = ({ isOpen, presupuestoId, onClose, onSuccess }: Props) => {
    const [tab, setTab] = useState<'global' | 'centro_costo'>('global')
    const [porcentaje, setPorcentaje] = useState<string>('0')
    const [centroCostoId, setCentroCostoId] = useState<string>('')
    const [centrosCostos, setCentrosCostos] = useState<CentroCosto[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (isOpen) {
            centrosCostosService.listar().then(setCentrosCostos).catch(console.error)
            setPorcentaje('0')
            setCentroCostoId('')
        }
    }, [isOpen])

    const handleAplicar = async () => {
        const pct = parseFloat(porcentaje)
        if (isNaN(pct) || pct === 0) {
            toast.error('Ingrese un porcentaje válido distinto de 0')
            return
        }
        if (tab === 'centro_costo' && !centroCostoId) {
            toast.error('Seleccione un centro de costo')
            return
        }

        setLoading(true)
        try {
            if (tab === 'global') {
                const result = await presupuestoService.ajusteGlobal(presupuestoId, pct)
                toast.success(`Ajuste global aplicado a ${result.lineas_afectadas} líneas`)
            } else {
                const result = await presupuestoService.ajusteCentroCosto(presupuestoId, parseInt(centroCostoId), pct)
                toast.success(`Ajuste aplicado a ${result.lineas_afectadas} líneas`)
            }
            onSuccess()
        } catch (err: any) {
            toast.error(err.message || 'Error al aplicar ajuste')
        } finally {
            setLoading(false)
        }
    }

    const pctNum = parseFloat(porcentaje) || 0

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Ajuste de Presupuesto"
            size="md"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
                    <Button onClick={handleAplicar} icon={Percent} isLoading={loading}>
                        Aplicar Ajuste
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                {/* Tabs */}
                <div className="flex border-b border-gray-200">
                    <button
                        onClick={() => setTab('global')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'global'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Global
                    </button>
                    <button
                        onClick={() => setTab('centro_costo')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'centro_costo'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Por Centro de Costo
                    </button>
                </div>

                {tab === 'centro_costo' && (
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider ml-0.5">
                            Centro de Costo
                        </label>
                        <select
                            value={centroCostoId}
                            onChange={e => setCentroCostoId(e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="">Seleccione...</option>
                            {centrosCostos.map(cc => (
                                <option key={cc.id} value={cc.id}>{cc.nombre}</option>
                            ))}
                        </select>
                    </div>
                )}

                <Input
                    label="Porcentaje de ajuste (%)"
                    type="number"
                    value={porcentaje}
                    onChange={e => setPorcentaje(e.target.value)}
                    placeholder="Ej: 8 para +8%, -5 para -5%"
                    step="0.1"
                />

                {/* Preview */}
                <div className={`rounded-lg p-3 text-sm ${pctNum > 0
                    ? 'bg-amber-50 border border-amber-200 text-amber-700'
                    : pctNum < 0
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                        : 'bg-gray-50 border border-gray-200 text-gray-500'
                    }`}>
                    {pctNum > 0 ? (
                        <span>Los montos presupuestados se <strong>incrementarán</strong> en {pctNum}%</span>
                    ) : pctNum < 0 ? (
                        <span>Los montos presupuestados se <strong>reducirán</strong> en {Math.abs(pctNum)}%</span>
                    ) : (
                        <span>Ingrese un porcentaje para previsualizar el ajuste</span>
                    )}
                </div>
            </div>
        </Modal>
    )
}
