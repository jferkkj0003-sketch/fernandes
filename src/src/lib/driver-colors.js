// Série de gráficos em tons neutros (definidos em solid.css, claro e escuro). Distingue pela tonalidade e pelos rótulos.
const palette = Array.from({ length: 8 }, (_, index) => `var(--s${index + 1})`);

export function makeDriverColorMap(keys) {
  const uniqueKeys = [...new Set(keys)];
  return new Map(uniqueKeys.map((key, index) => {
    const color = palette[index % palette.length];
    return [key, color];
  }));
}
