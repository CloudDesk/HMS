# PATIENT MOBILE APPLICATION — PHASE 0 ARCHITECTURE & CONTRACT REPORT

Date: 25 September 2026. Reviewed repository HEAD: `e9c93b2d408fde68cd34730b5ad71e8ed1c57f39` (`Dental PDF`).

**Phase 0 preparation is complete. The architecture and contracts below are proposals for owner approval, not approved implementation instructions. Phase 1 has not started.** The only product decision already explicitly supplied for authentication is fixed OTP `1234` for this environment, with no external delivery.

## Deliverables

| Deliverable | Document |
|---|---|
| A. Mobile MVP Scope | [A_MVP_SCOPE.md](A_MVP_SCOPE.md) |
| B. API Contract Gap List, history/projection and file contracts | [B_API_CONTRACT_GAPS.md](B_API_CONTRACT_GAPS.md) |
| C. Native authentication, refresh lifecycle, grants and login-phone change | [C_AUTHENTICATION_CONTRACT.md](C_AUTHENTICATION_CONTRACT.md) |
| D. Device registration and push event contract | [D_NOTIFICATION_CONTRACT.md](D_NOTIFICATION_CONTRACT.md) |
| E. Mobile architecture, navigation and security | [E_MOBILE_ARCHITECTURE.md](E_MOBILE_ARCHITECTURE.md) |
| F. Prerequisites, release checklist and decision register | [F_PREREQUISITES.md](F_PREREQUISITES.md) |
| G. Next implementation phase only | [G_PHASE_1_PLAN.md](G_PHASE_1_PLAN.md) |

These are documentation-only deliverables. Existing source, configuration, dependencies, database, deployment, Firebase and Patient Web UI remain unchanged. No `apps/patient-mobile` directory was created. The earlier readiness report is preserved as a historical baseline rather than rewritten.

The supplied [Patient Web Protection Rules](<C:/Users/lenovo/Documents/GitHub/HMS/PATIENT MOBILE DEVELOPMENT — PATIENT WEB PROTECTION RULES.txt>) were also inspected and preserved. They reinforce additive native adapters, explicit approval of significant shared behavior changes, full Patient Web regression tests and no unrelated refactoring. In particular, proposed changes to grant precedence, generic profile phone handling and document-list semantics are **separate approval gates**, not permission to change working web behavior during Phase 1.

Deliverables are under `PATIENT_MOBILE_PHASE_0/` because the repository ignores `docs/`. No ignore rule was changed. The protection-rules file appeared during inspection and was not created or edited by this task.

## Proposed decision package

- **Technology:** React Native + Expo development builds + TypeScript, as a mobile-only extension to the locked stack. HMS remains the sole backend and MongoDB the sole business-data database.
- **MVP boundary:** existing-account access, existing authorized family records, profile/card/home/catalogue, appointments, complete patient-safe prescriptions/results/invoices, documents and read-only dental quotations. No self-service new account/dependent linking, login-phone editing or dental decision mutations in the proposed initial scope.
- **Notifications:** Phase 2 proposal because device registration, event producers, delivery and mobile inbox do not exist. Therefore the proposed MVP has Home, Appointments, Records and Account; no empty Inbox tab.
- **Authentication:** reuse the existing OTP request service and fixed-code configuration; introduce only native session transport and lifecycle alongside unchanged web cookie endpoints. No SMS task, provider, credential or new SMS environment variable.
- **Refresh policy:** atomic rotation, one current credential per native session, explicit server revocation. Proposed strict replay policy requires sign-in again after an ambiguous/lost rotation response rather than retaining recoverable refresh-token responses. This reliability/security tradeoff requires owner acceptance.
- **Clinical disclosure:** start from verified source projections, not full staff records. Verification is the current visibility gate; no independent patient-release lifecycle is established. Owner approval of projection and visibility semantics is still required.
- **Phase 1:** native authentication backend contract only, with web compatibility and fixed-code tests. No mobile workspace, history APIs, notification infrastructure or phone/grant workflow changes in that phase.

## Current repository verification and differences from the baseline

The working tree began with only the earlier untracked readiness report. The source checks below agree with its main findings. The baseline did not record a commit/hash manifest, so this is a finding-by-finding revalidation, not a claim of a historical byte-for-byte comparison.

