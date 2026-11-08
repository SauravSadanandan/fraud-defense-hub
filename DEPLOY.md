# Deploying to Firebase

This is a client-side application: all fraud analysis runs locally in the browser (via Web Worker), and Firebase is utilized strictly for **Authentication** (Email/Password with role-based access control) and **Firestore** (saved analyses, chunks, publisher mappings, and member profiles).

---

## 1. Authentication & Access Control

Access to this application is controlled through a server-enforced profile architecture:

- Anyone can technically register a Firebase Authentication email/password account (standard Firebase client-only SDK setups cannot close public sign-up without Cloud Functions backend hooks).
- However, having an Authentication account grants **zero data access**: all Firestore reads and writes require an active profile document (`users/{uid}`) with `status: "active"`.
- Without an approved profile, users land on a restricted screen where their only option is to click **Request access**, which submits an entry to `access_requests/{uid}`.
- Authorization and role-based permissions (`admin`, `analyst`, and custom roles) are strictly enforced server-side by Firestore Security Rules.
- For complete rollout instructions, initial administrator setup, and hardening steps, refer to [SECURITY_ROLLOUT.md](docs/SECURITY_ROLLOUT.md).

---

## 2. Firebase Web Configuration

The Firebase web configuration is present in `src/lib/firebase.ts`. The web configuration (`apiKey`, `authDomain`, `projectId`, etc.) is a public identifier set safe to commit; all data access is strictly governed by Firebase Authentication and Firestore Security Rules.

---

## 3. Enable Required Firebase Services

In the [Firebase Console](https://console.firebase.google.com/):

- **Authentication → Sign-in method →** enable **Email/Password**.
- **Firestore Database →** create a Firestore database in production mode.

---

## 4. Deploying Firestore Security Rules

### (a) First-Time Cutover (One-Off)

> [!CAUTION]
> **DO NOT deploy strict `firestore.rules` via the CLI or Console until:**
> 1. The first administrator profile document (`users/{uid}`) has been manually created in Cloud Firestore.
> 2. The updated client application has been deployed and is live.
> 3. A test analyst account has been invited, approved, and verified.
>
> Prematurely deploying strict rules will immediately lock all operators out of existing analysis datasets and publisher mappings.

Follow the ordered procedure in [SECURITY_ROLLOUT.md](docs/SECURITY_ROLLOUT.md):
1. Publish `firestore.rules.transitional` via the **Firebase Console → Firestore Database → Rules** editor. This keeps existing datasets accessible while establishing strict rules on user profiles and roles.
2. Deploy the updated client application and seed the initial administrator and roles.
3. Once verified, copy the contents of `firestore.rules` into the Firebase Console Rules editor and click **Publish**.

**Rollback Plan**: If an issue occurs during cutover, immediately republish `firestore.rules.transitional` in the Firebase Console Rules editor to restore authenticated session access while maintaining user profile security.

### (b) Routine Rule Updates (After Cutover)

Once production cutover is complete and strict rules are operational, routine rule modifications may be deployed via the Firebase CLI:

```bash
# Verify active Firebase CLI account
firebase login:list
firebase login:use <account that owns the project>

# Deploy rules to the production project
firebase deploy --only firestore:rules --project farg-e74ca
```

---

## 5. Web Application Hosting

### Automated Deployment (Recommended)
Continuous Deployment is configured via GitHub Actions (`.github/workflows/firebase-deploy.yml`) on every push or merge to `main`. It builds the static bundle and deploys `dist/client` to Firebase Hosting.

### Manual Deployment
To build and deploy manually:

```bash
# 1. Install dependencies and build client bundle
bun install
bun run build

# 2. Verify account and deploy to Firebase Hosting
firebase login:list
firebase login:use <account that owns the project>
firebase deploy --only hosting --project farg-e74ca
```

`firebase.json` serves the built client SPA from `dist/client` with an SPA rewrite fallback (`** → /index.html`) and strict security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`).

---

## 6. Verification & Test History

The repository includes a comprehensive local quality gate runner:

```bash
# Run the full quality gate
bun run verify

# Optional flags:
bun run verify --label "pre-release check"  # Attach a note to the report
bun run verify --skip-rules                 # Skip emulator rules tests
bun run verify --keep 10                    # Retain only the 10 newest runs
```

### What `bun run verify` checks:
1. **`install`**: Verifies dependency lockfile integrity via `bun install --frozen-lockfile`.
2. **`lint`**: Runs ESLint and Prettier style audits via `bun run lint`.
3. **`build`**: Executes `bun run build` and verifies `dist/client/index.html` exists.
4. **`unit-tests`**: Runs unit and drift tests via `bun run test` without requiring local emulators.
5. **`rules-tests`**: Runs Firestore security rules tests against the local emulator suite with project id `demo-farg` via `bun run test:rules`.
   - *Note*: Emulator tests run strictly offline, never touch production, require no Firebase login, and require Java and the Firebase CLI. If Java or Firebase is missing from PATH, the runner skips this step with an explicit logged explanation.
6. **`security-scan`**: Scans all source files, documentation, rules, and configuration for deprecated hardcoded credentials, test tokens, or private email domains.

All test runs write persistent, timestamped markdown and JSON records into the local, git-ignored `test-history/` folder, appending to `test-history/INDEX.md` and updating `test-history/LATEST.md`.

---

## 7. After Cutover Checklist

Once strict rules and the updated client are live in production, complete these hardening tasks:

- [ ] **Disable Anonymous Sign-in**: In **Firebase Console → Authentication → Sign-in method**, disable Anonymous sign-in.
- [ ] **Enforce Password Policy**: In **Authentication → Settings → Password policy**, enforce a minimum length of 12+ characters with mixed case, numbers, and symbols.
- [ ] **Restrict Google API Key**: In **Google Cloud Console → APIs & Services → Credentials**, restrict the web client key to your application HTTP referrers (`https://farg-e74ca.web.app/*`, `https://farg-e74ca.firebaseapp.com/*`, and custom domains). If API restrictions are used, permit only:
  - *Identity Toolkit API*
  - *Token Service API*
  - *Cloud Firestore API*
- [ ] **Review Authorized Domains**: In **Authentication → Settings → Authorized domains**, ensure only authorized production/staging domains and `localhost` are listed.

For step-by-step guidance, consult [SECURITY_ROLLOUT.md](docs/SECURITY_ROLLOUT.md).
