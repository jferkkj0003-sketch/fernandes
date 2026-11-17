import React, { useEffect, useMemo, useState } from 'react';
import { BadgeDollarSign, CalendarDays, ChevronRight, ClipboardList, Plus, Truck, UserRound, Wallet, Weight, Info, Route, Tag } from 'lucide-react';
import { supabase } from './lib/cloud';
import { driverOptions } from './lib/drivers';
import { summarizeDriverPayments } from './lib/driver-payments';

const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const shiftDays = (iso, days) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const formatWeight = (value) => { const w = Number(value || 0); return w >= 1000 ? `${(w / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} t` : `${w.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`; };
const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
const br = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

function KPI({ icon: Icon, label, value, foot, tint }) {
  return <div className={`kpi kpi-${tint}`}><span className="kpi-icon"><Icon size={26} strokeWidth={1.7} /></span><div><span className="kpi-label">{label}</span><strong className="kpi-value">{value}</strong>{foot && <small className="kpi-foot">{foot}</small>}</div></div>;
}

export default function Dashboard({ tickets, drivers: driverRecords, closures = [], goTo }) {
  const today = localToday();
  const [driverFilter, setDriverFilter] = useState('Todos');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [previews, setPreviews] = useState([]);
  const [previewError, setPreviewError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(() => new Date());
  const drivers = useMemo(() => driverOptions(driverRecords, tickets), [driverRecords, tickets]);
  const invalidRange = Boolean(startDate && endDate && startDate > endDate);

  useEffect(() => {
    if (!supabase) return undefined;
    let cancelled = false;
    supabase.from('freight_previews').select('id, driver_id, loading_date, payment_date, amount, driver:drivers(name)').is('cancelled_at', null).is('ticket_id', null)
      .then(({ data, error }) => {
        if (cancelled) return;
        setPreviewError(error ? 'Não foi possível carregar as prévias.' : '');
        if (!error) setPreviews(data || []);
        setUpdatedAt(new Date());
      });
    return () => { cancelled = true; };
  }, [tickets.length]);

  const paidTicketIds = useMemo(() => new Set(closures.filter((closure) => closure.paidAt).flatMap((closure) => closure.ticketIds || [])), [closures]);
  const { drivers: rows, totals } = useMemo(() => invalidRange
    ? summarizeDriverPayments({ drivers: [], tickets: [], previews: [] })
    : summarizeDriverPayments({ tickets, previews, paidTicketIds, drivers, driverFilter, start: startDate, end: endDate }),
  [tickets, previews, paidTicketIds, drivers, driverFilter, startDate, endDate, invalidRange]);

  const setRange = (start, end) => { setStartDate(start); setEndDate(end); };
  const presets = [
    ['Este mês', `${today.slice(0, 7)}-01`, today],
    ['7 dias', shiftDays(today, -6), today],
    ['30 dias', shiftDays(today, -29), today],
    ['Tudo', '', ''],
  ];
  const activePreset = presets.find(([, s, e]) => s === startDate && e === endDate)?.[0];
  const stamp = updatedAt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(', ', ' às ');
  const periodLabel = startDate || endDate ? `${startDate ? br(startDate) : 'início'} a ${endDate ? br(endDate) : 'hoje'}` : 'todo o período';

  return <>
    <div className="page-heading">
      <div><p className="eyebrow">ACOMPANHAMENTO</p><h1>Painel de controle</h1><p className="page-subtitle">Logística e entregas · {periodLabel}</p></div>
      <button className="button primary" onClick={() => goTo('tickets')}><Plus size={17} /> Novo ticket</button>
    </div>

    <section className="panel dash-filters" aria-label="Filtros">
      <div className="dash-presets" role="group" aria-label="Período rápido">
        {presets.map(([label, s, e]) => <button key={label} type="button" className={activePreset === label ? 'active' : ''} onClick={() => setRange(s, e)}>{label}</button>)}
      </div>
      <div className="dash-filter-fields">
        <label>Motorista<select value={driverFilter} onChange={(event) => setDriverFilter(event.target.value)}><option>Todos</option>{drivers.map((option) => <option key={option.key} value={option.key}>{option.name}{option.active === false ? ' (inativo)' : ''}</option>)}</select></label>
        <label>Data inicial<input type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} /></label>
        <label>Data final<input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} /></label>
      </div>
      {invalidRange && <div className="dashboard-date-error" role="alert">A data inicial deve ser anterior ou igual à data final.</div>}
    </section>

    <section className="dash-kpis" aria-label="Indicadores">
      <KPI icon={Tag} tint="blue" label="Total de tickets" value={totals.tickets.toLocaleString('pt-BR')} foot="Tickets lançados" />
      <KPI icon={BadgeDollarSign} tint="green" label="Total da prévia" value={money(totals.preview)} foot={`${totals.previewCount} ${totals.previewCount === 1 ? 'viagem' : 'viagens'} sem ticket`} />
      <KPI icon={Weight} tint="violet" label="Peso transportado" value={formatWeight(totals.weight)} foot="Somente tickets" />
      <KPI icon={Route} tint="amber" label="Viagens no período" value={totals.trips.toLocaleString('pt-BR')} foot="Tickets + prévias" />
    </section>

    <section className="dash-pay" aria-label="Total a pagar">
      <div className="dash-pay-main"><span className="dash-pay-icon"><Wallet size={28} strokeWidth={1.7} /></span><div><span className="dash-pay-label">Total a ser pago</span><strong className="dash-pay-value">{money(totals.payable)}</strong><small>{driverFilter === 'Todos' ? 'Todos os motoristas' : rows[0]?.name || 'Motorista'} · inclui prévias</small></div></div>
      <dl className="dash-pay-split">
        <div className="s-amber"><dt>Em aberto</dt><dd>{money(totals.open)}</dd></div>
        <div className="s-violet"><dt>Fechado</dt><dd>{money(totals.waiting)}</dd></div>
        <div className="s-green"><dt>Solicitado</dt><dd>{money(totals.requested)}</dd></div>
        <div className="s-blue"><dt>Prévia</dt><dd>{money(totals.preview)}</dd></div>
      </dl>
    </section>

    <section className="panel dash-drivers" aria-label="Valores por motorista">
      <div className="panel-heading"><h2><span className="heading-icon"><Truck size={17} /></span> Motoristas</h2><button type="button" className="button secondary small-button" onClick={() => goTo('motoristas')}>Ver detalhes <ChevronRight size={15} /></button></div>
      {previewError && <div className="notice">{previewError}</div>}
      <div className="dash-driver-list">
        {rows.map((row, index) => <article key={row.key} className={`dash-driver c-${index % 4}`}>
          <span className="dash-avatar">{initials(row.name) || <UserRound size={20} />}</span>
          <div className="dash-driver-main">
            <strong>{row.name}</strong>
            <span className="dash-driver-status"><Truck size={13} /> {row.trips} {row.trips === 1 ? 'viagem' : 'viagens'}{row.weight ? ` · ${formatWeight(row.weight)}` : ''}</span>
            <small>{[row.open ? `Em aberto ${money(row.open)}` : '', row.waiting ? `Fechado ${money(row.waiting)}` : '', row.requested ? `Solicitado ${money(row.requested)}` : '', row.preview ? `Prévia ${money(row.preview)}` : '', row.paid ? `Já pago ${money(row.paid)}` : ''].filter(Boolean).join(' · ') || 'Sem valores no período'}</small>
          </div>
          <div className="dash-driver-total"><span>A pagar</span><strong>{money(row.payable)}</strong></div>
        </article>)}
        {!rows.length && <p className="empty-state">Nenhum valor para os filtros selecionados.</p>}
      </div>
      {rows.length > 1 && <div className="dash-driver-sum"><span><Wallet size={18} /> Total de todos os motoristas</span><strong>{money(totals.payable)}</strong></div>}
    </section>

    <section className="dash-summary" aria-label="Resumo do período">
      <span className="dash-summary-icon"><Info size={22} /></span>
      <div><strong>Resumo do período</strong><small>Dados atualizados em: {stamp}</small></div>
      <div className="dash-summary-nums"><span><b>{totals.tickets}</b> tickets</span><span><b>{totals.previewCount}</b> prévias</span><span><b>{rows.length}</b> motoristas</span></div>
    </section>
  </>;
}
