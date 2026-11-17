import React, { useMemo, useState } from 'react';
import { CalendarDays, Truck, Wallet } from 'lucide-react';
import { freightForecast } from './lib/freight-forecast';

const money = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const nextFriday = () => { const date = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Manaus' }) + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + (5 - date.getUTCDay() + 7) % 7); return date.toISOString().slice(0, 10); };
const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

export default function FreightForecast({ data, driver, period }) {
  const [date, setDate] = useState(nextFriday);
  const forecast = useMemo(() => freightForecast(data, date, driver, period), [data, date, driver, period]);
  const sum = (field) => forecast.drivers.reduce((total, row) => total + Math.round(row[field] * 100), 0) / 100;
  return <>
    <section className="dash-pay" aria-label="Total a ser pago">
      <div className="dash-pay-main"><span className="dash-pay-icon"><Wallet size={28} strokeWidth={1.7} /></span><div><span className="dash-pay-label">Total a ser pago</span><strong className="dash-pay-value">{money(forecast.total)}</strong><small>{driver || 'Todos os motoristas'} · inclui prévias</small></div></div>
      <dl className="dash-pay-split">
        <div className="s-amber"><dt>Em aberto</dt><dd>{money(sum('open'))}</dd></div>
        <div className="s-violet"><dt>Fechado</dt><dd>{money(sum('waiting'))}</dd></div>
        <div className="s-green"><dt>Solicitado</dt><dd>{money(sum('requested'))}</dd></div>
        <div className="s-blue"><dt>Prévia</dt><dd>{money(sum('preview'))}</dd></div>
      </dl>
    </section>
    <section className="panel dash-drivers" aria-label="Valores por motorista">
      <div className="panel-heading"><h2><span className="heading-icon"><Truck size={17} /></span> Motoristas</h2>
        <label className="dash-paydate"><CalendarDays size={15} /> Pagamento em <input aria-label="Data das solicitações e prévias" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></div>
      <div className="dash-driver-list">
        {forecast.drivers.map((row, index) => <article key={row.name} className={`dash-driver c-${index % 4}`}>
          <span className="dash-avatar">{initials(row.name)}</span>
          <div className="dash-driver-main"><strong>{row.name}</strong>
            <span className="dash-driver-status"><Truck size={13} /> {row.openCount ? `${row.openCount} ${row.openCount === 1 ? 'ticket em aberto' : 'tickets em aberto'}` : 'Valor previsto'}</span>
            <small>{[row.open ? `Em aberto ${money(row.open)}` : '', row.waiting ? `Fechado ${money(row.waiting)}` : '', row.requested ? `Solicitado ${money(row.requested)}` : '', row.preview ? `Prévia ${money(row.preview)}` : ''].filter(Boolean).join(' · ')}</small></div>
          <div className="dash-driver-total"><span>A pagar</span><strong>{money(row.amount)}</strong></div>
        </article>)}
        {!forecast.drivers.length && <p className="empty-state">Nenhum valor previsto para os filtros selecionados.</p>}
      </div>
      {forecast.drivers.length > 1 && <div className="dash-driver-sum"><span><Wallet size={18} /> Total de todos os motoristas</span><strong>{money(forecast.total)}</strong></div>}
      <p className="dash-note">Inclui tickets em aberto e fechamentos aguardando envio, além das solicitações e prévias com pagamento na data escolhida. Tickets vinculados a prévias são contados uma vez.</p>
    </section>
  </>;
}
