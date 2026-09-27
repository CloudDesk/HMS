# PATIENT MOBILE APPLICATION READINESS & IMPLEMENTATION ANALYSIS

Analysis date: 25 September 2026. Scope: the current repository, especially `apps/patient-web` and `apps/api`. This is an analysis and proposal, not authorization to implement a mobile app or change backend contracts.

**Assessment: substantial backend reuse is possible, but the system is not yet ready for a production native patient app.** Resolve authentication transport and rotation, production OTP configuration, complete-history APIs, patient notification delivery, and release prerequisites first. A limited portal-parity app needs fewer APIs than the full feature list in the request.

Evidence is source inspection unless explicitly identified as a test result. Configuration files demonstrate intended configuration, not what is deployed. No production account, SMS delivery, push service, store account, or cloud configuration was accessed. No existing application source was changed. No mobile project was created.

## 1. Current Architecture

| Area | Verified implementation | Reuse implication |
|---|---|---|
| Workspace | npm workspaces `apps/*`; API, staff web, patient web | Add a mobile workspace only after architecture approval |
| Patient web | React 19, TypeScript 6, Vite 8; TanStack Query 5, React Hook Form 7, Zod 4, Sonner, jsPDF, CSS and Phosphor icon classes | Types, validation, query keys and pure utilities are candidates for reuse; DOM components are not native components |
| Routing | Custom `routing/navigation*`, `AppRouter.tsx`, `routes.ts`; browser location/history usage | Do not assume React Router is used merely because project rules list it |
| Backend | Node engine >=22, Fastify 5, TypeScript, Mongoose 9/MongoDB; Pino via Fastify | Keep existing API/service/repository architecture |
| Auth | Custom HS256 JWT helper, opaque refresh tokens stored as hashes, HttpOnly refresh cookie, OTP challenges, database rate limits | Reuse identity and authorization; adapt transport and harden lifecycle |
| Patient portal | `patient-portal.routes/service/repository`, OTP service/repository, grants and guardian profiles | Existing patient/guardian access is the authorization boundary |
| Other reused domains | Appointments, doctors, branches, departments, services, patients/documents, OPD prescriptions/dental quotations, billing, laboratory, imaging | Do not create parallel clinical or billing domains |
| Shared code | Backend `shared/` modules and frontend local schemas/types; no existing common `packages/` contracts package found | Shared package extraction is a proposed change, not something already available |
| Files | Local filesystem patient-document service; MongoDB metadata; GCP bucket configuration exists | GCP configuration alone does not prove a working GCS implementation |
| Notifications | MongoDB notification module, recipient filtering, list/read APIs | In-app notification foundation, not push infrastructure |
| Deployment | Firebase Hosting config for patient web; Render API template; GitHub Actions CI | Firebase Hosting is not Firebase Authentication or FCM |
| Tests | Vitest; patient web DOM tests; API tests using MongoMemoryServer and transaction tests | Useful starting point, not native device coverage |

Primary source map:

- Architecture/configuration: `package.json`, each application `package.json`, `apps/api/src/app.ts`, `config/env.ts`, `shared/services/service-registry.ts`, `database/client.ts`.
- Client contracts: `apps/patient-web/src/api/patient-portal.ts`, `patient-portal.schemas.ts`, `client.ts`, `auth/*`, `hooks/usePatientPortal.ts`, `hooks/useHospitalCatalogue.ts`.
- Backend contracts: `apps/api/src/modules/patient-portal/*`, `modules/auth/*`, `middleware/authenticate.ts`.
- Files: `modules/patients/patient.service.ts`, patient document models/repositories, `shared/storage/patient-document-storage.service.ts`.
- Notifications: `modules/notifications/*`; dental: `modules/opd/dental-quotation.*`.
- Release: `firebase.patient.json`, `render.yaml`, `.github/workflows/ci.yml`.

This task does not implement a Scope 2 Phase 3 phase. The phase stop gates and locked technology rules remain applicable to later implementation. React Native/Expo would be an explicit extension to that locked stack and requires owner approval.

## 2. Existing Patient Web Features

Classification describes the existing capability and its limiting dependency. READY FOR MOBILE means the backend capability can be reused after common mobile authentication prerequisites; it does not mean a native screen already exists.

