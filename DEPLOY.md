# Deploying to Firebase

This is a client-side app: all fraud analysis runs in the browser, and Firebase
is used only for **Auth** (anonymous session for the default Admin login, plus
optional email/password users) and **Firestore** (saved analyses + publisher
mappings).

## 1. Put your real Firebase web config in the app

Open `src/lib/firebase.ts` and replace the placeholder `firebaseConfig` values
with the config from **Firebase Console → Project settings → Your apps → Web app**.
The web config (apiKey, authDomain, projectId, …) is a public identifier set and
is safe to commit — your data is protected by Auth + the Firestore rules below.

## 2. Enable the Firebase products you use

- **Authentication → Sign-in method →** enable **Anonymous** (required for the
  default `Admin` login to persist to Firestore). Enable **Email/Password** too
  if you want extra named accounts.
- **Firestore Database →** create a database (Production mode is fine — the rules
  below grant access to signed-in users).

## 3. Deploy the security rules

```bash
npm i -g firebase-tools     # once
firebase login
firebase use farg-e74ca     # or your project id (edit .firebaserc)
firebase deploy --only firestore:rules
```

`firestore.rules` restricts `fraud_datasets` and `publisher_map` to
authenticated sessions and denies everything else.

## 4. Get a web app link (hosting)

Two options:

### Option A — Lovable Publish (fastest)
Click **Publish** in Lovable. You immediately get a live `*.lovable.app` link
and can attach a custom domain. Nothing else to configure.

### Option B — Firebase Hosting
This project builds with TanStack Start / nitro. Build the static client bundle
with the Firebase preset, then deploy:

```bash
NITRO_PRESET=firebase npm run build
firebase deploy --only hosting
```

`firebase.json` serves `.output/public` with an SPA fallback so client routes
resolve. Your link will be `https://<project-id>.web.app`.

> Tip: if you only need the static single-page app, any static host works —
> point it at the built `public` output with an `index.html` rewrite fallback.
