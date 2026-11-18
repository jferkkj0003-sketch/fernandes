export function closingValueRows(data, closures, previews, period, driver) {
  const openTickets = (data?.drivers_by_day || [])
    .filter((row) => Number(row.open_count) > 0)
    .map((row) => ({ date: row.date, driver: row.driver, amount: row.open_amount }));
  const closedTickets = closures.flatMap((closure) =>
    (closure.days || []).map((day) => ({ date: day.date, driver: closure.driver, amount: day.amount })));
  const loads = previews.map((preview) => ({
    date: preview.loading_date, driver: preview.driver, amount: preview.amount,
  }));

  return [...openTickets, ...closedTickets, ...loads].filter((row) =>
    row.date && (!driver || row.driver === driver)
    && (!period.start || row.date >= period.start)
    && (!period.end || row.date <= period.end));
}
