# MongoDB collection inventory

Checked: 2026-10-27T05:24:23.462Z
Configured development database: HMS_GENERAL
Total visible user collections: 500

Counts are estimated metadata counts. EMPTY / HAS DATA describe stored data, not activity. A model-name match does not prove recent use. No model match does not prove a collection is unused; other apps or branches may own it. No collections were modified. System databases admin/config/local are excluded.

| Database | Collections | Empty | Has data | Count unavailable | HMS model name matches |
|---|---:|---:|---:|---:|---:|
| HMS_GENERAL | 91 | 53 | 38 | 0 | 90 |
| HMS_INDIA | 77 | 15 | 62 | 0 | 69 |
| hms | 68 | 8 | 60 | 0 | 61 |
| productiondb | 130 | 91 | 39 | 0 | 57 |
| rte-paperless-dev | 61 | 22 | 39 | 0 | 7 |
| test | 73 | 6 | 67 | 0 | 5 |

## HMS_GENERAL

| Collection | Estimated documents | Data state | Current HMS model |
|---|---:|---|---|
| administrationdashboardsnapshots | 1 | HAS DATA | MATCH |
| admissionpolicies | 0 | EMPTY | MATCH |
| admissionrequests | 1 | HAS DATA | MATCH |
| advancepayments | 0 | EMPTY | MATCH |
| appointments | 5 | HAS DATA | MATCH |
| auditlogs | 1246 | HAS DATA | MATCH |
| authratelimits | 0 | EMPTY | MATCH |
| bedassignmenthistories | 0 | EMPTY | MATCH |
| bedholds | 0 | EMPTY | MATCH |
| bedtransfers | 0 | EMPTY | MATCH |
| billing_invoice_items | 1 | HAS DATA | MATCH |
| billing_invoices | 1 | HAS DATA | MATCH |
| billing_payments | 0 | EMPTY | MATCH |
| branches | 3 | HAS DATA | MATCH |
| consenttemplates | 0 | EMPTY | MATCH |
| departments | 4 | HAS DATA | MATCH |
| dhamockclaimadjudications | 0 | EMPTY | MATCH |
| dhamockclaimappeals | 0 | EMPTY | MATCH |
| dhamockclaimclosures | 0 | EMPTY | MATCH |
| dhamockclaimdischarges | 0 | EMPTY | MATCH |
| dhamockclaimpreviews | 0 | EMPTY | MATCH |
| dhamockclaimqueries | 0 | EMPTY | MATCH |
| dhamockclaimsubmissions | 0 | EMPTY | MATCH |
| dhamockpaymentallocations | 0 | EMPTY | MATCH |
| dhamockpaymentreconciliations | 0 | EMPTY | MATCH |
| dhamockremittanceadvices | 0 | EMPTY | MATCH |
| doctoravailabilityexceptions | 0 | EMPTY | MATCH |
| doctorleaves | 0 | EMPTY | MATCH |
| doctors | 5 | HAS DATA | MATCH |
| doctorsequences | 1 | HAS DATA | MATCH |
| emergencyencounters | 0 | EMPTY | MATCH |
| guardianprofiles | 0 | EMPTY | MATCH |
| hmsbeds | 0 | EMPTY | MATCH |
| hmswards | 0 | EMPTY | MATCH |
| imaging_reports | 0 | EMPTY | MATCH |
| inpatientadmissions | 0 | EMPTY | MATCH |
| inpatientroundnotes | 0 | EMPTY | MATCH |
| inpatientvitals | 0 | EMPTY | MATCH |
| insuranceauthorizations | 0 | EMPTY | MATCH |
| insurancebenefitconfigs | 0 | EMPTY | MATCH |
| insuranceclaims | 0 | EMPTY | MATCH |
| insuranceeligibilityverifications | 0 | EMPTY | MATCH |
| insurancemembers | 0 | EMPTY | MATCH |
| insurancepolicies | 0 | EMPTY | MATCH |
| insuranceschemes | 0 | EMPTY | MATCH |
| laboratory_results | 0 | EMPTY | MATCH |
| medicines | 6 | HAS DATA | MATCH |
| mpesa_callback_events | 1 | HAS DATA | NO MATCH / REVIEW OWNER |
| notifications | 0 | EMPTY | MATCH |
| opdclinicalorders | 2 | HAS DATA | MATCH |
| opdconsultations | 5 | HAS DATA | MATCH |
| opdfollowups | 0 | EMPTY | MATCH |
| opdprescriptions | 1 | HAS DATA | MATCH |
| opdreferrals | 0 | EMPTY | MATCH |
| opdvisits | 7 | HAS DATA | MATCH |
| opdvitals | 3 | HAS DATA | MATCH |
| ophthalmologyattachments | 0 | EMPTY | MATCH |
| ophthalmologyclinicalreviews | 0 | EMPTY | MATCH |
| ophthalmologyconfigurations | 22 | HAS DATA | MATCH |
| ophthalmologyconsultationfinalizations | 0 | EMPTY | MATCH |
| ophthalmologycontexts | 5 | HAS DATA | MATCH |
| ophthalmologydashboardsnapshots | 0 | EMPTY | MATCH |
| ophthalmologyopticalprescriptions | 1 | HAS DATA | MATCH |
| ophthalmologypublications | 0 | EMPTY | MATCH |
| ophthalmologystations | 0 | EMPTY | MATCH |
| ophthalmologyworkflowprofiles | 21 | HAS DATA | MATCH |
| otpchallenges | 0 | EMPTY | MATCH |
| passwordresettokens | 0 | EMPTY | MATCH |
| patientaccessgrants | 1 | HAS DATA | MATCH |
| patientdocuments | 2 | HAS DATA | MATCH |
| patientnumbersequences | 0 | EMPTY | MATCH |
| patients | 6 | HAS DATA | MATCH |
| patienttimelineevents | 34 | HAS DATA | MATCH |
| payers | 0 | EMPTY | MATCH |
| permissioncategories | 3 | HAS DATA | MATCH |
| permissiongroups | 16 | HAS DATA | MATCH |
| permissions | 237 | HAS DATA | MATCH |
| pharmacy_medicine_batches | 6 | HAS DATA | MATCH |
| pharmacy_medicine_inventory | 6 | HAS DATA | MATCH |
| pharmacy_medicine_stock_movements | 0 | EMPTY | MATCH |
| pharmacydispensings | 0 | EMPTY | MATCH |
| procedurebookings | 1 | HAS DATA | MATCH |
| procedurerecommendations | 3 | HAS DATA | MATCH |
| refreshtokens | 679 | HAS DATA | MATCH |
| registrationtokens | 0 | EMPTY | MATCH |
| roles | 33 | HAS DATA | MATCH |
| sequences | 4 | HAS DATA | MATCH |
| services | 18 | HAS DATA | MATCH |
| shaservicemappings | 0 | EMPTY | MATCH |
| systemsettings | 1 | HAS DATA | MATCH |
| users | 14 | HAS DATA | MATCH |