| Feature | What actually exists | Classification |
|---|---|---|
| OTP request/login | Four-digit OTP, resend timing, verification, identity/IP limits | REQUIRES BACKEND CHANGE: production demo setting and native session transport |
| Signup | Patient/guardian registration; OTP or one-use registration token | REQUIRES ADAPTATION |
| Existing patient activation | Backend MRN/DOB/phone activation; OTP login also handles unlinked matching adults | REQUIRES ADAPTATION |
| Minor/guardian activation | Dedicated flow, guardian consent, account context | REQUIRES ADAPTATION; authorization policy review required |
| Password login | Client auth API/context and generic backend support; visible patient login is OTP-oriented | REQUIRES ADAPTATION only if retained in mobile scope |
| Password recovery/change | Generic backend routes exist; no patient-web recovery workflow established | REQUIRES ADAPTATION; approve account recovery scope |
| Refresh/logout | In-memory access token, cookie refresh, automatic retry and query-cache clearing | REQUIRES BACKEND CHANGE |
| Multiple sessions | Multiple refresh records possible; no device/session management UI/API | REQUIRES BACKEND CHANGE |
| Profile view | Demographics, address/contact, blood group, emergency contact, MRN | READY FOR MOBILE |
| Profile edit | Patient profile and guardian profile PATCH; profile completion POST | REQUIRES BACKEND CHANGE for verified login-phone change flow |
| Dependents | Add/link dependent, add self profile, switch accessible patient | REQUIRES ADAPTATION; preserve persistent visible patient context |
| Insurance | Insurance document category exists; structured insurance policy editing not exposed by portal | REQUIRES BACKEND CHANGE only if structured insurance is required |
| Profile photo | Initials/avatar in portal; no patient-portal photo upload API found | NEW MOBILE FEATURE if requested; needs approved backend capability |
| Appointments/history | Server-paginated upcoming/past lists; includes OPD visits without appointment links | READY FOR MOBILE |
| Booking | Branch/department/doctor catalogues, slots, visit type/reason, confirmation | READY FOR MOBILE subject to retry/concurrency acceptance tests |
| Reschedule | Eligibility API and PATCH, server rules and conflicts | READY FOR MOBILE subject to retry/concurrency acceptance tests |
| Appointment detail | List contains detail fields; no separate portal detail GET found | REQUIRES BACKEND CHANGE for independent deep-link detail screen |
| Cancellation/check-in | Statuses displayed; no patient-owned cancel/check-in route found | REQUIRES BACKEND CHANGE if these actions are required |
| Doctor directory | Search/filter by branch/department, qualifications, experience, available days | READY FOR MOBILE |
| Doctor details/schedule | Directory payload and per-date slots; no dedicated public detail/full schedule API | REQUIRES ADAPTATION; new API only for richer requirements |
| Consultation/treatment history | Appointment/OPD history and prescriptions; no general patient clinical timeline or consultation-detail API found | REQUIRES BACKEND CHANGE |
| Diagnosis/clinical notes/medical history | No general patient-facing endpoint established; imaging findings and prescription instructions are exposed | REQUIRES BACKEND CHANGE with approved disclosure policy |
| Prescriptions | Latest 12 submitted/dispensed prescriptions; medicine, strength, route, dosage, frequency, duration, quantity, instructions | REQUIRES BACKEND CHANGE for complete paginated history/detail |
| Prescription PDF | No patient prescription download endpoint/UI found | REQUIRES BACKEND CHANGE if download is required |
| Pharmacy purchases | Items derived from latest 50 non-draft/non-cancelled invoices | REQUIRES BACKEND CHANGE for complete history |
| Laboratory results | Latest 6 verified records; result items, remarks, timestamps | REQUIRES BACKEND CHANGE for full history/detail/download |
| Imaging reports | Latest 6 verified records; findings, impression, recommendations | REQUIRES BACKEND CHANGE for full history/detail/download |
| Lab/imaging orders | No patient order tracking API found | REQUIRES BACKEND CHANGE if included |
| Billing | Latest 8 non-draft invoices; invoice detail, lines, payments, balance; client-generated invoice PDF | REQUIRES BACKEND CHANGE for full invoice history; PDF requires native adaptation |
| Payment history/receipt | Payments within invoice detail; invoice PDF exists, not a dedicated receipt service | REQUIRES ADAPTATION; separate receipt API only if required |
| Online payments | No patient checkout/payment-provider workflow found | REQUIRES BACKEND CHANGE if included; not portal parity |
| Documents | Paginated list, multipart upload, authenticated download, review state | REQUIRES ADAPTATION for native picker/viewer/share |
| Dental quotations | Billing tab lists quotations; detail, accept selected option, reject, postpone, PDF generation | REQUIRES ADAPTATION; add server pagination and verify side-effect atomicity |
| Patient card | MRN/identity card modal | REQUIRES ADAPTATION for native card/share experience |
| Notifications | No patient-web notification API client or inbox screen found; generic backend list/read exists | REQUIRES BACKEND CHANGE for patient event flows; NEW MOBILE FEATURE for push |
| Public hospital website | Branch, service, department and doctor browsing, booking entry points | REQUIRES ADAPTATION for useful catalogue; marketing shell NOT REQUIRED FOR MOBILE |
| Staff login/provisioning | Staff link and protected account-provision API | NOT REQUIRED FOR MOBILE patient UI |

Important existing limitation: Results and Medicines tabs paginate arrays in memory. That does not fetch older records beyond backend caps. Overview result counts are array lengths, not complete history counts. Billing has the same capped-history issue. Do not describe these as complete medical records.

## 3. API Inventory

All paths below include `/api`. Existing success responses normally use `{ data: payload }`; a paginated payload is itself `{ data: [...], meta: { page, limit, total, totalPages } }`. Errors normally use `{ error: { message, code, details? } }`; not every route is fully consistent (notification read 404 lacks a code).

Authorization legend: **Public** = unauthenticated; **Account** = valid bearer plus patient/guardian context; **Patient** = valid bearer plus server-resolved self/verified grant; **Auth** = valid bearer; **Staff** = server permission. Device-supplied patient IDs never grant access.

### Existing patient/auth routes

Every row in this table is verified existing. `P` abbreviates `/api/patient-portal`; `A` abbreviates `/api/auth`.

