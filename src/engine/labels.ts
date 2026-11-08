import type { Settings } from "./config";

export interface CtitBucketLabels {
  inject: string;
  suspicious: string;
  normal: string;
  flood: string;
}

export function ctitBucketLabels(settings?: Settings): CtitBucketLabels {
  const injectSec = settings?.thresholds?.ctitClickInjectSec ?? 10;
  const floodDays = settings?.thresholds?.ctitClickFloodDays ?? 1;
  const floodHours = floodDays * 24;

  return {
    inject: `Inject (<${injectSec}s)`,
    suspicious: `Suspicious (${injectSec}s-1m)`,
    normal: `Normal (1m-${floodHours}h)`,
    flood: `Flood (>${floodHours}h)`,
  };
}

export interface KpiLabels {
  ctitLow: string;
  ctitHigh: string;
}

export function kpiLabels(settings?: Settings): KpiLabels {
  const injectSec = settings?.thresholds?.ctitClickInjectSec ?? 10;
  const floodDays = settings?.thresholds?.ctitClickFloodDays ?? 1;

  return {
    ctitLow: `CTIT < ${injectSec}s`,
    ctitHigh: floodDays === 1 ? "CTIT > 1 day" : `CTIT > ${floodDays} days`,
  };
}
