const numeric = (value) => Number(value) || 0;
// Closing removes a ticket from open totals independently of payment or email.
export function operationalSummary(data, period = {}, driver = '', view = 'open') {
  const rows = (data?.drivers_by_day || []).filter((row) => (!period.start || row.date >= period.start) && (!period.end || row.date <= period.end) && (!driver || row.driver === driver));
  const ranking = new Map();
  let openCount = 0, openAmount = 0;
  for (const row of rows) {
    const count = numeric(row.count), opened = numeric(row.open_count);
    const openWeight = row.open_weight != null ? numeric(row.open_weight) : opened === count ? numeric(row.weight) : opened === 0 ? 0 : null;
    const values = view === 'all' ? { count, weight: numeric(row.weight), amount: numeric(row.amount) }
      : view === 'closed' ? { count: count - opened, weight: openWeight === null ? null : numeric(row.weight) - openWeight, amount: numeric(row.amount) - numeric(row.open_amount) }
      : { count: opened, weight: openWeight, amount: numeric(row.open_amount) };
    openCount += opened; openAmount += numeric(row.open_amount);
    if (!values.count) continue;
    const current = ranking.get(row.driver) || { driver: row.driver, count: 0, weight: 0, amount: 0 };
    current.count += values.count;
    current.weight = current.weight === null || values.weight === null ? null : current.weight + values.weight;
    current.amount += values.amount;
    ranking.set(row.driver, current);
  }
  const ranked = [...ranking.values()].sort((a, b) => b.amount - a.amount || a.driver.localeCompare(b.driver, 'pt-BR'));
  return { ranked, openCount, openAmount, ticketCount: ranked.reduce((sum, row) => sum + row.count, 0), weight: ranked.some((row) => row.weight === null) ? null : ranked.reduce((sum, row) => sum + row.weight, 0), amount: ranked.reduce((sum, row) => sum + row.amount, 0) };
}
export function sharedPaymentSummary(data, period = {}, driver = '') {
  const matches = (day) => (!period.start || day >= period.start) && (!period.end || day <= period.end);
  const openRows = (data?.drivers_by_day || []).filter((row) => matches(row.date) && (!driver || row.driver === driver));
  const open = { count: 0, weight: 0, amount: 0 };
  const ranking = new Map();
  const addRank = (name, values) => {
    const row = ranking.get(name) || { driver: name, count: 0, weight: 0, amount: 0 };
    row.count += values.count;
    row.weight = row.weight === null || values.weight === null ? null : row.weight + values.weight;
    row.amount += values.amount;
    ranking.set(name, row);
  };
  for (const row of openRows) {
    const count = numeric(row.open_count);
    if (!count) continue;
    const weight = row.open_weight != null ? numeric(row.open_weight) : numeric(row.open_count) === numeric(row.count) ? numeric(row.weight) : null;
    const values = { count, weight, amount: numeric(row.open_amount) };
    open.count += count;
    open.weight = open.weight === null || weight === null ? null : open.weight + weight;
    open.amount += values.amount;
    addRank(row.driver, values);
  }
  const closed = { pending: 0, requested: 0, paid: 0, unverified: 0, pendingCount: 0, pendingWeight: 0 };
  const closures = [];
  for (const closure of data?.closure_payments || []) {
    if (driver && closure.driver !== driver) continue;
    const days = (closure.days || []).filter((row) => matches(row.date));
    if (!days.length) continue;
    const values = days.reduce((sum, row) => ({ count: sum.count + numeric(row.count), weight: sum.weight + numeric(row.weight), amount: sum.amount + numeric(row.amount) }), { count: 0, weight: 0, amount: 0 });
    const state = closure.payment_status === 'paid' && closure.paid_on ? 'paid' : closure.payment_status === 'pending' ? 'pending' : 'unverified';
    closed[state] += values.amount;
    if (state === 'pending') {
      closed.pendingCount += values.count;
      closed.pendingWeight += values.weight;
      if (closure.email_status === 'Solicitado') closed.requested += values.amount;
      addRank(closure.driver, values);
    }
    closures.push({ ...closure, filteredCount: values.count, filteredWeight: values.weight, filteredTotal: values.amount, filteredPartial: values.count !== numeric(closure.ticket_count) });
  }
  return {
    open, closed, closures,
    totalPending: open.amount + closed.pending,
    totalCount: open.count + closed.pendingCount,
    totalWeight: open.weight === null ? null : open.weight + closed.pendingWeight,
    ranked: [...ranking.values()].sort((a, b) => b.amount - a.amount || a.driver.localeCompare(b.driver, 'pt-BR')),
  };
}
