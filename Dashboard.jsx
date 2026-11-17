import React, { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from './lib/cloud';
import { driverOptions } from './lib/drivers';
import { summarizeDriverPayments } from './lib/driver-payments';
import { requestArchiveAt, REQUESTS_TRACKING_START_DATE } from './lib/request-cycle';
import PayHero from './PayHero';

const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const shiftDays = (iso, days) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const formatWeight = (value) => { const w = Number(value || 0); return w >= 1000 ? `${(w / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} t` : `${w.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`; };
const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
const br = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

const AVATARS = ['#2358c4', '#128a57', '#6a40c8', '#b4531a', '#a02f6b', '#2a7f9e'];
const nextFridayISO = (today) => { const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() + (5 - d.getDay() + 7) % 7); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const brShort = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7);
const brFull = (iso) => iso.split('-').reverse().join('/');
const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

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

  // Solicitação do ciclo atual (paga na sexta) ainda conta; ciclos encerrados e fechamentos pagos já foram quitados.
  const paidTicketIds = useMemo(() => {
    const now = Date.now();
    const current = (closure) => {
      if (closure.status !== 'Solicitado' || closure.paidAt) return false;
      if (closure.end && closure.end < REQUESTS_TRACKING_START_DATE) return false;
      const cutoff = requestArchiveAt(closure.sentAt);
      return !cutoff || now < new Date(cutoff).getTime();
    };
    return new Set(closures.filter((closure) => closure.paidAt || (closure.status === 'Solicitado' && !current(closure))).flatMap((closure) => closure.ticketIds || []));
  }, [closures]);
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

  const friday = nextFridayISO(today);
  const thursday = shiftDays(friday, -1);
  const matchesFilters = (ticket) => {
    const key = ticket.driverId || ticket.driver || '';
    return ticket.dateISO && (!startDate || ticket.dateISO >= startDate) && (!endDate || ticket.dateISO <= endDate) && (driverFilter === 'Todos' || key === driverFilter);
  };
  const counts = useMemo(() => {
    const result = { open: 0, waiting: 0, requested: 0, paid: 0 };
    for (const ticket of tickets.filter(matchesFilters)) {
      const status = ticket.requestStatus === 'Solicitado' || ticket.requestStatus === 'Aguardando envio' ? ticket.requestStatus : ticket.status || 'Aberto';
      if (paidTicketIds.has(ticket.id)) result.paid += 1;
      else if (status === 'Solicitado') result.requested += 1;
      else if (status === 'Aberto') result.open += 1;
      else result.waiting += 1;
    }
    return result;
  }, [tickets, paidTicketIds, driverFilter, startDate, endDate]);
  const closureDriver = (closure) => closure.driver || closure.driverName || '';
  const waitingClosures = closures.filter((closure) => closure.status === 'Aguardando envio' && !closure.paidAt);
  const noDateClosures = closures.filter((closure) => closure.status === 'Solicitado' && !closure.paidAt && !closure.paymentDueDate);
  const names = (list) => [...new Set(list.map(closureDriver).filter(Boolean))].join(' · ');
  const alerts = [
    waitingClosures.length && { color: 'var(--violet)', title: `${waitingClosures.length} ${waitingClosures.length === 1 ? 'fechamento aguardando envio' : 'fechamentos aguardando envio'}`, text: names(waitingClosures) || 'Solicite o pagamento por e-mail', action: 'Solicitar', page: 'fechamentos' },
    totals.previewCount && { color: 'var(--blue)', title: `${totals.previewCount} ${totals.previewCount === 1 ? 'prévia sem ticket vinculado' : 'prévias sem ticket vinculado'}`, text: 'Vincule quando o ticket chegar', action: 'Vincular', page: 'tickets' },
    noDateClosures.length && { color: 'var(--amber)', title: `${noDateClosures.length} ${noDateClosures.length === 1 ? 'solicitação sem data de pagamento' : 'solicitações sem data de pagamento'}`, text: names(noDateClosures) || 'Defina a data de pagamento', action: 'Definir', page: 'fechamentos' },
    counts.open && { color: 'var(--amber)', title: `${counts.open} ${counts.open === 1 ? 'ticket em aberto' : 'tickets em aberto'}`, text: `Entram no fechamento de quinta, ${brShort(thursday)}`, action: 'Fechar', page: 'fechamentos' },
  ].filter(Boolean);
  const steps = [
    ['Em aberto', counts.open, totals.open, 'Ainda sem fechamento', 'var(--amber)'],
    ['Fechado', counts.waiting, totals.waiting, 'Aguardando envio por e-mail', 'var(--violet)'],
    ['Solicitado', counts.requested, totals.requested, 'Ciclo atual · encerra sexta 17h (Manaus)', 'var(--green)'],
    ['Pago', counts.paid, totals.paid, 'Ciclos anteriores', 'var(--muted)'],
  ];
  const exportCsv = () => {
    const header = ['Motorista', 'Viagens', 'Peso (kg)', 'Em aberto', 'Fechado', 'Solicitado', 'Prévia', 'A pagar'];
    const lines = rows.map((row) => [row.name, row.trips, row.weight, row.open, row.waiting, row.requested, row.preview, row.payable]);
    const csv = '\ufeff' + [header, ...lines].map((line) => line.map(csvCell).join(';')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `valores-por-motorista-${today}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const parts = [
    { name: 'Solicitado por e-mail', note: `${counts.requested} ${counts.requested === 1 ? 'ticket' : 'tickets'} · pago na sexta`, value: totals.requested, color: 'var(--green)' },
    { name: 'Fechado, a enviar', note: `${counts.waiting} ${counts.waiting === 1 ? 'ticket' : 'tickets'} · falta solicitar`, value: totals.waiting, color: 'var(--violet)' },
    { name: 'Prévias sem ticket', note: `${totals.previewCount} ${totals.previewCount === 1 ? 'viagem' : 'viagens'} · ticket chega depois`, value: totals.preview, color: 'var(--blue)' },
    { name: 'Em aberto', note: `${counts.open} ${counts.open === 1 ? 'ticket' : 'tickets'} · entram no fechamento`, value: totals.open, color: 'var(--amber)' },
  ];
  const average = totals.trips ? totals.payable / totals.trips : 0;

  return <>
    <div className="page-heading">
      <div><p className="eyebrow">Acompanhamento</p><h1>Painel de controle</h1><p className="page-subtitle">Semana de pagamento: sexta, {brFull(friday)} · fechamento na quinta, {brShort(thursday)}</p></div>
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

    <section className="cx-top">
      <PayHero label={`Previsão de pagamento · sexta, ${brShort(friday)}`} total={totals.payable} paid={totals.paid} parts={parts}
        sub={`${totals.trips} ${totals.trips === 1 ? 'viagem' : 'viagens'} · ${formatWeight(totals.weight)} · ${rows.length} ${rows.length === 1 ? 'motorista' : 'motoristas'}`} />
      <aside className="panel cx-attn" aria-label="Precisa de atenção">
        <div className="cx-attn-head"><h2>Precisa de atenção</h2><span className="subtle-count">{alerts.length}</span></div>
        {alerts.map((alert) => <div key={alert.title} className="cx-attn-item"><i style={{ background: alert.color }} /><div><strong>{alert.title}</strong><small>{alert.text}</small></div><button type="button" onClick={() => goTo(alert.page)}>{alert.action}</button></div>)}
        {!alerts.length && <p className="empty-state">Tudo em dia. Nada pendente agora.</p>}
      </aside>
    </section>

    <section className="panel" aria-label="Andamento dos tickets">
      <div className="panel-heading"><h2>Andamento dos tickets</h2></div>
      <div className="cx-steps" style={{ marginTop: 0 }}>
        {steps.map(([name, count, value, note, color]) => <div key={name} className="cx-step" style={{ '--sc': color }}><span>{name}</span><strong>{count}</strong><em>{money(value)}</em><small>{note}</small></div>)}
      </div>
    </section>

    <section className="panel dash-drivers" aria-label="Valores por motorista" style={{ marginTop: 16 }}>
      <div className="panel-heading"><h2>Valores por motorista</h2><button type="button" className="button secondary small-button" onClick={exportCsv} disabled={!rows.length}>Exportar CSV</button></div>
      {previewError && <div className="notice">{previewError}</div>}
      <div className="cx-table-wrap"><table className="cx-table">
        <thead><tr><th>Motorista</th><th>Viagens</th><th>Peso</th><th>Em aberto</th><th>Fechado</th><th>Solicitado</th><th>Prévia</th><th>A pagar</th></tr></thead>
        <tbody>{rows.map((row, index) => <tr key={row.key}>
          <td><span className="cx-name"><span className="cx-av" style={{ background: AVATARS[index % AVATARS.length] }}>{initials(row.name)}</span>{row.name}</span></td>
          <td>{row.trips}</td><td>{row.weight ? formatWeight(row.weight) : '—'}</td>
          <td>{row.open ? money(row.open) : '—'}</td><td>{row.waiting ? money(row.waiting) : '—'}</td><td>{row.requested ? money(row.requested) : '—'}</td><td>{row.preview ? money(row.preview) : '—'}</td>
          <td className="cx-pay">{money(row.payable)}</td></tr>)}</tbody>
        {rows.length > 0 && <tfoot><tr><td>Total</td><td>{totals.trips}</td><td>{formatWeight(totals.weight)}</td><td>{money(totals.open)}</td><td>{money(totals.waiting)}</td><td>{money(totals.requested)}</td><td>{money(totals.preview)}</td><td>{money(totals.payable)}</td></tr></tfoot>}
      </table></div>
      {!rows.length && <p className="empty-state">Nenhum valor para os filtros selecionados.</p>}
    </section>

    <section className="cx-stats" aria-label="Resumo do período">
      <div className="panel cx-stat"><span>Viagens no período</span><strong>{totals.trips.toLocaleString('pt-BR')}</strong><small>{totals.tickets} tickets + {totals.previewCount} prévias</small></div>
      <div className="panel cx-stat"><span>Peso transportado</span><strong>{formatWeight(totals.weight)}</strong><small>Somente tickets</small></div>
      <div className="panel cx-stat"><span>Valor a pagar</span><strong>{money(totals.payable)}</strong><small>Inclui prévias · atualizado em {stamp}</small></div>
      <div className="panel cx-stat"><span>Valor médio por viagem</span><strong>{money(average)}</strong><small>{driverFilter === 'Todos' ? 'Todos os motoristas' : rows[0]?.name || 'Motorista'}</small></div>
    </section>
  </>;
}
