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
        numero_cuenta: string | null
        tipo_cuenta_id: number | null
    }) => void
}

export const CuentaModal = ({ isOpen, cuenta, tiposCuenta, onClose, onSave }: Props) => {
    const [nombre, setNombre] = useState('')
    const [numeroCuenta, setNumeroCuenta] = useState('')
    const [permiteCarga, setPermiteCarga] = useState(false)
    const [permiteConciliar, setPermiteConciliar] = useState(false)
    const [tipoCuentaId, setTipoCuentaId] = useState<number | null>(null)

    const numeroCuentaValido = numeroCuenta === '' || /^\d{9,16}$/.test(numeroCuenta)

    useEffect(() => {
        if (isOpen) {
            setNombre(cuenta?.nombre ?? '')
            setNumeroCuenta(cuenta?.numero_cuenta ?? '')
            setPermiteCarga(cuenta?.permite_carga ?? false)
            setPermiteConciliar(cuenta?.permite_conciliar ?? false)
            setTipoCuentaId(cuenta?.tipo_cuenta_id ?? null)
        }
    }, [isOpen, cuenta])

    const canSave = nombre.trim() !== '' && numeroCuentaValido

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!canSave) return
        onSave({
            nombre,
            permite_carga: permiteCarga,
            permite_conciliar: permiteConciliar,
            numero_cuenta: numeroCuenta || null,
            tipo_cuenta_id: tipoCuentaId
        })
    }

    const handleSave = () => {
        if (!canSave) return
        onSave({
            nombre,
            permite_carga: permiteCarga,
            permite_conciliar: permiteConciliar,
            numero_cuenta: numeroCuenta || null,
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
                        disabled={!canSave}
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
                        Numero de Cuenta
                    </label>
                    <input
                        type="text"
                        inputMode="numeric"
                        value={numeroCuenta}
                        onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '')
                            if (val.length <= 16) setNumeroCuenta(val)
                        }}
                        placeholder="Ej: 0012345678"
                        maxLength={16}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                            !numeroCuentaValido ? 'border-red-400' : 'border-gray-300'
                        }`}
                    />
                    {numeroCuenta && !numeroCuentaValido && (
                        <p className="text-xs text-red-500 mt-1">
                            Debe contener entre 9 y 16 digitos
                        </p>
                    )}
                </div>

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
