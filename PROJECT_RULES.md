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
- Google Cloud Storage
- Pino Logger

Do not introduce:

- PostgreSQL
- Prisma
- Drizzle
- Redis
- Cache layers
- Azure Blob Storage
- Azure Queue Storage
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

## HMS Local Prototype UI/UX Rules

`scope/HMS Local` is the visual source of truth for HMS UI/UX.

Before implementing or changing any HMS screen, inspect the matching prototype files in `scope/HMS Local`.

Do not modify files inside `scope/HMS Local`.

The React application must reproduce the HMS Local interaction and visual patterns while keeping the React app connected to real APIs and MongoDB persistence.

General shell:

- Use the same dark navy left sidebar pattern from HMS Local.
- Sidebar must support expanded modules, active child highlighting, collapsed state, and mobile drawer behavior.
- Use the same white top header with page title, breadcrumbs, branch selector, date selector, notifications, and user profile menu.
- Main work area must use a light gray background with white bordered content panels.
- Preserve the same operational layout density, spacing, and hierarchy.
- Do not replace HMS Local layouts with marketing-style pages, oversized heroes, decorative backgrounds, or unrelated design systems.

Visual language:

- Use Inter-style typography, compact page titles, muted subtitles, and small uppercase table headers.
- Use blue as the default primary action color for normal HMS workflows.
- Use emergency red only for Emergency-specific flows and dangerous/destructive states.
- Use restrained module accents only where HMS Local already uses them.
- Use white cards with light borders, 8px-12px radii for operational panels, and subtle shadows only for overlays, sticky panels, dropdowns, and modals.
- Use Phosphor/lucide-style line icons consistently in sidebar items, buttons, status areas, alerts, empty states, and workflow steps.
- Keep buttons compact, icon-led where appropriate, and aligned to the right for form and page actions.

Reusable HMS Local patterns:

- Use KPI grids for dashboards and queue summaries.
- Use toolbar rows for search, filters, bulk actions, column controls, and page actions.
- Use tables for operational lists with hover rows, status badges, avatar/person cells, action icon buttons, pagination, and horizontal overflow.
- Use side panels for queue controls, summaries, alerts, quick actions, and selected-record details.
- Use tabs for workspace sections such as overview, vitals, consultation, orders, documents, reports, audit, and timeline.
- Use timeline/audit trails with a vertical line, dot markers, compact event cards, and timestamps.
- Use sticky headers for active patient, order, visit, pharmacy, lab, imaging, and emergency workspaces where HMS Local does so.
- Use sticky bottom action bars for long forms and clinical workspaces.
- Use dropdown panels, notification panels, user menus, confirmation dialogs, modals, and toasts according to HMS Local sizing, spacing, and behavior.
- Use print-specific layouts for printable cards, appointment tokens, lab reports, imaging reports, and clinical summaries where applicable.

Patient UI:

- Patient Search must follow the HMS Local patient search layout: search bar, filters, column controls/actions where applicable, patient table, MRN-first identity, pagination, and Register Patient primary action.
- Patient Registration must be a full-page form, not a modal-only form.
- Patient Registration must use numbered white sections matching HMS Local:
  - Personal Information
  - Contact Information
  - Emergency Contact
  - Medical Information
- Patient Registration must include the sticky bottom action bar with Cancel, Save & Continue, and primary Save action.
- Patient duplicate detection must show the HMS Local warning alert pattern with actions to open the existing profile or register a visit where supported.
- Patient Profile must use the HMS Local patient hero pattern with patient photo/avatar, MRN chip, demographic metadata, status badges, and action buttons.
- Patient Profile must use tabs or structured panels for overview, history, documents, consents, visits, and EMR timeline as shown in HMS Local.
- Patient Documents must use document cards/table rows, upload zones, document-type status badges, and authorized actions following HMS Local.
- Patient EMR Timeline must use the HMS Local vertical timeline pattern.

Doctor UI:

- Doctor dashboard, directory, schedule, availability, and performance screens must follow `doctor-module.css` patterns.
- Use `doc-*` style vocabulary: compact KPI cards, doc buttons, doc cards, doc toolbars, doc tables, doc status badges, doc modals, doc toast, and doc pagination.
- Doctor schedule and availability must use calendar/event cards, segmented view tabs, day selectors, availability toggles, and schedule forms matching HMS Local.
- Doctor list/detail views must use avatar/person cells, specialty/department metadata, status chips, and compact action buttons.

Appointment UI:

