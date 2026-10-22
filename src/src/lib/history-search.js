const normalized = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
const isoDate = (ticket) => ticket.dateISO || (/^\d{4}-\d{2}-\d{2}$/.test(ticket.date || '') ? ticket.date : (ticket.date || '').split('/').reverse().join('-'));

export function searchHistory(closures = [], tickets = [], { query = '', driver = '', start = '', end = '' } = {}) {
  const terms = normalized(query).trim().split(/\s+/).filter(Boolean);
  const matches = (value) => terms.every((term) => normalized(value).includes(term));
  const rows = [];
  if (start && end && start > end) return { rows, count: 0, weight: 0, total: 0, waiting: 0, sent: 0 };
  for (const closure of closures) {
    if (driver && (closure.driverId || closure.driver) !== driver) continue;
    const header = `${closure.driver} fechamento ${closure.number}`;
    const details = closure.ticketDetails?.length ? closure.ticketDetails : tickets.filter((ticket) => closure.ticketIds?.includes(ticket.id) || (closure.id && ticket.closureId === closure.id));
    if (!details.length) {
      // Legacy aggregates can be shown, but cannot be split across dates or
      // searched by ticket number without their original ticket details.
      if (!matches(header) || (start && (!closure.start || closure.start < start)) || (end && (!closure.end || closure.end > end))) continue;
      rows.push({ closure, matches: [], count: Number(closure.count) || 0, weight: null, total: Number(closure.total) || 0, partial: false });
      continue;
    }
    const selected = details.filter((ticket) => {
      const date = isoDate(ticket);
      return (!start || date >= start) && (!end || (date && date <= end)) && matches(`${header} ticket ${ticket.number} ${ticket.plate || ''}`);
    });
    if (!selected.length) continue;
    rows.push({ closure, matches: selected, count: selected.length,
      weight: selected.some((ticket) => ticket.weight == null) ? null : selected.reduce((sum, ticket) => sum + Number(ticket.weight || 0), 0),
      total: selected.reduce((sum, ticket) => sum + Number(ticket.gross || 0) - Number(ticket.discount || 0), 0),
      partial: selected.length !== details.length });
  }
  rows.sort((a, b) => a.closure.status === b.closure.status ? Number(b.closure.number) - Number(a.closure.number) : a.closure.status === 'Aguardando envio' ? -1 : 1);
  return { rows,
    count: rows.reduce((sum, row) => sum + row.count, 0),
    weight: rows.some((row) => row.weight === null) ? null : rows.reduce((sum, row) => sum + row.weight, 0),
    total: rows.reduce((sum, row) => sum + row.total, 0),
    waiting: rows.filter((row) => row.closure.status === 'Aguardando envio').length,
    sent: rows.filter((row) => row.closure.status === 'Solicitado').length };
}
