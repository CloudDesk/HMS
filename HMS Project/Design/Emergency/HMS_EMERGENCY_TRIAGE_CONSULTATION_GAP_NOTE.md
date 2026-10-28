# Emergency Triage-to-Consultation Gap Note

## Scope

This correction is limited to the Emergency Workspace **Complete Triage → Consultation** action.

## Reused implementation

- Emergency Workspace page, triage form, feature hook, domain hook, service, and API client.
- Existing `POST /api/emergency/encounters/:id/triage` contract.
- Existing Emergency lifecycle states and repository transition primitive.
- Existing branch authorization, permission middleware, MongoDB transaction, queue history, patient timeline, audit, and TanStack Query cache keys.
- HMS Local triage-to-consultation tab pattern.

## Observed gap

- The button submitted only the triage mutation.
- The backend persisted triage and transitioned the encounter to `WAITING_FOR_DOCTOR`.
- The frontend then changed only the visible tab to Consultation; it did not execute the existing `WAITING_FOR_DOCTOR -> IN_CONSULTATION` transition.
- Consequently the screen could look as though consultation had started while the persisted encounter and Emergency Queue remained in the doctor-waiting state.
- Frontend validation had no invalid-submit handler, so client validation failures could appear to be a non-responsive button.
- The triage route accepted only `Emergency / Triage / Assess`, even though the requested workflow also treats authorized Emergency doctors and encounter editors as permitted completers.

## Contract decision

The approved lifecycle remains unchanged. The completion request will execute these existing transitions in one MongoDB transaction:

```text
REGISTERED | WAITING_FOR_TRIAGE
  -> WAITING_FOR_DOCTOR  (TRIAGED; triage data persisted)
  -> IN_CONSULTATION     (CALLED; consultation workflow entered)
```

The route will use the existing any-of permission convention with:

- `Emergency / Triage / Assess`
- `Emergency / Consultation / Edit`
- `Emergency / Encounters / Edit`

Branch authorization remains authoritative in the Emergency service. Department-primary assignment is not used as an Emergency workflow denial.

## Intended files

- `apps/api/src/modules/emergency/emergency.routes.ts`
- `apps/api/src/modules/emergency/emergency.service.ts`
- `apps/api/test/emergency-triage-consultation.test.ts`
- `apps/web/src/hooks/emergency/useEmergency.ts`
- `apps/web/src/hooks/emergency/useEmergencyWorkspaceFeature.ts`
- `apps/web/src/components/emergency/EmergencyTriageSection.tsx`
- Existing Emergency frontend tests
- A focused verification note after checks

## Dependencies and boundaries

- No new status, permission, endpoint, model, repository, or subsystem is introduced.
- Existing uncommitted Emergency Queue/calling and role-permission work is preserved and is outside this correction.
- The referenced Release 2 FSD DOCX is not present in this checkout; the approved `HMS_SCOPE2_PHASE3_CONTRACT.md`, P3-4 verification, current implementation, and this explicit correction request control this scoped fix.