## HMS_INDIA

| Collection | Estimated documents | Data state | Current HMS model |
|---|---:|---|---|
| administrationdashboardsnapshots | 1 | HAS DATA | MATCH |
| admissionpolicies | 1 | HAS DATA | MATCH |
| admissionrequests | 12 | HAS DATA | MATCH |
| advancepayments | 0 | EMPTY | MATCH |
| appointments | 106 | HAS DATA | MATCH |
| auditlogs | 11904 | HAS DATA | MATCH |
| authratelimits | 0 | EMPTY | MATCH |
| bedassignmenthistories | 17 | HAS DATA | MATCH |
| bedholds | 3 | HAS DATA | MATCH |
| bedtransfers | 1 | HAS DATA | MATCH |
| billing_invoice_items | 70 | HAS DATA | MATCH |
| billing_invoices | 38 | HAS DATA | MATCH |
| billing_payments | 16 | HAS DATA | MATCH |
| branches | 5 | HAS DATA | MATCH |
| consenttemplates | 6 | HAS DATA | MATCH |
| dental_prosthetic_lab_orders | 2 | HAS DATA | NO MATCH / REVIEW OWNER |
| dental_treatment_episodes | 5 | HAS DATA | NO MATCH / REVIEW OWNER |
| dental_treatment_quotations | 17 | HAS DATA | NO MATCH / REVIEW OWNER |
| dental_treatment_stages | 20 | HAS DATA | NO MATCH / REVIEW OWNER |
| dentalchairsideimages | 21 | HAS DATA | NO MATCH / REVIEW OWNER |
| departments | 27 | HAS DATA | MATCH |
| doctoravailabilityexceptions | 0 | EMPTY | MATCH |
| doctorleaves | 2 | HAS DATA | MATCH |
| doctors | 6 | HAS DATA | MATCH |
| doctorsequences | 1 | HAS DATA | MATCH |
| emergencyencounters | 21 | HAS DATA | MATCH |
| guardianprofiles | 2 | HAS DATA | MATCH |
| hmsbeds | 6 | HAS DATA | MATCH |
| hmswards | 4 | HAS DATA | MATCH |
| imaging_reports | 4 | HAS DATA | MATCH |
| inpatientadmissions | 9 | HAS DATA | MATCH |
| inpatientroundnotes | 0 | EMPTY | MATCH |
| inpatientvitals | 1 | HAS DATA | MATCH |
| insuranceauthorizations | 0 | EMPTY | MATCH |
| insurancebenefitconfigs | 0 | EMPTY | MATCH |
| insuranceeligibilityverifications | 0 | EMPTY | MATCH |
| insurancemembers | 0 | EMPTY | MATCH |
| insurancepolicies | 0 | EMPTY | MATCH |
| insuranceschemes | 0 | EMPTY | MATCH |
| laboratory_results | 3 | HAS DATA | MATCH |
| medicines | 8 | HAS DATA | MATCH |
| mobile_devices | 2 | HAS DATA | NO MATCH / REVIEW OWNER |
| notifications | 34 | HAS DATA | MATCH |
| opdclinicalorders | 45 | HAS DATA | MATCH |
| opdconsultations | 54 | HAS DATA | MATCH |
| opddentalexaminations | 16 | HAS DATA | NO MATCH / REVIEW OWNER |
| opdfollowups | 8 | HAS DATA | MATCH |
| opdprescriptions | 31 | HAS DATA | MATCH |
| opdreferrals | 11 | HAS DATA | MATCH |
| opdvisits | 70 | HAS DATA | MATCH |
| opdvitals | 51 | HAS DATA | MATCH |
| otpchallenges | 0 | EMPTY | MATCH |
| passwordresettokens | 0 | EMPTY | MATCH |
| patient_pre_consultations | 4 | HAS DATA | NO MATCH / REVIEW OWNER |
| patientaccessgrants | 15 | HAS DATA | MATCH |
| patientdocuments | 64 | HAS DATA | MATCH |
| patientnumbersequences | 1 | HAS DATA | MATCH |
| patients | 35 | HAS DATA | MATCH |
| patienttimelineevents | 726 | HAS DATA | MATCH |
| payers | 0 | EMPTY | MATCH |
| permissioncategories | 3 | HAS DATA | MATCH |
| permissiongroups | 16 | HAS DATA | MATCH |
| permissions | 231 | HAS DATA | MATCH |
| pharmacy_medicine_batches | 7 | HAS DATA | MATCH |
| pharmacy_medicine_inventory | 6 | HAS DATA | MATCH |
| pharmacy_medicine_stock_movements | 23 | HAS DATA | MATCH |
| pharmacydispensings | 23 | HAS DATA | MATCH |
| procedurebookings | 8 | HAS DATA | MATCH |
| procedurerecommendations | 12 | HAS DATA | MATCH |
| refreshtokens | 45 | HAS DATA | MATCH |
| registrationtokens | 0 | EMPTY | MATCH |
| roles | 22 | HAS DATA | MATCH |
| sequences | 11 | HAS DATA | MATCH |
| services | 50 | HAS DATA | MATCH |
| shaservicemappings | 0 | EMPTY | MATCH |
| systemsettings | 1 | HAS DATA | MATCH |
| users | 68 | HAS DATA | MATCH |