| Feature/API | Method | Request parameters/body | Response payload | Authorization | Mobile ready / changes |
|---|---|---|---|---|---|
| `P/public/branches` | GET | page, limit, search | Branch list + meta | Public | Yes |
| `P/public/departments` | GET | page, limit, search, branch_id | Department list + meta | Public | Yes |
| `P/public/services` | GET | page, limit, search, department_id, branch_id | Service/pricing list + meta | Public | Yes |
| `P/public/doctors` | GET | page, limit, search, department_id, branch_id | Doctor list + meta | Public | Yes |
| `P/public/doctors/:id/slots` | GET | id; date YYYY-MM-DD | Doctor/date, availability, unavailable reason, slots | Public | Yes; define timezone explicitly |
| `P/otp/request` | POST | phone | success, resendAvailableAt | Public + rate limit | Logic reusable; real SMS prerequisite |
| `P/otp/verify` | POST | phone, otp | success, registrationToken | Public + rate limit | Yes for registration verification |
| `P/login/otp` | POST | phone, otp | user, tokens.accessToken/tokenType/expiresIn; refresh cookie | Public + OTP proof | Native auth adapter required |
| `P/signup` | POST | account_type, full_name, email, phone, registration_token or otp; guardian_profile/initial_dependent when relevant | account + session; 201; cookie | Public + verification | Native session delivery adaptation |
| `P/existing-patient/activate` | POST | phone, registration_token or otp, patient_number, date_of_birth, email | Activation result; 201; refresh cookie | Public + identity proof | Unlike login, does not return access-token session body; normalize native contract |
| `P/guardian-activation` | POST | phone, proof, full_name, email, relationship, address/identification, legal_consent_accepted=true | Session + cookie | Public + proof | Native transport; review guardian proof |
| `A/login` | POST | identifier, password | Session + cookie | Public + rate limit | Existing generic password capability; native transport if used |
| `A/refresh` | POST | Empty object; refresh token from cookie only | Rotated session + cookie | Refresh credential | No explicit native token transport |
| `A/logout` | POST | Empty object; refresh cookie | `{ok:true}` | Auth | Expired-access/offline revocation handling needs change |
| `A/me` | GET | None | Current user/roles/context | Auth | Yes |
| `A/password-policy` | GET | None | Password policy | Auth | Optional for password flows |
| `A/change-password` | POST | currentPassword, newPassword | `{ok:true}` | Auth | Reuse only after patient recovery decision |
| `A/password-reset/request` | POST | identifier | Generic message that instructions will be sent | Public | Service creates/audits reset token but contains no delivery call; not a complete recovery flow |
| `A/password-reset/confirm` | POST | resetToken, newPassword | `{ok:true}` | Reset proof | Delivery and patient recovery UX still required |
| `P/context` | GET | None | Account, guardian profile, accessible patients/relationships/branch | Account | Yes |
| `P/overview` | GET | optional patient_id | Patient, summary, capped appointments/invoices/results/prescriptions/purchases | Patient | Summary only; not full lists |
| `P/profile` | POST | Patient profile fields | patientId; 201 | Account | Reuse completion rules |
| `P/dependents` | POST | Profile fields + relationship | patientId; 201 | Guardian | Reuse after guardian-policy review |
| `P/dependents/link` | POST | patient_number, date_of_birth, relationship, legal_consent_accepted | patientId, patientNumber; 201 | Guardian | Stronger linking proof/review decision needed |
| `P/patients/:patientId` | PATCH | Full required profile fields plus optional contact/address/emergency fields | patientId, patientNumber | Patient | Separate verified login-contact change |
| `P/patients/:patientId/guardian-profile` | PATCH | full_name, relationship, optional address/identification | patientId, relationship | Guardian with patient access; minor rule | Reuse |
| `P/appointments` | POST | patient_id, doctor_id, appointment_date, start_time, duration_minutes, visit_type, reason | id, appointment_number, status; 201 | Patient | Reuse domain; safe retry contract needed |
| `P/appointments` | GET | patient_id, scope=upcoming/past, optional status, page, limit | Appointment/OPD history + meta | Patient | Yes |
| `P/appointments/:id/reschedule-eligibility` | GET | appointment id | eligible, reason, minimum_notice_hours | Patient owning appointment | Yes |
| `P/appointments/:id/reschedule` | PATCH | doctor_id, appointment_date, start_time, duration_minutes | Appointment identity/status | Patient owning appointment | Yes with stale/concurrent retry tests |
| `P/patients/:patientId/invoices/:invoiceId` | GET | patientId, invoiceId | Invoice totals, patient/branch, items, payment records | Patient; invoice belongs to patient, non-draft | Yes; native PDF adapter |
| `P/documents` | GET | patient_id, page, limit | Document list + meta | Patient | Yes |
| `P/documents/upload` | POST | Multipart file; patient_id, document_type, title; optional description, document_date, provider_name | Document; 201 | Patient | Native FormData/picker; metadata before file |
| `P/patients/:patientId/documents/:documentId/download` | GET | patientId, documentId | Binary attachment with MIME and filename | Patient + document association | Yes; native private-file handling |
| `P/accounts` | POST | patient_id, username, email, password | id, username, email, status; 201 | Staff: Patients / Patient Records / Edit | Not for patient mobile |

Profile required fields: first_name, last_name, date_of_birth, gender, preferred_branch_id. Optional fields include blood_group, address and emergency_contact; PATCH additionally accepts middle_name, email and phone. Guardian relationship is PARENT or LEGAL_GUARDIAN. MRN validation uses `HMS-YYYY-NNNNNN`. Booking duration is 5–240 minutes, reason 3–500 characters, visit type NEW_CONSULTATION/FOLLOW_UP/PROCEDURE. Public list default limit 8/max 100; appointments default 10/max 50; documents default 20/max 100.

### Other verified reusable endpoints

| Feature/API | Method | Request | Response | Authorization | Changes required |
|---|---|---|---|---|---|
| `/api/opd/dental/quotations/patient/:patientId` | GET | patientId | Quotation array, no pagination | Auth; self/verified grant for portal users; drafts filtered | Add pagination; audit shared staff-path scoping separately |
| `/api/opd/dental/quotations/:quotationId` | GET | quotationId | Quotation with options/items/state | Auth + quotation access; portal drafts denied | Reuse |
| Same + `/accept` | POST | selected_option_id, optional notes | Updated quotation | Auth + service access/state checks | Verify transactional treatment activation and idempotency |
| Same + `/reject` | POST | optional reason | Updated quotation | Auth + service access/state checks | Native confirmation; retry tests |
| Same + `/postpone` | POST | optional reason | Updated quotation | Auth + service access/state checks | Native confirmation; retry tests |
| `/api/notifications/me` | GET | is_read, page, limit (max 100; default 20) | Notification list + meta | Current authenticated recipient; role/branch filtering | Patient event types/recipient policy; not used by patient web |
| `/api/notifications/:id/read` | PATCH | id | Updated notification or 404 | Current recipient | Normalize error and per-recipient read semantics |

Common error contract to preserve: 400 validation, 401 absent/expired/invalid credentials, 403 access denial, 404 missing record, 409 business conflicts, 429 rate limits. OTP additionally returns `INVALID_OTP`, `MAX_ATTEMPTS_EXCEEDED`, `AUTH_RATE_LIMITED`, `SMS_NOT_CONFIGURED` (503), `SMS_DELIVERY_FAILED` (502). Activation can return `MINOR_GUARDIAN_ACCOUNT_REQUIRED`, `MULTIPLE_PATIENT_MATCHES`, `NEW_PATIENT_REQUIRES_REGISTRATION`, `INVALID_REGISTRATION_TOKEN`, `PATIENT_IDENTITY_NOT_MATCHED`, `DUPLICATE_PATIENT`. Profile/grants include `PATIENT_ACCESS_DENIED`, `GUARDIAN_ACCOUNT_REQUIRED`, `PATIENT_NOT_MINOR`. Appointment service includes `APPOINTMENT_SLOT_CONFLICT`, `PATIENT_APPOINTMENT_CONFLICT`, past-time and leave errors. Document service includes `FILE_TOO_LARGE`, `INVALID_FILE_TYPE`, `DOCUMENT_FILE_NOT_FOUND`; multipart middleware can reject before the service. Dental actions include `INVALID_STATE`, `FORBIDDEN`, `NOT_FOUND`.

