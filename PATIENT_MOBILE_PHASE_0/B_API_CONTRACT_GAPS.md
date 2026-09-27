# B. API Contract Gaps, Clinical History and Files

All changes are proposals. Existing routes remain valid for Patient Web. New patient routes must reuse existing repositories/domain services and HMS response/error conventions; do not copy staff-domain rules or expose staff APIs directly to mobile.

Priority: **P0** = authentication/security gate; **P1** = required before the relevant proposed MVP feature; **P2** = after MVP/conditional. `P` = `/api/patient-portal`.

## B1. API gap list

| Existing API | Gap | Proposed change | Reason | Priority |
|---|---|---|---|---|
| `POST P/otp/request` | No native-specific gap in configured fixed mode | Reuse; regression-test no sender call and existing limits | Already returns verification availability | P0 verification only |
| `POST P/login/otp`; cookie refresh/logout | No native refresh credential/session transport | C's native adapters; keep browser transport | Secure native credential lifecycle | P0 |
| Refresh service/model | Non-atomic rotation, undeclared revocation fields, no stable session | C's session anchor/declared token fields and strict transactions | Concurrency/revocation | P0 |
| Shared transaction helper | Can rerun without transaction | Native auth operations must not use unsafe fallback | Multi-document atomicity is mandatory | P0 |
| `GET P/context` and dental authorization | Legacy self fallback can override denied grant; inconsistent revokedAt checks | Approved common precedence and patient access resolver | Selected patient never grants access | P1 before family/dental acceptance |
| `PATCH P/patients/:id` | Generic phone edit can alter login identity; ordinary save may revoke sessions | Approved separation of identity/contact writes; C7 for later phone change | Do not introduce UI-only protection | P1 before profile editing |
| `GET P/overview` | 12 prescriptions, 6 labs, 6 imaging, 8 invoices | Keep summary; add paginated lists below | Complete history cannot come from capped arrays | P1 |
| `GET P/overview` | Result counts are capped-array length | Return true scoped counts or label as recent count | Avoid misleading home metrics | P1 |
| `GET P/appointments` | Combined appointment/OPD history, no reloadable detail | Discriminated resource detail; use existing list | Correct navigation/ownership | P1 |
| Appointment booking/reschedule | No documented response-loss idempotency contract | Verify current domain; define persistent idempotency before auto-retry | No duplicate booking on flaky network | P1 |
| `GET P/documents` | Loads all metadata/files before pagination | Database-bounded listing; reconcile file availability asynchronously or define unavailable rows | Bounded resource use; preserve explicit missing-file state | P1 |
| Document upload/download | Buffered files, no deduplicated upload contract or native private handling | B5 behavior, signature/size/privacy verification; optional client upload key | No duplicate records/unsafe downloads | P1 |
| Existing invoice detail | Complete detail exists, list capped | Add invoice list only; retain detail | No billing duplication | P1 |
| Dental quotation array/detail | Unpaginated list and separate grant logic | Add portal paginated list; reuse safe detail projection | Preserve old array contract for web | P1 |
| Dental actions | Treatment/billing side effects; retry/atomicity not accepted | Dedicated tests/hardening before Phase 2 UI | No blind mobile replay | P2 |
| Generic notification list/read | No patient event/target contract, shared read flag | D, individual recipient rows, typed target | No staff broadcast reuse as clinical patient feed | P2 |
| No device/push APIs | Registration/lifecycle/delivery absent | D | New capability, not Firebase Hosting | P2 |
| No patient consultation/diagnosis/notes | Missing disclosure/projection agreement | Owner-approved patient route only if scope added | Do not expose raw clinical records | P2/Out of Scope |
| No patient cancellation/check-in/checkout | Staff capabilities or invoices are insufficient | Separate approved contracts | State/payment authority | P2/Out of Scope |
| No patient export for clinical reports | No safe report PDF route | Reuse domain projections in future export service | Existing document download is not a clinical report renderer | P2 |
| No patient deletion-request flow | Release workflow missing | Approved account request/status/support workflow | Retention and store readiness | P1 release decision |

## B2. Shared list/detail contract

