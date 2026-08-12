# HMS Project Rules

## Core Principle

This HMS project is already architected and partially implemented.

AI/Codex must follow the existing patterns, folder structure, architecture, naming conventions, API contracts, RBAC implementation, and UI patterns already present in the codebase.

Do not introduce new architecture unless explicitly requested.

When uncertain, follow the existing implementation already present in this codebase instead of creating a new pattern.

---

## Product Context

This is a Hospital Management System.

The application must feel professional, trustworthy, calm, and efficient for hospital staff, administrators, doctors, nurses, reception teams, and operational users.

Healthcare workflows are sensitive and time-critical. UI, validation, permissions, logging, and error handling must be designed with patient safety, privacy, traceability, and workflow clarity in mind.

---

## Technology Stack (Locked)

Use only:

- React
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- React Hook Form
- Zod
- React Router
- Sonner
- date-fns
- Node.js
- Fastify
- MongoDB
- Mongoose
- Azure Blob Storage
- Azure Queue Storage
- Pino Logger

Do not introduce:

- PostgreSQL
- Prisma
- Drizzle
- Redis
- Cache layers
- Azure DocumentDB
- Alternative database engines
- Alternative state management libraries
- Alternative UI frameworks

---

## Development Rules

- Reuse existing components, hooks, services, schemas, utilities, and types.
- Do not duplicate logic.
- Keep business logic out of React components.
- Follow the existing flow: Components -> Hooks -> Services -> API Client -> Backend.
- Controllers must not access database models directly.
- Repositories are the only layer that performs database queries.
- Use TypeScript strictly.
- Do not use `any`.
- Do not add unnecessary type assertions.
- Do not leave empty catch blocks.
- Do not introduce new architectural layers unless explicitly requested.

---

## Database Rules

- Use MongoDB with Mongoose only.
- Do not use Azure DocumentDB anywhere in this project.
- Use existing models, schemas, repository patterns, and connection setup.
- Never create additional database connections.
- Repositories are the only place where Mongoose models should be queried.
- Use `.lean()` for read operations where applicable.
- Use projections to keep payloads small.
- All list APIs must support pagination.
- Add indexes for new searchable, sortable, or filterable fields.
- Use transactions only for multi-document atomic operations.
- Never load entire collections in request paths.
- Avoid expensive aggregations in synchronous API requests.

---

## Authentication & Authorization

- Follow the existing JWT implementation.
- All protected routes require authentication.
- RBAC must be enforced using existing middleware.
- Never trust roles, permissions, branch IDs, hospital IDs, or department IDs sent from the frontend.
- Load permissions from the database.
- Enforce authorization on the backend for every protected action.
- Apply hospital, branch, department, and role scoping consistently wherever the existing project supports it.

---

## API Rules

Use the existing API response format.

Every new endpoint must:

- Use Zod validation.
- Return standard success/error responses.
- Include proper error codes.
- Enforce authentication and RBAC where required.
- Support pagination for list responses.
- Use existing OpenAPI/Swagger patterns.
- Avoid exposing internal database details in responses.
- Return predictable validation errors that the frontend can display safely.

---

## Frontend Rules

Every page must provide:

- Loading state
- Empty state
- Error state
- Success feedback

Use:

- TanStack Query for server state
- React Hook Form + Zod for forms
- Sonner for notifications
- URL query params for page, filter, tab, sort, and search state
- Existing API clients, hooks, and services
- Existing layout, navigation, table, dialog, form, and permission patterns

Do not:

- Call APIs directly from React components.
- Put business logic in components.
- Duplicate hooks, services, components, types, or utilities.
- Hardcode production data.
- Use mock data in completed features.

---

## Healthcare UI/UX Rules

HMS UI must be sophisticated, calm, accessible, and operationally efficient.

Design principles:

