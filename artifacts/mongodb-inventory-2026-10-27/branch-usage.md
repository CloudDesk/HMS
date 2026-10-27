# Empty HMS_GENERAL collections: branch usage

Inventory checked: 2026-10-27T05:24:23.462Z

All 53 empty collections are used by the current branch. 47 are used by all three branches; six ophthalmology collections are used only by the current branch. No collection in this list is unreferenced across all three branches.

USED = application-imported code contains database operations on this collection. This does not establish recent runtime activity or whether a particular deployment enables the feature. ABSENT = no model or literal collection reference found in backend source. Tests are excluded. Current branch includes working-tree changes. Other branches are checked at their local tips, which matched freshly fetched origin tips.

- DEV-OPHTHALMOLOGY-F-V2: 255eebdbe504ebd6943f3e991021dd35cb550990 (plus working-tree changes)
- DEV-GENERAL: a12bb855bd5f47c401a6ffdfb906464eebd91817
- Insurance-Module-v1-F: a12bb855bd5f47c401a6ffdfb906464eebd91817

| Collection | Current: DEV-OPHTHALMOLOGY-F-V2 | DEV-GENERAL | Insurance-Module-v1-F |
|---|---|---|---|
| admissionpolicies | USED | USED | USED |
| advancepayments | USED | USED | USED |
| authratelimits | USED | USED | USED |
| bedassignmenthistories | USED | USED | USED |
| bedholds | USED | USED | USED |
| bedtransfers | USED | USED | USED |
| billing_payments | USED | USED | USED |
| consenttemplates | USED | USED | USED |
| dhamockclaimadjudications | USED | USED | USED |
| dhamockclaimappeals | USED | USED | USED |
| dhamockclaimclosures | USED | USED | USED |
| dhamockclaimdischarges | USED | USED | USED |
| dhamockclaimpreviews | USED | USED | USED |
| dhamockclaimqueries | USED | USED | USED |
| dhamockclaimsubmissions | USED | USED | USED |
| dhamockpaymentallocations | USED | USED | USED |
| dhamockpaymentreconciliations | USED | USED | USED |
| dhamockremittanceadvices | USED | USED | USED |
| doctoravailabilityexceptions | USED | USED | USED |
| doctorleaves | USED | USED | USED |
| emergencyencounters | USED | USED | USED |
| guardianprofiles | USED | USED | USED |
| hmsbeds | USED | USED | USED |
| hmswards | USED | USED | USED |
| imaging_reports | USED | USED | USED |
| inpatientadmissions | USED | USED | USED |
| inpatientroundnotes | USED | USED | USED |
| inpatientvitals | USED | USED | USED |
| insuranceauthorizations | USED | USED | USED |
| insurancebenefitconfigs | USED | USED | USED |
| insuranceclaims | USED | USED | USED |
| insuranceeligibilityverifications | USED | USED | USED |
| insurancemembers | USED | USED | USED |
| insurancepolicies | USED | USED | USED |
| insuranceschemes | USED | USED | USED |
| laboratory_results | USED | USED | USED |
| notifications | USED | USED | USED |
| opdfollowups | USED | USED | USED |
| opdreferrals | USED | USED | USED |
| ophthalmologyattachments | USED | ABSENT | ABSENT |
| ophthalmologyclinicalreviews | USED | ABSENT | ABSENT |
| ophthalmologyconsultationfinalizations | USED | ABSENT | ABSENT |
| ophthalmologydashboardsnapshots | USED | ABSENT | ABSENT |
| ophthalmologypublications | USED | ABSENT | ABSENT |
| ophthalmologystations | USED | ABSENT | ABSENT |
| otpchallenges | USED | USED | USED |
| passwordresettokens | USED | USED | USED |
| patientnumbersequences | USED | USED | USED |
| payers | USED | USED | USED |
| pharmacy_medicine_stock_movements | USED | USED | USED |
| pharmacydispensings | USED | USED | USED |
| registrationtokens | USED | USED | USED |
| shaservicemappings | USED | USED | USED |

## Evidence

### admissionpolicies
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/administration-dashboard/phase-two-report.repository.ts:186 (AdmissionPolicyModel.findOne)
- DEV-GENERAL: USED — apps/api/src/modules/administration-dashboard/phase-two-report.repository.ts:186 (AdmissionPolicyModel.findOne)
- Insurance-Module-v1-F: USED — apps/api/src/modules/administration-dashboard/phase-two-report.repository.ts:186 (AdmissionPolicyModel.findOne)

