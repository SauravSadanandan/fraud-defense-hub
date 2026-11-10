# Opscore Argus — Standing Agent Rules

These standing rules apply to every task in this repository. Prompts may state only the task goal.

## 1. Product & Architecture

Opscore Argus is a client-side mobile ad fraud analyzer (`ARGUS`).

- **Stack**: React 19, TanStack Start & Router (file-based in `src/routes/`; never hand-edit `src/routeTree.gen.ts`), Tailwind CSS, Vite, Bun, Firebase Web SDK v12 (Auth & Firestore, client-only).
- **Engine**: Heavy data processing runs in a Web Worker (`src/engine/worker.ts`, `src/lib/runAnalysis.ts`). `src/engine/**` must remain pure TypeScript without Firebase, React, or DOM imports. Golden parity snapshots in `tests/engine/__golden__/**` are immutable.

## 2. Environments & Git Promotion

- **Environments**: Isolated Firebase projects: **Staging** (`farg-e74ca`, branch `staging`) and **Production** (`opscore-argus`, branch `main`).
- **Promotion Flow**: Feature branches -> PR/merge to `staging` -> QA -> merge `staging` to `main`.
- **Local Dev**: `bun run dev` targets staging. Local development against production is strictly disallowed.

## 3. Strict Safety Guardrails

- **Git Safety**: Never push or merge to `main` unless explicitly instructed. Never rewrite pushed git history. Commit locally in logical conventional commits.
- **Secrets & Public Repo**: This repository is public. Never commit service account keys, passwords, credentials, real user emails, or UIDs.
- **Firebase CLI**: Never run `firebase deploy`, `firebase login`, or `firebase use`. Never modify GitHub repository settings or secrets.

## 4. Security & Permissions

- **Server-Side Enforcement**: Authorization is strictly enforced by Firestore Security Rules. UI gating (`Can`, `useAuth().can()`) provides UX only.
- **Permission Catalog**: `src/lib/permissions.ts` is the single source of truth for all role permissions.
- **Rules Tests**: Offline security rules tests (`bun run test:rules`) run against the Firestore emulator and require Java 21+ and Firebase CLI on PATH.

## 5. Verification Quality Gate

- Before concluding any task, run the quality gate: `bun run verify`.
- The final verification run must NOT use `--skip-rules` (verdict `INCOMPLETE` due to missing Java environment is expected and acceptable).
- Quality check results remain strictly local in the git-ignored `test-history/` directory.

## 6. Documentation Index

- `DEPLOY.md`: Deployment procedures, transitional rules cutover, and rollback plans.
- `docs/ENVIRONMENTS.md`: Detailed environment isolation, CI workflows, and data policies.
- `docs/SECURITY_ROLLOUT.md`: Administrator bootstrapping and RBAC security rollout runbook.
- `docs/CAMPAIGN_PROFILES.md`: Campaign profiles, funnel aliases, and detection thresholds schema.
