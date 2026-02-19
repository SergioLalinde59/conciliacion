import { useState, useEffect, useMemo, useRef } from 'react'
import { Save } from 'lucide-react'
import { Modal } from '../../molecules/Modal'
import { MessageModal } from '../../molecules/MessageModal'
import { Button } from '../../atoms/Button'
import { EntitySelector } from '../../molecules/entities/EntitySelector'
import { useTiposGasto } from '../../../hooks/useTiposGasto'
import { useIndicadores } from '../../../hooks/useIndicadores'
import { useQuery } from '@tanstack/react-query'
import { API_BASE_URL, handleResponse } from '../../../services/httpClient'
import { formatMiles, parseMonto } from '../../../utils/formatters'
import { useDetalleMensual } from '../../../hooks/usePresupuesto'
import type { ReglaPresupuesto } from '../../../types/ReglaPresupuesto'

export interface ReglaFormData {
    centro_costo_id: number | null
    concepto_id: number | null
    tipo_gasto: string
    indicador_nombre: string | null
    factor_ajuste: number
    monto_fijo_mensual: number | null
    notas: string | null
    direccion?: string
}

export const INITIAL_REGLA_FORM: ReglaFormData = {
    centro_costo_id: null,
    concepto_id: null,
    tipo_gasto: 'Variable',
    indicador_nombre: 'IPC Colombia',
    factor_ajuste: 0,
    monto_fijo_mensual: null,
    notas: '',
    direccion: 'egreso',
}

interface Props {
    isOpen: boolean
    onClose: () => void
    editando: ReglaPresupuesto | null
    initialForm?: Partial<ReglaFormData>
    onSave: (data: ReglaFormData) => Promise<void>
    direccion?: string
}

