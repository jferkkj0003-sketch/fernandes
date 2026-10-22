import React, { useState } from 'react';
import { X } from 'lucide-react';
import { nextPaymentDate, paymentToday } from './lib/payments';

export default function ClosurePaymentModal({ action, onClose, onConfirm }) {
  const { closure, kind } = action;
  const paid = kind === 'paid';
  const [date, setDate] = useState(() => paid ? paymentToday() : closure.paymentDueDate || nextPaymentDate());
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const title = paid ? 'Confirmar pagamento' : kind === 'request' ? 'Solicitado por e-mail' : 'Previsão de pagamento';
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage('');
    try { await onConfirm(date); }
    catch (error) { setMessage(error.message || 'Não foi possível salvar. Tente novamente.'); }
    finally { setBusy(false); }
  }
  return <div className="modal-backdrop" role="presentation"><section className="edit-modal" role="dialog" aria-modal="true" aria-labelledby="payment-title">
    <div className="panel-heading"><div><p className="eyebrow">FECHAMENTO {closure.number}</p><h2 id="payment-title">{title}</h2><p>{closure.driver} · {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(closure.total)}</p></div><button className="icon-button" disabled={busy} onClick={onClose} aria-label="Fechar"><X size={18} /></button></div>
    <form className="account-form" onSubmit={submit}>
      <p>{paid ? 'Registre somente depois da confirmação do financeiro. Esta ação não realiza uma transferência.' : 'O valor continuará pendente no painel de consulta até a confirmação do pagamento.'}</p>
      <label>{paid ? 'Data efetiva do pagamento' : 'Previsão de pagamento'}<input type="date" value={date} onChange={(event) => setDate(event.target.value)} max={paid ? paymentToday() : undefined} required /></label>
      {!paid && <p>Previsão inicial: dia seguinte. Ajuste a data para finais de semana e feriados, conforme a programação do financeiro.</p>}
      {kind === 'request' && <label className="payment-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} required /> Confirmo que já enviei este fechamento por e-mail.</label>}
      {message && <p className="account-message" role="alert">{message}</p>}
      <div className="form-actions"><button type="button" className="button secondary" onClick={onClose} disabled={busy}>Cancelar</button><button className="button primary" disabled={busy || !date || (kind === 'request' && !confirmed)}>{busy ? 'Salvando…' : paid ? 'Confirmar como pago' : kind === 'request' ? 'Registrar solicitação' : 'Salvar previsão'}</button></div>
    </form>
  </section></div>;
}
