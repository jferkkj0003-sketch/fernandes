import ResponsiveTable from './ResponsiveTable';
import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, ClipboardList, CreditCard, RefreshCw, Truck, Weight, Sun, Moon } from 'lucide-react';
import { cloudConfigured, loadSharedDashboard } from './lib/cloud';

const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const dateISO = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const monthISO = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const formatWeight = (value) => value === null ? 'Peso indisponível' : `${Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`;

function Metric({ icon: Icon, label, value, foot, tint }) {
  return <article className="shared-metric">
    <span className={`shared-metric-icon ${tint}`}><Icon size={18} /></span>
    <span className="shared-metric-label">{label}</span>
    <strong>{value}</strong>
    <small>{foot}</small>
  </article>;
}

function DriverWeightDonut({ rows, openOnly }) {
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
    <h2>{openOnly ? 'Peso em aberto por motorista' : 'Peso total por motorista'}</h2>
    <p className="shared-payment-description">{openOnly ? 'Peso dos tickets em aberto.' : 'Peso de todos os tickets do período.'}</p>
    {rows.some((row) => row.weight === null) ? <p className="shared-empty">Peso em aberto indisponível para este filtro.</p> : total > 0 ? <div className="shared-weight-layout">
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
  const [view, setView] = useState('open');
  const openOnly = view === 'open';
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
    const rows = (data?.drivers_by_day || []).filter((row) => (!openOnly || Number(row.open_count || 0) > 0) && (!period.start || row.date >= period.start) && (!period.end || row.date <= period.end) && (!driverFilter || row.driver === driverFilter));
    const byDriver = new Map();
    rows.forEach((row) => {
      const current = byDriver.get(row.driver) || { driver: row.driver, count: 0, weight: 0, amount: 0 };
      current.count += Number((openOnly ? row.open_count : row.count) || 0);
      current.amount += Number((openOnly ? row.open_amount : row.amount) || 0);
      // Older summaries only expose total weight. It is exact for open tickets
      // only when every ticket in this driver/day group is still open.
      const weight = !openOnly ? Number(row.weight || 0) : row.open_weight != null ? Number(row.open_weight) : Number(row.open_count) === Number(row.count) ? Number(row.weight || 0) : null;
      current.weight = current.weight === null || weight === null ? null : current.weight + weight;
      byDriver.set(row.driver, current);
    });
    const ranked = [...byDriver.values()].sort((a, b) => b.amount - a.amount || a.driver.localeCompare(b.driver, 'pt-BR'));
    return {
      ticketCount: ranked.reduce((sum, row) => sum + row.count, 0),
      weight: ranked.some((row) => row.weight === null) ? null : ranked.reduce((sum, row) => sum + row.weight, 0),
      amount: ranked.reduce((sum, row) => sum + row.amount, 0),
      openCount: rows.reduce((sum, row) => sum + Number(row.open_count || 0), 0),
      openAmount: rows.reduce((sum, row) => sum + Number(row.open_amount || 0), 0),
      ranked,
    };
  }, [data, period, driverFilter, openOnly]);

  if (loading) return <main className="shared-stage"><section className="shared-card"><img src={theme === 'dark' ? '/logo-controle-de-fretes-dark.svg' : '/logo-controle-de-fretes.svg'} alt="Controle de Fretes" /><p>Carregando painel compartilhado…</p></section></main>;
  if (loadError) return <main className="shared-stage"><section className="shared-card"><AlertCircle size={32} /><h1>Link indisponível</h1><p>{loadError}</p><button className="button secondary" onClick={refresh}><RefreshCw size={15} /> Tentar novamente</button></section></main>;

  return <main className="shared-dashboard">
    <header className="shared-header"><div className="shared-header-brand"><img src={theme === 'dark' ? '/logo-controle-de-fretes-dark.svg' : '/logo-controle-de-fretes.svg'} alt="Controle de Fretes" /><div><span>PAINEL DE ACOMPANHAMENTO</span><h1>Controle de fretes</h1></div></div><button className="icon-button theme-toggle shared-theme-toggle" type="button" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'} title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'} aria-pressed={theme === 'dark'}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button></header>
    <nav className="shared-view-tabs" aria-label="Visão do acompanhamento"><button className={openOnly ? 'active' : ''} aria-pressed={openOnly} onClick={() => setView('open')}><ClipboardList size={18} /><span>Em aberto<small>Conferir o que falta pagar</small></span></button><button className={!openOnly ? 'active' : ''} aria-pressed={!openOnly} onClick={() => setView('all')}><Truck size={18} /><span>Visão geral<small>Todos os tickets, abertos e fechados</small></span></button></nav>
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
        <div className="shared-view-context"><div><h2>{openOnly ? 'Em aberto para pagamento' : 'Resumo geral da operação'}</h2><p>{range === 'all' ? 'Todo o período' : [period.start, period.end].map((date) => date ? date.split('-').reverse().join('/') : 'Sem limite').join(' a ')} · {driverFilter || 'Todos os motoristas'}</p></div><span className="shared-view-badge">{openOnly ? 'Somente em aberto' : 'Abertos + fechados'}</span></div>
        {!openOnly && <p className="shared-overview-open">Dentro deste filtro, ainda estão em aberto: <strong>{money(summary.openAmount)}</strong> em {summary.openCount.toLocaleString('pt-BR')} ticket(s).</p>}
        <section className="shared-metrics" aria-label={openOnly ? 'Resumo em aberto' : 'Resumo geral'}>
          <Metric icon={ClipboardList} label={openOnly ? 'Tickets em aberto' : 'Total de tickets'} value={summary.ticketCount.toLocaleString('pt-BR')} foot={openOnly ? 'Aguardando fechamento' : 'Abertos e fechados no filtro'} tint="amber" />
          <Metric icon={Weight} label={openOnly ? 'Peso total em aberto' : 'Peso total transportado'} value={formatWeight(summary.weight)} foot={openOnly ? 'Somente dos tickets em aberto' : 'Todos os tickets do filtro'} tint="violet" />
          <Metric icon={CreditCard} label={openOnly ? 'Total em aberto para pagar' : 'Valor líquido total'} value={money(summary.amount)} foot="Valor líquido após descontos" tint="green" />
        </section>
        <section className="shared-ranking shared-payment-panel">
          <h2>{openOnly ? 'Quanto pagar por motorista' : 'Resultado por motorista'}</h2>
          <p className="shared-payment-description">{openOnly ? 'Quantidade, peso e valor líquido apenas dos tickets em aberto.' : 'Todos os tickets do filtro. O valor total inclui os já fechados.'}</p>
          {summary.ranked.length ? <div className="table-wrap"><ResponsiveTable><thead><tr><th>MOTORISTA</th><th>{openOnly ? 'TICKETS EM ABERTO' : 'TICKETS'}</th><th>{openOnly ? 'PESO EM ABERTO' : 'PESO TOTAL'}</th><th>{openOnly ? 'TOTAL A PAGAR' : 'VALOR LÍQUIDO'}</th></tr></thead><tbody>{summary.ranked.map((row) => <tr key={row.driver}><td><strong>{row.driver}</strong></td><td>{row.count.toLocaleString('pt-BR')}</td><td>{formatWeight(row.weight)}</td><td className="shared-payment-amount"><strong>{money(row.amount)}</strong></td></tr>)}</tbody><tfoot><tr><th>{openOnly ? 'TOTAL EM ABERTO' : 'TOTAL GERAL'}</th><td>{summary.ticketCount.toLocaleString('pt-BR')}</td><td>{formatWeight(summary.weight)}</td><td className="shared-payment-amount"><strong>{money(summary.amount)}</strong></td></tr></tfoot></ResponsiveTable></div> : <p className="shared-empty">Nenhum ticket para os filtros selecionados.</p>}
        </section>
        <DriverWeightDonut rows={summary.ranked} openOnly={openOnly} />
      </>}
    <footer className="shared-footer">Dados atualizados ao abrir ou atualizar este painel · Acesso somente para consulta</footer>
  </main>;
}

