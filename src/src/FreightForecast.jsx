import React, { useMemo, useState } from 'react';
import { CalendarDays, Truck, UserRound, UsersRound, Wallet } from 'lucide-react';
import { freightForecast } from './lib/freight-forecast';
import './freight-forecast.css';
const money = n => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const nextFriday = () => { const date = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Manaus' }) + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + (5 - date.getUTCDay() + 7) % 7); return date.toISOString().slice(0,10); };
export default function FreightForecast({ data, driver, period }) {
  const [date, setDate] = useState(nextFriday);
  const forecast = useMemo(() => freightForecast(data, date, driver, period), [data, date, driver, period]);
  return <section className="driver-forecast" aria-label="Valores por motorista">
    <div className="driver-forecast-header"><div><span className="driver-forecast-icon"><UsersRound size={22} /></span><div><h2>Motoristas</h2><p>Valores previstos no período selecionado</p></div></div><label><CalendarDays size={16} /> Data das solicitações e prévias <input aria-label="Data das solicitações e prévias" type="date" value={date} onChange={e => setDate(e.target.value)} /></label></div>
    <div className="driver-forecast-list">{forecast.drivers.map((row, index) => <article key={row.name} className={`driver-forecast-row color-${index % 4}`}>
      <span className="driver-forecast-avatar"><UserRound size={23} /></span><div className="driver-forecast-name"><strong>{row.name}</strong><span><Truck size={13} />{row.openCount ? `${row.openCount} ${row.openCount === 1 ? 'ticket em aberto' : 'tickets em aberto'}` : 'Valor previsto'}</span></div>
      <div className="driver-forecast-value"><strong>{money(row.amount)}</strong><small>{[row.open ? `Em aberto ${money(row.open)}` : '', row.waiting ? `Fechado ${money(row.waiting)}` : '', row.requested ? `Solicitado ${money(row.requested)}` : '', row.preview ? `Prévia ${money(row.preview)}` : ''].filter(Boolean).join(' · ')}</small></div>
    </article>)}{!forecast.drivers.length && <p className="driver-forecast-empty">Nenhum valor previsto para os filtros selecionados.</p>}</div>
    <div className="driver-forecast-total"><span><Wallet size={19} /> {driver ? 'Total do motorista' : 'Total de todos os motoristas'}</span><strong>{money(forecast.total)}</strong></div>
    <p className="driver-forecast-note">Inclui tickets em aberto e fechamentos aguardando envio, que ainda não têm data de pagamento definida, além de solicitações e prévias para a data escolhida. Tickets vinculados a prévias são contados uma vez. Motoristas com o mesmo nome são agrupados.</p>
  </section>;
}
