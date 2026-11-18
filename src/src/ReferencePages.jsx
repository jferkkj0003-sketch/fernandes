import React, { useMemo, useState } from 'react';
import { Download, Eye, FileText, Search } from 'lucide-react';

const money=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
const date=value=>value?String(value).slice(0,10).split('-').reverse().join('/'):'—';

export function ReferenceConsultation({tickets,onView}){
 const [query,setQuery]=useState('');
 const rows=useMemo(()=>tickets.filter(t=>norm([t.number,t.driver,t.plate,t.status].join(' ')).includes(norm(query))),[tickets,query]);
 return <div className="fd-page"><div className="page-heading"><div><h1>Consulta de Fretes</h1><p className="page-subtitle">Encontre tickets, motoristas e placas</p></div></div><section className="fd-card"><label className="search-box"><Search size={20}/><input aria-label="Buscar fretes" placeholder="Ticket, motorista, placa ou situação" value={query} onChange={e=>setQuery(e.target.value)}/></label><p className="reference-result-count">{rows.length} ticket(s) encontrado(s)</p><div className="fd-scroll"><table className="fd-table"><thead><tr><th>Ticket</th><th>Data</th><th>Motorista</th><th>Placa</th><th>Valor líquido</th><th>Detalhes</th></tr></thead><tbody>{rows.map(t=><tr key={t.id}><td>{t.number||t.id}</td><td>{date(t.dateISO)}</td><td>{t.driver}</td><td>{t.plate||'—'}</td><td>{money(Number(t.gross||0)-Number(t.discount||0))}</td><td><button className="button secondary small-button" onClick={()=>onView(t)}><Eye size={16}/>Consultar</button></td></tr>)}</tbody></table></div>{!rows.length&&<p className="empty-state">Nenhum ticket encontrado.</p>}</section></div>;
}

export function ReferenceReports({closures,onPreview,onDownload}){
 return <div className="fd-page"><div className="page-heading"><div><h1>Relatórios</h1><p className="page-subtitle">Consulte e baixe os relatórios dos fechamentos existentes</p></div></div><section className="fd-card"><h2 className="fd-h2"><FileText/>Relatórios de fechamento</h2><div className="fd-scroll"><table className="fd-table"><thead><tr><th>Fechamento</th><th>Motorista</th><th>Período</th><th>Valor</th><th>Relatório</th></tr></thead><tbody>{closures.map(c=><tr key={c.id}><td>{c.number||'—'}</td><td>{c.driver}</td><td>{date(c.start)} – {date(c.end)}</td><td>{money(c.total)}</td><td><div className="reference-report-actions"><button className="button secondary small-button" onClick={()=>onPreview(c)}><Eye size={16}/>Visualizar</button><button className="button primary small-button" onClick={()=>onDownload(c)}><Download size={16}/>Baixar PDF</button></div></td></tr>)}</tbody></table></div>{!closures.length&&<p className="empty-state">Os relatórios aparecerão aqui quando houver fechamentos.</p>}</section></div>;
}
