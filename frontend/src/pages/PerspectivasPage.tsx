import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Plus, Eye, Pencil, Trash2, GripVertical } from 'lucide-react'
import { Button } from '../components/atoms/Button'
import { perspectivaService } from '../services/perspectiva.service'
import type { PerspectivaDTO } from '../services/perspectiva.service'
import type { Perspectiva } from '../types'
import { useCatalogo } from '../hooks/useCatalogo'
import { useQueryClient } from '@tanstack/react-query'

const EMPTY_FORM: PerspectivaDTO = {
    nombre: '', slug: '', tipo: 'excluir',
    centro_costo_ids: [], siempre_excluir_ids: [],
    es_defecto: false, orden: 0,
}

export const PerspectivasPage = () => {
    const [perspectivas, setPerspectivas] = useState<Perspectiva[]>([])
    const [loading, setLoading] = useState(true)
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState<PerspectivaDTO>(EMPTY_FORM)
    const [editId, setEditId] = useState<number | null>(null)
    const { centrosCostos } = useCatalogo()
    const qc = useQueryClient()

    const cargar = async () => {
        setLoading(true)
        try {
            const data = await perspectivaService.obtenerTodas()
            setPerspectivas(data)
        } catch {
            toast.error('Error al cargar perspectivas')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { cargar() }, [])

    const handleCreate = () => {
        setEditId(null)
        setForm(EMPTY_FORM)
        setModalOpen(true)
    }

    const handleEdit = (p: Perspectiva) => {
        setEditId(p.id)
        setForm({
            nombre: p.nombre, slug: p.slug, tipo: p.tipo,
            centro_costo_ids: p.centro_costo_ids,
            siempre_excluir_ids: p.siempre_excluir_ids,
            es_defecto: p.es_defecto, orden: p.orden,
        })
        setModalOpen(true)
    }

    const handleDelete = async (id: number) => {
        if (!confirm('Eliminar esta perspectiva?')) return
        try {
            await perspectivaService.eliminar(id)
            toast.success('Eliminada')
            qc.invalidateQueries({ queryKey: ['perspectivas'] })
            cargar()
        } catch (err: any) {
            toast.error(err.message || 'Error al eliminar')
        }
    }

    const handleSave = async () => {
        if (!form.nombre || !form.slug) {
            toast.error('Nombre y slug son requeridos')
            return
        }
        try {
            if (editId) {
                await perspectivaService.actualizar(editId, form)
                toast.success('Actualizada')
            } else {
                await perspectivaService.crear(form)
                toast.success('Creada')
            }
            setModalOpen(false)
            qc.invalidateQueries({ queryKey: ['perspectivas'] })
            cargar()
        } catch (err: any) {
            toast.error(err.message || 'Error al guardar')
        }
    }

    const ccNombre = (id: number) => centrosCostos.find(c => c.id === id)?.nombre || `#${id}`

    const toggleCcId = (list: number[], id: number) =>
        list.includes(id) ? list.filter(x => x !== id) : [...list, id]

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Eye className="text-blue-600" size={28} />
                        <h1 className="text-2xl font-bold text-gray-900">Perspectivas</h1>
                    </div>
                    <p className="text-gray-500 text-sm">
                        Configura las vistas/perspectivas para filtrar datos por centros de costos
                    </p>
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
                >
                    <Plus size={18} />
                    Nueva Perspectiva
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-32">Acciones</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Orden</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Slug</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">CCs</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Siempre Excluir</th>
                            <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Defecto</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={8} className="text-center py-8 text-gray-400">Cargando...</td></tr>
                        ) : perspectivas.length === 0 ? (
                            <tr><td colSpan={8} className="text-center py-8 text-gray-400">No hay perspectivas</td></tr>
                        ) : perspectivas.map(p => (
                            <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                                <td className="px-4 py-3 text-left">
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost-warning"
                                            size="sm"
                                            onClick={() => handleEdit(p)}
                                            className="!p-1.5"
                                            title="Editar"
                                        >
                                            <Pencil size={15} />
                                        </Button>
                                        <Button
                                            variant="ghost-danger"
                                            size="sm"
                                            onClick={() => handleDelete(p.id)}
                                            className="!p-1.5"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={15} />
                                        </Button>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-400">
                                    <GripVertical size={14} className="inline mr-1 opacity-40" />{p.orden}
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.nombre}</td>
                                <td className="px-4 py-3 text-sm font-mono text-gray-500">{p.slug}</td>
                                <td className="px-4 py-3">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                        p.tipo === 'incluir'
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-amber-100 text-amber-700'
                                    }`}>
                                        {p.tipo}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px]">
                                    {p.centro_costo_ids.length > 0
                                        ? p.centro_costo_ids.map(id => ccNombre(id)).join(', ')
                                        : <span className="text-gray-300">-</span>
                                    }
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-500">
                                    {p.siempre_excluir_ids.length > 0
                                        ? p.siempre_excluir_ids.map(id => ccNombre(id)).join(', ')
                                        : <span className="text-gray-300">-</span>
                                    }
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {p.es_defecto && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">default</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setModalOpen(false)}>
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-bold mb-4">{editId ? 'Editar' : 'Nueva'} Perspectiva</h2>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1">Nombre</label>
                                    <input
                                        value={form.nombre}
                                        onChange={e => setForm({ ...form, nombre: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="SLB"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1">Slug</label>
                                    <input
                                        value={form.slug}
                                        onChange={e => setForm({ ...form, slug: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="slb"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo</label>
                                    <select
                                        value={form.tipo}
                                        onChange={e => setForm({ ...form, tipo: e.target.value as 'incluir' | 'excluir' })}
                                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="excluir">Excluir</option>
                                        <option value="incluir">Incluir</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1">Orden</label>
                                    <input
                                        type="number"
                                        value={form.orden}
                                        onChange={e => setForm({ ...form, orden: Number(e.target.value) })}
                                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div className="flex items-end pb-1">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={form.es_defecto}
                                            onChange={e => setForm({ ...form, es_defecto: e.target.checked })}
                                            className="rounded"
                                        />
                                        <span className="text-sm text-gray-700">Es defecto</span>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-2">
                                    Centros de Costos ({form.tipo === 'incluir' ? 'a incluir' : 'a excluir'})
                                </label>
                                <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                                    {[...centrosCostos].sort((a, b) => {
                                        const aChecked = form.centro_costo_ids.includes(a.id) ? 0 : 1
                                        const bChecked = form.centro_costo_ids.includes(b.id) ? 0 : 1
                                        return aChecked - bChecked || a.nombre.localeCompare(b.nombre)
                                    }).map(cc => (
                                        <label key={cc.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={form.centro_costo_ids.includes(cc.id)}
                                                onChange={() => setForm({ ...form, centro_costo_ids: toggleCcId(form.centro_costo_ids, cc.id) })}
                                                className="rounded"
                                            />
                                            <span className="text-sm">
                                                <span className="text-gray-400">#{cc.id}</span> - {cc.nombre}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-2">
                                    Siempre Excluir (en todas las perspectivas que usen esta)
                                </label>
                                <div className="max-h-32 overflow-y-auto border rounded-lg p-2 space-y-1">
                                    {[...centrosCostos].sort((a, b) => {
                                        const aChecked = form.siempre_excluir_ids.includes(a.id) ? 0 : 1
                                        const bChecked = form.siempre_excluir_ids.includes(b.id) ? 0 : 1
                                        return aChecked - bChecked || a.nombre.localeCompare(b.nombre)
                                    }).map(cc => (
                                        <label key={cc.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={form.siempre_excluir_ids.includes(cc.id)}
                                                onChange={() => setForm({ ...form, siempre_excluir_ids: toggleCcId(form.siempre_excluir_ids, cc.id) })}
                                                className="rounded"
                                            />
                                            <span className="text-sm">
                                                <span className="text-gray-400">#{cc.id}</span> - {cc.nombre}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                            <button
                                onClick={() => setModalOpen(false)}
                                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                            >
                                {editId ? 'Guardar' : 'Crear'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
