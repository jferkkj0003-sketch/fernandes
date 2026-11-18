// Prévia de viagem no lançamento de tickets.
// Regras espelham o banco (trigger link_freight_preview): a prévia só vale para o
// MESMO motorista e a MESMA data de carregamento, e só uma vez.

const cents = (value) => Math.round(Number(value || 0) * 100);

// Prévias pendentes compatíveis com o motorista/data digitados no formulário.
export function matchingPreviews(previews, driverId, date) {
  if (!driverId || !date) return [];
  return (previews || []).filter((p) => p.driver_id === driverId && p.loading_date === date && !p.ticket_id && !p.cancelled_at);
}

// O vínculo continua válido enquanto motorista e data forem os da prévia.
export function linkStillValid(preview, driverId, date) {
  return Boolean(preview) && preview.driver_id === driverId && preview.loading_date === date;
}

// Resumo ao vivo do lançamento (a "prévia" do ticket antes de salvar).
export function ticketDraftSummary({ weight, gross, discount }, preview = null) {
  const grossC = cents(gross);
  const discountC = cents(discount);
  const netC = grossC - discountC;
  const estimatedC = preview ? cents(preview.amount) : null;
  const issues = [];
  if (discountC > grossC) issues.push('O desconto é maior que o valor bruto.');
  return {
    weight: Number(weight || 0),
    gross: grossC / 100,
    discount: discountC / 100,
    net: netC / 100,
    estimated: estimatedC === null ? null : estimatedC / 100,
    // positivo = ticket saiu acima do estimado na prévia
    difference: estimatedC === null ? null : (netC - estimatedC) / 100,
    paymentDate: preview ? preview.payment_date : null,
    issues,
    valid: issues.length === 0,
  };
}
