import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, RefreshCw, Sun, Moon } from 'lucide-react';
import { cloudConfigured, loadSharedDashboard } from './lib/cloud';
import OverviewCharts from './OverviewCharts';
import FreightForecast from './FreightForecast';
import { requestArchiveAt } from './lib/request-cycle';
import { consultationSummary } from './lib/consultation';
import { sharedPaymentSummary } from './lib/shared-payments';

const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const dateISO = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const monthISO = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export default function SharedDashboard({ token }) {
  const [theme, setTheme] = useState(() => window.localStorage.getItem('dde-fretes-theme') !== 'light' ? 'dark' : 'light');
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('all');
  const [now, setNow] = useState(() => new Date());
  const [month, setMonth] = useState(() => monthISO(new Date()));
  const [customStart, setCustomStart] = useState(() => dateISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customEnd, setCustomEnd] = useState(() => dateISO(new Date()));
  const [driverFilter, setDriverFilter] = useState('');
  const [stale, setStale] = useState(false);

  async function refresh(silent = false) {
    if (!silent) setLoading(true);
    setLoadError('');
    try {
      if (!cloudConfigured) throw new Error('O painel não está conectado ao banco de dados.');
      setData(await loadSharedDashboard(token));
      setStale(false);
    } catch {
      if (silent) { setStale(true); return; }
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
  const alreadyPaid = useMemo(() => sharedPaymentSummary(data, period, driverFilter).closed.paid, [data, period, driverFilter]);

  if (loading) return <main className="shared-stage"><section className="shared-card"><img src={theme === 'dark' ? '/logo-controle-de-fretes-dark.svg' : '/logo-controle-de-fretes.svg'} alt="Controle de Fretes" /><p>Carregando painel compartilhado…</p></section></main>;
  if (loadError) return <main className="shared-stage"><section className="shared-card"><AlertCircle size={32} /><h1>Link indisponível</h1><p>{loadError}</p><button className="button secondary" onClick={refresh}><RefreshCw size={15} /> Tentar novamente</button></section></main>;

  const presets = [['week', '7 dias'], ['month', 'Mês'], ['all', 'Tudo'], ['custom', 'Datas']];
  return <main className="shared-dashboard">
    <header className="shared-header"><div className="shared-header-brand"><img src={theme === 'dark' ? '/logo-controle-de-fretes-dark.svg' : '/logo-controle-de-fretes.svg'} alt="Controle de Fretes" /><div><h1>Pagamentos da semana</h1><div className={`cx-live${stale ? ' off' : ''}`}>{stale ? 'Sem conexão · mostrando os últimos dados' : 'Atualizado agora · ao vivo'}</div></div></div><button className="icon-button theme-toggle shared-theme-toggle" type="button" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button></header>
    <section className="panel dash-filters" aria-label="Filtros">
      <div className="dash-presets" role="group" aria-label="Filtrar período">{presets.map(([key, label]) => <button key={key} type="button" className={range === key ? 'active' : ''} onClick={() => setRange(key)}>{label}</button>)}</div>
      <div className="dash-filter-fields">
        <label>Motorista<select value={driverFilter} onChange={(event) => setDriverFilter(event.target.value)}><option value="">Todos os motoristas</option>{driverNames.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        {range === 'month' && <label>Mês<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>}
        {range === 'custom' && <><label>De<input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label><label>Até<input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label></>}
      </div>
    </section>

    {period.start && period.end && period.start > period.end
      ? <div className="shared-error"><AlertCircle size={17} /> A data inicial precisa ser anterior ou igual à data final.</div>
      : <>
        <p className="shared-view-context">{range === 'all' ? 'Todo o período' : [period.start, period.end].map((date) => date ? date.split('-').reverse().join('/') : 'Sem limite').join(' a ')} · {driverFilter || 'Todos os motoristas'} · <span className="shared-view-badge">Somente consulta</span></p>
        <FreightForecast data={data} driver={driverFilter} period={period} paid={alreadyPaid} />
        {alreadyPaid > 0 && <section className="panel cx-paidcard"><div><strong>Já pago</strong><br /><small className="mut">Ciclos anteriores · fora do total</small></div><strong>{money(alreadyPaid)}</strong></section>}
        <p className="consultation-cycle-note">Na sexta-feira, às 17h de Manaus, as solicitações encerram o ciclo e permanecem no total geral.</p>
        <details className="dash-charts"><summary>Gráficos do período</summary>
          <OverviewCharts rows={summary.total.ranked} dailyRows={data?.drivers_by_day || []} period={period} driver={driverFilter} />
        </details>
      </>}
    <footer className="shared-footer">Atualiza sozinho a cada 30 segundos · Acesso somente para consulta</footer>
  </main>;
}
