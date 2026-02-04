import { ChevronUp, ChevronDown } from 'lucide-react';

// Fallback icon for sort (doble flecha)
function ChevronUpDown({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M10 4L6 8H14L10 4Z" fill="currentColor"/>
      <path d="M10 16L14 12H6L10 16Z" fill="currentColor"/>
    </svg>
  );
}

export interface DataTableSortIconProps {
  active: boolean;
  direction?: 'asc' | 'desc' | null;
  size?: number;
}

export function DataTableSortIcon({ active, direction, size = 14 }: DataTableSortIconProps) {
  if (!active) return <ChevronUpDown size={size} className="text-gray-300" />;
  if (direction === 'asc') return <ChevronUp size={size} className="text-blue-600" />;
  return <ChevronDown size={size} className="text-blue-600" />;
}
