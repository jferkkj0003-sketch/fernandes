export function summarizeDashboardTickets(tickets) {
  const summary = {
    count: 0, weight: 0, amount: 0,
    open: { count: 0, amount: 0 },
    pending: { count: 0, amount: 0 },
    sent: { count: 0, amount: 0 },
  };
  for (const ticket of tickets) {
    const amount = Number(ticket.gross || 0) - Number(ticket.discount || 0);
    summary.count += 1;
    summary.weight += Number(ticket.weight || 0);
    summary.amount += amount;
    const status = ticket.requestStatus === 'Solicitado' || ticket.requestStatus === 'Aguardando envio'
      ? ticket.requestStatus : ticket.status || 'Aberto';
    const group = status === 'Solicitado' ? summary.sent
      : status === 'No fechamento' || status === 'Aguardando envio' ? summary.pending
        : status === 'Aberto' ? summary.open : null;
    if (group) { group.count += 1; group.amount += amount; }
  }
  return summary;
}
