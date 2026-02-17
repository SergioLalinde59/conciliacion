import { useState, useEffect } from 'react'
import type { Presupuesto } from '../../../types/Presupuesto'
import { Modal } from '../../molecules/Modal'
import { Button } from '../../atoms/Button'
import { Input } from '../../atoms/Input'

interface Props {
    isOpen: boolean
    onClose: () => void
    item: Presupuesto | null
    onSave: (data: { semaforo_verde_hasta: number; semaforo_amarillo_hasta: number; umbral_minimo_mensual: number; umbral_minimo_anual: number; cifras_en_millones: boolean }) => void
}

const formatMiles = (n: number): string =>
    n === 0 ? '' : n.toLocaleString('es-CO', { maximumFractionDigits: 0 })

const parseMiles = (s: string): number => {
    const num = parseInt(s.replace(/\D/g, ''), 10)
    return isNaN(num) ? 0 : num
}

export const PresupuestoSemaforoModal = ({ isOpen, onClose, item, onSave }: Props) => {
    const [verdeHasta, setVerdeHasta] = useState(5)
    const [amarilloHasta, setAmarilloHasta] = useState(15)
    const [umbralMensual, setUmbralMensual] = useState(0)
    const [umbralAnual, setUmbralAnual] = useState(0)
    const [cifrasEnMillones, setCifrasEnMillones] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (isOpen && item) {
            setVerdeHasta(item.semaforo_verde_hasta)
            setAmarilloHasta(item.semaforo_amarillo_hasta)
            setUmbralMensual(item.umbral_minimo_mensual)
            setUmbralAnual(item.umbral_minimo_anual)
            setCifrasEnMillones(item.cifras_en_millones ?? false)
            setError('')
        }
    }, [isOpen, item])

    const handleSubmit = () => {
        if (verdeHasta <= 0 || amarilloHasta <= 0) {
            setError('Los valores deben ser mayores a 0')
            return
        }
        if (verdeHasta >= amarilloHasta) {
            setError('El umbral verde debe ser menor que el amarillo')
            return
        }
        if (umbralMensual < 0 || umbralAnual < 0) {
            setError('Los umbrales de materialidad no pueden ser negativos')
            return
        }
        onSave({ semaforo_verde_hasta: verdeHasta, semaforo_amarillo_hasta: amarilloHasta, umbral_minimo_mensual: umbralMensual, umbral_minimo_anual: umbralAnual, cifras_en_millones: cifrasEnMillones })
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Editar Semáforos — ${item?.nombre ?? ''}`}
            size="md"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSubmit}>Guardar</Button>
                </>
            }
        >
            <div className="space-y-5">
                <p className="text-sm text-gray-500">
                    Configure los umbrales de variación porcentual para el semáforo presupuestal.
                </p>

                {/* Preview visual */}
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg text-sm">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                        Verde ≤ {verdeHasta}%
                    </span>
                    <span className="text-gray-400">→</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                        Amarillo ≤ {amarilloHasta}%
                    </span>
                    <span className="text-gray-400">→</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-medium">
                        Rojo &gt; {amarilloHasta}%
                    </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="Verde hasta (%)"
                        type="number"
                        value={verdeHasta}
                        onChange={e => setVerdeHasta(parseFloat(e.target.value) || 0)}
                        min={0.1}
                        max={99}
                        step={0.5}
                    />
                    <Input
                        label="Amarillo hasta (%)"
                        type="number"
                        value={amarilloHasta}
                        onChange={e => setAmarilloHasta(parseFloat(e.target.value) || 0)}
                        min={0.1}
                        max={99}
                        step={0.5}
                    />
                </div>

                <div className="border-t border-gray-200 pt-4 mt-2">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Umbral de Materialidad</label>
                    <p className="text-xs text-gray-400 mt-0.5 mb-3">Gastos por debajo de estos montos se pueden ocultar en reportes. 0 = sin filtro.</p>
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Mínimo mensual ($)"
                            type="text"
                            inputMode="numeric"
                            value={formatMiles(umbralMensual)}
                            onChange={e => setUmbralMensual(parseMiles(e.target.value))}
                            placeholder="0"
                        />
                        <Input
                            label="Mínimo anual ($)"
                            type="text"
                            inputMode="numeric"
                            value={formatMiles(umbralAnual)}
                            onChange={e => setUmbralAnual(parseMiles(e.target.value))}
                            placeholder="0"
                        />
                    </div>
                </div>

                <div className="border-t border-gray-200 pt-4 mt-2">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Visualización</label>
                    <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={cifrasEnMillones}
                            onChange={e => setCifrasEnMillones(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Mostrar cifras en millones</span>
                        <span className="text-xs text-gray-400">(ej: $1.5M, $150K)</span>
                    </label>
                </div>

                {error && (
                    <p className="text-sm text-rose-500 font-medium">{error}</p>
                )}
            </div>
        </Modal>
    )
}