### advancepayments
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/advance-payment/advance-payment.repository.ts:26 (AdvancePaymentModel.findOne)
- DEV-GENERAL: USED — apps/api/src/modules/advance-payment/advance-payment.repository.ts:26 (AdvancePaymentModel.findOne)
- Insurance-Module-v1-F: USED — apps/api/src/modules/advance-payment/advance-payment.repository.ts:26 (AdvancePaymentModel.findOne)

### authratelimits
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/auth/auth-rate-limit.repository.ts:13 (AuthRateLimitModel.findOneAndUpdate)
- DEV-GENERAL: USED — apps/api/src/modules/auth/auth-rate-limit.repository.ts:13 (AuthRateLimitModel.findOneAndUpdate)
- Insurance-Module-v1-F: USED — apps/api/src/modules/auth/auth-rate-limit.repository.ts:13 (AuthRateLimitModel.findOneAndUpdate)

### bedassignmenthistories
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/admissions-configuration/admissions-configuration.repository.ts:157 (BedAssignmentHistoryModel.create)
- DEV-GENERAL: USED — apps/api/src/modules/admissions-configuration/admissions-configuration.repository.ts:157 (BedAssignmentHistoryModel.create)
- Insurance-Module-v1-F: USED — apps/api/src/modules/admissions-configuration/admissions-configuration.repository.ts:157 (BedAssignmentHistoryModel.create)

### bedholds
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/admissions-configuration/admissions-configuration.repository.ts:134 (BedHoldModel.findOne)
- DEV-GENERAL: USED — apps/api/src/modules/admissions-configuration/admissions-configuration.repository.ts:134 (BedHoldModel.findOne)
- Insurance-Module-v1-F: USED — apps/api/src/modules/admissions-configuration/admissions-configuration.repository.ts:134 (BedHoldModel.findOne)

### bedtransfers
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/admissions-configuration/admissions-configuration.repository.ts:159 (BedTransferModel.findOne)
- DEV-GENERAL: USED — apps/api/src/modules/admissions-configuration/admissions-configuration.repository.ts:159 (BedTransferModel.findOne)
- Insurance-Module-v1-F: USED — apps/api/src/modules/admissions-configuration/admissions-configuration.repository.ts:159 (BedTransferModel.findOne)

### billing_payments
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/billing/billing.repository.ts:443 (BillingPaymentModel.create)
- DEV-GENERAL: USED — apps/api/src/modules/billing/billing.repository.ts:413 (BillingPaymentModel.create)
- Insurance-Module-v1-F: USED — apps/api/src/modules/billing/billing.repository.ts:413 (BillingPaymentModel.create)

### consenttemplates
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/consents/consent.repository.ts:55 (ConsentTemplateModel.find)
- DEV-GENERAL: USED — apps/api/src/modules/consents/consent.repository.ts:33 (ConsentTemplateModel.find)
- Insurance-Module-v1-F: USED — apps/api/src/modules/consents/consent.repository.ts:33 (ConsentTemplateModel.find)

### dhamockclaimadjudications
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/insurance/dha/dha-claim-adjudication.service.ts:159 (DhaMockClaimAdjudicationModel.findOne)
- DEV-GENERAL: USED — apps/api/src/modules/insurance/dha/dha-claim-adjudication.service.ts:159 (DhaMockClaimAdjudicationModel.findOne)
- Insurance-Module-v1-F: USED — apps/api/src/modules/insurance/dha/dha-claim-adjudication.service.ts:159 (DhaMockClaimAdjudicationModel.findOne)

### dhamockclaimappeals
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/insurance/dha/dha-claim-appeal.service.ts:191 (DhaMockClaimAppealModel.findOne)
- DEV-GENERAL: USED — apps/api/src/modules/insurance/dha/dha-claim-appeal.service.ts:191 (DhaMockClaimAppealModel.findOne)
- Insurance-Module-v1-F: USED — apps/api/src/modules/insurance/dha/dha-claim-appeal.service.ts:191 (DhaMockClaimAppealModel.findOne)

### dhamockclaimclosures
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/insurance/dha/dha-claim-closure.service.ts:300 (DhaMockClaimClosureModel.findOne)
- DEV-GENERAL: USED — apps/api/src/modules/insurance/dha/dha-claim-closure.service.ts:300 (DhaMockClaimClosureModel.findOne)
- Insurance-Module-v1-F: USED — apps/api/src/modules/insurance/dha/dha-claim-closure.service.ts:300 (DhaMockClaimClosureModel.findOne)

