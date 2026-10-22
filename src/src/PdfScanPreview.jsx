import React, { useEffect, useRef, useState } from 'react';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export default function PdfScanPreview({ url, ticketNumber }) {
  const canvasRef = useRef(null);
  const [document, setDocument] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let task;
    setDocument(null);
    setPageNumber(1);
    setLoading(true);
    setError('');
    (async () => {
      const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
      if (!active) return;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      task = pdfjs.getDocument({ url, isEvalSupported: false });
      const pdf = await task.promise;
      if (active) setDocument(pdf);
    })().catch(() => {
      if (active) {
        setError('Não foi possível exibir a prévia. Use “Abrir em nova aba” para consultar o arquivo.');
        setLoading(false);
      }
    });
    return () => { active = false; task?.destroy().catch(() => {}); };
  }, [url]);

  useEffect(() => {
    if (!document) return;
    let active = true;
    let renderTask;
    setLoading(true);
    setError('');
    (async () => {
      const page = await document.getPage(pageNumber);
      if (!active) return;
      const natural = page.getViewport({ scale: 1 });
      const scale = Math.min(2.5, 2000 / Math.max(natural.width, natural.height));
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport });
      await renderTask.promise;
      if (active) setLoading(false);
    })().catch((renderError) => {
      if (active && renderError.name !== 'RenderingCancelledException') {
        setError('Não foi possível exibir esta página. Use “Abrir em nova aba” para consultar o arquivo.');
        setLoading(false);
      }
    });
    return () => { active = false; renderTask?.cancel(); };
  }, [document, pageNumber]);

  return <div className="pdf-scan-preview" aria-busy={loading}>
    {document?.numPages > 1 && <div className="pdf-scan-pagination" aria-label="Páginas do comprovante">
      <button type="button" className="button secondary small-button" disabled={loading || pageNumber === 1} onClick={() => setPageNumber((page) => page - 1)}>Anterior</button>
      <span aria-live="polite">Página {pageNumber} de {document.numPages}</span>
      <button type="button" className="button secondary small-button" disabled={loading || pageNumber === document.numPages} onClick={() => setPageNumber((page) => page + 1)}>Próxima</button>
    </div>}
    {loading && <div className="ticket-detail-message" role="status">Preparando página completa…</div>}
    {error && <div className="ticket-detail-message error" role="alert">{error}</div>}
    <canvas ref={canvasRef} className="pdf-scan-page" hidden={loading || Boolean(error)} role="img" aria-label={`Comprovante do ticket ${ticketNumber}, página ${pageNumber}`} />
  </div>;
}
