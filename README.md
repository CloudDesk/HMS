# HMS

Hospital Management System monorepo.

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