| Area inspected | Current result | Difference/clarification |
|---|---|---|
| Workspaces and packages | `apps/*`; React/TS/Vite patient web, Node/Fastify/Mongoose API | Recommendation still fits. No root shared-contract package found; backend `src/shared` is not a frontend package |
| Patient Web | Custom browser routing, TanStack Query, local Zod schemas, memory access token, refresh cookie | No native component or mobile session implementation found |
| OTP/config | `.env.dev` uses existing demo-enabled flag and code `1234`; request service skips sender in this branch; `.env.example` disables fixed mode; Render template enables it | **User decision supersedes the baseline's SMS prerequisite and its request to remove fixed OTP for this environment.** Actual remote environment is not verified |
| Auth | Cookie-only refresh/logout, opaque token hashes, non-atomic read/issue/revoke rotation | Still needs native adapter and concurrency work; auth repository explicitly persists undeclared revocation fields with `strict:false` |
| Grants | VERIFIED/non-revoked grants; legacy `User.patientId` SELF fallback | Baseline understated fallback: a revoked explicit SELF grant can be bypassed by this fallback. Define explicit-deny precedence before promising revocation |
| Minor rule | Portal helper uses age under 15 | Preserve existing backend rule; do not silently replace it with 18 or claim a legal definition |
| Profile | Profile update can write owner's login phone; direct refresh invalidation lacks auth repository's strict override | Keep mobile identity editing out of MVP until purpose-bound change flow and revocation are approved |
| Appointments | Public catalogues/slots, paginated appointment+OPD history, booking/reschedule; no portal cancel/check-in | No new capability found. IDs in combined history can identify appointments or standalone OPD visits |
| Clinical history | Overview: prescriptions 12, labs 6, imaging 6; submitted/dispensed or verified filters | Still capped. Lab model and response schema already contain `referenceRange` and `comments`; patient UI renders a narrower subset |
| Billing/dental | Invoices 8; purchases from 50 invoices; invoice details/payments; unpaginated dental list and existing actions | Complete lists need scoped APIs; keep financial/clinical dental side effects outside proposed MVP |
| Notifications | Four existing types, user/role recipients and a document-level read flag; no mobile push/device integration | Foundation only; Firebase Hosting/dependency is not FCM setup |
| Documents | Existing list/upload/download and local buffer storage | Additional scaling gap: list loads all metadata, checks every file exists, then slices the result. API pagination is not database pagination |
| Transaction helper | Shared helper falls back to execution without a session on standalone MongoDB errors | **Newly highlighted contract dependency:** native multi-document session rotation must fail closed, not use that fallback |
| CI/CD | Existing API/web/patient-web checks; API lint allowed to fail; security subset run | No native build/signing/store workflow identified |

### Source evidence

- [Workspace](C:/Users/lenovo/Documents/GitHub/HMS/package.json), [Patient Web dependencies](C:/Users/lenovo/Documents/GitHub/HMS/apps/patient-web/package.json), [API dependencies](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/package.json), [project rules](C:/Users/lenovo/Documents/GitHub/HMS/PROJECT_RULES.md).
- [OTP request/verification](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patient-portal/patient-otp.service.ts), [conditional OTP consumption](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patient-portal/patient-otp.repository.ts), [environment parser](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/config/env.ts). Only the relevant fixed-code settings were read from local environment configuration; other secrets are not reproduced.
- [Auth routes](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/auth/auth.routes.ts), [cookie adapter](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/auth/auth-session-cookie.ts), [refresh schema](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/auth/refresh-token.model.ts), [auth service](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/auth/auth.service.ts:252), [auth repository](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/auth/auth.repository.ts:168).
- [Patient routes](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patient-portal/patient-portal.routes.ts), [patient service](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patient-portal/patient-portal.service.ts), [context/fallback](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patient-portal/patient-portal.repository.ts:345), [overview caps](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patient-portal/patient-portal.repository.ts:872), [grants](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patient-portal/patient-access-grant.model.ts).
- [Appointment service](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/appointments/appointment.service.ts), [billing model](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/billing/billing.model.ts), [lab model](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/laboratory/laboratory-result.model.ts), [imaging model](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/imaging/imaging-report.model.ts), [dental routes](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/opd/dental-quotation.routes.ts).
- [Notification model](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/notifications/notification.model.ts), [notification routes](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/notifications/notification.routes.ts), [document listing](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patients/patient.service.ts:156), [file storage](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/shared/storage/patient-document-storage.service.ts), [transaction fallback](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/shared/database/transaction.ts).
- [Patient query/navigation hook](C:/Users/lenovo/Documents/GitHub/HMS/apps/patient-web/src/hooks/usePatientPortal.ts), [API client](C:/Users/lenovo/Documents/GitHub/HMS/apps/patient-web/src/api/client.ts), [web token storage](C:/Users/lenovo/Documents/GitHub/HMS/apps/patient-web/src/auth/token-storage.ts), [CI](C:/Users/lenovo/Documents/GitHub/HMS/.github/workflows/ci.yml), [Hosting](C:/Users/lenovo/Documents/GitHub/HMS/firebase.patient.json), [API deployment template](C:/Users/lenovo/Documents/GitHub/HMS/render.yaml).

## Fixed OTP contract takes precedence

The code is `1234`, supplied manually by the user. Requesting a challenge must not send SMS. Existing expiry, request cooldown, identity/IP rate limits, failed-attempt handling and single-use consumption remain. No new OTP provider or redesign is needed to select this mode.

This fixed code is an environment verification step, not evidence of control of a phone number. That distinction matters for new guardian grants and login-phone changes; those proposals must not claim stronger identity proof than this flow supplies. It does not add an SMS blocker to any phase.

## Review and approval record

Status values in the documents are DONE, PENDING, BLOCKED and DECISION REQUIRED. Proposed MVP and event names are not automatically approved because they appear in a table. The decision register in F identifies the exact choices the owner must approve or amend. Documentation preparation is DONE; architecture/scope sign-off is DECISION REQUIRED.

No runtime tests were executed during this read-only Phase 0 inspection. The previous report's 100 passing/3 failing tests are historical evidence only; they were not rerun or fixed here. Document links, endpoint consistency and repository change boundaries are the Phase 0 verification scope.

Verification: all seven deliverables plus this report are present; local Markdown targets were checked; tracked-file diff remains empty; the previously supplied analysis/protection-rules files remain untouched; `apps/patient-mobile` is absent. Only the new Phase 0 documentation directory was added by this phase.

**STOP: Phase 1 has not started. No implementation, migration, package installation or deployment action is authorized by this report alone.**
