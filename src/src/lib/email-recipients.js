export function parseRecipients(value) {
  const addresses = String(value || '').split(/[;,\r\n]+/).map((item) => item.trim().replace(/^['"]+|['"]+$/g, '').trim()).filter(Boolean);
  const invalid = addresses.find((address) => !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(address));
  if (invalid) throw new Error(`Confira este endereço de e-mail: ${invalid}`);
  return [...new Map(addresses.map((address) => [address.toLowerCase(), address])).values()];
}

export function normalizeRecipients(to, cc) {
  const main = parseRecipients(to);
  const mainSet = new Set(main.map((address) => address.toLowerCase()));
  return { to: main, cc: parseRecipients(cc).filter((address) => !mainSet.has(address.toLowerCase())) };
}
