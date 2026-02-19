/**
 * CurrencyDisplay - Componente atómico para mostrar valores monetarios
 * 
 * Soporta COP, USD y TRM con formato apropiado para cada moneda.
 * Aplica colorización automática basada en el valor.
 */

import React from 'react'

export type CurrencyType = 'COP' | 'USD' | 'TRM'

interface CurrencyDisplayProps {
    value: number
    className?: string
    /** Tipo de moneda: COP, USD o TRM */
    currency?: CurrencyType
    /** Si se debe mostrar el símbolo de moneda */
    showSymbol?: boolean
    /** @deprecated Use showSymbol instead */
    showCurrency?: boolean
    /** Si se debe aplicar colorización automática */
    colorize?: boolean
    /** Si se debe mostrar signo + para positivos */
    showPlusSign?: boolean
    /** Número de decimales a mostrar. Si se omite, usa el valor por defecto de la moneda. */
    decimals?: number
    /** Justificar a la derecha. Por defecto true cuando colorize es true */
    alignRight?: boolean
    /** Mostrar en formato compacto: $1.5M, $150K */
    compact?: boolean
}

/**
 * Opciones de formato para cada moneda
 */
const CURRENCY_CONFIG: Record<CurrencyType, { locale: string, options: Intl.NumberFormatOptions }> = {
    COP: {
        locale: 'es-CO',
        options: { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 2 }
    },
    USD: {
        locale: 'en-US', // Usa punto para decimales como solicitado
        options: { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }
    },
    TRM: {
        locale: 'es-CO', // Usa punto miles y coma decimales
        options: { style: 'currency', currency: 'COP', minimumFractionDigits: 2, maximumFractionDigits: 2 } // "COP" para formato pesos pero con decimales
    }
}

/**
 * Función utilitaria para formatear moneda (usar fuera de componentes React)
 * 
 * @example
 * formatCurrency(150000) // "$150.000"
 * formatCurrency(50.25, 'USD') // "$50.25"
 * formatCurrency(100000, 'COP', false) // "100.000"
 */
export const formatCurrency = (
    value: number,
    currency: CurrencyType = 'COP',
    showSymbol: boolean = true,
    decimals?: number
): string => {
    const config = CURRENCY_CONFIG[currency]
    const numValue = Number(value)

    const formatOptions = {
        ...config.options,
        minimumFractionDigits: decimals !== undefined ? decimals : config.options.minimumFractionDigits,
        maximumFractionDigits: decimals !== undefined ? decimals : config.options.maximumFractionDigits
    }

    // Para TRM, si no mostramos símbolo, formateamos como número
    // Para evitar que salga COP 4.000,00 si el style es currency
    if (!showSymbol) {
        return numValue.toLocaleString(config.locale, {
            minimumFractionDigits: formatOptions.minimumFractionDigits,
            maximumFractionDigits: formatOptions.maximumFractionDigits
        })
    }

    return new Intl.NumberFormat(config.locale, formatOptions).format(numValue)
}

/**
 * Función para obtener solo el número formateado sin símbolo
 */
export const formatNumber = (value: number, decimals: number = 0): string => {
    return Number(value).toLocaleString('es-CO', {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals
    })
}

/**
 * Obtiene la clase de color basada en el valor
 */
export const getNumberColorClass = (value: number): string => {
    if (value > 0) return 'text-emerald-600'
    if (value < 0) return 'text-red-600'
    return 'text-blue-600'
}

/**
 * Hook para formatear moneda respetando el setting de decimales del sidebar.
 * Usar en componentes donde no se puede usar <CurrencyDisplay> (ej: tooltips de gráficos).
 *
 * @example
 * const fmt = useFormatCurrency()
 * fmt(150000)        // "$150.000" o "$150.000,00" según setting
 * fmt(50.25, 'USD')  // "$50.25"
 */
import { useSettings } from '../../context/SettingsContext'
import { getAmountColorClass, formatCompact } from '../../utils/formatters'

export const useFormatCurrency = () => {
    const { showDecimals } = useSettings()
    return (value: number, currency: CurrencyType = 'COP', showSymbol: boolean = true) => {
        const effectiveDecimals = showDecimals ? 2 : 0
        return formatCurrency(value, currency, showSymbol, effectiveDecimals)
    }
}

/**
 * Hook para formatear valores de presupuesto respetando el toggle "Cifras (mm)".
 * Cuando está activado, usa formato compacto ($1.5M, $150K).
 * Cuando está desactivado, usa formato completo ($1.500.000).
 */
export const useBudgetFormat = () => {
    const { cifrasEnMillones, showDecimals } = useSettings()
    return (value: number): string => {
        if (cifrasEnMillones) return formatCompact(value)
        return formatCurrency(value, 'COP', true, showDecimals ? 2 : 0)
    }
}

/**
 * Componente CurrencyDisplay
 *
 * @example
 * // COP básico
 * <CurrencyDisplay value={150000} />
 *
 * @example
 * // USD con colorización
 * <CurrencyDisplay value={-50.25} currency="USD" />
 *
 * @example
 * // Sin símbolo, sin colorización
 * <CurrencyDisplay value={100000} showSymbol={false} colorize={false} />
 */

export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({
    value,
    className = '',
    currency = 'COP',
    showSymbol,
    showCurrency, // deprecated alias for showSymbol
    colorize = true,
    showPlusSign = false,
    decimals,
    alignRight,
    compact = false
}) => {
    const { showDecimals } = useSettings();

    // Support deprecated showCurrency prop
    const shouldShowSymbol = showSymbol ?? showCurrency ?? true

    // Determinar el color basado en el valor
    const colorClass = colorize ? getAmountColorClass(value) : ''

    // Alinear a la derecha por defecto cuando colorize está activo
    const shouldAlignRight = alignRight ?? colorize
    const alignClass = shouldAlignRight ? 'block w-full text-right' : ''

    // Modo compacto: usar formatCompact ($1.5M, $150K)
    if (compact) {
        const compactValue = formatCompact(Math.abs(value))
        const displayValue = value < 0 ? `-${compactValue}` : (showPlusSign && value > 0 ? `+${compactValue}` : compactValue)
        return (
            <span className={`${colorClass} ${alignClass} ${className}`.trim()}>
                {displayValue}
            </span>
        )
    }

    // Determine decimal places
    let effectiveDecimals = decimals;
    if (effectiveDecimals === undefined) {
        effectiveDecimals = showDecimals ? 2 : 0;
    }

    const config = CURRENCY_CONFIG[currency]
    const numValue = Number(value)

    const formatOptions = {
        ...config.options,
        minimumFractionDigits: effectiveDecimals,
        maximumFractionDigits: effectiveDecimals
    }

    let formattedValue = '';

    // Para TRM, si no mostramos símbolo, formateamos como número
    if (!shouldShowSymbol) {
        formattedValue = numValue.toLocaleString(config.locale, {
            minimumFractionDigits: formatOptions.minimumFractionDigits,
            maximumFractionDigits: formatOptions.maximumFractionDigits
        })
    } else {
        formattedValue = new Intl.NumberFormat(config.locale, formatOptions).format(numValue)
    }

    // Agregar signo + si es positivo y está habilitado
    const displayValue = showPlusSign && value > 0
        ? `+${formattedValue}`
        : formattedValue

    return (
        <span className={`${colorClass} ${alignClass} ${className}`.trim()}>
            {displayValue}
        </span>
    )
}

