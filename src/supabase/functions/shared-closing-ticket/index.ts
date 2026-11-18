import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const allowedOrigin = 'https://dde-fretes.vercel.app';
const headers = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json',
  'Vary': 'Origin',
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin');
  if (origin && origin !== allowedOrigin) return json({ error: 'Origem inválida.' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return json({ error: 'Método inválido.' }, 405);

  const input = await request.json().catch(() => null);
  const { token, ticketId, driver, start = null, end = null } = input || {};
  const validDate = (value: unknown) => value === null || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value));
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)
      || typeof ticketId !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(ticketId)
      || typeof driver !== 'string' || !driver.trim() || driver.length > 256
      || !validDate(start) || !validDate(end)
      || (start && end && start > end)) return json({ error: 'Consulta inválida.' }, 400);

  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json({ error: 'Consulta indisponível.' }, 503);
  const server = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const tokenHash = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
  const { data: ticket, error } = await server.rpc('get_shared_closing_ticket_detail', {
    token_hash_input: tokenHash,
    driver_input: driver,
    start_input: start,
    end_input: end,
    ticket_input: ticketId,
  });
  if (error?.code === 'P0002') return json({ error: 'Link inválido ou desativado.' }, 403);
  if (error) return json({ error: 'Não foi possível consultar o ticket.' }, 500);
  if (!ticket) return json({ error: 'Ticket indisponível neste fechamento.' }, 404);

  const { number, date, weight, amount, status, driver: ticketDriver, plate, gross, discount } = ticket;
  let scanUrl = '';
  let scanError = false;
  if (ticket.scan_path) {
    const { data, error: storageError } = await server.storage.from('ticket-scans').createSignedUrl(ticket.scan_path, 300);
    scanUrl = data?.signedUrl || '';
    scanError = Boolean(storageError || !scanUrl);
  }

  return json({ number, date, weight, amount, status, driver: ticketDriver, plate, gross, discount,
    scanUrl, scanError,
    isPdf: ticket.scan_type === 'application/pdf' || /\.pdf$/i.test(ticket.scan_name || ticket.scan_path || ''),
  });
});
