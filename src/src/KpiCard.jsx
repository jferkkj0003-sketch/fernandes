import React, { useRef } from 'react';
import { Info } from 'lucide-react';

const W = 264;
const H = 92;
const PAD_TOP = 14;
const PAD_BOTTOM = 18;

function MiniChart({ points, format, title }) {
  if (!points.length) return <p className="kpi-pop-empty">Sem lançamentos no período.</p>;
  const max = Math.max(...points.map((point) => point.value), 1);
  const slot = W / points.length;
  const barW = Math.min(26, slot * 0.58);
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const last = points.length - 1;
  const labelEvery = points.length > 6 ? 2 : 1;
  const path = points.map((point, i) => `${i ? 'L' : 'M'}${(i * slot + slot / 2).toFixed(1)} ${(PAD_TOP + plotH - (point.value / max) * plotH).toFixed(1)}`).join(' ');
  return <svg className="kpi-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${points.map((p) => `${p.label} ${format(p.value)}`).join(', ')}`}>
    <line className="kpi-base" x1="0" x2={W} y1={H - PAD_BOTTOM} y2={H - PAD_BOTTOM} />
    {points.map((point, i) => {
      const h = Math.max(point.value ? 3 : 1.5, (point.value / max) * plotH);
      const x = i * slot + (slot - barW) / 2;
      return <g key={point.key} className={i === last ? 'kpi-bar now' : 'kpi-bar'}>
        <title>{`${point.label}: ${format(point.value)}`}</title>
        <rect x={x} y={H - PAD_BOTTOM - h} width={barW} height={h} rx="3" />
        {(i % labelEvery === 0 || i === last) && <text x={x + barW / 2} y={H - 4} textAnchor="middle">{point.label}</text>}
      </g>;
    })}
    {points.length > 1 && <path className="kpi-line" d={path} />}
    <text className="kpi-peak" x={W - 2} y="9" textAnchor="end">{format(max)}</text>
  </svg>;
}

/**
 * Indicador com efeito espelho (brilho que acompanha o cursor) e um gráfico
 * que aparece ao passar o mouse, focar com o teclado ou tocar.
 */
export default function KpiCard({ label, value, unit, foot, hint, series, format, tone = 'navy' }) {
  const ref = useRef(null);
  const move = (event) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    ref.current.style.setProperty('--mx', `${event.clientX - box.left}px`);
    ref.current.style.setProperty('--my', `${event.clientY - box.top}px`);
  };
  return <article ref={ref} className={`kpi mirror tone-${tone}`} tabIndex={0} onPointerMove={move} aria-label={`${label}: ${value}${unit ? ` ${unit}` : ''}. ${foot || ''}`}>
    <span className="mirror-gloss" aria-hidden="true" />
    <header><span className="kpi-label">{label}</span>{hint && <span className="kpi-hint" title={hint}><Info size={16} aria-hidden="true" /></span>}</header>
    <strong className="kpi-value">{value}{unit && <small>{unit}</small>}</strong>
    <p className="kpi-foot">{foot}</p>
    <div className="kpi-pop" role="group" aria-label={`Evolução: ${label}`}>
      <div className="kpi-pop-head"><span>{label}</span><span>por {series.unit === 'day' ? 'dia' : series.unit === 'week' ? 'semana' : 'mês'}</span></div>
      <MiniChart points={series.points} format={format} title={label} />
    </div>
  </article>;
}
