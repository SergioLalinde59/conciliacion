import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Modal } from '../../molecules/Modal'
import { Button } from '../../atoms/Button'
import { Input } from '../../atoms/Input'
import { presupuestoService } from '../../../services/presupuesto.service'
import type { Presupuesto } from '../../../types/Presupuesto'

interface Props {
    isOpen: boolean
    editando: Presupuesto | null
    onClose: () => void
    onSaved: () => void
}

export const PresupuestoFormModal = ({ isOpen, editando, onClose, onSaved }: Props) => {
    const [formAnio, setFormAnio] = useState(new Date().getFullYear())
    const [formNombre, setFormNombre] = useState('')
    const [formNotas, setFormNotas] = useState('')
    const [formVerdeHasta, setFormVerdeHasta] = useState(5)
    const [formAmarilloHasta, setFormAmarilloHasta] = useState(15)
    const [formUmbralMensual, setFormUmbralMensual] = useState(0)
    const [formUmbralAnual, setFormUmbralAnual] = useState(0)
    const [formError, setFormError] = useState('')

    useEffect(() => {
        if (!isOpen) return
        if (editando) {
            setFormAnio(editando.anio)
            setFormNombre(editando.nombre)
            setFormNotas(editando.notas || '')
            setFormVerdeHasta(editando.semaforo_verde_hasta)
            setFormAmarilloHasta(editando.semaforo_amarillo_hasta)
            setFormUmbralMensual(editando.umbral_minimo_mensual)
            setFormUmbralAnual(editando.umbral_minimo_anual)
        } else {
            setFormAnio(new Date().getFullYear())
            setFormNombre('')
            setFormNotas('')
            setFormVerdeHasta(5)
            setFormAmarilloHasta(15)
            setFormUmbralMensual(0)
            setFormUmbralAnual(0)
        }
        setFormError('')
    }, [isOpen, editando])

    const formValido = formNombre.trim() && formVerdeHasta > 0 && formAmarilloHasta > 0 && formVerdeHasta < formAmarilloHasta && formUmbralMensual >= 0 && formUmbralAnual >= 0

    const handleSave = async () => {
        if (!formNombre.trim()) { setFormError('El nombre es obligatorio'); return }
        if (formVerdeHasta <= 0 || formAmarilloHasta <= 0) { setFormError('Los umbrales deben ser mayores a 0'); return }
        if (formVerdeHasta >= formAmarilloHasta) { setFormError('El umbral verde debe ser menor que el amarillo'); return }
        if (formUmbralMensual < 0 || formUmbralAnual < 0) { setFormError('Los umbrales de materialidad no pueden ser negativos'); return }
        setFormError('')
        try {
            if (editando) {
                await presupuestoService.actualizar(editando.id, {
                    nombre: formNombre.trim(),
                    notas: formNotas.trim() || undefined,
                    semaforo_verde_hasta: formVerdeHasta,
                    semaforo_amarillo_hasta: formAmarilloHasta,
                    umbral_minimo_mensual: formUmbralMensual,
                    umbral_minimo_anual: formUmbralAnual,
                })
                toast.success('Presupuesto actualizado')
            } else {
                await presupuestoService.crear({
                    anio: formAnio,
                    nombre: formNombre.trim(),
                    notas: formNotas.trim() || undefined,
                    semaforo_verde_hasta: formVerdeHasta,
                    semaforo_amarillo_hasta: formAmarilloHasta,
                    umbral_minimo_mensual: formUmbralMensual,
                    umbral_minimo_anual: formUmbralAnual,
                })
                toast.success('Presupuesto creado')
            }
            onSaved()
        } catch (err: any) {
            toast.error(err.message || 'Error al guardar')
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editando ? 'Editar Presupuesto' : 'Nuevo Presupuesto'}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={!formValido}>Guardar</Button>
                </>
            }
        >
            <form onSubmit={e => { e.preventDefault(); handleSave() }} className="space-y-4">
                <Input
                    label="Año"
                    type="number"
                    value={formAnio}
                    onChange={e => setFormAnio(parseInt(e.target.value) || new Date().getFullYear())}
                    disabled={!!editando}
                    min={2020}
                    max={2099}
                />
                <Input
                    label="Nombre"
                    value={formNombre}
                    onChange={e => setFormNombre(e.target.value)}
                    placeholder="Ej: Presupuesto 2026"
                    autoFocus
                />
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider ml-0.5">Umbrales Semáforo (%) <span className="text-rose-500">*</span></label>
                    <div className="flex items-center gap-3">
                        <div className="flex-1">
                            <label className="text-[10px] text-emerald-600 font-medium">Verde hasta</label>
                            <input type="number" value={formVerdeHasta}
                                onChange={e => { setFormVerdeHasta(parseFloat(e.target.value) || 0); setFormError('') }}
                                required min={0.1} max={99} step={0.5}
                                className="w-full bg-white border border-gray-200 rounded-lg text-sm outline-none transition-all px-3 py-1.5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 hover:border-gray-300" />
                        </div>
                        <div className="flex-1">
                            <label className="text-[10px] text-amber-600 font-medium">Amarillo hasta</label>
                            <input type="number" value={formAmarilloHasta}
                                onChange={e => { setFormAmarilloHasta(parseFloat(e.target.value) || 0); setFormError('') }}
                                required min={0.1} max={99} step={0.5}
                                className="w-full bg-white border border-gray-200 rounded-lg text-sm outline-none transition-all px-3 py-1.5 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 hover:border-gray-300" />
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 text-[10px]">
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Verde ≤ {formVerdeHasta}%</span>
                        <span className="text-gray-300">→</span>
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Amarillo ≤ {formAmarilloHasta}%</span>
                        <span className="text-gray-300">→</span>
                        <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-medium">Rojo &gt; {formAmarilloHasta}%</span>
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider ml-0.5">Umbral de Materialidad</label>
                    <p className="text-[10px] text-gray-400 ml-0.5">Gastos por debajo de estos montos se consideran no-materiales y se pueden ocultar en los reportes. 0 = sin filtro.</p>
                    <div className="flex items-center gap-3">
                        <div className="flex-1">
                            <label className="text-[10px] text-gray-500 font-medium">Mínimo mensual ($)</label>
                            <input type="number" value={formUmbralMensual}
                                onChange={e => { setFormUmbralMensual(parseFloat(e.target.value) || 0); setFormError('') }}
                                min={0} step={10000}
                                className="w-full bg-white border border-gray-200 rounded-lg text-sm outline-none transition-all px-3 py-1.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 hover:border-gray-300" />
                        </div>
                        <div className="flex-1">
                            <label className="text-[10px] text-gray-500 font-medium">Mínimo anual ($)</label>
                            <input type="number" value={formUmbralAnual}
                                onChange={e => { setFormUmbralAnual(parseFloat(e.target.value) || 0); setFormError('') }}
                                min={0} step={100000}
                                className="w-full bg-white border border-gray-200 rounded-lg text-sm outline-none transition-all px-3 py-1.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 hover:border-gray-300" />
                        </div>
                    </div>
                </div>
                {formError && <p className="text-sm text-rose-500 font-medium">{formError}</p>}
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider ml-0.5">Notas</label>
                    <textarea value={formNotas} onChange={e => setFormNotas(e.target.value)}
                        placeholder="Observaciones opcionales..." rows={3}
                        className="w-full bg-white border border-gray-200 rounded-lg text-sm outline-none transition-all px-3 py-1.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 hover:border-gray-300" />
                </div>
            </form>
        </Modal>
    )
}
