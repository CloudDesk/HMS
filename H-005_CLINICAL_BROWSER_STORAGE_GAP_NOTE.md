# H-005 Clinical Browser Storage Gap Note

## Storage mapping

| Legacy key | Clinical data | UI workflow | Authoritative backend after H-005 |
| --- | --- | --- | --- |
| `hms_inpatient_round_notes` | SOAP-style inpatient round notes | Ward rounds tab | Inpatient round-note API and MongoDB collection |
| `hms_inpatient_vitals` | Bedside observations and pain score | Vitals flowsheet tab | Inpatient vital API and MongoDB collection |
| `hms_inpatient_orders` | Lab, imaging, and mock medication rows | Orders tab | Existing inpatient clinical-order API for lab and imaging |

All reads and writes were in `InpatientWorkspacePage.tsx`; no other component shared these keys. No update or delete operation existed. The stored admission ID was client-controlled and the browser values had no authorization or audit boundary.

## Reuse and gaps

- Existing inpatient lab/imaging clinical-order routes, services, repositories, context validation, service-catalog validation, audit, and patient timeline events are reused.
- No appropriate inpatient round-note or bedside-vital resource existed. H-005 adds only admission-scoped create/list resources inside the existing inpatient-admissions domain, using its branch/department authorization and audit repository.
- The mock `MEDICATION` row was not connected to the existing structured prescription domain and has been removed from this diagnostic modal rather than persisted as a fake medication order. Existing inpatient prescription functionality is unchanged.
- Legacy browser values are deliberately not parsed or migrated because they are untrusted. The three exact keys are removed; unrelated preferences remain untouched.
