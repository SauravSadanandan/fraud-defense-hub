import { COL } from "./config";
import { parseDate } from "./parseDate";

export interface DetectedCarrier {
  carrier: string;
  count: number;
}

export interface DetectedCountry {
  country: string;
  count: number;
  carriers: DetectedCarrier[];
}

export interface DetectedEvent {
  eventName: string;
  count: number;
  medianDeltaSec?: number;
}

export interface FileScan {
  totalRows: number;
  detectedMode: "Install" | "Event";
  countries: DetectedCountry[];
  events: DetectedEvent[];
  topCarriers: DetectedCarrier[];
}

function buildIndex(headers: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  headers.forEach((h, i) => {
    const key = String(h ?? "")
      .trim()
      .toLowerCase();
    if (key && !(key in idx)) idx[key] = i;
  });
  return idx;
}

function getVal(row: unknown[], idx: Record<string, number>, col: string): string {
  const i = idx[col.trim().toLowerCase()];
  if (i === undefined) return "";
  const v = row[i];
  if (v === null || v === undefined) return "";
  return typeof v === "string" ? v : String(v);
}

const RESERVOIR_SIZE = 100;

export function scanFile(headers: string[], rows: unknown[][]): FileScan {
  const idx = buildIndex(headers);
  const totalRows = rows.length;

  const countryCounts: Record<string, number> = {};
  const countryCarrierCounts: Record<string, Record<string, number>> = {};
  const globalCarrierCounts: Record<string, number> = {};
  const eventCounts: Record<string, number> = {};
  const eventDeltaSamples: Record<string, number[]> = {};
  const eventSampleCounts: Record<string, number> = {};

  let hasEventName = false;

  rows.forEach((r) => {
    const rawCountry = getVal(r, idx, COL.COUNTRY);
    const country = rawCountry.trim().toUpperCase();
    const carrier = getVal(r, idx, COL.CARRIER).trim();
    const eventName = getVal(r, idx, COL.EVENT_NAME).trim();

    if (country) {
      countryCounts[country] = (countryCounts[country] || 0) + 1;
      if (carrier) {
        if (!countryCarrierCounts[country]) countryCarrierCounts[country] = {};
        countryCarrierCounts[country][carrier] = (countryCarrierCounts[country][carrier] || 0) + 1;
      }
    }

    if (carrier) {
      globalCarrierCounts[carrier] = (globalCarrierCounts[carrier] || 0) + 1;
    }

    if (eventName) {
      hasEventName = true;
      eventCounts[eventName] = (eventCounts[eventName] || 0) + 1;

      const inst = parseDate(getVal(r, idx, COL.INSTALL_TIME));
      const ev = parseDate(getVal(r, idx, COL.EVENT_TIME));
      if (inst && ev) {
        const deltaSec = (ev.ms - inst.ms) / 1000;
        if (deltaSec >= 0) {
          if (!eventDeltaSamples[eventName]) {
            eventDeltaSamples[eventName] = [];
            eventSampleCounts[eventName] = 0;
          }
          const samples = eventDeltaSamples[eventName];
          const count = ++eventSampleCounts[eventName];
          if (samples.length < RESERVOIR_SIZE) {
            samples.push(deltaSec);
          } else {
            const j = Math.floor(Math.random() * count);
            if (j < RESERVOIR_SIZE) {
              samples[j] = deltaSec;
            }
          }
        }
      }
    }
  });

  const countries: DetectedCountry[] = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([country, count]) => {
      const carriersMap = countryCarrierCounts[country] || {};
      const carriers: DetectedCarrier[] = Object.entries(carriersMap)
        .sort((a, b) => b[1] - a[1])
        .map(([c, cnt]) => ({ carrier: c, count: cnt }));
      return { country, count, carriers };
    });

  const topCarriers: DetectedCarrier[] = Object.entries(globalCarrierCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([carrier, count]) => ({ carrier, count }));

  const events: DetectedEvent[] = Object.entries(eventCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => {
      let medianDeltaSec: number | undefined;
      const samples = eventDeltaSamples[name];
      if (samples && samples.length > 0) {
        samples.sort((a, b) => a - b);
        const mid = Math.floor(samples.length / 2);
        medianDeltaSec =
          samples.length % 2 !== 0
            ? samples[mid]
            : Math.round(((samples[mid - 1] + samples[mid]) / 2) * 10) / 10;
      }
      return { eventName: name, count, medianDeltaSec };
    });

  const detectedMode = hasEventName ? "Event" : "Install";

  return {
    totalRows,
    detectedMode,
    countries,
    events,
    topCarriers,
  };
}
