export function freightForecast(data, paymentDate, driver = '') {
  const matches = row => !driver || row.driver === driver;
  const closures = (data?.closure_payments || []).filter(row => matches(row) && row.email_status === 'Solicitado' && row.payment_due_date === paymentDate && row.payment_status !== 'paid');
  const previews = (data?.freight_previews || []).filter(row => matches(row) && row.payment_date === paymentDate && !row.included_in_request);
  const confirmed = closures.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const withoutTicket = previews.filter(row => !row.confirmed).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const withTicket = previews.filter(row => row.confirmed).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return { closures, previews, confirmed, withoutTicket, withTicket, total: confirmed + withoutTicket + withTicket };
}
