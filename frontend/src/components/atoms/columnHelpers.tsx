import React from 'react';
import type { Column } from '../molecules/DataTable';
import { CurrencyDisplay } from './CurrencyDisplay';
import type { CurrencyType } from './CurrencyDisplay';

// --- Estilos centralizados para columnas DataTable ---
const FONT_CIFRA = 'font-mono text-sm font-bold';
const FONT_MONEDA = 'font-mono text-sm font-bold';
const FONT_ID = 'font-mono text-[11px] text-gray-400';
const FONT_TEXTO = 'text-[13px] text-gray-600';
const FONT_FECHA = 'text-[13px] text-gray-500';
const FONT_ENUM = 'text-[13px] text-gray-500';

// Átomo para columnas de cifras genéricas (números, montos, etc.)
interface CifraColumnOptions<T> extends Partial<Column<T>> {
  colorize?: boolean;
  decimals?: number;
}

export function cifraColumn<T>(
  key: string,
  header: React.ReactNode,
  getValue: (row: T) => number,
  options: CifraColumnOptions<T> = {}
): Column<T> {
  const { colorize = true, decimals, ...columnOptions } = options;
  return {
    key,
    header,
    sortable: true,
    sortValue: getValue,
    align: 'right',
    cellClassName: FONT_CIFRA,
    ...columnOptions,
    accessor: (row: T) => {
      const val = getValue(row);
      const formatted = val.toLocaleString('es-CO', {
        minimumFractionDigits: decimals ?? 0,
        maximumFractionDigits: decimals ?? 0,
      });
      const zeroOverride = val === 0 ? ' font-normal' : '';
      if (!colorize) return <span className={zeroOverride.trim() || undefined}>{formatted}</span>;
      const colorClass = val > 0 ? 'text-emerald-500' : val < 0 ? 'text-rose-500' : 'text-blue-500';
      return <span className={`${colorClass}${zeroOverride}`}>{formatted}</span>;
    },
  };
}

// Átomo para columnas de moneda (COP, USD, etc.)
interface MonedaColumnOptions<T> extends Partial<Column<T>> {
  decimals?: number;
  colorize?: boolean;
}

export function monedaColumn<T>(
  key: string,
  header: React.ReactNode,
  getValue: (row: T) => number,
  currency: string | ((row: T) => string) = 'COP',
  options: MonedaColumnOptions<T> = {}
): Column<T> {
  const { decimals, colorize = true, ...columnOptions } = options;
  return {
    key,
    header,
    sortable: true,
    sortValue: getValue,
    align: 'right',
    cellClassName: FONT_MONEDA,
    ...columnOptions,
    accessor: (row: T) => {
      const value = getValue(row);
      const cur = typeof currency === 'function' ? currency(row) : currency;
      return <CurrencyDisplay value={value} currency={cur as CurrencyType} colorize={colorize} decimals={decimals} className={value === 0 ? 'font-normal' : ''} />;
    },
  };
}

// Átomo para columnas de texto
export function textoColumn<T>(
  key: string,
  header: React.ReactNode,
  getValue: (row: T) => string,
  options: Partial<Column<T>> = {}
): Column<T> {
  return {
    key,
    header,
    sortable: true,
    sortValue: getValue,
    align: 'left',
    cellClassName: FONT_TEXTO,
    ...options,
    accessor: (row: T) => <span>{getValue(row)}</span>,
  };
}

// Átomo para columnas de ID
export function idColumn<T>(
  key: string,
  header: React.ReactNode,
  getValue: (row: T) => string | number,
  options: Partial<Column<T>> = {}
): Column<T> {
  return {
    key,
    header,
    sortable: true,
    sortValue: getValue,
    align: 'center',
    cellClassName: FONT_ID,
    ...options,
    accessor: (row: T) => <span>{getValue(row)}</span>,
  };
}

// Átomo para columnas de fechas (acepta string o Date)
export function fechaColumn<T>(
  key: string,
  header: React.ReactNode,
  getValue: (row: T) => string | Date,
  options: Partial<Column<T>> = {}
): Column<T> {
  return {
    key,
    header,
    sortable: true,
    sortValue: (row) => new Date(getValue(row)).getTime(),
    align: 'left',
    cellClassName: FONT_FECHA,
    ...options,
    accessor: (row: T) => {
      const date = new Date(getValue(row));
      return <span>{date.toLocaleDateString('es-CO')}</span>;
    },
  };
}

// Átomo para columnas de porcentaje
export function porcentajeColumn<T>(
  key: string,
  header: React.ReactNode,
  getValue: (row: T) => number,
  options: Partial<Column<T>> = {}
): Column<T> {
  return {
    key,
    header,
    sortable: true,
    sortValue: getValue,
    align: 'right',
    cellClassName: FONT_ENUM,
    ...options,
    accessor: (row: T) => (
      <span>{getValue(row).toLocaleString('es-CO', { style: 'percent', minimumFractionDigits: 2 })}</span>
    ),
  };
}

// Átomo para columnas booleanas (sí/no)
export function booleanColumn<T>(
  key: string,
  header: React.ReactNode,
  getValue: (row: T) => boolean,
  options: Partial<Column<T>> = {}
): Column<T> {
  return {
    key,
    header,
    sortable: true,
    sortValue: (row) => getValue(row) ? 1 : 0,
    align: 'center',
    cellClassName: FONT_ENUM,
    ...options,
    accessor: (row: T) => (
      <span>{getValue(row) ? 'Sí' : 'No'}</span>
    ),
  };
}

// Átomo para columnas de enums/catálogos
export function enumColumn<T>(
  key: string,
  header: React.ReactNode,
  getValue: (row: T) => string,
  options: Partial<Column<T>> = {}
): Column<T> {
  return {
    key,
    header,
    sortable: true,
    sortValue: getValue,
    align: 'left',
    cellClassName: FONT_ENUM,
    ...options,
    accessor: (row: T) => <span>{getValue(row)}</span>,
  };
}

// Átomo para columna de selección con checkbox
export function selectionColumn<T>(
  isSelected: (row: T) => boolean,
  onRowSelect: (row: T, checked: boolean) => void,
  headerSelected: boolean,
  onHeaderSelect: (checked: boolean) => void
): Column<T> {
  return {
    key: '__selection__',
    header: (
      <input
        type="checkbox"
        checked={headerSelected}
        onChange={(e) => onHeaderSelect(e.target.checked)}
        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
      />
    ),
    width: 'w-10',
    align: 'center',
    sortable: false,
    accessor: (row: T) => (
      <input
        type="checkbox"
        checked={isSelected(row)}
        onChange={(e) => onRowSelect(row, e.target.checked)}
        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
      />
    ),
  };
}

/**
 * Resumen de átomos recomendados:
 *
 * 1. cifraColumn: Para montos, cantidades, totales, etc. (sort numérico, formato local)
 * 2. monedaColumn: Para cifras con formato de moneda (COP, USD, etc.)
 * 3. textoColumn: Para campos de texto simples (sort alfabético)
 * 4. fechaColumn: Para fechas (sort por timestamp, visualización localizable)
 * 5. porcentajeColumn: Para porcentajes (sort numérico, formato %)
 * 6. booleanColumn: Para sí/no, switches, etc. (sort por valor booleano)
 * 7. enumColumn: Para catálogos, selects, etc. (sort por valor o label)
 */
