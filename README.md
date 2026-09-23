# HMS

Hospital Management System monorepo.

## Patient web deployment

The patient app deploys to Firebase Hosting project `hms-patient-web`:

```bash
npm run deploy:patient
```

This builds `apps/patient-web` in prod mode and deploys using `firebase.patient.json`.
Firebase CLI must be installed and signed in with access to the project.
The patient site is https://hms-patient-web.web.app.
The staff app keeps its existing `firebase.json` and default project `hms-web-c0717`.

The patient production API URL is configured in `apps/patient-web/.env.prod`.
The hosted API must allow `https://hms-patient-web.web.app` and
`https://hms-patient-web.firebaseapp.com` in its `CORS_ORIGIN` configuration.
If the API host changes, update both the production API URL and the Firebase
Hosting Content-Security-Policy `connect-src` value. Netlify is no longer the
patient frontend deployment path.

### Patient OTP delivery

On the Render API service, configure `SMS_GATEWAY_PROVIDER=HTTP`,
`SMS_GATEWAY_URL` (an HTTPS SMS gateway endpoint), and `SMS_GATEWAY_API_KEY`
(a secret stored in Render, never committed). The existing gateway adapter sends
`POST { "to": "<mobile>", "message": "<SMS content>" }` with a Bearer API key;
the gateway must implement that contract. Save the environment settings and
redeploy the API. Firebase frontend deployment does not configure SMS delivery.

The owner-requested shared Render setup uses `PATIENT_PORTAL_DEMO_OTP_ENABLED=true`
and `PATIENT_PORTAL_DEMO_OTP=1234`, without changing APP_ENV or NODE_ENV. This
patient-only setting stores and verifies the static code normally and skips SMS.
It does not prove mobile ownership. See PATIENT_OTP_STATIC_MODE.md.
With the flag disabled, missing/invalid delivery configuration returns
`503 SMS_NOT_CONFIGURED`; real mode requires a configured HTTP SMS gateway.

Use the latest received four-digit SMS code. Defaults are a five-minute expiry,
a 60-second resend cooldown, and three incorrect attempts per challenge.
Request and verification must use the same number, including the same country
code: formatting is stripped, but no default country code is inferred.

## Stack

- Frontend: React, TypeScript, Vite
- Backend: Node.js, TypeScript, Fastify
- Package manager: npm workspaces

## Project Structure

```text
apps/
  api/  Node.js TypeScript API
  web/  React TypeScript frontend
```

## Environment Files

The apps use mode-based environment files.

- Backend: `apps/api/.env.dev`, `apps/api/.env.test`, `apps/api/.env.prod`
- Frontend: `apps/web/.env.dev`, `apps/web/.env.test`, `apps/web/.env.prod`

For local secrets, prefer ignored `.local` overrides such as:

```text
apps/api/.env.dev.local
```

Put your PostgreSQL connection string there as:

```text
DATABASE_URL=postgresql://user:password@host:5432/database
```

`apps/api/.env.dev` is already prepared with a blank `DATABASE_URL` placeholder.

## Commands

Install dependencies:

```bash
npm install
```

Run backend and frontend together:

```bash
npm run dev
```

Run only the backend:

```bash
npm run dev:api
```

Run only the frontend:

```bash
npm run dev:web
```

Typecheck, lint, and build:

```bash
npm run typecheck
npm run lint
npm run build
```

## Local URLs

- Frontend: `http://localhost:5173` by default. If that port is busy, Vite will print the next available port.
- Backend health: `http://localhost:4000/api/health`
