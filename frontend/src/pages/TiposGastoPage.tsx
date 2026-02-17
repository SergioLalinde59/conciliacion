import { useState, useMemo } from 'react'
import { Tags, Plus, Edit2, Trash2, X, Check, Sparkles, TrendingUp, Link2, ToggleLeft, ToggleRight, Filter } from 'lucide-react'
import { useTiposGasto, useTipoGastoMutations } from '../hooks/useTiposGasto'
import { useIndicadores } from '../hooks/useIndicadores'
import { useCatalogos } from '../hooks/useCatalogo'
import type { TipoGasto, KeywordPair } from '../types/TipoGasto'

const tipoBadgeColor: Record<string, string> = {
    Fijo: 'bg-blue-100 text-blue-700',
    Variable: 'bg-green-100 text-green-700',
    Salarial: 'bg-purple-100 text-purple-700',
    Estacional: 'bg-amber-100 text-amber-700',
    'No Repetitivo': 'bg-red-100 text-red-700',
}

const tipoHeroColor: Record<string, string> = {
    Fijo: 'from-blue-50 to-blue-100/50 border-blue-200',
    Variable: 'from-green-50 to-green-100/50 border-green-200',
    Salarial: 'from-purple-50 to-purple-100/50 border-purple-200',
    Estacional: 'from-amber-50 to-amber-100/50 border-amber-200',
    'No Repetitivo': 'from-red-50 to-red-100/50 border-red-200',
}

const tipoIconColor: Record<string, string> = {
    Fijo: 'bg-blue-500',
    Variable: 'bg-green-500',
    Salarial: 'bg-purple-500',
    Estacional: 'bg-amber-500',
    'No Repetitivo': 'bg-red-500',
}

const EMPTY_PAIR: KeywordPair = { concepto: '', centro_costo: '' }

const INITIAL_FORM: Omit<TipoGasto, 'id'> = {
    tipo: '', descripcion: '',
    indicador_default: null, excluir_presupuesto: false, activo: true,
    keywords: [], prioridad: 99
}