## hms

| Collection | Estimated documents | Data state | Current HMS model |
|---|---:|---|---|
| administrationdashboardsnapshots | 1 | HAS DATA | MATCH |
| admissionpolicies | 1 | HAS DATA | MATCH |
| admissionrequests | 12 | HAS DATA | MATCH |
| advancepayments | 0 | EMPTY | MATCH |
| appointments | 98 | HAS DATA | MATCH |
| auditlogs | 11409 | HAS DATA | MATCH |
| authratelimits | 0 | EMPTY | MATCH |
| bedassignmenthistories | 17 | HAS DATA | MATCH |
| bedholds | 3 | HAS DATA | MATCH |
| bedtransfers | 1 | HAS DATA | MATCH |
| billing_invoice_items | 67 | HAS DATA | MATCH |
| billing_invoices | 36 | HAS DATA | MATCH |
| billing_payments | 18 | HAS DATA | MATCH |
| branches | 5 | HAS DATA | MATCH |
| consenttemplates | 6 | HAS DATA | MATCH |
| dental_prosthetic_lab_orders | 2 | HAS DATA | NO MATCH / REVIEW OWNER |
| dental_treatment_episodes | 3 | HAS DATA | NO MATCH / REVIEW OWNER |
| dental_treatment_quotations | 12 | HAS DATA | NO MATCH / REVIEW OWNER |
| dental_treatment_stages | 17 | HAS DATA | NO MATCH / REVIEW OWNER |
| dentalchairsideimages | 18 | HAS DATA | NO MATCH / REVIEW OWNER |
| departments | 27 | HAS DATA | MATCH |
| doctoravailabilityexceptions | 0 | EMPTY | MATCH |
| doctorleaves | 2 | HAS DATA | MATCH |
| doctors | 6 | HAS DATA | MATCH |
| doctorsequences | 1 | HAS DATA | MATCH |
| emergencyencounters | 21 | HAS DATA | MATCH |
| guardianprofiles | 2 | HAS DATA | MATCH |
| hmsbeds | 6 | HAS DATA | MATCH |
| hmswards | 4 | HAS DATA | MATCH |
| imaging_reports | 2 | HAS DATA | MATCH |
| inpatientadmissions | 9 | HAS DATA | MATCH |
| inpatientroundnotes | 0 | EMPTY | MATCH |
| inpatientvitals | 1 | HAS DATA | MATCH |
| laboratory_results | 2 | HAS DATA | MATCH |
| medicines | 8 | HAS DATA | MATCH |
| notifications | 23 | HAS DATA | MATCH |
| opdclinicalorders | 43 | HAS DATA | MATCH |
| opdconsultations | 53 | HAS DATA | MATCH |
| opddentalexaminations | 14 | HAS DATA | NO MATCH / REVIEW OWNER |
| opdfollowups | 8 | HAS DATA | MATCH |
| opdprescriptions | 29 | HAS DATA | MATCH |
| opdreferrals | 11 | HAS DATA | MATCH |
| opdvisits | 69 | HAS DATA | MATCH |
| opdvitals | 51 | HAS DATA | MATCH |
| otpchallenges | 0 | EMPTY | MATCH |
| passwordresettokens | 0 | EMPTY | MATCH |
| patient_pre_consultations | 2 | HAS DATA | NO MATCH / REVIEW OWNER |
| patientaccessgrants | 11 | HAS DATA | MATCH |
| patientdocuments | 60 | HAS DATA | MATCH |
| patientnumbersequences | 1 | HAS DATA | MATCH |
| patients | 31 | HAS DATA | MATCH |
| patienttimelineevents | 691 | HAS DATA | MATCH |
| permissioncategories | 3 | HAS DATA | MATCH |
| permissiongroups | 15 | HAS DATA | MATCH |
| permissions | 180 | HAS DATA | MATCH |
| pharmacy_medicine_batches | 7 | HAS DATA | MATCH |
| pharmacy_medicine_inventory | 6 | HAS DATA | MATCH |
| pharmacy_medicine_stock_movements | 21 | HAS DATA | MATCH |
| pharmacydispensings | 22 | HAS DATA | MATCH |
| procedurebookings | 8 | HAS DATA | MATCH |
| procedurerecommendations | 12 | HAS DATA | MATCH |
| refreshtokens | 0 | EMPTY | MATCH |
| registrationtokens | 0 | EMPTY | MATCH |
| roles | 22 | HAS DATA | MATCH |
| sequences | 11 | HAS DATA | MATCH |
| services | 50 | HAS DATA | MATCH |
| systemsettings | 1 | HAS DATA | MATCH |
| users | 64 | HAS DATA | MATCH |