### dhamockclaimdischarges
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/insurance/dha/dha-claim-adjudication.service.ts:92 (DhaMockClaimDischargeModel.findOne)
- DEV-GENERAL: USED — apps/api/src/modules/insurance/dha/dha-claim-adjudication.service.ts:92 (DhaMockClaimDischargeModel.findOne)
- Insurance-Module-v1-F: USED — apps/api/src/modules/insurance/dha/dha-claim-adjudication.service.ts:92 (DhaMockClaimDischargeModel.findOne)

### dhamockclaimpreviews
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/insurance/dha/dha-claim-discharge.service.ts:115 (DhaMockClaimPreviewModel.findOne)
- DEV-GENERAL: USED — apps/api/src/modules/insurance/dha/dha-claim-discharge.service.ts:115 (DhaMockClaimPreviewModel.findOne)
- Insurance-Module-v1-F: USED — apps/api/src/modules/insurance/dha/dha-claim-discharge.service.ts:115 (DhaMockClaimPreviewModel.findOne)

### dhamockclaimqueries
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/insurance/dha/dha-claim-appeal.service.ts:175 (DhaMockClaimQueryModel.findOne)
- DEV-GENERAL: USED — apps/api/src/modules/insurance/dha/dha-claim-appeal.service.ts:175 (DhaMockClaimQueryModel.findOne)
- Insurance-Module-v1-F: USED — apps/api/src/modules/insurance/dha/dha-claim-appeal.service.ts:175 (DhaMockClaimQueryModel.findOne)

### dhamockclaimsubmissions
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/insurance/dha/dha-claim-discharge.service.ts:86 (DhaMockClaimSubmissionModel.findOne)
- DEV-GENERAL: USED — apps/api/src/modules/insurance/dha/dha-claim-discharge.service.ts:86 (DhaMockClaimSubmissionModel.findOne)
- Insurance-Module-v1-F: USED — apps/api/src/modules/insurance/dha/dha-claim-discharge.service.ts:86 (DhaMockClaimSubmissionModel.findOne)

### dhamockpaymentallocations
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/insurance/dha/dha-claim-reporting.service.ts:701 (DhaMockPaymentAllocationModel.find)
- DEV-GENERAL: USED — apps/api/src/modules/insurance/dha/dha-claim-reporting.service.ts:701 (DhaMockPaymentAllocationModel.find)
- Insurance-Module-v1-F: USED — apps/api/src/modules/insurance/dha/dha-claim-reporting.service.ts:701 (DhaMockPaymentAllocationModel.find)

### dhamockpaymentreconciliations
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/insurance/dha/dha-claim-closure.service.ts:220 (DhaMockPaymentReconciliationModel.findOne)
- DEV-GENERAL: USED — apps/api/src/modules/insurance/dha/dha-claim-closure.service.ts:220 (DhaMockPaymentReconciliationModel.findOne)
- Insurance-Module-v1-F: USED — apps/api/src/modules/insurance/dha/dha-claim-closure.service.ts:220 (DhaMockPaymentReconciliationModel.findOne)

### dhamockremittanceadvices
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/insurance/dha/dha-claim-closure.service.ts:209 (DhaMockRemittanceAdviceModel.findOne)
- DEV-GENERAL: USED — apps/api/src/modules/insurance/dha/dha-claim-closure.service.ts:209 (DhaMockRemittanceAdviceModel.findOne)
- Insurance-Module-v1-F: USED — apps/api/src/modules/insurance/dha/dha-claim-closure.service.ts:209 (DhaMockRemittanceAdviceModel.findOne)

### doctoravailabilityexceptions
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/doctors/doctor.repository.ts:478 (DoctorAvailabilityExceptionModel.find)
- DEV-GENERAL: USED — apps/api/src/modules/doctors/doctor.repository.ts:476 (DoctorAvailabilityExceptionModel.find)
- Insurance-Module-v1-F: USED — apps/api/src/modules/doctors/doctor.repository.ts:476 (DoctorAvailabilityExceptionModel.find)

