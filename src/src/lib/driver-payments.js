// Totais por motorista para o painel: tickets (em aberto, fechados, solicitados) + prévias sem ticket.
const cents = (value) => Math.round(Number(value || 0) * 100);

export function summarizeDriverPayments({ tickets = [], previews = [], paidTicketIds = new Set(), drivers = [], driverFilter = 'Todos', start = '', end = '' }) {
  const inPeriod = (date) => (!start || date >= start) && (!end || date <= end);
  const byKey = new Map();
  const row = (key, name) => {
    if (!byKey.has(key)) byKey.set(key, { key, name, active: true, tickets: 0, trips: 0, weight: 0, open: 0, waiting: 0, requested: 0, paid: 0, preview: 0, previewCount: 0 });
    return byKey.get(key);
  };
  for (const driver of drivers) {
    if (driver.active === false) continue;
    if (driverFilter === 'Todos' || driver.key === driverFilter) row(driver.key, driver.name);
  }
  for (const ticket of tickets) {
    const key = ticket.driverId || ticket.driver || '';
    if (!key || !ticket.dateISO || !inPeriod(ticket.dateISO) || (driverFilter !== 'Todos' && key !== driverFilter)) continue;
    const entry = row(key, ticket.driver || 'Motorista não identificado');
    const amount = cents(Number(ticket.gross || 0) - Number(ticket.discount || 0));
    const status = ticket.requestStatus === 'Solicitado' || ticket.requestStatus === 'Aguardando envio' ? ticket.requestStatus : ticket.status || 'Aberto';
    entry.tickets += 1; entry.trips += 1; entry.weight += Number(ticket.weight || 0);
    if (paidTicketIds.has(ticket.id)) entry.paid += amount;
    else if (status === 'Solicitado') entry.requested += amount;
    else if (status === 'Aberto') entry.open += amount;
    else entry.waiting += amount;
  }
  for (const preview of previews) {
    const key = preview.driver_id || '';
    if (!key || !inPeriod(preview.loading_date) || (driverFilter !== 'Todos' && key !== driverFilter)) continue;
    const entry = row(key, preview.driver?.name || 'Motorista não identificado');
    entry.preview += cents(preview.amount); entry.previewCount += 1; entry.trips += 1;
  }
  const list = [...byKey.values()].map((item) => {
    const payable = item.open + item.waiting + item.requested + item.preview;
    return { ...item, open: item.open / 100, waiting: item.waiting / 100, requested: item.requested / 100, paid: item.paid / 100, preview: item.preview / 100, payable: payable / 100 };
  }).sort((a, b) => b.payable - a.payable || a.name.localeCompare(b.name, 'pt-BR'));
  const sum = (field) => Math.round(list.reduce((total, item) => total + item[field] * 100, 0)) / 100;
  const totals = {
    tickets: list.reduce((total, item) => total + item.tickets, 0),
    trips: list.reduce((total, item) => total + item.trips, 0),
    previewCount: list.reduce((total, item) => total + item.previewCount, 0),
    weight: list.reduce((total, item) => total + item.weight, 0),
    open: sum('open'), waiting: sum('waiting'), requested: sum('requested'), paid: sum('paid'), preview: sum('preview'), payable: sum('payable'),
  };
  return { drivers: list, totals };
}
