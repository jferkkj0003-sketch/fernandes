import React, { useState } from 'react';
import { X, Mail, Check, ArrowDownToLine } from 'lucide-react';
import { normalizeRecipients } from './lib/email-recipients';

const date = (value) => (value || '').split('-').reverse().join('/');
export default function ClosureOutlookModal({ closure, user, onClose, onPrepare, onConfirmSent }) {
  const recipients = user?.user_metadata?.closure_email_recipients;
  const [to, setTo] = useState((recipients?.to || []).join('; '));
  const [cc, setCc] = useState((recipients?.cc || []).join('; '));
  const [subject, setSubject] = useState(`Fechamento de frete ${closure.number} - ${closure.driver} - ${date(closure.start)} a ${date(closure.end)}`);
  const [body, setBody] = useState(`Prezados,\n\nSegue em anexo o fechamento de frete de ${closure.driver}, referente ao período de ${date(closure.start)} a ${date(closure.end)}.\n\nQuantidade de tickets: ${closure.count}\nValor total: ${Number(closure.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n\nPor gentileza, verificar para programação do pagamento.`);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const prepare = async (event) => {
    event.preventDefault();
    if (busy) return;
    setError(''); setResult(''); setReady(false);
    try {
      const recipients = normalizeRecipients(to, cc);
      if (!recipients.to.length) throw new Error('Informe pelo menos um destinatário no campo Para.');
      setBusy(true);
      const saved = await onPrepare(closure, { to: recipients.to.join('; '), cc: recipients.cc.join('; '), subject, body });
      setResult(saved); setReady(true);
    } catch (err) { setError(err.message || 'Não foi possível preparar o e-mail. Tente novamente.'); }
    finally { setBusy(false); }
  };
  return <div className="modal-backdrop" role="presentation"><section className="edit-modal closure-outlook-modal" role="dialog" aria-modal="true" aria-labelledby="outlook-title">
    <div className="panel-heading"><div><h2 id="outlook-title">Enviar no e-mail · fechamento {closure.number}</h2><p>Revise os destinatários e a mensagem antes de preparar o Outlook.</p></div><button className="icon-button" disabled={busy} onClick={onClose} aria-label="Fechar"><X size={18} /></button></div>
    <form onSubmit={prepare}><div className="filter-fields closure-email-fields"><label>Para<input value={to} onChange={(e) => setTo(e.target.value)} disabled={busy} autoFocus required /></label><label>CC<input value={cc} onChange={(e) => setCc(e.target.value)} disabled={busy} /></label></div>
      <label className="outlook-field">Assunto<input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={busy} required /></label>
      <label className="outlook-field">Mensagem<textarea value={body} onChange={(e) => setBody(e.target.value)} disabled={busy} required rows={8} /></label>
      <p className="closure-email-help">A assinatura será a configurada no Outlook. As alterações acima valem para esta mensagem; os destinatários padrão continuam em “Editar destinatários”.</p>
      <ol className="outlook-steps"><li>Baixe o ZIP e extraia todos os arquivos para uma pasta.</li><li>Abra <strong>Abrir_no_Outlook.vbs</strong>. O Outlook clássico do Windows abre a mensagem com o PDF anexado.</li><li>Confira a assinatura e o anexo, envie pelo Outlook e volte aqui para confirmar.</li></ol>
      {error && <p className="admin-delete-error" role="alert">{error}</p>}{result && <p role="status" className="account-message">{result}</p>}
      <div className="form-actions"><button type="button" className="button secondary" onClick={onClose} disabled={busy}>Fechar</button><button className="button primary" disabled={busy}><ArrowDownToLine size={16} /> {busy ? 'Preparando PDF e e-mail…' : ready ? 'Baixar novamente' : 'Baixar para abrir no Outlook'}</button></div>
    </form>
    <div className="outlook-confirm"><p>A preparação do e-mail mantém este fechamento aguardando envio.</p><button type="button" className="button secondary" disabled={busy} onClick={async () => { setBusy(true); try { if (await onConfirmSent(closure)) onClose(); } finally { setBusy(false); } }}><Check size={16} /> Já enviei pelo Outlook</button></div>
  </section></div>;
}
