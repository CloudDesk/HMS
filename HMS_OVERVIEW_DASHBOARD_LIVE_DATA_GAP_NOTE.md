# Overview Dashboard Live Data Gap Note

## Scope

Correct the existing executive Overview dashboard so every displayed metric and date-driven schedule uses branch-scoped backend data, and every visible action leads to an authorized working destination. This correction does not change operational lifecycle rules or introduce a new dashboard architecture.

## Existing functionality reused

- Administration dashboard Overview API, repository aggregation, RBAC, and branch authorization.
- Existing Patient, Doctor, Appointment, OPD Visit, and Billing models and indexes.
- TanStack Query feature hook, branch selector, chart range controls, dashboard tabs, and HMS Local dashboard visual patterns.

## Confirmed gaps

- The calendar filtered only the latest 20 visits already returned for the reports card. Selecting another week did not fetch authoritative data for that date.
- Scheduled appointments that had not become OPD visits were absent from the calendar.
- Converted appointments could be duplicated if appointments and visits were combined without checking the visit link.
- Waiting and in-consultation counters were not restricted to today's OPD activity.
- The Overview financial/flow card could target the hidden Billing tab for a Super Administrator.
- KPI and schedule cards exposed button semantics without keyboard activation.
- The Overview query parameters were cast rather than validated.

## Intended correction

- Validate branch, range, and selected schedule date with Zod.
- Return a bounded, branch-scoped selected-day schedule containing visits and unconverted appointments.
- Include the selected date in the TanStack Query key so calendar navigation fetches live backend data.
- Keep recent visits separate for the reports preview.
- Route financial, clinical-flow, reports, and schedule actions to available workspaces.
- Add focused repository and component tests.
