export function isOutdatedAssetError(error) {
  return /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|loading (?:css )?chunk|unable to preload css|failed to load module script/i.test(String(error?.message || error || ''));
}

export function appErrorMessage(error, fallback) {
  return isOutdatedAssetError(error)
    ? 'O aplicativo foi atualizado enquanto esta aba estava aberta. Atualize a página e tente novamente. O fechamento continua salvo.'
    : error?.message || fallback;
}

const prefix = 'dde-fretes-email-recovery-v1:';
const keyFor = (closureId, userId) => prefix + encodeURIComponent(userId || 'demo') + ':' + encodeURIComponent(closureId);
export function saveEmailRecovery(storage, closureId, userId, fields, now = Date.now()) {
  storage.setItem(keyFor(closureId, userId), JSON.stringify({ fields, savedAt: now }));
}
export function readEmailRecovery(storage, closureId, userId, now = Date.now()) {
  try {
    const value = JSON.parse(storage.getItem(keyFor(closureId, userId)));
    if (!value || !value.fields || !Number.isFinite(value.savedAt) || now - value.savedAt > 3600000 || value.savedAt > now) return null;
    if (!['to', 'cc', 'subject', 'body'].every((field) => typeof value.fields[field] === 'string')) return null;
    return value.fields;
  } catch { return null; }
}
export function clearEmailRecovery(storage, closureId, userId) {
  try { storage.removeItem(keyFor(closureId, userId)); } catch { /* Optional recovery storage. */ }
}
