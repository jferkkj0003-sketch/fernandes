export function freightForecast(data, paymentDate, driver = '', period = {}) {
  const matches = row => !driver || row.driver === driver;
  const inPeriod = date => (!period.start || date >= period.start) && (!period.end || date <= period.end);
  const cents = value => Math.round(Number(value || 0) * 100);
  const byName = new Map();
  function add(name, key, value) {
    if (!name) return;
    const row = byName.get(name) || { name, open: 0, waiting: 0, requested: 0, preview: 0, openCount: 0 };
    row[key] += value;
    byName.set(name, row);
  }
  for (const row of data?.drivers_by_day || []) {
    if (!matches(row) || !inPeriod(row.date) || !Number(row.open_count || 0)) continue;
    add(row.driver, 'open', cents(row.open_amount));
    add(row.driver, 'openCount', Number(row.open_count));
  }
  for (const closure of data?.closure_payments || []) {
    if (!matches(closure) || closure.payment_status === 'paid') continue;
    const waiting = closure.email_status === 'Aguardando envio';
    const requested = closure.email_status === 'Solicitado' && closure.payment_due_date === paymentDate;
    if (!waiting && !requested) continue;
    const days = closure.days || [];
    const amount = days.length ? days.filter(day => inPeriod(day.date)).reduce((sum, day) => sum + cents(day.amount), 0)
      : (!period.start && !period.end ? cents(closure.total) : 0);
    if (amount) add(closure.driver, waiting ? 'waiting' : 'requested', amount);
  }
  for (const preview of data?.freight_previews || []) {
    // A linked ticket is already included among open tickets or a closure.
    if (!matches(preview) || preview.confirmed || preview.included_in_request || preview.payment_date !== paymentDate || !inPeriod(preview.loading_date)) continue;
    add(preview.driver, 'preview', cents(preview.amount));
  }
  const drivers = [...byName.values()].map(row => ({ ...row, open: row.open / 100, waiting: row.waiting / 100, requested: row.requested / 100, preview: row.preview / 100, amount: (row.open + row.waiting + row.requested + row.preview) / 100 })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const total = [...byName.values()].reduce((sum, row) => sum + row.open + row.waiting + row.requested + row.preview, 0) / 100;
  return { drivers, total };
}
