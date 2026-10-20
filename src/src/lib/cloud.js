import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim();

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;
export const cloudConfigured = Boolean(supabase);
const scanBucket = 'ticket-scans';
const scanCacheName = 'dde-fretes-ticket-scans-v1';
const scanDownloadsInFlight = new Map();

function scanCacheKey(path) {
  return new URL(`/__dde-fretes-ticket-cache__/${encodeURIComponent(path)}`, window.location.origin).toString();
}

async function openScanCache() {
  if (!globalThis.caches || !window.isSecureContext) return null;
  try { return await globalThis.caches.open(scanCacheName); }
  catch { return null; }
}

export async function clearCloudTicketScanCache() {
  if (!globalThis.caches) return;
  try { await globalThis.caches.delete(scanCacheName); } catch { /* Cache is optional; cloud download remains available. */ }
}

export async function prefetchCloudTicketScans(paths, onProgress = () => {}) {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  let completed = 0;
  for (const path of uniquePaths) {
    try { await downloadCloudTicketScan(path); } catch { /* A later open will retry and show the normal error if it persists. */ }
    completed += 1;
    onProgress(completed, uniquePaths.length);
  }
}

const formatDate = (value) => {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
};

const mapDriver = (row) => ({
  id: row.id, name: row.name, plate: row.plate || '', cpf: row.cpf || '', pix: row.pix || '',
  bank: row.bank || '', accountType: row.account_type || '', branch: row.branch || '', account: row.account || '',
  defaultFare: Number(row.default_fare ?? 1000),
});

const mapTicket = (row) => ({
  id: row.id, createdAt: row.created_at || null, dateISO: row.date, date: formatDate(row.date), number: row.number,
  driver: row.driver?.name || row.driver_name || '', plate: row.plate || '', weight: Number(row.weight) || 0,
  gross: Number(row.gross) || 0, discount: Number(row.discount) || 0, note: row.note || '', status: row.status,
  closureId: row.closure_id || null,
  scanPath: row.scan_path || null, scanName: row.scan_name || '', scanType: row.scan_type || '', scanSize: Number(row.scan_size) || 0,
});

const mapSnapshotTicket = (row) => ({
  id: row.id, dateISO: row.date, date: formatDate(row.date), number: row.number,
  driver: row.driver || '', plate: row.plate || '', weight: Number(row.weight) || 0,
  gross: Number(row.gross) || 0, discount: Number(row.discount) || 0, note: row.note || '', status: row.status || 'No fechamento',
  scanPath: row.scan_path || null, scanName: row.scan_name || '', scanType: row.scan_type || '', scanSize: Number(row.scan_size) || 0,
});

const mapClosure = (row) => {
  const driver = row.driver_snapshot || {};
  const ticketDetails = (row.tickets_snapshot || []).map(mapSnapshotTicket);
  return {
    id: row.id, number: String(row.number).padStart(3, '0'), driver: driver.fullName || driver.name || '',
    start: row.period_start, end: row.period_end, count: row.ticket_count, total: Number(row.total) || 0,
    status: row.status, createdAt: row.created_at || null, sentAt: row.sent_at || null,
    ticketIds: ticketDetails.map((ticket) => ticket.id), ticketDetails,
    driverDetails: {
      fullName: driver.fullName || driver.name || '', cpf: driver.cpf || '', plate: driver.plate || '',
      pix: driver.pix || '', bank: driver.bank || '', accountType: driver.accountType || '',
      branch: driver.branch || '', account: driver.account || '',
    },
  };
};

export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function verifyAdminPassword(email, password, expectedUserId) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (data.user?.id !== expectedUserId) throw new Error('A senha não corresponde à conta administradora conectada.');
  return true;
}

export async function emailForUsername(username) {
  const { data, error } = await supabase.rpc('resolve_login_email', { username_input: username });
  if (error) throw error;
  return data || null;
}

