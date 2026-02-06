import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { Modal } from '../../molecules/Modal'
import { Button } from '../../atoms/Button'
import { Input } from '../../atoms/Input'
import type { TipoCuenta } from '../../../types'

interface Props {
    isOpen: boolean
    tipoCuenta: TipoCuenta | null
    onClose: () => void
    onSave: (data: Omit<TipoCuenta, 'id' | 'activo'>) => void
}

const Checkbox = ({ label, checked, onChange, description }: {
    label: string
    checked: boolean
    onChange: (checked: boolean) => void
    description?: string
}) => (
    <label className="flex items-start gap-3 cursor-pointer group">
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <div>
            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{label}</span>
            {description && <p className="text-xs text-gray-500">{description}</p>}
        </div>
    </label>
)

export const TipoCuentaModal = ({ isOpen, tipoCuenta, onClose, onSave }: Props) => {
    // Campos basicos
    const [nombre, setNombre] = useState('')
    const [descripcion, setDescripcion] = useState('')

    // Pesos de clasificacion
    const [pesoReferencia, setPesoReferencia] = useState(100)
    const [pesoDescripcion, setPesoDescripcion] = useState(50)
    const [pesoValor, setPesoValor] = useState(30)
    const [longitudMinReferencia, setLongitudMinReferencia] = useState(8)

    // Permisos
    const [permiteCrearManual, setPermiteCrearManual] = useState(false)
    const [permiteEditar, setPermiteEditar] = useState(false)
    const [permiteModificar, setPermiteModificar] = useState(false)
    const [permiteBorrar, setPermiteBorrar] = useState(false)
    const [permiteClasificar, setPermiteClasificar] = useState(true)

    // Validaciones
    const [requiereDescripcion, setRequiereDescripcion] = useState(false)
    const [valorMinimo, setValorMinimo] = useState<number | null>(null)

    // UX
    const [respondeEnter, setRespondeEnter] = useState(false)

    // Clasificacion avanzada
    const [referenciaDefineTercero, setReferenciaDefineTercero] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setNombre(tipoCuenta?.nombre ?? '')
            setDescripcion(tipoCuenta?.descripcion ?? '')
            setPesoReferencia(tipoCuenta?.peso_referencia ?? 100)
            setPesoDescripcion(tipoCuenta?.peso_descripcion ?? 50)
            setPesoValor(tipoCuenta?.peso_valor ?? 30)
            setLongitudMinReferencia(tipoCuenta?.longitud_min_referencia ?? 8)
            setPermiteCrearManual(tipoCuenta?.permite_crear_manual ?? false)
            setPermiteEditar(tipoCuenta?.permite_editar ?? false)
            setPermiteModificar(tipoCuenta?.permite_modificar ?? false)
            setPermiteBorrar(tipoCuenta?.permite_borrar ?? false)
            setPermiteClasificar(tipoCuenta?.permite_clasificar ?? true)
            setRequiereDescripcion(tipoCuenta?.requiere_descripcion ?? false)
            setValorMinimo(tipoCuenta?.valor_minimo ?? null)
            setRespondeEnter(tipoCuenta?.responde_enter ?? false)
            setReferenciaDefineTercero(tipoCuenta?.referencia_define_tercero ?? false)
        }
    }, [isOpen, tipoCuenta])

    const handleSubmit = () => {
        if (!nombre.trim()) return
        onSave({
            nombre: nombre.trim(),
            descripcion: descripcion.trim() || undefined,
            peso_referencia: pesoReferencia,
            peso_descripcion: pesoDescripcion,
            peso_valor: pesoValor,
            longitud_min_referencia: longitudMinReferencia,
            permite_crear_manual: permiteCrearManual,
            permite_editar: permiteEditar,
            permite_modificar: permiteModificar,
            permite_borrar: permiteBorrar,
            permite_clasificar: permiteClasificar,
            requiere_descripcion: requiereDescripcion,
            valor_minimo: valorMinimo,
            responde_enter: respondeEnter,
            referencia_define_tercero: referenciaDefineTercero
        })
    }

    const isValid = nombre.trim()
    const sumaPesos = pesoReferencia + pesoDescripcion + pesoValor

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={tipoCuenta ? 'Editar Tipo de Cuenta' : 'Nuevo Tipo de Cuenta'}
            size="lg"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        icon={Save}
                        disabled={!isValid}
                    >
                        Guardar
                    </Button>
                </>
            }
        >
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit() }} className="space-y-5">
                {/* Datos basicos */}
                <div className="space-y-4">
                    <Input
                        label="Nombre"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        placeholder="Cuenta Bancaria"
                        autoFocus
                    />
                    <Input
                        label="Descripcion (opcional)"
                        value={descripcion}
                        onChange={(e) => setDescripcion(e.target.value)}
                        placeholder="Descripcion del tipo de cuenta..."
                    />
                </div>

                {/* Referencia */}
                <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Referencia</h4>
                    <div className="grid grid-cols-2 gap-4 items-start">
                        <Checkbox
                            label="Define Tercero"
                            checked={referenciaDefineTercero}
                            onChange={setReferenciaDefineTercero}
                            description="Si coincide, el tercero está garantizado"
                        />
                        <div>
                            <Input
                                label="Longitud Min"
                                type="number"
                                value={longitudMinReferencia}
                                onChange={(e) => setLongitudMinReferencia(Math.max(0, parseInt(e.target.value) || 0))}
                                min={0}
                                max={50}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Caracteres mínimos para validar referencia.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Permisos */}
                <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Permisos de Operacion</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <Checkbox
                            label="Crear manual"
                            checked={permiteCrearManual}
                            onChange={setPermiteCrearManual}
                            description="Crear movimientos desde la UI"
                        />
                        <Checkbox
                            label="Editar"
                            checked={permiteEditar}
                            onChange={setPermiteEditar}
                            description="Abrir modal de edicion"
                        />
                        <Checkbox
                            label="Modificar valores"
                            checked={permiteModificar}
                            onChange={setPermiteModificar}
                            description="Cambiar fecha, valor, descripcion"
                        />
                        <Checkbox
                            label="Borrar"
                            checked={permiteBorrar}
                            onChange={setPermiteBorrar}
                            description="Eliminar movimientos"
                        />
                        <Checkbox
                            label="Clasificar"
                            checked={permiteClasificar}
                            onChange={setPermiteClasificar}
                            description="Asignar tercero, CC, concepto"
                        />
                    </div>
                </div>

                {/* Validaciones y UX */}
                <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Validaciones y UX</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <Checkbox
                            label="Requiere descripcion"
                            checked={requiereDescripcion}
                            onChange={setRequiereDescripcion}
                            description="Descripcion obligatoria al crear"
                        />
                        <Checkbox
                            label="Enter guarda"
                            checked={respondeEnter}
                            onChange={setRespondeEnter}
                            description="Enter abre confirmacion si todo OK"
                        />
                    </div>
                    <div className="mt-3">
                        <Input
                            label="Valor minimo (opcional)"
                            type="number"
                            value={valorMinimo ?? ''}
                            onChange={(e) => setValorMinimo(e.target.value ? parseFloat(e.target.value) : null)}
                            placeholder="Sin minimo"
                            step="0.01"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Si se especifica, el valor debe ser mayor o igual a este monto.
                        </p>
                    </div>
                </div>

                {/* Pesos de clasificacion */}
                <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">
                        Pesos para Clasificacion Automatica
                    </h4>
                    <p className="text-xs text-gray-500 mb-4">
                        Determinan la importancia de cada campo al buscar movimientos similares.
                    </p>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Input
                                label="Peso Referencia"
                                type="number"
                                value={pesoReferencia}
                                onChange={(e) => setPesoReferencia(Math.max(0, parseInt(e.target.value) || 0))}
                                min={0}
                                max={100}
                            />
                            <p className="text-xs text-blue-600 mt-1">
                                {sumaPesos > 0 ? ((pesoReferencia / sumaPesos) * 100).toFixed(0) : 0}%
                            </p>
                        </div>
                        <div>
                            <Input
                                label="Peso Descripcion"
                                type="number"
                                value={pesoDescripcion}
                                onChange={(e) => setPesoDescripcion(Math.max(0, parseInt(e.target.value) || 0))}
                                min={0}
                                max={100}
                            />
                            <p className="text-xs text-green-600 mt-1">
                                {sumaPesos > 0 ? ((pesoDescripcion / sumaPesos) * 100).toFixed(0) : 0}%
                            </p>
                        </div>
                        <div>
                            <Input
                                label="Peso Valor"
                                type="number"
                                value={pesoValor}
                                onChange={(e) => setPesoValor(Math.max(0, parseInt(e.target.value) || 0))}
                                min={0}
                                max={100}
                            />
                            <p className="text-xs text-purple-600 mt-1">
                                {sumaPesos > 0 ? ((pesoValor / sumaPesos) * 100).toFixed(0) : 0}%
                            </p>
                        </div>
                    </div>
                </div>
            </form>
        </Modal>
    )
}
