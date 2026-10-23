import React, { useEffect, useMemo, useState } from 'react';
import { Search, Weight, CreditCard, ClipboardList, Check, FileText, ArrowDownToLine, Pencil, RefreshCw } from 'lucide-react';
import ResponsiveTable from './ResponsiveTable';
import { searchHistory } from './lib/history-search';
import { driverOptions } from './lib/drivers';
import { isWithinClosureChangeWindow } from './lib/closures';
const money = (value) => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(value || 0);
const date = (value) => value ? value.split('-').reverse().join('/') : '—';
const weight = (value) => value === null ? 'Indisponível' : `${Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits:1 })} kg`;

export default function History({ closures, drivers, tickets, canDelete, onMarkRequested, onPreview, onDownload, onDelete, onEdit }) {
  const [query, setQuery] = useState('');
  const [driver, setDriver] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [, refreshTime] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => refreshTime((value) => value + 1), 1000); return () => window.clearInterval(timer); }, []);
  const result = useMemo(() => searchHistory(closures, tickets, {query,driver,start,end}), [closures,tickets,query,driver,start,end]);
  const options = useMemo(() => driverOptions(drivers,closures), [drivers,closures]);
  const invalid = start && end && start > end;
  const active = query || driver || start || end;
  function clear() { setQuery(''); setDriver(''); setStart(''); setEnd(''); }
  return <>
    <div className="page-heading"><div><p className="eyebrow">CONSULTA</p><h1>Histórico</h1><p className="page-subtitle">Pesquise os fechamentos e consulte quanto cada motorista carregou no período.</p></div></div>
    <section className="panel history-filter-panel" aria-label="Filtros do histórico">
      <div className="panel-heading"><div><h2>Pesquisar no histórico</h2><p>As datas consideram o dia de cada ticket, inclusive dentro de um fechamento maior.</p></div><button type="button" className="button secondary small-button" disabled={!active} onClick={clear}>Limpar filtros</button></div>
      <div className="history-filter-grid">
        <label>Motorista<select value={driver} onChange={(event)=>setDriver(event.target.value)}><option value="">Todos os motoristas</option>{options.map((option)=><option key={option.key} value={option.key}>{option.name}{!option.active ? ' (inativo)' : ''}</option>)}</select></label>
        <label className="history-search-field">Ticket<div><Search size={17}/><input type="search" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Número do ticket" /></div></label>
        <label>Data inicial<input type="date" value={start} onInput={(event)=>setStart(event.currentTarget.value)} onChange={(event)=>setStart(event.target.value)}/></label>
        <label>Data final<input type="date" value={end} onInput={(event)=>setEnd(event.currentTarget.value)} onChange={(event)=>setEnd(event.target.value)}/></label>
      </div>
      {invalid && <p className="history-filter-error" role="alert">A data inicial precisa ser anterior ou igual à data final.</p>}
    </section>
    <div className="history-result-summary" aria-label="Totais dos resultados">
      <article className="metric-card"><Weight size={20}/><span className="metric-label">Peso no filtro</span><strong className="metric-value">{weight(result.weight)}</strong><span className="metric-foot">Somente os tickets encontrados</span></article>
      <article className="metric-card"><CreditCard size={20}/><span className="metric-label">Valor líquido no filtro</span><strong className="metric-value">{money(result.total)}</strong><span className="metric-foot">Após descontos</span></article>
      <article className="metric-card"><ClipboardList size={20}/><span className="metric-label">Tickets encontrados</span><strong className="metric-value">{result.count}</strong><span className="metric-foot">Em {result.rows.length} fechamento(s)</span></article>
    </div>
    <section className="panel list-panel"><div className="panel-heading"><div><h2>Fechamentos encontrados</h2><p>{result.waiting} aguardando envio · {result.sent} solicitado(s) por e-mail. Os PDFs continuam completos; os totais abaixo seguem o filtro.</p></div></div>
      {result.rows.length ? <div className="table-wrap"><ResponsiveTable className="closure-history-table searchable-history-table"><thead><tr><th>ID</th><th>MOTORISTA</th><th>PERÍODO DO FECHAMENTO</th><th>TICKETS NO FILTRO</th><th>PESO NO FILTRO</th><th>VALOR NO FILTRO</th><th>STATUS</th><th>AÇÕES</th></tr></thead><tbody>{result.rows.map((row)=>{
        const item=row.closure;
        return <tr key={item.id} className={item.status==='Solicitado'?'closure-requested-row':undefined}>
          <td><strong>{item.number}</strong></td><td>{item.driver}</td><td>{date(item.start)} – {date(item.end)}{row.partial&&<small className="ticket-note">Parte do fechamento neste filtro</small>}</td>
          <td>{row.count}<small className="ticket-note">{row.matches.map((ticket)=>ticket.number).join(', ')}</small></td><td>{weight(row.weight)}</td><td><strong>{money(row.total)}</strong></td><td><span className={`status-badge ${item.status==='Solicitado'?'solicitado':'pendente'}`}><i/>{item.status}</span></td>
          <td className="closure-actions"><div className="closure-action-group">
            {canDelete&&<button className="button secondary small-button" disabled={!isWithinClosureChangeWindow(item)} onClick={()=>onEdit(item)}><Pencil size={14}/> Editar</button>}
            <button className="button secondary small-button" title="Abrir o fechamento completo" onClick={()=>onPreview(item)}><FileText size={14}/> Abrir PDF</button>
            <button className={`button ${item.status==='Aguardando envio'?'primary':'secondary'} small-button`} title="Baixar o fechamento completo" onClick={()=>onDownload(item)}><ArrowDownToLine size={14}/> Baixar PDF</button>
            {item.status==='Aguardando envio'&&<button className="button secondary small-button" onClick={()=>onMarkRequested(item)}><Check size={14}/> Marcar e-mail enviado</button>}
            {canDelete&&<button className="button delete-button small-button" disabled={!isWithinClosureChangeWindow(item)} onClick={()=>onDelete(item)}><RefreshCw size={14}/> Remover</button>}
          </div></td>
        </tr>;
      })}</tbody></ResponsiveTable></div> : <div className="empty-callout">{closures.length?'Nenhum resultado para os filtros selecionados.':'Os fechamentos aparecerão aqui depois de gerados.'}</div>}
    </section>
  </>;
}
