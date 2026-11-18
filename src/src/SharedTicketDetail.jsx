import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import PdfScanPreview from './PdfScanPreview';
import { loadSharedClosingTicketDetail, loadSharedClosingTickets } from './lib/cloud';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const kilos = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

function detailsImageType(isPdf, receivedType) {
  if (isPdf) return 'application/pdf';
  return ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(receivedType) ? receivedType : '';
}

function TicketContents({ token, ticket, driver, start, end }) {
  const [details, setDetails] = useState(null);
  const [scanUrl, setScanUrl] = useState('');
  const [error, setError] = useState('');
  const [scanError, setScanError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = '';
    setDetails(null);
    setScanUrl('');
    setError('');
    setScanError(false);

    async function load() {
      let info;
      try {
        info = await loadSharedClosingTicketDetail(token, ticket.id, driver, start, end);
      } catch {
        if (!controller.signal.aborted) setError('Não foi possível abrir o ticket. Ele pode ter saído deste fechamento.');
        return;
      }
      if (controller.signal.aborted) return;
      setDetails(info);
      if (!info.scanUrl) return;

      try {
        const response = await fetch(info.scanUrl, { signal: controller.signal, referrerPolicy: 'no-referrer' });
        if (!response.ok) throw new Error('Comprovante indisponível.');
        const blob = await response.blob();
        const type = detailsImageType(info.isPdf, blob.type);
        if (!type) throw new Error('Formato de comprovante inválido.');
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(new Blob([blob], { type }));
        setScanUrl(objectUrl);
      } catch {
        if (!controller.signal.aborted) setScanError(true);
      }
    }

    load();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, ticket.id, driver, start, end, retry]);

  const openUrl = scanUrl || details?.scanUrl;

  return <>
    {error ? <div className="ticket-detail-message error" role="alert">
      {error} <button type="button" className="button secondary small-button" onClick={() => setRetry((count) => count + 1)}>Tentar novamente</button>
    </div> : !details ? <div className="ticket-detail-message" role="status">Carregando detalhes…</div> : <>
      <div className="ticket-detail-grid">
        <div><span>Peso</span><strong>{details.weight == null ? '—' : kilos.format(details.weight) + ' kg'}</strong></div>
        <div><span>Placa</span><strong>{details.plate || '—'}</strong></div>
        <div><span>Valor bruto</span><strong>{money.format(details.gross)}</strong></div>
        <div><span>Desconto</span><strong>{money.format(details.discount)}</strong></div>
        <div><span>Valor líquido</span><strong>{money.format(details.amount)}</strong></div>
        <div><span>Status</span><strong>{details.status}</strong></div>
      </div>
      <div className="ticket-detail-scan">
        <div className="ticket-detail-scan-heading">
          <strong>Comprovante escaneado</strong>
          {openUrl && <a className="button secondary small-button" href={openUrl} target="_blank" rel="noopener noreferrer">
            <ArrowUpRight size={14} /> Abrir em nova aba
          </a>}
        </div>
        {scanUrl ? details.isPdf
          ? <PdfScanPreview url={scanUrl} ticketNumber={ticket.number} />
          : <img className="ticket-detail-preview image" src={scanUrl} alt={'Comprovante escaneado do ticket ' + ticket.number} />
        : scanError || details.scanError ? <div className="ticket-detail-message error" role="alert">
          Não foi possível exibir o comprovante. <button type="button" className="button secondary small-button" onClick={() => setRetry((count) => count + 1)}>Tentar novamente</button>
        </div> : details.scanUrl ? <div className="ticket-detail-message" role="status">Carregando comprovante…</div>
          : <div className="ticket-detail-message">Este ticket não tem comprovante anexado.</div>}
      </div>
    </>}
  </>;
}

const PAGE_SIZE = 50;
const displayDate = (date) => date ? date.split('-').reverse().join('/') : '';

export default function SharedTicketDetail({ token, driver, period, onClose }) {
  const dialog = useRef(null);
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const [result, setResult] = useState({ page: -1, rows: [], error: false });
  const { start, end } = period;

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  useEffect(() => {
    let active = true;
    loadSharedClosingTickets(token, driver, start, end, page * PAGE_SIZE)
      .then((rows) => { if (active) setResult({ page, rows, error: false }); })
      .catch(() => { if (active) setResult({ page, rows: [], error: true }); });
    return () => { active = false; };
  }, [token, driver, start, end, page, retry]);

  const loading = result.page !== page;
  const pageTickets = loading ? [] : result.rows.slice(0, PAGE_SIZE);
  const ticket = pageTickets.find((item) => item.id === selectedId) || pageTickets[0];
  const hasMore = !loading && result.rows.length > PAGE_SIZE;

  return <dialog ref={dialog} className="edit-modal ticket-detail-modal fx-ticket-dialog" aria-labelledby="shared-ticket-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <div className="panel-heading">
      <div><p className="eyebrow">DETALHES DO LANÇAMENTO</p><h2 id="shared-ticket-title">{ticket ? 'Ticket ' + ticket.number : 'Tickets do fechamento'}</h2>
        <p>{driver}{ticket?.date && ' · ' + displayDate(ticket.date)}</p>
      </div>
      <button type="button" className="icon-button" autoFocus aria-label="Fechar ticket" onClick={onClose}><X size={18} /></button>
    </div>
    {(pageTickets.length > 1 || page > 0 || hasMore) && <div className="fx-ticket-picker">
      {ticket && <label className="fx-field">
        <span>Selecionar ticket</span>
        <select value={ticket.id} onChange={(event) => setSelectedId(event.target.value)}>
          {pageTickets.map((item) => <option key={item.id} value={item.id}>Ticket {item.number} · {displayDate(item.date)}</option>)}
        </select>
      </label>}
      {(page > 0 || hasMore) && <div className="fx-ticket-pages" aria-label="Páginas de tickets">
        <button type="button" disabled={loading || page === 0} onClick={() => setPage((value) => value - 1)}>Anterior</button>
        <span>Página {page + 1}</span>
        <button type="button" disabled={!hasMore} onClick={() => setPage((value) => value + 1)}>Próxima</button>
      </div>}
    </div>}
    {loading ? <div className="ticket-detail-message" role="status">Carregando ticket…</div>
      : result.error ? <div className="ticket-detail-message error" role="alert">
        Não foi possível abrir os tickets. <button type="button" className="button secondary small-button" onClick={() => {
          setResult({ page: -1, rows: [], error: false });
          setRetry((value) => value + 1);
        }}>Tentar novamente</button>
      </div>
      : ticket ? <TicketContents key={ticket.id} token={token} ticket={ticket} driver={driver} start={start} end={end} />
      : <div className="ticket-detail-message">Nenhum ticket nesse intervalo.</div>}
    <div className="form-actions ticket-detail-actions"><button type="button" className="button secondary" onClick={onClose}>Fechar</button></div>
  </dialog>;
}
