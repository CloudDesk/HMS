# HMS Ophthalmology — Deferred Issues and Architectural Decisions

Audit and implementation date: 22 October 2026. Branch: `DEV-OPHTHALMOLOGY-F-V2`.

## 1. Registration Warning Signs to Clinical Emergency Routing Contract

### Status
Partially Implemented & Documented.

### Context & Implementation Completed
- OPD visits checked in or registered at reception carry administrative fields: `priority: 'ROUTINE' | 'URGENT' | 'EMERGENCY'`, `visitType`, `reason` (complaint), and `notes`.
- In `OphthalmologyIntakeForm.tsx`, when `f.visit.priority === 'EMERGENCY' | 'URGENT'` or `visit_type === 'EMERGENCY'`, a dedicated Registration Warning Banner (`oph-registration-warning-banner`) is rendered in Section 5 (Emergency Screening).
- Initial intake form drafts pre-populate `other_urgent_condition_detail` with `f.visit.reason`.
- Authorised users (`canEscalate`) have an immediate 1-click trigger to escalate the emergency alert with attribution, blocking routine test booking and alerting on-duty ophthalmologists.

### Unresolved Decision / Missing Contract
- **Contract Boundary:** Patient registration at reception (`PatientRegistrationPage.tsx`) captures only demographics, identifiers, and emergency contacts. No structured clinical red-flag questionnaire exists at the administrative reception desk.
- **Decision Deferred:** Automatic conversion of administrative registration complaints into confirmed clinical emergency screening diagnoses or unattended emergency encounter conversion without clinician triage is deferred pending an approved FSD specification defining reception pre-triage criteria.

---

## 2. Emergency Clinical Clearance Workflow

### Status
Blocked / Fail-Closed.

### Context & Implementation Completed
- When an emergency alert is escalated (`POST /api/opd/visits/:visitId/ophthalmology/alerts/escalate`), the encounter is guarded by `requireEmergencyClearance`.
- Alert acknowledgment (`status: 'ACKNOWLEDGED'`) records clinical receipt only. In accordance with safety rules, acknowledgment does not clear routine care.

### Unresolved Decision / Missing Contract
- The FSD lacks an approved transition contract or actor definition for granting formal clinical clearance to resume routine OPD after an emergency escalation. The system remains fail-closed.

---

## 3. Inbound Urgent Encounter Provenance Linkage Contract (D2-36) & Emergency Clearance Contract (D2-34)

### Status
Resolved & Implemented (Verified with Automated Tests in `ophthalmology.phase9.test.ts`).

### Context & Implementation Completed
- Outbound Emergency referrals link to OPD appointments with strict branch, patient, and department validation.
- Active emergency encounters are protected against duplicate creation for the same patient via `EmergencyRepository.getActiveByPatient` and `EmergencyService.create` (`EMERGENCY_ACTIVE_EXISTS`).
- Task 1 (D2-34 / OPD-013): Implemented `POST /api/opd/visits/:id/ophthalmology/alerts/:alertId/clear` endpoint with RBAC guards (`OPD.Ophthalmology Emergency:Clear`, `OPD.Ophthalmology Consultation:Complete`, Attending Doctor). Extended alert status to `CLEARED` and added `clearance` subdocument (`cleared_by`, `cleared_at`, `disposition`, `clearance_rationale`, `resumption_permitted`). Refactored `requireEmergencyClearance` guard to unlock routine test task booking and consultation completion only when all emergency screening alerts are CLEARED with `resumption_permitted: true`.
- Task 2 (D2-36): Extended `CreateEmergencyDTO`, `createEmergencySchema`, `EmergencyEncounterModel`, and `EmergencyRepository` with `originatingSource` foreign keys (`sourceType`, `specialty`, `sourceAlertId`, `originatingVisitId`, `escalatedBy`, `escalatedAt`). Created partial unique compound index on `originatingSource.sourceAlertId` ensuring strict database-level idempotency and preventing duplicate emergency encounters on retries.