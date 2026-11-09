import { describe, it, expect } from "vitest";
import {
  suggestProfile,
  type CampaignProfile,
  BUILTIN_INDIA,
  BUILTIN_BLANK,
} from "../../src/lib/profiles";
import { DEFAULT_SETTINGS, BLANK_SETTINGS } from "../../src/engine/config";
import type { FileScan } from "../../src/engine/scan";

function mockScan(overrides: Partial<FileScan> = {}): FileScan {
  return {
    totalRows: 100,
    detectedMode: "Install",
    countries: [{ country: "IN", count: 90, carriers: [] }],
    events: [],
    topCarriers: [],
    ...overrides,
  };
}

describe("suggestProfile", () => {
  const customAppProfile: CampaignProfile = {
    id: "profile-rummy",
    name: "Rummy App Profile",
    appNames: ["com.game.rummy", "Rummy King"],
    isBuiltin: false,
    settings: {
      ...DEFAULT_SETTINGS,
      geos: [{ country: "IN", knownCarriers: ["Jio"] }],
    },
  };

  const customBrazilProfile: CampaignProfile = {
    id: "profile-brazil",
    name: "Brazil Gaming",
    appNames: [],
    isBuiltin: false,
    settings: {
      ...BLANK_SETTINGS,
      geos: [{ country: "BR", knownCarriers: ["Vivo", "Claro"] }],
    },
  };

  const testProfiles: CampaignProfile[] = [
    BUILTIN_INDIA,
    BUILTIN_BLANK,
    customAppProfile,
    customBrazilProfile,
  ];

  it("prioritizes matching appName (step 1)", () => {
    const scan = mockScan({ countries: [{ country: "BR", count: 100, carriers: [] }] });
    // appName matches "Rummy King" case-insensitively with whitespace
    const result = suggestProfile(scan, testProfiles, "profile-brazil", "  rummy king  ");
    expect(result).toBe("profile-rummy");
  });

  it("uses lastProfileId if valid and no appName matched (step 2)", () => {
    const scan = mockScan({ countries: [{ country: "BR", count: 100, carriers: [] }] });
    const result = suggestProfile(scan, testProfiles, "profile-brazil", "UnknownApp");
    expect(result).toBe("profile-brazil");
  });

  it("matches top country preferring saved profiles over built-ins (step 3)", () => {
    const scan = mockScan({ countries: [{ country: "BR", count: 100, carriers: [] }] });
    // lastProfileId is non-existent
    const result = suggestProfile(scan, testProfiles, "non-existent-profile", "UnknownApp");
    expect(result).toBe("profile-brazil");
  });

  it("matches built-in profile for country if no saved profile matches (step 3)", () => {
    const scan = mockScan({ countries: [{ country: "IN", count: 100, carriers: [] }] });
    const profilesNoCustomIn = [BUILTIN_INDIA, BUILTIN_BLANK, customBrazilProfile];
    const result = suggestProfile(scan, profilesNoCustomIn, null, null);
    expect(result).toBe("builtin:india-default");
  });

  it("falls back to builtin:blank when no match is found (step 4)", () => {
    const scan = mockScan({ countries: [{ country: "JP", count: 100, carriers: [] }] });
    const result = suggestProfile(scan, testProfiles, null, "OtherApp");
    expect(result).toBe("builtin:blank");
  });
});
