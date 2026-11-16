import React, { useMemo, useState } from 'react';
import { freightForecast } from './lib/freight-forecast';
const money = n => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const nextFriday = () => { const date = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Manaus' }) + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + (5 - date.getUTCDay() + 7) % 7); return date.toISOString().slice(0,10); };
export default function FreightForecast({ data, driver }) {
  const [date, setDate] = useState(nextFriday);
  const forecast = useMemo(() => freightForecast(data, date, driver), [data, date, driver]);
  return <section className="panel form-panel"><div className="panel-heading"><div><h2>Previsão de pagamento</h2><p>Fechamentos solicitados e viagens lançadas como prévia, para a data escolhida.</p></div><label>Pagamento em <input type="date" value={date} onChange={e => setDate(e.target.value)} /></label></div>
    <div className="consultation-summary">
      <article className="shared-metric consultation-card"><h2>Fechamentos solicitados</h2><strong>{money(forecast.confirmed)}</strong></article>
      <article className="shared-metric consultation-card"><h2>Prévia sem ticket</h2><strong>{money(forecast.withoutTicket)}</strong></article>
      <article className="shared-metric consultation-card"><h2>Prévia com ticket</h2><strong>{money(forecast.withTicket)}</strong></article>
      <article className="shared-metric consultation-card"><h2>Total previsto</h2><strong>{money(forecast.total)}</strong></article>
    </div>
    <p>Considera os fechamentos solicitados e não marcados como pagos. O filtro de motorista também se aplica; o filtro de período acima não altera esta previsão.</p>
    <div className="table-wrap"><table><thead><tr><th>MOTORISTA</th><th>CARREGAMENTO</th><th>SITUAÇÃO</th><th>VALOR</th></tr></thead><tbody>{forecast.previews.map(row => <tr key={row.id}><td>{row.driver}</td><td>{row.loading_date.split('-').reverse().join('/')}</td><td>{row.confirmed ? 'Ticket recebido · ainda fora de solicitação' : 'Ticket pendente'}</td><td>{money(row.amount)}{row.confirmed && Number(row.amount) !== Number(row.estimated_amount) && <small> · prévia {money(row.estimated_amount)}</small>}</td></tr>)}{!forecast.previews.length && <tr><td colSpan="4">Nenhuma prévia para esta data.</td></tr>}</tbody></table></div>
  </section>;
}
