# HMS Ophthalmology OPD - Phase 2 Gap Note

**Date:** 15 October 2026  
**Phase:** 2 - Ophthalmology context, configuration, stations, workflow profiles, and permissions  
**Status:** COMPLETE - AWAITING PHASE 3 APPROVAL

## Approved scope

Phase 2 implements only the structural foundation approved by DEC-02, DEC-03, DEC-06, DEC-07, and DEC-12. It does not implement intake, alerts, test tasks/queues, result forms, doctor review, completion, publication, reports, or frontend screens from later phases.

## Existing functionality reused

- Authoritative OPD visit identity, patient, doctor, branch, department, visit type, status, and branch-scope resolution.
- Existing JWT authentication and database-backed `module/screen/action` permission middleware.
- Existing Branch, Department, User, Role, Permission, and Audit models.
- Existing MongoDB/Mongoose repository and transaction patterns, standard response envelope, Zod/Fastify schemas, pagination, and `SUPER_ADMIN` permission reconciliation.
- HMS Local OPD interaction patterns were inspected for future frontend compatibility; no prototype file will be modified and no frontend is in Phase 2.

## Confirmed gaps

1. No Ophthalmology specialty encounter context exists.
2. The global OPD visit type cannot represent Post-operative, Screening, or Procedure Review without breaking shared contracts.
3. No canonical laterality type or record-specific validator exists.
4. No branch-scoped/versioned Ophthalmology clinical configuration resource exists.
5. No station/device/membership or workflow-profile resource exists.
6. The approved Ophthalmology permission inventory is absent from the system seed.
7. No repository currently validates that an OPD visit belongs to an active clinical Ophthalmology department.
8. No exact Phase 2 request/response schemas, indexes, concurrency rules, or audit events exist.

## Frozen Phase 2 resource boundaries

### Ophthalmology context

- One active context per OPD visit.
- Server derives visit, patient, doctor, branch, and department references from the scoped OPD visit.
- Subtypes: `NEW_CONSULTATION | FOLLOW_UP | EMERGENCY | POST_OPERATIVE | SCREENING | PROCEDURE_REVIEW`.
- Context laterality: `OD | OS | OU | NOT_SPECIFIED`.
- Context activation validates an active clinical Ophthalmology department and shared visit-type compatibility. Existing `WALK_IN` remains an accepted arrival-channel value and is not inferred from subtype.
- Context binds an active branch-matching configuration version and an active branch/subtype workflow-profile version. Missing required bindings return `OPHTHALMOLOGY_CONFIGURATION_REQUIRED`.
- Create is idempotent for the same normalized contract; conflicting activation returns `409`.
- Patch requires `expected_version` and updates only subtype/laterality against a compare-and-set filter.

### Clinical configuration

- Generic branch-scoped versioned records own clinical/admin master structures: `SUB_SPECIALITY`, `COMPLAINT`, `TEST_CATALOGUE`, `VISUAL_ACUITY_SCALE`, `DIAGNOSIS_REFERENCE`, `DRUG_OPTION`, `OPTICAL_PRODUCT`, `IOL_CATALOGUE`, `CLINICAL_THRESHOLD`, `GRADE`, `REASON`, `FORM_PROFILE`, and `COMPLETION_PROFILE`.
- Station/device/membership and workflow sequencing are excluded from the generic payload because dedicated resources below own them.
- Records use `DRAFT | ACTIVE | INACTIVE`, semantic `revision`, optimistic `version`, effective dates, structured `values`, and immutable branch/type/code identity after creation.
- Only drafts may be edited. Activation prospectively deactivates the prior active revision for the same branch/type/code in a transaction. Deactivation requires a reason.
- No clinical threshold, mandatory test, unit, range, option, or default is seeded.

### Stations and devices

- Dedicated branch-scoped station records own code/name, supported test types, embedded device/calibration metadata, and explicit user memberships.
- Membership validation requires active users assigned to the same branch and active Ophthalmology department.
- Station mutations require expected version. Inactive stations cannot be used by later assignment flows.
- Real-time technician shifts remain deferred; active eligible membership is the Phase 2 authority source.

### Workflow profiles

- Dedicated branch/subtype/versioned profiles own ordered stages, parallel/sequential mode, test codes, and bypass flags.
- Profiles use `DRAFT | ACTIVE | INACTIVE`, revision and optimistic version.
- Only drafts may be edited; activation deactivates the prior active profile for the branch/subtype in one transaction.

### Permissions

- Seed the complete DEC-07 inventory under module `OPD`.
- Existing `SUPER_ADMIN` reconciliation receives the permissions.
- No other system role receives an automatic Ophthalmology grant.

## Intended files

- New `apps/api/src/modules/ophthalmology/` model, types, schemas, repository, service, routes, and focused tests.
- `apps/api/src/database/seed.ts` for permission definitions only.
- `apps/api/src/modules/index.ts` and shared service registry files for minimal registration.
- `HMS_OPHTHALMOLOGY_BACKEND_API_CONTRACT_V1.md` for exact Phase 2 contract refinement.
- Phase plan/matrix and Phase 2 verification documentation.

## Index and concurrency plan

- Unique context by `visitId`.
- Configuration unique by `branchId + type + code + revision`; at most one `ACTIVE` revision per `branchId + type + code`.
- Station unique by `branchId + code`; indexes for status/test types/member IDs.
- Workflow profile unique by `branchId + visitSubtype + revision`; at most one active profile per branch/subtype.
- All patch/status mutations use expected version and conditional repository updates; stale writes return `409`.
- Configuration/profile activation uses required transactions and fails with `503 TRANSACTION_CAPABILITY_REQUIRED` when atomicity is unavailable.

## Acceptance checks

- Wrong department, cross-branch, inactive binding, invalid subtype mapping, invalid laterality, unauthorized permission, duplicate activation, and stale version paths are rejected.
- Pagination and filters work for configuration, station, and workflow-profile lists.
- Audit records contain actor, branch, resource, previous/resulting state/version, and reason where applicable without clinical payloads.
- Permission seed grants are limited to existing `SUPER_ADMIN` reconciliation.
- General OPD/Dental contracts and Phase 1 tests remain green.

## Stop gate

Phase 3 must not start until Phase 2 implementation, focused tests, repository checks, contract update, and verification report are complete and the owner explicitly approves Phase 3.
