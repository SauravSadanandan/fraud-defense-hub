import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { PERMISSION_CATALOG, type PermissionKey } from "../../src/lib/permissions";

describe("Permissions Drift Check", () => {
  const rulesPath = resolve(__dirname, "../../firestore.rules");
  const rulesContent = readFileSync(rulesPath, "utf-8");

  // Extract all can('...') and can("...") calls
  const matches = rulesContent.matchAll(/can\(['"]([^'"]+)['"]\)/g);
  const rulePermissionKeys = new Set<string>();
  for (const m of matches) {
    rulePermissionKeys.add(m[1]);
  }

  const catalogKeys = new Set(PERMISSION_CATALOG.map((p) => p.key));
  const nonAdminCatalogKeys = PERMISSION_CATALOG.filter((p) => !p.adminOnly).map((p) => p.key);

  it("ensures every permission referenced in firestore.rules can(...) exists in the catalog", () => {
    expect(rulePermissionKeys.size).toBeGreaterThan(0);
    for (const key of rulePermissionKeys) {
      expect(catalogKeys.has(key as PermissionKey)).toBe(true);
    }
  });

  it("ensures every non-adminOnly catalog permission is used in firestore.rules", () => {
    for (const key of nonAdminCatalogKeys) {
      expect(rulePermissionKeys.has(key)).toBe(true);
    }
  });

  it("ensures administration permissions are marked adminOnly in the catalog", () => {
    const adminPerms = PERMISSION_CATALOG.filter((p) => p.adminOnly).map((p) => p.key);
    expect(adminPerms).toContain("members.manage");
    expect(adminPerms).toContain("roles.manage");
  });
});
