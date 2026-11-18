import React from 'react';
import { ChartColumn } from 'lucide-react';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ConsultationValueChart({ rows, periodLabel }) {
  const ordered = [...rows].sort((a, b) => b.amount - a.amount);
  const lower = Math.min(0, ...ordered.map((row) => row.amount));
  const upper = Math.max(0, ...ordered.map((row) => row.amount));
  const range = upper - lower || 1;

  return <section className="fx-card fx-value-chart" aria-label="Valor por motorista">
    <h2 className="fx-h2"><ChartColumn size={20} /> Valor por motorista <small>({periodLabel})</small></h2>
    {ordered.length ? <div className="fx-value-scroll" tabIndex={0} aria-label="Gráfico de colunas por motorista">
      <div role="list" className="fx-value-columns" style={{ '--drivers': ordered.length }}>
        <div className="fx-value-grid" aria-hidden="true" />
        {ordered.map((row) => <div role="listitem" key={row.key} className="fx-value-column">
          <strong className="fx-value-number">{money.format(row.amount)}</strong>
          <span className="fx-value-plot" aria-hidden="true">
            <span className={row.amount < 0 ? 'fx-value-bar negative' : 'fx-value-bar'} style={{
              bottom: ((Math.min(0, row.amount) - lower) / range * 100) + '%',
              height: (Math.abs(row.amount) / range * 100) + '%',
            }} />
          </span>
          <span className="fx-value-name">{row.name}</span>
        </div>)}
      </div>
    </div> : <p className="fx-empty">Nenhum valor para os filtros selecionados.</p>}
  </section>;
}
