import React, { useEffect, useMemo, useState } from 'react';
import { BadgeDollarSign, CalendarDays, ChevronDown, ClipboardList, Hourglass, Plus, Ticket, Truck, Weight } from 'lucide-react';
import { supabase } from './lib/cloud';
import { driverOptions } from './lib/drivers';
import { requestArchiveAt, REQUESTS_TRACKING_START_DATE } from './lib/request-cycle';

const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const dateISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const localToday = () => dateISO(new Date());
const shiftDays = (iso, days) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + days); return dateISO(d); };
const nextFridayISO = (iso) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + (5 - d.getDay() + 7) % 7); return dateISO(d); };
const brShort = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const brFull = (iso) => iso.split('-').reverse().join('/');
const formatWeight = (value) => { const w = Number(value || 0); return w >= 1000 ? `${(w / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} t` : `${w.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`; };
const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
const firstName = (name) => String(name || '').split(/\s+/)[0];
const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];
const STATUS = [['all', 'Todos'], ['open', 'Em aberto'], ['waiting', 'Fechado'], ['requested', 'Solicitado'], ['paid', 'Pago'], ['preview', 'Aguardando ticket']];

// Escala "bonita" para o eixo do gráfico de barras.
function niceCeil(max) {
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  return ([1, 2, 2.5, 5, 10].map((step) => step * magnitude).find((value) => value >= max)) || max;
}

function aggregate(list) {
  const byDriver = new Map();
  const totals = { tickets: 0, weight: 0, amount: 0, open: 0, preview: 0, previewCount: 0 };
  for (const record of list) {
    if (record.status === 'preview') { totals.preview += record.amount; totals.previewCount += 1; continue; }
    if (!byDriver.has(record.key)) byDriver.set(record.key, { key: record.key, name: record.name, tickets: 0, weight: 0, amount: 0, open: 0 });
    const row = byDriver.get(record.key);
    row.tickets += 1; row.weight += record.weight; row.amount += record.amount;
    totals.tickets += 1; totals.weight += record.weight; totals.amount += record.amount;
    if (record.status === 'open') { row.open += record.amount; totals.open += record.amount; }
  }
  const rows = [...byDriver.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'pt-BR'));
  return { rows, totals };
}

