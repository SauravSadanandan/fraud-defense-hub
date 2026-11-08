# Deploying to Firebase

This is a client-side application: all fraud analysis runs locally in the browser (via Web Worker), and Firebase is utilized strictly for **Authentication** (Email/Password with role-based access control) and **Firestore** (saved analyses, chunks, publisher mappings, and member profiles).

## 1. Authentication & Access Control

Access to this application is strictly invite-only:

- Hardcoded operator credentials and anonymous sign-in have been completely deprecated.
- Access requires a registered Firebase Authentication email/password user and an active Firestore profile (`users/{uid}`).
- Full RBAC (roles and granular permissions) is server-enforced through Firestore Security Rules.
- For complete rollout instructions, initial administrator setup, and hardening steps, refer to [SECURITY_ROLLOUT.md](docs/SECURITY_ROLLOUT.md).

## 2. Firebase Web Configuration

The Firebase web configuration is present in `src/lib/firebase.ts`. The web configuration (`apiKey`, `authDomain`, `projectId`, etc.) is a public identifier set safe to commit; all data access is strictly governed by Firebase Authentication and Firestore Security Rules.

## 3. Enable Required Firebase Services

In the [Firebase Console](https://console.firebase.google.com/):

- **Authentication → Sign-in method →** enable **Email/Password**.
- **Firestore Database →** create a Firestore database in production mode.

## 4. Deploying Firestore Security Rules

To deploy the security rules:

```bash
npm i -g firebase-tools     # once
firebase login
firebase use farg-e74ca     # or your target project id
firebase deploy --only firestore:rules
```

`firestore.rules` enforces role-based access control across all collections and denies unauthorized access by default.

## 5. Web Application Hosting

Continuous Deployment is configured via GitHub Actions (`.github/workflows/firebase-deploy.yml`) on merges to `main`.

To build and deploy manually:

```bash
bun install
bun run build
firebase deploy --only hosting
```

`firebase.json` serves the built client SPA from `dist/client` with an SPA rewrite (`** → /index.html`) and security headers.
