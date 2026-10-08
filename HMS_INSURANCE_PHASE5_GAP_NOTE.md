# Insurance Phase 5 gap note

Reuse insurance coverage/eligibility/benefit verification, Service, Patient, insurance membership, OPD visit, Doctor, PatientDocument, User/Role branch access, and AuditLog. Preserve uncommitted Phase 4 hotfix files. No UI requested.

No confirmed SHA preauthorization profile was found. Implement internal canonical statuses and an unavailable production adapter; deterministic mocks are dependency-injected in tests only. No invented SHA HTTP endpoint, payload, or external status mapping. Live submission remains blocked.

New files: insurance authorization schemas/model/repository/service/adapter/tests. Minimal shared changes: service registry and type, insurance routes, permission seed, execution-plan tracking. Embed lines/history to avoid partial records; transactionally write audit with lifecycle changes. Unique request fingerprint and version-conditional transitions prevent duplicate creation/submission. Optional encounter references initially support the existing OPD visit contract; other encounter sources need explicit integration contracts. No claims, payments, or financial liability calculation.