export default function Dashboard({ tickets, drivers: driverRecords, closures = [], goTo }) {
  const today = localToday();
  const [range, setRange] = useState('all');
  const [customStart, setCustomStart] = useState(() => shiftDays(localToday(), -29));
  const [customEnd, setCustomEnd] = useState(() => localToday());
  const [driverFilter, setDriverFilter] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('all');
  const [previews, setPreviews] = useState([]);
  const drivers = useMemo(() => driverOptions(driverRecords, tickets), [driverRecords, tickets]);

  useEffect(() => {
    if (!supabase) return undefined;
    let cancelled = false;
    supabase.from('freight_previews').select('id, driver_id, loading_date, payment_date, amount, driver:drivers(name)').is('cancelled_at', null).is('ticket_id', null)
      .then(({ data, error }) => { if (!cancelled && !error) setPreviews(data || []); });
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

  const records = useMemo(() => {
    const list = tickets.filter((ticket) => ticket.dateISO && (ticket.driverId || ticket.driver)).map((ticket) => {
      const raw = ticket.requestStatus === 'Solicitado' || ticket.requestStatus === 'Aguardando envio' ? ticket.requestStatus : ticket.status || 'Aberto';
      const status = paidTicketIds.has(ticket.id) ? 'paid' : raw === 'Solicitado' ? 'requested' : raw === 'Aberto' ? 'open' : 'waiting';
      return { key: ticket.driverId || ticket.driver, name: ticket.driver || 'Motorista não identificado', date: ticket.dateISO, weight: Number(ticket.weight || 0), amount: Number(ticket.gross || 0) - Number(ticket.discount || 0), status };
    });
    for (const preview of previews) {
      if (preview.driver_id && preview.loading_date) list.push({ key: preview.driver_id, name: preview.driver?.name || 'Motorista não identificado', date: preview.loading_date, weight: 0, amount: Number(preview.amount || 0), status: 'preview' });
    }
    return list;
  }, [tickets, previews, paidTicketIds]);

  // Semana de pagamento: sexta a quinta (fechamento na quinta, pagamento na sexta).
  const friday = nextFridayISO(today);
  const thursday = shiftDays(friday, -1);
  const weekStart = shiftDays(friday, -7);
  const period = range === 'week' ? { start: weekStart, end: thursday }
    : range === 'month' ? { start: `${today.slice(0, 7)}-01`, end: today }
      : range === 'custom' ? { start: customStart, end: customEnd } : { start: '', end: '' };
  const invalidRange = Boolean(period.start && period.end && period.start > period.end);

  const select = (start, end) => records.filter((record) => (!start || record.date >= start) && (!end || record.date <= end)
    && (driverFilter === 'Todos' || record.key === driverFilter) && (statusFilter === 'all' || record.status === statusFilter));
  const main = useMemo(() => invalidRange ? aggregate([]) : aggregate(select(period.start, period.end)), [records, range, customStart, customEnd, driverFilter, statusFilter, today]);
  // Resumo da semana: só tickets EM ABERTO de cada motorista, de qualquer data (inclui os da semana passada que ainda não fecharam).
  const week = useMemo(() => aggregate(records.filter((record) => record.status === 'open' && (driverFilter === 'Todos' || record.key === driverFilter))), [records, driverFilter]);
  const { rows, totals } = main;
  // cor fixa por motorista (mesma cor nos gráficos e na tabela da semana)
  const colorOf = (key) => { const i = rows.findIndex((row) => row.key === key); return COLORS[(i < 0 ? week.rows.findIndex((row) => row.key === key) : i) % COLORS.length]; };

  const maxAmount = Math.max(0, ...rows.map((row) => row.amount));
  const maxWeight = Math.max(0, ...rows.map((row) => row.weight));
  const weightScale = niceCeil(maxWeight);
  const ticks = [0, 1, 2, 3, 4].map((i) => (weightScale / 4) * i);
  const periodLabel = range === 'all' ? 'Todo período' : `${period.start ? brFull(period.start) : 'início'} – ${period.end ? brFull(period.end) : 'hoje'}`;

  // Avisos que existiam no painel anterior (fechamentos pendentes, prévias, tickets em aberto).
  const waitingClosures = closures.filter((closure) => closure.status === 'Aguardando envio' && !closure.paidAt);
  const noDateClosures = closures.filter((closure) => closure.status === 'Solicitado' && !closure.paidAt && !closure.paymentDueDate);
  const openCount = records.filter((record) => record.status === 'open' && (driverFilter === 'Todos' || record.key === driverFilter)).length;
  const alerts = [
    waitingClosures.length && { color: 'var(--violet)', text: `${waitingClosures.length} ${waitingClosures.length === 1 ? 'fechamento aguardando envio' : 'fechamentos aguardando envio'}`, action: 'Solicitar', page: 'fechamentos' },
    noDateClosures.length && { color: 'var(--amber)', text: `${noDateClosures.length} ${noDateClosures.length === 1 ? 'solicitação sem data de pagamento' : 'solicitações sem data de pagamento'}`, action: 'Definir', page: 'fechamentos' },
    openCount && { color: 'var(--green)', text: `${openCount} ${openCount === 1 ? 'ticket em aberto' : 'tickets em aberto'} · fechamento na quinta, ${brShort(thursday)}`, action: 'Fechar', page: 'fechamentos' },
  ].filter(Boolean);

  const chips = [['week', 'Semana'], ['month', 'Mês'], ['all', 'Todo período'], ['custom', 'Personalizado']];

  return <div className="fd-page">
    <div className="page-heading">
      <div><p className="eyebrow">ACOMPANHAMENTO</p><h1>Painel de Controle</h1><p className="page-subtitle">Visão geral da operação, pesos, tickets e valores</p></div>
      <button className="button primary" onClick={() => goTo('tickets')}><Plus size={17} /> Novo ticket</button>
    </div>

    <section className="fd-card fd-filters" aria-label="Filtros">
      <div className="fd-chips" role="group" aria-label="Período">{chips.map(([key, label]) => <button key={key} type="button" className={range === key ? 'on' : ''} onClick={() => setRange(key)}>{label}</button>)}</div>
      <div className="fd-selects">
        <label className="fd-select"><span>Motorista:</span><select value={driverFilter} onChange={(event) => setDriverFilter(event.target.value)}><option>Todos</option>{drivers.map((option) => <option key={option.key} value={option.key}>{option.name}{option.active === false ? ' (inativo)' : ''}</option>)}</select><ChevronDown size={15} /></label>
        <label className="fd-select"><span>Status:</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{STATUS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown size={15} /></label>
        <div className="fd-period"><CalendarDays size={16} /><span>Período</span><b>{periodLabel}</b></div>
      </div>
      {range === 'custom' && <div className="fd-dates"><label>De<input type="date" value={customStart} max={customEnd || undefined} onChange={(event) => setCustomStart(event.target.value)} /></label><label>Até<input type="date" value={customEnd} min={customStart || undefined} onChange={(event) => setCustomEnd(event.target.value)} /></label></div>}
      {invalidRange && <div className="dashboard-date-error" role="alert">A data inicial deve ser anterior ou igual à data final.</div>}
    </section>

    <section className="fd-kpis" aria-label="Indicadores">
      <div className="fd-kpi" style={{ '--c': '#3b82f6' }}><span className="fd-kpi-ico"><Ticket size={26} /></span><div><small>Total de Tickets</small><strong>{totals.tickets.toLocaleString('pt-BR')}</strong></div></div>
      <div className="fd-kpi" style={{ '--c': '#8b5cf6' }}><span className="fd-kpi-ico"><Weight size={26} /></span><div><small>Peso Total</small><strong>{formatWeight(totals.weight)}</strong></div></div>
      <div className="fd-kpi" style={{ '--c': '#10b981' }}><span className="fd-kpi-ico"><BadgeDollarSign size={28} /></span><div><small>Valor Total</small><strong>{money(totals.amount)}</strong></div></div>
    </section>

    {alerts.length > 0 && <section className="fd-alerts" aria-label="Precisa de atenção">
      {alerts.map((alert) => <div key={alert.text} className="fd-alert"><i style={{ background: alert.color }} /><span>{alert.text}</span><button type="button" onClick={() => goTo(alert.page)}>{alert.action}</button></div>)}
    </section>}

    <div className="fd-two">
      <section className="fd-card" aria-label="Valor por motorista">
        <h2 className="fd-h2"><BadgeDollarSign size={20} /> Valor por Motorista <small>({periodLabel})</small></h2>
        <div className="fd-hbars">
          {rows.map((row, index) => <div key={row.key} className="fd-hbar"><span className="n">{row.name}</span>
            <div className="track"><i style={{ width: `${maxAmount ? Math.max(6, (row.amount / maxAmount) * 100) : 0}%`, background: COLORS[index % COLORS.length] }} /></div>
            <b>{money(row.amount)}</b></div>)}
          {!rows.length && <p className="empty-state">Nenhum valor para os filtros selecionados.</p>}
        </div>
      </section>

      <section className="fd-card" aria-label="Peso por motorista">
        <h2 className="fd-h2"><Weight size={20} /> Peso por Motorista <small>({periodLabel})</small></h2>
        {rows.length > 0 ? <div className="fd-vchart">
          <div className="axis">{[...ticks].reverse().map((tick) => <span key={tick}>{tick === 0 ? '0' : formatWeight(tick)}</span>)}</div>
          <div className="plot">
            <div className="grid">{ticks.map((tick) => <i key={tick} />)}</div>
            <div className="cols">{rows.map((row, index) => <div key={row.key} className="col">
              <div className="barwrap" style={{ '--h': `${weightScale ? (row.weight / weightScale) * 100 : 0}%` }}><span className="val">{formatWeight(row.weight)}</span><i style={{ height: `${weightScale ? (row.weight / weightScale) * 100 : 0}%`, background: COLORS[index % COLORS.length] }} /></div>
              <span className="lbl">{firstName(row.name)}</span></div>)}</div>
          </div>
        </div> : <p className="empty-state">Nenhum peso para os filtros selecionados.</p>}
      </section>
    </div>

    <div className="fd-two fd-two-wide">
      <section className="fd-card" aria-label="Resumo da semana">
        <h2 className="fd-h2"><CalendarDays size={20} /> Resumo da Semana <small>(em aberto)</small></h2>
        <p className="fd-sub"><span>Somente tickets em aberto</span><span>Fechamento: Qui, {brShort(thursday)}</span><span>Pagamento: Sex, {brShort(friday)}</span></p>
        <div className="fd-scroll"><table className="fd-table">
          <thead><tr><th>Motorista</th><th>Tickets</th><th>Peso (t)</th><th>Em aberto (R$)</th></tr></thead>
          <tbody>{week.rows.map((row) => <tr key={row.key} style={{ '--c': colorOf(row.key) }}>
            <td><span className="who"><span className="av">{initials(row.name)}</span>{row.name}</span></td>
            <td>{row.tickets}</td><td>{formatWeight(row.weight)}</td><td className="v">{money(row.amount)}</td></tr>)}</tbody>
          {week.rows.length > 0 && <tfoot><tr><td>Total da Semana</td><td>{week.totals.tickets}</td><td>{formatWeight(week.totals.weight)}</td><td>{money(week.totals.amount)}</td></tr></tfoot>}
        </table></div>
        {!week.rows.length && <p className="empty-state">Nenhum ticket em aberto.</p>}
      </section>

      <section className="fd-card" aria-label="Resumo total">
        <h2 className="fd-h2"><ClipboardList size={20} /> Resumo Total <small>({periodLabel})</small></h2>
        <ul className="fd-total-list">
          <li style={{ '--c': '#3b82f6' }}><span className="ico"><Ticket size={20} /></span><span>Total de Tickets</span><b>{totals.tickets.toLocaleString('pt-BR')}</b></li>
          <li style={{ '--c': '#8b5cf6' }}><span className="ico"><Weight size={20} /></span><span>Peso Total</span><b>{formatWeight(totals.weight)}</b></li>
          <li style={{ '--c': '#10b981' }}><span className="ico"><BadgeDollarSign size={20} /></span><span>Valor Total</span><b>{money(totals.amount)}</b></li>
          <li style={{ '--c': '#f59e0b' }}><span className="ico"><Truck size={20} /></span><span>Em Aberto</span><b>{money(totals.open)}</b></li>
          <li style={{ '--c': '#f97316' }}><span className="ico"><Hourglass size={20} /></span><span>Aguardando Ticket</span><b>{money(totals.preview)}</b></li>
        </ul>
      </section>
    </div>
  </div>;
}
