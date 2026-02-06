import { useState, useEffect, useCallback } from 'react'
import { X, Save, AlertCircle, Trash2, Plus, Check } from 'lucide-react'
import { Input } from '../../atoms/Input'
import { Button } from '../../atoms/Button'
import { CurrencyInput } from '../../molecules/CurrencyInput'
import { CurrencyDisplay } from '../../atoms/CurrencyDisplay'
import { EntitySelector } from '../../molecules/entities/EntitySelector'
import { SelectorCuenta } from '../../molecules/SelectorCuenta'
import { catalogosService } from '../../../services/catalogs.service'
import { apiService } from '../../../services/api'
import type { MovimientoDetalle, Cuenta, ConfiguracionTipoCuenta } from '../../../types'

interface MovimientoModalProps {
    isOpen: boolean
    onClose: () => void
    movimiento?: any
    onSave: (data: any) => Promise<void>
    mode?: 'create' | 'edit' | 'delete'
}

interface FormData {
    fecha: string
    descripcion: string
    referencia: string
    detalle: string  // Nota adicional
    valor: string
    usd: string
    trm: string
    moneda_id: string
    cuenta_id: string
    tercero_id: string
}

// Configuración por defecto (sin permisos)
const defaultConfig: ConfiguracionTipoCuenta = {
    tipo_cuenta_id: null,
    tipo_cuenta_nombre: null,
    permite_crear_manual: false,
    permite_editar: false,
    permite_modificar: false,
    permite_borrar: false,
    permite_clasificar: true,
    requiere_descripcion: false,
    valor_minimo: null,
    responde_enter: false
}