- Prioritize clarity, trust, and speed over decoration.
- Use clean spacing, restrained colors, readable typography, and strong visual hierarchy.
- Prefer dense but organized layouts for staff workflows.
- Make critical information easy to scan: patient identity, appointment time, doctor, department, status, payment state, admission state, and alerts.
- Use consistent status colors for clinical and operational states.
- Avoid playful, casual, overly colorful, or marketing-style visuals.
- Avoid cluttered dashboards, oversized hero sections, decorative cards, gradient-heavy backgrounds, and unnecessary illustrations.
- Use shadcn/ui components consistently.
- Use icons only where they improve recognition and workflow speed.
- Use tables, filters, tabs, badges, dialogs, drawers, and forms according to existing project patterns.
- Ensure responsive layouts work cleanly on desktop, tablet, and mobile.
- Ensure text never overlaps, truncates badly, or breaks key actions.
- Use accessible contrast, labels, focus states, and keyboard-friendly controls.
- Preserve patient privacy by avoiding unnecessary patient data exposure in shared views.
- Confirm destructive or irreversible actions with clear dialogs.
- Show clear success and error feedback for clinical, billing, appointment, admission, and administrative actions.

Healthcare workflow expectations:

- Keep patient-facing identifiers consistent across screens.
- Avoid ambiguous labels for medical, billing, and appointment actions.
- Show timestamps using existing date/time utilities.
- Use explicit statuses instead of relying only on color.
- Highlight overdue, urgent, cancelled, pending, and failed states clearly.
- Keep forms structured into logical sections for patient, clinical, billing, and operational information.
- Validate required medical, contact, appointment, payment, and admission fields before submission.

---

## Dashboard Rules

- Use the existing snapshot-based dashboard architecture.
- Do not perform expensive aggregations in request paths.
- Dashboard reads should come from snapshot collections.
- Background jobs generate snapshots.
- Dashboard cards must show loading, empty, error, and stale-data states where applicable.
- Use compact, scannable dashboard layouts suitable for hospital operations.

---

## File Upload Rules

- Store files in Azure Blob Storage.
- Store metadata only in MongoDB.
- Validate file type and size.
- Use existing upload components and services.
- Do not store file binaries in MongoDB.
- Apply authentication and RBAC to upload, view, replace, and delete actions.
- Do not expose private file URLs without proper authorization.

---

## Logging Rules

Use Pino only.

Never use:

```ts
console.log()
```

Log:

- Request lifecycle
- Errors
- Slow queries
- Background job failures
- Authentication and authorization failures where useful
- File upload failures
- Important state transitions in healthcare workflows

Never log:

- Passwords
- Tokens
- Secrets
- Connection strings
- Patient-sensitive clinical notes
- Full medical records
- Payment card details
- Private file URLs

---

## Performance Rules

Always:

- Paginate lists
- Use projections
- Use indexes
- Use debounced search
- Keep API payloads small
- Follow existing query and repository patterns

Never:

- Load entire collections
- Add Redis/cache
- Perform expensive dashboard aggregations on page load
- Run broad unindexed searches
- Send unnecessary patient, clinical, billing, or file metadata to the frontend

---

## Code Generation Rules

Before creating anything:

1. Check if it already exists.
2. Reuse existing implementation patterns.
3. Follow current folder structure.
4. Follow existing naming conventions.
5. Follow existing RBAC and API patterns.
6. Follow existing UI and form patterns.

Do not create:

- Duplicate hooks
- Duplicate services
- Duplicate components
- Duplicate types
- Duplicate utilities
- New database connection helpers
- New API response formats
- New permission systems
- New dashboard aggregation patterns

---

## Completion Checklist

Before marking work complete:

- No mock data remains.
- No hardcoded production data is added.
- No `console.log()` is added.
- API is connected.
- RBAC is applied.
- Zod validation is added.
- Error handling is added.
- Pagination is implemented where required.
- Loading, empty, error, and success states are handled.
- UI follows sophisticated hospital management UX standards.
- Patient-sensitive data is not overexposed.
- Database access stays inside repositories.
- MongoDB/Mongoose patterns are followed.
- Build passes.
- TypeScript passes.

---

## Golden Rule

Follow the existing HMS implementation first.