export const ReglaPresupuestoModal = ({ isOpen, onClose, editando, initialForm, onSave, direccion }: Props) => {
    const [form, setForm] = useState<ReglaFormData>({ ...INITIAL_REGLA_FORM })
    const [editingMonto, setEditingMonto] = useState<'mensual' | 'anual' | null>(null)
    const [rawMonto, setRawMonto] = useState('')
    const [saving, setSaving] = useState(false)
    const [confirmMessage, setConfirmMessage] = useState<string | null>(null)
    const userEditedMonto = useRef(false)

    // Data queries
    const { data: tiposGasto = [] } = useTiposGasto()
    const { data: indicadores = [] } = useIndicadores()
    const { data: centrosCosto = [] } = useQuery({
        queryKey: ['centros-costo-select'],
        queryFn: () => fetch(`${API_BASE_URL}/api/centros-costos`).then(handleResponse) as Promise<{ id: number; nombre: string }[]>,
        staleTime: 10 * 60 * 1000,
    })
    const { data: conceptos = [] } = useQuery({
        queryKey: ['conceptos-select'],
        queryFn: () => fetch(`${API_BASE_URL}/api/conceptos`).then(handleResponse) as Promise<{ id: number; nombre: string; centro_costo_id?: number }[]>,
        staleTime: 10 * 60 * 1000,
    })

    // Reset form on open
    useEffect(() => {
        if (isOpen) {
            setForm({ ...INITIAL_REGLA_FORM, ...initialForm, direccion: editando?.direccion || initialForm?.direccion || direccion || 'egreso' })
            setEditingMonto(null)
            setRawMonto('')
            setSaving(false)
            userEditedMonto.current = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen])

    // Derived state
    const conceptosForm = useMemo(() =>
        form.centro_costo_id ? conceptos.filter(c => c.centro_costo_id === form.centro_costo_id) : conceptos
    , [conceptos, form.centro_costo_id])

    const indicadorMap = new Map<string, number>()
    indicadores.forEach(i => { if (!indicadorMap.has(i.indicador)) indicadorMap.set(i.indicador, i.valor_porcentaje) })
    const nombresIndicador = [...indicadorMap.keys()]

    const tipoSeleccionado = tiposGasto.find(t => t.tipo === form.tipo_gasto)
    const tieneIndicador = !!tipoSeleccionado?.indicador_default

    const montoAnual = form.monto_fijo_mensual ? form.monto_fijo_mensual * 12 : null
    const mensualDisplay = editingMonto === 'mensual' ? rawMonto : (form.monto_fijo_mensual != null ? formatMiles(form.monto_fijo_mensual) : '')
    const anualDisplay = editingMonto === 'anual' ? rawMonto : (montoAnual != null ? formatMiles(montoAnual) : '')

    // Historical data fetch
    const anioFuente = new Date().getFullYear() - 1
    const { data: detalleMensual, isLoading: loadingHistorico } = useDetalleMensual(
        anioFuente,
        form.centro_costo_id ?? 0,
        form.concepto_id,
        form.direccion || 'egreso'
    )

    const historico = useMemo(() => {
        if (!detalleMensual || detalleMensual.length === 0) return null
        const montoTotal = detalleMensual.reduce((sum: number, d: { monto: number }) => sum + d.monto, 0)
        const mesesActivos = detalleMensual.filter((d: { monto: number }) => d.monto !== 0).length
        return { montoTotal, mesesActivos }
    }, [detalleMensual])

    const sinHistorico = useMemo(() => {
        if (!form.centro_costo_id || !form.concepto_id) return false
        if (loadingHistorico) return false
        return !historico
    }, [form.centro_costo_id, form.concepto_id, loadingHistorico, historico])

    const esNoRep = form.tipo_gasto.includes('No Repetitivo')
    const montoRequerido = sinHistorico && !esNoRep
    const formValido = !montoRequerido || (form.monto_fijo_mensual != null && form.monto_fijo_mensual > 0)

    const proyeccionAnual = useMemo(() => {
        if (!historico || historico.montoTotal === 0) return null
        if (form.tipo_gasto.includes('No Repetitivo')) return 0
        const pct = form.indicador_nombre ? (indicadorMap.get(form.indicador_nombre) || 0) : 0
        return historico.montoTotal * (1 + (pct + form.factor_ajuste) / 100)
    }, [historico, form.tipo_gasto, form.indicador_nombre, form.factor_ajuste, indicadorMap])

    const variacionPct = useMemo(() => {
        if (!historico || !proyeccionAnual || historico.montoTotal === 0) return null
        return Math.round((proyeccionAnual / historico.montoTotal - 1) * 1000) / 10
    }, [historico, proyeccionAnual])

    // Auto-fill monto when historical data loads
    useEffect(() => {
        if (
            historico &&
            proyeccionAnual != null &&
            proyeccionAnual > 0 &&
            form.monto_fijo_mensual == null &&
            !userEditedMonto.current &&
            !form.tipo_gasto.includes('No Repetitivo')
        ) {
            const mensualSugerido = Math.round(proyeccionAnual / 12)
            setForm(prev => ({ ...prev, monto_fijo_mensual: mensualSugerido }))
        }
    }, [historico, proyeccionAnual])

    // Handlers
    const handleDireccionChange = (newDir: string) => {
        if (newDir === form.direccion) return
        const tiposNuevoDir = tiposGasto.filter(t => t.direccion === newDir)
        const primerTipo = tiposNuevoDir[0]
        setForm(prev => ({
            ...prev,
            direccion: newDir,
            tipo_gasto: primerTipo?.tipo || 'Variable',
            indicador_nombre: primerTipo?.indicador_default ?? null,
        }))
        userEditedMonto.current = false
    }

    const handleTipoChange = (tipo: string) => {
        const tipoGasto = tiposGasto.find(t => t.tipo === tipo)
        setForm(prev => ({
            ...prev,
            tipo_gasto: tipo,
            indicador_nombre: tipoGasto?.indicador_default ?? null,
        }))
    }

    const handleMensualFocus = () => { setEditingMonto('mensual'); setRawMonto(form.monto_fijo_mensual != null ? Math.round(form.monto_fijo_mensual).toString() : '') }
    const handleMensualChange = (text: string) => { userEditedMonto.current = true; setRawMonto(text); setForm(prev => ({ ...prev, monto_fijo_mensual: parseMonto(text) })) }
    const handleAnualFocus = () => { setEditingMonto('anual'); setRawMonto(montoAnual != null ? Math.round(montoAnual).toString() : '') }
    const handleAnualChange = (text: string) => { userEditedMonto.current = true; setRawMonto(text); const a = parseMonto(text); setForm(prev => ({ ...prev, monto_fijo_mensual: a ? a / 12 : null })) }
    const handleMontoBlur = () => setEditingMonto(null)

    const handleSubmit = () => {
        if (!formValido) return
        const lines: string[] = []
        lines.push(`Dirección: ${form.direccion === 'ingreso' ? 'Ingreso' : 'Egreso'}`)
        const ccName = form.centro_costo_id
            ? centrosCosto.find(c => c.id === form.centro_costo_id)?.nombre || `ID ${form.centro_costo_id}`
            : 'Todos (Global)'
        lines.push(`Centro de Costo: ${ccName}`)
        const concName = form.concepto_id
            ? conceptos.find(c => c.id === form.concepto_id)?.nombre || `ID ${form.concepto_id}`
            : 'Todos'
        lines.push(`Concepto: ${concName}`)
        lines.push(`Tipo de Gasto: ${form.tipo_gasto}`)
        if (tieneIndicador && form.indicador_nombre) {
            const pct = indicadorMap.get(form.indicador_nombre)
            lines.push(`Indicador: ${form.indicador_nombre} (${pct?.toFixed(1) ?? '?'}%)`)
        }
        if (tieneIndicador && form.factor_ajuste !== 0) {
            lines.push(`Factor Ajuste: ${form.factor_ajuste > 0 ? '+' : ''}${form.factor_ajuste}%`)
        }
        if (form.monto_fijo_mensual != null) {
            lines.push(`Monto Mensual: $${formatMiles(form.monto_fijo_mensual)}`)
            lines.push(`Monto Anual: $${formatMiles(form.monto_fijo_mensual * 12)}`)
        }
        if (form.notas) {
            lines.push(`Notas: ${form.notas}`)
        }
        setConfirmMessage(lines.join('\n'))
    }

    const handleConfirmSave = async () => {
        setConfirmMessage(null)
        setSaving(true)
        try {
            await onSave(form)
        } catch {
            // Error handling is done by the parent via toast/MessageModal
        } finally {
            setSaving(false)
        }
    }

    return (
        <>
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            overlayClassName="z-[60]"
            title={`${editando ? 'Editar' : 'Nueva'} Regla — ${form.direccion === 'ingreso' ? 'Ingresos' : 'Egresos'}`}
            size="xl"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={saving}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} icon={Save} disabled={saving || !formValido} isLoading={saving}>
                        {editando ? 'Guardar' : 'Crear'}
                    </Button>
                </>
            }
        >
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit() }} className="space-y-4">
                {/* Toggle Egreso / Ingreso */}
                <div className="flex gap-1 bg-slate-50 border border-slate-200 p-1 rounded-lg self-start w-fit">
                    {(['egreso', 'ingreso'] as const).map(dir => (
                        <button
                            key={dir}
                            type="button"
                            onClick={() => handleDireccionChange(dir)}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                                form.direccion === dir
                                    ? 'bg-slate-800 text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-white'
                            }`}
                        >
                            {dir === 'egreso' ? 'Egreso' : 'Ingreso'}
                        </button>
                    ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <EntitySelector
                        label="Centro de Costo"
                        value={form.centro_costo_id ?? ''}
                        onChange={v => setForm({ ...form, centro_costo_id: v ? Number(v) : null, concepto_id: null })}
                        options={centrosCosto}
                        placeholder="Todos (Global)"
                        showAllOption
                        allOptionLabel="Todos (Global)"
                    />
                    <EntitySelector
                        label="Concepto"
                        value={form.concepto_id ?? ''}
                        onChange={v => setForm({ ...form, concepto_id: v ? Number(v) : null })}
                        options={conceptosForm}
                        placeholder="Todos"
                        showAllOption
                        allOptionLabel="Todos"
                    />
                </div>
                {form.centro_costo_id && form.concepto_id && (
                    <div className={`rounded-lg px-3 py-2 text-sm ${sinHistorico && !esNoRep ? 'bg-amber-50 border border-amber-300' : 'bg-indigo-50 border border-indigo-200'}`}>
                        {loadingHistorico ? (
                            <span className="text-slate-400 text-xs">Cargando historico...</span>
                        ) : !historico ? (
                            <div>
                                <span className="text-amber-600 text-xs font-medium">Sin historico para {anioFuente}</span>
                                {!esNoRep && (
                                    <p className="text-amber-600 text-[11px] mt-0.5">Se requiere monto fijo mensual para generar presupuesto.</p>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-indigo-600 font-medium">
                                    Historico {anioFuente}:
                                </span>
                                <span className="font-mono text-slate-700">
                                    ${formatMiles(historico.montoTotal)}
                                </span>
                                <span className="text-slate-400 text-xs">
                                    ({historico.mesesActivos} {historico.mesesActivos === 1 ? 'mes' : 'meses'})
                                </span>
                                {proyeccionAnual != null && proyeccionAnual > 0 && !form.tipo_gasto.includes('No Repetitivo') && (
                                    <>
                                        <span className="text-slate-300">&rarr;</span>
                                        <span className="text-indigo-600 font-medium">
                                            Ppto {anioFuente + 1}:
                                        </span>
                                        <span className="font-mono font-semibold text-slate-800">
                                            ${formatMiles(proyeccionAnual)}
                                        </span>
                                        {variacionPct !== null && (
                                            <span className={`text-xs font-medium ${variacionPct > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                ({variacionPct > 0 ? '+' : ''}{variacionPct}%)
                                            </span>
                                        )}
                                    </>
                                )}
                                {form.tipo_gasto.includes('No Repetitivo') && (
                                    <span className="text-xs text-red-400 italic ml-1">No Repetitivo — no suma al presupuesto</span>
                                )}
                            </div>
                        )}
                    </div>
                )}
                <div className={tieneIndicador ? 'grid grid-cols-2 gap-4' : ''}>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Gasto</label>
                        <select value={form.tipo_gasto}
                            onChange={e => handleTipoChange(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm">
                            {tiposGasto.filter(t => t.direccion === (form.direccion || 'egreso')).map(t => (
                                <option key={t.tipo} value={t.tipo}>{t.tipo}</option>
                            ))}
                        </select>
                    </div>
                    {tieneIndicador && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Indicador</label>
                            <select value={form.indicador_nombre ?? ''}
                                onChange={e => setForm({ ...form, indicador_nombre: e.target.value })}
                                className="w-full border rounded-lg px-3 py-2 text-sm">
                                {nombresIndicador.map(n => (
                                    <option key={n} value={n}>{n} — {indicadorMap.get(n)?.toFixed(1)}%</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
                {tieneIndicador && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Factor Ajuste Adicional (%)</label>
                        <input type="number" step="0.01" value={form.factor_ajuste}
                            onChange={e => setForm({ ...form, factor_ajuste: Number(e.target.value) })}
                            className="w-full border rounded-lg px-3 py-2 text-sm" />
                        <p className="text-xs text-slate-400 mt-1">Porcentaje adicional sobre el indicador. Ej: 2.0 = +2% extra</p>
                    </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${montoRequerido ? 'text-amber-700' : 'text-slate-700'}`}>
                            Valor Mensual ($) {montoRequerido && <span className="text-rose-500">*</span>}
                        </label>
                        <input type="text" inputMode="numeric"
                            value={mensualDisplay}
                            onFocus={handleMensualFocus}
                            onChange={e => handleMensualChange(e.target.value)}
                            onBlur={handleMontoBlur}
                            className={`w-full border rounded-lg px-3 py-2 text-sm text-right ${montoRequerido && !form.monto_fijo_mensual ? 'border-amber-400 ring-1 ring-amber-200' : ''}`}
                            placeholder={montoRequerido ? 'Requerido' : (tieneIndicador ? 'Opcional (override)' : 'ej: 1.410.000')} />
                    </div>
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${montoRequerido ? 'text-amber-700' : 'text-slate-700'}`}>
                            Presupuesto Anual ($) {montoRequerido && <span className="text-rose-500">*</span>}
                        </label>
                        <input type="text" inputMode="numeric"
                            value={anualDisplay}
                            onFocus={handleAnualFocus}
                            onChange={e => handleAnualChange(e.target.value)}
                            onBlur={handleMontoBlur}
                            className={`w-full border rounded-lg px-3 py-2 text-sm text-right ${montoRequerido && !form.monto_fijo_mensual ? 'border-amber-400 ring-1 ring-amber-200' : ''}`}
                            placeholder={montoRequerido ? 'Requerido' : (tieneIndicador ? 'Opcional (override)' : 'ej: 16.920.000')} />
                    </div>
                    {montoRequerido && (
                        <p className="col-span-2 text-xs text-amber-600 -mt-2 font-medium">Sin datos del {anioFuente}, el monto fijo es obligatorio para generar presupuesto.</p>
                    )}
                    {tieneIndicador && !montoRequerido && (
                        <p className="col-span-2 text-xs text-slate-400 -mt-2">Si se ingresa un monto, se usa como valor fijo en lugar de la fórmula del indicador</p>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
                    <input value={form.notas || ''} onChange={e => setForm({ ...form, notas: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Opcional" />
                </div>
            </form>
        </Modal>
        <MessageModal
            message={confirmMessage}
            type="confirm"
            title={editando ? 'Confirmar Cambios' : 'Confirmar Nueva Regla'}
            onClose={() => setConfirmMessage(null)}
            onConfirm={handleConfirmSave}
            confirmLabel={editando ? 'Guardar' : 'Crear'}
            cancelLabel="Volver"
        />
        </>
    )
}
