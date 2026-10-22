export function paymentToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Manaus', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function nextPaymentDate(day = paymentToday()) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export const isClosurePaid = (closure) => Boolean(closure.paidAt && closure.paidOn);
export const emailStatus = (closure) => closure.status === 'Solicitado' ? 'Solicitado por e-mail' : 'Aguardando envio';
export function paymentStatus(closure, today = paymentToday()) {
  if (isClosurePaid(closure)) return 'Pago';
  if (closure.paymentStatus !== 'pending') return 'Pagamento não informado';
  if (closure.paymentDueDate && closure.paymentDueDate < today) return 'Pagamento em atraso';
  return 'Aguardando pagamento';
}
export function paymentTotals(closures) {
  return closures.reduce((result, closure) => {
    const key = isClosurePaid(closure) ? 'paid' : closure.paymentStatus === 'pending' ? 'pending' : 'unverified';
    result[key] += Number(closure.total) || 0;
    if (key === 'pending' && closure.status === 'Solicitado') result.requested += Number(closure.total) || 0;
    return result;
  }, { paid: 0, pending: 0, requested: 0, unverified: 0 });
}
