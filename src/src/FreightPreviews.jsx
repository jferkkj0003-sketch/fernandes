import React, { useEffect, useState } from 'react';
import { supabase } from './lib/cloud';

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Manaus' });
const nextFriday = () => { const d = new Date(`${today()}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + (5 - d.getUTCDay() + 7) % 7); return d.toISOString().slice(0, 10); };
const money = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function FreightPreviews({ drivers, onSelect, refreshKey, isAdmin }) {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [driver, setDriver] = useState('');
  const [amount, setAmount] = useState('');
  const active = drivers.filter(d => d.active !== false && d.id);
  async function refresh() {
    const { data, error } = await supabase.from('freight_previews').select('*, driver:drivers(name)').is('cancelled_at', null).is('ticket_id', null).order('payment_date');
    if (error) setMessage(`Não foi possível carregar as prévias: ${error.message}`); else setRows(data || []);
  }
  useEffect(() => { if (supabase) refresh(); }, [refreshKey]);
  async function save(e) {
    e.preventDefault();
    const form = e.currentTarget, data = new FormData(form);
    if (data.get('payment_date') < data.get('loading_date')) { setMessage('O pagamento não pode ser anterior ao carregamento.'); return; }
    setBusy(true); setMessage('');
    const { error } = await supabase.from('freight_previews').insert({ driver_id: driver, loading_date: data.get('loading_date'), payment_date: data.get('payment_date'), amount: Number(amount), note: String(data.get('note') || '').trim() });
    if (error) setMessage(`Não foi possível salvar a prévia: ${error.message}`);
    else { form.reset(); setDriver(''); setAmount(''); setMessage('Prévia salva e disponível no painel.'); await refresh(); }
    setBusy(false);
  }
  async function cancel(row) {
    if (!window.confirm(`Cancelar a prévia de ${row.driver?.name} no valor de ${money(row.amount)}?`)) return;
    setBusy(true); const { error } = await supabase.rpc('cancel_freight_preview', { preview_uuid: row.id });
    setMessage(error ? `Não foi possível cancelar: ${error.message}` : 'Prévia cancelada.'); await refresh(); setBusy(false);
  }
  if (!supabase) return null;
  return <section className="panel form-panel"><div className="panel-heading"><div><h2>Prévia de viagem sem ticket</h2><p>Informe a viagem e o pagamento previsto. O ticket poderá ser vinculado depois.</p></div></div>
    <form className="ticket-form" onSubmit={save}>
      <label>Data do carregamento *<input name="loading_date" type="date" defaultValue={today()} required /></label>
      <label>Pagamento previsto *<input name="payment_date" type="date" defaultValue={nextFriday()} required /></label>
      <label>Motorista *<select value={driver} required onChange={e => { const d = active.find(x => x.id === e.target.value); setDriver(e.target.value); setAmount(d ? String(d.defaultFare) : ''); }}><option value="">Selecione…</option>{active.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      <label>Valor por viagem (R$) *<input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required /></label>
      <label className="wide-field">Observação<input name="note" /></label>
      <div className="form-actions"><span>{message}</span><button className="button primary" disabled={busy}>Salvar prévia</button></div>
    </form>
    <div className="table-wrap"><table><thead><tr><th>CARREGAMENTO</th><th>MOTORISTA</th><th>PAGAMENTO</th><th>VALOR</th><th>AÇÃO</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.loading_date.split('-').reverse().join('/')}</td><td>{row.driver?.name}</td><td>{row.payment_date.split('-').reverse().join('/')}</td><td>{money(row.amount)}</td><td><button type="button" className="button secondary small-button" onClick={() => onSelect(row)}>Vincular ticket</button> {isAdmin && <button type="button" className="row-action danger-action" disabled={busy} onClick={() => cancel(row)}>Cancelar</button>}</td></tr>)}{!rows.length && <tr><td colSpan="5">Nenhuma prévia aguardando ticket.</td></tr>}</tbody></table></div>
  </section>;
}