The proposed new list routes below use the repository's existing page/limit style: `page=1`, `limit=20`, max 100. Validate integers, reject unsupported sort/status/filter values, and return `{data:{data:[...],meta:{page,limit,total,totalPages}}}`. Preserve existing route limits for appointments (default 10/max 50) and documents (default 20/max 100). Detail responses are `{data:detail}`.

New routes use fixed `sort=asc|desc` on their documented date field plus `_id` in the same direction; default desc. A client cannot supply arbitrary MongoDB sort fields. Query `from`/`to` are optional ISO-8601 timestamps including offset, normalized to UTC, inclusive lower/exclusive upper bound (`from <= timestamp < to`), with `from < to`. Absent bounds means all visible history, not an arbitrary 30-day truncation. Dates and required timestamps must be populated from existing clinical fields; do not manufacture clinical event times. Large-history performance/index evidence is required; page pagination is not a stable snapshot under concurrent insertion, so refresh resets/deduplicates the list.

Every route requires active account/session, server-resolved access to active patient and object-to-patient association. Query/path patient ID is never trusted without resolution. Visibility filters are enforced in the database and identical for list, detail and notification targets. Unknown/foreign object detail returns nonrevealing 404 after patient access validation; invalid patient access returns 403. No patient can obtain a draft by guessing a detail ID or overriding `status`.

Errors: 400 `VALIDATION_ERROR`; 401 auth/session errors; 403 `PATIENT_ACCESS_DENIED`; 404 domain not-found; 429 if request limiting applies; 5xx temporary failure. GET retries are bounded and safe. Aborted/late responses must not display under another account/patient.

## B3. Complete-history contract matrix

New routes use `/api/patient-portal/patients/:patientId/...`, abbreviated `R/...`. Existing routes are marked **existing**. All added fields/filters are proposed, not approved medical policy.

| Area | List | Pagination/sort | Filters and visibility | Detail | Ownership/date behavior |
|---|---|---|---|---|---|
| Prescriptions | **new** `GET R/prescriptions` | B2; `submittedAt ?? createdAt`, id | Optional status SUBMITTED or DISPENSED; default both; deleted excluded | **new** `GET R/prescriptions/:id` | Prescription.patientId matches; `from/to` on effective issue timestamp |
| Laboratory | **new** `GET R/laboratory-results` | B2; verifiedAt, id | No client-selectable draft status; nondeleted, verifiedAt non-null | **new** `GET R/laboratory-results/:id` | Result.patientId; `from/to` on verifiedAt; visibility decision below |
| Imaging | **new** `GET R/imaging-reports` | B2; verifiedAt, id | Same verified/nondeleted gate | **new** `GET R/imaging-reports/:id` | Report.patientId; `from/to` on verifiedAt; excludes raw imaging attachments in MVP |
| Invoices | **new** `GET R/invoices` | B2; invoiceDate, id | PENDING, PARTIALLY_PAID, PAID, CANCELLED; default all non-DRAFT; deleted excluded | **existing** `GET R/invoices/:invoiceId` | Invoice.patientId; `from/to` on invoiceDate; payment rows bound to invoice |
| Pharmacy purchases | **new, Phase 2** `GET R/pharmacy-purchases` | B2 over purchase line rows, invoiceDate + item id | PHARMACY lines; associated invoices not DRAFT/CANCELLED; optional invoiceId, visible payment status | **new, Phase 2** `GET R/pharmacy-purchases/:itemId` or existing invoice detail where sufficient | Join via owned invoice; `from/to` on invoiceDate; do not cap to 50 invoices |
| Dental quotations | **new** `GET R/dental-quotations` | B2; createdAt, id; include sentAt separately | SENT, ACCEPTED, REJECTED, POSTPONED, EXPIRED; exclude DRAFT/deleted; optional status | **existing** `GET /api/opd/dental/quotations/:quotationId` | Same approved grant policy in both routes; `from/to` on createdAt; do not change existing array response |
| Appointments | **existing** `GET P/appointments?patient_id=...&scope=upcoming|past` | Existing page/limit, date asc upcoming/desc past; retain current tie-breakers | Existing status enum; no patient-selected branch bypass; date filter absent today | **new** `GET P/appointments/:id`; **new** `GET P/visits/:id` for standalone OPD history rows | Derive patient from record then authorize; add `record_type=APPOINTMENT|OPD_VISIT` to list only additively if approved |
| Documents | **existing** `GET P/documents?patient_id=...` | Existing page/limit; createdAt desc + id proposed tie-breaker | Existing active/nondeleted rules; category/review/date query filters are additions, not current route behavior | **new** `GET R/documents/:documentId` if list metadata insufficient; **existing** download child route | Document.patientId; proposed from/to on uploadedAt, not clinical document date |

