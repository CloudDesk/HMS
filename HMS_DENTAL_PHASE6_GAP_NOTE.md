# Dental OPD Phase 6 gap note

Scope: clinical consistency only; Phases 1–5 are the existing working-tree baseline and must be preserved. The unrelated Scope 2 execution plan was reviewed. Its referenced Developer 1 prompt and Release 2 FSD are absent; this phase uses the explicit Dental Phase 6 request and existing contracts. No new lifecycle, permissions, collections, billing or scheduling is authorized.

## Audit and reuse

- Existing dental model/repository/routes, consultation assessment diagnosis serialization, OPD permission middleware and branch scope, service catalogue, currency formatter, dental components and scoped CSS are reused.
- Read the dental types/schema/model/repository/service/routes, registry, consultation schema/service/repository, OPD page and hooks, diagnosis component, all dental sections and utilities. HMS Local consultation delegates to opd-module.js/css; preserve its compact cards, tabs, summaries and confirmation patterns without editing prototypes.
- Existing working tree contains all Phase 2–5 dental files and shared integration changes. These are not Phase 6 creations.

## Verified gaps / intended changes

- Dental save serialization drops service_id and stable item IDs.
- Completion validates fallback arrays but writes submitted arrays; omitted fields default to empty arrays, risking data loss.
- Repository upsert does not condition on DRAFT, allowing a concurrent save to unlock a completed exam.
- Service IDs accept arbitrary strings and catalogue eligibility is not enforced server-side.
- Tooth diagnosis tags in assessment lack server FDI validation. Completed dental exams do not protect assessment changes through consultation writes.
- Dental form hydration can overwrite unsaved input; tab unmount discards it. Selected tooth context is not shared with diagnosis. Treatment examined-tooth selector excludes healthy/missing examined teeth.
- Intended files: dental backend schema/service/repository; consultation integration; dental tab and sections; OPD page/hooks; focused tests; dental CSS only; this gap note and verification report.

## Verification plan / boundary

Execute dental/OPD/role/scope suites and all six workspace checks. Attempt browser/API acceptance using available local runtime. Record exact limitations rather than claiming unexecuted checks. Phase 7 must not start.