### doctorleaves
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/doctors/doctor.repository.ts:415 (DoctorLeaveModel.find)
- DEV-GENERAL: USED — apps/api/src/modules/doctors/doctor.repository.ts:413 (DoctorLeaveModel.find)
- Insurance-Module-v1-F: USED — apps/api/src/modules/doctors/doctor.repository.ts:413 (DoctorLeaveModel.find)

### emergencyencounters
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/administration-dashboard/phase-two-report.repository.ts:84 (EmergencyEncounterModel.aggregate)
- DEV-GENERAL: USED — apps/api/src/modules/administration-dashboard/phase-two-report.repository.ts:84 (EmergencyEncounterModel.aggregate)
- Insurance-Module-v1-F: USED — apps/api/src/modules/administration-dashboard/phase-two-report.repository.ts:84 (EmergencyEncounterModel.aggregate)

### guardianprofiles
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/patient-portal/patient-portal.repository.ts:366 (GuardianProfileModel.findOne)
- DEV-GENERAL: USED — apps/api/src/modules/patient-portal/patient-portal.repository.ts:364 (GuardianProfileModel.findOne)
- Insurance-Module-v1-F: USED — apps/api/src/modules/patient-portal/patient-portal.repository.ts:364 (GuardianProfileModel.findOne)

### hmsbeds
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/administration-dashboard/phase-two-report.repository.ts:53 (BedModel.aggregate)
- DEV-GENERAL: USED — apps/api/src/modules/administration-dashboard/phase-two-report.repository.ts:53 (BedModel.aggregate)
- Insurance-Module-v1-F: USED — apps/api/src/modules/administration-dashboard/phase-two-report.repository.ts:53 (BedModel.aggregate)

### hmswards
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/admissions-configuration/admissions-configuration.repository.ts:101 (WardModel.find)
- DEV-GENERAL: USED — apps/api/src/modules/admissions-configuration/admissions-configuration.repository.ts:101 (WardModel.find)
- Insurance-Module-v1-F: USED — apps/api/src/modules/admissions-configuration/admissions-configuration.repository.ts:101 (WardModel.find)

### imaging_reports
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/imaging/imaging.repository.ts:26 (ImagingReportModel.findOne)
- DEV-GENERAL: USED — apps/api/src/modules/imaging/imaging.repository.ts:26 (ImagingReportModel.findOne)
- Insurance-Module-v1-F: USED — apps/api/src/modules/imaging/imaging.repository.ts:26 (ImagingReportModel.findOne)

### inpatientadmissions
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/administration-dashboard/phase-two-report.repository.ts:115 (InpatientAdmissionModel.aggregate)
- DEV-GENERAL: USED — apps/api/src/modules/administration-dashboard/phase-two-report.repository.ts:115 (InpatientAdmissionModel.aggregate)
- Insurance-Module-v1-F: USED — apps/api/src/modules/administration-dashboard/phase-two-report.repository.ts:115 (InpatientAdmissionModel.aggregate)

### inpatientroundnotes
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/inpatient-admissions/inpatient-admission.repository.ts:575 (InpatientRoundNoteModel.find)
- DEV-GENERAL: USED — apps/api/src/modules/inpatient-admissions/inpatient-admission.repository.ts:575 (InpatientRoundNoteModel.find)
- Insurance-Module-v1-F: USED — apps/api/src/modules/inpatient-admissions/inpatient-admission.repository.ts:575 (InpatientRoundNoteModel.find)

### inpatientvitals
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/inpatient-admissions/inpatient-admission.repository.ts:584 (InpatientVitalModel.find)
- DEV-GENERAL: USED — apps/api/src/modules/inpatient-admissions/inpatient-admission.repository.ts:584 (InpatientVitalModel.find)
- Insurance-Module-v1-F: USED — apps/api/src/modules/inpatient-admissions/inpatient-admission.repository.ts:584 (InpatientVitalModel.find)

### insuranceauthorizations
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/insurance/insurance-authorization.repository.ts:29 (InsuranceAuthorizationModel.findById)
- DEV-GENERAL: USED — apps/api/src/modules/insurance/insurance-authorization.repository.ts:29 (InsuranceAuthorizationModel.findById)
- Insurance-Module-v1-F: USED — apps/api/src/modules/insurance/insurance-authorization.repository.ts:29 (InsuranceAuthorizationModel.findById)

### insurancebenefitconfigs
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/insurance/insurance.repository.ts:677 (BenefitConfigModel.create)
- DEV-GENERAL: USED — apps/api/src/modules/insurance/insurance.repository.ts:677 (BenefitConfigModel.create)
- Insurance-Module-v1-F: USED — apps/api/src/modules/insurance/insurance.repository.ts:677 (BenefitConfigModel.create)