Appointment optional date filtering, if approved: `date_from` and `date_to` are inclusive hospital-local YYYY-MM-DD dates, independent of B2 timestamp bounds. Existing date/time payload and server timezone behavior must be reconciled with the hospital timezone; no frontend timezone invention. Standalone OPD visits are not reschedulable appointment IDs. Existing `is_opd_visit` can be true for an appointment with a linked visit, so it alone is not a reliable discriminator of the underlying resource ID.

Minimal list row payloads:

- Prescription: id, patient_id, doctor_name, status, submitted_at, follow_up_date, item_count; detail adds approved medication items/instructions.
- Laboratory: id, patient_id, test_names, verified_at, `visibility_status=VERIFIED`; detail adds result_items and approved remarks.
- Imaging: id, patient_id, verified_at, `visibility_status=VERIFIED`; detail adds approved findings/impression/recommendations. Do not infer modality/test title if not present in the safe joined data.
- Invoice: existing id, invoice_number/date, status, total_amount, paid_amount, balance_amount; existing detail contains lines/payments/branch/patient. Preserve monetary representation, do not recompute totals on device.
- Purchase: item id, medicine_name, quantity, unit_price, total_amount, purchased_at, invoice id/number, payment_status, branch summary; detail uses owned line/invoice, no staff inventory internals.
- Dental: id, quotation_number, doctor_name, status, currency, total, valid_until, sent_at, created_at; existing detail options/items/selection/reason only as currently patient-visible.
- Appointment/visit: existing number/date/time/status/doctor/branch/reason and resource discriminator; no full consultation notes.
- Document: id, patient_id, document_type, title, file_name, mime_type, file_size_bytes, source, review_status, document_date, provider_name, uploaded_at, file availability if approved. No storage_key/private URL/internal audit-user IDs needed by mobile. Existing web response stays compatible; narrow portal serialization must be reviewed rather than copied wholesale from staff DTO.

Counts must use the same ownership/visibility filter as rows. The common wrapper should use `totalPages=max(1,ceil(total/limit))`, matching the existing style for empty results. No new collections are needed for complete history; use existing models and query indexes. Index additions require explain-plan evidence and approved schema changes.

## B4. Patient-facing clinical projection — approval boundary

The following is a **proposed allowlist derived from currently exposed data**, not clinical-owner approval. The phrase “released” is not a new lifecycle state: lab/imaging models record `verifiedAt`, and current overview uses that as visibility. An independent release flag/date was not found in those models. Owner must either approve verification as the patient visibility gate for this release or specify a separate release contract; do not fabricate one.

| Domain | Proposed patient detail fields | Existing evidence / exclusions |
|---|---|---|
| Prescription | medicine_name, strength, route, dosage, frequency, duration, quantity, item instructions; doctor_name, status, submitted_at, follow_up_date, patient_instructions | These appear in overview mapping. `doctor_instructions` is exposed today but its patient suitability needs explicit confirmation; omit from proposed native allowlist until approved. No diagnosis/staff notes automatically added |
| Laboratory | serviceName/test, value/result, unit, referenceRange when present, approved per-item comments, remarks, verified_at | Model and response schema have referenceRange/comments; no invented normal ranges, calculated diagnoses or reinterpretation of values. Absent range is null, not a default |
| Imaging | findings, impression, recommendations, verified_at | Existing projection; no raw DICOM/PACS, attachments/private storage URLs, author IDs or dental-context internals |
| Consultation | None beyond existing appointment/OPD visit metadata in MVP | No approved patient consultation/diagnosis/notes projection established. Requires clinical-owner disclosure and backend contract |

Rules common to lists/details: no DRAFT prescription; verified results only under agreed gate; no deleted records; no client parameter to expand hidden fields; no “full record” serialization from Mongoose documents. Explicitly decide how withdrawn/corrected verified records become unavailable and how that invalidates app views. Source-domain updates must stay in those domains. New enums or consent rules are not approved in this document.

## B5. File/document contract

