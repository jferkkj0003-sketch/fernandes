const palette = ['#ef4444', '#eab308', '#3083f0', '#15a578', '#a274ed', '#e45785', '#16a9cd', '#8ca624'];

export function makeDriverColorMap(keys) {
  const uniqueKeys = [...new Set(keys)];
  return new Map(uniqueKeys.map((key, index) => {
    const extra = index - palette.length;
    const color = palette[index] || 'hsl(' + ((extra * 137.508 + 42) % 360)
      + ' ' + (58 + (extra % 3) * 8) + '% ' + (45 + (extra % 4) * 6) + '%)';
    return [key, color];
  }));
}
