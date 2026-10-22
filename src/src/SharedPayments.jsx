import React from 'react';
import ResponsiveTable from './ResponsiveTable';
import { paymentToday } from './lib/payments';
const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const date = (value) => value ? value.split('-').reverse().join('/') : 'Não informada';
export default function SharedPayments({ summary }) {
  return <>
    <section className="shared-metrics shared-payment-stages" aria-label="Etapas do pagamento">
      <article className="shared-metric"><span className="shared-metric-label">Tickets a fechar</span><strong>{money(summary.open.amount)}</strong><small>{summary.open.count} ticket(s) ainda sem fechamento</small></article>
      <article className="shared-metric"><span className="shared-metric-label">Fechados, aguardando pagamento</span><strong>{money(summary.closed.pending)}</strong><small>Solicitados por e-mail: {money(summary.closed.requested)}</small></article>
      <article className="shared-metric"><span className="shared-metric-label">Pagamentos confirmados</span><strong>{money(summary.closed.paid)}</strong><small>Somente após confirmação do financeiro</small></article>
    </section>
    {summary.closed.unverified > 0 && <p className="shared-overview-open">Fechamentos anteriores a conferir: <strong>{money(summary.closed.unverified)}</strong>. A situação do pagamento ainda não foi informada e não está incluída no total pendente confirmado.</p>}
    <section className="shared-ranking shared-payment-panel"><h2>Envio por e-mail e pagamento dos fechamentos</h2><p className="shared-payment-description">Enviar o fechamento por e-mail mantém o valor pendente até a confirmação do pagamento. Os valores seguem o motorista e as datas dos tickets selecionados no filtro.</p>
      {summary.closures.length ? <div className="table-wrap"><ResponsiveTable><thead><tr><th>FECHAMENTO</th><th>MOTORISTA</th><th>VALOR NO FILTRO</th><th>E-MAIL</th><th>PAGAMENTO</th><th>PREVISÃO / BAIXA</th></tr></thead><tbody>{summary.closures.map((closure) => {
        const paid = closure.payment_status === 'paid' && closure.paid_on;
        const state = paid ? 'Pago' : closure.payment_status !== 'pending' ? 'Pagamento não informado' : closure.payment_due_date && closure.payment_due_date < paymentToday() ? 'Pagamento em atraso' : 'Aguardando pagamento';
        return <tr key={closure.number}><td><strong>{String(closure.number).padStart(3, '0')}</strong></td><td>{closure.driver}</td><td><strong>{money(closure.filteredTotal)}</strong>{closure.filteredPartial && <small className="payment-date">Parte do fechamento neste período</small>}</td><td>{closure.email_status === 'Solicitado' ? 'Solicitado por e-mail' : 'Aguardando envio'}</td><td>{state}</td><td>{paid ? `Pago em ${date(closure.paid_on)}` : date(closure.payment_due_date)}</td></tr>;
      })}</tbody></ResponsiveTable></div> : <p className="shared-empty">Nenhum fechamento para os filtros selecionados.</p>}
    </section>
  </>;
}
