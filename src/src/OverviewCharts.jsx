import React from 'react';
import { overviewSeries, stepGeometry } from './lib/overview-charts';

const colors = ['#3478ea', '#2a9b72', '#e5a631', '#8b6bd6', '#e16c55', '#28a6b5', '#ce6ba5', '#8291a5'];
const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const weight = (value) => `${Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`;
const dayLabel = (value) => value.slice(5).split('-').reverse().join('/');

function DriverDonut({ rows, field, title, format, colorFor }) {
  const ordered = [...rows].sort((a, b) => Math.abs(b[field]) - Math.abs(a[field]) || a.driver.localeCompare(b.driver, 'pt-BR'));
  const total = ordered.reduce((sum, row) => sum + row[field], 0);
  const magnitude = ordered.reduce((sum, row) => sum + Math.abs(row[field]), 0);
  const signed = ordered.some((row) => row[field] < 0);
  let position = 0;
  const gradient = ordered.filter((row) => row[field] !== 0).map((row) => {
    const start = position;
    position += Math.abs(row[field]) / magnitude * 100;
    return `${colorFor(row.driver)} ${start}% ${position}%`;
  }).join(', ');
  return <section className="shared-ranking overview-chart-card">
    <h2>{title}</h2><p className="shared-payment-description">{signed ? 'Participação por valor absoluto; valores líquidos na legenda.' : 'Participação de cada motorista no período selecionado.'}</p>
    {magnitude ? <div className="overview-donut-content">
      <div className="overview-donut" role="img" aria-label={`${title}: ${format(total)}. ${ordered.map((row) => `${row.driver}: ${format(row[field])}`).join('; ')}`} style={{ background: `conic-gradient(${gradient})` }}><div><strong style={{ fontSize: format(total).length > 13 ? '14px' : undefined }}>{format(total)}</strong><span>Total no período</span></div></div>
      <div className="overview-chart-legend">{ordered.map((row) => <div key={row.driver} className="overview-legend-row"><i style={{ background: colorFor(row.driver) }} /><span>{row.driver}</span><strong>{format(row[field])}<small>{(Math.abs(row[field]) / magnitude * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</small></strong></div>)}</div>
    </div> : <p className="shared-empty">Sem dados para os filtros selecionados.</p>}
  </section>;
}

function StepChart({ series, field, title, format, color, id }) {
  const chart = stepGeometry(series, field);
  const total = series.at(-1)?.[field] || 0;
  const dateTicks = chart.points.filter((_, index, all) => index === 0 || index === all.length - 1 || (all.length > 4 && index % Math.ceil(all.length / 4) === 0));
  return <section className="shared-ranking overview-chart-card"><h2>{title}</h2><p className="shared-payment-description">Acumulado no período · cada degrau representa um dia com movimentação.</p>
    {chart.points.length ? <><svg className="overview-step-chart" viewBox="0 0 620 250" role="img" aria-label={`${title}: ${format(total)} acumulados entre ${dayLabel(series[0].date)} e ${dayLabel(series.at(-1).date)}.`}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".24" /><stop offset="100%" stopColor={color} stopOpacity=".02" /></linearGradient></defs>
      {[0, .5, 1].map((fraction) => { const value = chart.min + (chart.max - chart.min) * fraction; const y = chart.y(value); return <g key={fraction}><line x1="65" x2="590" y1={y} y2={y} className="overview-grid-line" /><text x="57" y={y + 4} textAnchor="end">{Intl.NumberFormat('pt-BR', { notation:'compact', maximumFractionDigits:1 }).format(value)}</text></g>; })}
      <path d={chart.area} fill={`url(#${id})`} /><path d={chart.path} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" />
      {chart.points.map((point) => <circle key={point.date} cx={point.x} cy={point.y} r="4" fill={color} tabIndex="0" aria-label={`${dayLabel(point.date)}: ${format(point[field])} acumulados`}><title>{dayLabel(point.date)}: {format(point[field])} acumulados</title></circle>)}
      {dateTicks.map((point) => <text key={point.date} x={point.x} y="237" textAnchor="middle">{dayLabel(point.date)}</text>)}
    </svg><div className="overview-chart-total"><span>Total acumulado</span><strong style={{ color }}>{format(total)}</strong></div></> : <p className="shared-empty">Sem movimentação para os filtros selecionados.</p>}
  </section>;
}

export default function OverviewCharts({ rows, dailyRows, period, driver }) {
  const names = [...rows].map((row) => row.driver).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const colorFor = (name) => colors[names.indexOf(name) % colors.length];
  const series = overviewSeries(dailyRows, period, driver);
  return <div className="overview-charts-grid">
    <DriverDonut rows={rows} field="amount" title="Valor por motorista" format={money} colorFor={colorFor} />
    <DriverDonut rows={rows} field="weight" title="Peso por motorista" format={weight} colorFor={colorFor} />
    <StepChart series={series} field="cumulativeAmount" title="Evolução do valor" format={money} color="#3478ea" id="overview-value-fill" />
    <StepChart series={series} field="cumulativeWeight" title="Evolução do peso" format={weight} color="#2a9b72" id="overview-weight-fill" />
  </div>;
}
