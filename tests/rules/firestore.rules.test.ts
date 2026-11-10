import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  collection,
  serverTimestamp,
  FieldPath,
} from "firebase/firestore";

const PROJECT_ID = "demo-farg";

let emulatorAvailable = false;
try {
  const ping = await fetch("http://127.0.0.1:8080");
  emulatorAvailable = !!ping;
} catch {
  emulatorAvailable = false;
}

describe.skipIf(!emulatorAvailable)("Firestore Security Rules", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const rules = readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8");
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules,
        host: "127.0.0.1",
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
    }
  });

  // 1. Signed-out denied everywhere
  it("denies signed-out requests on all collections", async () => {
    const unauthDb = testEnv.unauthenticatedContext().firestore();

    await assertFails(getDocs(collection(unauthDb, "fraud_datasets")));
    await assertFails(getDocs(collection(unauthDb, "publisher_map")));
    await assertFails(getDocs(collection(unauthDb, "users")));
    await assertFails(getDocs(collection(unauthDb, "roles")));
    await assertFails(getDocs(collection(unauthDb, "access_requests")));
    await assertFails(getDocs(collection(unauthDb, "campaign_profiles")));
  });

  // 2. Anonymous-style auth with no profile denied on all collections
  it("denies authenticated user with no profile on all data collections", async () => {
    const authDb = testEnv.authenticatedContext("synth-uid-no-profile").firestore();

    await assertFails(getDocs(collection(authDb, "fraud_datasets")));
    await assertFails(getDocs(collection(authDb, "publisher_map")));
    await assertFails(getDocs(collection(authDb, "roles")));
    await assertFails(getDocs(collection(authDb, "campaign_profiles")));
    await assertFails(getDocs(collection(authDb, "users")));
  });

  // 3. Disabled user denied
  it("denies disabled user on all operations", async () => {
    const disabledUid = "synth-uid-disabled";

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "users", disabledUid), {
        email: "disabled@example.test",
        displayName: "Disabled User",
        role: "analyst",
        status: "disabled",
      });
      await setDoc(doc(db, "roles", "analyst"), {
        name: "Analyst",
        permissions: { "analysis.view": true },
      });
    });

    const disabledDb = testEnv.authenticatedContext(disabledUid).firestore();
    await assertFails(getDocs(collection(disabledDb, "fraud_datasets")));
    await assertFails(getDocs(collection(disabledDb, "publisher_map")));
    await assertFails(getDocs(collection(disabledDb, "roles")));
  });

  // 4. Active analyst permissions
  it("allows active analyst to read/create datasets and chunks, but denies delete, publisher_map write, profile write, users list, and changing own role", async () => {
    const analystUid = "synth-uid-analyst";

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "users", analystUid), {
        email: "analyst@example.test",
        displayName: "Analyst User",
        role: "analyst",
        status: "active",
      });
      await setDoc(doc(db, "roles", "analyst"), {
        name: "Analyst",
        permissions: {
          "analysis.view": true,
          "analysis.save": true,
          "analysis.delete": false,
          "publishers.view": true,
          "publishers.manage": false,
          "profiles.view": true,
          "profiles.manage": false,
        },
      });
      await setDoc(doc(db, "fraud_datasets", "ds-1"), {
        appName: "TestApp",
        createdBy: analystUid,
      });
    });

    const analystDb = testEnv.authenticatedContext(analystUid).firestore();

    // Can read datasets
    await assertSucceeds(getDoc(doc(analystDb, "fraud_datasets", "ds-1")));

    // Can create dataset with matching createdBy
    await assertSucceeds(
      setDoc(doc(analystDb, "fraud_datasets", "ds-2"), {
        appName: "TestApp2",
        createdBy: analystUid,
      }),
    );

    // Can create chunk under existing dataset
    await assertSucceeds(
      setDoc(doc(analystDb, "fraud_datasets", "ds-1", "chunks", "c-1"), {
        index: 0,
        data: "sample chunk data",
      }),
    );

    // Cannot delete dataset
    await assertFails(deleteDoc(doc(analystDb, "fraud_datasets", "ds-1")));

    // Cannot write publisher_map
    await assertFails(
      setDoc(doc(analystDb, "publisher_map", "app_pid_1"), {
        appName: "TestApp",
        pid: "pid1",
        publisher: "Pub1",
        updatedAt: 1000,
      }),
    );

    // Cannot write campaign_profiles
    await assertFails(
      setDoc(doc(analystDb, "campaign_profiles", "prof-1"), {
        name: "Default Profile",
        settings: {},
      }),
    );

    // Cannot read users list
    await assertFails(getDocs(collection(analystDb, "users")));

    // Cannot change own role
    await assertFails(
      updateDoc(doc(analystDb, "users", analystUid), {
        role: "admin",
      }),
    );
  });

  // 5. Admin full access with restricted self-edits and roles/admin protection
  it("allows admin full access but blocks editing own user doc and writing roles/admin", async () => {
    const adminUid = "synth-uid-admin";
    const otherUid = "synth-uid-other";

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "users", adminUid), {
        email: "admin@example.test",
        displayName: "Admin User",
        role: "admin",
        status: "active",
      });
      await setDoc(doc(db, "users", otherUid), {
        email: "other@example.test",
        displayName: "Other User",
        role: "analyst",
        status: "active",
      });
      await setDoc(doc(db, "fraud_datasets", "ds-1"), {
        appName: "TestApp",
        createdBy: otherUid,
      });
    });

    const adminDb = testEnv.authenticatedContext(adminUid).firestore();

    // Admin can delete dataset
    await assertSucceeds(deleteDoc(doc(adminDb, "fraud_datasets", "ds-1")));

    // Admin can list users
    await assertSucceeds(getDocs(collection(adminDb, "users")));

    // Admin can edit other user
    await assertSucceeds(
      updateDoc(doc(adminDb, "users", otherUid), {
        role: "custom-role",
        status: "disabled",
      }),
    );

    // Admin CANNOT edit own user doc
    await assertFails(
      updateDoc(doc(adminDb, "users", adminUid), {
        status: "disabled",
      }),
    );

    // Admin CANNOT write roles/admin
    await assertFails(
      setDoc(doc(adminDb, "roles", "admin"), {
        name: "Admin Role",
        permissions: {},
      }),
    );
  });

  // 6. Non-admin role cannot be granted members.manage
  it("rejects granting members.manage or roles.manage to non-admin roles", async () => {
    const adminUid = "synth-uid-admin";

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "users", adminUid), {
        email: "admin@example.test",
        displayName: "Admin User",
        role: "admin",
        status: "active",
      });
    });

    const adminDb = testEnv.authenticatedContext(adminUid).firestore();

    await assertFails(
      setDoc(doc(adminDb, "roles", "manager"), {
        name: "Manager",
        permissions: {
          "members.manage": true,
        },
      }),
    );

    await assertFails(
      setDoc(doc(adminDb, "roles", "manager"), {
        name: "Manager",
        permissions: {
          "roles.manage": true,
        },
      }),
    );
  });

  // 7. Role permission change takes effect immediately
  it("enforces role permission changes dynamically", async () => {
    const analystUid = "synth-uid-analyst";

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "users", analystUid), {
        email: "analyst@example.test",
        displayName: "Analyst User",
        role: "analyst",
        status: "active",
      });
      await setDoc(doc(db, "roles", "analyst"), {
        name: "Analyst",
        permissions: {
          "analysis.view": true,
          "analysis.delete": false,
        },
      });
      await setDoc(doc(db, "fraud_datasets", "ds-dyn"), {
        appName: "TestApp",
        createdBy: "someone",
      });
    });

    const analystDb = testEnv.authenticatedContext(analystUid).firestore();

    // Initially cannot delete
    await assertFails(deleteDoc(doc(analystDb, "fraud_datasets", "ds-dyn")));

    // Dynamically grant analysis.delete
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await updateDoc(
        doc(db, "roles", "analyst"),
        new FieldPath("permissions", "analysis.delete"),
        true,
      );
    });

    // Now delete succeeds
    await assertSucceeds(deleteDoc(doc(analystDb, "fraud_datasets", "ds-dyn")));
  });

  // 8. createdBy spoofing rejected
  it("rejects dataset creation with spoofed createdBy", async () => {
    const userUid = "synth-uid-user";

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "users", userUid), {
        email: "user@example.test",
        displayName: "User",
        role: "analyst",
        status: "active",
      });
      await setDoc(doc(db, "roles", "analyst"), {
        name: "Analyst",
        permissions: { "analysis.save": true },
      });
    });

    const userDb = testEnv.authenticatedContext(userUid).firestore();

    await assertFails(
      setDoc(doc(userDb, "fraud_datasets", "spoofed-ds"), {
        appName: "App",
        createdBy: "different-user-uid",
      }),
    );
  });

  // 9. Oversized chunk rejected
  it("rejects oversized chunk (> 950,000 characters)", async () => {
    const userUid = "synth-uid-user";

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "users", userUid), {
        email: "user@example.test",
        displayName: "User",
        role: "analyst",
        status: "active",
      });
      await setDoc(doc(db, "roles", "analyst"), {
        name: "Analyst",
        permissions: { "analysis.save": true },
      });
      await setDoc(doc(db, "fraud_datasets", "parent-ds"), {
        appName: "App",
        createdBy: userUid,
      });
    });

    const userDb = testEnv.authenticatedContext(userUid).firestore();

    // 950,001 characters
    const oversized = "x".repeat(950_001);
    await assertFails(
      setDoc(doc(userDb, "fraud_datasets", "parent-ds", "chunks", "c-over"), {
        index: 0,
        data: oversized,
      }),
    );

    // 950,000 characters
    const validChunk = "x".repeat(950_000);
    await assertSucceeds(
      setDoc(doc(userDb, "fraud_datasets", "parent-ds", "chunks", "c-valid"), {
        index: 0,
        data: validChunk,
      }),
    );
  });

  // 10. Unknown collection denied
  it("denies access to any undefined or arbitrary collection", async () => {
    const userUid = "synth-uid-admin";

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "users", userUid), {
        email: "admin@example.test",
        displayName: "Admin",
        role: "admin",
        status: "active",
      });
    });

    const adminDb = testEnv.authenticatedContext(userUid).firestore();
    await assertFails(getDoc(doc(adminDb, "unregistered_collection", "secret")));
    await assertFails(
      setDoc(doc(adminDb, "unregistered_collection", "secret"), {
        val: true,
      }),
    );
  });

  // 11. access_requests self-create allowed only with matching token email
  it("allows access_requests creation only for self with matching token email and request.time", async () => {
    const userUid = "synth-uid-requester";
    const userEmail = "requester@example.test";

    const userDb = testEnv
      .authenticatedContext(userUid, {
        email: userEmail,
      })
      .firestore();

    // Matching email and time
    await assertSucceeds(
      setDoc(doc(userDb, "access_requests", userUid), {
        email: userEmail,
        emailVerified: true,
        displayName: "Requester",
        requestedAt: serverTimestamp(),
      }),
    );

    // Spoofed email in payload
    const otherDb = testEnv
      .authenticatedContext("synth-uid-other2", {
        email: "actual@example.test",
      })
      .firestore();

    await assertFails(
      setDoc(doc(otherDb, "access_requests", "synth-uid-other2"), {
        email: "spoofed@example.test",
        emailVerified: true,
        displayName: "Spoofer",
        requestedAt: serverTimestamp(),
      }),
    );
  });
});
