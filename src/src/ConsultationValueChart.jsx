import React, { useId, useState } from 'react';
import { ChartLine, ChartPie } from 'lucide-react';
import { overviewSeries, stepGeometry } from './lib/overview-charts';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const compactMoney = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1,
});
const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
const colors = ['#5b95ff', '#26bca2', '#a287fa', '#f0ae55', '#ec81aa', '#62beda', '#d4c759', '#e48769'];
const shortDate = (date) => date.slice(5).split('-').reverse().join('/');
const fullDate = (date) => date.split('-').reverse().join('/');

function ValueLine({ rows, period, driver, title, periodLabel }) {
  const fillId = useId();
  const [selectedDate, setSelectedDate] = useState('');
  const series = overviewSeries(rows, period, driver);
  const { points, min, max, y } = stepGeometry(series, 'cumulativeAmount');
  const selected = points.find((point) => point.date === selectedDate) || points.at(-1);
  const first = points[0];
  const last = points.at(-1);
  const positions = points.map((point) => point.x + ',' + point.y).join(' ');
  const tickIndices = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  const mid = (min + max) / 2;

  return <section className="fx-card fx-chart-card" aria-label={title}>
    <h2 className="fx-h2"><ChartLine size={20} /> {title} <small>({periodLabel})</small></h2>
    {selected ? <>
      <div className="fx-line-readout">
        <strong>{money.format(selected.cumulativeAmount)}</strong>
        <small>Acumulado até {fullDate(selected.date)}</small>
      </div>
      <svg className="fx-value-line" viewBox="0 0 620 250" role="img"
        aria-label={title + ' por data. Total ' + money.format(last.cumulativeAmount)}>
        <defs><linearGradient id={fillId} x2="0" y2="1">
          <stop stopColor="currentColor" stopOpacity=".24" />
          <stop offset="100%" stopColor="currentColor" stopOpacity=".01" />
        </linearGradient></defs>
        {[min, mid, max].map((tick) => <g key={tick} className="fx-chart-axis">
          <line x1="65" x2="590" y1={y(tick)} y2={y(tick)} />
          <text x="57" y={y(tick) + 5} textAnchor="end">{compactMoney.format(tick)}</text>
        </g>)}
        {points.length > 1 && <>
          <polygon points={first.x + ',' + y(0) + ' ' + positions + ' ' + last.x + ',' + y(0)} fill={'url(#' + fillId + ')'} />
          <polyline points={positions} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        </>}
        {tickIndices.map((index) => <text className="fx-chart-date" key={index} x={points[index].x} y="238" textAnchor="middle">{shortDate(points[index].date)}</text>)}
        {points.map((point) => <circle className="fx-chart-point" key={point.date}
          cx={point.x} cy={point.y} r={point.date === selected.date ? 6 : 4}
          tabIndex={0} onFocus={() => setSelectedDate(point.date)}
          onPointerEnter={() => setSelectedDate(point.date)} onClick={() => setSelectedDate(point.date)}>
          <title>{fullDate(point.date)} · {money.format(point.cumulativeAmount)}</title>
        </circle>)}
      </svg>
    </> : <p className="fx-empty">Nenhum valor para os filtros selecionados.</p>}
  </section>;
}

function WeightDonut({ rows, formatWeight, periodLabel }) {
  const ordered = rows.filter((row) => Number(row.weight) > 0)
    .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name, 'pt-BR'));
  const total = ordered.reduce((sum, row) => sum + Number(row.weight), 0);
  const missingWeight = rows.some((row) => row.weight == null);
  let position = 0;
  const segments = ordered.map((row, index) => {
    const share = row.weight / total;
    const start = position;
    position += share * 100;
    return { ...row, share, start, end: position, color: colors[index % colors.length] };
  });
  const gradient = segments.map((part) => part.color + ' ' + part.start + '% ' + part.end + '%').join(', ');

  return <section className="fx-card fx-chart-card" aria-label="Peso por motorista">
    <h2 className="fx-h2"><ChartPie size={20} /> Peso por motorista <small>({periodLabel})</small></h2>
    {segments.length ? <div className="fx-weight-chart">
      <div className="fx-weight-ring" style={{ background: 'conic-gradient(' + gradient + ')' }}>
        <div><strong>{formatWeight(total)}</strong><small>{missingWeight ? 'Peso informado' : 'Peso total'}</small></div>
      </div>
      <ul className="fx-weight-legend">
        {segments.map((part) => <li key={part.name}>
          <i aria-hidden="true" style={{ backgroundColor: part.color }} />
          <span>{part.name}<small>{percent.format(part.share)} do peso</small></span>
          <strong>{formatWeight(part.weight)}</strong>
        </li>)}
      </ul>
    </div> : <p className="fx-empty">Nenhum peso informado para os filtros selecionados.</p>}
  </section>;
}

export default function ConsultationCharts({ valueRows, weightRows, period, driver, periodLabel, valueTitle, formatWeight }) {
  return <div className="fx-consultation-charts">
    <ValueLine rows={valueRows} period={period} driver={driver} periodLabel={periodLabel} title={valueTitle} />
    <WeightDonut rows={weightRows} periodLabel={periodLabel} formatWeight={formatWeight} />
  </div>;
}