- Appointment dashboard, booking, calendar, availability, queue, and walk-in flows must follow `appointment-module.css`.
- Booking must use the stepper pattern for patient selection, schedule selection, and confirmation.
- Doctor/patient selection must use searchable cards and empty-search warning states.
- Slot selection must use compact slot grids with selected, unavailable, and disabled states.
- Calendar views must use the HMS Local day/week/month grid patterns, legends, colored event types, drag/active states where applicable, and compact event cards.
- Queue views must use token displays, queue stats, call controls, queue assignment panels, and status badges.

OPD UI:

- OPD dashboard, queue, and consultation/workspace screens must follow `opd-module.css`.
- OPD workspaces must show an active patient header with patient identity, MRN, demographics, visit status, and actions.
- Use tabbed clinical sections for vitals, notes, diagnosis, prescription, lab orders, imaging orders, documents, follow-up, referral, and summary as applicable.
- Use sticky clinical summary side panels and sticky form action bars.
- Vitals must use the compact grid pattern from HMS Local.
- Prescriptions and orders must use builder rows, selected chips, selectable test/order grids, and clear status badges.
- Autosave/saved indicators must match the subtle HMS Local pattern if autosave is implemented.

Pharmacy UI:

- Pharmacy dashboard, queue, dispensing, and inventory screens must follow `pharmacy-module.css`.
- Use prescription queue layouts, sticky patient/prescription headers, side summaries, dispense rows, verification controls, safety alerts, stock indicators, substitutions, scanner panels, totals, and medication timelines.
- Medicine inventory must use barcode chips, stock quantity states, expiry warnings, alert cards, and compact inventory KPIs.

Laboratory UI:

- Laboratory dashboard, queue, workspace, and reports screens must follow `laboratory-module.css`.
- Use lab workflow step indicators, sticky order headers, side panels, sample/order lists, barcode label panels, printer cards, result entry tables, abnormal/critical indicators, report paper previews, report actions, and audit timelines.
- Critical lab result states must be visually explicit and must not rely on color alone.

Imaging UI:

- Imaging dashboard, queue, workspace, and reports screens must follow `imaging-module.css`.
- Use imaging workflow indicators, equipment/modality cards, room/scan status cards, report editor/preview panels, attachment upload cards, timeline events, and critical-result toggles.
- PACS/viewer-like screens must follow the HMS Local dark viewer layout with toolbar, thumbnails, canvas, overlays, sliders, and responsive behavior.

Emergency UI:

- Emergency dashboard, queue, and workspace screens must follow `emergency-module.css`.
- Emergency is the only workflow that may switch the primary theme to red.
- Use triage level badges, urgent alert banners, current token displays, queue controls, live vitals widgets, sticky patient headers, emergency tabs, pain scale controls, emergency order builders, disposition cards, checklists, and floating emergency actions where applicable.
- Emergency states must be explicit in text and iconography, not only color.

Dashboard and reporting UI:

- Dashboards must use HMS Local KPI cards, chart panels, recent activity lists, task lists, small info cards, and operational alerts.
- Reports, printable lab/imaging reports, appointment tokens, patient cards, and clinical summaries must preserve HMS Local report-paper and print styles where applicable.

Responsive behavior:

- Follow HMS Local breakpoints and collapse behavior.
- Large dashboards may use 5-6 KPI columns; collapse to 3, 2, then 1 column at narrower widths.
- Workspaces with right side panels must collapse to a single column on tablet/mobile.
- Sticky side panels must become static on narrower screens.
- Tables and calendars may scroll horizontally rather than compressing into unreadable layouts.
- Header and sidebar must remain usable on mobile without page reloads.

Implementation boundaries:

- HMS Local defines visual and workflow behavior, not final data contracts.
- Do not copy HMS Local mock data into completed React features.
- Do not port prototype-only libraries, localStorage workflows, Drizzle, PostgreSQL, or mock persistence.
- Convert HMS Local patterns into existing React components, hooks, services, API clients, and backend APIs.
- If an HMS Local UI requires data that the backend does not yet provide, stop and report the missing API rather than replacing it with mock data.

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

- Store production files in Google Cloud Storage.
- Until GCP connection credentials are available, patient documents may be stored temporarily on the backend local filesystem using the existing storage service.
- Do not use browser `localStorage` for files or document metadata.
- Store metadata only in MongoDB.
- Validate file type and size.
- Use existing upload components and services.
- Do not store file binaries in MongoDB.
- Apply authentication and RBAC to upload, view, replace, and delete actions.
- Do not expose private file URLs without proper authorization.
- Preserve API contracts when migrating temporary local document storage to Google Cloud Storage.

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
