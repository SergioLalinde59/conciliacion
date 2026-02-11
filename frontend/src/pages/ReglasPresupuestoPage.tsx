import React, { useState, useEffect, useMemo } from 'react'
import { Zap, Plus, Filter } from 'lucide-react'
import { useReglasPresupuesto, useReglaPresupuestoMutations } from '../hooks/useReglasPresupuesto'
import { useTiposGasto } from '../hooks/useTiposGasto'
import { useIndicadores } from '../hooks/useIndicadores'
import { useConfiguracionExclusion } from '../hooks/useReportes'
import type { ReglaPresupuesto } from '../types/ReglaPresupuesto'
import { useQuery } from '@tanstack/react-query'
import { API_BASE_URL, handleResponse } from '../services/httpClient'
import { DataTable } from '../components/molecules/DataTable'
import type { Column } from '../components/molecules/DataTable'
import { textoColumn } from '../components/atoms/columnHelpers'
import { EntitySelector } from '../components/molecules/entities/EntitySelector'
import { FilterToggles } from '../components/molecules/FilterToggles'

const formatMiles = (value: number | null): string => {
    if (value == null) return ''
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Math.round(value))
}

const parseMonto = (text: string): number | null => {
    const cleaned = text.replace(/[^\d]/g, '')
    return cleaned ? Number(cleaned) : null
}

const INITIAL_FORM = {
    centro_costo_id: null as number | null,
    concepto_id: null as number | null,
    tipo_gasto: 'Variable',
    indicador_nombre: 'IPC Colombia' as string | null,
    factor_ajuste: 0,
    monto_fijo_mensual: null as number | null,
    notas: '' as string | null,
}

