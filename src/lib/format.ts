// Metric-style number formatting (10K, 1.5M, etc.)
export function formatMetric(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n as number)) return "0";
  const num = Number(n);
  const abs = Math.abs(num);
  if (abs < 1000) return String(Math.round(num));
  const units = [
    { v: 1e9, s: "B" },
    { v: 1e6, s: "M" },
    { v: 1e3, s: "K" },
  ];
  for (const u of units) {
    if (abs >= u.v) {
      const val = num / u.v;
      const str = val >= 100 ? val.toFixed(0) : val.toFixed(1).replace(/\.0$/, "");
      return `${str}${u.s}`;
    }
  }
  return String(num);
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n as number)) return "0";
  return new Intl.NumberFormat("en-US").format(Math.round(Number(n)));
}

export function pct(part: number, total: number): string {
  if (!total) return "0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}