export const TiposGastoPage = () => {
    const { data: tipos = [], isLoading } = useTiposGasto()
    const { crear, actualizar, eliminar } = useTipoGastoMutations()
    const { data: indicadores = [] } = useIndicadores()
    const { centrosCostos, conceptos } = useCatalogos()
    const nombresIndicador = [...new Set(indicadores.map(i => i.indicador))]
    const [showModal, setShowModal] = useState(false)
    const [editando, setEditando] = useState<TipoGasto | null>(null)
    const [form, setForm] = useState(INITIAL_FORM)
    const [newPair, setNewPair] = useState<KeywordPair>({ ...EMPTY_PAIR })
    const [filtroCC, setFiltroCC] = useState('')

    const openCrear = () => { setEditando(null); setForm(INITIAL_FORM); setNewPair({ ...EMPTY_PAIR }); setFiltroCC(''); setShowModal(true) }
    const openEditar = (t: TipoGasto) => {
        setEditando(t)
        setForm({
            tipo: t.tipo, descripcion: t.descripcion || '',
            indicador_default: t.indicador_default, excluir_presupuesto: t.excluir_presupuesto, activo: t.activo,
            keywords: t.keywords || [], prioridad: t.prioridad
        })
        setNewPair({ ...EMPTY_PAIR })
        setFiltroCC('')
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

    const addPair = () => {
        if (!newPair.concepto || !newPair.centro_costo) return
        setForm({ ...form, keywords: [...form.keywords, { ...newPair }] })
        setNewPair({ ...EMPTY_PAIR })
    }

    const keywordsFiltradas = useMemo(() => {
        const indexed = form.keywords.map((kw, idx) => ({ ...kw, _idx: idx }))
        const filtered = filtroCC
            ? indexed.filter(kw => kw.centro_costo?.toLowerCase() === filtroCC.toLowerCase())
            : indexed
        return filtered.sort((a, b) => {
            const ccCmp = (a.centro_costo || '').localeCompare(b.centro_costo || '')
            return ccCmp !== 0 ? ccCmp : (a.concepto || '').localeCompare(b.concepto || '')
        })
    }, [form.keywords, filtroCC])

    // CCs únicos presentes en las keywords actuales (para el filtro)
    const ccsEnKeywords = useMemo(() => {
        const unique = [...new Set(form.keywords.map(kw => kw.centro_costo).filter(Boolean))] as string[]
        return unique.sort((a, b) => a.localeCompare(b))
    }, [form.keywords])

    const removePair = (idx: number) => {
        setForm({ ...form, keywords: form.keywords.filter((_, i) => i !== idx) })
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
                                <th className="px-4 py-3 text-center w-16">Prio</th>
                                <th className="px-4 py-3 text-left">Tipo</th>
                                <th className="px-4 py-3 text-left">Descripción</th>
                                <th className="px-4 py-3 text-left">Indicador Default</th>
                                <th className="px-4 py-3 text-center">Keywords</th>
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
                                    <td className="px-4 py-3 text-center font-mono text-slate-500">{t.prioridad}</td>
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
                                        {t.keywords?.length ? (
                                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-medium">
                                                {t.keywords.length} parejas
                                            </span>
                                        ) : (
                                            <span className="text-slate-300 text-xs">—</span>
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
                        <form onSubmit={handleSubmit}>
                            {/* Hero Header */}
                            <div className={`bg-gradient-to-r ${tipoHeroColor[form.tipo] || 'from-slate-50 to-slate-100/50 border-slate-200'} -mb-px rounded-t-2xl px-6 py-5 border-b`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl ${tipoIconColor[form.tipo] || 'bg-slate-400'} flex items-center justify-center shadow-sm`}>
                                            <Tags size={20} className="text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-800">
                                                {editando ? 'Editar' : 'Nuevo'} Tipo de Gasto
                                            </h2>
                                            {form.tipo && (
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold mt-0.5 ${tipoBadgeColor[form.tipo] || 'bg-slate-100 text-slate-700'}`}>
                                                    {form.tipo}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => setShowModal(false)}
                                        className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/60 transition-colors">
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 space-y-5">
                                {/* Section: Identidad */}
                                <div className="bg-gray-50/50 rounded-xl border border-gray-100 p-4 space-y-3">
                                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Sparkles size={12} /> Identidad
                                    </h3>
                                    <div className="grid grid-cols-[1fr_80px] gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Tipo</label>
                                            <input value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                                                required placeholder="ej: Fijo" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Prioridad</label>
                                            <input type="number" value={form.prioridad}
                                                onChange={e => setForm({ ...form, prioridad: parseInt(e.target.value) || 99 })}
                                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-center font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                                                min={1} max={99} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Descripción</label>
                                        <input value={form.descripcion || ''} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                                            placeholder="Descripción del tipo de gasto" />
                                    </div>
                                </div>

                                {/* Section: Comportamiento */}
                                <div className="bg-gray-50/50 rounded-xl border border-gray-100 p-4 space-y-3">
                                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <TrendingUp size={12} /> Comportamiento
                                    </h3>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Indicador Económico</label>
                                        <select value={form.indicador_default ?? ''}
                                            onChange={e => setForm({ ...form, indicador_default: e.target.value || null })}
                                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow">
                                            <option value="">Sin indicador (monto fijo)</option>
                                            {nombresIndicador.map(n => (
                                                <option key={n} value={n}>{n}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-6 pt-1">
                                        <button type="button"
                                            onClick={() => setForm({ ...form, excluir_presupuesto: !form.excluir_presupuesto })}
                                            className="flex items-center gap-2 group cursor-pointer">
                                            {form.excluir_presupuesto
                                                ? <ToggleRight size={28} className="text-red-500" />
                                                : <ToggleLeft size={28} className="text-slate-300 group-hover:text-slate-400 transition-colors" />
                                            }
                                            <span className={`text-sm font-medium ${form.excluir_presupuesto ? 'text-red-600' : 'text-slate-500'}`}>
                                                Excluir del presupuesto
                                            </span>
                                        </button>
                                        <button type="button"
                                            onClick={() => setForm({ ...form, activo: !form.activo })}
                                            className="flex items-center gap-2 group cursor-pointer">
                                            {form.activo
                                                ? <ToggleRight size={28} className="text-emerald-500" />
                                                : <ToggleLeft size={28} className="text-slate-300 group-hover:text-slate-400 transition-colors" />
                                            }
                                            <span className={`text-sm font-medium ${form.activo ? 'text-emerald-600' : 'text-slate-500'}`}>
                                                Activo
                                            </span>
                                        </button>
                                    </div>
                                </div>

                                {/* Section: Keywords */}
                                <div className="bg-gray-50/50 rounded-xl border border-gray-100 p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <Link2 size={12} /> Keywords
                                            {form.keywords.length > 0 && (
                                                <span className="ml-1 bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                                                    {form.keywords.length}
                                                </span>
                                            )}
                                        </h3>
                                        <span className="text-[10px] text-slate-400">
                                            Parejas CC + Concepto (ambos obligatorios)
                                        </span>
                                    </div>

                                    {/* Filtro por CC */}
                                    {ccsEnKeywords.length > 1 && (
                                        <div className="flex items-center gap-2">
                                            <Filter size={12} className="text-slate-400" />
                                            <select
                                                value={filtroCC}
                                                onChange={e => setFiltroCC(e.target.value)}
                                                className="border border-gray-200 rounded-md px-2 py-1 text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700">
                                                <option value="">Todos los CC ({form.keywords.length})</option>
                                                {ccsEnKeywords.map(cc => {
                                                    const ccObj = centrosCostos.find(c => c.nombre.toLowerCase() === cc.toLowerCase())
                                                    const count = form.keywords.filter(kw => kw.centro_costo?.toLowerCase() === cc.toLowerCase()).length
                                                    return (
                                                        <option key={cc} value={cc}>
                                                            {ccObj ? `${ccObj.id} - ${ccObj.nombre}` : cc} ({count})
                                                        </option>
                                                    )
                                                })}
                                            </select>
                                            {filtroCC && (
                                                <button type="button" onClick={() => setFiltroCC('')}
                                                    className="text-slate-400 hover:text-slate-600">
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Mini-table: Keywords list + Add row */}
                                    <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
                                        {/* Column headers */}
                                        <div className="grid grid-cols-[1fr_1fr_36px] bg-slate-50/80 border-b border-gray-200">
                                            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Centro Costo</div>
                                            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Concepto</div>
                                            <div></div>
                                        </div>

                                        {/* Keyword rows */}
                                        {keywordsFiltradas.length > 0 ? (
                                            <div className="max-h-52 overflow-y-auto divide-y divide-gray-100">
                                                {keywordsFiltradas.map((kw) => {
                                                    const ccObj = centrosCostos.find(c => c.nombre.toLowerCase() === (kw.centro_costo || '').toLowerCase())
                                                    const concObj = conceptos.find(c => c.nombre.toLowerCase() === (kw.concepto || '').toLowerCase())
                                                    return (
                                                        <div key={kw._idx}
                                                            className="grid grid-cols-[1fr_1fr_36px] items-center group hover:bg-slate-50/60 transition-colors">
                                                            <div className="px-3 py-2">
                                                                <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-100">
                                                                    {ccObj ? `${ccObj.id} - ${ccObj.nombre}` : kw.centro_costo}
                                                                </span>
                                                            </div>
                                                            <div className="px-3 py-2">
                                                                <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                                                                    {concObj ? `${concObj.id} - ${concObj.nombre}` : kw.concepto}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-center">
                                                                <button type="button" onClick={() => removePair(kw._idx)}
                                                                    className="p-1 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-center py-4 text-slate-300 text-xs">
                                                {filtroCC ? 'Sin keywords para este CC' : 'Sin keywords definidas'}
                                            </div>
                                        )}

                                        {/* Add row */}
                                        <div className="grid grid-cols-[1fr_1fr_36px] items-center border-t border-dashed border-gray-200 bg-slate-50/30">
                                            <div className="px-2 py-2">
                                                <select
                                                    value={newPair.centro_costo || ''}
                                                    onChange={e => setNewPair({ centro_costo: e.target.value, concepto: '' })}
                                                    className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow text-slate-700">
                                                    <option value="">— Seleccionar CC —</option>
                                                    {[...centrosCostos].sort((a, b) => a.nombre.localeCompare(b.nombre)).map(cc => (
                                                        <option key={cc.id} value={cc.nombre}>{cc.id} - {cc.nombre}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="px-2 py-2">
                                                {(() => {
                                                    const ccSeleccionado = newPair.centro_costo
                                                        ? centrosCostos.find(cc => cc.nombre === newPair.centro_costo)
                                                        : null
                                                    const conceptosFiltrados = (ccSeleccionado
                                                        ? conceptos.filter(c => c.centro_costo_id === ccSeleccionado.id)
                                                        : conceptos
                                                    ).sort((a, b) => a.nombre.localeCompare(b.nombre))
                                                    return (
                                                        <select
                                                            value={newPair.concepto || ''}
                                                            onChange={e => setNewPair({ ...newPair, concepto: e.target.value })}
                                                            disabled={!newPair.centro_costo}
                                                            className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow text-slate-700 disabled:bg-slate-50 disabled:text-slate-400">
                                                            <option value="">{newPair.centro_costo ? '— Seleccionar Concepto —' : 'Primero seleccione CC'}</option>
                                                            {conceptosFiltrados.map(c => (
                                                                <option key={c.id} value={c.nombre}>{c.id} - {c.nombre}</option>
                                                            ))}
                                                        </select>
                                                    )
                                                })()}
                                            </div>
                                            <div className="flex justify-center">
                                                <button type="button" onClick={addPair}
                                                    disabled={!newPair.centro_costo || !newPair.concepto}
                                                    className="p-1.5 rounded-md text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                    title="Agregar pareja">
                                                    <Plus size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/30 rounded-b-2xl">
                                <button type="button" onClick={() => setShowModal(false)}
                                    className="px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                                    Cancelar
                                </button>
                                <button type="submit"
                                    className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm hover:shadow transition-all transform hover:-translate-y-0.5">
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