export async function getSession() {
  return supabase.auth.getSession();
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

async function fetchAllRows(queryFactory, pageSize = 1000) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await queryFactory().range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

export async function loadCloudData() {
  const [driverResult, ticketResult, closureResult] = await Promise.all([
    fetchAllRows(() => supabase.from('drivers').select('*').order('name').order('id')),
    fetchAllRows(() => supabase.from('tickets').select('*, driver:drivers(name)').order('date', { ascending: false }).order('created_at', { ascending: false }).order('id')),
    fetchAllRows(() => supabase.from('closures').select('*').order('number', { ascending: false }).order('id')),
  ]);
  const closures = closureResult.map(mapClosure);
  const closureStatuses = new Map(closures.map((closure) => [closure.id, closure.status]));
  const tickets = ticketResult.map(mapTicket).map((ticket) => ({
    ...ticket,
    requestStatus: closureStatuses.get(ticket.closureId) || ticket.status,
  }));
  return {
    drivers: driverResult.map(mapDriver),
    tickets,
    closures,
  };
}

export async function saveCloudDriver(driver) {
  const values = {
    name: driver.name, plate: driver.plate, cpf: driver.cpf, pix: driver.pix, bank: driver.bank,
    account_type: driver.accountType, branch: driver.branch, account: driver.account,
    default_fare: Number(driver.defaultFare ?? 1000),
  };
  const query = driver.id
    ? supabase.from('drivers').update(values).eq('id', driver.id)
    : supabase.from('drivers').insert(values);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return mapDriver(data);
}

export async function deleteCloudDriver(id) {
  const ticketResult = await supabase.from('tickets').select('scan_path').eq('driver_id', id);
  if (ticketResult.error) throw ticketResult.error;
  const closures = await supabase.from('closures').delete().eq('driver_id', id);
  if (closures.error) throw closures.error;
  const tickets = await supabase.from('tickets').delete().eq('driver_id', id);
  if (tickets.error) throw tickets.error;
  const scanPaths = ticketResult.data.map((ticket) => ticket.scan_path).filter(Boolean);
  if (scanPaths.length) {
    const { error: storageError } = await supabase.storage.from(scanBucket).remove(scanPaths);
    if (storageError) console.warn('Motorista e tickets excluídos, mas alguns escaneamentos não puderam ser removidos.', storageError);
  }
  const driver = await supabase.from('drivers').delete().eq('id', id);
  if (driver.error) throw driver.error;
}

export async function deleteCloudTicket(id) {
  const { data: ticket, error: readError } = await supabase.from('tickets').select('scan_path, closure_id').eq('id', id).maybeSingle();
  if (readError) throw readError;
  const { error } = await supabase.from('tickets').delete().eq('id', id);
  if (error) throw error;
  if (ticket?.scan_path && !ticket.closure_id) {
    const { error: storageError } = await supabase.storage.from(scanBucket).remove([ticket.scan_path]);
    if (storageError) console.warn('O ticket foi excluído, mas o arquivo escaneado não pôde ser removido do armazenamento.', storageError);
  }
}

export async function updateCloudAccount({ displayName, username, password }) {
  const updates = { data: { display_name: displayName, username: username.trim() } };
  if (password) updates.password = password;
  const { data, error } = await supabase.auth.updateUser(updates);
  if (error) throw error;
  const { error: aliasError } = await supabase.rpc('set_login_alias', { username_input: username });
  if (aliasError) throw aliasError;
  return data.user;
}

async function prepareScanFile(file) {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    if (file.size > 10 * 1024 * 1024) throw new Error('O PDF do ticket precisa ter até 10 MB.');
    return file.type === 'application/pdf' ? file : new File([file], file.name, { type: 'application/pdf', lastModified: file.lastModified });
  }
  if (!file.type.startsWith('image/')) throw new Error('Escolha um PDF ou uma imagem do ticket.');
  let bitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error('Não consegui abrir esta foto. Escolha JPG, PNG ou PDF.'); }
  const maxDimension = 2200;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const compressed = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.76));
  if (!compressed) throw new Error('Não consegui preparar a foto do ticket. Tente outra imagem.');
  if (compressed.size > 5 * 1024 * 1024) throw new Error('A foto continua muito grande. Escolha uma imagem menor.');
  const safeBaseName = file.name.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 70) || 'ticket';
  return new File([compressed], `${safeBaseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}

export async function saveCloudTicket(ticket, driverId, scanFile = null) {
  if (!scanFile?.size) throw new Error('Anexe o comprovante escaneado do ticket antes de salvar.');
  const ticketId = crypto.randomUUID();
  let scanPath = null;
  let preparedFile = null;
  if (scanFile.size) {
    preparedFile = await prepareScanFile(scanFile);
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw userError || new Error('Sua sessão expirou. Entre novamente para anexar o escaneamento.');
    const extension = preparedFile.type === 'application/pdf' ? 'pdf' : 'jpg';
    scanPath = `${user.id}/${ticketId}/comprovante.${extension}`;
    const { error: uploadError } = await supabase.storage.from(scanBucket).upload(scanPath, preparedFile, {
      contentType: preparedFile.type, cacheControl: '3600', upsert: false,
    });
    if (uploadError) throw uploadError;
  }
  const { data, error } = await supabase.from('tickets').insert({
    id: ticketId, number: ticket.number, date: ticket.dateISO, driver_id: driverId, plate: ticket.plate,
    weight: ticket.weight, gross: ticket.gross, discount: ticket.discount, note: ticket.note, status: 'Aberto',
    scan_path: scanPath, scan_name: scanFile?.name || null, scan_type: preparedFile?.type || null, scan_size: preparedFile?.size || null,
  }).select('*, driver:drivers(name)').single();
  if (error) {
    if (scanPath) await supabase.storage.from(scanBucket).remove([scanPath]);
    throw error;
  }
  return mapTicket(data);
}

export async function downloadCloudTicketScan(path) {
  if (!path) return null;
  if (scanDownloadsInFlight.has(path)) return scanDownloadsInFlight.get(path);
  const download = (async () => {
    const cache = await openScanCache();
    const key = scanCacheKey(path);
    if (cache) {
      try {
        const response = await cache.match(key);
        if (response) return await response.blob();
      } catch { /* Ignore an unavailable or expired local cache and use Supabase. */ }
    }
    const { data, error } = await supabase.storage.from(scanBucket).download(path);
    if (error) throw error;
    if (cache && data) {
      try { await cache.put(key, new Response(data, { headers: { 'Content-Type': data.type || 'application/octet-stream' } })); }
      catch { /* The browser may reject storage; the downloaded file still works this time. */ }
    }
    return data;
  })();
  scanDownloadsInFlight.set(path, download);
  try { return await download; }
  finally { scanDownloadsInFlight.delete(path); }
}

export async function loadCloudTicketEditHistory(ticketId) {
  const { data, error } = await supabase.from('ticket_edit_history')
    .select('id, ticket_number, changed_at, changed_by_name, before_data, after_data')
    .eq('ticket_id', ticketId)
    .order('changed_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return data || [];
}

export async function updateCloudTicket(id, fields, scanFile = null) {
  let uploadedPath = null;
  let preparedFile = null;
  if (scanFile?.size) {
    preparedFile = await prepareScanFile(scanFile);
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw userError || new Error('Sua sessão expirou. Entre novamente para trocar o comprovante.');
    const extension = preparedFile.type === 'application/pdf' ? 'pdf' : 'jpg';
    uploadedPath = `${user.id}/${id}/comprovante-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from(scanBucket).upload(uploadedPath, preparedFile, {
      contentType: preparedFile.type, cacheControl: '3600', upsert: false,
    });
    if (uploadError) throw uploadError;
  }
  const fieldsInput = {
    number: fields.number, date: fields.dateISO, driver_id: fields.driverId,
    plate: fields.plate, weight: fields.weight, gross: fields.gross,
    discount: fields.discount, note: fields.note,
  };
  if (uploadedPath) Object.assign(fieldsInput, {
    scan_path: uploadedPath, scan_name: scanFile.name, scan_type: preparedFile.type, scan_size: preparedFile.size,
  });
  const { error } = await supabase.rpc('edit_ticket', { ticket_uuid: id, fields_input: fieldsInput });
  if (error) {
    if (uploadedPath) await supabase.storage.from(scanBucket).remove([uploadedPath]);
    throw error;
  }
  if (uploadedPath && fields.scanPath) {
    const { error: removeError } = await supabase.storage.from(scanBucket).remove([fields.scanPath]);
    if (removeError) console.warn('Ticket atualizado, mas o comprovante antigo não pôde ser removido do armazenamento.', removeError);
  }
}

