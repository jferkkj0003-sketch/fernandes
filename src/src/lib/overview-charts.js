export function overviewSeries(rows = [], period = {}, driver = '') {
  const days = new Map();
  for (const row of rows) {
    if ((period.start && row.date < period.start) || (period.end && row.date > period.end) || (driver && row.driver !== driver)) continue;
    const day = days.get(row.date) || { date: row.date, weight: 0, amount: 0 };
    day.weight += Number(row.weight) || 0;
    day.amount += Number(row.amount) || 0;
    days.set(row.date, day);
  }
  let weight = 0, amount = 0;
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date)).map((day) => {
    weight += day.weight; amount += day.amount;
    return { ...day, cumulativeWeight: weight, cumulativeAmount: amount };
  });
}

export function stepGeometry(series, key) {
  if (!series.length) return { points: [], path: '', area: '', min: 0, max: 1 };
  const min = Math.min(0, ...series.map((point) => point[key]));
  const max = Math.max(0, ...series.map((point) => point[key])) || 1;
  const start = new Date(`${series[0].date}T12:00:00Z`).getTime();
  const end = new Date(`${series.at(-1).date}T12:00:00Z`).getTime();
  const y = (value) => 210 - (value - min) / (max - min || 1) * 180;
  const points = series.map((point) => ({ ...point, x: end === start ? 320 : 65 + (new Date(`${point.date}T12:00:00Z`).getTime() - start) / (end - start) * 525, y: y(point[key]) }));
  const path = `M 65 ${y(0)} ${points.map((point) => `H ${point.x} V ${point.y}`).join(' ')} H 590`;
  return { points, path, area: `${path} L 590 ${y(0)} L 65 ${y(0)} Z`, min, max, y };
}