## productiondb

| Collection | Estimated documents | Data state | Current HMS model |
|---|---:|---|---|
| administrationdashboardsnapshots | 0 | EMPTY | MATCH |
| admissionpolicies | 0 | EMPTY | MATCH |
| admissionrequests | 0 | EMPTY | MATCH |
| advancepayments | 0 | EMPTY | MATCH |
| appointments | 0 | EMPTY | MATCH |
| approval_action_history | 126 | HAS DATA | NO MATCH / REVIEW OWNER |
| approval_delegations | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| approval_reassignments | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| approval_tasks | 64 | HAS DATA | NO MATCH / REVIEW OWNER |
| areas | 3 | HAS DATA | NO MATCH / REVIEW OWNER |
| audit_logs | 829 | HAS DATA | NO MATCH / REVIEW OWNER |
| auditlogs | 0 | EMPTY | MATCH |
| bedassignmenthistories | 0 | EMPTY | MATCH |
| bedholds | 0 | EMPTY | MATCH |
| bedtransfers | 0 | EMPTY | MATCH |
| billing_invoice_items | 0 | EMPTY | MATCH |
| billing_invoices | 0 | EMPTY | MATCH |
| billing_payments | 0 | EMPTY | MATCH |
| branches | 0 | EMPTY | MATCH |
| cells | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| check | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| collection | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| consenttemplates | 0 | EMPTY | MATCH |
| dashboard_snapshots | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| departments | 8 | HAS DATA | MATCH |
| doctoravailabilityexceptions | 0 | EMPTY | MATCH |
| doctorleaves | 0 | EMPTY | MATCH |
| doctors | 0 | EMPTY | MATCH |
| doctorsequences | 0 | EMPTY | MATCH |
| emergencyencounters | 0 | EMPTY | MATCH |
| export_jobs | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| gauge_types | 50 | HAS DATA | NO MATCH / REVIEW OWNER |
| guardianprofiles | 0 | EMPTY | MATCH |
| hmsbeds | 0 | EMPTY | MATCH |
| hmswards | 0 | EMPTY | MATCH |
| idempotency_keys | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| imaging_reports | 0 | EMPTY | MATCH |
| inpatientadmissions | 0 | EMPTY | MATCH |
| inspection_types | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| job_work_orders | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| laboratory_results | 0 | EMPTY | MATCH |
| locations | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| machines | 3 | HAS DATA | NO MATCH / REVIEW OWNER |
| maintenance_types | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| material_categories | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| medicines | 0 | EMPTY | MATCH |
| notification_delivery_attempts | 770 | HAS DATA | NO MATCH / REVIEW OWNER |
| notification_events | 293 | HAS DATA | NO MATCH / REVIEW OWNER |
| notifications | 385 | HAS DATA | MATCH |
| opdclinicalorders | 0 | EMPTY | MATCH |
| opdconsultations | 0 | EMPTY | MATCH |
| opdfollowups | 0 | EMPTY | MATCH |
| opdprescriptions | 0 | EMPTY | MATCH |
| opdreferrals | 0 | EMPTY | MATCH |
| opdvisits | 0 | EMPTY | MATCH |
| opdvitals | 0 | EMPTY | MATCH |
| otpchallenges | 0 | EMPTY | MATCH |
| passwordresettokens | 0 | EMPTY | MATCH |
| patientaccessgrants | 0 | EMPTY | MATCH |
| patientdocuments | 0 | EMPTY | MATCH |
| patientnumbersequences | 0 | EMPTY | MATCH |
| patients | 0 | EMPTY | MATCH |
| patienttimelineevents | 0 | EMPTY | MATCH |
| permissioncategories | 3 | HAS DATA | MATCH |
| permissiongroups | 13 | HAS DATA | MATCH |
| permissions | 191 | HAS DATA | MATCH |
| pharmacy_medicine_batches | 0 | EMPTY | MATCH |
| pharmacy_medicine_inventory | 0 | EMPTY | MATCH |
| pharmacy_medicine_stock_movements | 0 | EMPTY | MATCH |
| pharmacydispensings | 0 | EMPTY | MATCH |
| pm_tasks | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| procedurebookings | 0 | EMPTY | MATCH |
| procedurerecommendations | 0 | EMPTY | MATCH |
| processes | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| production_custom_form_submissions | 4 | HAS DATA | NO MATCH / REVIEW OWNER |
| production_custom_form_versions | 6 | HAS DATA | NO MATCH / REVIEW OWNER |
| production_custom_forms | 3 | HAS DATA | NO MATCH / REVIEW OWNER |
| production_lines | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| production_machine_oil_readings | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| production_shift_allocations | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| production_tasks | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| products | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| quality_alerts | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| quality_calibration_occurrences | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| quality_calibration_plans | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| quality_card_entries | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| quality_cards | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| quality_checklist_mappings | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| quality_gauge_checklists | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| quality_gauge_details | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| quality_gauge_masters | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| quality_gr_entries | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| quality_inspection_calendar_entries | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| quality_inspection_cases | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| quality_register_book_entries | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| quality_rejection_cases | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| quality_store_action_triggers | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| quality_temperature_readings | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| quality_temperature_thresholds | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| record_attachments | 6 | HAS DATA | NO MATCH / REVIEW OWNER |
| record_history | 164 | HAS DATA | NO MATCH / REVIEW OWNER |
| record_pdf_artifacts | 1 | HAS DATA | NO MATCH / REVIEW OWNER |
| records | 57 | HAS DATA | NO MATCH / REVIEW OWNER |
| refreshtokens | 0 | EMPTY | MATCH |
| role_permissions | 561 | HAS DATA | NO MATCH / REVIEW OWNER |
| roles | 14 | HAS DATA | MATCH |
| sequences | 0 | EMPTY | MATCH |
| services | 0 | EMPTY | MATCH |
| sessions | 341 | HAS DATA | NO MATCH / REVIEW OWNER |
| shifts | 3 | HAS DATA | NO MATCH / REVIEW OWNER |
| store_actions | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| systemsettings | 0 | EMPTY | MATCH |
| tdo_design_requests | 35 | HAS DATA | NO MATCH / REVIEW OWNER |
| tdo_drawing_revisions | 22 | HAS DATA | NO MATCH / REVIEW OWNER |
| tdo_drawings | 29 | HAS DATA | NO MATCH / REVIEW OWNER |
| tdo_print_requests | 2 | HAS DATA | NO MATCH / REVIEW OWNER |
| tdo_tool_sequence_counters | 13 | HAS DATA | NO MATCH / REVIEW OWNER |
| template_assignments | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| template_versions | 34 | HAS DATA | NO MATCH / REVIEW OWNER |
| templates | 22 | HAS DATA | NO MATCH / REVIEW OWNER |
| user_departments | 19 | HAS DATA | NO MATCH / REVIEW OWNER |
| user_requesting_engineers | 8 | HAS DATA | NO MATCH / REVIEW OWNER |
| user_roles | 19 | HAS DATA | NO MATCH / REVIEW OWNER |
| user_shift_assignments | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| users | 19 | HAS DATA | MATCH |
| workflow_assignments | 2 | HAS DATA | NO MATCH / REVIEW OWNER |
| workflow_execution_states | 15 | HAS DATA | NO MATCH / REVIEW OWNER |
| workflow_versions | 17 | HAS DATA | NO MATCH / REVIEW OWNER |
| workflows | 14 | HAS DATA | NO MATCH / REVIEW OWNER |
| workstations | 0 | EMPTY | NO MATCH / REVIEW OWNER |

