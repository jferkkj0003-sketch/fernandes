import { operationalSummary, sharedPaymentSummary } from './shared-payments.js';

export function consultationPeriodSummary(data, period = {}, driver = '') {
  const invalid = Boolean(period.start && period.end && period.start > period.end);
  const overall = operationalSummary(invalid ? null : data, period, driver, 'all');
  const payments = sharedPaymentSummary(invalid ? null : data, period, driver);
  const paidByDriver = new Map();
  for (const closure of payments.closures) {
    if (closure.payment_status !== 'paid' || !closure.paid_on) continue;
    paidByDriver.set(closure.driver, (paidByDriver.get(closure.driver) || 0) + closure.filteredTotal);
  }
  const ranked = overall.ranked.map((row) => ({ ...row, paid: paidByDriver.get(row.driver) || 0 }));
  return { ...overall, ranked, paid: payments.closed.paid };
}
