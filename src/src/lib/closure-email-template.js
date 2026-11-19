import { nextPaymentDate, paymentToday } from './payments.js';

export const paymentDateLabel = (now = new Date()) => nextPaymentDate(paymentToday(now)).split('-').reverse().join('/');

export function closureEmailGreeting(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Manaus', hour: '2-digit', hourCycle: 'h23' }).format(now));
  if (hour >= 6 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function closureEmailTemplate(closure, now = new Date()) {
  const name = String(closure.driverDetails?.fullName || closure.driver || '').trim();
  return {
    subject: `PROGRAMAÇÃO DE PAGAMENTO - ${name}`,
    body: `${closureEmailGreeting(now)}!\n\nSegue em anexo controle fechado do motorista ${name}, programar pagamento para ${paymentDateLabel(now)}.\n\n• Controle;\n• Ticket de Pesagem;\n• Dados Bancários.\n\nPara mais detalhes, acesse: Consultar fretes.\n\nAtenciosamente.`,
  };
}

export function prepareClosureMessage(body, consultationUrl) {
  let text = String(body || '');
  const paymentDate = text.match(/\b(?:programar pagamento|pagamento programado) para\s+(\d{2}\/\d{2}\/\d{4})\b/i)?.[1] || '';
  let url = String(consultationUrl || '').trim();
  if (url) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'dde-fretes.vercel.app' || !/^[a-f0-9]{64}$/i.test(parsed.searchParams.get('painel') || '')) throw new Error('Use o link do painel de consulta deste app.');
    url = parsed.href;
  } else {
    text = text.replace(/^Para mais detalhes, acesse: Consultar fretes\.(?:\r?\n(?:\r?\n)?|$)/m, '');
  }
  return { body: text, consultationUrl: url, paymentDate };
}