## rte-paperless-dev

| Collection | Estimated documents | Data state | Current HMS model |
|---|---:|---|---|
| approval_action_history | 126 | HAS DATA | NO MATCH / REVIEW OWNER |
| approval_delegations | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| approval_reassignments | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| approval_tasks | 64 | HAS DATA | NO MATCH / REVIEW OWNER |
| areas | 3 | HAS DATA | NO MATCH / REVIEW OWNER |
| audit_logs | 807 | HAS DATA | NO MATCH / REVIEW OWNER |
| cells | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| dashboard_snapshots | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| departments | 9 | HAS DATA | MATCH |
| gauge_types | 50 | HAS DATA | NO MATCH / REVIEW OWNER |
| idempotency_keys | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| inspection_types | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| job_work_orders | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| locations | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| machines | 3 | HAS DATA | NO MATCH / REVIEW OWNER |
| maintenance_types | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| material_categories | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| notification_delivery_attempts | 764 | HAS DATA | NO MATCH / REVIEW OWNER |
| notification_events | 290 | HAS DATA | NO MATCH / REVIEW OWNER |
| notifications | 382 | HAS DATA | MATCH |
| permissioncategories | 3 | HAS DATA | MATCH |
| permissiongroups | 13 | HAS DATA | MATCH |
| permissions | 190 | HAS DATA | MATCH |
| pm_tasks | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| processes | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| production_custom_form_submissions | 4 | HAS DATA | NO MATCH / REVIEW OWNER |
| production_custom_form_versions | 6 | HAS DATA | NO MATCH / REVIEW OWNER |
| production_custom_forms | 3 | HAS DATA | NO MATCH / REVIEW OWNER |
| production_lines | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| production_machine_oil_readings | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| production_shift_allocations | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| production_tasks | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| products | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| quality_alerts | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| quality_calibration_occurrences | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| quality_calibration_plans | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| quality_checklist_mappings | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| quality_gauge_checklists | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| record_attachments | 6 | HAS DATA | NO MATCH / REVIEW OWNER |
| record_history | 154 | HAS DATA | NO MATCH / REVIEW OWNER |
| record_pdf_artifacts | 1 | HAS DATA | NO MATCH / REVIEW OWNER |
| records | 53 | HAS DATA | NO MATCH / REVIEW OWNER |
| role_permissions | 560 | HAS DATA | NO MATCH / REVIEW OWNER |
| roles | 14 | HAS DATA | MATCH |
| sessions | 343 | HAS DATA | NO MATCH / REVIEW OWNER |
| shifts | 3 | HAS DATA | NO MATCH / REVIEW OWNER |
| tdo_design_requests | 31 | HAS DATA | NO MATCH / REVIEW OWNER |
| tdo_drawing_revisions | 21 | HAS DATA | NO MATCH / REVIEW OWNER |
| tdo_drawings | 22 | HAS DATA | NO MATCH / REVIEW OWNER |
| tdo_print_requests | 2 | HAS DATA | NO MATCH / REVIEW OWNER |
| tdo_tool_sequence_counters | 13 | HAS DATA | NO MATCH / REVIEW OWNER |
| template_versions | 34 | HAS DATA | NO MATCH / REVIEW OWNER |
| templates | 22 | HAS DATA | NO MATCH / REVIEW OWNER |
| user_departments | 19 | HAS DATA | NO MATCH / REVIEW OWNER |
| user_requesting_engineers | 8 | HAS DATA | NO MATCH / REVIEW OWNER |
| user_roles | 19 | HAS DATA | NO MATCH / REVIEW OWNER |
| users | 19 | HAS DATA | MATCH |
| workflow_assignments | 2 | HAS DATA | NO MATCH / REVIEW OWNER |
| workflow_execution_states | 15 | HAS DATA | NO MATCH / REVIEW OWNER |
| workflow_versions | 17 | HAS DATA | NO MATCH / REVIEW OWNER |
| workflows | 14 | HAS DATA | NO MATCH / REVIEW OWNER |

