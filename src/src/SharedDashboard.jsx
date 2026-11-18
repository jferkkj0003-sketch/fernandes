import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, Check, CircleDollarSign, Hourglass, Info, Layers, Moon, RefreshCw, Sun, Ticket, Truck, Users, Weight } from 'lucide-react';
import { cloudConfigured, loadSharedDashboard } from './lib/cloud';
import FreightCharts from './ConsultationValueChart';
import { consultationPeriodSummary } from './lib/consultation-period';
import './consultation-panel.css';
import { isCurrentRequest, requestArchiveAt } from './lib/request-cycle';
import { operationalSummary, sharedPaymentSummary } from './lib/shared-payments';

const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const fmtWeight = (value) => value === null || value === undefined ? '—' : Number(value) >= 1000
  ? `${(Number(value) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} t`
  : `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`;
const dateISO = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const monthISO = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const shiftDays = (iso, days) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + days); return dateISO(d); };
const nextFriday = (iso) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + (5 - d.getDay() + 7) % 7); return dateISO(d); };
const brShort = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const brFull = (iso) => iso.split('-').reverse().join('/');
const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
const AVATARS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];
const sum = (list, field) => list.reduce((total, item) => total + (Number(item[field]) || 0), 0);

// Data da última modificação (fuso de Manaus), ex.: "18/11/2026 às 08:15".
function formatModified(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const opts = { timeZone: 'America/Manaus' };
  return `${date.toLocaleDateString('pt-BR', { ...opts, day: '2-digit', month: '2-digit', year: 'numeric' })} às ${date.toLocaleTimeString('pt-BR', { ...opts, hour: '2-digit', minute: '2-digit' })}`;
}

// Quando o banco não informa a data (migração ainda não aplicada) ou houve exclusão, registra o momento em que
// a mudança dos dados foi percebida neste aparelho. Na primeira visita não há como saber, então não inventa data.
function trackObservedChange(token, data) {
  const key = `dde-fretes-seen-${token.slice(0, 8)}`;
  const { last_modified: _ignored, ...rest } = data || {};
  const signature = JSON.stringify(rest);
  try {
    const previous = JSON.parse(window.localStorage.getItem(key) || 'null');
    if (!previous) { window.localStorage.setItem(key, JSON.stringify({ signature, changedAt: null })); return null; }
    if (previous.signature !== signature) { const next = { signature, changedAt: Date.now() }; window.localStorage.setItem(key, JSON.stringify(next)); return next.changedAt; }
    return previous.changedAt;
  } catch { return null; }
}

