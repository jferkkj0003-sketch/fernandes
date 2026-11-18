import React from 'react';
import { BadgeDollarSign } from 'lucide-react';

export const driverColors = ['#2365ab', '#127864', '#6651a2', '#a46a29', '#a04572', '#247c91'];
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function DriverValueChart({ rows, periodLabel, colorFor, title = 'Valor por motorista' }) {
  const sorted = [...rows].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  const largest = Math.max(0, ...sorted.map((row) => Math.abs(row.amount)));

  return <section className="fd-card fd-glass-chart" aria-label={title}>
    <h2 className="fd-h2"><BadgeDollarSign size={20} /> {title} <small>({periodLabel})</small></h2>
    <ul className="fd-hbars">
      {sorted.map((row, index) => <li key={row.key} className="fd-hbar">
        <span className="n" title={row.name}>{row.name}</span>
        <div className="track" aria-hidden="true"><i style={{
          width: largest ? (Math.abs(row.amount) / largest * 100) + '%' : '0%',
          '--bar-color': colorFor?.(row.key) || driverColors[index % driverColors.length],
        }} /></div>
        <b>{money.format(row.amount)}</b>
      </li>)}
    </ul>
    {!sorted.length && <p className="empty-state">Nenhum valor para os filtros selecionados.</p>}
  </section>;
}
