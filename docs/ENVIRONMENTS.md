# Environment Architecture & Isolation Guide

This document defines the two isolated environments for the application: **Staging** and **Production**.

---

## 1. Environments Overview

| Parameter               | Staging                                         | Production                              |
| ----------------------- | ----------------------------------------------- | --------------------------------------- |
| **Firebase Project ID** | `farg-e74ca`                                    | `opscore-argus`                         |
| **Auth Domain**         | `farg-e74ca.firebaseapp.com`                    | `opscore-argus.firebaseapp.com`         |
| **Hosting Domain**      | `https://farg-e74ca.web.app`                    | `https://opscore-argus.web.app`         |
| **Git Branch**          | `staging`                                       | `main`                                  |
| **CI Workflow**         | `.github/workflows/firebase-deploy-staging.yml` | `.github/workflows/firebase-deploy.yml` |
| **GitHub Secret**       | `FIREBASE_SERVICE_ACCOUNT`                      | `FIREBASE_SERVICE_ACCOUNT_PROD`         |
| **Config File**         | `.env.staging`                                  | `.env.production`                       |
| **Build Command**       | `bun run build:staging`                         | `bun run build`                         |

---

## 2. Environment Configuration & Isolation

1. **Public Identifiers**:
   - Both `.env.staging` and `.env.production` contain only public web identifiers (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, etc.).
   - These files are committed to version control. Security is enforced entirely by Firebase Authentication and Firestore Security Rules.
   - Any private secrets (such as CI deployment credentials) live strictly in GitHub Actions secrets.
2. **Build-Time Isolation**:
   - Each build mode bakes only its corresponding environment's variables into the bundle.
   - CI workflows and the verification gate enforce that neither environment leaks into the other (`dist/client` must never contain the alternate project ID).
3. **Local Development**:
   - Running `bun run dev` automatically runs Vite in staging mode (`vite dev --mode staging`).
   - There is intentionally no command to run local development against the production Firebase project.

---

## 3. Promotion & Branch Flow

```
[ Feature Branch ]
        │
        ▼ (PR / Merge)
   [ staging ] ──(Auto-deploy)──► Staging Environment (`farg-e74ca`)
        │
        ▼ (QA & Sign-off with synthetic data)
    [ main ]   ──(Auto-deploy)──► Production Environment (`opscore-argus`)
```

1. **Feature development**: Work on feature branches branched from `main` or latest release point.
2. **Promotion to staging**: Merge feature branch into `staging`. GitHub Actions automatically verifies (typecheck, lint, test, build, isolation guard) and deploys to `farg-e74ca`.
3. **QA Testing**: Verify functionality on staging using synthetic datasets.
4. **Promotion to production**: Merge `staging` into `main`. GitHub Actions runs production verification and deploys to `opscore-argus`.

---

## 4. Data Policy & Legacy Data Notice

- **Synthetic Data Only**: Staging must **only** be tested with synthetic data. Use `bun run sample-data` to generate clean synthetic CSVs in `sample-data/`.
- **Never Copy Production Data**: Production user data, analysis records, or publisher lists must never be exported to staging.
- **Legacy Staging Data Notice**: The existing `farg-e74ca` project previously served as the initial development/test environment and may contain legacy data. Once production cutover is complete, legacy analysis documents in `farg-e74ca` should be wiped clean.

---

## 5. Environment Bootstrap & Security Rollout

Each Firebase project must be bootstrapped independently following the runbook in [docs/SECURITY_ROLLOUT.md](SECURITY_ROLLOUT.md):

1. **Rehearse on Staging First**: Always execute the full security rollout in `farg-e74ca` before applying it to `opscore-argus`.
2. **Console Setup**:
   - Enable Email/Password authentication.
   - Create the initial admin account.
   - Manually bootstrap the administrator profile in `users/{uid}` with `role: "admin"` and `status: "active"`.
3. **Rules Deployment**:
   - Publish `firestore.rules.transitional` via Console.
   - Deploy client application via CI.
   - Seed default roles and invite organization members.
   - Publish strict `firestore.rules`.

---

## 6. Rollback Procedures

If an operational issue occurs after a deployment:

1. Open [Firebase Console](https://console.firebase.google.com/) for the target project (`farg-e74ca` or `opscore-argus`).
2. Go to **Hosting** → **Release History**.
3. Locate the previous healthy deployment and click **Rollback**.
4. In git, revert the offending commit on `staging` or `main` so subsequent automated builds match the rolled-back state.

---

## 7. Recommended GitHub Repository Settings

To protect deployment branches:

- **Branch Protection on `main`**:
  - Require pull request reviews before merging.
  - Require status checks to pass (`typecheck`, `test`, `lint`, `env-isolation`).
  - Do not allow force pushes or deletions.
- **Branch Protection on `staging`**:
  - Require status checks before merging.
