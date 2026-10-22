import { operationalSummary, sharedPaymentSummary } from './shared-payments.js';
import { requestedSummary } from './request-cycle.js';

export function consultationSummary(data, period = {}, driver = '', now = new Date()) {
  const total = operationalSummary(data, period, driver, 'all');
  const open = operationalSummary(data, period, driver, 'open');
  const { closures } = sharedPaymentSummary(data, period, driver);
  const requested = requestedSummary(closures, now);
  const waiting = closures.filter((closure) => closure.email_status === 'Aguardando envio').reduce((sum, closure) => ({
    amount: sum.amount + closure.filteredTotal,
    weight: sum.weight + closure.filteredWeight,
  }), { amount: 0, weight: 0 });
  return { total, open, waiting, requested };
}
