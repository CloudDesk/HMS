# A. Mobile MVP Scope — Proposed for Approval

Scope uses dependency size and current API evidence, not an assumed product preference. **MVP** is the proposed first release; **Phase 2** means after MVP, not a commitment to build it; **Out of Scope** requires a separate clinical/product decision. The owner may move rows, with their dependencies.

Common dependency for every protected feature: C's native authentication and server authorization, plus the existing account/clinical rules. `P` means `/api/patient-portal`. Complete-history MVP rows depend on the read contracts in B; do not replace them with truncated overview arrays.

| Feature | Scope | Existing API | Backend change | Mobile work | Dependency/risk | Decision required |
|---|---|---|---|---|---|---|
| Existing patient/guardian login | MVP | `P/login/otp` returns web cookie session | Native adapter/lifecycle | Login, session restore/logout, expiry | Existing eligible account; unlinked adult follows current service behavior | Approve C |
| Fixed OTP request/verification | MVP | `P/otp/request`; existing verification service | No generator/provider change for configured environment | Phone/code screens, cooldown/errors | Challenge still required; shared web/mobile limits | `1234` and no delivery already specified |
| Signup/new guardian activation | Phase 2 | `P/signup`, `P/guardian-activation`, existing activation APIs | Native transport and approved identity/link policy | Registration/activation forms | Code does not prove phone possession; new account/grant decisions | Confirm existing-account-first MVP |
| Password login/recovery | Out of Scope | Generic auth routes; reset sender not implemented in inspected service | Separate scope if desired | None | OTP chosen; avoid adding recovery subsystem | Approve exclusion |
| Session list/revoke/logout-all | MVP | No native endpoints | C | Security/session screens | Lost device control; mobile-only logout-all scope | Approve scope label and lifetime |
| Profile view | MVP | `P/context`, `P/overview` | Optional narrow profile GET; not needed for parity | Personal/guardian details | Selected patient is not authority | Approve fields |
| Non-identity profile editing | MVP | `PATCH P/patients/:id` | Ensure native edits cannot change login phone through generic profile PATCH | Existing demographics/contact fields except login phone | Current backend can mutate login phone/revoke sessions on ordinary save; scoped correction required before edit rollout | Approve safe edit subset; view-only fallback |
| Login-phone change | Phase 2 | Unsafe generic edit exists, no dedicated flow | Purpose-bound change contract C | Separate security flow | Fixed code alone cannot prove new number ownership | Approve environment flow before inclusion |
| Existing family/dependents | MVP | `P/context` | Resolve explicit denied grant vs legacy SELF fallback consistently | Switch among accessible patients | Revoked/pending grants; minors currently under 15 | Approve C access precedence |
| Add/link dependent, add self | Phase 2 | `P/dependents`, `/dependents/link`, `/profile` | Approved proof/review, native registration integration | Forms after policy decision | MRN+DOB+declaration currently grants access | Approve deferment |
| Patient card | MVP | Profile/MRN in overview | None | In-app identity card | Not an authentication token; no implicit check-in QR | Approve display-only card |
| Home dashboard | MVP | `P/overview` | Correct count semantics or label bounded previews | Next appointment/recent data/shortcuts | Overview is bounded; do not claim full counts/history | Approve summary labels |
| Doctor directory | MVP | Public doctors + slots | None for existing fields | Search/filter, doctor summary, date slots | No rich doctor detail API | Approve directory-level details |
| Branch/department/service browsing | MVP | Public branch/department/service lists | None | Reuse for booking/catalogue | Displayed price is not a guaranteed invoice total | Approve catalogue parity |
| Appointment booking | MVP | `POST P/appointments` | Verify idempotent retry and conflict behavior | Guided patient/doctor/slot/reason/confirm | Server rechecks availability; no offline mutation queue | Approve booking scope |
| Appointment history | MVP | `GET P/appointments` paginated | Add optional filters only if needed | Upcoming/past pagination | Combined appointment and standalone OPD visit IDs | Approve history distinction |
| Appointment rescheduling | MVP | Eligibility + reschedule PATCH | Safe retries/stale-state acceptance | Eligibility, slots, confirm | Use server eligibility; do not copy timing rules | Approve parity |
| Appointment details | MVP | List has fields; no patient detail route | Patient-owned detail, distinguish OPD visit detail | Detail screen | Reload/deep-link cannot rely on list cache | Approve B detail contract |
| Prescriptions | MVP | Capped overview | Full paginated patient list/detail | Medication list/detail | Submitted/dispensed only; projection approval | Approve complete history and fields |
| Laboratory results | MVP | Capped verified overview | Paginated list/detail | Results/ranges/remarks | Verification versus independent release decision | Approve B visibility |
| Imaging results | MVP | Capped verified overview | Paginated list/detail | Findings/impression/recommendations | No patient attachment/PACS contract | Approve text report only |
| Medical documents | MVP | Paginated interface, upload/download | Bounded listing and retry/integrity acceptance | System picker, private preview/download/share | 10 MiB default; file durability, ownership | Approve existing MIME/category parity |
| Document deletion | Out of Scope | No portal delete route | New authorization/retention rule needed | No delete action | Staff delete capability is not patient permission | Separate approval |
| Billing/invoices/payments display | MVP | Invoice summary/detail/payment rows | Complete invoice list | Read-only totals/payments, invoice PDF adapter | Authoritative server amounts; no checkout | Approve read-only scope |
| Pharmacy purchase history | Phase 2 | Derived from 50 invoice summaries | Full purchase list/detail contract B | Purchase history | Not prescription adherence or dispensing evidence | Approve deferment |
| Dental quotation list/detail | MVP | Existing array/detail | Paginated portal list, grant consistency | Read-only quotation/options | Do not expose drafts; no patient-side totals | Approve read-only MVP |
| Dental accept/reject/postpone | Phase 2 | Existing action APIs | Audit atomic treatment activation/retries | Confirmed decisions | Can trigger clinical/billing side effects | Approve deferment |
| Lab/imaging/prescription report exports | Phase 2 | No patient export endpoints found | Approved rendered document contract | Save/share PDF | Do not substitute staff APIs | Approve deferment |
| In-app notification inbox | Phase 2 | Generic `/notifications/me` and read | Patient events/context/read semantics | Inbox | No patient-web inbox or event coverage | Approve no Inbox in MVP |
| Push notifications | Phase 2 | None | D's registration/delivery/events | Permissions/tap integration | Provider/signing/background work | Provider and scope decision |
| Online payments | Out of Scope | No patient checkout contract | Separate billing/provider project | None | Payment integrity/refunds/webhooks | Separate approval |
| Consultation history beyond appointment visits | Phase 2 | No patient consultation-detail projection | Approved clinical contract | Visit summary only after approval | Disclosure and data-source agreement | Clinical owner decision |
| Diagnosis | Out of Scope | No approved patient diagnosis projection found | Clinical disclosure contract | None now | Backend model presence is not disclosure approval | Clinical owner decision |
| Clinical notes | Out of Scope | Staff notes exist | Explicit patient-release/projection contract | None now | Do not expose raw staff/free-text notes | Clinical owner decision |
| Appointment cancellation | Phase 2 | No patient cancellation endpoint | Patient transition/reason/cutoff contract | Confirmation | Existing staff cancel not automatically reusable as patient route | Product/domain approval |
| Patient check-in | Out of Scope | No patient-owned check-in route | Operational identity/location/queue rules | None | Changes hospital attendance/queue state | Separate approval |
| Biometric unlock | Phase 2 | Native-only | None if only local secret unlock | Opt-in unlock/fallback | Does not authenticate server or verify phone | Approve later |
| Camera/gallery capture | Phase 2 | Existing file upload can receive allowed bytes | MIME normalization/content checks if needed | Native permission/picker | HEIC not in default allowlist | Approve later |
| Document scanning/OCR | Out of Scope | None | Separate scope if needed | None | OCR must not become clinical interpretation | Separate approval |
| Offline clinical records | Out of Scope | No offline synchronization contract | Retention/revocation/sync policy | No persisted record cache | Stale records and revoked access | Separate approval |
| Network-aware UI | MVP | Standard HTTP errors | Stable error handling | Offline/retry/resume states | Offline is not empty data or logout | Approve architecture default |
| External deep links/App Links | Phase 2 | Domain associations absent from reviewed mobile context | Owned link domain; detail routes | Allowlisted navigation | Internal navigation exists in MVP; no external token links | Approve deferment |
| Privacy/support/account deletion entry | MVP release prerequisite | No portal deletion workflow found | Owner-approved support/request process | Privacy/support entry | Store/retention decision independent of OTP delivery | Approve release policy |

MVP is conditional on its listed dependencies, not a claim that every existing API is release-ready. Removing notifications avoids a new delivery subsystem in the first release. Existing-account/family-first scope avoids inventing guardian proof. Read-only dental scope avoids introducing additional financial/clinical mutation risk. The owner can select a smaller MVP with clearly labelled recent-record previews, but that is an explicit scope change from complete history, not a hidden API shortcut.
