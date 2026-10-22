import React, { useEffect, useState } from 'react';
import { ArrowDownToLine } from 'lucide-react';
import { downloadPreferences } from './lib/downloads';

export default function DownloadPreferences() {
  const [directory, setDirectory] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const supported = typeof window.showDirectoryPicker === 'function';
  useEffect(() => {
    let active = true;
    downloadPreferences.getDirectory().then((value) => { if (active) setDirectory(value); })
      .catch(() => { if (active) setMessage('Não foi possível carregar a pasta. Escolha novamente.'); });
    return () => { active = false; };
  }, []);
  const choose = async () => {
    setBusy(true);
    setMessage('');
    try {
      const selected = await downloadPreferences.chooseDirectory();
      if (selected) { setDirectory(selected); setMessage(`Pasta ${selected.name} escolhida para os PDFs deste aplicativo.`); }
    } catch (error) {
      if (error.name !== 'AbortError') setMessage(`Não foi possível escolher a pasta: ${error.message}`);
    } finally { setBusy(false); }
  };
  const reset = async () => {
    setBusy(true);
    try { await downloadPreferences.useBrowserDefault(); setDirectory(null); setMessage('Os próximos downloads usarão a pasta padrão do navegador.'); }
    catch (error) { setMessage(`Não foi possível alterar: ${error.message}`); }
    finally { setBusy(false); }
  };
  return <section className="download-preferences" aria-labelledby="downloads-title">
    <h3 id="downloads-title"><ArrowDownToLine size={18} /> Pasta de downloads</h3>
    <p>Escolha onde salvar os PDFs dos fechamentos. Esta preferência vale somente para este aplicativo neste computador.</p>
    <p><strong>Pasta atual:</strong> {directory ? directory.name : 'Padrão do navegador'}</p>
    <div className="download-preferences-actions">
      <button type="button" className="button secondary" onClick={choose} disabled={busy || !supported}>{busy ? 'Aguarde…' : directory ? 'Alterar / autorizar pasta' : 'Escolher pasta'}</button>
      {directory && <button type="button" className="text-button" onClick={reset} disabled={busy}>Usar padrão do navegador</button>}
    </div>
    {!supported && <p>Abra o aplicativo no Chrome ou Edge para escolher uma pasta.</p>}
    {message && <p role="status" className="account-message">{message}</p>}
  </section>;
}
