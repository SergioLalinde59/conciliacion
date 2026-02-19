
export const formatCurrency = (value: number | string | undefined | null, showDecimals: boolean = false): string => {
    if (value === undefined || value === null) return "$ 0";

    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(numValue)) return "$ 0";

    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: showDecimals ? 2 : 0,
        maximumFractionDigits: showDecimals ? 2 : 0,
    }).format(numValue);
};

export const formatCompact = (n: number): string => {
    const sign = n < 0 ? '-' : ''
    const abs = Math.abs(n)
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`
    return `${sign}$${Math.round(abs)}`
}

export const formatMiles = (value: number | null): string => {
    if (value == null) return ''
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Math.round(value))
}

export const parseMonto = (text: string): number | null => {
    const cleaned = text.replace(/[^\d]/g, '')
    return cleaned ? Number(cleaned) : null
}

export const getAmountColorClass = (value: number | string | undefined | null): string => {
    if (value === undefined || value === null) return "text-gray-900";
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return "text-gray-900";

    if (numValue > 0) return "text-emerald-600";
    if (numValue < 0) return "text-rose-600";
    return "text-blue-600";
};
