const manausDate = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Manaus', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = (name) => Number(parts.find((item) => item.type === name).value);
  return { year: part('year'), month: part('month'), day: part('day') };
};

// Display-only weekly cycle. This never changes email status or payment records.
// A request sent at/after Friday 17:00 Manaus belongs to the following week.
export function requestArchiveAt(sentAt) {
  if (!sentAt) return null;
  const sent = new Date(sentAt);
  if (!Number.isFinite(sent.getTime())) return null;
  const { year, month, day } = manausDate(sent);
  const localDay = new Date(Date.UTC(year, month - 1, day));
  const daysUntilFriday = (5 - localDay.getUTCDay() + 7) % 7;
  // Manaus uses UTC-04:00; 17:00 local is 21:00 UTC.
  const cutoff = new Date(Date.UTC(year, month - 1, day + daysUntilFriday, 21));
  if (cutoff <= sent) cutoff.setUTCDate(cutoff.getUTCDate() + 7);
  return cutoff.toISOString();
}

export function isCurrentRequest(closure, now = new Date()) {
  if (closure.email_status !== 'Solicitado') return false;
  const cutoff = requestArchiveAt(closure.sent_at);
  // Missing historical timestamps must not silently hide a request.
  return !cutoff || new Date(now).getTime() < new Date(cutoff).getTime();
}

export function requestedSummary(closures, now = new Date()) {
  const current = closures.filter((closure) => isCurrentRequest(closure, now));
  return { closures: current,
    ticketCount: current.reduce((sum, item) => sum + item.filteredCount, 0),
    weight: current.reduce((sum, item) => sum + item.filteredWeight, 0),
    amount: current.reduce((sum, item) => sum + item.filteredTotal, 0) };
}