### insuranceclaims
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/insurance/insurance-claim.repository.ts:19 (InsuranceClaimModel.findById)
- DEV-GENERAL: USED — apps/api/src/modules/insurance/dha/dha-claim-reporting.service.ts:192 (InsuranceClaimModel.find)
- Insurance-Module-v1-F: USED — apps/api/src/modules/insurance/dha/dha-claim-reporting.service.ts:192 (InsuranceClaimModel.find)

### insuranceeligibilityverifications
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/insurance/insurance.repository.ts:578 (EligibilityVerificationModel.create)
- DEV-GENERAL: USED — apps/api/src/modules/insurance/dha/dha-preauthorization-readiness.service.ts:195 (EligibilityVerificationModel.findOne)
- Insurance-Module-v1-F: USED — apps/api/src/modules/insurance/dha/dha-preauthorization-readiness.service.ts:195 (EligibilityVerificationModel.findOne)

### insurancemembers
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/insurance/insurance-authorization.repository.ts:21 (InsuranceMemberModel.findById)
- DEV-GENERAL: USED — apps/api/src/modules/insurance/insurance-authorization.repository.ts:21 (InsuranceMemberModel.findById)
- Insurance-Module-v1-F: USED — apps/api/src/modules/insurance/insurance-authorization.repository.ts:21 (InsuranceMemberModel.findById)

### insurancepolicies
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/insurance/insurance-integration.repository.ts:36 (InsurancePolicyModel.findById)
- DEV-GENERAL: USED — apps/api/src/modules/insurance/insurance-integration.repository.ts:36 (InsurancePolicyModel.findById)
- Insurance-Module-v1-F: USED — apps/api/src/modules/insurance/insurance-integration.repository.ts:36 (InsurancePolicyModel.findById)

### insuranceschemes
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/insurance/insurance.repository.ts:173 (InsuranceSchemeModel.create)
- DEV-GENERAL: USED — apps/api/src/modules/insurance/insurance.repository.ts:173 (InsuranceSchemeModel.create)
- Insurance-Module-v1-F: USED — apps/api/src/modules/insurance/insurance.repository.ts:173 (InsuranceSchemeModel.create)

### laboratory_results
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/laboratory/laboratory.repository.ts:49 (LaboratoryResultModel.findOne)
- DEV-GENERAL: USED — apps/api/src/modules/laboratory/laboratory.repository.ts:49 (LaboratoryResultModel.findOne)
- Insurance-Module-v1-F: USED — apps/api/src/modules/laboratory/laboratory.repository.ts:49 (LaboratoryResultModel.findOne)

### notifications
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/notifications/notification.repository.ts:99 (NotificationModel.create)
- DEV-GENERAL: USED — apps/api/src/modules/notifications/notification.repository.ts:99 (NotificationModel.create)
- Insurance-Module-v1-F: USED — apps/api/src/modules/notifications/notification.repository.ts:99 (NotificationModel.create)

### opdfollowups
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/opd/opd-follow-up.repository.ts:77 (OpdFollowUpModel.aggregate)
- DEV-GENERAL: USED — apps/api/src/modules/opd/opd-follow-up.repository.ts:52 (OpdFollowUpModel.findOne)
- Insurance-Module-v1-F: USED — apps/api/src/modules/opd/opd-follow-up.repository.ts:52 (OpdFollowUpModel.findOne)

### opdreferrals
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/inpatient-admissions/inpatient-admission.repository.ts:399 (OpdReferralModel.findOne)
- DEV-GENERAL: USED — apps/api/src/modules/inpatient-admissions/inpatient-admission.repository.ts:399 (OpdReferralModel.findOne)
- Insurance-Module-v1-F: USED — apps/api/src/modules/inpatient-admissions/inpatient-admission.repository.ts:399 (OpdReferralModel.findOne)

### ophthalmologyattachments
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/ophthalmology/ophthalmology-phase10.repository.ts:46 (OphthalmologyAttachmentModel.updateMany)
- DEV-GENERAL: ABSENT
- Insurance-Module-v1-F: ABSENT

### ophthalmologyclinicalreviews
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/ophthalmology/ophthalmology.repository.ts:941 (OphthalmologyClinicalReviewModel.findOne)
- DEV-GENERAL: ABSENT
- Insurance-Module-v1-F: ABSENT