Mobile should consume these services through approved patient-facing routes. Staff laboratory, imaging, billing, and appointment APIs are not automatically patient-safe alternatives to missing portal endpoints. New endpoint names below are proposals, not existing APIs.

## 4. Authentication Readiness

### Existing behavior

- OTP generation uses cryptographic `randomInt(1000,10000)` outside demo mode. SHA-256 of normalized phone plus OTP is stored; comparison is timing-safe. Default expiry is 300 seconds, cooldown 60 seconds, maximum failed attempts 3; identity/IP windows are configurable. Atomic challenge consumption prevents sequential reuse.
- Verification can issue a random 32-byte, hashed, single-use registration token with 15-minute expiry. Signup/activation can also consume OTP directly.
- SMS has an HTTP gateway implementation. Missing configuration fails explicitly; this is not proof that an SMS provider is configured in the deployed environment.
- Access JWT contains sub, username, iat, exp; default life 900 seconds. Authentication reloads the user and checks active/locked status. It is not tied to a revocable device session.
- Refresh credentials are opaque and SHA-256 hashed in MongoDB (`token` field). Default life 604800 seconds. TTL cleanup exists; service also checks expiry.
- `establishRefreshSession` strips refresh credentials from JSON and sets `hms-refresh-token`, HttpOnly, path `/api/auth`, configured Secure/SameSite/domain. `/auth/refresh` reads only this cookie.
- Frontend access token is memory-only; legacy local/session refresh storage is removed. Client includes cookies, performs single-flight refresh and one 401 retry. Logout clears query cache and memory even if server logout fails.
- Revocation fields are absent from the declared refresh schema but repository updates use `{strict:false}` and lean reads. Therefore the schema mismatch does **not** justify claiming revocation is entirely broken. Formalize those fields and test persistence.
- Rotation reads the old credential, issues the replacement, then revokes the old one. There is no atomic consume/issue transaction or checked conditional-update result here. Concurrent refresh requests can both pass the initial check. This is a source-derived race risk, not a reproduced production incident.
- Multiple refresh records permit multiple sessions, but there are no named devices, session list/revoke-one/revoke-all routes, session family, or user-visible last-active metadata. Password changes/resets revoke refresh records. Access JWTs can remain valid until expiry after logout.
- Password-reset request creates a token and audit record but does not invoke an email/SMS sender in the inspected service. Treat recovery as incomplete, not ready merely because the route exists.
- The profile-update repository's direct refresh revocation lacks the auth repository's `strict:false` override while `revokedAt` remains undeclared. This separate path risks having its update stripped by Mongoose; add a persistence regression test and fix the declared schema before relying on identity-edit revocation.

### Recommended native contract

Keep web cookies unchanged. Add explicit patient-mobile session endpoints/adapters sharing AuthService and PatientOtpService; do not add a flag to browser responses that exposes web refresh tokens. Native login/activation returns an access token plus opaque refresh credential over TLS; native refresh/logout accepts the credential through an explicitly documented non-URL transport. Native endpoints must enforce patient/guardian account eligibility themselves.

Extend the existing refresh/session model with declared revocation/replacement fields, session/family identifier, client platform, app installation identifier, created/last-used timestamps and expiry. Atomically consume refresh credentials and create replacements using existing MongoDB transaction patterns. Define lost-response retry behavior and replay handling so mobile network retries neither fork sessions nor silently weaken replay protection. Single-flight client refresh remains necessary.

A managed native cookie jar could technically retain the current protocol, but cross-platform persistence, cookie replacement and logout must be proven. An explicit native refresh contract is the recommended choice for this project; browser cookies are not intrinsically unusable on mobile.

Logout should revoke the current native session even with an expired access token, with refresh proof and ownership validation. Define logout-all and stolen-device handling. Immediate access-token revocation requires a session/version check; decide whether short expiry is sufficient before promising immediate logout everywhere. Offline logout clears local secrets immediately but cannot guarantee immediate server revocation; document and test this limitation.

Do not reuse the frontend's catch-all refresh failure behavior unchanged: transient network/5xx failures currently clear authentication. Native should distinguish offline/service unavailable from rejected credentials.

### Local storage

| Data | Proposed handling |
|---|---|
| Access token | Memory; avoid persistent storage by default |
| Refresh token | OS-protected small-secret storage, e.g. Expo SecureStore |
| OTP/password/registration proof | Never persist password or OTP; short-lived registration proof in memory |
| Patient/account identifiers | Memory by default; protect persisted account-linked selections; never authorization evidence |
| Installation/device identifier | Random app installation ID, not hardware ID; never an authentication factor |
| Push token | Account-associated device metadata; minimize persistence, no logs, authenticated registration |
| Preferences | Ordinary storage only for nonsensitive preferences such as theme |
| Clinical records/PDFs | No persistent clinical cache by default; private temporary files, cleanup; encrypted policy if offline history is later approved |