export default function SharedDashboard({ token }) {
  const [theme, setTheme] = useState(() => window.localStorage.getItem('dde-fretes-theme') !== 'light' ? 'dark' : 'light');
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState('all');
  const [scope, setScope] = useState('open');
  const [now, setNow] = useState(() => new Date());
  const [month, setMonth] = useState(() => monthISO(new Date()));
  const [customStart, setCustomStart] = useState(() => dateISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customEnd, setCustomEnd] = useState(() => dateISO(new Date()));
  const [driverFilter, setDriverFilter] = useState('');
  const [stale, setStale] = useState(false);
  const [lastModified, setLastModified] = useState('');

  async function refresh(silent = false) {
    if (!silent) setLoading(true); else setRefreshing(true);
    setLoadError('');
    try {
      if (!cloudConfigured) throw new Error('O painel não está conectado ao banco de dados.');
      const fresh = await loadSharedDashboard(token);
      setData(fresh);
      setStale(false);
      const observed = trackObservedChange(token, fresh);
      const times = [Date.parse(fresh.last_modified), observed].filter(Number.isFinite);
      setLastModified(times.length ? new Date(Math.max(...times)).toISOString() : '');
    } catch {
      if (silent) { setStale(true); return; }
      setLoadError('Este link não existe mais ou foi desativado. Peça ao responsável um novo link.');
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { refresh(); }, [token]);
  useEffect(() => {
    const update = () => { setNow(new Date()); refresh(true); };
    const visible = () => { if (document.visibilityState === 'visible') update(); };
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', visible);
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') update(); }, 30000);
    return () => { window.clearInterval(interval); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', visible); };
  }, [token]);
  useEffect(() => {
    const timestamp = now.getTime();
    const deadlines = (data?.closure_payments || []).filter((item) => item.email_status === 'Solicitado').map((item) => requestArchiveAt(item.sent_at)).filter(Boolean).map((date) => new Date(date).getTime()).filter((time) => time > timestamp);
    const delay = Math.min(30000, ...deadlines.map((time) => time - timestamp));
    const timer = window.setTimeout(() => setNow(new Date()), Math.max(1, delay));
    return () => window.clearTimeout(timer);
  }, [now, data]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('dde-fretes-theme', theme);
  }, [theme]);

  // Semana de pagamento: sexta a quinta; fechamento na quinta, pagamento na sexta seguinte.
  const cycle = useMemo(() => {
    const friday = nextFriday(dateISO(new Date()));
    return { start: shiftDays(friday, -7), end: shiftDays(friday, -1), friday, thursday: shiftDays(friday, -1) };
  }, [now.toDateString()]);

  const period = useMemo(() => {
    if (range === 'week') return { start: cycle.start, end: cycle.end };
    if (range === 'month') {
      const [year, monthNumber] = month.split('-').map(Number);
      return { start: dateISO(new Date(year, monthNumber - 1, 1)), end: dateISO(new Date(year, monthNumber, 0)) };
    }
    if (range === 'custom') return { start: customStart, end: customEnd };
    return { start: '', end: '' };
  }, [range, month, customStart, customEnd, cycle]);
  const invalidRange = Boolean(period.start && period.end && period.start > period.end);

  const driverNames = useMemo(() => [...new Set([...(data?.drivers_by_day || []), ...(data?.closure_payments || []), ...(data?.freight_previews || [])].map((row) => row.driver).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [data]);

  const view = useMemo(() => {
    const calc = period;
    const inPeriod = (day) => (!calc.start || day >= calc.start) && (!calc.end || day <= calc.end);
    const base = sharedPaymentSummary(data, calc, driverFilter);
    const open = operationalSummary(data, calc, driverFilter, 'open');
    const pending = base.closures.filter((closure) => closure.payment_status === 'pending');
    const requested = pending.filter((closure) => closure.email_status === 'Solicitado' && isCurrentRequest(closure, now));
    const waiting = pending.filter((closure) => closure.email_status !== 'Solicitado');
    const previews = (data?.freight_previews || []).filter((item) => (!driverFilter || item.driver === driverFilter) && !item.confirmed && !item.included_in_request && inPeriod(item.loading_date));
    const stage = (list) => ({ count: sum(list, 'filteredCount'), weight: sum(list, 'filteredWeight'), amount: sum(list, 'filteredTotal') });
    const sWaiting = stage(waiting), sRequested = stage(requested);
    const sPreview = { count: previews.length, amount: sum(previews, 'amount') };
    const confirmed = { count: open.ticketCount + sWaiting.count + sRequested.count, amount: open.amount + sWaiting.amount + sRequested.amount };
    const weights = [open.weight, base.closures.length ? sWaiting.weight + sRequested.weight : 0];
    confirmed.weight = weights.some((value) => value === null) ? null : weights[0] + weights[1];

    const map = new Map();
    const get = (name) => { if (!map.has(name)) map.set(name, { name, count: 0, weight: 0, confirmed: 0, waiting: 0 }); return map.get(name); };
    for (const row of open.ranked) { const item = get(row.driver); item.count += row.count; item.weight = item.weight === null || row.weight === null ? null : item.weight + row.weight; item.confirmed += row.amount; }
    for (const closure of [...waiting, ...requested]) { const item = get(closure.driver); item.count += closure.filteredCount; if (item.weight !== null) item.weight += closure.filteredWeight; item.confirmed += closure.filteredTotal; }
    for (const preview of previews) get(preview.driver).waiting += Number(preview.amount || 0);
    const rows = [...map.values()]
      .map((row) => ({ ...row, payable: row.confirmed + row.waiting }))
      .sort((a, b) => b.payable - a.payable || a.name.localeCompare(b.name, 'pt-BR'));
    const payable = { count: confirmed.count + sPreview.count, amount: confirmed.amount + sPreview.amount };
    const overall = consultationPeriodSummary(data, period, driverFilter);
    return { open, waiting: sWaiting, requested: sRequested, preview: sPreview, confirmed, payable, rows, overall };
  }, [data, period, driverFilter, now]);

  const logo = theme === 'dark' ? '/logo-controle-de-fretes-dark.svg' : '/logo-controle-de-fretes.svg';
  if (loading) return <main className="shared-stage"><section className="shared-card"><img src={logo} alt="Controle de Fretes" /><p>Carregando painel compartilhado…</p></section></main>;
  if (loadError) return <main className="shared-stage"><section className="shared-card"><AlertCircle size={32} /><h1>Link indisponível</h1><p>{loadError}</p><button className="button secondary" onClick={() => refresh()}><RefreshCw size={15} /> Tentar novamente</button></section></main>;

  const presets = [['week', 'Semana'], ['month', 'Mês'], ['all', 'Todo período'], ['custom', 'Datas']];
  const periodLabel = range === 'all' ? 'Todo o período' : `${period.start ? brFull(period.start) : 'Início'} – ${period.end ? brFull(period.end) : 'hoje'}`;
  const situation = [
    ['Em aberto', view.open.ticketCount, view.open.amount, '#10b981'],
    ['Aguardando ticket', view.preview.count, view.preview.amount, '#f59e0b'],
    ['Fechado (a enviar)', view.waiting.count, view.waiting.amount, '#3b82f6'],
    ['Solicitado', view.requested.count, view.requested.amount, '#8b5cf6'],
  ];

  return <main className="fx-page">
    <header className="fx-header">
      <span className="fx-logo"><Truck size={28} strokeWidth={2} /></span>
      <div className="fx-title"><h1>Controle de Fretes <small>– Controladoria</small></h1><p>Consulta, fechamento e valores por motorista</p></div>
      <div className={`fx-date${stale ? ' off' : ''}`}><CalendarDays size={20} /><div><small className="fx-date-label">Última modificação</small><b>{formatModified(lastModified) || '—'}</b>{stale && <small>Sem conexão · exibindo dados anteriores</small>}</div></div>
      <button type="button" className="fx-icon-btn" onClick={() => refresh(true)} aria-label="Atualizar agora"><RefreshCw size={22} className={refreshing ? 'fx-spin' : ''} /></button>
      <button type="button" className="fx-icon-btn" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}>{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}</button>
    </header>

    <section className="fx-card" aria-label="Visão da consulta">
      <div className="fx-chips fx-consultation-tabs" role="tablist" aria-label="Visão da consulta">
        <button id="consultation-open-tab" role="tab" aria-selected={scope === 'open'} aria-controls="consultation-content" className={scope === 'open' ? 'on' : ''} onClick={() => setScope('open')}>Fechamento em aberto</button>
        <button id="consultation-history-tab" role="tab" aria-selected={scope === 'history'} aria-controls="consultation-content" className={scope === 'history' ? 'on' : ''} onClick={() => setScope('history')}>Período completo</button>
      </div>
    </section>

    <section className="fx-card fx-filters" aria-label="Filtros">
      <div className="fx-chips" role="group" aria-label="Período">{presets.map(([key, label]) => <button key={key} type="button" className={range === key ? 'on' : ''} onClick={() => setRange(key)}>{label}</button>)}</div>
      <div className="fx-fields">
        <label className="fx-field"><span>Motorista</span><select value={driverFilter} onChange={(event) => setDriverFilter(event.target.value)}><option value="">Todos</option>{driverNames.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        {range === 'month' && <label className="fx-field"><span>Mês</span><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>}
        <label className="fx-field"><span>Data inicial</span><input type="date" value={period.start} max={period.end || undefined} onChange={(event) => { setCustomStart(event.target.value); setCustomEnd(period.end); setRange('custom'); }} /></label><label className="fx-field"><span>Data final</span><input type="date" value={period.end} min={period.start || undefined} onChange={(event) => { setCustomStart(period.start); setCustomEnd(event.target.value); setRange('custom'); }} /></label>
      </div>
      {(range === 'week' || range === 'month') && <div className="fx-period"><CalendarDays size={16} />{range === 'week' ? `Semana ${periodLabel}` : periodLabel}</div>}
    </section>

    {invalidRange ? <div className="fx-alert danger"><AlertCircle size={18} /> A data inicial precisa ser anterior ou igual à data final.</div> : <div id="consultation-content" role="tabpanel" aria-labelledby={scope === 'open' ? 'consultation-open-tab' : 'consultation-history-tab'}>
      <section className="fx-banner" aria-label="Fechamento">
        <span className="fx-banner-icon"><CalendarDays size={26} /></span>
        <div><h2>{scope === 'open' ? 'Fechamento em aberto' : 'Período completo'}</h2>
          {range === 'week' && scope === 'open'
            ? <p><span>Período: {brShort(cycle.start)} a {brShort(cycle.end)}</span><span>Fechamento: quinta, {brShort(cycle.thursday)}</span><span>Pagamento: sexta, {brShort(cycle.friday)}</span></p>
            : <p><span>{periodLabel}</span><span>{driverFilter || 'Todos os motoristas'}</span></p>}</div>
        <Truck className="fx-banner-truck" size={54} strokeWidth={1.2} />
      </section>

      {scope === 'open' ? <>
      <section className="fx-kpis" aria-label="Indicadores do fechamento em aberto">
        <div className="fx-kpi" style={{ '--c': '#3b82f6' }}><span className="fx-kpi-ico"><Ticket size={20} /></span><small>Tickets Confirmados</small><strong>{view.confirmed.count.toLocaleString('pt-BR')}</strong></div>
        <div className="fx-kpi" style={{ '--c': '#8b5cf6' }}><span className="fx-kpi-ico"><Weight size={20} /></span><small>Peso total</small><strong>{fmtWeight(view.confirmed.weight)}</strong></div>
        <div className="fx-kpi" style={{ '--c': '#10b981' }}><span className="fx-kpi-ico"><CircleDollarSign size={20} /></span><small>Em aberto</small><strong>{money(view.open.amount)}</strong></div>
        <div className="fx-kpi" style={{ '--c': '#f59e0b' }}><span className="fx-kpi-ico"><Hourglass size={20} /></span><small>Aguardando Ticket</small><strong>{money(view.preview.amount)}</strong></div>
        <div className="fx-kpi total" style={{ '--c': '#ec4899' }}><span className="fx-kpi-ico"><Check size={22} /></span><small>Total a pagar</small><strong>{money(view.payable.amount)}</strong></div>
      </section>

      <div className="fx-grid">
        <section className="fx-card fx-open-drivers" aria-label="Valores por motorista">
          <h2 className="fx-h2"><Users size={20} /> Valores por Motorista <small>({range === 'week' ? 'Semana' : range === 'all' ? 'Todo período' : 'Período'})</small></h2>
          <div className="fx-table">
            <div className="fx-tr fx-th"><span>Motorista</span><span className="t">Tickets</span><span className="w">Peso</span><span>Em carregamento</span><span>Valor total</span></div>
            {view.rows.map((row, index) => <div key={row.name} className="fx-tr fx-row" style={{ '--c': AVATARS[index % AVATARS.length] }}>
              <span className="who"><span className="fx-avatar">{initials(row.name)}</span><span className="nm"><b>{row.name}</b><small className="sub">{row.count} {row.count === 1 ? 'ticket' : 'tickets'} · {fmtWeight(row.weight)}</small></span></span>
              <span className="t">{row.count}</span><span className="w">{fmtWeight(row.weight)}</span>
              <span className="a">{row.waiting > 0 ? <><small className="fx-mobile-label">Em carregamento: </small>{money(row.waiting)}</> : '—'}</span><span className="c">{money(row.payable)}</span>
            </div>)}
            {!view.rows.length && <p className="fx-empty">Nenhum valor para os filtros selecionados.</p>}
          </div>
          {view.rows.length > 0 && <div className="fx-total-bar"><b>{range === 'week' ? 'Total da Semana' : 'Total'}</b><span className="t">{view.confirmed.count}</span><span className="w">{fmtWeight(view.confirmed.weight)}</span><span className="a">{money(view.preview.amount)}</span><span className="c">{money(view.payable.amount)}</span></div>}
        </section>

        <div className="fx-stack">
          <section className="fx-card" aria-label="Situação das cargas">
            <h2 className="fx-h2"><Layers size={18} /> Situação das Cargas</h2>
            <ul className="fx-situation">
              {situation.map(([label, count, amount, color]) => <li key={label}><i style={{ background: color }} /><span>{label}</span><em>{count}</em><b>{money(amount)}</b></li>)}
            </ul>
            <div className="fx-total-row slim"><span>Total a pagar</span><span>{view.payable.count}</span><b>{money(view.payable.amount)}</b></div>
          </section>

          {view.preview.count > 0 && <aside className="fx-alert warn"><Info size={20} /><div><strong>Atenção</strong><p>As cargas em “Aguardando ticket” já estão no total a pagar. O ticket ainda não foi emitido porque o motorista está carregando na fábrica.</p></div></aside>}
        </div>
      </div>

      </> : <>
        <section className="fx-kpis fx-history-kpis" aria-label="Indicadores do período completo">
          <div className="fx-kpi" style={{ '--c': '#3b82f6' }}><span className="fx-kpi-ico"><Ticket size={20} /></span><small>Total de tickets</small><strong>{view.overall.ticketCount.toLocaleString('pt-BR')}</strong></div>
          <div className="fx-kpi" style={{ '--c': '#8b5cf6' }}><span className="fx-kpi-ico"><Weight size={20} /></span><small>Peso total</small><strong>{fmtWeight(view.overall.weight)}</strong></div>
          <div className="fx-kpi" style={{ '--c': '#10b981' }}><span className="fx-kpi-ico"><CircleDollarSign size={20} /></span><small>Valor total</small><strong>{money(view.overall.amount)}</strong></div>
        </section>
        <section className="fx-card fx-history-drivers" aria-label="Motoristas no período completo">
          <h2 className="fx-h2"><Users size={20} /> Resumo por motorista <small>({periodLabel})</small></h2>
          <div className="fx-table fx-history-table">
            <div className="fx-tr fx-th"><span>Motorista</span><span className="t">Tickets</span><span className="w">Peso</span><span>Valor total</span></div>
            {view.overall.ranked.map((row, index) => <div key={row.driver} className="fx-tr fx-row" style={{ '--c': AVATARS[index % AVATARS.length] }}>
              <span className="who"><span className="fx-avatar">{initials(row.driver)}</span><span className="nm"><b>{row.driver}</b><small className="sub">{row.count} tickets · {fmtWeight(row.weight)}</small></span></span>
              <span className="t">{row.count}</span><span className="w">{fmtWeight(row.weight)}</span><span className="c">{money(row.amount)}</span>
            </div>)}
            {!view.overall.ranked.length && <p className="fx-empty">Nenhum ticket para as datas e o motorista selecionados.</p>}
          </div>
          {view.overall.ranked.length > 0 && <div className="fx-total-bar"><b>Total do período</b><span className="t">{view.overall.ticketCount}</span><span className="w">{fmtWeight(view.overall.weight)}</span><span className="c">{money(view.overall.amount)}</span></div>}
        </section>
      </>}

      <p className="fx-note">Na sexta-feira, às 17h de Manaus, as solicitações encerram o ciclo e permanecem no total geral.</p>
      <FreightCharts
        rows={scope === 'history'
          ? view.overall.ranked.map((row) => ({ key: row.driver, name: row.driver, amount: row.amount, weight: row.weight }))
          : view.rows.map((row) => ({ ...row, key: row.name, amount: row.payable }))}
        periodLabel={periodLabel}
        valueTitle={scope === 'history' ? 'Valor dos fretes por motorista' : 'Valor a pagar por motorista'}
        formatWeight={fmtWeight}
      />
    </div>}
    <footer className="fx-footer">Atualiza sozinho a cada 30 segundos · Acesso somente para consulta</footer>
  </main>;
}

