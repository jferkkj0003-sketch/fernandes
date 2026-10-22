import React from 'react';
import ResponsiveTable from './ResponsiveTable';
const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const date = (value) => value ? value.split('-').reverse().join('/') : '—';
export default function SharedPayments({ summary }) {
  const requested = summary.closures.filter((item) => item.email_status === 'Solicitado');
  const waiting = summary.closures.filter((item) => item.email_status !== 'Solicitado');
  const count = (items) => items.reduce((total, item) => total + item.filteredCount, 0);
  return <>
    <section className="shared-email-summary" aria-label="Situação do envio">
      <span><strong>{count(waiting)}</strong> ticket(s) fechado(s), aguardando envio</span>
      <span><strong>{count(requested)}</strong> ticket(s) fechado(s) e solicitado(s) por e-mail</span>
    </section>
    <section className="shared-ranking shared-payment-panel"><h2>Fechamentos e envio por e-mail</h2><p className="shared-payment-description">Estes tickets já estão fechados e não entram na aba Em aberto. Consulte abaixo o status do envio de cada fechamento.</p>
      {summary.closures.length ? <div className="table-wrap"><ResponsiveTable><thead><tr><th>FECHAMENTO</th><th>MOTORISTA</th><th>PERÍODO</th><th>TICKETS</th><th>PESO</th><th>VALOR NO FILTRO</th><th>STATUS</th></tr></thead><tbody>{summary.closures.map((closure) => <tr key={closure.number}>
        <td><strong>{String(closure.number).padStart(3, '0')}</strong></td><td>{closure.driver}</td><td>{date(closure.period_start)} – {date(closure.period_end)}</td><td>{closure.filteredCount}</td><td>{Number(closure.filteredWeight).toLocaleString('pt-BR')} kg</td><td><strong>{money(closure.filteredTotal)}</strong>{closure.filteredPartial && <small className="payment-date">Parte do fechamento neste período</small>}</td><td><span className={`status-badge ${closure.email_status === 'Solicitado' ? 'solicitado' : 'pendente'}`}>{closure.email_status === 'Solicitado' ? 'Fechado · solicitado por e-mail' : 'Fechado · aguardando envio'}</span></td>
      </tr>)}</tbody></ResponsiveTable></div> : <p className="shared-empty">Nenhum fechamento para os filtros selecionados.</p>}
    </section>
  </>;
}
