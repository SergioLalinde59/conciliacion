import React from 'react';

interface TableHeaderCellProps {
  children: React.ReactNode;
  className?: string;
}

// Este componente atómico asegura que el texto siempre se muestre en Capitalize
export const TableHeaderCell: React.FC<TableHeaderCellProps> = ({ children, className = '' }) => {
  // Convierte el texto a Capitalize si es string
  const formatText = (text: React.ReactNode) => {
    if (typeof text === 'string') {
      return text
        .toLowerCase()
        .replace(/(^|\s|\.|-|_)([a-z])/g, (_m, p1, p2) => p1 + p2.toUpperCase());
    }
    return text;
  };

  return (
    <th
      className={`py-2 px-2 text-[10px] font-bold text-gray-400 capitalize tracking-wide ${className}`}
    >
      {formatText(children)}
    </th>
  );
};
