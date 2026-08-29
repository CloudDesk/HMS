# M-007 Patient Appointment Pagination Gap Note

## Reusable implementation

- The authenticated patient portal route validates `patient_id`, `scope`, `status`, `page`, and `limit`.
- `PatientPortalService.listAppointments` resolves the requested patient through the existing access-grant boundary before calling the repository.
- Appointment and OPD visit schemas already have patient/date indexes, and OPD visits have a unique partial index on `appointmentId`.
- The existing response mapping and page metadata contract can be retained.

## Confirmed gap

`PatientPortalRepository.listAppointments` independently loaded every non-deleted appointment and OPD visit for the patient, merged and filtered the full arrays in Node.js, sorted them, and finally called `slice()` for the requested page. Page one therefore consumed memory proportional to the patient's complete history.

## Intended change

Replace the two unbounded reads and JavaScript pagination with one MongoDB aggregation that:

1. scopes both sources to the patient and non-deleted records;
2. normalizes appointments and standalone OPD visits to the existing portal item shape;
3. preserves linked-visit status and de-duplication behavior;
4. applies status/scope filtering and chronological sorting in MongoDB; and
5. uses `$facet`, `$skip`, and `$limit` to return only the requested page and its total count.

Branch enrichment remains limited to branch IDs present on the returned page. No public API or authorization change is required.
