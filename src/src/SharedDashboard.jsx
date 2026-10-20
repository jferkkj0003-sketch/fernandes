import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, Check, ClipboardList, CreditCard, RefreshCw, Truck, Weight, Sun, Moon } from 'lucide-react';
import { cloudConfigured, loadSharedDashboard } from './lib/cloud';

const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const dateISO = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const monthISO = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const formatWeight = (value) => `${Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`;

function Metric({ icon: Icon, label, value, foot, tint }) {
  return <article className="shared-metric">
    <span className={`shared-metric-icon ${tint}`}><Icon size={18} /></span>
    <span className="shared-metric-label">{label}</span>
    <strong>{value}</strong>
    <small>{foot}</small>
  </article>;
}

function DriverRanking({ title, metric, rows, value, formatter, tint }) {
  const max = Math.max(1, ...rows.map((row) => Number(row[metric] || 0)));
  return <section className="shared-ranking">
    <h2>{title}</h2>
    {rows.length ? <div className="shared-ranking-list">{rows.map((row) => <div className="shared-ranking-row" key={row.driver}>
      <div className="shared-ranking-label"><strong>{row.driver}</strong><span>{formatter(row[metric])}</span></div>
      <div className="shared-ranking-track"><span className={tint} style={{ width: `${Math.max(3, (Number(row[metric] || 0) / max) * 100)}%` }} /></div>
    </div>)}</div> : <p className="shared-empty">Nenhum ticket neste período.</p>}
  </section>;
}

