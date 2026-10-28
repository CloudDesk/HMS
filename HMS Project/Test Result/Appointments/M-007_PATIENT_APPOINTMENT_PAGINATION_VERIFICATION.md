# M-007 Patient Appointment Pagination Verification

## Implemented behavior

- `PatientPortalRepository.listAppointments` now performs combined appointment and standalone OPD history pagination in MongoDB.
- Appointment-linked OPD visits continue to enrich the appointment status/visit number without producing a duplicate history row.
- Scope, normalized status, patient identity, chronological ordering, total count, page, and limit semantics are preserved.
- Only the returned page is loaded for branch enrichment.
- Existing patient portal authorization remains authoritative and rejects requests for inaccessible patient IDs.

## MongoDB strategy

- Source-side `$match` stages scope appointment and OPD collections by `patientId` and `deletedAt`.
- `$lookup` retains linked OPD visit behavior for appointment rows.
- `$unionWith` adds normalized standalone OPD visits.
- MongoDB applies scope/status filtering and chronological `$sort`.
- `$facet` returns both `$count` metadata and the requested `$skip`/`$limit` page.

Existing indexes are sufficient:

- appointments: `{ patientId: 1, utcDateTime: -1, appointmentDate: -1 }`
- OPD visits: `{ patientId: 1, visitDate: -1 }`
- linked OPD lookup: unique partial `{ appointmentId: 1 }`

No index was added.

## Automated verification

- `npm test --workspace=@hms/api -- otp.test.ts patient-refresh-session.test.ts patient-appointment-pagination.test.ts`
  - Passed: 3 files, 32 tests.
- `npm run typecheck --workspace=@hms/api`
  - Passed.
- `npm run build --workspace=@hms/api`
  - Passed.
- `npx eslint apps/api/src/modules/patient-portal/patient-portal.repository.ts apps/api/src/modules/patient-portal/patient-appointment-pagination.test.ts`
  - Passed.

The known unrelated full-API lint findings were not changed or reworked in this M-007 iteration.
