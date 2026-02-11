import { useState } from 'react'
import { Tags, Plus, Edit2, Trash2, X, Check } from 'lucide-react'
import { useTiposGasto, useTipoGastoMutations } from '../hooks/useTiposGasto'
import { useIndicadores } from '../hooks/useIndicadores'
import type { TipoGasto } from '../types/TipoGasto'

const INITIAL_FORM: Omit<TipoGasto, 'id'> = {
    tipo: '', descripcion: '',
    indicador_default: null, excluir_presupuesto: false, activo: true
}

export const TiposGastoPage = () => {
    const { data: tipos = [], isLoading } = useTiposGasto()
    const { crear, actualizar, eliminar } = useTipoGastoMutations()
    const { data: indicadores = [] } = useIndicadores()
    const nombresIndicador = [...new Set(indicadores.map(i => i.indicador))]
    const [showModal, setShowModal] = useState(false)
    const [editando, setEditando] = useState<TipoGasto | null>(null)
    const [form, setForm] = useState(INITIAL_FORM)

    const openCrear = () => { setEditando(null); setForm(INITIAL_FORM); setShowModal(true) }
    const openEditar = (t: TipoGasto) => {
        setEditando(t)
        setForm({ tipo: t.tipo, descripcion: t.descripcion || '',
            indicador_default: t.indicador_default, excluir_presupuesto: t.excluir_presupuesto, activo: t.activo })
        setShowModal(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (editando) {
            await actualizar.mutateAsync({ id: editando.id, ...form })
        } else {
            await crear.mutateAsync(form)
        }
        setShowModal(false)
    }

    const handleEliminar = async (id: number) => {
        if (confirm('¿Desactivar este tipo de gasto?')) {
            await eliminar.mutateAsync(id)
        }
    }

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Tags size={24} /> Tipos de Gasto
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Catálogo de clasificación de gastos para presupuesto</p>
                </div>
                <button onClick={openCrear}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                    <Plus size={18} /> Nuevo Tipo
                </button>
            </div>

            {isLoading ? (
                <div className="text-center py-8 text-slate-500">Cargando...</div>
            ) : (
                <div className="bg-white rounded-xl shadow overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600 uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3 text-center">Acciones</th>
                                <th className="px-4 py-3 text-left">Tipo</th>
                                <th className="px-4 py-3 text-left">Descripción</th>
                                <th className="px-4 py-3 text-left">Indicador Default</th>
                                <th className="px-4 py-3 text-center">Excluir Ppto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {tipos.map(t => (
                                <tr key={t.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => openEditar(t)} className="text-blue-500 hover:text-blue-700">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleEliminar(t.id)} className="text-red-400 hover:text-red-600">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-blue-600">{t.tipo}</td>
                                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{t.descripcion}</td>
                                    <td className="px-4 py-3">
                                        {t.indicador_default ? (
                                            <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-medium">
                                                {t.indicador_default}
                                            </span>
                                        ) : (
                                            <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-medium">
                                                Monto Fijo
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {t.excluir_presupuesto ? (
                                            <Check size={16} className="text-red-500 mx-auto" />
                                        ) : (
                                            <X size={16} className="text-slate-300 mx-auto" />
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl">
                        <h2 className="text-lg font-bold mb-4">{editando ? 'Editar' : 'Nuevo'} Tipo de Gasto</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                                <input value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                                    className="w-full border rounded-lg px-3 py-2 text-sm" required placeholder="ej: Fijo" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                                <input value={form.descripcion || ''} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                                    className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Descripción del tipo" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Indicador Default</label>
                                <select value={form.indicador_default ?? ''}
                                    onChange={e => setForm({ ...form, indicador_default: e.target.value || null })}
                                    className="w-full border rounded-lg px-3 py-2 text-sm">
                                    <option value="">Sin indicador (monto fijo)</option>
                                    {nombresIndicador.map(n => (
                                        <option key={n} value={n}>{n}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={form.excluir_presupuesto}
                                        onChange={e => setForm({ ...form, excluir_presupuesto: e.target.checked })} />
                                    Excluir del presupuesto
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={form.activo}
                                        onChange={e => setForm({ ...form, activo: e.target.checked })} />
                                    Activo
                                </label>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                                <button type="submit"
                                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                    {editando ? 'Guardar' : 'Crear'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
