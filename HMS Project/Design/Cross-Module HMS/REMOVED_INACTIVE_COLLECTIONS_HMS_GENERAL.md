# Removed Inactive Collections Report (HMS_GENERAL)

**Execution Timestamp**: 2026-10-20T12:34:08.972Z
**Target Database**: `HMS_GENERAL`
**MongoDB Atlas Hard Limit**: 500 collections across cluster
**Total Inactive Collections Removed**: 70
**Active Collections Preserved in HMS_GENERAL**: 22
**Total Collections on Cluster After Cleanup**: **437** (Well within the 500 limit)

## 1. Overview

In response to the MongoDB Atlas free-tier ceiling error (`cannot create a new collection -- already using 504 collections of 500`), all **inactive, 0-document collections** within the application database `HMS_GENERAL` were removed.

Every active collection containing patient, doctor, OPD, appointment, configuration, and audit records was strictly preserved.

## 2. List of Removed Inactive Collections (70)

All of the following collections contained exactly **0 documents**:

| # | Collection Name | Documents Before Removal | Status |
|---|---|:---:|:---:|
| 1 | `admissionpolicies` | 0 | **REMOVED** |
| 2 | `admissionrequests` | 0 | **REMOVED** |
| 3 | `advancepayments` | 0 | **REMOVED** |
| 4 | `authratelimits` | 0 | **REMOVED** |
| 5 | `bedassignmenthistories` | 0 | **REMOVED** |
| 6 | `bedholds` | 0 | **REMOVED** |
| 7 | `bedtransfers` | 0 | **REMOVED** |
| 8 | `billing_invoice_items` | 0 | **REMOVED** |
| 9 | `billing_invoices` | 0 | **REMOVED** |
| 10 | `billing_payments` | 0 | **REMOVED** |
| 11 | `consenttemplates` | 0 | **REMOVED** |
| 12 | `dhamockclaimadjudications` | 0 | **REMOVED** |
| 13 | `dhamockclaimappeals` | 0 | **REMOVED** |
| 14 | `dhamockclaimclosures` | 0 | **REMOVED** |
| 15 | `dhamockclaimdischarges` | 0 | **REMOVED** |
| 16 | `dhamockclaimpreviews` | 0 | **REMOVED** |
| 17 | `dhamockclaimqueries` | 0 | **REMOVED** |
| 18 | `dhamockclaimsubmissions` | 0 | **REMOVED** |
| 19 | `dhamockpaymentallocations` | 0 | **REMOVED** |
| 20 | `dhamockpaymentreconciliations` | 0 | **REMOVED** |
| 21 | `dhamockremittanceadvices` | 0 | **REMOVED** |
| 22 | `doctoravailabilityexceptions` | 0 | **REMOVED** |
| 23 | `doctorleaves` | 0 | **REMOVED** |
| 24 | `emergencyencounters` | 0 | **REMOVED** |
| 25 | `guardianprofiles` | 0 | **REMOVED** |
| 26 | `hmsbeds` | 0 | **REMOVED** |
| 27 | `hmswards` | 0 | **REMOVED** |
| 28 | `imaging_reports` | 0 | **REMOVED** |
| 29 | `inpatientadmissions` | 0 | **REMOVED** |
| 30 | `inpatientroundnotes` | 0 | **REMOVED** |
| 31 | `inpatientvitals` | 0 | **REMOVED** |
| 32 | `insuranceauthorizations` | 0 | **REMOVED** |
| 33 | `insurancebenefitconfigs` | 0 | **REMOVED** |
| 34 | `insuranceclaims` | 0 | **REMOVED** |
| 35 | `insuranceeligibilityverifications` | 0 | **REMOVED** |
| 36 | `insurancemembers` | 0 | **REMOVED** |
| 37 | `insurancepolicies` | 0 | **REMOVED** |
| 38 | `insuranceschemes` | 0 | **REMOVED** |
| 39 | `laboratory_results` | 0 | **REMOVED** |
| 40 | `medicines` | 0 | **REMOVED** |
| 41 | `notifications` | 0 | **REMOVED** |
| 42 | `opdclinicalorders` | 0 | **REMOVED** |
| 43 | `opdfollowups` | 0 | **REMOVED** |
| 44 | `opdprescriptions` | 0 | **REMOVED** |
| 45 | `opdreferrals` | 0 | **REMOVED** |
| 46 | `ophthalmologyattachments` | 0 | **REMOVED** |
| 47 | `ophthalmologyclinicalreviews` | 0 | **REMOVED** |
| 48 | `ophthalmologyconsultationfinalizations` | 0 | **REMOVED** |
| 49 | `ophthalmologycontexts` | 0 | **REMOVED** |
| 50 | `ophthalmologydashboardsnapshots` | 0 | **REMOVED** |
| 51 | `ophthalmologyopticalprescriptions` | 0 | **REMOVED** |
| 52 | `ophthalmologypublications` | 0 | **REMOVED** |
| 53 | `ophthalmologystations` | 0 | **REMOVED** |
| 54 | `ophthalmologytestresults` | 0 | **REMOVED** |
| 55 | `ophthalmologytesttasks` | 0 | **REMOVED** |
| 56 | `otpchallenges` | 0 | **REMOVED** |
| 57 | `passwordresettokens` | 0 | **REMOVED** |
| 58 | `patientaccessgrants` | 0 | **REMOVED** |
| 59 | `patientdocuments` | 0 | **REMOVED** |
| 60 | `patientnumbersequences` | 0 | **REMOVED** |
| 61 | `payers` | 0 | **REMOVED** |
| 62 | `pharmacy_medicine_batches` | 0 | **REMOVED** |
| 63 | `pharmacy_medicine_inventory` | 0 | **REMOVED** |
| 64 | `pharmacy_medicine_stock_movements` | 0 | **REMOVED** |
| 65 | `pharmacydispensings` | 0 | **REMOVED** |
| 66 | `procedurebookings` | 0 | **REMOVED** |
| 67 | `procedurerecommendations` | 0 | **REMOVED** |
| 68 | `registrationtokens` | 0 | **REMOVED** |
| 69 | `services` | 0 | **REMOVED** |
| 70 | `shaservicemappings` | 0 | **REMOVED** |

