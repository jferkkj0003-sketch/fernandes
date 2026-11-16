import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, ClipboardList, CreditCard, Mail, FolderCheck, RefreshCw, Truck, Weight, Sun, Moon } from 'lucide-react';
import { cloudConfigured, loadSharedDashboard } from './lib/cloud';
import OverviewCharts from './OverviewCharts';
import FreightForecast from './FreightForecast';
import { requestArchiveAt } from './lib/request-cycle';
import { consultationSummary } from './lib/consultation';

const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const dateISO = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const monthISO = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const formatWeight = (value) => value === null ? 'Peso indisponível' : `${Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`;

function SummaryCard({ icon: Icon, title, description, values, tint }) {
  return <article className={`shared-metric consultation-card ${tint}`}>
    <div className="consultation-card-heading"><span className={`shared-metric-icon ${tint}`}><Icon size={18} /></span><h2>{title}</h2></div>
    <p>{description}</p><strong>{money(values.amount)}</strong>
    <div className="consultation-card-weight"><span>Peso</span><b>{formatWeight(values.weight)}</b></div>
  </article>;
}

export default function SharedDashboard({ token }) {
  const [theme, setTheme] = useState(() => window.localStorage.getItem('dde-fretes-theme') === 'dark' ? 'dark' : 'light');
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('all');
  const [now, setNow] = useState(() => new Date());
  const [month, setMonth] = useState(() => monthISO(new Date()));
  const [customStart, setCustomStart] = useState(() => dateISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customEnd, setCustomEnd] = useState(() => dateISO(new Date()));
  const [driverFilter, setDriverFilter] = useState('');

  async function refresh(silent = false) {
    if (!silent) setLoading(true);
    setLoadError('');
    try {
      if (!cloudConfigured) throw new Error('O painel não está conectado ao banco de dados.');
      setData(await loadSharedDashboard(token));
    } catch {
      if (silent) return;
      setLoadError('Este link não existe mais ou foi desativado. Peça ao responsável um novo link.');
      setData(null);
    } finally {
      setLoading(false);
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
  }, [range, month, customStart, customEnd, now.toDateString()]);

  const driverNames = useMemo(() => [...new Set([...(data?.drivers_by_day || []), ...(data?.closure_payments || []), ...(data?.freight_previews || [])].map((row) => row.driver).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [data]);

  const summary = useMemo(() => consultationSummary(data, period, driverFilter, now), [data, period, driverFilter, now]);

  if (loading) return <main className="shared-stage"><section className="shared-card"><img src={theme === 'dark' ? '/logo-controle-de-fretes-dark.svg' : '/logo-controle-de-fretes.svg'} alt="Controle de Fretes" /><p>Carregando painel compartilhado…</p></section></main>;
  if (loadError) return <main className="shared-stage"><section className="shared-card"><AlertCircle size={32} /><h1>Link indisponível</h1><p>{loadError}</p><button className="button secondary" onClick={refresh}><RefreshCw size={15} /> Tentar novamente</button></section></main>;

  return <main className="shared-dashboard">
    <header className="shared-header"><div className="shared-header-brand"><img src={theme === 'dark' ? '/logo-controle-de-fretes-dark.svg' : '/logo-controle-de-fretes.svg'} alt="Controle de Fretes" /><div><span>PAINEL DE ACOMPANHAMENTO</span><h1>Controle de fretes</h1></div></div><button className="icon-button theme-toggle shared-theme-toggle" type="button" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'} title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'} aria-pressed={theme === 'dark'}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button></header>
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
        <div className="shared-view-context"><div><h2>Resumo da operação</h2><p>{range === 'all' ? 'Todo o período' : [period.start, period.end].map((date) => date ? date.split('-').reverse().join('/') : 'Sem limite').join(' a ')} · {driverFilter || 'Todos os motoristas'}</p></div><span className="shared-view-badge">Somente consulta</span></div>
        <section className="consultation-summary" aria-label="Resumo da operação por situação">
          <SummaryCard icon={ClipboardList} title="Em aberto" description="Ainda sem fechamento" values={summary.open} tint="amber" />
          <SummaryCard icon={FolderCheck} title="Fechados" description="Aguardando envio por e-mail" values={summary.waiting} tint="violet" />
          <SummaryCard icon={Mail} title="Solicitados por e-mail" description="Ciclo atual · até sexta às 17h de Manaus" values={summary.requested} tint="blue" />
          <SummaryCard icon={CreditCard} title="Total geral" description="Todo o movimento do período, incluindo o histórico" values={summary.total} tint="green" />
        </section>
        <p className="consultation-cycle-note">Na sexta-feira, às 17h de Manaus, as solicitações encerram o ciclo e permanecem no total geral. Os gráficos abaixo mostram o movimento total dos filtros selecionados.</p>
        <FreightForecast data={data} driver={driverFilter} period={period} />
        <OverviewCharts rows={summary.total.ranked} dailyRows={data?.drivers_by_day || []} period={period} driver={driverFilter} />
      </>}
    <footer className="shared-footer">Ciclo atualizado automaticamente · Dados atualizados a cada 30 segundos enquanto o painel estiver aberto · Acesso somente para consulta</footer>
  </main>;
}

