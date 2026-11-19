import React, { useEffect, useState } from 'react';
import { X, Mail, Check, ArrowDownToLine } from 'lucide-react';
import { normalizeRecipients } from './lib/email-recipients';
import { OUTLOOK_INSTALLER } from './lib/outlook-helper';
import { appErrorMessage, isOutdatedAssetError, readEmailRecovery, saveEmailRecovery, clearEmailRecovery } from './lib/app-update';
import { closureEmailTemplate, prepareClosureMessage } from './lib/closure-email-template';
import { hasConfirmedOutlookHelper, rememberOutlookHelper, readOutlookAttempt, writeOutlookAttempt } from './lib/outlook-preferences';

export default function ClosureOutlookModal({ closure, user, onClose, onPrepare, onConfirmSent, onGetConsultationLink }) {
  const recipients = user?.user_metadata?.closure_email_recipients;
  const [recovery] = useState(() => { try { return readEmailRecovery(window.sessionStorage, closure.id, user?.id); } catch { return null; } });
  const [to, setTo] = useState(recovery?.to ?? (recipients?.to || []).join('; '));
  const [cc, setCc] = useState(recovery?.cc ?? (recipients?.cc || []).join('; '));
  const [subject, setSubject] = useState(recovery?.subject ?? closureEmailTemplate(closure).subject);
  const [body, setBody] = useState(recovery?.body ?? closureEmailTemplate(closure).body);
  const [consultationUrl, setConsultationUrl] = useState('');
  const [loadingLink, setLoadingLink] = useState(true);
  const [linkMessage, setLinkMessage] = useState('');
  const [setupOpen, setSetupOpen] = useState(() => { try { return !hasConfirmedOutlookHelper(window.localStorage); } catch { return true; } });
  const [lastAttempt, setLastAttempt] = useState(() => { try { return readOutlookAttempt(window.localStorage, closure.id, user?.id); } catch { return null; } });
  const [repeatMode, setRepeatMode] = useState(null);
  const storeAttempt = (value) => {
    setLastAttempt(value);
    try { writeOutlookAttempt(window.localStorage, closure.id, user?.id, value); } catch { }
  };
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => onGetConsultationLink?.()).then((url) => {
      if (active) { setConsultationUrl(url || ''); if (!url) setLinkMessage('Nenhum link de consulta encontrado. Cole o link do painel ou deixe vazio para omitir essa linha.'); }
    }).catch(() => { if (active) setLinkMessage('Não foi possível carregar o link de consulta. Cole o link do painel ou deixe vazio para omitir essa linha.'); })
      .finally(() => { if (active) setLoadingLink(false); });
    return () => { active = false; };
  }, [onGetConsultationLink]);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const refresh = () => {
    try {
      saveEmailRecovery(window.sessionStorage, closure.id, user?.id, { to, cc, subject, body });
      window.location.reload();
    } catch { setError('Não foi possível guardar a mensagem para atualizar. Copie o texto antes de atualizar a página manualmente.'); }
  };
  const prepare = async (mode = 'helper', allowRepeat = false) => {
    if (busy) return;
    let previous = lastAttempt;
    try { previous = readOutlookAttempt(window.localStorage, closure.id, user?.id) || previous; } catch { }
    if (previous && !allowRepeat) { setLastAttempt(previous); setRepeatMode(mode); return; }
    setRepeatMode(null);
    setError(''); setResult(''); setReady(false); setNeedsRefresh(false);
    let started = false;
    try {
      const recipients = normalizeRecipients(to, cc);
      if (!recipients.to.length) throw new Error('Informe pelo menos um destinatário no campo Para.');
      const message = prepareClosureMessage(body, consultationUrl);
      setBusy(true);
      storeAttempt({ status: 'preparing', at: Date.now() }); started = true;
      const saved = await onPrepare(closure, { to: recipients.to.join('; '), cc: recipients.cc.join('; '), subject, ...message }, mode);
      setResult(saved); setReady(true);
      storeAttempt({ status: mode === 'helper' ? 'opened' : 'packaged', at: Date.now() });
      if (mode === 'helper') {
        try { rememberOutlookHelper(window.localStorage); } catch { }
        setSetupOpen(false);
      }
      try { clearEmailRecovery(window.sessionStorage, closure.id, user?.id); } catch { }
    } catch (err) {
      if (started) storeAttempt(err.outlookMayHaveOpened ? { status: 'uncertain', at: Date.now() } : previous);
      setNeedsRefresh(isOutdatedAssetError(err)); setError(appErrorMessage(err, 'Não foi possível preparar o e-mail. Tente novamente.'));
    }
    finally { setBusy(false); }
  };
  return <div className="modal-backdrop" role="presentation"><section className="edit-modal closure-outlook-modal" role="dialog" aria-modal="true" aria-labelledby="outlook-title">
    <div className="panel-heading"><div><h2 id="outlook-title">Enviar no e-mail · fechamento {closure.number}</h2><p>Revise os destinatários e a mensagem antes de preparar o Outlook.</p></div><button className="icon-button" disabled={busy} onClick={onClose} aria-label="Fechar"><X size={18} /></button></div>
    <details className="outlook-setup" open={setupOpen} onToggle={(event) => setSetupOpen(event.currentTarget.open)}><summary>Auxiliar do Outlook — instalação e ajuda</summary><p>Primeira vez neste computador? Baixe e execute o auxiliar uma única vez. Depois, basta clicar em Abrir no Outlook. A instalação vale para este usuário do Windows.</p><a href={OUTLOOK_INSTALLER} download="DDE-Outlook.exe" className="button secondary"><ArrowDownToLine size={16} /> Instalar auxiliar (uma vez)</a></details>
    <form onSubmit={(event) => { event.preventDefault(); prepare(); }}><div className="filter-fields closure-email-fields"><label>Para<input value={to} onChange={(e) => setTo(e.target.value)} disabled={busy} autoFocus required /></label><label>CC<input value={cc} onChange={(e) => setCc(e.target.value)} disabled={busy} /></label></div>
      <label className="outlook-field">Assunto<input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={busy} required /></label>
      <label className="outlook-field">Mensagem<textarea value={body} onChange={(e) => setBody(e.target.value)} disabled={busy} required rows={8} /></label>
      <p className="closure-email-help">A data sugerida é o dia seguinte, pelo horário de Manaus. Você pode alterar a data diretamente na mensagem.</p>
      <label className="outlook-field">Link “Consultar fretes”<input type="url" value={consultationUrl} onChange={(e) => setConsultationUrl(e.target.value)} disabled={busy || loadingLink} placeholder={loadingLink ? 'Carregando link do painel…' : 'Link do painel de consulta'} /></label>
      {linkMessage && <p className="closure-email-help">{linkMessage}</p>}
      <p className="closure-email-help">A assinatura será a configurada no Outlook. As alterações acima valem para esta mensagem; os destinatários padrão continuam em “Editar destinatários”.</p>
      <p className="closure-email-help">Use o Outlook clássico no Windows. O navegador pode pedir autorização para abrir o auxiliar e acessar o computador local. O PDF é transferido diretamente para o auxiliar, sem precisar baixar ou extrair arquivos manualmente.</p>
      {error && <p className="admin-delete-error" role="alert">{error}</p>}{result && <p role="status" className="account-message">{result}</p>}
      {needsRefresh && <div className="outlook-setup"><p>O texto será guardado nesta aba. Após atualizar, abra novamente este fechamento para recuperar a mensagem.</p><button type="button" className="button secondary" onClick={refresh} disabled={busy}>Atualizar app e guardar mensagem</button></div>}
      {repeatMode && <div className="outlook-repeat" role="alert"><strong>Preparar novamente o fechamento {closure.number}?</strong><p>{lastAttempt?.status === 'opened' ? 'Uma mensagem deste fechamento já foi aberta no Outlook.' : lastAttempt?.status === 'packaged' ? 'Um pacote ZIP deste fechamento já foi preparado.' : 'Já houve uma tentativa de preparar este fechamento; o resultado pode estar no Outlook.'} Confira os rascunhos e os enviados antes de criar outra mensagem, para evitar duplicidade.</p><div className="form-actions"><button type="button" className="button secondary" onClick={() => setRepeatMode(null)} disabled={busy}>Voltar</button><button type="button" className="button primary" onClick={() => prepare(repeatMode, true)} disabled={busy || loadingLink}>{repeatMode === 'zip' ? 'Preparar outro ZIP' : 'Abrir outra mensagem'}</button></div></div>}
      <div className="form-actions"><button type="button" className="button secondary" onClick={onClose} disabled={busy}>Fechar</button><button className="button primary" disabled={busy || loadingLink}><Mail size={16} /> {busy ? 'Conectando ao Outlook e preparando o PDF…' : ready ? 'Abrir outra mensagem no Outlook' : 'Abrir no Outlook'}</button></div>
      <button type="button" className="text-button outlook-fallback" disabled={busy} onClick={() => prepare('zip')}>Alternativa: baixar pacote ZIP</button>
    </form>
    <div className="outlook-confirm"><p>A preparação do e-mail mantém este fechamento aguardando envio.</p><button type="button" className="button secondary" disabled={busy} onClick={async () => { setBusy(true); try { if (await onConfirmSent(closure)) onClose(); } finally { setBusy(false); } }}><Check size={16} /> Já enviei pelo Outlook</button></div>
  </section></div>;
}
