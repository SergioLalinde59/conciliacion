import { useState } from 'react'
import { TrendingUp, Plus, Edit2, Trash2 } from 'lucide-react'
import { useIndicadores, useIndicadorMutations } from '../hooks/useIndicadores'
import type { IndicadorEconomico } from '../types/IndicadorEconomico'

const currentYear = new Date().getFullYear()

const INITIAL_FORM: Omit<IndicadorEconomico, 'id'> = {
    anio: currentYear, indicador: '', valor_porcentaje: 0, notas: '',
    rango_min_smlv: null, rango_max_smlv: null
}

const formatRango = (min: number | null | undefined, max: number | null | undefined) => {
    if (min == null && max == null) return null
    if (min != null && max != null) return `${min} - ${max} SMLV`
    if (min != null) return `> ${min} SMLV`
    return `< ${max} SMLV`
}

export const IndicadoresEconomicosPage = () => {
    const [anioFiltro, setAnioFiltro] = useState<number | undefined>(undefined)
    const { data: indicadores = [], isLoading } = useIndicadores(anioFiltro)
    const { crear, actualizar, eliminar } = useIndicadorMutations()
    const [showModal, setShowModal] = useState(false)
    const [editando, setEditando] = useState<IndicadorEconomico | null>(null)
    const [form, setForm] = useState(INITIAL_FORM)

    const openCrear = () => { setEditando(null); setForm(INITIAL_FORM); setShowModal(true) }
    const openEditar = (i: IndicadorEconomico) => {
        setEditando(i)
        setForm({ anio: i.anio, indicador: i.indicador,
            valor_porcentaje: i.valor_porcentaje, notas: i.notas || '',
            rango_min_smlv: i.rango_min_smlv ?? null, rango_max_smlv: i.rango_max_smlv ?? null })
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
        if (confirm('¿Eliminar este indicador?')) {
            await eliminar.mutateAsync(id)
        }
    }

    // Años disponibles
    const aniosDisponibles = [...new Set(indicadores.map(i => i.anio))].sort((a, b) => b - a)
    if (!aniosDisponibles.includes(currentYear)) aniosDisponibles.unshift(currentYear)

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <TrendingUp size={24} /> Indicadores Económicos
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">IPC, salario mínimo y otros indicadores por año</p>
                </div>
                <div className="flex items-center gap-3">
                    <select value={anioFiltro ?? ''} onChange={e => setAnioFiltro(e.target.value ? Number(e.target.value) : undefined)}
                        className="border rounded-lg px-3 py-2 text-sm">
                        <option value="">Todos los años</option>
                        {aniosDisponibles.map(a => (
                            <option key={a} value={a}>{a}</option>
                        ))}
                    </select>
                    <button onClick={openCrear}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                        <Plus size={18} /> Nuevo Indicador
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-8 text-slate-500">Cargando...</div>
            ) : (
                <div className="bg-white rounded-xl shadow overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600 uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3 text-left">Año</th>
                                <th className="px-4 py-3 text-left">Indicador</th>
                                <th className="px-4 py-3 text-right">Valor %</th>
                                <th className="px-4 py-3 text-center">Rango SMLV</th>
                                <th className="px-4 py-3 text-left">Notas</th>
                                <th className="px-4 py-3 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {indicadores.map(i => {
                                const rango = formatRango(i.rango_min_smlv, i.rango_max_smlv)
                                return (
                                    <tr key={i.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium">{i.anio}</td>
                                        <td className="px-4 py-3 font-semibold text-blue-600">{i.indicador}</td>
                                        <td className="px-4 py-3 text-right font-semibold">
                                            <span className={`px-2 py-1 rounded text-xs ${
                                                i.valor_porcentaje >= 20 ? 'bg-red-100 text-red-700' :
                                                i.valor_porcentaje >= 10 ? 'bg-amber-100 text-amber-700' :
                                                'bg-green-100 text-green-700'
                                            }`}>
                                                {i.valor_porcentaje.toFixed(2)}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {rango ? (
                                                <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-medium">
                                                    {rango}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{i.notas}</td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => openEditar(i)} className="text-blue-500 hover:text-blue-700">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => handleEliminar(i.id)} className="text-red-400 hover:text-red-600">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                            {indicadores.length === 0 && (
                                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No hay indicadores configurados</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl">
                        <h2 className="text-lg font-bold mb-4">{editando ? 'Editar' : 'Nuevo'} Indicador Económico</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Año</label>
                                    <input type="number" value={form.anio}
                                        onChange={e => setForm({ ...form, anio: Number(e.target.value) })}
                                        className="w-full border rounded-lg px-3 py-2 text-sm" required min={2020} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Valor (%)</label>
                                    <input type="number" step="0.01" value={form.valor_porcentaje}
                                        onChange={e => setForm({ ...form, valor_porcentaje: Number(e.target.value) })}
                                        className="w-full border rounded-lg px-3 py-2 text-sm" required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Indicador</label>
                                <input value={form.indicador} onChange={e => setForm({ ...form, indicador: e.target.value })}
                                    className="w-full border rounded-lg px-3 py-2 text-sm" required placeholder="IPC Colombia" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Rango Mín SMLV</label>
                                    <input type="number" step="0.01"
                                        value={form.rango_min_smlv ?? ''}
                                        onChange={e => setForm({ ...form, rango_min_smlv: e.target.value ? Number(e.target.value) : null })}
                                        className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Vacío = no aplica" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Rango Máx SMLV</label>
                                    <input type="number" step="0.01"
                                        value={form.rango_max_smlv ?? ''}
                                        onChange={e => setForm({ ...form, rango_max_smlv: e.target.value ? Number(e.target.value) : null })}
                                        className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Vacío = sin límite" />
                                </div>
                            </div>
                            <p className="text-xs text-slate-400 -mt-2">Rangos en múltiplos de SMLV. Solo para indicadores salariales.</p>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
                                <input value={form.notas || ''} onChange={e => setForm({ ...form, notas: e.target.value })}
                                    className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Opcional" />
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