AsyncStorage is unencrypted and unsuitable for credentials. SecureStore requires explicit reinstall/backup/biometric-change testing; iOS keychain items may survive uninstall. Biometrics unlock a local credential, not a replacement for server authentication. Sources: [React Native security](https://reactnative.dev/docs/security), [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/).

## 5. Notification Readiness

Existing database types are REFERRAL, CALL_NEXT_PATIENT, GENERAL, DENTAL_LAB_READY. The repository supports user recipients and role/branch recipients. One `isRead` is stored per notification document: a shared role notification cannot represent independent read state for every user.

No FCM sender, APNs integration, patient device-token model/registration API, mobile delivery receipts, or patient-web push/inbox integration was found in application source. The root Firebase dependency and Hosting config do not provide those capabilities.

Required proposed flows:

| Flow | Work needed |
|---|---|
| Appointment booked/rescheduled/cancelled | Emit from committed appointment domain transitions; send to authorized account recipients |
| Appointment reminder | Scheduled due-time work with deduplication, timezone policy, cancellation suppression |
| Lab/imaging available | Emit only after approved verified/released state; never draft clinical data |
| Prescription available | Approved submitted/released transition; no drug details on lock screen |
| Invoice/payment | Patient-owned issued invoice/payment event; no sensitive balance on lock screen by default |
| General patient message | Explicit recipient authorization; no broad patient-role clinical broadcast |
| Dental quotation | Extend existing event use only after checking actual producer/recipient contract |

Reuse NotificationModel for individual user inbox entries. Add typed entity context (including authorized patient context), event identity/deduplication and delivery metadata where appropriate. A new device registration collection is justified: multiple installations and rotating tokens have an independent lifecycle. A separate read-receipt collection is only necessary if shared broadcast documents must retain per-user state; individual recipient documents can avoid it.

Choose direct FCM/APNs or Expo Push delivery in Phase 0. Do not mix Expo push tokens with native device tokens. Use existing MongoDB/background-job patterns for reliable delivery/retries; no Redis or duplicate notification subsystem. Queue/outbox persistence may require approved additions for reliable dispatch. Unregister/reassign tokens safely on logout/account change and prune invalid provider tokens. Notification tap opens an allowlisted route, authenticates, checks the current grant and fetches current data. Notification payload is never proof of access.

## 6. File/Document Readiness

Existing upload is one multipart file with metadata. Portal categories are INSURANCE, CLINICAL, OTHER. Service validates nonempty data, configured size/MIME and dates; default maximum is 10 MiB. Default MIME allowlist includes PDF, JPEG, PNG, WebP, plain text, CSV, Word and Excel formats. Mobile picker must reflect actual server configuration; HEIC is not in the default allowlist.

Downloads enforce account-to-patient and document ownership, return a buffer with Content-Type and attachment filename. Local storage protects against path traversal and generates unique storage keys. There are no signed/temporary download URLs in this portal flow. It uses buffered reads/uploads rather than end-to-end streaming or resumable transfer. Browser code uses Blob/object URL/download behavior; replace it with native private-file APIs, preview and user-initiated share.

Uploaded patient documents have clinical-review metadata. Preserve pending/rejected/approved behavior; do not equate uploaded with clinically accepted. Verify current document visibility policy across patient, guardian and staff in integration tests.

Invoice and dental quotation PDFs are generated client-side with jsPDF. They are not backend PDF-download endpoints. Reuse their data/mapping and approved layout, replacing browser save behavior; a server renderer is optional if identical cross-platform documents are required. Lab/imaging/prescription PDF exports require approved patient-safe data or download endpoints; ordinary document download does not automatically cover those records.

Release changes: durable storage using the approved GCS direction, or a specifically approved durable interim setup; file signature/content validation and malware handling policy; explicit private/no-store caching; private temp cleanup; extension/MIME mismatch tests; bounded memory. Do not expose bearer tokens in file URLs. Do not automatically save health records into a public gallery/download folder.

## 7. Database Readiness

Reuse User, Patient, Role/Permission, RefreshToken, OtpChallenge, RegistrationToken, AuthRateLimit, PatientAccessGrant, GuardianProfile, patient document/timeline metadata, Appointment, OPD clinical/prescription/dental models, laboratory/imaging records, billing models and Notification.

PatientAccessGrant already supports SELF/PARENT/LEGAL_GUARDIAN and PENDING/VERIFIED/REJECTED/REVOKED, unique `(userId,patientId)` and access-query indexes. Reuse it; do not create a mobile patient ownership table. Guardian linking policy must be tightened using the existing status capability if approval requires review.

| Proposed database work | Necessity |
|---|---|
| Extend RefreshToken into explicit session lifecycle | Required for recommended native session design; no parallel mobile identity database |
| Device registration model | Required when push is included; user, installation, platform/provider, token, status, lastSeen, app version, timestamps |
| Device uniqueness/indexes | Prevent duplicate registrations and cross-account token leakage; do not use patientId alone because a guardian covers several patients |
| Notification context/delivery metadata | Required for patient event routing/deduplication; reuse notification records |
| Delivery job/outbox records | Conditional on chosen reliable dispatch design; use existing architecture and MongoDB |
| Notification preferences | Conditional; small account preference extension may suffice |
| New patient/report/billing/file collections | Not required simply because mobile exists |
| History query indexes | Inspect explain plans and existing patient/date/status indexes before adding any |

Production transaction support must be verified on the actual MongoDB deployment. Test in-memory replica sets are not deployment evidence. No production schema migration was performed.

## 8. Security Readiness

| Priority | Source finding / risk | Required response |
|---|---|---|
| Release blocker | `render.yaml` enables demo OTP with production environment. Demo guard only validates format, not prohibition in production | Remove production demo usage, enforce environment guard, verify real SMS; deployed state unverified |
| High | Refresh read/issue/revoke sequence is non-atomic | Atomic rotation, replay/lost-response policy, concurrent test |
| High | `authenticate.ts` accepts access token in query string; logger config has no explicit URL redaction | Native must use Authorization header; remove/restrict legacy query transport after compatibility audit; redact query credentials |
| High | Guardian link uses MRN+DOB+declared relationship/consent and creates access grant | Approve stronger identity/guardian proof or staff review; MRN/DOB knowledge alone is not robust authorization proof |
| High | Profile PATCH can update the portal owner's login phone without fresh OTP proof of the new number | Separate contact edit from verified login-identity change; step-up auth, audit and session handling |
| High | Logout depends on valid access bearer; client swallows logout failure and refresh failure | Ensure revocation with refresh proof; offline semantics; test restart cannot silently restore intentionally logged-out session |
| Medium | JWT auth checks user but not session revocation | Document remaining access lifetime or add session/version enforcement |
| Medium | Shared notification read flag | Individual recipient records or approved per-user read receipts |
| Medium | History caps and date handling based partly on server timezone | Server pagination and explicit hospital timezone; test mobile travel/timezone boundaries |
| Medium | Local buffered file storage, declared MIME validation | Durable storage, content validation, privacy headers, bounded native storage |
| Medium | Patient profile update spans patient/user/token/audit writes outside a single visible transaction | Review atomicity before mobile identity-edit rollout |
| Review | Clinical instructions, findings and remarks are exposed in overview | Confirm patient-release projection; do not expose full staff notes by convenience |

Positive controls: server-resolved patient grants, invoice/document ownership, non-draft invoice and verified-result filtering, OTP rate limits, hashed refresh/registration tokens, HttpOnly web cookies, active-account checks and audit events.

Additional release checks: runtime validation of JWT claims and malformed token handling; CORS is not native authorization or a complete CSRF defense for cookie endpoints; verify Origin/CSRF behavior while preserving web functionality. Audit all notification targets and deep links. Scrub tokens, OTPs, phone numbers and clinical payloads from crash analytics and app logs. Existing SMS code uses console calls (with masked phone/content redaction) despite the project Pino rule; resolve in a scoped backend change.

Security review is source-based, not a penetration-test certification. Clinical/legal disclosure and retention decisions remain owner decisions.

## 9. Mobile-Specific Requirements

| Capability | Priority | Proposed behavior |
|---|---|---|
| Secure storage/session lifecycle | Required | Protected refresh credential; in-memory access; safe account switching |
| Network/background/foreground handling | Required | Offline state, retry, refresh on resume, no duplicate mutations |
| Private file selection/download/preview | Required for document parity | Native picker, progress, MIME/size checks, safe temp files |
| Permission handling | Required where capability used | Just-in-time request, denial/restricted-state recovery |
| Device registration/push | Recommended; required if notifications are in release scope | Authenticated token lifecycle, opt-out and invalidation |
| App/universal links | Recommended; required for push detail navigation | Owned domain associations, allowlisted route+ID, auth/grant checks |
| Share sheet | Recommended | Explicit export; cleanup private staging files |
| Biometric unlock | Recommended | Optional user opt-in; passcode/OTP fallback; no server bypass |
| Camera/gallery | Optional | Only document/photo capture; prefer platform picker over broad permission |
| Document scanning | Optional | Separate scope; no OCR/clinical interpretation assumed |
| Offline clinical cache | Optional | Disabled by default; retention/encryption and stale-data rules first |
| App update handling | Required for release compatibility | Minimum supported version policy, graceful unsupported-API handling; OTA optional |
| Local reminders | Optional | Do not imply guaranteed delivery; avoid sensitive lock-screen text |

Proposed five-tab information architecture:

1. **Home**: current patient, next appointment, booking entry, verified-record summaries, billing shortcut.
2. **Appointments**: upcoming/history, booking steps, detail, reschedule; cancel/check-in only after backend approval.
3. **Records**: prescriptions, lab results, imaging, documents, pharmacy purchases; consultations only when approved API exists.
4. **Inbox**: notifications and read state once patient notification work is complete.
5. **Account**: profile, family/dependents, patient card, billing/invoices/dental quotations, privacy, security/devices, preferences, logout.

For an initial release without inbox, use four tabs rather than an empty Notifications placeholder. Keep the selected patient visible on all clinical/billing screens and confirm patient identity on mutations. Billing remains directly reachable from Home as well as Account.

Reuse the calm HMS palette, explicit statuses, identity/MRN hierarchy, booking sequence and confirmations conceptually. Replace desktop tables with readable lists and detail screens, large modals with navigation screens/sheets, browser pagination with server-backed list loading, and hover actions with touch controls. Preserve loading/empty/error/success states; add offline, stale, permission denied, conflict/retry, upload progress and session-expired states. Use accessible touch targets, text scaling, keyboard avoidance, safe areas and screen-reader labels. Source review found web loading/error/empty components and four-item bottom navigation; it does not establish that native navigation can be copied directly.

## 10. Technology Recommendation

**Recommend React Native with Expo development builds and TypeScript, pending an approved extension to PROJECT_RULES.md.** Keep HMS as identity and business-data authority; do not adopt Firebase Auth or Firestore to build mobile.

| Option | Fit for this repository | Tradeoff |
|---|---|---|
| React Native + Expo | React/TS knowledge; reusable Zod schemas, API mappings, query keys, pure utilities; maintained access to native storage/files/notifications/build tooling | UI/navigation and browser APIs must be rewritten; native SDK compatibility must be pinned/tested |
| React Native without Expo tooling | Similar reuse; greatest direct control over native projects | More signing/build/native integration maintenance; choose if required native SDKs demand it |
| Native Android + native iOS | Strong platform control | Two UI/client codebases and limited TS reuse; no current requirement justifies that cost |
| Flutter | Cross-platform UI | New Dart codebase and contract duplication; weak direct reuse of current TS logic |

Expo Go alone is insufficient for acceptance of the push/native-security workflows; use development builds and real devices. Expo supports FCM/APNs setup and native notification integration. See [Expo push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/) and [notification SDK](https://docs.expo.dev/versions/latest/sdk/notifications/).

Proposed structure: `apps/patient-mobile` with screens -> feature hooks -> domain hooks/services -> transport adapters; optional approved shared contract package for platform-neutral schemas and types. No such project/package has been created. Do not copy `window`, storage globals, CSS, DOM FormData/file assumptions, jsPDF saving, Sonner DOM components, or browser routing into shared code. Preserve Zod response validation and patient-scoped query keys.

## 11. Backend Changes Required

### Existing – No Change

Reuse patient/guardian identity, patient-access grants, public catalogues/slots, profile data, appointment booking/reschedule domain rules, ownership-checked invoice/document access, clinical source records, audit/timeline infrastructure. “No change” applies to domain ownership and valid business logic, not to the cross-cutting security issues above.

### Modify Existing

- AuthService/repository/schema: atomic refresh/session lifecycle, declared revocation fields, explicit native adapter, secure logout, platform metadata; preserve browser response/cookie contract.
- Profile/login-phone update: verified identity-change flow and transaction/audit/session behavior.
- Guardian linking: approved proof/review gate using existing grants.
- Overview: retain bounded summary, make counts accurate; do not inflate it into full history.
- Notification types/recipient context/read semantics and producer integration.
- File validation/storage/caching configuration and service adapter.
- Dental list pagination; verify financial/treatment mutation atomicity and safe retries.
- Error/response contracts, date/time semantics, query-token compatibility removal and logging redaction.

### New API Required

Proposed capabilities, paths to be agreed:

| Capability | Need |
|---|---|
| Native login/refresh/logout transport; session list/revoke | Required for recommended auth design |
| Device register/update/unregister | Required for push |
| Paginated prescriptions/lab/imaging/invoices/pharmacy history + safe detail | Required to promise complete history |
| Patient appointment detail | Recommended for independent navigation and push deep links |
| Verified phone change | Required if login phone is editable |
| Account deletion/request and status | Store-release prerequisite where applicable; honor approved health-record retention |
| Patient notification preferences | Required only if configurable preferences are promised |
| Consultation/diagnosis/timeline, report PDFs, cancellation/check-in | Required only when these requested features enter approved release scope |
| Online checkout, payment status/webhooks, receipt | Separate approved billing integration; not implied by existing invoice API |
| Rich doctor detail/photo/insurance profile | Conditional feature expansions |

### New Database Model Required

Device registration for push. Extend existing RefreshToken and Notification models first. Delivery-job/read-receipt/deletion-request persistence depends on the approved workflow; do not create these automatically.

### Configuration Required

Native session policy, production OTP prohibition, real SMS gateway, explicit hospital timezone, approved document MIME/size, durable storage, push provider credentials, app IDs/link domains, minimum app/API version and environment separation. Never embed backend signing keys or provider credentials in mobile builds.

### Infrastructure Required

Device-accessible HTTPS API, MongoDB transaction support, durable approved file storage, reliable background notification/reminder dispatch, FCM/APNs or approved Expo relay, signing/build pipeline and private crash reporting. These do not require changing database technology.

## 12. Testing Requirements

### Analysis verification

Executed from the repository root:

```text
npx vitest run apps/patient-web apps/api/src/modules/patient-portal apps/api/src/modules/notifications/notification.authorization.test.ts
```

Result: **19 test files: 18 passed, 1 failed. 103 tests: 100 passed, 3 failed.** Exit code 1, duration 112.89 seconds. All three failures are in the unchanged `apps/patient-web/src/pages/PatientWebsitePage.test.tsx`:

- Line 138: initial catalogue load expected `publicDepartments` once; observed twice.
- Line 176: shared catalogue cache test expected `publicDepartments` once; observed twice.
- Line 228: filtered-query test expected `publicDepartments` once; observed twice.

React test-environment `act(...)` warnings were also emitted. The failures establish that the existing assertions do not pass; root cause was not repaired or conclusively attributed to UI versus test setup in this analysis. Existing API OTP/session, portal transaction/pagination, and notification authorization test files were included in the passing set. These tests use controlled/in-memory fixtures, not production delivery or real mobile devices.

The running web/patient-web and `/api/health` returned HTTP 200 earlier in this task, but that does not establish authenticated workflow acceptance. The phase-level build/lint/typecheck commands, browser workflow acceptance, full API regression suite and physical-device tests were not run for this analysis. No implementation phase is being marked complete.

### Required backend acceptance

- Native and web session contract tests; old refresh replay, concurrent refresh, lost response, revoke one/all, expired access logout, inactive/locked user, OTP attempts/cooldown/IP identity limits, production demo rejection.
- Self/guardian/unrelated/revoked/pending grant matrix for every list/detail/download/mutation; altered patient/invoice/document/quotation IDs; branch/department scope where relevant.
- Guardian-link proof and phone-change verification; transaction failure rollback; duplicate profile/dependent behavior.
- Appointment slot concurrency, stale eligibility, reschedule races, duplicate retries, doctor leave, midnight/timezone travel.
- More records than every current overview cap; pagination totals, stable ordering, per-patient isolation, verified/draft filtering.
- File size/type/signature, traversal, foreign document, missing file, interrupted transfer; privacy headers and logging.
- Device token reassignment/logout/uninstall/rotation; notification ownership/read independence; duplicate event delivery, invalid token, retry/backoff; revoked guardian before push tap.
- Dental accept/reject/postpone conflicts and treatment/billing side effects; invoice/payment ownership and authoritative amounts.

### Mobile tests

Unit tests for serializers, schemas, validation, date/time and storage adapter; component tests for forms/states; navigation/deep-link tests; API integration tests against controlled fixtures; secure-storage/refresh tests; PDF/file picker/share tests; permission-denial and offline retry tests. Do not queue clinical/financial mutations offline by default.

### Android/iOS device matrix

Fresh install and reinstall; existing patient and guardian with multiple dependents; logout/login and account switch; two devices; expired/revoked tokens; airplane mode, slow network and lost responses; app background/foreground/process kill; notification foreground/background/cold-start tap; permission denied/revoked; download interruption/share cleanup; biometrics unavailable/enrollment changed; device time and timezone changes; large fonts/screen reader; current and minimum supported OS on actual devices.

Existing CI checks all three application typechecks/builds and lints, but API lint is `continue-on-error: true` and CI runs only `test:security`, not the full patient-web suite. Add mandatory mobile checks and relevant full contract tests during implementation.

## 13. Deployment Requirements

Existing: Windows development machine; root Node/npm engines, Firebase Hosting patient deployment command, Render backend template, GitHub Actions Node 22 workflow. No native project/app ID/signing/FCM/APNs configuration was identified in the inspected repository. Installed Android SDK/Xcode and external account entitlements were not verified.

Development prerequisites: select compatible stable Expo/RN versions; Android Studio/SDK/emulator and physical Android; iOS device and access to macOS/Xcode for local iOS build/debug, or approved cloud build service for binaries. Windows does not provide local Xcode. Use a LAN-accessible or staging HTTPS API on devices; device localhost is not this PC. Define dev/staging/prod API URLs without placing secrets in public app environment variables.

Android: owner-approved application ID, Play Console ownership, signing/upload keys with recovery controls, release AAB/build pipeline, FCM Android registration if chosen, notification channels/permissions, verified App Links domain. Confirm target SDK/store requirements when scheduling release rather than guessing a version now.

iOS: approved bundle ID, Apple Developer/App Store Connect ownership, distribution/provisioning credentials, push capability/APNs credentials, associated domains, required permission descriptions, TestFlight and release builds. Signing material belongs in approved secret storage.

Both: privacy policy, support URL, store screenshots/metadata, test reviewer access, accurate data disclosures, health-data handling review, deletion/retention workflow, release versioning and rollback. No account-deletion portal endpoint was found in this inventory. Apple requires in-app account-deletion initiation for apps supporting account creation, with provisions for regulated services; Google has account-deletion/data-safety requirements. Do not equate deleting portal access with deleting medical records required to be retained. Sources: [Apple account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app), [Google account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en), [Google health declaration](https://support.google.com/googleplay/android-developer/answer/14738291?hl=en).

## 14. Prerequisite Checklist

Checked means verified by this analysis, not production-certified.

### Backend

- [x] Existing patient-facing routes and core domain reuse identified.
- [ ] Native authentication transport and session/replay policy approved and tested.
- [ ] Production demo OTP disabled/prohibited; real SMS verified.
- [ ] Full-history API contracts approved where required.
- [ ] Guardian linking and login-phone change security resolved.
- [ ] Device registration and notification infrastructure implemented if in scope.
- [ ] File durability/privacy and patient report-export contracts verified.
- [ ] Database changes/indexes/migrations reviewed; transaction environment verified.
- [ ] Environment variables and secrets provisioned per environment.
- [ ] Security review and required acceptance tests passed.

### Patient Web

- [x] Existing client routes/contracts, source business rules and limitations identified.
- [x] Candidate shared types/schemas located; no shared package assumed.
- [x] Current capped-history/auth/notification gaps documented.
- [ ] Failing baseline tests resolved and web regression checks green.
- [ ] Backward-compatible web cookie/session behavior verified after backend changes.

### Mobile

- [ ] Technology/locked-stack extension approved; Expo/RN is a recommendation.
- [x] Proposed project boundaries, navigation and feature scope documented.
- [x] Proposed auth/storage/notification/file handling documented.
- [ ] Contracts and native dependencies/version compatibility finalized.
- [ ] Accessibility, offline and patient/dependent context acceptance agreed.

### Infrastructure

- [ ] FCM/APNs or Expo delivery choice/configuration completed.
- [ ] Android and iOS IDs, developer accounts, signing and devices available.
- [ ] HTTPS staging, durable storage and release monitoring verified.
- [ ] Mobile CI/CD and signing recovery configured.
- [ ] Privacy, health declaration, data disclosure and deletion flows approved.

## 15. Blockers

Before mobile implementation: approve native stack extension, session transport/security design, release feature scope, guardian/identity-change rules and patient clinical-disclosure contracts. Do not invent missing medical, payment or consent rules.

Before implementing dependent screens: approve missing detail/history/PDF/cancellation/payment contracts for features selected for this release. Existing portal-parity screens do not require every optional API in this report.

Before production release: remove demo OTP configuration; prove real SMS; close refresh concurrency/logout risks; resolve required automated test failures; verify file durability and HTTPS; complete push infrastructure if promised; sign and test Android/iOS builds; approve privacy/deletion/retention workflows and store prerequisites.

Missing real device testing, production credential validation and penetration testing are explicitly unverified evidence, not claims that the external systems are absent.

## 16. Phased Implementation Plan

| Phase | Scope | Exit gate |
|---|---|---|
| 0 — Decisions/contracts | Approve technology, mobile MVP, API inventory, native auth, guardian/contact rules, disclosure, store/deletion needs | Approved contracts and phase gap note; no app code before approval |
| 1 — Backend readiness | Production OTP, atomic sessions/native adapter, secure identity changes, required history APIs and document readiness | API integration/security/concurrency tests; web compatibility |
| 2 — Native foundation/auth | Approved workspace, navigation, transport, secure storage, OTP/signup/activation, logout/resume/network states | Android/iOS development builds; real-device session tests |
| 3 — Profile/family/home | Context, self/guardian/dependents, profile, patient card, catalogue and home summaries | No cross-patient cache leakage; required profile proof enforced |
| 4 — Appointments | Booking, history/detail, eligibility/reschedule; only approved cancel/check-in scope | Slot concurrency, retries and timezone tests |
| 5 — Clinical records | Prescriptions, verified lab/imaging, optional approved consultations/timeline | Complete pagination and approved patient projections; exports tested |
| 6 — Billing/documents/dental | Invoices/payments display, private files, quotation actions and PDFs | Ownership, PDF, mutation atomicity, upload/download acceptance |
| 7 — Notifications | Device lifecycle, patient events/reminders, inbox/read state, deep links | Real Android/iOS push and recipient/privacy tests |
| 8 — Release hardening | Security review, privacy/deletion flow, accessibility/performance, offline policy, device matrix | Required checks and acceptance all green |
| 9 — Release | Signing, internal tracks/TestFlight, store submissions, monitoring/support | Approved release evidence and staged rollout |

Security and testing occur in every phase, not only Phase 8. Each implementation phase must inspect current files, write a gap note, preserve shared changes, run the project-required API/staff-web checks plus patient-web/mobile checks, record verification, and stop for explicit approval before the next phase. No phase has started as part of this analysis.

## 17. Final Readiness Summary

**A. Already available:** patient/guardian accounts and grants; catalogues/slots; profile/context; booking/reschedule/history; verified result/prescription summaries; invoice/payment detail; document upload/download; dental quotations; MongoDB business models; audit and test foundations.

**B. Requires modification:** native refresh transport/session lifecycle; verified login-phone changes and guardian-link proof; overview/history separation; dental pagination; patient notification context/read state; native navigation/forms/files/PDF generation; production file/SMS configuration.

**C. New development required:** native app; device registration/push/inbox integration; approved session-management endpoints; missing complete-history/detail/export endpoints; deletion-request experience; optional expanded medical/cancellation/payment features only when approved.

**D. Backend changes:** extend existing auth/notification/file/portal domains, reuse clinical/business services, add device persistence when push is included; no new database technology or duplicate clinical subsystem.

**E. Mobile-only requirements:** secure OS storage, app lifecycle/network recovery, native file/permission/share behavior, push/deep links, optional biometrics, signing/store pipeline and physical-device acceptance.

**F. Blockers:** approved technology/contracts and security decisions before implementation; demo OTP, session race/logout, required API gaps and deployment/test evidence before release.

**G. Order:** decisions -> backend readiness -> native auth/foundation -> family/profile -> appointments -> records -> billing/documents/dental -> notifications -> release hardening -> stores.

**Decision: ready for an approved design/backend-readiness phase; not ready to claim production mobile implementation readiness. No mobile implementation or existing application-code changes were made.**
