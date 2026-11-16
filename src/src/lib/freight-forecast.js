export function freightForecast(data, paymentDate, driver = '') {
  const matches = row => !driver || row.driver === driver;
  const closures = (data?.closure_payments || []).filter(row => matches(row) && row.email_status === 'Solicitado' && row.payment_due_date === paymentDate && row.payment_status !== 'paid');
  const previews = (data?.freight_previews || []).filter(row => matches(row) && row.payment_date === paymentDate && !row.included_in_request);
  const cents = value => Math.round(Number(value || 0) * 100);
  const confirmed = closures.reduce((sum, row) => sum + cents(row.total), 0);
  const withoutTicket = previews.filter(row => !row.confirmed).reduce((sum, row) => sum + cents(row.amount), 0);
  const withTicket = previews.filter(row => row.confirmed).reduce((sum, row) => sum + cents(row.amount), 0);
  const byName = new Map();
  for (const row of closures) byName.set(row.driver, (byName.get(row.driver) || 0) + cents(row.total));
  for (const row of previews) byName.set(row.driver, (byName.get(row.driver) || 0) + cents(row.amount));
  const drivers = [...byName].map(([name, amount]) => ({ name, amount: amount / 100 })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  return { closures, previews, confirmed: confirmed / 100, withoutTicket: withoutTicket / 100, withTicket: withTicket / 100, total: (confirmed + withoutTicket + withTicket) / 100, drivers };
}
