import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { Modal } from '../../molecules/Modal'
import { Button } from '../../atoms/Button'
import { Input } from '../../atoms/Input'
import { Checkbox } from '../../atoms/Checkbox'
import type { Cuenta, TipoCuenta } from '../../../types'

interface Props {
    isOpen: boolean
    cuenta: Cuenta | null
    tiposCuenta: TipoCuenta[]
    onClose: () => void
    onSave: (data: {
        nombre: string
        permite_carga: boolean
        permite_conciliar: boolean
        tipo_cuenta_id: number | null
    }) => void
}

export const CuentaModal = ({ isOpen, cuenta, tiposCuenta, onClose, onSave }: Props) => {
    const [nombre, setNombre] = useState('')
    const [permiteCarga, setPermiteCarga] = useState(false)
    const [permiteConciliar, setPermiteConciliar] = useState(false)
    const [tipoCuentaId, setTipoCuentaId] = useState<number | null>(null)

    useEffect(() => {
        if (isOpen) {
            setNombre(cuenta?.nombre ?? '')
            setPermiteCarga(cuenta?.permite_carga ?? false)
            setPermiteConciliar(cuenta?.permite_conciliar ?? false)
            setTipoCuentaId(cuenta?.tipo_cuenta_id ?? null)
        }
    }, [isOpen, cuenta])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!nombre.trim()) return
        onSave({
            nombre,
            permite_carga: permiteCarga,
            permite_conciliar: permiteConciliar,
            tipo_cuenta_id: tipoCuentaId
        })
    }

    const handleSave = () => {
        if (!nombre.trim()) return
        onSave({
            nombre,
            permite_carga: permiteCarga,
            permite_conciliar: permiteConciliar,
            tipo_cuenta_id: tipoCuentaId
        })
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={cuenta ? 'Editar Cuenta' : 'Nueva Cuenta'}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        icon={Save}
                        disabled={!nombre.trim()}
                    >
                        Guardar
                    </Button>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    label="Nombre de la Cuenta"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej: Davivienda Ahorros"
                    autoFocus
                />

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tipo de Cuenta
                    </label>
                    <select
                        value={tipoCuentaId ?? ''}
                        onChange={(e) => setTipoCuentaId(e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="">Sin asignar</option>
                        {tiposCuenta.map((tipo) => (
                            <option key={tipo.id} value={tipo.id}>
                                {tipo.nombre}
                            </option>
                        ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                        El tipo de cuenta determina los pesos para la clasificacion automatica
                    </p>
                </div>

                <Checkbox
                    label="Permitir carga de archivos (Movimientos)"
                    checked={permiteCarga}
                    onChange={(e) => setPermiteCarga(e.target.checked)}
                />

                <Checkbox
                    label="Permite Conciliar (Conciliacion Bancaria)"
                    checked={permiteConciliar}
                    onChange={(e) => setPermiteConciliar(e.target.checked)}
                />
            </form>
        </Modal>
    )
}
