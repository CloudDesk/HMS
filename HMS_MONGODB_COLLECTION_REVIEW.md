# MongoDB collection review — 26 October 2026

Read-only inventory. Configured HMS database: HMS_GENERAL. Total: 504 collections across six accessible non-system databases. No collections deleted; no documents modified. Document contents were not exported.

Empty means no documents were found at inspection time. Not registered means no matching collection name among models loaded by the current HMS backend service registry, not proof of inactivity. Other deployments, jobs and applications may use these collections. This inspection does not establish last access/write time or approve deletion.

| Database | Collections | Confirmed empty | Empty and not registered by current HMS models |
|---|---:|---:|---:|
| HMS_GENERAL | 89 | 54 | 6 |
| HMS_INDIA | 80 | 18 | 3 |
| hms | 71 | 11 | 3 |
| productiondb | 130 | 91 | 41 |
| rte-paperless-dev | 61 | 22 | 22 |
| test | 73 | 6 | 6 |

## HMS_GENERAL: empty collections not registered by current HMS models

- ophthalmologyattachments
- ophthalmologyclinicalreviews
- ophthalmologyconsultationfinalizations
- ophthalmologydashboardsnapshots
- ophthalmologypublications
- ophthalmologystations

## HMS_INDIA: empty collections not registered by current HMS models

- check
- patientsequences
- registrationproofs

## hms: empty collections not registered by current HMS models

- check
- patientsequences
- registrationproofs

## productiondb: empty collections not registered by current HMS models

- approval_delegations
- approval_reassignments
- cells
- check
- collection
- dashboard_snapshots
- export_jobs
- idempotency_keys
- inspection_types
- job_work_orders
- locations
- maintenance_types
- material_categories
- pm_tasks
- processes
- production_lines
- production_machine_oil_readings
- production_shift_allocations
- production_tasks
- products
- quality_alerts
- quality_calibration_occurrences
- quality_calibration_plans
- quality_card_entries
- quality_cards
- quality_checklist_mappings
- quality_gauge_checklists
- quality_gauge_details
- quality_gauge_masters
- quality_gr_entries
- quality_inspection_calendar_entries
- quality_inspection_cases
- quality_register_book_entries
- quality_rejection_cases
- quality_store_action_triggers
- quality_temperature_readings
- quality_temperature_thresholds
- store_actions
- template_assignments
- user_shift_assignments
- workstations

## rte-paperless-dev: empty collections not registered by current HMS models

- approval_delegations
- approval_reassignments
- cells
- dashboard_snapshots
- idempotency_keys
- inspection_types
- job_work_orders
- locations
- maintenance_types
- material_categories
- pm_tasks
- processes
- production_lines
- production_machine_oil_readings
- production_shift_allocations
- production_tasks
- products
- quality_alerts
- quality_calibration_occurrences
- quality_calibration_plans
- quality_checklist_mappings
- quality_gauge_checklists

## test: empty collections not registered by current HMS models

- approval_delegations
- idempotency_keys
- pm_tasks
- production_machine_oil_readings
- production_tasks
- quality_register_book_entries

Before any removal, obtain the owning application/developer confirmation and preserve required schema/index definitions. Do not remove active HMS collections merely because they are empty. Review ophthalmology candidates with the owner of any separate ophthalmology deployment. The raw JSON inventory includes every collection and model-match status.

## Cross-branch correction: DEV-OPHTHALMOLOGY-F-V2

Inspected local branch and locally cached origin reference at commit a663aaf1.
All six ophthalmology collections previously listed as unreferenced in the
current checkout ARE used by this branch. Do not treat them as cleanup candidates.
No branch switch, checkout changes or database mutations were performed.

| Collection | Implemented usage |
|---|---|
| ophthalmologyattachments | Attachment creation/listing and patient-document access checks |
| ophthalmologyclinicalreviews | Clinical review creation, updates and amendment workflows |
| ophthalmologyconsultationfinalizations | Consultation completion and amendment lifecycle |
| ophthalmologydashboardsnapshots | Dashboard snapshot refresh and retrieval |
| ophthalmologypublications | Portal publication/withdrawal and patient-portal reads |
| ophthalmologystations | Station CRUD, membership and task access checks |

Evidence in that branch: apps/api/src/modules/ophthalmology/ophthalmology.repository.ts
(lines 459–484, 941–965, 1102–1228), ophthalmology-phase10.repository.ts
(lines 72–94, 139–186, 302–306), plus patient and patient-portal repositories.
The ophthalmology routes and services are registered in the branch's module and
service registries. This is code usage evidence, not measured runtime traffic.
Consequently all 54 previously empty HMS_GENERAL collections have code references
across the current checkout and this ophthalmology branch. No safe deletion list
has been established from this analysis.
