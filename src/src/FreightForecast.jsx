import React, { useMemo, useState } from 'react';
import { freightForecast } from './lib/freight-forecast';
const money = n => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const nextFriday = () => { const date = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Manaus' }) + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + (5 - date.getUTCDay() + 7) % 7); return date.toISOString().slice(0,10); };
export default function FreightForecast({ data, driver }) {
  const [date, setDate] = useState(nextFriday);
  const forecast = useMemo(() => freightForecast(data, date, driver), [data, date, driver]);
  return <section className="panel form-panel"><div className="panel-heading"><div><h2>Pagamento por motorista</h2><p>Fechamentos solicitados e prévias para a data escolhida, agrupados por nome.</p></div><label>Pagamento em <input type="date" value={date} onChange={e => setDate(e.target.value)} /></label></div>
    <div className="table-wrap"><table><thead><tr><th>MOTORISTA</th><th>VALOR PREVISTO</th></tr></thead><tbody>{forecast.drivers.map(row => <tr key={row.name}><td>{row.name}</td><td><strong>{money(row.amount)}</strong></td></tr>)}{!forecast.drivers.length && <tr><td colSpan="2">Nenhum pagamento previsto para esta data.</td></tr>}</tbody><tfoot><tr><th scope="row">TOTAL {driver ? 'DO MOTORISTA SELECIONADO' : 'DE TODOS OS MOTORISTAS'}</th><td><strong>{money(forecast.total)}</strong></td></tr></tfoot></table></div>
    <p>Inclui fechamentos solicitados não marcados como pagos e prévias ainda fora desses fechamentos. O filtro de motorista se aplica; o filtro de período acima não altera esta previsão. Motoristas com o mesmo nome são agrupados.</p>
  </section>;
}
