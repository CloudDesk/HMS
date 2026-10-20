# Ophthalmology frontend B6 verification

16 October 2026. **PARTIALLY IMPLEMENTED — not release accepted.** B6 explicitly approved by user. Frontend only. Local Developer A phase10 implementation inspected; no backend or portal implementation ownership assumed.

## Implemented functionality

- `/opd/ophthalmology/reports` and sidebar entry require exact Ophthalmology Reports View. Report-only users do not need Intake or OPD Visits grants. Six published projections: station task register, turnaround, submitted pending review, repeat/unable task register, encounters with tests and diagnostic order utilization.
- Branch, report type, station, order-date range and page stay in URL. Validate IDs/dates/type/range/page before requests; fetch one server page. Station lookup is on demand and separately requires Configuration View. Branch lookup uses authenticated branch choices or authorized paged branch API. Errors, retry, empty/loading and cached-stale states are explicit.
- Report labels/coverage reflect actual backend projections: all task states in station register; submitted-only review; no repeat reasons/rates; clinical volume excludes consultations without tests; utilization counts orders/completed, not capacity percentages. Nullable durations show Unavailable; actual zero remains zero. Server totals are labelled by task/encounter/group. No invented totals, local aggregates or partial-page export.
- Existing result attachments display stored task/result/test/eye/device/acquisition/provenance/MIME/size/checksum/uploader and review/publication states. Downloads compose the patient-document domain hook, require document View plus fresh authorized specialty source, validate exact attachment/task/context/patient/visit/branch/department and use the authenticated binary endpoint. Duplicate clicks are locked; permission/context loss discards late downloads; temporary object URLs are released; failures are shown with retry. Download neither modifies nor publishes clinical data.

## Existing functionality / UI reused

Existing report routes and repository projections, auth branch choices, branch and station domain hooks, OPD shell/cards/tables/buttons, RHF/Zod date controls, specialty horizontal table overflow, page-level error patterns and patient-document authenticated download. Existing B2 attachment uploader/selection and server MIME/size enforcement reused, not replaced. No new storage/media/device adapter. HMS Local is absent; no prototype modified. Shared downstream OPD workflows remain unchanged.

## Files and shared modules changed

New: `api/ophthalmology-reports.ts` and tests; `hooks/ophthalmology/useOphthalmologyReports.ts`, `useOphthalmologyReportsFeature.ts` and tests; `useOphthalmologyAttachmentDownload.ts` and tests; `pages/OphthalmologyReportsPage.tsx` and tests; `auth/ophthalmology-reports-access.test.ts`.

Existing specialty files: result feature composes download hook; ResultAttachments adds provenance/download/error UI; specialty CSS adds wrapping for long attachment metadata. Shared files: `services/ophthalmology.service.ts` report registration; `routing/AppRouter.tsx` lazy report page; `auth/access-control.ts` exact View route tuple; `data/ui-foundation.ts` sidebar item. Frontend prompt, B6 gap and verification records updated. Earlier working changes preserved. No API/patient-web/dependency changes.

## Backend validation, permissions, scope, transactions, audit and errors

No backend state transitions, transactions, permissions/seeds, indexes or audit events changed. Reports use existing Reports View middleware, branch-access/range checks and repository pagination; downloads use existing Patient Documents View and patient-document validation. Frontend guards supplement backend authorization. Report response schemas strip unneeded fields before caching. Report service has branch-only scope; owner must confirm department policy. No permission grants or cross-domain report calculations added. Existing upload transaction/audit/timeline behavior remains authoritative and its replay/metadata gaps remain owner dependencies.

## Automated checks

Commands: `npm run typecheck --workspace=@hms/api`, `npm run lint --workspace=@hms/api`, `npm run build --workspace=@hms/api`, and corresponding `@hms/web` commands. Full regression: `npx vitest run --project web --maxWorkers=2`. Final focused: `npx vitest run --project web` with the report API, report feature, attachment download, report page, report access, specialty workspace page, completion feature and specialty workspace feature test paths, `--maxWorkers=1`. Affected-file `npx eslint` included all B6 APIs/hooks/pages/tests and changed shared route/access/sidebar/service/attachment files.

