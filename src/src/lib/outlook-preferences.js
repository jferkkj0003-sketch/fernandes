const helperKey = 'dde-fretes-outlook-confirmed-v1';
const attemptKey = (closureId, userId) => 'dde-fretes-outlook-attempt-v1:' + encodeURIComponent(userId || 'demo') + ':' + encodeURIComponent(closureId);

export function hasConfirmedOutlookHelper(storage) {
  try { const saved = JSON.parse(storage.getItem(helperKey)); return Number.isFinite(saved?.confirmedAt); }
  catch { return false; }
}
export function rememberOutlookHelper(storage, now = Date.now()) {
  try { storage.setItem(helperKey, JSON.stringify({ confirmedAt: now })); return true; }
  catch { return false; }
}
export function readOutlookAttempt(storage, closureId, userId) {
  try {
    const value = JSON.parse(storage.getItem(attemptKey(closureId, userId)));
    return value && ['preparing', 'opened', 'uncertain', 'packaged'].includes(value.status) && Number.isFinite(value.at) ? value : null;
  } catch { return null; }
}
export function writeOutlookAttempt(storage, closureId, userId, value) {
  try {
    const key = attemptKey(closureId, userId);
    if (value) storage.setItem(key, JSON.stringify(value)); else storage.removeItem(key);
    return true;
  } catch { return false; }
}
