import React, { useState } from 'react';
import { Check, Link2, X } from 'lucide-react';
import { supabase } from './lib/cloud';

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Manaus' });
const nextFriday = () => { const d = new Date(`${today()}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + (5 - d.getUTCDay() + 7) % 7); return d.toISOString().slice(0, 10); };
const money = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const br = (iso) => iso.split('-').reverse().join('/');

// Formulário de prévia (viagem ainda sem ticket). Fica dentro do lançamento, no modo "Prévia".
export function PreviewForm({ drivers, onSaved }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [driver, setDriver] = useState('');
  const [amount, setAmount] = useState('');
  const active = drivers.filter((d) => d.active !== false && d.id);
  async function save(e) {
    e.preventDefault();
    const form = e.currentTarget, data = new FormData(form);
    if (!supabase) { setMessage('Modo demonstração: conecte o app à nuvem para salvar prévias.'); return; }
    if (data.get('payment_date') < data.get('loading_date')) { setMessage('O pagamento não pode ser anterior ao carregamento.'); return; }
    setBusy(true); setMessage('');
    const { error } = await supabase.from('freight_previews').insert({ driver_id: driver, loading_date: data.get('loading_date'), payment_date: data.get('payment_date'), amount: Number(amount), note: String(data.get('note') || '').trim() });
    if (error) setMessage(`Não foi possível salvar a prévia: ${error.message}`);
    else { form.reset(); setDriver(''); setAmount(''); setMessage('Prévia salva. Ela já aparece no painel como “Aguardando ticket”.'); await onSaved?.(); }
    setBusy(false);
  }
  return <form className="ticket-form" onSubmit={save}>
    <p className="wide-field-all form-hint">Use quando o motorista já carregou, mas o ticket ainda não chegou. Depois, ao lançar o ticket, a prévia é sugerida e vinculada.</p>
    <label>Data do carregamento *<input name="loading_date" type="date" defaultValue={today()} required /></label>
    <label>Pagamento previsto *<input name="payment_date" type="date" defaultValue={nextFriday()} required /></label>
    <label>Motorista *<select value={driver} required onChange={(e) => { const d = active.find((x) => x.id === e.target.value); setDriver(e.target.value); setAmount(d ? String(d.defaultFare) : ''); }}><option value="">Selecione…</option>{active.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
    <label>Valor por viagem (R$) *<input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></label>
    <label className="wide-field">Observação<input name="note" /></label>
    <div className="form-actions"><span>{message}</span><button className="button primary" disabled={busy}><Check size={16} /> {busy ? 'Salvando…' : 'Salvar prévia'}</button></div>
  </form>;
}

// Prévias aguardando ticket: vincular ao lançamento ou (administrador) cancelar.
export function PendingPreviewList({ rows, selectedId, isAdmin, onSelect, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (!supabase || !rows.length) return null;
  async function cancel(row) {
    if (!window.confirm(`Cancelar a prévia de ${row.driver?.name} no valor de ${money(row.amount)}?`)) return;
    setBusy(true);
    const { error } = await supabase.rpc('cancel_freight_preview', { preview_uuid: row.id });
    setMessage(error ? `Não foi possível cancelar: ${error.message}` : 'Prévia cancelada.');
    await onChanged?.(); setBusy(false);
  }
  return <div className="pending-previews">
    <div className="pending-head"><strong>Prévias aguardando ticket</strong><span className="subtle-count">{rows.length}</span></div>
    <ul className="pending-list">{rows.map((row) => <li key={row.id} className={selectedId === row.id ? 'is-linked' : ''}>
      <div className="pending-main"><b>{row.driver?.name}</b><small>Carregou {br(row.loading_date)} · paga {br(row.payment_date)}</small></div>
      <span className="pending-amount">{money(row.amount)}</span>
      <div className="pending-actions">
        <button type="button" className="button secondary small-button" onClick={() => onSelect(row)}><Link2 size={14} /> {selectedId === row.id ? 'Vinculada' : 'Lançar ticket'}</button>
        {isAdmin && <button type="button" className="icon-button danger-icon" aria-label={`Cancelar prévia de ${row.driver?.name}`} disabled={busy} onClick={() => cancel(row)}><X size={16} /></button>}
      </div>
    </li>)}</ul>
    {message && <p className="pending-msg">{message}</p>}
  </div>;
}
