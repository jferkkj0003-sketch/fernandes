import React from 'react';
import { ChartPie } from 'lucide-react';
import DriverValueChart, { driverColors } from './DriverValueChart';

const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });

function WeightDonut({ rows, formatWeight, periodLabel, colorFor }) {
  const ordered = rows.filter((row) => Number(row.weight) > 0)
    .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name, 'pt-BR'));
  const total = ordered.reduce((sum, row) => sum + Number(row.weight), 0);
  const missingWeight = rows.some((row) => row.weight == null);
  let position = 0;
  const segments = ordered.map((row, index) => {
    const share = row.weight / total;
    const start = position;
    position += share * 100;
    return { ...row, share, start, end: position, color: colorFor?.(row.key) || driverColors[index % driverColors.length] };
  });
  const gradient = segments.map((part) => part.color + ' ' + part.start + '% ' + part.end + '%').join(', ');

  return <section className="fd-card fd-glass-chart" aria-label="Peso por motorista">
    <h2 className="fd-h2"><ChartPie size={20} /> Peso por motorista <small>({periodLabel})</small></h2>
    {segments.length ? <div className="fx-weight-chart">
      <div className="fx-weight-ring" style={{ background: 'conic-gradient(' + gradient + ')' }}>
        <div><strong>{formatWeight(total)}</strong><small>{missingWeight ? 'Peso informado' : 'Peso total'}</small></div>
      </div>
      <ul className="fx-weight-legend">
        {segments.map((part) => <li key={part.key}>
          <i aria-hidden="true" style={{ backgroundColor: part.color }} />
          <span>{part.name}<small>{percent.format(part.share)} do peso</small></span>
          <strong>{formatWeight(part.weight)}</strong>
        </li>)}
      </ul>
    </div> : <p className="empty-state">Nenhum peso informado para os filtros selecionados.</p>}
  </section>;
}

export default function FreightCharts({ rows, periodLabel, formatWeight, colorFor, valueTitle }) {
  const keys = [...rows].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map((row) => row.key);
  const chartColor = colorFor || ((key) => driverColors[keys.indexOf(key) % driverColors.length]);
  return <div className="freight-charts">
    <DriverValueChart rows={rows} periodLabel={periodLabel} colorFor={chartColor} title={valueTitle} />
    <WeightDonut rows={rows} periodLabel={periodLabel} formatWeight={formatWeight} colorFor={chartColor} />
  </div>;
}
