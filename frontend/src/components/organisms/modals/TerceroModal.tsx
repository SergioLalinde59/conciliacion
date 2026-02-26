import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { Modal } from '../../molecules/Modal'
import { Button } from '../../atoms/Button'
import { Input } from '../../atoms/Input'
import type { Tercero } from '../../../types'

interface Props {
    isOpen: boolean
    tercero: Tercero | null
    initialValues?: { nombre?: string; alias?: string; referencia?: string }
    onClose: () => void
    onSave: (nombre: string, alias?: string, referencia?: string) => void
}

/**
 * Modal para crear/editar terceros
 * Al crear, permite definir el primer alias (descripción del extracto)
 */
export const TerceroModal = ({ isOpen, tercero, initialValues, onClose, onSave }: Props) => {
    const [nombre, setNombre] = useState('')
    const [alias, setAlias] = useState('')
    const [referencia, setReferencia] = useState('')

    useEffect(() => {
        if (isOpen) {
            if (tercero) {
                setNombre(tercero.nombre)
                setAlias('')
                setReferencia('')
            } else {
                setNombre(initialValues?.nombre || '')
                setAlias(initialValues?.alias || '')
                setReferencia(initialValues?.referencia || '')
            }
        }
    }, [isOpen, tercero, initialValues])

    const handleSubmit = () => {
        if (nombre.trim()) {
            onSave(nombre, alias.trim() || undefined, referencia.trim() || undefined)
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={tercero ? 'Editar Tercero' : 'Nuevo Tercero'}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        icon={Save}
                        disabled={!nombre.trim()}
                    >
                        Guardar
                    </Button>
                </>
            }
        >
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit() }} className="space-y-4">
                <Input
                    label="Nombre del Tercero"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    autoFocus
                    placeholder="Nombre real del tercero..."
                />
                {!tercero && (
                    <>
                        <Input
                            label="Alias (Descripción del Extracto)"
                            value={alias}
                            onChange={(e) => setAlias(e.target.value)}
                            placeholder="Descripción como aparece en el extracto..."
                        />
                        <Input
                            label="Referencia"
                            value={referencia}
                            onChange={(e) => setReferencia(e.target.value)}
                            placeholder="Referencia del extracto..."
                        />
                    </>
                )}
            </form>
        </Modal>
    )
}
