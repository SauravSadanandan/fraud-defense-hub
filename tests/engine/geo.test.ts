import { describe, it, expect } from "vitest";
import { enrichRows } from "../../src/engine/fraudEngine";
import { DEFAULT_SETTINGS, BLANK_SETTINGS, type Settings } from "../../src/engine/config";
import { FIXTURE_HEADERS } from "./fixtures";

function makeRow(overrides: Record<string, string> = {}): unknown[] {
  const map: Record<string, string> = {
    "Country Code": "IN",
    Carrier: "Jio",
    "AppsFlyer ID": "af_1",
    "Attributed Touch Time": "2025-01-10 10:00:00",
    "Install Time": "2025-01-10 10:15:00",
    "Advertising ID": "gaid_123",
    "Device Model": "CleanModel",
    "OS Version": "13",
    Platform: "android",
    "Is Primary Attribution": "true",
    ...overrides,
  };
  return FIXTURE_HEADERS.map((h) => map[h] ?? "");
}

describe("Multi-GEO and Carrier Validation", () => {
  const multiGeoSettings: Settings = {
    ...DEFAULT_SETTINGS,
    geos: [
      { country: "IN", knownCarriers: ["Jio", "Airtel"] },
      { country: "US", knownCarriers: ["Verizon", "AT&T", "T-Mobile"] },
    ],
  };

  it("permits allowed countries with allowed carriers", () => {
    const rowIn = makeRow({ "Country Code": "IN", Carrier: "Jio" });
    const rowUs = makeRow({ "Country Code": "US", Carrier: "Verizon" });

    const enriched = enrichRows(FIXTURE_HEADERS, [rowIn, rowUs], multiGeoSettings);
    expect(enriched[0].signals).not.toContain(expect.stringContaining("Mismatch"));
    expect(enriched[1].signals).not.toContain(expect.stringContaining("Mismatch"));
  });

  it("flags unlisted country with Geo Mismatch", () => {
    const rowSg = makeRow({ "Country Code": "SG", Carrier: "Singtel" });
    const enriched = enrichRows(FIXTURE_HEADERS, [rowSg], multiGeoSettings);

    expect(enriched[0].signals).toContain("Geo Mismatch (Country: SG)");
  });

  it("flags unexpected carrier in an allowed country", () => {
    const rowBadCarrier = makeRow({ "Country Code": "US", Carrier: "UnknownCarrierXYZ" });
    const enriched = enrichRows(FIXTURE_HEADERS, [rowBadCarrier], multiGeoSettings);

    expect(enriched[0].signals).toContain(
      "Country/Carrier Mismatch (UnknownCarrierXYZ unexpected for US)",
    );
  });

  it("allows any carrier if country knownCarriers list is empty", () => {
    const settingsEmptyCarriers: Settings = {
      ...DEFAULT_SETTINGS,
      geos: [{ country: "ID", knownCarriers: [] }],
    };
    const row = makeRow({ "Country Code": "ID", Carrier: "Telkomsel" });
    const enriched = enrichRows(FIXTURE_HEADERS, [row], settingsEmptyCarriers);

    expect(enriched[0].signals).not.toContain(expect.stringContaining("Mismatch"));
  });

  it("generates no geo or carrier mismatch signals when geos is empty (Blank profile)", () => {
    const row1 = makeRow({
      "Advertising ID": "gaid_clean_1",
      "Country Code": "DE",
      Carrier: "Telekom",
    });
    const row2 = makeRow({
      "Advertising ID": "gaid_clean_2",
      "Country Code": "BR",
      Carrier: "Claro",
    });

    const enriched = enrichRows(FIXTURE_HEADERS, [row1, row2], BLANK_SETTINGS);
    expect(enriched[0].signals).toEqual([]);
    expect(enriched[1].signals).toEqual([]);
  });
});