export async function requestCloudClosure(id) {
  const { error } = await supabase.rpc('mark_closure_requested', { closure_uuid: id });
  if (error) throw error;
}

export async function createCloudClosure(driverId, start, end, ticketIds) {
  const { data, error } = await supabase.rpc('create_driver_closure', {
    selected_driver_id: driverId, date_from: start, date_to: end,
    selected_ticket_ids: ticketIds,
  });
  if (error) throw error;
  return data;
}

export async function deleteCloudClosure(id) {
  const { error } = await supabase.rpc('delete_driver_closure', { closure_uuid: id });
  if (error) throw error;
}

export async function updateCloudClosure(id, tickets) {
  const { error } = await supabase.rpc('update_driver_closure', {
    closure_uuid: id,
    tickets_input: tickets.map(({ id: ticketId, gross, discount, note }) => ({
      id: ticketId, gross, discount, note,
    })),
  });
  if (error) throw error;
}

export async function isCloudAdmin() {
  const { data, error } = await supabase.rpc('is_app_admin');
  if (error) throw error;
  return Boolean(data);
}

export async function getCloudAppRole() {
  const { data, error } = await supabase.rpc('get_app_role');
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      const admin = await isCloudAdmin();
      return admin ? 'admin' : null;
    }
    throw error;
  }
  return data || null;
}