function DriverWeightDonut({ rows }) {
  const weighted = [...rows].filter((row) => row.weight > 0).sort((a, b) => b.weight - a.weight);
  const total = weighted.reduce((sum, row) => sum + row.weight, 0);
  const colors = ['#3478ea', '#2a9b72', '#e5a631', '#8b6bd6', '#e16c55', '#28a6b5', '#ce6ba5', '#8291a5'];
  let position = 0;
  const gradient = weighted.map((row, index) => {
    const start = position;
    position += row.weight / total * 100;
    return `${colors[index % colors.length]} ${start}% ${position}%`;
  }).join(', ');
  return <section className="shared-ranking shared-weight-panel">
    <h2>Peso por motorista</h2>
    <p className="shared-payment-description">Distribuição do peso transportado conforme o motorista e o período selecionados.</p>
    {total > 0 ? <div className="shared-weight-layout">
      <div className="shared-weight-donut" role="img" aria-label={`Peso total: ${formatWeight(total)}. ${weighted.map((row) => `${row.driver}: ${formatWeight(row.weight)}`).join('; ')}`} style={{ background: `conic-gradient(${gradient})` }}><div><strong>{formatWeight(total)}</strong><span>Peso total</span></div></div>
      <div className="shared-weight-legend">{weighted.map((row, index) => <div className="shared-weight-item" key={row.driver}><span className="shared-weight-swatch" style={{ background: colors[index % colors.length] }} /><strong>{row.driver}</strong><div><b>{formatWeight(row.weight)}</b><small>{(row.weight / total * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</small></div></div>)}</div>
    </div> : <p className="shared-empty">Nenhum peso registrado para os filtros selecionados.</p>}
  </section>;
}

export default function SharedDashboard({ token }) {
  const [theme, setTheme] = useState(() => window.localStorage.getItem('dde-fretes-theme') === 'dark' ? 'dark' : 'light');
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('all');
  const [month, setMonth] = useState(() => monthISO(new Date()));
  const [customStart, setCustomStart] = useState(() => dateISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customEnd, setCustomEnd] = useState(() => dateISO(new Date()));
  const [driverFilter, setDriverFilter] = useState('');

  async function refresh() {
    setLoading(true);
    setLoadError('');
    try {
      if (!cloudConfigured) throw new Error('O painel não está conectado ao banco de dados.');
      setData(await loadSharedDashboard(token));
    } catch {
      setLoadError('Este link não existe mais ou foi desativado. Peça ao responsável um novo link.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, [token]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('dde-fretes-theme', theme);
  }, [theme]);

  const period = useMemo(() => {
    const today = new Date();
    if (range === 'week') {
      const start = new Date(today);
      start.setDate(today.getDate() - 6);
      return { start: dateISO(start), end: dateISO(today) };
    }
    if (range === 'month') {
      const [year, monthNumber] = month.split('-').map(Number);
      return { start: dateISO(new Date(year, monthNumber - 1, 1)), end: dateISO(new Date(year, monthNumber, 0)) };
    }
    if (range === 'custom') return { start: customStart, end: customEnd };
    return { start: '', end: '' };
  }, [range, month, customStart, customEnd]);

  const driverNames = useMemo(() => [...new Set((data?.drivers_by_day || []).map((row) => row.driver).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [data]);

  const summary = useMemo(() => {
    const inPeriod = (row) => (!period.start || row.date >= period.start) && (!period.end || row.date <= period.end);
    const tickets = (data?.drivers_by_day || []).filter((row) => inPeriod(row) && (!driverFilter || row.driver === driverFilter));
    const closures = (data?.closures_by_day || []).filter((row) => inPeriod(row) && (!driverFilter || row.driver === driverFilter));
    const byDriver = new Map();
    tickets.forEach((row) => {
      const current = byDriver.get(row.driver) || { driver: row.driver, count: 0, weight: 0, amount: 0, openCount: 0, openAmount: 0, awaitingAmount: 0, requestedAmount: 0 };
      current.count += Number(row.count || 0);
      current.weight += Number(row.weight || 0);
      current.amount += Number(row.amount || 0);
      current.openCount += Number(row.open_count || 0);
      current.openAmount += Number(row.open_amount || 0);
      byDriver.set(row.driver, current);
    });
    closures.forEach((row) => {
      const current = byDriver.get(row.driver) || { driver: row.driver, count: 0, weight: 0, amount: 0, openCount: 0, openAmount: 0, awaitingAmount: 0, requestedAmount: 0 };
      if (row.status === 'Aguardando envio') current.awaitingAmount += Number(row.total || 0);
      if (row.status === 'Solicitado') current.requestedAmount += Number(row.total || 0);
      byDriver.set(row.driver, current);
    });
    const ranked = [...byDriver.values()];
    const awaiting = closures.filter((row) => row.status === 'Aguardando envio');
    const requested = closures.filter((row) => row.status === 'Solicitado');
    return {
      ticketCount: ranked.reduce((sum, row) => sum + row.count, 0),
      weight: ranked.reduce((sum, row) => sum + row.weight, 0),
      amount: ranked.reduce((sum, row) => sum + row.amount, 0),
      openCount: tickets.reduce((sum, row) => sum + Number(row.open_count || 0), 0),
      openAmount: tickets.reduce((sum, row) => sum + Number(row.open_amount || 0), 0),
      awaitingCount: awaiting.reduce((sum, row) => sum + Number(row.count || 0), 0),
      awaitingAmount: awaiting.reduce((sum, row) => sum + Number(row.total || 0), 0),
      requestedCount: requested.reduce((sum, row) => sum + Number(row.count || 0), 0),
      requestedAmount: requested.reduce((sum, row) => sum + Number(row.total || 0), 0),
      ranked: ranked.sort((a, b) => b.count - a.count || b.weight - a.weight),
    };
  }, [data, period, driverFilter]);

  if (loading) return <main className="shared-stage"><section className="shared-card"><img src="/logo-controle-de-fretes.svg" alt="Controle de Fretes" /><p>Carregando painel compartilhado…</p></section></main>;
  if (loadError) return <main className="shared-stage"><section className="shared-card"><AlertCircle size={32} /><h1>Link indisponível</h1><p>{loadError}</p><button className="button secondary" onClick={refresh}><RefreshCw size={15} /> Tentar novamente</button></section></main>;

  return <main className="shared-dashboard">
    <header className="shared-header"><div className="shared-header-brand"><img src="/logo-controle-de-fretes.svg" alt="Controle de Fretes" /><div><span>PAINEL DE ACOMPANHAMENTO</span><h1>Resumo da operação</h1></div></div><button className="icon-button theme-toggle shared-theme-toggle" type="button" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'} title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'} aria-pressed={theme === 'dark'}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button></header>
    <section className="shared-toolbar">
      <div className="shared-range-tabs" aria-label="Filtrar período">
        <button className={range === 'week' ? 'active' : ''} onClick={() => setRange('week')}>Últimos 7 dias</button>
        <button className={range === 'month' ? 'active' : ''} onClick={() => setRange('month')}>Por mês</button>
        <button className={range === 'all' ? 'active' : ''} onClick={() => setRange('all')}>Todo período</button>
        <button className={range === 'custom' ? 'active' : ''} onClick={() => setRange('custom')}>Personalizado</button>
      </div>
      {range === 'month' && <label className="shared-date-select"><CalendarDays size={15} /><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>}
      {range === 'custom' && <div className="shared-custom-dates"><label>De<input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label><label>Até<input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label></div>}
      <label className="shared-driver-select"><Truck size={15} /><select value={driverFilter} onChange={(event) => setDriverFilter(event.target.value)}><option value="">Todos os motoristas</option>{driverNames.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
    </section>

    {period.start && period.end && period.start > period.end
      ? <div className="shared-error"><AlertCircle size={17} /> A data inicial precisa ser anterior ou igual à data final.</div>
      : <>
        <section className="shared-metrics">
          <Metric icon={Truck} label="Entregas" value={summary.ticketCount.toLocaleString('pt-BR')} foot="Tickets registrados no período" tint="blue" />
          <Metric icon={Weight} label="Peso total" value={formatWeight(summary.weight)} foot="Peso das entregas no período" tint="violet" />
          <Metric icon={CreditCard} label="Valor total" value={money(summary.amount)} foot="Valor líquido dos tickets" tint="green" />
          <article className="shared-metric shared-open-metric" aria-live="polite">
            <span className="shared-metric-icon amber"><ClipboardList size={18} /></span>
            <span className="shared-metric-label">Tickets em aberto</span>
            <strong>{money(summary.openAmount)}</strong>
            <small>Em aberto para pagar · {summary.openCount.toLocaleString('pt-BR')} ticket(s)</small>
          </article>
          <Metric icon={ClipboardList} label="Fechamentos aguardando envio" value={summary.awaitingCount.toLocaleString('pt-BR')} foot={`${money(summary.awaitingAmount)} em fechamentos`} tint="violet" />
          <Metric icon={Check} label="Fechamentos solicitados" value={summary.requestedCount.toLocaleString('pt-BR')} foot={`${money(summary.requestedAmount)} em fechamentos`} tint="blue" />
        </section>
        <DriverWeightDonut rows={summary.ranked} />
        <section className="shared-ranking shared-payment-panel">
          <h2>Valores por motorista para pagamento</h2>
          <p className="shared-payment-description">Confira o valor líquido e o peso de cada motorista no período selecionado. Os valores em aberto ainda aguardam fechamento.</p>
          {summary.ranked.length ? <div className="table-wrap"><table><thead><tr><th>MOTORISTA</th><th>TICKETS</th><th>PESO TOTAL</th><th>VALOR TOTAL DOS TICKETS</th><th>EM ABERTO</th><th>AGUARDANDO ENVIO</th><th>SOLICITADO POR E-MAIL</th></tr></thead><tbody>{summary.ranked.map((row) => <tr key={row.driver}><td><strong>{row.driver}</strong></td><td>{row.count.toLocaleString('pt-BR')}</td><td>{formatWeight(row.weight)}</td><td><strong>{money(row.amount)}</strong></td><td><strong>{money(row.openAmount)}</strong><small className="shared-open-count">{row.openCount.toLocaleString('pt-BR')} ticket(s)</small></td><td>{money(row.awaitingAmount)}</td><td>{money(row.requestedAmount)}</td></tr>)}</tbody><tfoot><tr><th>TOTAL DO FILTRO</th><td>{summary.ticketCount.toLocaleString('pt-BR')}</td><td>{formatWeight(summary.weight)}</td><td><strong>{money(summary.amount)}</strong></td><td><strong>{money(summary.openAmount)}</strong></td><td>{money(summary.awaitingAmount)}</td><td>{money(summary.requestedAmount)}</td></tr></tfoot></table></div> : <p className="shared-empty">Nenhum registro para os filtros selecionados.</p>}
        </section>
        <div className="shared-rankings">
          <DriverRanking title="Entregas por motorista" metric="count" rows={summary.ranked} formatter={(value) => `${Number(value || 0).toLocaleString('pt-BR')} entregas`} tint="blue" />
          <DriverRanking title="Peso total por motorista" metric="weight" rows={summary.ranked} formatter={formatWeight} tint="violet" />
          <DriverRanking title="Valor por motorista" metric="amount" rows={summary.ranked} formatter={money} tint="green" />
        </div>
        <div className="shared-note"><AlertCircle size={17} /><span>O valor total soma os tickets do período, já com os descontos. As colunas de fechamento seguem a data do fechamento. “Solicitado por e-mail” registra a solicitação; não confirma pagamento realizado.</span></div>
      </>}
    <footer className="shared-footer">Dados atualizados ao abrir ou atualizar este painel · Acesso somente para consulta</footer>
  </main>;
}
