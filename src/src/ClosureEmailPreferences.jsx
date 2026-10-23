import React, { useEffect, useState } from 'react';
import { Mail, Settings2, Check } from 'lucide-react';
import { cloudConfigured, saveClosureEmailRecipients } from './lib/cloud';
import { normalizeRecipients } from './lib/email-recipients';
import './closure-email.css';

export default function ClosureEmailPreferences({ user }) {
  const stored = user?.user_metadata?.closure_email_recipients;
  const savedTo = (stored?.to || []).join('; ');
  const savedCc = (stored?.cc || []).join('; ');
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(savedTo);
  const [cc, setCc] = useState(savedCc);
  const [saved, setSaved] = useState({ to: savedTo, cc: savedCc });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { setSaved({ to: savedTo, cc: savedCc }); setTo(savedTo); setCc(savedCc); }, [user?.id, savedTo, savedCc]);
  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    setError(''); setMessage('');
    try {
      const recipients = normalizeRecipients(to, cc);
      setBusy(true);
      const confirmed = cloudConfigured && user ? await saveClosureEmailRecipients(recipients) : recipients;
      const next = { to: confirmed.to.join('; '), cc: confirmed.cc.join('; ') };
      setSaved(next); setTo(next.to); setCc(next.cc);
      setMessage(cloudConfigured && user ? 'Destinatários salvos na sua conta.' : 'Destinatários atualizados nesta demonstração. Entre na sua conta para salvar na nuvem.');
    } catch (saveError) { setError(saveError.message || 'Não foi possível salvar os destinatários. Tente novamente.'); }
    finally { setBusy(false); }
  };
  return <section className="panel closure-email-preferences" aria-labelledby="closure-email-title">
    <div className="panel-heading"><div><h2 id="closure-email-title"><Mail size={18} /> Destinatários do fechamento</h2><p>Defina os e-mails principais e quem recebe cópia. Esta preferência fica vinculada à sua conta.</p></div><button type="button" className="button secondary" disabled={busy} aria-expanded={open} onClick={() => { setOpen(!open); setError(''); setMessage(''); }}><Settings2 size={16} /> {open ? 'Recolher' : 'Editar destinatários'}</button></div>
    {!open ? <div className="closure-email-summary"><p><strong>Para:</strong> {saved.to || 'Nenhum destinatário cadastrado'}</p><p><strong>CC:</strong> {saved.cc || 'Sem cópia'}</p></div> : <form onSubmit={save}>
      <div className="filter-fields closure-email-fields"><label>Para — destinatários principais<textarea value={to} onChange={(event) => setTo(event.target.value)} disabled={busy} placeholder="financeiro@empresa.com.br; pagamentos@empresa.com.br" autoComplete="off" spellCheck={false} /></label><label>CC — receber uma cópia<textarea value={cc} onChange={(event) => setCc(event.target.value)} disabled={busy} placeholder="logistica@empresa.com.br" autoComplete="off" spellCheck={false} /></label></div>
      <p className="closure-email-help">Separe os endereços com ponto e vírgula, vírgula ou uma linha por e-mail. Para remover um destinatário, apague o endereço e salve.</p>
      {error && <p className="admin-delete-error" role="alert">{error}</p>}{message && <p className="account-message" role="status">{message}</p>}
      <div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => { setTo(saved.to); setCc(saved.cc); setOpen(false); setError(''); setMessage(''); }}>Cancelar</button><button className="button primary" disabled={busy}><Check size={16} /> {busy ? 'Salvando…' : 'Salvar destinatários'}</button></div>
    </form>}
  </section>;
}