### ophthalmologyconsultationfinalizations
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/opd/opd-visit.service.ts:313 (OphthalmologyConsultationFinalizationModel.findOne)
- DEV-GENERAL: ABSENT
- Insurance-Module-v1-F: ABSENT

### ophthalmologydashboardsnapshots
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/ophthalmology/ophthalmology-phase10.repository.ts:302 (OphthalmologyDashboardSnapshotModel.findOneAndUpdate)
- DEV-GENERAL: ABSENT
- Insurance-Module-v1-F: ABSENT

### ophthalmologypublications
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/ophthalmology/ophthalmology-phase10.repository.ts:45 (OphthalmologyPublicationModel.exists)
- DEV-GENERAL: ABSENT
- Insurance-Module-v1-F: ABSENT

### ophthalmologystations
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/ophthalmology/ophthalmology.repository.ts:459 (OphthalmologyStationModel.findById)
- DEV-GENERAL: ABSENT
- Insurance-Module-v1-F: ABSENT

### otpchallenges
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/patient-portal/patient-otp.repository.ts:43 (OtpChallengeModel.create)
- DEV-GENERAL: USED — apps/api/src/modules/patient-portal/patient-otp.repository.ts:43 (OtpChallengeModel.create)
- Insurance-Module-v1-F: USED — apps/api/src/modules/patient-portal/patient-otp.repository.ts:43 (OtpChallengeModel.create)

### passwordresettokens
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/auth/auth.repository.ts:217 (PasswordResetTokenModel.create)
- DEV-GENERAL: USED — apps/api/src/modules/auth/auth.repository.ts:197 (PasswordResetTokenModel.create)
- Insurance-Module-v1-F: USED — apps/api/src/modules/auth/auth.repository.ts:197 (PasswordResetTokenModel.create)

### patientnumbersequences
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/patients/patient.repository.ts:302 (PatientNumberSequenceModel.findOneAndUpdate)
- DEV-GENERAL: USED — apps/api/src/modules/patients/patient.repository.ts:299 (PatientNumberSequenceModel.findOneAndUpdate)
- Insurance-Module-v1-F: USED — apps/api/src/modules/patients/patient.repository.ts:299 (PatientNumberSequenceModel.findOneAndUpdate)

### payers
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/insurance/insurance.repository.ts:77 (PayerModel.create)
- DEV-GENERAL: USED — apps/api/src/modules/insurance/insurance.repository.ts:77 (PayerModel.create)
- Insurance-Module-v1-F: USED — apps/api/src/modules/insurance/insurance.repository.ts:77 (PayerModel.create)

### pharmacy_medicine_stock_movements
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.repository.ts:462 (PharmacyMedicineStockMovementModel.findOne)
- DEV-GENERAL: USED — apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.repository.ts:462 (PharmacyMedicineStockMovementModel.findOne)
- Insurance-Module-v1-F: USED — apps/api/src/modules/pharmacy-inventory/pharmacy-inventory.repository.ts:462 (PharmacyMedicineStockMovementModel.findOne)

### pharmacydispensings
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/opd/opd-visit.service.ts:376 (PharmacyDispensingModel.find)
- DEV-GENERAL: USED — apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.repository.ts:113 (PharmacyDispensingModel.findOne)
- Insurance-Module-v1-F: USED — apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.repository.ts:113 (PharmacyDispensingModel.findOne)

### registrationtokens
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/patient-portal/patient-otp.service.ts:135 (RegistrationTokenModel.create)
- DEV-GENERAL: USED — apps/api/src/modules/patient-portal/patient-otp.service.ts:135 (RegistrationTokenModel.create)
- Insurance-Module-v1-F: USED — apps/api/src/modules/patient-portal/patient-otp.service.ts:135 (RegistrationTokenModel.create)

### shaservicemappings
- DEV-OPHTHALMOLOGY-F-V2: USED — apps/api/src/modules/insurance/insurance-integration.repository.ts:44 (ShaServiceMappingModel.findOne)
- DEV-GENERAL: USED — apps/api/src/modules/insurance/insurance-integration.repository.ts:44 (ShaServiceMappingModel.findOne)
- Insurance-Module-v1-F: USED — apps/api/src/modules/insurance/insurance-integration.repository.ts:44 (ShaServiceMappingModel.findOne)