export const MovimientoModal = ({ isOpen, onClose, movimiento, onSave, mode = 'create' }: MovimientoModalProps) => {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showConfirmation, setShowConfirmation] = useState(false)

    // Catalogos
    const [cuentas, setCuentas] = useState<Cuenta[]>([])
    const [terceros, setTerceros] = useState<any[]>([])
    const [centrosCostos, setCentrosCostos] = useState<any[]>([])
    const [conceptos, setConceptos] = useState<any[]>([])

    // Configuración del tipo de cuenta seleccionado
    const [config, setConfig] = useState<ConfiguracionTipoCuenta>(defaultConfig)

    // Form State
    const [formData, setFormData] = useState<FormData>({
        fecha: '',
        descripcion: '',
        referencia: '',
        detalle: '',
        valor: '',
        usd: '',
        trm: '',
        moneda_id: '1',
        cuenta_id: '',
        tercero_id: ''
    })

    // Details (always active)
    const [detalles, setDetalles] = useState<MovimientoDetalle[]>([])

    const isReadOnly = mode === 'delete'
    const title = mode === 'delete' ? 'Borrar Movimiento' : (movimiento ? 'Editar Movimiento' : 'Nuevo Movimiento')
    const submitLabel = mode === 'delete' ? 'Confirmar Borrado' : 'Guardar Movimiento'
    const submitIcon = mode === 'delete' ? Trash2 : Save

    // Detectar si la cuenta es en dólares
    const esUSD = config.tipo_cuenta_nombre?.includes('USD') || config.tipo_cuenta_nombre?.includes('Dolares') || false

    // Cargar cuentas y maestros al abrir
    useEffect(() => {
        if (isOpen) {
            cargarDatos()
        }
    }, [isOpen])

    // Inicializar formulario
    useEffect(() => {
        if (isOpen) {
            if (movimiento) {
                setFormData({
                    fecha: movimiento.fecha ? movimiento.fecha.split('T')[0] : '',
                    descripcion: movimiento.descripcion || '',
                    referencia: movimiento.referencia || '',
                    detalle: movimiento.detalle || '',
                    valor: movimiento.valor?.toString() || '',
                    usd: movimiento.usd?.toString() || '',
                    trm: movimiento.trm?.toString() || '',
                    moneda_id: movimiento.moneda_id?.toString() || '1',
                    cuenta_id: movimiento.cuenta_id?.toString() || '',
                    tercero_id: movimiento.tercero_id?.toString() || ''
                })

                // Valores del encabezado para usar en detalles
                const valorTotal = movimiento.valor || 0
                const encabezadoTercero = movimiento.tercero_id || null
                const encabezadoCC = movimiento.centro_costo_id || null
                const encabezadoConcepto = movimiento.concepto_id || null

                if (movimiento.detalles && movimiento.detalles.length > 0) {
                    // Completar detalles existentes con valores del encabezado si están vacíos
                    const detallesActualizados = movimiento.detalles.map((det: MovimientoDetalle, idx: number) => {
                        if (idx === 0) {
                            return {
                                ...det,
                                tercero_id: det.tercero_id || encabezadoTercero,
                                centro_costo_id: det.centro_costo_id || encabezadoCC,
                                concepto_id: det.concepto_id || encabezadoConcepto,
                                valor: det.valor || valorTotal
                            }
                        }
                        return det
                    })
                    setDetalles(detallesActualizados)
                } else {
                    // Crear un solo detalle usando valores del encabezado
                    // El usuario agregará más filas si necesita dividir
                    setDetalles([
                        {
                            valor: valorTotal,
                            tercero_id: encabezadoTercero,
                            centro_costo_id: encabezadoCC,
                            concepto_id: encabezadoConcepto
                        }
                    ])
                }
            } else {
                const today = new Date().toISOString().split('T')[0]
                setFormData({
                    fecha: today,
                    descripcion: '',
                    referencia: '',
                    detalle: '',
                    valor: '',
                    usd: '',
                    trm: '',
                    moneda_id: '1',
                    cuenta_id: '',
                    tercero_id: ''
                })
                setDetalles([
                    { valor: 0, tercero_id: null, centro_costo_id: null, concepto_id: null }
                ])
            }
        }
    }, [isOpen, movimiento])

    // Actualizar configuración cuando cambia la cuenta
    useEffect(() => {
        if (formData.cuenta_id && cuentas.length > 0) {
            const cuenta = cuentas.find(c => c.id.toString() === formData.cuenta_id)
            if (cuenta?.configuracion) {
                setConfig(cuenta.configuracion)
            } else {
                setConfig(defaultConfig)
            }
        } else {
            setConfig(defaultConfig)
        }
    }, [formData.cuenta_id, cuentas])

    const cargarDatos = async () => {
        try {
            const [catalogosData, cuentasData] = await Promise.all([
                catalogosService.obtenerTodos(),
                apiService.cuentas.listar()
            ])
            setTerceros(catalogosData.terceros || [])
            setCentrosCostos(catalogosData.centros_costos || [])
            setConceptos(catalogosData.conceptos || [])
            setCuentas(cuentasData || [])
        } catch (err) {
            console.error("Error cargando datos:", err)
            setError("Error cargando listas desplegables")
        }
    }

    // Sync first row's tercero_id with header
    useEffect(() => {
        if (detalles.length > 0 && formData.tercero_id) {
            const terceroIdNum = formData.tercero_id ? parseInt(formData.tercero_id) : null
            if (detalles[0].tercero_id !== terceroIdNum) {
                setDetalles(prev => {
                    const newDetalles = [...prev]
                    newDetalles[0] = { ...newDetalles[0], tercero_id: terceroIdNum }
                    return newDetalles
                })
            }
        }
    }, [formData.tercero_id])

    const handleCurrencyChange = (val: number | null, field: 'valor' | 'usd' | 'trm') => {
        if (isReadOnly) return
        // Para cuentas USD, siempre permitir modificar USD y TRM
        // Para otras cuentas, respetar el permiso permite_modificar
        if (!esUSD && field !== 'valor' && !config.permite_modificar && movimiento) return

        const newFormData = { ...formData }
        newFormData[field] = val === null ? '' : val.toString()

        let nuevoValorTotal: number | null = null

        if (field === 'usd' || field === 'trm') {
            const usd = field === 'usd' ? val : (formData.usd ? parseFloat(formData.usd) : 0)
            const trm = field === 'trm' ? val : (formData.trm ? parseFloat(formData.trm) : 0)
            if (usd && trm && usd !== 0 && trm !== 0) {
                nuevoValorTotal = usd * trm
                newFormData.valor = nuevoValorTotal.toString()
            }
        } else if (field === 'valor') {
            nuevoValorTotal = val
        }

        setFormData(newFormData)

        // Si hay un solo detalle, sincronizar su valor con el total
        if (nuevoValorTotal !== null && detalles.length === 1) {
            setDetalles(prev => [{
                ...prev[0],
                valor: nuevoValorTotal
            }])
        }
    }

    const handleAddDetail = () => {
        // Calcular la diferencia entre el total y lo ya asignado
        const totalMovimiento = parseFloat(formData.valor || '0')
        const totalAsignado = detalles.reduce((sum, d) => sum + (d.valor || 0), 0)
        const diferencia = totalMovimiento - totalAsignado

        setDetalles(prev => [
            ...prev,
            { valor: diferencia, tercero_id: null, centro_costo_id: null, concepto_id: null }
        ])
    }

    const handleRemoveDetail = (index: number) => {
        setDetalles(prev => prev.filter((_, i) => i !== index))
    }

    const handleDetailChange = (index: number, field: keyof MovimientoDetalle, value: any) => {
        setDetalles(prev => {
            const newDetalles = [...prev]
            newDetalles[index] = { ...newDetalles[index], [field]: value }

            if (field === 'centro_costo_id') {
                newDetalles[index].concepto_id = null
            }

            if (index === 0 && field === 'valor' && newDetalles.length === 2) {
                const totalMovimiento = parseFloat(formData.valor || '0')
                const row1Valor = typeof value === 'number' ? value : parseFloat(value || '0')
                newDetalles[1].valor = totalMovimiento - row1Valor
            }

            return newDetalles
        })
    }

    // Validation
    const totalMovimiento = formData.valor ? parseFloat(formData.valor) : 0
    const totalDetalles = detalles.reduce((sum, d) => sum + (d.valor || 0), 0)
    const isBalanced = Math.abs(totalMovimiento - totalDetalles) < 0.01

    // Validaciones según configuración del tipo
    const validationErrors: string[] = []

    if (config.requiere_descripcion && !formData.descripcion.trim()) {
        validationErrors.push('Descripción es obligatoria')
    }
    if (config.valor_minimo && totalMovimiento < config.valor_minimo) {
        validationErrors.push(`Valor mínimo: $${config.valor_minimo.toLocaleString()}`)
    }

    // Validación de valor: para cuentas USD se valida el campo USD, para otras el valor COP
    if (esUSD) {
        const usdValue = formData.usd ? parseFloat(formData.usd) : 0
        const trmValue = formData.trm ? parseFloat(formData.trm) : 0
        if (usdValue === 0) {
            validationErrors.push('Valor USD debe ser diferente de cero')
        }
        if (trmValue === 0) {
            validationErrors.push('TRM debe ser diferente de cero')
        }
    } else if (totalMovimiento === 0) {
        validationErrors.push('Valor debe ser diferente de cero')
    }
    if (!formData.cuenta_id) {
        validationErrors.push('Cuenta es obligatoria')
    }
    if (!formData.fecha) {
        validationErrors.push('Fecha es obligatoria')
    }

    // Validación de clasificación (regla universal)
    const clasificacionCompleta = detalles.every(d =>
        d.tercero_id && d.centro_costo_id && d.concepto_id
    )
    if (!clasificacionCompleta && detalles.some(d => d.valor !== 0)) {
        validationErrors.push('Clasificación incompleta: Tercero, Centro de Costo y Concepto son obligatorios')
    }

    if (!isBalanced) {
        validationErrors.push('Los detalles no suman el total del movimiento')
    }

    const isValid = validationErrors.length === 0

    // Manejo de Enter
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && config.responde_enter && !e.shiftKey) {
            e.preventDefault()
            if (isValid && !loading) {
                setShowConfirmation(true)
            }
        }
    }, [config.responde_enter, isValid, loading])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!isValid && mode !== 'delete') {
            setError(validationErrors.join('. '))
            return
        }

        // Si responde_enter, mostrar confirmación primero
        if (config.responde_enter && !showConfirmation && mode !== 'delete') {
            setShowConfirmation(true)
            return
        }

        await executeSubmit()
    }

    const executeSubmit = async () => {
        setLoading(true)
        setError(null)

        try {
            if (mode === 'delete') {
                await onSave(movimiento)
            } else {
                const payload = {
                    fecha: formData.fecha,
                    descripcion: formData.descripcion,
                    referencia: formData.referencia || null,
                    detalle: formData.detalle || null,
                    valor: totalMovimiento,
                    usd: formData.usd ? parseFloat(formData.usd) : null,
                    trm: formData.trm ? parseFloat(formData.trm) : null,
                    moneda_id: parseInt(formData.moneda_id),
                    cuenta_id: parseInt(formData.cuenta_id),
                    tercero_id: formData.tercero_id ? parseInt(formData.tercero_id) : null,
                    detalles: detalles
                }
                await onSave(payload)
            }
            setShowConfirmation(false)
            onClose()
        } catch (err: any) {
            console.error(err)
            setError(err.message || "Error al procesar")
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    // Modal de confirmación
    if (showConfirmation) {
        const cuentaNombre = cuentas.find(c => c.id.toString() === formData.cuenta_id)?.nombre || ''
        const terceroNombre = terceros.find(t => t.id.toString() === formData.tercero_id)?.nombre || '-'
        const ccNombre = detalles[0]?.centro_costo_id
            ? centrosCostos.find(cc => cc.id === detalles[0].centro_costo_id)?.nombre || '-'
            : '-'
        const conceptoNombre = detalles[0]?.concepto_id
            ? conceptos.find(c => c.id === detalles[0].concepto_id)?.nombre || '-'
            : '-'

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
                    <h3 className="text-lg font-bold text-gray-900">Confirmar Movimiento</h3>

                    <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                        <div className="flex justify-between items-center border-b pb-2">
                            <span className="font-bold text-lg">
                                <CurrencyDisplay value={totalMovimiento} currency="COP" colorize />
                            </span>
                            <span className="text-gray-600">{cuentaNombre}</span>
                            <span className="text-gray-500">{formData.fecha}</span>
                        </div>
                        <div className="space-y-1 pt-2">
                            <div className="flex"><span className="w-20 text-gray-500">Tercero:</span><span className="font-medium">{terceroNombre}</span></div>
                            <div className="flex"><span className="w-20 text-gray-500">CC:</span><span className="font-medium">{ccNombre}</span></div>
                            <div className="flex"><span className="w-20 text-gray-500">Concepto:</span><span className="font-medium">{conceptoNombre}</span></div>
                            {formData.descripcion && (
                                <div className="flex"><span className="w-20 text-gray-500">Desc:</span><span className="font-medium truncate">{formData.descripcion}</span></div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setShowConfirmation(false)}
                            className="flex-1"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            onClick={executeSubmit}
                            isLoading={loading}
                            icon={Check}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                            Guardar
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onKeyDown={handleKeyDown}>
            <div className={`bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto ${mode === 'delete' ? 'border-2 border-red-500' : ''}`}>
                <div className={`flex justify-between items-center p-6 border-b ${mode === 'delete' ? 'bg-red-50 border-red-100' : 'border-gray-100'}`}>
                    <h2 className={`text-xl font-bold ${mode === 'delete' ? 'text-red-700' : 'text-gray-900'}`}>
                        {title}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {mode === 'delete' && (
                        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-start gap-3 text-sm border border-red-200">
                            <AlertCircle size={20} className="mt-0.5 shrink-0" />
                            <div>
                                <p className="font-bold">¿Estás seguro de que deseas eliminar este movimiento?</p>
                                <p>Esta acción no se puede deshacer.</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 text-red-700 p-3 rounded-lg flex items-center gap-2 text-sm">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    {/* Card 1: Encabezado - ID, Fecha, Cuenta, Valor */}
                    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
                        {/* Fila 1: ID, Fecha, Cuenta, Valor */}
                        <div className={`grid gap-4 ${movimiento ? 'grid-cols-4' : 'grid-cols-3'}`}>
                            {movimiento && (
                                <Input
                                    label="ID"
                                    value={movimiento.id?.toString() || ''}
                                    disabled
                                />
                            )}
                            <Input
                                label="Fecha"
                                type="date"
                                value={formData.fecha}
                                onChange={e => !isReadOnly && config.permite_modificar && setFormData({ ...formData, fecha: e.target.value })}
                                required
                                disabled={isReadOnly || (!config.permite_modificar && !!movimiento)}
                            />
                            <SelectorCuenta
                                value={formData.cuenta_id}
                                onChange={(val) => !isReadOnly && setFormData({ ...formData, cuenta_id: val })}
                                soloConciliables={false}
                                disabled={isReadOnly || !!movimiento}
                            />
                            {movimiento ? (
                                <div className="flex flex-col">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor Total</label>
                                    <div className="flex items-center h-10 px-3 bg-gray-100 border border-gray-300 rounded-lg">
                                        <CurrencyDisplay
                                            value={formData.valor ? parseFloat(formData.valor) : 0}
                                            currency="COP"
                                            colorize
                                        />
                                    </div>
                                </div>
                            ) : (
                                <CurrencyInput
                                    label="Valor Total"
                                    value={formData.valor ? parseFloat(formData.valor) : null}
                                    onChange={(val) => handleCurrencyChange(val, 'valor')}
                                    currency="COP"
                                    required
                                    disabled={isReadOnly}
                                />
                            )}
                        </div>

                        {/* Fila USD/TRM - Solo visible para cuentas en dólares */}
                        {esUSD && (
                            <div className="grid grid-cols-3 gap-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
                                <CurrencyInput
                                    label="Valor (USD)"
                                    value={formData.usd ? parseFloat(formData.usd) : null}
                                    onChange={(val) => handleCurrencyChange(val, 'usd')}
                                    currency="USD"
                                    required
                                    disabled={isReadOnly}
                                />
                                <CurrencyInput
                                    label="TRM (Tasa de cambio)"
                                    value={formData.trm ? parseFloat(formData.trm) : null}
                                    onChange={(val) => handleCurrencyChange(val, 'trm')}
                                    currency="TRM"
                                    required
                                    disabled={isReadOnly}
                                />
                                <div className="flex flex-col">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor Calculado (COP)</label>
                                    <div className="flex items-center h-10 px-3 bg-white border border-blue-300 rounded-lg">
                                        <CurrencyDisplay
                                            value={formData.valor ? parseFloat(formData.valor) : 0}
                                            currency="COP"
                                            colorize
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Fila 2: Nota adicional */}
                        <Input
                            label="Nota adicional"
                            value={formData.detalle}
                            onChange={e => !isReadOnly && setFormData({ ...formData, detalle: e.target.value })}
                            placeholder="Notas o comentarios adicionales"
                            disabled={isReadOnly}
                        />

                        {/* Fila 3: Descripción y Referencia (informativos, solo lectura) */}
                        {movimiento && (
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Descripción"
                                    value={formData.descripcion}
                                    disabled
                                    className="bg-gray-50"
                                />
                                <Input
                                    label="Referencia"
                                    value={formData.referencia || '-'}
                                    disabled
                                    className="bg-gray-50"
                                />
                            </div>
                        )}
                    </div>

                    {/* Card 2: Clasificación Contable */}
                    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
                        <h3 className="text-sm font-semibold text-gray-700">Clasificación Contable</h3>

                        <div className="bg-gray-50 rounded-lg border border-gray-200">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-100 border-b">
                                    <tr>
                                        <th className="px-3 py-2 w-8">#</th>
                                        <th className="px-3 py-2">Tercero</th>
                                        <th className="px-3 py-2">Centro Costo</th>
                                        <th className="px-3 py-2">Concepto</th>
                                        <th className="px-3 py-2 w-32 text-right">Valor</th>
                                        <th className="px-3 py-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {detalles.map((detalle, index) => (
                                        <tr key={index} className="bg-white">
                                            <td className="px-3 py-2 text-center text-gray-400 font-mono text-xs">{index + 1}</td>
                                            <td className="px-3 py-2">
                                                <EntitySelector
                                                    value={detalle.tercero_id || ''}
                                                    onChange={(val) => handleDetailChange(index, 'tercero_id', val ? parseInt(val) : null)}
                                                    options={terceros}
                                                    placeholder={index === 0 ? '(Encabezado)' : 'Seleccione...'}
                                                    disabled={isReadOnly || !config.permite_clasificar || (index === 0 && !!detalle.tercero_id)}
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <EntitySelector
                                                    value={detalle.centro_costo_id || ''}
                                                    onChange={(val) => handleDetailChange(index, 'centro_costo_id', val ? parseInt(val) : null)}
                                                    options={centrosCostos}
                                                    placeholder="Seleccione..."
                                                    disabled={isReadOnly || !config.permite_clasificar || (index === 0 && !!detalle.centro_costo_id)}
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <EntitySelector
                                                    value={detalle.concepto_id || ''}
                                                    onChange={(val) => handleDetailChange(index, 'concepto_id', val ? parseInt(val) : null)}
                                                    options={conceptos.filter(c => !detalle.centro_costo_id || Number(c.centro_costo_id) === Number(detalle.centro_costo_id))}
                                                    placeholder="Seleccione..."
                                                    disabled={isReadOnly || !config.permite_clasificar || (index === 0 && !!detalle.concepto_id)}
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <CurrencyInput
                                                    value={detalle.valor}
                                                    onChange={(val) => handleDetailChange(index, 'valor', val ?? 0)}
                                                    currency="COP"
                                                    disabled={isReadOnly}
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveDetail(index)}
                                                    className="text-gray-400 hover:text-red-500"
                                                    disabled={isReadOnly || detalles.length <= 1}
                                                >
                                                    <X size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="bg-gray-50 border-t border-gray-200">
                                        <td colSpan={6} className="px-3 py-2 text-center">
                                            <button
                                                type="button"
                                                onClick={handleAddDetail}
                                                className="text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center justify-center gap-1 mx-auto"
                                                disabled={isReadOnly}
                                            >
                                                <Plus size={14} /> Agregar Detalle
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                                <tfoot className="border-t-2 border-gray-200 bg-gray-100 font-bold text-sm">
                                    <tr>
                                        <td colSpan={4} className="px-3 py-2 text-right text-gray-600">Total Asignado:</td>
                                        <td className="px-3 py-2 text-right font-mono">
                                            <CurrencyDisplay value={totalDetalles} currency="COP" colorize />
                                        </td>
                                        <td></td>
                                    </tr>
                                    {!isBalanced && (
                                        <tr>
                                            <td colSpan={4} className="px-3 py-1 text-right text-gray-500 text-xs italic font-normal">Diferencia:</td>
                                            <td className="px-3 py-1 text-right text-xs font-mono font-bold">
                                                <CurrencyDisplay value={totalMovimiento - totalDetalles} currency="COP" colorize />
                                            </td>
                                            <td></td>
                                        </tr>
                                    )}
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Campos adicionales solo para creación */}
                    {!movimiento && (
                        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label={`Descripción${config.requiere_descripcion ? ' *' : ''}`}
                                    value={formData.descripcion}
                                    onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                                    required={config.requiere_descripcion}
                                    placeholder="Descripción del movimiento"
                                    disabled={isReadOnly}
                                />
                                <Input
                                    label="Referencia"
                                    value={formData.referencia}
                                    onChange={e => setFormData({ ...formData, referencia: e.target.value })}
                                    placeholder="Opcional"
                                    disabled={isReadOnly}
                                />
                            </div>
                        </div>
                    )}

                    {/* Errores de validación */}
                    {validationErrors.length > 0 && mode !== 'delete' && (
                        <div className="bg-yellow-50 text-yellow-700 p-3 rounded-lg text-sm">
                            <ul className="list-disc list-inside">
                                {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
                            </ul>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            className="flex-1"
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            isLoading={loading}
                            icon={submitIcon}
                            className={`flex-1 text-white ${mode === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                            disabled={!isValid && mode !== 'delete'}
                        >
                            {submitLabel}
                            {config.responde_enter && mode !== 'delete' && <span className="ml-2 text-xs opacity-70">(Enter)</span>}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
