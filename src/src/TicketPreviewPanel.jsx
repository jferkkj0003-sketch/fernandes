import React from 'react';
import { CalendarClock, Link2, Link2Off, Sparkles, TriangleAlert } from 'lucide-react';
import { matchingPreviews, ticketDraftSummary } from './lib/ticket-preview';

const money = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const br = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');

// Faixa de prévia dentro do formulário de ticket:
//  1) sugere a prévia pendente do mesmo motorista/data (um toque para vincular);
//  2) mostra o resumo ao vivo do lançamento e a diferença contra o valor estimado.
export default function TicketPreviewPanel({ previews, draft, selected, onLink, onUnlink, cloud }) {
  const candidates = matchingPreviews(previews, draft.driverId, draft.date).filter((p) => p.id !== selected?.id);
  const summary = ticketDraftSummary(draft, selected);
  const hasValues = Boolean(draft.number || draft.gross !== '' || draft.weight !== '');
  const diff = summary.difference;

  return <div className="wide-field-all tp-wrap">
    {selected && <div className="tp-linked" role="status">
      <span className="tp-ico"><Link2 size={18} /></span>
      <div><strong>Vinculado à prévia de {selected.driver?.name}</strong>
        <small>Carregamento {br(selected.loading_date)} · pagamento previsto {br(selected.payment_date)} · estimado {money(selected.amount)}</small></div>
      <button type="button" className="button secondary small-button" onClick={onUnlink}><Link2Off size={15} /> Desvincular</button>
    </div>}

    {!selected && candidates.map((p) => <div key={p.id} className="tp-suggest" role="status">
      <span className="tp-ico"><Sparkles size={18} /></span>
      <div><strong>Prévia encontrada para este motorista e data</strong>
        <small>{money(p.amount)} · pagamento previsto {br(p.payment_date)}{p.note ? ` · ${p.note}` : ''}</small></div>
      <button type="button" className="button primary small-button" onClick={() => onLink(p)}><Link2 size={15} /> Vincular</button>
    </div>)}

    {(selected || hasValues) && <div className="tp-summary" aria-label="Resumo do lançamento">
      <div className="tp-summary-head"><span className="eyebrow">RESUMO DO LANÇAMENTO</span>
        {selected?.payment_date && <span className="tp-pay"><CalendarClock size={14} /> Pagamento previsto {br(selected.payment_date)}</span>}</div>
      <div className="tp-grid">
        <div><small>Ticket</small><b>{draft.number || '—'}</b></div>
        <div><small>Peso</small><b>{summary.weight ? `${summary.weight.toLocaleString('pt-BR')} kg` : '—'}</b></div>
        <div><small>Bruto</small><b>{draft.gross === '' ? '—' : money(summary.gross)}</b></div>
        <div><small>Desconto</small><b>{money(summary.discount)}</b></div>
        <div className="tp-net"><small>Líquido a pagar</small><b>{draft.gross === '' ? '—' : money(summary.net)}</b></div>
        {selected && <div className={`tp-diff ${diff > 0 ? 'up' : diff < 0 ? 'down' : 'same'}`}><small>Vs. estimado ({money(summary.estimated)})</small><b>{diff === 0 ? 'Igual à prévia' : `${diff > 0 ? '+' : '−'}${money(Math.abs(diff))}`}</b></div>}
      </div>
      {!summary.valid && <p className="tp-warn" role="alert"><TriangleAlert size={15} /> {summary.issues[0]}</p>}
      {!cloud && <p className="tp-demo">Modo demonstração: a prévia só é gravada quando o app está conectado à nuvem.</p>}
    </div>}
  </div>;
}
