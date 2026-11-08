# Security Rollout Runbook: Firebase Authentication & RBAC

This runbook guides project administrators through the zero-downtime cutover from legacy hardcoded client credentials to Firebase Authentication with server-enforced role-based access control (RBAC) in Cloud Firestore.

> **CRITICAL**: Never commit real user credentials, private keys, or actual administrator UIDs to this public repository. All values shown below are synthetic placeholders (`<ADMIN_UID>`, `<ADMIN_EMAIL>`, etc.).

---

## Phase 1: Authentication Provisioning (Firebase Console)

1. **Enable Email/Password Provider**
   - Navigate to **Firebase Console → Authentication → Sign-in method**.
   - Select **Email/Password**.
   - Enable **Email/Password** and click **Save**. (Do not enable Email link/passwordless unless required).

2. **Create the Initial Administrator Account**
   - In **Authentication → Users**, click **Add user**.
   - Enter your primary administrative email address (e.g. `<ADMIN_EMAIL>`) and generate a secure password.
   - Copy the generated User UID (`<ADMIN_UID>`).

3. **Bootstrap the Administrator Firestore Profile**
   - In **Firestore Database → Data**, click **Start collection** (or navigate to `users`).
   - Collection ID: `users`
   - Document ID: `<ADMIN_UID>` (paste the exact UID from step 2).
   - Add fields with exact types:
     ```json
     {
       "email": "<ADMIN_EMAIL_LOWERCASED>",       // (string, lowercase)
       "displayName": "Primary Administrator",     // (string)
       "role": "admin",                            // (string) - "admin" is reserved
       "status": "active",                         // (string) - "active" | "disabled"
       "createdAt": [Current Timestamp],           // (timestamp)
       "createdBy": "<ADMIN_UID>",                 // (string)
       "updatedAt": [Current Timestamp],           // (timestamp)
       "updatedBy": "<ADMIN_UID>"                  // (string)
     }
     ```

---

## Phase 2: Transitional Security Rules Cutover

4. **Publish Transitional Rules via Console**
   - Navigate to **Firestore Database → Rules**.
   - Copy the contents of `firestore.rules.transitional` from this repository.
   - Paste into the Firebase Console rules editor and click **Publish**.
   - _Purpose_: This immediately enables and secures the new collections (`users`, `roles`, `access_requests`, `campaign_profiles`) while keeping the existing analysis and publisher map collections temporarily accessible to authenticated sessions during client deployment.

---

## Phase 3: Client Deployment

5. **Merge PR and Deploy Application**
   - Merge the `feat/firebase-auth-rbac` pull request into `main`.
   - The automated GitHub Actions workflow (`.github/workflows/firebase-deploy.yml`) will build the project and deploy the updated static client bundle to Firebase Hosting (`dist/client`).
   - Verify deployment by opening the production site. The application will present the new email/password login interface.

6. **Seed Roles and Invite Organization Members**
   - Log into the deployed application as `<ADMIN_EMAIL>`.
   - Click the user avatar menu in the top right and select **Settings**.
   - Navigate to **Roles & permissions**: the system automatically seeds the `analyst` system role upon admin inspection.
   - (Optional) Create custom roles tailored to your organization.
   - Navigate to **Members** and click **Invite member**:
     - Enter member email and role.
     - The member will automatically receive an invitation email with a password setup link.

---

## Phase 4: Strict Security Cutover & Hardening

7. **Publish Strict Security Rules**
   - After members have logged in and verified access:
   - In **Firestore Database → Rules**, copy the contents of `firestore.rules` (the final, strict rules).
   - Paste into the console and click **Publish**.
   - _Outcome_: All reads and writes to `fraud_datasets`, `chunks`, `publisher_map`, and `campaign_profiles` are now strictly governed by granular role permissions. Unassigned or disabled users are strictly denied.

8. **Disable Anonymous Authentication**
   - In **Authentication → Sign-in method**, disable **Anonymous** sign-in completely to eliminate unauthenticated session risks.

9. **Configure Password Policy**
   - In **Authentication → Settings → Password policy**:
     - Enforce minimum length (recommended: 12+ characters).
     - Require lowercase, uppercase, numeric, and non-alphanumeric symbols.

10. **Restrict Google API Key by HTTP Referrer**
    - Navigate to **Google Cloud Console → APIs & Services → Credentials**.
    - Select the browser key used by Firebase (`AIzaSy...`).
    - Under **Application restrictions**, select **Websites** and add your production and staging domains:
      - `https://<YOUR_PROJECT_ID>.web.app/*`
      - `https://<YOUR_PROJECT_ID>.firebaseapp.com/*`
      - Any custom domains linked to Lovable or production.
    - Under **API restrictions**, restrict the key to only:
      - _Firebase Authentication API_
      - _Cloud Firestore API_

11. **Review Authorized Domains**
    - In **Firebase Console → Authentication → Settings → Authorized domains**:
    - Ensure only authorized production and staging domains (and `localhost` for local development) are listed. Remove any obsolete or untrusted domains.