async function hashToken(token) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, '0')).join('');
}

export async function createOperatorInvite(token, label) {
  const { data, error } = await supabase.rpc('create_operator_invite', {
    token_hash_input: await hashToken(token), label_input: label,
  });
  if (error) throw error;
  return data;
}

export async function listOperatorAccounts() {
  const { data, error } = await supabase.rpc('list_operator_accounts');
  if (error) throw error;
  return data || [];
}

async function invokeOperatorAdmin(body) {
  const { data, error } = await supabase.functions.invoke('operator-admin', { body });
  if (error) {
    let details;
    try { details = await error.context?.json(); } catch { /* Use the standard function error if no response body is available. */ }
    throw new Error(details?.error || error.message || 'Não foi possível concluir a operação.');
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function setOperatorActive(userId, active) {
  await invokeOperatorAdmin({ action: 'set_operator_active', user_id: userId, active });
}

export async function deleteOperatorAccount(userId) {
  await invokeOperatorAdmin({ action: 'delete_operator', user_id: userId });
}

export async function redeemOperatorInvite({ token, displayName, username, password }) {
  return invokeOperatorAdmin({ action: 'redeem_invite', token, display_name: displayName, username, password });
}

export async function getDashboardShareLink() {
  const { data, error } = await supabase.rpc('get_dashboard_share_link');
  if (error) throw error;
  return data || null;
}

export async function createDashboardShare(token) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const tokenHash = Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, '0')).join('');
  const { error } = await supabase.rpc('create_dashboard_share', { token_input: token, token_hash_input: tokenHash });
  if (error) throw error;
}

export async function revokeDashboardShare() {
  const { error } = await supabase.rpc('revoke_dashboard_share');
  if (error) throw error;
}

export async function loadSharedDashboard(token) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const tokenHash = Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, '0')).join('');
  const [dashboardResult, driverResult] = await Promise.all([
    supabase.rpc('get_shared_dashboard', { token_hash_input: tokenHash }),
    supabase.rpc('get_shared_driver_summary', { token_hash_input: tokenHash }),
  ]);
  const error = dashboardResult.error || driverResult.error;
  if (error) throw error;
  return {
    ...dashboardResult.data,
    drivers_by_day: driverResult.data?.drivers_by_day || [],
  };
}

export function subscribeCloudChanges(onChange) {
  return supabase.channel('dde-fretes-live-updates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'closures' }, onChange)
    .subscribe();
}

export async function signOut() {
  return supabase.auth.signOut();
}
