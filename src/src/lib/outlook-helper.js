import { normalizeRecipients } from './email-recipients.js';

export const OUTLOOK_INSTALLER = '/outlook/DDE-Outlook.exe?v=1.0.1';
export function bytesToBase64(bytes) {
  let result = '';
  // A multiple of three avoids internal padding between chunks.
  for (let i = 0; i < bytes.length; i += 24576) result += btoa(String.fromCharCode(...bytes.subarray(i, i + 24576)));
  return result;
}
export function helperLaunch(token, port) {
  if (!/^[a-f0-9]{64}$/.test(token) || !Number.isInteger(port) || port < 49152 || port > 65535) throw new Error('Solicitação inválida para o auxiliar.');
  return `dde-fretes-outlook://compose?token=${token}&port=${port}`;
}
export function createHelperSession({ token, port, request = fetch, launch, pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), now = Date.now }) {
  const url = helperLaunch(token, port);
  launch(url);
  const endpoint = `http://127.0.0.1:${port}`;
  const options = { mode: 'cors', credentials: 'omit', cache: 'no-store', targetAddressSpace: 'loopback', headers: { 'X-DDE-Token': token } };
  const timedRequest = async (path, init, timeout) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try { return await request(endpoint + path, { ...options, ...init, signal: controller.signal }); }
    finally { clearTimeout(timer); }
  };
  let submitted = false;
  return {
    async ready() {
      const deadline = now() + 45000;
      do {
        try {
          const response = await timedRequest('/health', {}, 5000);
          if (response.ok) {
            const data = await response.json();
            if (data.app === 'dde-outlook' && data.version === 1) return;
          }
        } catch { /* The protocol handler may still be starting or awaiting browser approval. */ }
        await pause(700);
      } while (now() < deadline);
      throw new Error('Não consegui conectar ao auxiliar. Instale-o uma vez neste computador e autorize a abertura e o acesso local quando o navegador solicitar. Depois clique novamente em Abrir no Outlook.');
    },
    async compose({ pdf, filename, to, cc, subject, body }) {
      if (submitted) throw new Error('Esta solicitação já foi usada. Confira se a mensagem abriu no Outlook antes de tentar outra vez.');
      const recipients = normalizeRecipients(to, cc);
      if (!recipients.to.length) throw new Error('Informe pelo menos um destinatário no campo Para.');
      if (pdf.size > 60 * 1024 * 1024) throw new Error('O PDF ultrapassa 60 MB. Use a alternativa em ZIP ou revise os comprovantes.');
      const encoded = bytesToBase64(new Uint8Array(await pdf.arrayBuffer()));
      submitted = true;
      let response;
      try {
        response = await timedRequest('/compose', {
          method: 'POST', headers: { ...options.headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: token, filename, to: recipients.to.join('; '), cc: recipients.cc.join('; '), subject, body, pdf: encoded }),
        }, 90000);
      } catch { throw new Error('O auxiliar não confirmou a abertura. Confira o Outlook antes de repetir para evitar duas mensagens.'); }
      const result = await response.json();
      if (!response.ok || result.opened !== true) throw new Error(result.error || 'O auxiliar não confirmou a mensagem. Confira o Outlook antes de tentar novamente.');
      return 'Mensagem aberta no Outlook com o PDF. Confira os destinatários, a assinatura e o anexo antes de enviar.';
    },
  };
}
export function startOutlookHelper() {
  const random = crypto.getRandomValues(new Uint8Array(34));
  const token = [...random.subarray(0, 32)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const port = 49152 + ((random[32] * 256 + random[33]) % 16384);
  return createHelperSession({ token, port, launch: (url) => { window.location.href = url; } });
}
