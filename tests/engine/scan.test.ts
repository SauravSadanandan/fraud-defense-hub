import { describe, it, expect } from "vitest";
import { scanFile } from "../../src/engine/scan";
import { FIXTURE_HEADERS, generateInstallRows, generateEventRows } from "./fixtures";

describe("scanFile", () => {
  it("accurately detects install mode and top countries/carriers", () => {
    const { headers, rows } = generateInstallRows(42);
    const scan = scanFile(headers, rows);

    expect(scan.totalRows).toBe(rows.length);
    expect(scan.detectedMode).toBe("Install");
    expect(scan.countries.length).toBeGreaterThan(0);
    expect(scan.countries[0].country).toBe("IN");
    expect(scan.countries[0].carriers.length).toBeGreaterThan(0);
  });

  it("accurately detects event mode, event list, and median timing deltas", () => {
    const { headers, rows } = generateEventRows(42);
    const scan = scanFile(headers, rows);

    expect(scan.totalRows).toBe(rows.length);
    expect(scan.detectedMode).toBe("Event");
    expect(scan.events.length).toBeGreaterThan(0);

    const firstOpen = scan.events.find((e) => e.eventName === "af_first_open");
    expect(firstOpen).toBeDefined();
    expect(firstOpen?.count).toBeGreaterThan(0);
    expect(firstOpen?.medianDeltaSec).toBeDefined();
  });
});
