import React, { useEffect, useMemo, useState } from 'react';
import { BadgeDollarSign, CalendarDays, ChevronDown, ClipboardList, Hourglass, Plus, Ticket, Truck, Weight } from 'lucide-react';
import { supabase } from './lib/cloud';
import FreightCharts from './ConsultationValueChart';
import { makeDriverColorMap } from './lib/driver-colors';
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
const STATUS = [['all', 'Todos'], ['open', 'Em aberto'], ['waiting', 'Fechado'], ['requested', 'Solicitado'], ['paid', 'Pago'], ['preview', 'Aguardando ticket']];

function aggregate(list) {
  const byDriver = new Map();
  const totals = { tickets: 0, weight: 0, amount: 0, open: 0, preview: 0, previewCount: 0 };
  for (const record of list) {
    if (!byDriver.has(record.key)) {
      byDriver.set(record.key, { key: record.key, name: record.name, tickets: 0, weight: 0, amount: 0, preview: 0 });
    }
    const row = byDriver.get(record.key);
    row.amount += record.amount;
    totals.amount += record.amount;
    if (record.status === 'preview') {
      row.preview += record.amount;
      totals.preview += record.amount;
      totals.previewCount += 1;
      continue;
    }
    row.tickets += 1;
    row.weight += record.weight;
    totals.tickets += 1;
    totals.weight += record.weight;
    if (record.status === 'open') totals.open += record.amount;
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

  const drivers = useMemo(() => driverOptions(driverRecords, records.map((record) => ({
    driverId: record.key, driver: record.name,
  }))), [driverRecords, records]);
  const driverColorMap = useMemo(() => makeDriverColorMap(drivers.map((driver) => driver.key)), [drivers]);

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
  // O próximo fechamento inclui tickets em aberto e cargas já previstas até quinta.
  const week = useMemo(() => aggregate(records.filter((record) =>
    (record.status === 'open' || (record.status === 'preview' && record.date <= thursday))
    && (driverFilter === 'Todos' || record.key === driverFilter))), [records, driverFilter, thursday]);
  const { rows, totals } = main;
  const colorOf = (key) => driverColorMap.get(key);

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
      <div className="fd-kpi" style={{ '--c': '#0A84FF' }}><span className="fd-kpi-ico"><Ticket size={26} /></span><div><small>Total de Tickets</small><strong>{totals.tickets.toLocaleString('pt-BR')}</strong></div></div>
      <div className="fd-kpi" style={{ '--c': '#BF5AF2' }}><span className="fd-kpi-ico"><Weight size={26} /></span><div><small>Peso Total</small><strong>{formatWeight(totals.weight)}</strong></div></div>
      <div className="fd-kpi" style={{ '--c': '#30D158' }}><span className="fd-kpi-ico"><BadgeDollarSign size={28} /></span><div><small>Valor Total</small><strong>{money(totals.amount)}</strong></div></div>
    </section>

    {alerts.length > 0 && <section className="fd-alerts" aria-label="Precisa de atenção">
      {alerts.map((alert) => <div key={alert.text} className="fd-alert"><i style={{ background: alert.color }} /><span>{alert.text}</span><button type="button" onClick={() => goTo(alert.page)}>{alert.action}</button></div>)}
    </section>}

    <FreightCharts rows={rows} periodLabel={periodLabel} colorFor={colorOf} formatWeight={formatWeight} />

    <div className="fd-two fd-two-wide">
      <section className="fd-card" aria-label="Resumo da semana">
        <h2 className="fd-h2"><CalendarDays size={20} /> Resumo da Semana <small>(em aberto)</small></h2>
        <p className="fd-sub"><span>Tickets em aberto e prévias pendentes</span><span>Fechamento: Qui, {brShort(thursday)}</span><span>Pagamento: Sex, {brShort(friday)}</span></p>
        <div className="fd-scroll"><table className="fd-table">
          <thead><tr><th>Motorista</th><th>Tickets</th><th>Peso (t)</th><th>Prévias (R$)</th><th>Valor total (R$)</th></tr></thead>
          <tbody>{week.rows.map((row) => <tr key={row.key} style={{ '--c': colorOf(row.key) }}>
            <td><span className="who"><span className="av">{initials(row.name)}</span>{row.name}</span></td>
            <td>{row.tickets}</td><td>{formatWeight(row.weight)}</td><td>{row.preview ? money(row.preview) : '—'}</td><td className="v">{money(row.amount)}</td></tr>)}</tbody>
          {week.rows.length > 0 && <tfoot><tr><td>Total da Semana</td><td>{week.totals.tickets}</td><td>{formatWeight(week.totals.weight)}</td><td>{money(week.totals.preview)}</td><td>{money(week.totals.amount)}</td></tr></tfoot>}
        </table></div>
        {!week.rows.length && <p className="empty-state">Nenhum ticket em aberto ou prévia pendente.</p>}
      </section>

      <section className="fd-card" aria-label="Resumo total">
        <h2 className="fd-h2"><ClipboardList size={20} /> Resumo Total <small>({periodLabel})</small></h2>
        <ul className="fd-total-list">
          <li style={{ '--c': '#0A84FF' }}><span className="ico"><Ticket size={20} /></span><span>Total de Tickets</span><b>{totals.tickets.toLocaleString('pt-BR')}</b></li>
          <li style={{ '--c': '#BF5AF2' }}><span className="ico"><Weight size={20} /></span><span>Peso Total</span><b>{formatWeight(totals.weight)}</b></li>
          <li style={{ '--c': '#30D158' }}><span className="ico"><BadgeDollarSign size={20} /></span><span>Valor Total</span><b>{money(totals.amount)}</b></li>
          <li style={{ '--c': '#FF9F0A' }}><span className="ico"><Truck size={20} /></span><span>Em Aberto</span><b>{money(totals.open)}</b></li>
          <li style={{ '--c': '#FF9F0A' }}><span className="ico"><Hourglass size={20} /></span><span>Aguardando Ticket</span><b>{money(totals.preview)}</b></li>
        </ul>
      </section>
    </div>
  </div>;
}
