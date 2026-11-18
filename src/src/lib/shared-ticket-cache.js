export const SHARED_TICKET_PAGE_SIZE = 50;

const TTL = 90_000;
const MAX_SCAN_BYTES = 40 * 1024 * 1024;

function scanType(info, contentType) {
  if (info.isPdf) return 'application/pdf';
  return ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(contentType) ? contentType : '';
}

export function createSharedTicketCache({ token, start, end, loadList, loadDetails, fetchScan = fetch }) {
  const lists = new Map();
  const details = new Map();
  const scans = new Map();
  let pendingScans = new AbortController();

  function cached(map, key, work) {
    const existing = map.get(key);
    if (existing && existing.until > Date.now()) return existing.promise;
    const entry = { until: Infinity, size: 0 };
    entry.promise = Promise.resolve().then(work).then((value) => {
      entry.until = Date.now() + TTL;
      entry.size = value instanceof Blob ? value.size : 0;
      if (map === scans && map.get(key) === entry) {
        map.delete(key);
        if (entry.size <= MAX_SCAN_BYTES) map.set(key, entry);
        for (const [oldKey, oldEntry] of map) {
          if (oldEntry.until !== Infinity && (oldEntry.until < Date.now() || scanBytes() > MAX_SCAN_BYTES)) map.delete(oldKey);
        }
      }
      return value;
    }, (error) => {
      if (map.get(key) === entry) map.delete(key);
      throw error;
    });
    map.set(key, entry);
    return entry.promise;
  }

  function scanBytes() {
    let size = 0;
    for (const entry of scans.values()) size += entry.size;
    return size;
  }

  function list(driver, page = 0) {
    return cached(lists, JSON.stringify([driver, page]), () =>
      loadList(token, driver, start, end, page * SHARED_TICKET_PAGE_SIZE));
  }

  function detail(driver, ticketId) {
    return cached(details, ticketId, () => loadDetails(token, ticketId, driver, start, end));
  }

  function scan(ticketId, info, background = false) {
    const signal = pendingScans.signal;
    return cached(scans, ticketId, async () => {
      const response = await fetchScan(info.scanUrl, {
        signal, priority: background ? 'low' : 'auto', referrerPolicy: 'no-referrer',
      });
      if (!response.ok) throw new Error('Comprovante indisponível.');
      const blob = await response.blob();
      const type = scanType(info, blob.type);
      if (!type) throw new Error('Formato de comprovante inválido.');
      return blob.type === type ? blob : new Blob([blob], { type });
    });
  }

  async function warm(drivers, signal) {
    let remaining = drivers;
    let page = 0;
    let downloadedBytes = 0;
    const stopped = () => signal.aborted || downloadedBytes >= MAX_SCAN_BYTES;

    while (remaining.length && !stopped()) {
      const pages = [];
      let driverIndex = 0;
      async function loadPages() {
        while (!stopped() && driverIndex < remaining.length) {
          const index = driverIndex++;
          const driver = remaining[index];
          try {
            const rows = await list(driver, page);
            pages[index] = { driver, hasMore: rows.length > SHARED_TICKET_PAGE_SIZE,
              open: rows.slice(0, SHARED_TICKET_PAGE_SIZE).filter((row) => row.status === 'Em aberto') };
          } catch {
            pages[index] = { driver, hasMore: false, open: [] };
          }
        }
      }
      await Promise.all([loadPages(), loadPages()]);
      if (stopped()) return;

      // Alternate between drivers so the first open ticket of each is queued first.
      const queue = [];
      const longest = Math.max(0, ...pages.map(({ open }) => open.length));
      for (let rowIndex = 0; rowIndex < longest; rowIndex += 1) {
        for (const { driver, open } of pages) {
          if (open[rowIndex]) queue.push({ id: open[rowIndex].id, driver });
        }
      }

      let next = 0;
      async function download() {
        while (!stopped() && next < queue.length) {
          const { id, driver } = queue[next++];
          try {
            const info = await detail(driver, id);
            if (info.scanUrl && !stopped()) {
              const blob = await scan(id, info, true);
              downloadedBytes += blob.size;
            }
          } catch {
            // Opening the ticket retries a failed background download.
          }
        }
      }
      await Promise.all([download(), download()]);
      remaining = pages.filter(({ hasMore }) => hasMore).map(({ driver }) => driver);
      page += 1;
    }
  }

  return {
    list, detail, scan, warm,
    retryList(driver, page) { lists.delete(JSON.stringify([driver, page])); },
    retryTicket(ticketId) { details.delete(ticketId); scans.delete(ticketId); },
    clear() {
      pendingScans.abort();
      pendingScans = new AbortController();
      lists.clear();
      details.clear();
      scans.clear();
    },
  };
}
