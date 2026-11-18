import React, { useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { freightForecast } from './lib/freight-forecast';
import PayHero from './PayHero';

const money = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const money0 = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const nextFriday = () => { const date = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Manaus' }) + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + (5 - date.getUTCDay() + 7) % 7); return date.toISOString().slice(0, 10); };
const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
const dayLabel = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const AVATARS = ['#2358c4', '#128a57', '#6a40c8', '#b4531a', '#a02f6b', '#2a7f9e'];
const STATES = [['requested', 'Solicitado', 'var(--green)'], ['waiting', 'Fechado', 'var(--violet)'], ['preview', 'Prévia', 'var(--blue)'], ['open', 'Em aberto', 'var(--amber)']];

// Tela "Pagamentos da semana": valor previsto para a data de pagamento, por situação e por motorista.
export default function FreightForecast({ data, driver, period, paid = 0 }) {
  const [date, setDate] = useState(nextFriday);
  const forecast = useMemo(() => freightForecast(data, date, driver, period), [data, date, driver, period]);
  const sum = (field) => forecast.drivers.reduce((total, row) => total + Math.round(row[field] * 100), 0) / 100;
  const parts = [
    { name: 'Solicitado por e-mail', note: 'ciclo atual', value: sum('requested'), color: 'var(--green)' },
    { name: 'Fechado, a enviar', note: 'falta solicitar', value: sum('waiting'), color: 'var(--violet)' },
    { name: 'Prévias sem ticket', note: 'ticket chega depois', value: sum('preview'), color: 'var(--blue)' },
    { name: 'Em aberto', note: 'entram no fechamento', value: sum('open'), color: 'var(--amber)' },
  ];
  return <>
    <PayHero label={`Pagamento em ${dayLabel(date)}`} total={forecast.total} paid={paid}
      sub={`${driver || 'Todos os motoristas'} · ${forecast.drivers.length} ${forecast.drivers.length === 1 ? 'motorista' : 'motoristas'}`} parts={parts} />
    <div className="cx-section-head"><h2>Por motorista</h2>
      <label className="dash-paydate"><CalendarDays size={15} /> Pagamento em <input aria-label="Data das solicitações e prévias" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></div>
    <section className="cx-drivers" aria-label="Valores por motorista">
      {forecast.drivers.map((row, index) => {
        const detail = STATES.filter(([key]) => row[key] > 0).map(([key, name]) => `${name} ${money0(row[key])}`).join(' · ');
        return <article key={row.name} className="panel cx-drv">
          <div className="cx-who"><span className="cx-av" style={{ background: AVATARS[index % AVATARS.length] }}>{initials(row.name)}</span>
            <div><strong>{row.name}</strong><small>{row.openCount ? `${row.openCount} ${row.openCount === 1 ? 'ticket em aberto' : 'tickets em aberto'}` : 'Valor previsto'}</small></div>
            <strong className="cx-amt">{money(row.amount)}</strong></div>
          <div className="cx-mini">{STATES.map(([key, , color]) => <div key={key} style={{ flex: Math.max(row[key], 0), background: color }} />)}</div>
          <p className="cx-detail">{detail || 'Sem valores no período'}</p>
        </article>;
      })}
      {!forecast.drivers.length && <p className="empty-state">Nenhum valor previsto para os filtros selecionados.</p>}
    </section>
    <p className="dash-note">Inclui tickets em aberto e fechamentos aguardando envio, além das solicitações e prévias com pagamento na data escolhida. Tickets vinculados a prévias são contados uma vez.</p>
  </>;
}
