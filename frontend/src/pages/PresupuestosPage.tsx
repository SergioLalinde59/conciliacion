import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Play, Lock, Eye, Calculator } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Presupuesto } from '../types/Presupuesto'
import { presupuestoService } from '../services/presupuesto.service'
import { Modal } from '../components/molecules/Modal'
import { Button } from '../components/atoms/Button'
import { Input } from '../components/atoms/Input'
import { CsvExportButton } from '../components/molecules/CsvExportButton'
import { PresupuestoGenerarModal } from '../components/organisms/modals/PresupuestoGenerarModal'

export const PresupuestosPage = () => {
    const navigate = useNavigate()
    const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([])
    const [loading, setLoading] = useState(true)
    const [modalOpen, setModalOpen] = useState(false)
    const [generarModalOpen, setGenerarModalOpen] = useState(false)
    const [itemEditando, setItemEditando] = useState<Presupuesto | null>(null)
    const [presupuestoGenerar, setPresupuestoGenerar] = useState<Presupuesto | null>(null)
    const [filtroAnio, setFiltroAnio] = useState<string>('')

    // Form state
    const [formAnio, setFormAnio] = useState(new Date().getFullYear())
    const [formNombre, setFormNombre] = useState('')
    const [formNotas, setFormNotas] = useState('')
    const [formVerdeHasta, setFormVerdeHasta] = useState(5)
    const [formAmarilloHasta, setFormAmarilloHasta] = useState(15)
    const [formUmbralMensual, setFormUmbralMensual] = useState(0)
    const [formUmbralAnual, setFormUmbralAnual] = useState(0)
    const [formError, setFormError] = useState('')

    const cargarPresupuestos = async () => {
        setLoading(true)
        try {
            const anio = filtroAnio ? parseInt(filtroAnio) : undefined
            const data = await presupuestoService.listar(anio)
            setPresupuestos(data)
        } catch (err: any) {
            console.error(err)
            toast.error('Error al cargar presupuestos')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        cargarPresupuestos()
    }, [filtroAnio])

    const handleCreate = () => {
        setItemEditando(null)
        setFormAnio(new Date().getFullYear())
        setFormNombre('')
        setFormNotas('')
        setFormVerdeHasta(5)
        setFormAmarilloHasta(15)
        setFormUmbralMensual(0)
        setFormUmbralAnual(0)
        setFormError('')
        setModalOpen(true)
    }

    const handleEdit = (p: Presupuesto) => {
        setItemEditando(p)
        setFormAnio(p.anio)
        setFormNombre(p.nombre)
        setFormNotas(p.notas || '')
        setFormVerdeHasta(p.semaforo_verde_hasta)
        setFormAmarilloHasta(p.semaforo_amarillo_hasta)
        setFormUmbralMensual(p.umbral_minimo_mensual)
        setFormUmbralAnual(p.umbral_minimo_anual)
        setFormError('')
        setModalOpen(true)
    }

    const formValido = formNombre.trim() && formVerdeHasta > 0 && formAmarilloHasta > 0 && formVerdeHasta < formAmarilloHasta && formUmbralMensual >= 0 && formUmbralAnual >= 0

    const handleSave = async () => {
        if (!formNombre.trim()) {
            setFormError('El nombre es obligatorio')
            return
        }
        if (formVerdeHasta <= 0 || formAmarilloHasta <= 0) {
            setFormError('Los umbrales deben ser mayores a 0')
            return
        }
        if (formVerdeHasta >= formAmarilloHasta) {
            setFormError('El umbral verde debe ser menor que el amarillo')
            return
        }
        if (formUmbralMensual < 0 || formUmbralAnual < 0) {
            setFormError('Los umbrales de materialidad no pueden ser negativos')
            return
        }
        setFormError('')
        try {
            if (itemEditando) {
                await presupuestoService.actualizar(itemEditando.id, {
                    nombre: formNombre.trim(),
                    notas: formNotas.trim() || undefined,
                    semaforo_verde_hasta: formVerdeHasta,
                    semaforo_amarillo_hasta: formAmarilloHasta,
                    umbral_minimo_mensual: formUmbralMensual,
                    umbral_minimo_anual: formUmbralAnual
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
                    umbral_minimo_anual: formUmbralAnual
                })
                toast.success('Presupuesto creado')
            }
            setModalOpen(false)
            cargarPresupuestos()
        } catch (err: any) {
            toast.error(err.message || 'Error al guardar')
        }
    }

    const handleDelete = async (p: Presupuesto) => {
        if (p.estado !== 'borrador') {
            toast.error('Solo se pueden eliminar presupuestos en borrador')
            return
        }
        if (!confirm(`¿Eliminar presupuesto "${p.nombre}"?`)) return
        try {
            await presupuestoService.eliminar(p.id)
            toast.success('Presupuesto eliminado')
            cargarPresupuestos()
        } catch (err: any) {
            toast.error(err.message || 'Error al eliminar')
        }
    }

    const handleActivar = async (p: Presupuesto) => {
        if (!confirm(`¿Activar presupuesto "${p.nombre}"? Solo puede haber uno activo por año.`)) return
        try {
            await presupuestoService.activar(p.id)
            toast.success('Presupuesto activado')
            cargarPresupuestos()
        } catch (err: any) {
            toast.error(err.message || 'Error al activar')
        }
    }

    const handleCerrar = async (p: Presupuesto) => {
        if (!confirm(`¿Cerrar presupuesto "${p.nombre}"? No se podrá modificar.`)) return
        try {
            await presupuestoService.cerrar(p.id)
            toast.success('Presupuesto cerrado')
            cargarPresupuestos()
        } catch (err: any) {
            toast.error(err.message || 'Error al cerrar')
        }
    }

    const handleGenerar = (p: Presupuesto) => {
        setPresupuestoGenerar(p)
        setGenerarModalOpen(true)
    }

    const handleGenerarSuccess = () => {
        setGenerarModalOpen(false)
        toast.success('Líneas de presupuesto generadas')
        cargarPresupuestos()
    }

    const estadoBadge = (estado: string) => {
        const config: Record<string, { bg: string; text: string }> = {
            borrador: { bg: 'bg-gray-100', text: 'text-gray-700' },
            activo: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
            cerrado: { bg: 'bg-rose-100', text: 'text-rose-700' },
        }
        const c = config[estado] || config.borrador
        return (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
                {estado.charAt(0).toUpperCase() + estado.slice(1)}
            </span>
        )
    }

    const csvColumns = [
        { key: 'id' as const, label: 'ID' },
        { key: 'anio' as const, label: 'Año' },
        { key: 'nombre' as const, label: 'Nombre' },
        { key: 'estado' as const, label: 'Estado' },
    ]

    const anios = [...new Set(presupuestos.map(p => p.anio))].sort((a, b) => b - a)

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Presupuestos</h1>
                    <p className="text-gray-500 text-sm mt-1">Planificación y control de gastos anuales</p>
                </div>
                <div className="flex items-center gap-2">
                    <CsvExportButton data={presupuestos} columns={csvColumns} filenamePrefix="presupuestos" />
                    <Button onClick={handleCreate} icon={Plus}>
                        Nuevo Presupuesto
                    </Button>
                </div>
            </div>

            {/* Filtro por año */}
            <div className="mb-4 flex items-center gap-3">
                <select
                    value={filtroAnio}
                    onChange={e => setFiltroAnio(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                    <option value="">Todos los años</option>
                    {anios.map(a => (
                        <option key={a} value={a}>{a}</option>
                    ))}
                </select>
                <span className="text-sm text-gray-500">
                    {presupuestos.length} presupuesto{presupuestos.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Tabla */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Año</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                            <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Semáforo</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Notas</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} className="text-center py-12 text-gray-400">Cargando...</td></tr>
                        ) : presupuestos.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-12 text-gray-400">No hay presupuestos</td></tr>
                        ) : presupuestos.map(p => (
                            <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.anio}</td>
                                <td className="px-4 py-3 text-sm text-gray-700">{p.nombre}</td>
                                <td className="px-4 py-3">{estadoBadge(p.estado)}</td>
                                <td className="px-4 py-3 text-center">
                                    <span className="text-xs font-mono text-gray-600">
                                        <span className="text-emerald-600">{p.semaforo_verde_hasta}%</span>
                                        {' / '}
                                        <span className="text-amber-600">{p.semaforo_amarillo_hasta}%</span>
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{p.notas || '-'}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-1">
                                        <button
                                            onClick={() => navigate(`/presupuestos/${p.id}/detalle`)}
                                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                                            title="Ver detalle"
                                        >
                                            <Eye size={16} />
                                        </button>
                                        {p.estado === 'borrador' && (
                                            <>
                                                <button
                                                    onClick={() => handleGenerar(p)}
                                                    className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-600 transition-colors"
                                                    title="Generar líneas desde año anterior"
                                                >
                                                    <Calculator size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(p)}
                                                    className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors"
                                                    title="Editar"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleActivar(p)}
                                                    className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors"
                                                    title="Activar"
                                                >
                                                    <Play size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(p)}
                                                    className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </>
                                        )}
                                        {p.estado === 'activo' && (
                                            <button
                                                onClick={() => handleCerrar(p)}
                                                className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 transition-colors"
                                                title="Cerrar presupuesto"
                                            >
                                                <Lock size={16} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal crear/editar */}
            <Modal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={itemEditando ? 'Editar Presupuesto' : 'Nuevo Presupuesto'}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
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
                        disabled={!!itemEditando}
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
                                <input
                                    type="number"
                                    value={formVerdeHasta}
                                    onChange={e => {
                                        const v = parseFloat(e.target.value)
                                        setFormVerdeHasta(isNaN(v) ? 0 : v)
                                        setFormError('')
                                    }}
                                    required
                                    min={0.1}
                                    max={99}
                                    step={0.5}
                                    className="w-full bg-white border border-gray-200 rounded-lg text-sm outline-none transition-all px-3 py-1.5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 hover:border-gray-300"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] text-amber-600 font-medium">Amarillo hasta</label>
                                <input
                                    type="number"
                                    value={formAmarilloHasta}
                                    onChange={e => {
                                        const v = parseFloat(e.target.value)
                                        setFormAmarilloHasta(isNaN(v) ? 0 : v)
                                        setFormError('')
                                    }}
                                    required
                                    min={0.1}
                                    max={99}
                                    step={0.5}
                                    className="w-full bg-white border border-gray-200 rounded-lg text-sm outline-none transition-all px-3 py-1.5 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 hover:border-gray-300"
                                />
                            </div>
                        </div>
                        {/* Preview visual */}
                        <div className="flex items-center gap-1.5 mt-2 text-[10px]">
                            <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                                Verde ≤ {formVerdeHasta}%
                            </span>
                            <span className="text-gray-300">→</span>
                            <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                                Amarillo ≤ {formAmarilloHasta}%
                            </span>
                            <span className="text-gray-300">→</span>
                            <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-medium">
                                Rojo &gt; {formAmarilloHasta}%
                            </span>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider ml-0.5">Umbral de Materialidad</label>
                        <p className="text-[10px] text-gray-400 ml-0.5">Gastos por debajo de estos montos se consideran no-materiales y se pueden ocultar en los reportes. 0 = sin filtro.</p>
                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <label className="text-[10px] text-gray-500 font-medium">Mínimo mensual ($)</label>
                                <input
                                    type="number"
                                    value={formUmbralMensual}
                                    onChange={e => {
                                        const v = parseFloat(e.target.value)
                                        setFormUmbralMensual(isNaN(v) ? 0 : v)
                                        setFormError('')
                                    }}
                                    min={0}
                                    step={10000}
                                    className="w-full bg-white border border-gray-200 rounded-lg text-sm outline-none transition-all px-3 py-1.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 hover:border-gray-300"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] text-gray-500 font-medium">Mínimo anual ($)</label>
                                <input
                                    type="number"
                                    value={formUmbralAnual}
                                    onChange={e => {
                                        const v = parseFloat(e.target.value)
                                        setFormUmbralAnual(isNaN(v) ? 0 : v)
                                        setFormError('')
                                    }}
                                    min={0}
                                    step={100000}
                                    className="w-full bg-white border border-gray-200 rounded-lg text-sm outline-none transition-all px-3 py-1.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 hover:border-gray-300"
                                />
                            </div>
                        </div>
                    </div>
                    {formError && (
                        <p className="text-sm text-rose-500 font-medium">{formError}</p>
                    )}
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider ml-0.5">Notas</label>
                        <textarea
                            value={formNotas}
                            onChange={e => setFormNotas(e.target.value)}
                            placeholder="Observaciones opcionales..."
                            rows={3}
                            className="w-full bg-white border border-gray-200 rounded-lg text-sm outline-none transition-all px-3 py-1.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 hover:border-gray-300"
                        />
                    </div>
                </form>
            </Modal>

            {/* Modal generar */}
            {presupuestoGenerar && (
                <PresupuestoGenerarModal
                    isOpen={generarModalOpen}
                    presupuesto={presupuestoGenerar}
                    onClose={() => setGenerarModalOpen(false)}
                    onSuccess={handleGenerarSuccess}
                />
            )}
        </div>
    )
}
