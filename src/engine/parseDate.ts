// Tolerant date parser for AppsFlyer raw exports.
// Returns { ms, hour, date } where hour/date reflect the wall-clock values
// written in the export (assumed IST, matching the original GAS Asia/Kolkata
// logic). Time differences (CTIT) are timezone-independent.
export interface ParsedDate {
  ms: number;
  hour: number;
  date: string;
}

export function parseDate(value: unknown): ParsedDate | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !isNaN(value.getTime())) {
    return {
      ms: value.getTime(),
      hour: value.getUTCHours(),
      date: value.toISOString().slice(0, 10),
    };
  }
  const str = String(value).trim();
  if (!str) return null;

  // yyyy-MM-dd HH:mm:ss  (also accepts T separator, optional ms/zone)
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const [, y, mo, d, h, mi, s] = m;
    const ms = Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0);
    return { ms, hour: +h, date: `${y}-${mo}-${d}` };
  }
  // dd/MM/yyyy HH:mm or MM/dd/yyyy HH:mm
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const [, a, b, y, h, mi, s] = m;
    // Heuristic: if first part > 12 it's day-first, else assume day-first (intl)
    const day = +a > 12 ? +a : +a;
    const mon = +a > 12 ? +b : +b;
    const ms = Date.UTC(+y, mon - 1, day, +h, +mi, s ? +s : 0);
    return { ms, hour: +h, date: `${y}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
  }
  // date only yyyy-MM-dd
  m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return { ms: Date.UTC(+y, +mo - 1, +d), hour: 0, date: `${y}-${mo}-${d}` };
  }
  // Fallback to native parser
  const t = Date.parse(str);
  if (!isNaN(t)) {
    const dt = new Date(t);
    return { ms: t, hour: dt.getHours(), date: dt.toISOString().slice(0, 10) };
  }
  return null;
}