// Séries curtas para o gráfico que aparece ao passar o mouse sobre os indicadores.
// Agrupa os lançamentos em até `max` períodos (dia, semana ou mês, conforme o intervalo).

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DAY = 86400000;
const parse = (iso) => new Date(`${iso}T12:00:00`);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function mondayOf(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function bucketKey(dateISO, unit) {
  const d = parse(dateISO);
  if (unit === 'day') return dateISO;
  if (unit === 'week') return iso(mondayOf(d));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function nextKey(key, unit) {
  const d = parse(key);
  if (unit === 'day') d.setDate(d.getDate() + 1);
  else if (unit === 'week') d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1, 1);
  return iso(d);
}

function labelOf(key, unit) {
  const d = parse(key);
  if (unit === 'month') return MONTHS[d.getMonth()];
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function pickUnit(firstISO, lastISO) {
  const span = Math.round((parse(lastISO) - parse(firstISO)) / DAY) + 1;
  if (span <= 14) return 'day';
  if (span <= 90) return 'week';
  return 'month';
}

/**
 * @param {Array<{date:string}>} records registros com data ISO (AAAA-MM-DD)
 * @param {(record:object)=>number} pick valor somado em cada registro (0 ignora o registro)
 * @param {{max?:number}} options quantidade máxima de períodos
 * @returns {{unit:string, points:Array<{key:string,label:string,value:number}>, total:number}}
 */
export function buildSeries(records, pick, { max = 8 } = {}) {
  const dated = records.filter((record) => record.date && Number(pick(record)) !== 0);
  if (!dated.length) return { unit: 'month', points: [], total: 0 };
  const dates = dated.map((record) => record.date).sort();
  const unit = pickUnit(dates[0], dates[dates.length - 1]);
  const sums = new Map();
  for (const record of dated) {
    const key = bucketKey(record.date, unit);
    sums.set(key, (sums.get(key) || 0) + Number(pick(record) || 0));
  }
  // Preenche períodos sem lançamento para o gráfico não "pular" datas.
  const keys = [];
  let key = bucketKey(dates[0], unit);
  const last = bucketKey(dates[dates.length - 1], unit);
  while (key <= last && keys.length < 400) { keys.push(key); key = nextKey(key, unit); }
  const points = keys.slice(-max).map((k) => ({ key: k, label: labelOf(k, unit), value: sums.get(k) || 0 }));
  return { unit, points, total: points.reduce((sum, point) => sum + point.value, 0) };
}
