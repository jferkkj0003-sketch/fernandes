import React from 'react';

function textOf(children) {
  return React.Children.toArray(children).map((child) =>
    React.isValidElement(child) ? textOf(child.props.children) : String(child),
  ).join('');
}

// Derive mobile labels from this table's own headers, including conditional
// columns. Desktop and mobile render the same values and action handlers.
export default function ResponsiveTable({ children, className = '', ...props }) {
  const sections = React.Children.toArray(children);
  const head = sections.find((child) => child.type === 'thead');
  const headerRow = React.Children.toArray(head?.props.children).find((child) => child.type === 'tr');
  const labels = React.Children.toArray(headerRow?.props.children).map((cell) => textOf(cell.props.children).trim() || 'Ações');
  const wideLabels = new Set(['MOTORISTA', 'PERÍODO', 'OBSERVAÇÃO', 'AÇÕES']);
  const content = sections.map((section) => {
    if (!React.isValidElement(section) || !['tbody', 'tfoot'].includes(section.type)) return section;
    return React.cloneElement(section, {}, React.Children.toArray(section.props.children).map((row) => {
      if (!React.isValidElement(row) || row.type !== 'tr') return row;
      return React.cloneElement(row, {}, React.Children.toArray(row.props.children).map((cell, index) => {
        if (!React.isValidElement(cell)) return cell;
        const spanning = Number(cell.props.colSpan || 1) > 1;
        const label = cell.type === 'td' && !spanning ? labels[index] : undefined;
        return React.cloneElement(cell, {
          'data-label': label,
          'data-card-wide': spanning || cell.type === 'th' || wideLabels.has(label?.toUpperCase()) ? true : undefined,
        });
      }));
    }));
  });
  return React.createElement('table', { ...props, className: `responsive-table ${className}`.trim() }, content);
}
