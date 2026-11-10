import { describe, it, expect } from "vitest";
import { loadEnv } from "vite";

describe("Environment Configurations", () => {
  const prodEnv = loadEnv("production", process.cwd(), "VITE_");
  const stagingEnv = loadEnv("staging", process.cwd(), "VITE_");

  const requiredKeys = [
    "VITE_APP_ENV",
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_STORAGE_BUCKET",
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "VITE_FIREBASE_APP_ID",
  ];

  it("contains all required Firebase keys in both production and staging", () => {
    for (const key of requiredKeys) {
      expect(prodEnv[key], `Production missing ${key}`).toBeDefined();
      expect(prodEnv[key].length, `Production ${key} is empty`).toBeGreaterThan(0);

      expect(stagingEnv[key], `Staging missing ${key}`).toBeDefined();
      expect(stagingEnv[key].length, `Staging ${key} is empty`).toBeGreaterThan(0);
    }
  });

  it("has correct VITE_APP_ENV in each environment", () => {
    expect(prodEnv.VITE_APP_ENV).toBe("production");
    expect(stagingEnv.VITE_APP_ENV).toBe("staging");
  });

  it("targets isolated Firebase project IDs without overlap", () => {
    expect(prodEnv.VITE_FIREBASE_PROJECT_ID).toBe("opscore-argus");
    expect(stagingEnv.VITE_FIREBASE_PROJECT_ID).toBe("farg-e74ca");
    expect(prodEnv.VITE_FIREBASE_PROJECT_ID).not.toBe(stagingEnv.VITE_FIREBASE_PROJECT_ID);
  });

  it("does not contain template placeholders or replacement markers", () => {
    for (const [k, v] of Object.entries(prodEnv)) {
      expect(v).not.toContain("REPLACE");
      expect(v).not.toContain("<<");
      expect(v).not.toContain(">>");
    }
    for (const [k, v] of Object.entries(stagingEnv)) {
      expect(v).not.toContain("REPLACE");
      expect(v).not.toContain("<<");
      expect(v).not.toContain(">>");
    }
  });
});