If a new requirement conflicts with this file, ask for clarification before changing architecture, database strategy, RBAC behavior, API contracts, or major UI patterns.

HMS Local Design Rules

HMS Local is the source of truth for UI implementation.

Before implementing any page:

Check HMS Local.
Match layout.
Match spacing.
Match component behavior.
Match workflow.

Do not redesign screens unless explicitly approved.

Priority:

HMS Local
↓
Scope Document
↓
Implementation

Scope Rules

Primary Scope:

HMS_Phase_1_OPD_Understanding_for_Developer 1.docx

All implementation decisions must align with this document.

If scope is unclear:

STOP

Do not invent:

Fields
Workflows
Statuses
Business rules
APIs

Raise clarification instead.

API Rules

Frontend must use:

React
↓
API Client
↓
Backend API
↓
Service
↓
Repository
↓
Mongoose
↓
MongoDB

Not Allowed:

Mock APIs
Fake APIs
LocalStorage persistence
Hardcoded records
Mock Data Rules

Mock data may be used only during initial UI scaffolding.

Before a module is marked complete:

Remove:

Mock arrays
Mock JSON
Mock services
Hardcoded counters
Hardcoded statistics

No production screen may depend on mock data.

Authentication Rules

Do Not Modify:

JWT logic
Refresh token rotation
Authentication middleware
Session handling

Without approval.

Validation Rules

Every form must have:

Required indicators (*)
Required validation
Error messages
Duplicate handling
API validation

Never allow silent failures.

Modal Rules

Every modal must:

Be scrollable
Work on laptop screens
Work on tablet screens
Work on small-height screens

Required:

Sticky footer
Save button always visible
Cancel button always visible
Table Rules

All management pages must support:

Search
Sorting
Filtering
Pagination

If backend supports it.

Do not fake pagination.

Action Rules

Every visible action must work.

Examples:

Create
Edit
Delete
Clone
Export
View Details
Assign
Save

Not Allowed:

Disabled buttons without reason
Placeholder actions
Fake success messages

If backend does not exist:

Show proper message.

Dashboard Rules

Dashboard data must come from APIs.

Not Allowed:

Hardcoded statistics
Hardcoded charts
Hardcoded activity feeds

Dashboard cards must be backed by MongoDB data.

Permission Rules

Every module must respect:

Role permissions
Screen permissions
Action permissions

Hide or disable unauthorized actions.

Never expose admin functionality without permission checks.

Branch Rules

Every operational module must support:

Branch awareness
Branch filtering
Branch assignment

Where applicable.

Department Rules

Every operational module must support:

Department assignment
Department filtering

Where applicable.

User Experience Rules

Required:

Loading states
Empty states
Error states

Never leave blank screens.

Browser Validation Rules

A feature is NOT complete until:

Browser tested
Navigation tested
Refresh tested
No console errors
No API errors

If browser backend unavailable:

Report:

Browser Validation: BLOCKED

Do not mark as passed.

Documentation Rules

Update:

docs/HMS_PHASE1_IMPLEMENTATION_TRACKER.md

After every completed feature.

Do Not Update:

docs/HMS_PHASE1_PROGRESS_AUDIT.md

Unless specifically requested.

Code Quality Rules

Must Pass:

npm run typecheck

npm run build

Existing unrelated lint errors must not be modified unless part of the task.

Developer 1 Ownership

Current Scope:

Administration Foundation

Completed:

Authentication
User Management Foundation
Roles & Permissions
Branch Management
Department Management
Service Catalogue

Pending:

Doctor Master
Doctor Availability
Specialization Master
Consultation Setup
Dashboard Analytics
System Settings
Completion Criteria

A feature is Complete only when:

✓ API exists

✓ MongoDB persistence exists

✓ Frontend integrated

✓ No mock data remains

✓ Validation implemented

✓ Permissions implemented

✓ Tracker updated

✓ Browser validated

Otherwise classify as:

Partial
Blocked
Not Started

Never mark incomplete work as complete.
