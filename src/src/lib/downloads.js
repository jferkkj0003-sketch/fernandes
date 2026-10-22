const DB_NAME = 'dde-fretes-download-preferences';
const STORE = 'preferences';

async function directorySetting(action, value) {
  if (!globalThis.indexedDB) {
    if (action === 'get') return null;
    throw new Error('Este navegador não consegue guardar a pasta. Use o Chrome ou Edge.');
  }
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, action === 'get' ? 'readonly' : 'readwrite');
      const store = transaction.objectStore(STORE);
      const request = action === 'get' ? store.get('directory') : action === 'put' ? store.put(value, 'directory') : store.delete('directory');
      transaction.oncomplete = () => resolve(action === 'get' ? request.result || null : undefined);
      transaction.onerror = () => reject(transaction.error || request.error);
      transaction.onabort = () => reject(transaction.error || new Error('Não foi possível guardar a preferência.'));
    });
  } finally { database.close(); }
}

function browserDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function createDownloadPreferences({ load, store, remove, pick, browserSave }) {
  let current = load();
  // Errors remain available to callers, without an unhandled startup rejection.
  current.catch(() => {});
  return {
    getDirectory: () => current,
    async chooseDirectory() {
      // Open the picker directly from the click, before any storage/network awaits.
      const directory = await pick();
      if (!directory) return null;
      await store(directory);
      current = Promise.resolve(directory);
      return directory;
    },
    async useBrowserDefault() {
      await remove();
      current = Promise.resolve(null);
    },
    async prepare() {
      const directory = await current;
      if (!directory) return null;
      const permission = { mode: 'readwrite' };
      if (await directory.queryPermission(permission) !== 'granted' && await directory.requestPermission(permission) !== 'granted') {
        throw new Error('Autorize a pasta em Minha conta → Pasta de downloads e tente novamente.');
      }
      return directory;
    },
    async save(blob, filename, directory) {
      if (!directory) {
        browserSave(blob, filename);
        return { mode: 'browser', filename };
      }
      // Keep previous PDFs intact when the same closure is downloaded again.
      const dot = filename.lastIndexOf('.');
      const base = dot > 0 ? filename.slice(0, dot) : filename;
      const extension = dot > 0 ? filename.slice(dot) : '';
      let available = filename;
      let found = false;
      for (let index = 1; index <= 1000; index++) {
        available = index === 1 ? filename : `${base} (${index})${extension}`;
        try { await directory.getFileHandle(available); }
        catch (error) {
          if (error.name !== 'NotFoundError') throw error;
          found = true;
          break;
        }
      }
      if (!found) throw new Error('Há muitos PDFs com esse nome na pasta. Renomeie alguns arquivos e tente novamente.');
      const file = await directory.getFileHandle(available, { create: true });
      const writable = await file.createWritable();
      try { await writable.write(blob); await writable.close(); }
      catch (error) { try { await writable.abort(); } catch { /* Keep the original write error. */ } throw error; }
      return { mode: 'folder', filename: available, folder: directory.name };
    },
  };
}

export const downloadPreferences = createDownloadPreferences({
  load: () => directorySetting('get'),
  store: (directory) => directorySetting('put', directory),
  remove: () => directorySetting('delete'),
  pick: () => window.showDirectoryPicker({ id: 'dde-fretes-downloads', mode: 'readwrite', startIn: 'downloads' }),
  browserSave: browserDownload,
});
