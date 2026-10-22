export const isWithinClosureChangeWindow = (closure, now = Date.now()) => {
  if (closure.paidAt) return false;
  if (closure.status !== 'Solicitado') return true;
  const sentAt = Date.parse(closure.sentAt || closure.createdAt || '');
  return Number.isFinite(sentAt) && now - sentAt < 2 * 24 * 60 * 60 * 1000;
};
