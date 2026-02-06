import React from 'react'
import { CheckCircle, TrendingUp, TrendingDown, FileText, AlertCircle } from 'lucide-react'

export interface LoadResult {
    archivo: string
    total_extraidos: number
    nuevos_insertados: number
    actualizados: number
    duplicados: number
    errores: number
    detalle_errores?: Array<{ fecha: string, descripcion: string, valor: string, error: string }>
    periodo: string
    total_ingresos: number
    total_egresos: number
    total_ingresos_usd: number
    total_egresos_usd: number
    // Desglose por categoría COP
    ingresos_cargados?: number
    egresos_cargados?: number
    ingresos_duplicados?: number
    egresos_duplicados?: number
    ingresos_errores?: number
    egresos_errores?: number
    // Desglose por categoría USD
    ingresos_cargados_usd?: number
    egresos_cargados_usd?: number
    ingresos_duplicados_usd?: number
    egresos_duplicados_usd?: number
    ingresos_errores_usd?: number
    egresos_errores_usd?: number
}

interface LoadResultSummaryProps {
    result: LoadResult
    tipoCuenta: string
    cuentaId: number | null
}

export const LoadResultSummary: React.FC<LoadResultSummaryProps> = ({ result, tipoCuenta, cuentaId }) => {
    const formatCurrency = (value: number, currency: 'COP' | 'USD') => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: currency,
            maximumFractionDigits: 0
        }).format(value)
    }

    // Usar datos desglosados si existen, sino fallback a totales en cargados
    const ingresosCargados = result.ingresos_cargados ?? result.total_ingresos
    const egresosCargados = result.egresos_cargados ?? result.total_egresos
    const ingresosErrores = result.ingresos_errores ?? 0
    const egresosErrores = result.egresos_errores ?? 0
    const ingresosDuplicados = result.ingresos_duplicados ?? 0
    const egresosDuplicados = result.egresos_duplicados ?? 0

    const ingresosCargadosUsd = result.ingresos_cargados_usd ?? result.total_ingresos_usd
    const egresosCargadosUsd = result.egresos_cargados_usd ?? result.total_egresos_usd
    const ingresosErroresUsd = result.ingresos_errores_usd ?? 0
    const egresosErroresUsd = result.egresos_errores_usd ?? 0
    const ingresosDuplicadosUsd = result.ingresos_duplicados_usd ?? 0
    const egresosDuplicadosUsd = result.egresos_duplicados_usd ?? 0

    const hasCopStats = result.total_ingresos !== 0 || result.total_egresos !== 0
    const hasUsdStats = result.total_ingresos_usd !== 0 || result.total_egresos_usd !== 0

    // Componente para renderizar una categoría con sus stats
    const CategoryCard = ({
        label,
        count,
        ingresos,
        egresos,
        currency,
        isError = false
    }: {
        label: string
        count: number
        ingresos: number
        egresos: number
        currency: 'COP' | 'USD'
        isError?: boolean
    }) => {
        const bgClass = isError && count > 0 ? 'bg-red-50' : 'bg-gray-50'
        const labelClass = isError && count > 0 ? 'text-red-500' : 'text-gray-400'
        const countClass = isError && count > 0 ? 'text-red-600' : 'text-gray-700'

        return (
            <div className={`${bgClass} rounded-lg p-3 space-y-2`}>
                <div className="text-center">
                    <span className={`block text-xs ${labelClass} mb-1`}>{label}</span>
                    <span className={`text-lg font-bold ${countClass}`}>{count}</span>
                </div>
                {(ingresos !== 0 || egresos !== 0) && (
                    <div className="border-t border-gray-200 pt-2 space-y-1">
                        <div className="flex justify-between items-center text-[11px]">
                            <span className="text-gray-400 flex items-center gap-0.5">
                                <TrendingUp size={10} />
                            </span>
                            <span className="font-semibold text-green-600">
                                {formatCurrency(ingresos, currency)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                            <span className="text-gray-400 flex items-center gap-0.5">
                                <TrendingDown size={10} />
                            </span>
                            <span className="font-semibold text-red-600">
                                {formatCurrency(egresos, currency)}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-8 py-2">

            {/* Header Section */}
            <div className="text-center space-y-2">
                <div className="flex justify-center mb-4">
                    <div className="bg-green-50 p-4 rounded-full ring-8 ring-green-50/50">
                        <CheckCircle className="h-10 w-10 text-green-600" strokeWidth={1.5} />
                    </div>
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Carga Exitosa</h3>
                    <p className="text-sm text-gray-500 font-medium">{tipoCuenta} {cuentaId ? `(${cuentaId})` : ''}</p>
                    <p className="text-sm text-gray-400 mt-1">{result.periodo}</p>
                </div>
            </div>

            {/* Stats Grid - COP */}
            {hasCopStats && (
                <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">
                        Movimientos en Pesos (COP)
                    </h4>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <CategoryCard
                            label="Cargados"
                            count={result.nuevos_insertados}
                            ingresos={ingresosCargados}
                            egresos={egresosCargados}
                            currency="COP"
                        />
                        <CategoryCard
                            label="Errores"
                            count={result.errores}
                            ingresos={ingresosErrores}
                            egresos={egresosErrores}
                            currency="COP"
                            isError
                        />
                        <CategoryCard
                            label="Duplicados"
                            count={result.duplicados}
                            ingresos={ingresosDuplicados}
                            egresos={egresosDuplicados}
                            currency="COP"
                        />
                    </div>
                </div>
            )}

            {/* Stats Grid - USD */}
            {hasUsdStats && (
                <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">
                        Movimientos en Dólares (USD)
                    </h4>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <CategoryCard
                            label="Cargados"
                            count={result.nuevos_insertados}
                            ingresos={ingresosCargadosUsd}
                            egresos={egresosCargadosUsd}
                            currency="USD"
                        />
                        <CategoryCard
                            label="Errores"
                            count={result.errores}
                            ingresos={ingresosErroresUsd}
                            egresos={egresosErroresUsd}
                            currency="USD"
                            isError
                        />
                        <CategoryCard
                            label="Duplicados"
                            count={result.duplicados}
                            ingresos={ingresosDuplicadosUsd}
                            egresos={egresosDuplicadosUsd}
                            currency="USD"
                        />
                    </div>
                </div>
            )}

            {/* Si no hay stats financieras, mostrar solo las cantidades */}
            {!hasCopStats && !hasUsdStats && (
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-gray-50 rounded-lg p-3">
                        <span className="block text-gray-400 mb-1">Cargados</span>
                        <span className="text-base font-semibold text-gray-700">{result.nuevos_insertados}</span>
                    </div>
                    {result.errores > 0 ? (
                        <div className="bg-red-50 rounded-lg p-3">
                            <span className="block text-red-400 mb-1">Errores</span>
                            <span className="text-base font-semibold text-red-600">{result.errores}</span>
                        </div>
                    ) : (
                        <div className="bg-gray-50 rounded-lg p-3">
                            <span className="block text-gray-400 mb-1">Errores</span>
                            <span className="text-base font-semibold text-gray-700">0</span>
                        </div>
                    )}
                    <div className="bg-gray-50 rounded-lg p-3">
                        <span className="block text-gray-400 mb-1">Duplicados</span>
                        <span className="text-base font-semibold text-gray-700">{result.duplicados}</span>
                    </div>
                </div>
            )}

            {/* Detalle de Errores */}
            {result.detalle_errores && result.detalle_errores.length > 0 && (
                <div className="bg-red-50 rounded-xl border border-red-100 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                        <AlertCircle size={14} className="text-red-500" />
                        <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Errores al insertar</span>
                    </div>
                    {result.detalle_errores.map((err, i) => (
                        <div key={i} className="bg-white rounded-lg border border-red-100 p-3 space-y-1">
                            <div className="flex justify-between items-baseline">
                                <span className="text-xs font-semibold text-slate-700">{err.descripcion}</span>
                                <span className="text-xs font-bold text-red-600">{err.valor}</span>
                            </div>
                            <span className="text-[10px] text-slate-400">{err.fecha}</span>
                            <p className="text-[11px] text-red-600 font-medium">{err.error}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Totals */}
            <div className="text-center pt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                    <FileText size={12} />
                    Total Leídos: {result.total_extraidos}
                </span>
            </div>

        </div>
    )
}
