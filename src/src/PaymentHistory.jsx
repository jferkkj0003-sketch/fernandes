import React from 'react';
import { ArrowDownToLine, FileText, Check, Pencil, RefreshCw, CreditCard } from 'lucide-react';
import { emailStatus, isClosurePaid, paymentStatus, paymentTotals } from './lib/payments';
import { isWithinClosureChangeWindow } from './lib/closures';
import ResponsiveTable from './ResponsiveTable';
const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const date = (value) => value ? value.split('-').reverse().join('/') : 'Não informada';

export default function PaymentHistory({ closures, canDelete, onMarkRequested, onPreview, onDownload, onDelete, onEdit, onSchedule, onPaid }) {
  const totals = paymentTotals(closures);
  const ordered = [...closures].sort((a, b) => Number(isClosurePaid(a)) - Number(isClosurePaid(b)) || Number(b.number) - Number(a.number));
  return <>
    <div className="page-heading"><div><p className="eyebrow">PAGAMENTOS</p><h1>Histórico</h1><p className="page-subtitle">Acompanhe o envio por e-mail, a previsão e a confirmação de pagamento.</p></div></div>
    <div className="payment-summary"><article className="panel payment-total"><CreditCard size={20} /><span>Fechamentos aguardando pagamento</span><strong>{money(totals.pending)}</strong></article><article className="panel payment-total"><Check size={20} /><span>Pagamentos confirmados</span><strong>{money(totals.paid)}</strong></article></div>
    {totals.unverified > 0 && <p className="empty-callout">Fechamentos antigos a conferir: {money(totals.unverified)}. O pagamento ainda não foi informado.</p>}
    <section className="panel list-panel"><div className="panel-heading"><div><h2>Fechamentos e pagamentos</h2><p>Marcar o envio por e-mail mantém o valor pendente. Confirme como pago somente após o retorno do financeiro.</p></div></div>
      {ordered.length ? <div className="table-wrap"><ResponsiveTable className="payment-history-table"><thead><tr><th>ID</th><th>MOTORISTA</th><th>PERÍODO</th><th>TOTAL</th><th>E-MAIL</th><th>PAGAMENTO</th><th>PREVISÃO</th><th>AÇÕES</th></tr></thead><tbody>{ordered.map((item) => {
        const paid = isClosurePaid(item);
        const editable = canDelete && !paid && isWithinClosureChangeWindow(item);
        return <tr key={item.id}><td><strong>{item.number}</strong></td><td>{item.driver}</td><td>{date(item.start)} – {date(item.end)}</td><td><strong>{money(item.total)}</strong></td><td><span className={`status-badge ${item.status === 'Solicitado' ? 'solicitado' : 'pendente'}`}>{emailStatus(item)}</span></td><td><span className={`status-badge ${paid ? 'solicitado' : 'pendente'}`}>{paymentStatus(item)}</span>{paid && <small className="payment-date">Pago em {date(item.paidOn)}</small>}</td><td>{date(item.paymentDueDate)}</td><td className="closure-actions"><div className="closure-action-group">
          <button className="button secondary small-button" onClick={() => onPreview(item)}><FileText size={14} /> Abrir PDF</button><button className="button secondary small-button" onClick={() => onDownload(item)}><ArrowDownToLine size={14} /> Baixar PDF</button>
          {item.status === 'Aguardando envio' && <button className="button primary small-button" onClick={() => onMarkRequested(item)}>Marcar e-mail enviado</button>}
          {canDelete && !paid && <button className="button secondary small-button" onClick={() => onSchedule(item)}>Previsão de pagamento</button>}
          {canDelete && !paid && item.status === 'Solicitado' && <button className="button primary small-button" onClick={() => onPaid(item)}><Check size={14} /> Marcar como pago</button>}
          {canDelete && <button className="button secondary small-button" disabled={!editable} onClick={() => onEdit(item)}><Pencil size={14} /> Editar</button>}
          {canDelete && <button className="button delete-button small-button" disabled={!editable} onClick={() => onDelete(item)}><RefreshCw size={14} /> Remover</button>}
        </div></td></tr>;
      })}</tbody></ResponsiveTable></div> : <div className="empty-callout">Os fechamentos aparecerão aqui depois de gerados.</div>}
    </section>
  </>;
}