export const ReglasPresupuestoPage = () => {
    const { data: reglas = [], isLoading } = useReglasPresupuesto()
    const { crear, actualizar, eliminar } = useReglaPresupuestoMutations()
    const { data: tiposGasto = [] } = useTiposGasto()
    const { data: indicadores = [] } = useIndicadores()
    const [showModal, setShowModal] = useState(false)
    const [editando, setEditando] = useState<ReglaPresupuesto | null>(null)
    const [form, setForm] = useState(INITIAL_FORM)
    const [editingMonto, setEditingMonto] = useState<'mensual' | 'anual' | null>(null)
    const [rawMonto, setRawMonto] = useState('')

    // Filtros
    const [filtroCCId, setFiltroCCId] = useState<number | null>(null)
    const [filtroConceptoId, setFiltroConceptoId] = useState<number | null>(null)
    const { data: configExclusion = [] } = useConfiguracionExclusion()
    const [centrosCostosExcluidos, setCentrosCostosExcluidos] = useState<number[] | null>(null)
    const actualExcluidos = centrosCostosExcluidos || []

    useEffect(() => {
        if (configExclusion.length > 0 && centrosCostosExcluidos === null) {
            const defaults = configExclusion.filter(d => d.activo_por_defecto).map(d => d.centro_costo_id)
            setCentrosCostosExcluidos(defaults)
        }
    }, [configExclusion, centrosCostosExcluidos])

    // Cargar centros de costo y conceptos
    const { data: centrosCosto = [] } = useQuery({
        queryKey: ['centros-costo-select'],
        queryFn: () => fetch(`${API_BASE_URL}/api/centros-costos`).then(handleResponse) as Promise<{ id: number; nombre: string }[]>,
        staleTime: 10 * 60 * 1000,
    })
    const { data: conceptos = [] } = useQuery({
        queryKey: ['conceptos-select'],
        queryFn: () => fetch(`${API_BASE_URL}/api/conceptos`).then(handleResponse) as Promise<{ id: number; nombre: string }[]>,
        staleTime: 10 * 60 * 1000,
    })

    // Indicadores únicos por nombre
    const nombresIndicador = [...new Set(indicadores.map(i => i.indicador))]

    // Opciones de filtro derivadas de los datos
    const opcionesCC = useMemo(() => {
        const map = new Map<number, string>()
        reglas.forEach(r => {
            if (r.centro_costo_id && r.centro_costo_nombre && !map.has(r.centro_costo_id))
                map.set(r.centro_costo_id, r.centro_costo_nombre)
        })
        return [...map.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre))
    }, [reglas])

    const opcionesConcepto = useMemo(() => {
        const base = filtroCCId !== null ? reglas.filter(r => r.centro_costo_id === filtroCCId) : reglas
        const map = new Map<number, string>()
        base.forEach(r => {
            if (r.concepto_id && r.concepto_nombre && !map.has(r.concepto_id))
                map.set(r.concepto_id, r.concepto_nombre)
        })
        return [...map.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre))
    }, [reglas, filtroCCId])

    // Filtrar reglas
    const reglasFiltered = useMemo(() => {
        let result = reglas
        if (filtroCCId !== null) result = result.filter(r => r.centro_costo_id === filtroCCId)
        if (filtroConceptoId !== null) result = result.filter(r => r.concepto_id === filtroConceptoId)
        if (actualExcluidos.length > 0) result = result.filter(r => !r.centro_costo_id || !actualExcluidos.includes(r.centro_costo_id))
        return result
    }, [reglas, filtroCCId, filtroConceptoId, actualExcluidos])

    const openCrear = () => { setEditando(null); setForm(INITIAL_FORM); setEditingMonto(null); setShowModal(true) }
    const openEditar = (r: ReglaPresupuesto) => {
        setEditando(r)
        setForm({
            centro_costo_id: r.centro_costo_id,
            concepto_id: r.concepto_id,
            tipo_gasto: r.tipo_gasto,
            indicador_nombre: r.indicador_nombre,
            factor_ajuste: r.factor_ajuste,
            monto_fijo_mensual: r.monto_fijo_mensual,
            notas: r.notas || '',
        })
        setEditingMonto(null)
        setShowModal(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (editando) {
            await actualizar.mutateAsync({
                id: editando.id,
                ...form,
                centro_costo_nombre: undefined,
                concepto_nombre: undefined,
            } as ReglaPresupuesto)
        } else {
            await crear.mutateAsync(form)
        }
        setShowModal(false)
    }

    const handleEliminar = async (id: number) => {
        await eliminar.mutateAsync(id)
    }

    // Al seleccionar tipo_gasto, alternar entre indicador y monto fijo
    const handleTipoChange = (tipo: string) => {
        const tipoGasto = tiposGasto.find(t => t.tipo === tipo)
        if (tipoGasto?.indicador_default) {
            // Modo indicador
            setForm({ ...form, tipo_gasto: tipo, indicador_nombre: tipoGasto.indicador_default, monto_fijo_mensual: null })
        } else {
            // Modo monto fijo (sin indicador)
            setForm({ ...form, tipo_gasto: tipo, indicador_nombre: null, monto_fijo_mensual: form.monto_fijo_mensual })
        }
    }

    // Determinar si el tipo seleccionado usa monto fijo
    const tipoSeleccionado = tiposGasto.find(t => t.tipo === form.tipo_gasto)
    const usaMontoFijo = !tipoSeleccionado?.indicador_default

    // Monto fijo: display y cálculo bidireccional mensual ↔ anual
    const montoAnual = form.monto_fijo_mensual ? form.monto_fijo_mensual * 12 : null
    const mensualDisplay = editingMonto === 'mensual' ? rawMonto : formatMiles(form.monto_fijo_mensual)
    const anualDisplay = editingMonto === 'anual' ? rawMonto : formatMiles(montoAnual)

    const handleMensualFocus = () => {
        setEditingMonto('mensual')
        setRawMonto(form.monto_fijo_mensual?.toString() ?? '')
    }
    const handleMensualChange = (text: string) => {
        setRawMonto(text)
        setForm({ ...form, monto_fijo_mensual: parseMonto(text) })
    }
    const handleAnualFocus = () => {
        setEditingMonto('anual')
        setRawMonto(montoAnual?.toString() ?? '')
    }
    const handleAnualChange = (text: string) => {
        setRawMonto(text)
        const anual = parseMonto(text)
        setForm({ ...form, monto_fijo_mensual: anual ? Math.round(anual / 12) : null })
    }
    const handleMontoBlur = () => setEditingMonto(null)

    const tipoBadgeColor: Record<string, string> = {
        Fijo: 'bg-blue-100 text-blue-700',
        Variable: 'bg-green-100 text-green-700',
        Salarial: 'bg-purple-100 text-purple-700',
        Estacional: 'bg-amber-100 text-amber-700',
        'No Repetitivo': 'bg-red-100 text-red-700',
    }

    const columns = useMemo<Column<ReglaPresupuesto>[]>(() => [
        textoColumn<ReglaPresupuesto>('centroCosto', 'centroCosto',
            r => r.centro_costo_nombre || '',
            { accessor: r => r.centro_costo_nombre || <span className="text-slate-400 italic">Todos</span> }
        ),
        textoColumn<ReglaPresupuesto>('concepto', 'concepto',
            r => r.concepto_nombre || '',
            { accessor: r => r.concepto_nombre || <span className="text-slate-400 italic">Todos</span> }
        ),
        {
            key: 'tipoGasto',
            header: 'tipoGasto',
            sortable: true,
            sortValue: (r: ReglaPresupuesto) => r.tipo_gasto,
            align: 'left' as const,
            accessor: (r: ReglaPresupuesto) => (
                <span className={`px-2 py-1 rounded text-xs font-medium ${tipoBadgeColor[r.tipo_gasto] || 'bg-slate-100 text-slate-700'}`}>
                    {r.tipo_gasto}
                </span>
            ),
        },
        {
            key: 'indicador',
            header: 'indicador',
            sortable: true,
            sortValue: (r: ReglaPresupuesto) => r.monto_fijo_mensual ? `$${r.monto_fijo_mensual}` : r.indicador_nombre || '',
            align: 'left' as const,
            accessor: (r: ReglaPresupuesto) => {
                if (r.monto_fijo_mensual) {
                    return (
                        <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-medium">
                            ${formatMiles(r.monto_fijo_mensual)}/mes
                        </span>
                    )
                }
                if (r.indicador_nombre) {
                    return (
                        <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-medium">
                            {r.indicador_nombre}
                        </span>
                    )
                }
                return <span className="text-slate-400 italic">-</span>
            },
        },
        {
            key: 'factor',
            header: 'factor %',
            sortable: true,
            sortValue: (r: ReglaPresupuesto) => r.monto_fijo_mensual ? 0 : r.factor_ajuste,
            align: 'right' as const,
            cellClassName: 'font-mono text-sm',
            accessor: (r: ReglaPresupuesto) => (
                <span>{r.monto_fijo_mensual ? '-' : r.factor_ajuste !== 0 ? `+${r.factor_ajuste}%` : '-'}</span>
            ),
        },
        textoColumn<ReglaPresupuesto>('notas', 'notas',
            r => r.notas || '',
            { cellClassName: 'text-[13px] text-slate-500 max-w-xs truncate' }
        ),
    ], [])

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Zap size={24} /> Reglas de Presupuesto
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Clasificación CC/Concepto → tipo de gasto + indicador económico</p>
                </div>
                <button onClick={openCrear}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                    <Plus size={18} /> Nueva Regla
                </button>
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-xl shadow p-4 mb-4">
                <div className="flex items-center gap-3 flex-wrap">
                    <EntitySelector
                        value={filtroCCId ?? ''}
                        onChange={(val) => {
                            setFiltroCCId(val ? Number(val) : null)
                            setFiltroConceptoId(null)
                        }}
                        options={opcionesCC}
                        showAllOption
                        allOptionLabel="Todos los Centros de Costo"
                        placeholder="Centro de Costo..."
                        className="min-w-[220px]"
                    />
                    <EntitySelector
                        value={filtroConceptoId ?? ''}
                        onChange={(val) => setFiltroConceptoId(val ? Number(val) : null)}
                        options={opcionesConcepto}
                        showAllOption
                        allOptionLabel="Todos los Conceptos"
                        placeholder="Concepto..."
                        className="min-w-[220px]"
                    />
                </div>
                {configExclusion.length > 0 && (
                    <div className="flex items-center gap-6 mt-3 pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-2 text-slate-400">
                            <Filter size={14} className="opacity-50" />
                            <span className="text-[9px] font-black uppercase tracking-[0.2em]">Filtros Avanzados</span>
                        </div>
                        <FilterToggles
                            configuracionExclusion={configExclusion}
                            centrosCostosExcluidos={actualExcluidos}
                            onCentrosCostosExcluidosChange={setCentrosCostosExcluidos}
                        />
                    </div>
                )}
            </div>

            <DataTable<ReglaPresupuesto>
                data={reglasFiltered}
                columns={columns}
                loading={isLoading}
                emptyMessage="No hay reglas configuradas"
                getRowKey={(r) => r.id}
                showActions
                onEdit={openEditar}
                onDelete={(r) => handleEliminar(r.id)}
                deleteConfirmMessage="¿Eliminar esta regla?"
                defaultSortKey="centroCosto"
                getRowClassName={(r) => !r.centro_costo_id && !r.concepto_id ? 'bg-blue-50/50' : ''}
            />

            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-2xl">
                        <h2 className="text-lg font-bold mb-4">{editando ? 'Editar' : 'Nueva'} Regla</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* CC / Concepto — primera fila */}
                            <div className="grid grid-cols-2 gap-4">
                                {editando ? (
                                    <>
                                        <div>
                                            <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Centro de Costo</span>
                                            <p className="border rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-700 font-medium">
                                                {editando.centro_costo_nombre || <span className="text-slate-400 italic">Todos (Global)</span>}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Concepto</span>
                                            <p className="border rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-700 font-medium">
                                                {editando.concepto_nombre || <span className="text-slate-400 italic">Todos</span>}
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Centro de Costo</label>
                                            <select value={form.centro_costo_id ?? ''}
                                                onChange={e => setForm({ ...form, centro_costo_id: e.target.value ? Number(e.target.value) : null })}
                                                className="w-full border rounded-lg px-3 py-2 text-sm">
                                                <option value="">Todos (Global)</option>
                                                {centrosCosto.map(cc => (
                                                    <option key={cc.id} value={cc.id}>{cc.nombre}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Concepto</label>
                                            <select value={form.concepto_id ?? ''}
                                                onChange={e => setForm({ ...form, concepto_id: e.target.value ? Number(e.target.value) : null })}
                                                className="w-full border rounded-lg px-3 py-2 text-sm">
                                                <option value="">Todos</option>
                                                {conceptos.map(c => (
                                                    <option key={c.id} value={c.id}>{c.nombre}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className={!usaMontoFijo ? 'grid grid-cols-2 gap-4' : ''}>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Gasto</label>
                                    <select value={form.tipo_gasto}
                                        onChange={e => handleTipoChange(e.target.value)}
                                        className="w-full border rounded-lg px-3 py-2 text-sm">
                                        {tiposGasto.map(t => (
                                            <option key={t.tipo} value={t.tipo}>{t.tipo}</option>
                                        ))}
                                    </select>
                                </div>
                                {!usaMontoFijo && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Indicador</label>
                                        <select value={form.indicador_nombre ?? ''}
                                            onChange={e => setForm({ ...form, indicador_nombre: e.target.value })}
                                            className="w-full border rounded-lg px-3 py-2 text-sm">
                                            {nombresIndicador.map(n => (
                                                <option key={n} value={n}>{n}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                            {usaMontoFijo && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Monto Fijo Mensual ($)</label>
                                        <input type="text" inputMode="numeric"
                                            value={mensualDisplay}
                                            onFocus={handleMensualFocus}
                                            onChange={e => handleMensualChange(e.target.value)}
                                            onBlur={handleMontoBlur}
                                            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="ej: 1.410.000" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Presupuesto Anual ($)</label>
                                        <input type="text" inputMode="numeric"
                                            value={anualDisplay}
                                            onFocus={handleAnualFocus}
                                            onChange={e => handleAnualChange(e.target.value)}
                                            onBlur={handleMontoBlur}
                                            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="ej: 16.920.000" />
                                    </div>
                                </div>
                            )}
                            {!usaMontoFijo && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Factor Ajuste Adicional (%)</label>
                                    <input type="number" step="0.01" value={form.factor_ajuste}
                                        onChange={e => setForm({ ...form, factor_ajuste: Number(e.target.value) })}
                                        className="w-full border rounded-lg px-3 py-2 text-sm" />
                                    <p className="text-xs text-slate-400 mt-1">Porcentaje adicional sobre el indicador. Ej: 2.0 = +2% extra</p>
                                </div>
                            )}
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
