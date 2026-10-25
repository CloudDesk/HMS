# Ophthalmology workflow remediation

Scope: the six fixes requested on 23 October 2026 on DEV-OPHTHALMOLOGY-F-V2. Changes remain uncommitted. This is one authorized remediation batch, not approval to begin another release phase.

Sources: PROJECT_RULES.md, the Scope 2 Phase 3 execution plan and reconciled contract, the current ophthalmology API contract and existing implementation. The originally named developer prompt and Release2 FSD are absent; the reconciled contract explicitly permits the approved prompt as the controlling source. The current user request defines these additive fixes. HMS Local OPD styling and Emergency disposition patterns are reused without changing prototypes.

Reuse: versioned alert clearance, existing modal/form components, station task/result editors and real attachment uploads, admission request validation/timeline/audit, Emergency provenance index, surgery recommendation/booking models, and authoritative journey projections.

Gaps: frontend rejects CLEARED and lacks clearance; examination overview fabricates observations/capture; clearance does not create an admission request; Emergency retries conflict; operative eye is absent; routine prescriptions do not block settlement; web lint has 19 errors across multiple files.

Intended changes: ophthalmology API/types/model/repository/service/tests and frontend API/domain/feature hooks/components/tests; a transaction-aware admission request service entry point and registry wiring; scoped Emergency replay lookup; surgery DTO/schema/model/repository/service/modal and tests; minimal web lint fixes. Shared registry and admission/surgery/OPD integration changes will be listed in verification.

Contract dependency: billing has no EXEMPT status and prescriptions have no WAIVED status. Do not invent either or interpret cancellation as waiver. Pending user clarification, existing zero-balance and DISPENSED states remain authoritative.

Verification: focused API/UI integration and regression tests, both workspace typechecks/lints/builds, UI inspection where a live session is available, and final Git diff/status review. Record any unavailable live acceptance or unrelated failures precisely.