### Existing HTTP surface

- `GET P/documents?patient_id=&page=&limit=` returns the existing list wrapper.
- `POST P/documents/upload` uses one multipart file. Put `patient_id`, `document_type`, `title` and optional `description`, `document_date`, `provider_name` fields before the file part because route reads parsed field metadata. Categories accepted by portal: INSURANCE, CLINICAL, OTHER. The backend sets patient-origin/review state; client does not approve its own file.
- `GET R/documents/:documentId/download` uses bearer header, returns bytes with Content-Type and attachment filename. Ownership is validated server-side. No bearer query string, signed URL, public file path or cookie dependence is needed for mobile.
- No portal delete route exists. Mobile does not offer server deletion; deleting a temporary local preview is a separate local action.

### Limits and types

Current default max 10 MiB and one file. MIME allowlist: PDF, JPEG, PNG, WebP, plain text, CSV, legacy/OOXML Word and Excel. Actual backend settings remain authoritative. MVP picker must restrict to supported types or give a clear error; HEIC/scanning conversion is not silently added. Byte signature/content validation and actual size checks must be accepted before release. Keep original MIME/file extension coherent; sanitized display filenames are not trusted filesystem paths.

### Native behaviors

| Operation | Contract |
|---|---|
| Upload | System document picker; private staging; validate reported size/type, send original approved bytes. No broad storage/camera permission merely to pick a document |
| Successful upload | Use returned server ID; invalidate only this patient's document list; show pending clinical-review status where supplied |
| Failed upload before dispatch | Permit user retry; retain selected private file only while form remains open |
| Ambiguous upload response | Do not automatically replay POST. Refresh list/reconcile using a proposed `client_upload_id` if that idempotency extension is approved; otherwise show uncertain result and request user reconciliation before another upload |
| Server upload idempotency, if adopted | Authenticated user+patient+client_upload_id scoped uniqueness and payload fingerprint; identical retry returns original document, changed payload 409; retention window at least client retry window. New metadata/index, not assumed to exist |
| Download | Stream/copy through authenticated transport into randomized app-private temp file; existing backend buffers response, so do not claim resumable server transfer |
| Interrupted download | Delete partial file; explicit retry from start. Range/ETag/resume is not promised |
| Preview | Native private PDF/image/text handling; office documents may require user-initiated share to compatible app. Do not send records to online viewers |
| Share | Explicit user action and confirmation of patient/document; share sheet copies approved file. Explain exported copy is outside app cleanup control |
| Temporary files | No automatic public gallery/download saving; remove on logout/account switch, after use where safe, and startup cleanup; define bounded cleanup lifetime before implementation |
| Privacy | Private/no-store response caching, no secret in URL/log, no cloud backup of cached documents, no persisted clinical query cache |
| Missing/denied file | Handle 403/404 as unavailable/access denied, remove stale preview; never fallback to another patient's file |

Typical service errors: `DOCUMENT_REQUIRED`, `VALIDATION_ERROR`, `FILE_TOO_LARGE`, `INVALID_FILE_TYPE`, `DOCUMENT_FILE_NOT_FOUND`, ownership errors; multipart can also emit a 413-size rejection. Client handles both service and transport forms. Backend uses local readFile/toBuffer today; durable approved storage is a release prerequisite, not a Phase 0 change. Repository existence checks currently hide missing files before pagination; any replacement must make availability/count semantics explicit and preserve web compatibility.

Invoice/dental PDFs are browser-generated today. Native rendering/export must consume the same server-owned data and approved document layout; do not invent totals or a backend PDF API. Clinical PDF exports remain Phase 2. No file metadata or binary duplication in MongoDB is proposed.

## B6. Mutation retries and compatibility

Booking, rescheduling, dental decisions and uploads are not safely retried merely because refresh succeeded. If existing code lacks persistent idempotency, native disables automatic mutation retry and reconciles authoritative status after an ambiguous result. A future approved idempotency key must bind actor, operation and request payload, persist the authoritative result with domain mutation, reject key/payload reuse, and have documented expiry. Do not hold such state only in process memory.

New list routes are additive. Do not change the old dental array into a list envelope or add arbitrary status values to existing APIs. New native auth schemas live alongside web schemas; model validation is server-side. All contract changes require web regression checks even when no UI code changes.