## test

| Collection | Estimated documents | Data state | Current HMS model |
|---|---:|---|---|
| approval_action_history | 219 | HAS DATA | NO MATCH / REVIEW OWNER |
| approval_delegations | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| approval_reassignments | 1 | HAS DATA | NO MATCH / REVIEW OWNER |
| approval_tasks | 116 | HAS DATA | NO MATCH / REVIEW OWNER |
| areas | 3 | HAS DATA | NO MATCH / REVIEW OWNER |
| audit_logs | 2980 | HAS DATA | NO MATCH / REVIEW OWNER |
| cells | 4 | HAS DATA | NO MATCH / REVIEW OWNER |
| dashboard_snapshots | 1 | HAS DATA | NO MATCH / REVIEW OWNER |
| departments | 9 | HAS DATA | MATCH |
| export_jobs | 5 | HAS DATA | NO MATCH / REVIEW OWNER |
| gauge_types | 17 | HAS DATA | NO MATCH / REVIEW OWNER |
| idempotency_keys | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| inspection_types | 10 | HAS DATA | NO MATCH / REVIEW OWNER |
| job_work_orders | 12 | HAS DATA | NO MATCH / REVIEW OWNER |
| locations | 10 | HAS DATA | NO MATCH / REVIEW OWNER |
| machines | 20 | HAS DATA | NO MATCH / REVIEW OWNER |
| maintenance_types | 8 | HAS DATA | NO MATCH / REVIEW OWNER |
| material_categories | 6 | HAS DATA | NO MATCH / REVIEW OWNER |
| notification_delivery_attempts | 1044 | HAS DATA | NO MATCH / REVIEW OWNER |
| notification_events | 391 | HAS DATA | NO MATCH / REVIEW OWNER |
| notifications | 540 | HAS DATA | MATCH |
| permissions | 183 | HAS DATA | MATCH |
| pm_tasks | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| processes | 6 | HAS DATA | NO MATCH / REVIEW OWNER |
| production_lines | 2 | HAS DATA | NO MATCH / REVIEW OWNER |
| production_machine_oil_readings | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| production_shift_allocations | 77 | HAS DATA | NO MATCH / REVIEW OWNER |
| production_tasks | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| products | 13 | HAS DATA | NO MATCH / REVIEW OWNER |
| quality_alerts | 16 | HAS DATA | NO MATCH / REVIEW OWNER |
| quality_calibration_occurrences | 12 | HAS DATA | NO MATCH / REVIEW OWNER |
| quality_calibration_plans | 11 | HAS DATA | NO MATCH / REVIEW OWNER |
| quality_card_entries | 6 | HAS DATA | NO MATCH / REVIEW OWNER |
| quality_cards | 6 | HAS DATA | NO MATCH / REVIEW OWNER |
| quality_checklist_mappings | 1 | HAS DATA | NO MATCH / REVIEW OWNER |
| quality_gauge_checklists | 2 | HAS DATA | NO MATCH / REVIEW OWNER |
| quality_gauge_details | 1 | HAS DATA | NO MATCH / REVIEW OWNER |
| quality_gauge_masters | 3 | HAS DATA | NO MATCH / REVIEW OWNER |
| quality_gr_entries | 11 | HAS DATA | NO MATCH / REVIEW OWNER |
| quality_inspection_calendar_entries | 3 | HAS DATA | NO MATCH / REVIEW OWNER |
| quality_inspection_cases | 3 | HAS DATA | NO MATCH / REVIEW OWNER |
| quality_register_book_entries | 0 | EMPTY | NO MATCH / REVIEW OWNER |
| quality_rejection_cases | 3 | HAS DATA | NO MATCH / REVIEW OWNER |
| quality_store_action_triggers | 1 | HAS DATA | NO MATCH / REVIEW OWNER |
| quality_temperature_readings | 15 | HAS DATA | NO MATCH / REVIEW OWNER |
| quality_temperature_thresholds | 6 | HAS DATA | NO MATCH / REVIEW OWNER |
| record_attachments | 20 | HAS DATA | NO MATCH / REVIEW OWNER |
| record_history | 417 | HAS DATA | NO MATCH / REVIEW OWNER |
| record_pdf_artifacts | 1 | HAS DATA | NO MATCH / REVIEW OWNER |
| records | 115 | HAS DATA | NO MATCH / REVIEW OWNER |
| role_permissions | 1965 | HAS DATA | NO MATCH / REVIEW OWNER |
| roles | 52 | HAS DATA | MATCH |
| sessions | 1086 | HAS DATA | NO MATCH / REVIEW OWNER |
| shifts | 3 | HAS DATA | NO MATCH / REVIEW OWNER |
| store_actions | 1 | HAS DATA | NO MATCH / REVIEW OWNER |
| tdo_design_requests | 83 | HAS DATA | NO MATCH / REVIEW OWNER |
| tdo_drawing_revisions | 53 | HAS DATA | NO MATCH / REVIEW OWNER |
| tdo_drawings | 62 | HAS DATA | NO MATCH / REVIEW OWNER |
| tdo_print_requests | 13 | HAS DATA | NO MATCH / REVIEW OWNER |
| tdo_tool_sequence_counters | 7 | HAS DATA | NO MATCH / REVIEW OWNER |
| template_assignments | 11 | HAS DATA | NO MATCH / REVIEW OWNER |
| template_versions | 40 | HAS DATA | NO MATCH / REVIEW OWNER |
| templates | 22 | HAS DATA | NO MATCH / REVIEW OWNER |
| user_departments | 154 | HAS DATA | NO MATCH / REVIEW OWNER |
| user_requesting_engineers | 9 | HAS DATA | NO MATCH / REVIEW OWNER |
| user_roles | 154 | HAS DATA | NO MATCH / REVIEW OWNER |
| user_shift_assignments | 72 | HAS DATA | NO MATCH / REVIEW OWNER |
| users | 154 | HAS DATA | MATCH |
| workflow_assignments | 14 | HAS DATA | NO MATCH / REVIEW OWNER |
| workflow_execution_states | 61 | HAS DATA | NO MATCH / REVIEW OWNER |
| workflow_versions | 19 | HAS DATA | NO MATCH / REVIEW OWNER |
| workflows | 13 | HAS DATA | NO MATCH / REVIEW OWNER |
| workstations | 20 | HAS DATA | NO MATCH / REVIEW OWNER |