- Read-only API typecheck/build passed. API lint retains **50 existing errors** (insurance repository 1, service 18, tests 23; patient service 8). No API code changed.
- Corrected web typecheck and production build passed. Initial checks exposed an unsupported station-list `limit` argument and two test typing issues (unchecked mock-call entry and sidebar `children` versus actual `links`); these were corrected. Repeated web typecheck and production build against the current revision also passed.
- Initial focused B6 plus specialty form regression: **5 files / 25 tests passed**. Final focused regression against revision 46a6e7f plus two test corrections: **8 files / 44 tests passed**. Covers API schemas/routes/null durations, exact report-only route access, denied cached data/invalid URLs, lazy station permissions, URL paging, explicit missing metrics, document scope, duplicate/late downloads, failure/retry and existing specialty workspace/readiness behavior.
- Full web regression: **79 files / 377 tests; 373 passed, 4 unchanged failures**. Failures: `auth/access-control.test.ts:71` expects Medicine Master without existing icon; `auth/auth-refresh.test.tsx` lacks QueryClientProvider at AuthContext; both SurgeryWorkspacePage cases lack AuthProvider in recommendation modal. No worker-startup failure in the full run.
- Shared checkout advanced to **46a6e7f** during verification and committed the earlier working frontend files. One intermediate focused attempt failed to load the report-feature test (`Cannot find module /@id/...`), and an intermediate global web lint failed with ENOENT reading OphthalmologyConfigurationPage.test.tsx during that change. Both are distinguished from test assertions; the final focused rerun passed all 44 tests. No source was reverted to an older revision.
- Affected-file lint passed, including the final test corrections. Backend/patient-web/dependency diff from 537c55a to the current revision is empty. Repeated global web lint finished with the same **6 existing errors**: DoctorSignatureCard.tsx:133, PatientAvatar.test.tsx:8, PatientCardModal.tsx:3, PatientProfileHeader.tsx:3, AuthenticatedMediaImage.tsx:32 and PatientProfilePage.tsx:27. Generated TypeScript metadata was restored after checks; final whitespace check passed.

## Live / manual acceptance

Backend `/api/health` returned HTTP 200. Opening the actual report route redirected to `/login?redirect=%2Fopd%2Fophthalmology%2Freports`. The session is unavailable. Temporary browser tab closed. No credentials/configuration/grants/clinical fixtures were created or changed. Live report projection/filter correctness, authenticated attachment bytes, responsive/keyboard flows, persistence/logout/login, two-session stale clinical actions and downstream handoffs remain unverified.

## Required dependency / acceptance handoff

| Requirement | Evidence / remaining owner action |
|---|---|
| Staff publish / withdraw | No staff publication GET/list/history/eligible-source projection. Add reloadable current publication IDs/status/version/source version and explicit authorized eligibility. Then implement confirmed versioned publish/withdraw with stable keys and reasons. No bare-ID or frontend-inferred publication state. |
| Safe publication and amendments | Summary publication copies broad clinical-review/procedure/referral/follow-up objects. Approve an allowlisted patient-safe payload, confidential-field exclusion, and withdrawal/supersession/republication behavior on amendment. Earlier B5 completion/amendment gaps remain. |
| Portal owner | Verify appointments/consultant; approved summary; final medication/optical prescriptions; selected approved images/reports; procedure/pre-op instructions; follow-up/instructions; bills/receipts. Staff report/download work is not evidence that portal rendering/publication is complete. No patient-web edits. |
| Full reporting | Publish repeat/unable reasons and rate denominators, all-consultation clinical volume, required utilization semantics, export endpoint/format and authorized surgery-pipeline/follow-up-compliance/revenue integrations. Existing six projections are narrower. |
| Report resource scope | Backend has branch check, no department filtering; confirm approved Reports View visibility and implement narrower backend scope if required. UI branch/station values are not authorization. |
| Media policy | Provide configured MIME/size policy read projection; verify upload full-fingerprint replay (currently checksum/task/result only) and transactional source-state revalidation. No new DICOM/video/annotation/device capabilities inferred. |
| Clinical role / scenario acceptance | Unverified pending session/approved fixtures: reception, triage, diagnostic/vision/refraction/tonometry, optometrist/orthoptist, ophthalmologist, counsellor, billing/pharmacy, admin, read-only, no-access. Exercise normal/emergency/additional-test/repeat/unreliable/unable/device-unavailable/wrong-eye amendment, deferral/denied override/finalization/publication/withdrawal and downstream persistence/stale/idempotent paths. |
| Shared regression | Automated suite records General OPD/Dental/shared regression evidence only; live registration/check-in/vitals/diagnosis/orders/results/pharmacy/billing/referral/follow-up/procedure flows and network timing/duplicate requests remain acceptance tasks. |

No subsequent phase or release/deployment started. All earlier unresolved B1–B5 and baseline check failures remain open.
