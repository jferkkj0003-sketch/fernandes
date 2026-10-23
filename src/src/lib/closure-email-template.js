import { nextPaymentDate, paymentToday } from './payments.js';

export const paymentDateLabel = (now = new Date()) => nextPaymentDate(paymentToday(now)).split('-').reverse().join('/');

export function closureEmailTemplate(closure, now = new Date()) {
  const name = String(closure.driverDetails?.fullName || closure.driver || '').trim();
  return {
    subject: `PROGRAMAÇÃO DE PAGAMENTO - ${name}`,
    body: `Boa tarde!\n\nSegue em anexo controle fechado do motorista ${name}, programar pagamento para ${paymentDateLabel(now)}.\n\n• Controle;\n• Ticket de Pesagem;\n• Dados Bancários.\n\nPara mais detalhes, acesse: Consultar fretes.\n\nAtenciosamente.`,
  };
}

export function prepareClosureMessage(body, consultationUrl, now = new Date()) {
  const paymentDate = paymentDateLabel(now);
  let text = String(body || '');
  const datePattern = /((?:programar pagamento|pagamento programado) para\s+)\d{2}\/\d{2}\/\d{4}/gi;
  if (datePattern.test(text)) text = text.replace(datePattern, `$1${paymentDate}`);
  else text += `\n\nPagamento programado para ${paymentDate}.`;
  let url = String(consultationUrl || '').trim();
  if (url) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'dde-fretes.vercel.app' || !/^[a-f0-9]{64}$/i.test(parsed.searchParams.get('painel') || '')) throw new Error('Use o link do painel de consulta deste app.');
    url = parsed.href;
  } else {
    text = text.replace(/^Para mais detalhes, acesse: Consultar fretes\.\s*$/m, '').replace(/\n{3,}/g, '\n\n');
  }
  return { body: text, consultationUrl: url, paymentDate };
}