## 3. Preserved Active Collections (22)

The following collections have live operational documents and were untouched:

| # | Collection Name | Live Documents | Purpose |
|---|---|:---:|---|
| 1 | `auditlogs` | **422** | Active operational records |
| 2 | `refreshtokens` | **290** | Active operational records |
| 3 | `permissions` | **231** | Active operational records |
| 4 | `roles` | **22** | Active operational records |
| 5 | `ophthalmologyconfigurations` | **22** | Active operational records |
| 6 | `ophthalmologyworkflowprofiles` | **21** | Active operational records |
| 7 | `permissiongroups` | **16** | Active operational records |
| 8 | `patienttimelineevents` | **11** | Active operational records |
| 9 | `branches` | **3** | Active operational records |
| 10 | `sequences` | **3** | Active operational records |
| 11 | `permissioncategories` | **3** | Active operational records |
| 12 | `opdvisits` | **3** | Active operational records |
| 13 | `opdvitals` | **3** | Active operational records |
| 14 | `departments` | **3** | Active operational records |
| 15 | `doctors` | **2** | Active operational records |
| 16 | `users` | **2** | Active operational records |
| 17 | `patients` | **2** | Active operational records |
| 18 | `opdconsultations` | **2** | Active operational records |
| 19 | `administrationdashboardsnapshots` | **1** | Active operational records |
| 20 | `doctorsequences` | **1** | Active operational records |
| 21 | `systemsettings` | **1** | Active operational records |
| 22 | `appointments` | **1** | Active operational records |
