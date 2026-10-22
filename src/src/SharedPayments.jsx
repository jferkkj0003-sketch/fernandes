import React from 'react';
import ResponsiveTable from './ResponsiveTable';
import { isCurrentRequest, requestArchiveAt } from './lib/request-cycle';
const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const date = (value) => value ? value.split('-').reverse().join('/') : '—';
const cutoffLabel = (value) => value ? new Intl.DateTimeFormat('pt-BR', { timeZone:'America/Manaus', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).format(new Date(value)) : 'Data de envio não informada';
export default function SharedPayments({ closures, requested = false, now }) {
  return <section className="shared-ranking shared-payment-panel">
    <h2>{requested ? 'Solicitações por e-mail do ciclo atual' : 'Histórico de fechamentos e solicitações'}</h2>
    <p className="shared-payment-description">{requested ? 'Após marcar o e-mail enviado no app, a solicitação fica aqui até a próxima sexta-feira, às 17h de Manaus. Depois, permanece na Visão geral. Esse encerramento do ciclo não confirma pagamento.' : 'Todos os fechamentos do filtro, inclusive os que já saíram do ciclo de solicitações. Os valores e o registro do envio por e-mail são preservados.'}</p>
    {closures.length ? <div className="table-wrap"><ResponsiveTable><thead><tr><th>FECHAMENTO</th><th>MOTORISTA</th><th>PERÍODO</th><th>TICKETS</th><th>PESO</th><th>VALOR NO FILTRO</th><th>STATUS</th><th>{requested ? 'SAÍDA DA ABA' : 'CICLO DA SOLICITAÇÃO'}</th></tr></thead><tbody>{closures.map((closure) => {
      const sent = closure.email_status === 'Solicitado';
      const current = isCurrentRequest(closure, now);
      const cutoff = requestArchiveAt(closure.sent_at);
      return <tr key={closure.number}>
        <td><strong>{String(closure.number).padStart(3, '0')}</strong></td><td>{closure.driver}</td><td>{date(closure.period_start)} – {date(closure.period_end)}</td><td>{closure.filteredCount}</td><td>{Number(closure.filteredWeight).toLocaleString('pt-BR')} kg</td><td><strong>{money(closure.filteredTotal)}</strong>{closure.filteredPartial && <small className="payment-date">Parte do fechamento neste período</small>}</td><td><span className={`status-badge ${sent ? 'solicitado' : 'pendente'}`}>{sent ? 'Solicitado por e-mail' : 'Fechado · aguardando envio'}</span></td><td>{sent ? <>{!current && <small className="payment-date">Ciclo encerrado</small>}{cutoffLabel(cutoff)}</> : 'Aguardando envio'}</td>
      </tr>;
    })}</tbody></ResponsiveTable></div> : <p className="shared-empty">{requested ? 'Nenhuma solicitação neste ciclo. As anteriores continuam na Visão geral.' : 'Nenhum fechamento para os filtros selecionados.'}</p>}
  </section>;
}
