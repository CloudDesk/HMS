# HMS_GENERAL empty-collection code usage review

Read-only code analysis. Emptiness comes from the earlier 26 October 2026 database snapshot; no runtime access frequency is inferred. No MongoDB connection or changes were made during this analysis.

| Collection | Model | Non-test backend references |
|---|---|---|
| admissionpolicies | AdmissionPolicyModel (`apps/api/src/modules/admissions-configuration/admissions-configuration.model.ts`) | apps/api/src/modules/administration-dashboard/phase-two-report.repository.ts; apps/api/src/modules/admissions-configuration/admissions-configuration.repository.ts |
| advancepayments | AdvancePaymentModel (`apps/api/src/modules/advance-payment/advance-payment.model.ts`) | apps/api/src/modules/advance-payment/advance-payment.repository.ts |
| authratelimits | AuthRateLimitModel (`apps/api/src/modules/auth/auth-rate-limit.model.ts`) | apps/api/src/modules/auth/auth-rate-limit.repository.ts |
| bedassignmenthistories | BedAssignmentHistoryModel (`apps/api/src/modules/admissions-configuration/admissions-configuration.model.ts`) | apps/api/src/modules/admissions-configuration/admissions-configuration.repository.ts |
| bedholds | BedHoldModel (`apps/api/src/modules/admissions-configuration/admissions-configuration.model.ts`) | apps/api/src/modules/admissions-configuration/admissions-configuration.repository.ts; apps/api/src/modules/surgery/surgery.repository.ts |
| bedtransfers | BedTransferModel (`apps/api/src/modules/admissions-configuration/admissions-configuration.model.ts`) | apps/api/src/modules/admissions-configuration/admissions-configuration.repository.ts |
| billing_payments | BillingPaymentModel (`apps/api/src/modules/billing/billing.model.ts`) | apps/api/src/modules/billing/billing.repository.ts; apps/api/src/modules/patient-portal/patient-portal.repository.ts |
| consenttemplates | ConsentTemplateModel (`apps/api/src/modules/consents/consent.model.ts`) | apps/api/src/modules/consents/consent.repository.ts |
| dhamockclaimadjudications | DhaMockClaimAdjudicationModel (`apps/api/src/modules/insurance/dha/dha-claim-adjudication.model.ts`) | apps/api/src/modules/insurance/dha/dha-claim-adjudication.service.ts; apps/api/src/modules/insurance/dha/dha-claim-appeal.service.ts; apps/api/src/modules/insurance/dha/dha-claim-closure.service.ts; apps/api/src/modules/insurance/dha/dha-claim-query.service.ts; apps/api/src/modules/insurance/dha/dha-claim-reporting.service.ts; apps/api/src/modules/insurance/dha/dha-remittance-advice.service.ts |
| dhamockclaimappeals | DhaMockClaimAppealModel (`apps/api/src/modules/insurance/dha/dha-claim-appeal.model.ts`) | apps/api/src/modules/insurance/dha/dha-claim-appeal.service.ts; apps/api/src/modules/insurance/dha/dha-claim-closure.service.ts; apps/api/src/modules/insurance/dha/dha-claim-reporting.service.ts; apps/api/src/modules/insurance/dha/dha-remittance-advice.service.ts |
| dhamockclaimclosures | DhaMockClaimClosureModel (`apps/api/src/modules/insurance/dha/dha-claim-closure.model.ts`) | apps/api/src/modules/insurance/dha/dha-claim-closure.service.ts; apps/api/src/modules/insurance/dha/dha-claim-reporting.service.ts |
| dhamockclaimdischarges | DhaMockClaimDischargeModel (`apps/api/src/modules/insurance/dha/dha-claim-discharge.model.ts`) | apps/api/src/modules/insurance/dha/dha-claim-adjudication.service.ts; apps/api/src/modules/insurance/dha/dha-claim-appeal.service.ts; apps/api/src/modules/insurance/dha/dha-claim-closure.service.ts; apps/api/src/modules/insurance/dha/dha-claim-discharge.service.ts; apps/api/src/modules/insurance/dha/dha-claim-query.service.ts; apps/api/src/modules/insurance/dha/dha-claim-reporting.service.ts; apps/api/src/modules/insurance/dha/dha-remittance-advice.service.ts |
| dhamockclaimpreviews | DhaMockClaimPreviewModel (`apps/api/src/modules/insurance/dha/dha-claim-preview.model.ts`) | apps/api/src/modules/insurance/dha/dha-claim-discharge.service.ts; apps/api/src/modules/insurance/dha/dha-claim-preview.service.ts; apps/api/src/modules/insurance/dha/dha-claim-reporting.service.ts |
| dhamockclaimqueries | DhaMockClaimQueryModel (`apps/api/src/modules/insurance/dha/dha-claim-query.model.ts`) | apps/api/src/modules/insurance/dha/dha-claim-appeal.service.ts; apps/api/src/modules/insurance/dha/dha-claim-closure.service.ts; apps/api/src/modules/insurance/dha/dha-claim-query.service.ts; apps/api/src/modules/insurance/dha/dha-claim-reporting.service.ts; apps/api/src/modules/insurance/dha/dha-remittance-advice.service.ts |
| dhamockclaimsubmissions | DhaMockClaimSubmissionModel (`apps/api/src/modules/insurance/dha/dha-claim-submission.model.ts`) | apps/api/src/modules/insurance/dha/dha-claim-discharge.service.ts; apps/api/src/modules/insurance/dha/dha-claim-preview.service.ts; apps/api/src/modules/insurance/dha/dha-claim-reporting.service.ts; apps/api/src/modules/insurance/dha/dha-claim-submission.service.ts |
| dhamockpaymentallocations | DhaMockPaymentAllocationModel (`apps/api/src/modules/insurance/dha/dha-payment-allocation.model.ts`) | apps/api/src/modules/insurance/dha/dha-claim-reporting.service.ts; apps/api/src/modules/insurance/dha/dha-payment-allocation.service.ts; apps/api/src/modules/insurance/dha/dha-payment-reconciliation.service.ts |
| dhamockpaymentreconciliations | DhaMockPaymentReconciliationModel (`apps/api/src/modules/insurance/dha/dha-payment-reconciliation.model.ts`) | apps/api/src/modules/insurance/dha/dha-claim-closure.service.ts; apps/api/src/modules/insurance/dha/dha-claim-reporting.service.ts; apps/api/src/modules/insurance/dha/dha-payment-reconciliation.service.ts |
| dhamockremittanceadvices | DhaMockRemittanceAdviceModel (`apps/api/src/modules/insurance/dha/dha-remittance-advice.model.ts`) | apps/api/src/modules/insurance/dha/dha-claim-closure.service.ts; apps/api/src/modules/insurance/dha/dha-claim-reporting.service.ts; apps/api/src/modules/insurance/dha/dha-payment-allocation.service.ts; apps/api/src/modules/insurance/dha/dha-payment-reconciliation.service.ts; apps/api/src/modules/insurance/dha/dha-remittance-advice.service.ts |
| doctoravailabilityexceptions | DoctorAvailabilityExceptionModel (`apps/api/src/modules/doctors/doctor-scheduling.model.ts`) | apps/api/src/modules/doctors/doctor.repository.ts |
| doctorleaves | DoctorLeaveModel (`apps/api/src/modules/doctors/doctor-scheduling.model.ts`) | apps/api/src/modules/doctors/doctor.repository.ts |
| emergencyencounters | EmergencyEncounterModel (`apps/api/src/modules/emergency/emergency.model.ts`) | apps/api/src/modules/administration-dashboard/phase-two-report.repository.ts; apps/api/src/modules/emergency/emergency.repository.ts; apps/api/src/scripts/migrate-sequences.ts |
| guardianprofiles | GuardianProfileModel (`apps/api/src/modules/patient-portal/guardian-profile.model.ts`) | apps/api/src/modules/patient-portal/patient-portal.repository.ts |
| hmsbeds | BedModel (`apps/api/src/modules/admissions-configuration/admissions-configuration.model.ts`) | apps/api/src/modules/administration-dashboard/phase-two-report.repository.ts; apps/api/src/modules/admissions-configuration/admissions-configuration.repository.ts |
| hmswards | WardModel (`apps/api/src/modules/admissions-configuration/admissions-configuration.model.ts`) | apps/api/src/modules/admissions-configuration/admissions-configuration.repository.ts; apps/api/src/modules/inpatient-admissions/inpatient-admission.repository.ts |
| imaging_reports | ImagingReportModel (`apps/api/src/modules/imaging/imaging-report.model.ts`) | apps/api/src/modules/imaging/imaging.repository.ts; apps/api/src/modules/patient-portal/patient-portal.repository.ts |
| inpatientadmissions | InpatientAdmissionModel (`apps/api/src/modules/inpatient-admissions/inpatient-admission.model.ts`) | apps/api/src/modules/administration-dashboard/phase-two-report.repository.ts; apps/api/src/modules/admissions-configuration/admissions-configuration.repository.ts; apps/api/src/modules/inpatient-admissions/inpatient-admission.repository.ts; apps/api/src/modules/surgery/surgery.repository.ts; apps/api/src/scripts/migrate-sequences.ts |
| inpatientroundnotes | InpatientRoundNoteModel (`apps/api/src/modules/inpatient-admissions/inpatient-clinical-record.model.ts`) | apps/api/src/modules/inpatient-admissions/inpatient-admission.repository.ts |
| inpatientvitals | InpatientVitalModel (`apps/api/src/modules/inpatient-admissions/inpatient-clinical-record.model.ts`) | apps/api/src/modules/inpatient-admissions/inpatient-admission.repository.ts |
| insuranceauthorizations | InsuranceAuthorizationModel (`apps/api/src/modules/insurance/insurance-authorization.model.ts`) | apps/api/src/modules/insurance/insurance-authorization.repository.ts; apps/api/src/modules/insurance/insurance-integration.repository.ts |
| insurancebenefitconfigs | BenefitConfigModel (`apps/api/src/modules/insurance/insurance.model.ts`) | apps/api/src/modules/insurance/insurance.repository.ts |
| insuranceclaims | InsuranceClaimModel (`apps/api/src/modules/insurance/insurance-claim.model.ts`) | apps/api/src/modules/insurance/dha/dha-claim-adjudication.service.ts; apps/api/src/modules/insurance/dha/dha-claim-appeal.service.ts; apps/api/src/modules/insurance/dha/dha-claim-query.service.ts; apps/api/src/modules/insurance/dha/dha-claim-reporting.service.ts; apps/api/src/modules/insurance/dha/dha-remittance-advice.service.ts; apps/api/src/modules/insurance/insurance-claim.repository.ts |
| insuranceeligibilityverifications | EligibilityVerificationModel (`apps/api/src/modules/insurance/insurance.model.ts`) | apps/api/src/modules/insurance/dha/dha-preauthorization-readiness.service.ts; apps/api/src/modules/insurance/insurance.repository.ts |
| insurancemembers | InsuranceMemberModel (`apps/api/src/modules/insurance/insurance.model.ts`) | apps/api/src/modules/insurance/insurance-authorization.repository.ts; apps/api/src/modules/insurance/insurance-integration.repository.ts; apps/api/src/modules/insurance/insurance.repository.ts |
| insurancepolicies | InsurancePolicyModel (`apps/api/src/modules/insurance/insurance.model.ts`) | apps/api/src/modules/insurance/insurance-integration.repository.ts; apps/api/src/modules/insurance/insurance.repository.ts |
| insuranceschemes | InsuranceSchemeModel (`apps/api/src/modules/insurance/insurance.model.ts`) | apps/api/src/modules/insurance/insurance.repository.ts |
| laboratory_results | LaboratoryResultModel (`apps/api/src/modules/laboratory/laboratory-result.model.ts`) | apps/api/src/modules/laboratory/laboratory.repository.ts; apps/api/src/modules/patient-portal/patient-portal.repository.ts |
| notifications | NotificationModel (`apps/api/src/modules/notifications/notification.model.ts`) | apps/api/src/modules/notifications/notification.repository.ts |
| opdfollowups | OpdFollowUpModel (`apps/api/src/modules/opd/opd-follow-up.model.ts`) | apps/api/src/modules/opd/opd-follow-up.repository.ts |
| opdprescriptions | OpdPrescriptionModel (`apps/api/src/modules/opd/opd-prescription.model.ts`) | apps/api/src/modules/administration-dashboard/phase-two-report.repository.ts; apps/api/src/modules/opd/opd-prescription.repository.ts; apps/api/src/modules/patient-portal/patient-portal.repository.ts; apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.repository.ts; apps/api/src/scripts/migrate-clinical-context-visit-indexes.ts |
| opdreferrals | OpdReferralModel (`apps/api/src/modules/opd/opd-referral.model.ts`) | apps/api/src/modules/inpatient-admissions/inpatient-admission.repository.ts; apps/api/src/modules/opd/opd-referral.repository.ts |
| ophthalmologyattachments | No model found | No model references found |
| ophthalmologyclinicalreviews | No model found | No model references found |
| ophthalmologyconsultationfinalizations | No model found | No model references found |
| ophthalmologydashboardsnapshots | No model found | No model references found |
| ophthalmologypublications | No model found | No model references found |
| ophthalmologystations | No model found | No model references found |
| otpchallenges | OtpChallengeModel (`apps/api/src/modules/patient-portal/otp-challenge.model.ts`) | apps/api/src/modules/patient-portal/patient-otp.repository.ts |
| passwordresettokens | PasswordResetTokenModel (`apps/api/src/modules/auth/auth.model.ts`) | apps/api/src/modules/auth/auth.repository.ts |
| patientnumbersequences | PatientNumberSequenceModel (`apps/api/src/modules/patients/patient-number.model.ts`) | apps/api/src/modules/patients/patient.repository.ts |
| payers | PayerModel (`apps/api/src/modules/insurance/insurance.model.ts`) | apps/api/src/modules/insurance/insurance.repository.ts |
| pharmacy_medicine_stock_movements | PharmacyMedicineStockMovementModel (`apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.model.ts`) | apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.repository.ts |
| pharmacydispensings | PharmacyDispensingModel (`apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.model.ts`) | apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.repository.ts; apps/api/src/scripts/migrate-pharmacy-dispensing-idempotency.ts |
| registrationtokens | RegistrationTokenModel (`apps/api/src/modules/patient-portal/registration-token.model.ts`) | apps/api/src/modules/patient-portal/patient-otp.service.ts |
| shaservicemappings | ShaServiceMappingModel (`apps/api/src/modules/insurance/insurance-integration.model.ts`) | apps/api/src/modules/insurance/insurance-integration.repository.ts |

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
