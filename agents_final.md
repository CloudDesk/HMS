# AGENTS.md --- HMS Insurance Full Architecture + Controlled Phase Delivery

## 1. Purpose

This document is the updated implementation guide for the HMS Insurance
Management and Claims System. It combines the complete insurance
architecture with a controlled, phase-wise delivery approach that must
preserve the existing HMS contracts and behavior.

The former 3-day / approximately 24-hour MVP is retained only as a
prototype-planning reference. It is not an approved production delivery
plan and must not override the repository-alignment rules or phase stop
gates in this document.

The complete business lifecycle is:

`Payer & Scheme Setup → Member Management → Eligibility → Benefit Verification → Pre-authorization → Service Utilization → Claim Intake → Validation → Adjudication → Query/Rejection → Appeal/Resubmission → Payment → Allocation → Reconciliation → Closure`

The implementation must extend the existing HMS rather than create a
second HMS.

------------------------------------------------------------------------

# 2. Non-Negotiable Architecture Rules

## 2.1 Existing HMS remains authoritative

Reuse existing:

``` text
Patient
Patient Document
Encounter
Doctor
Department
Service
Invoice
Invoice Item
Branch
User
Role
Audit
Notification
```

Insurance records must reference these records.

Examples:

``` text
insurance member → patientId
eligibility verification → patientId / encounterId / memberId
authorization → patientId / encounterId / serviceId
claim → patientId / encounterId / invoiceId
claim line → invoiceItemId / serviceId
```

Do not create duplicate Patient, Encounter, Service or Invoice records.

## 2.2 Insurance owns insurance transactions

Create dedicated insurance records for:

``` text
Payer
Contract
Scheme
Policy
Insurance Member
Benefit
Benefit Rule
Payer Tariff
Eligibility Verification
Benefit Verification
Authorization
Authorization Line
Authorization History
Service Utilization
Claim
Claim Line
Claim Document
Claim Validation
Integration Profile
Integration Message
Claim Query
Claim Adjudication
Appeal
Payment Batch
Payer Payment
Remittance
Payment Allocation
Reconciliation
Financial Adjustment
```

## 2.3 Never reuse unrelated HMS records

Never use:

-   Patient payment records as payer settlement
-   Invoice status as claim status
-   Generic document metadata as verified insurance coverage
-   Browser/localStorage as production insurance storage

Payer settlement must use dedicated insurance payment/allocation
records.

------------------------------------------------------------------------

# 3. Complete End-to-End Architecture

``` text
PAYER REGISTRATION
        ↓
CONTRACT SETUP
        ↓
SCHEME SETUP
        ↓
POLICY SETUP
        ↓
BENEFIT SETUP
        ↓
TARIFF SETUP
        ↓
AUTHORIZATION RULE SETUP
        ↓
INTEGRATION SETUP
        ↓
PAYER ACTIVATION
        ↓
PATIENT INSURANCE COVERAGE
        ↓
MEMBER REGISTRATION
        ↓
ELIGIBILITY VERIFICATION
        ↓
BENEFIT VERIFICATION
        ↓
SERVICE REQUEST
        ↓
PREAUTHORIZATION
        ↓
SERVICE UTILIZATION
        ↓
EXISTING HMS CARE FLOW
Patient → Encounter → Service → Invoice → Invoice Item
        ↓
CLAIM INTAKE
        ↓
CLAIM DOCUMENTS
        ↓
CLAIM VALIDATION
        ↓
CLAIM SUBMISSION
        ↓
PAYER ACKNOWLEDGEMENT
        ↓
CLAIM ADJUDICATION
        ↓
+----------------------+----------------------+
|                      |                      |
APPROVED          PARTIALLY APPROVED       REJECTED
|                      |                      |
|                      |                QUERY / APPEAL
|                      |                      |
|                      |                RESUBMISSION
|                      |                      |
+----------------------+----------------------+
                       ↓
                  ADJUDICATION
                       ↓
                 PAYMENT BATCH
                       ↓
                 PAYMENT APPROVAL
                       ↓
                  BANK PAYMENT
                       ↓
                   REMITTANCE
                       ↓
                PAYMENT ALLOCATION
                       ↓
              THREE-WAY RECONCILIATION
                       ↓
             +---------+---------+
             |                   |
         RECONCILED           VARIANCE
             |                   |
             |           INVESTIGATION /
             |           ADJUSTMENT /
             |           DISPUTE / WRITE-OFF
             |                   |
             +---------+---------+
                       ↓
                RECEIVABLE UPDATE
                       ↓
              BENEFIT UTILIZATION
                       ↓
                  AUDIT / NOTIFY
                       ↓
                  CLAIM CLOSED
```

------------------------------------------------------------------------

# 4. Payer Setup

## 4.1 Payer

``` text
payerId
payerCode
payerName
payerType
registrationNumber
taxId
contacts
claimsContact
financeContact
paymentTerms
apiEnabled
ediEnabled
portalEnabled
effectiveFrom
effectiveTo
status
branchId
```

Rules:

-   `branchId + payerCode` must be unique.
-   Payer must be active before an active scheme is allowed.
-   Effective dates must be valid.
-   All changes must be audited.

## 4.2 Contract

``` text
contractId
payerId
providerId
contractNumber
startDate
endDate
paymentTerms
providerNetwork
tariffAgreement
authorizationRules
claimRules
integrationProfileId
status
```

Payer-specific tariffs, benefits, limits, authorization rules and
mappings must be configurable and effective-date driven.

------------------------------------------------------------------------

# 5. Scheme and Policy

## 5.1 Hierarchy

``` text
Payer
  ↓
Contract
  ↓
Scheme
  ↓
Policy
  ↓
Principal Member
  ↓
Dependants
```

## 5.2 Scheme

``` text
schemeId
payerId
schemeCode
schemeName
schemeType
coverageType
networkType
startDate
endDate
annualLimit
opdLimit
ipdLimit
maternityLimit
dentalLimit
opticalLimit
roomLimit
copay
deductible
authorizationRequired
providerNetwork
paymentTerms
status
branchId
```

## 5.3 Policy

``` text
policyId
payerId
schemeId
policyNumber
holderPatientId
holderType
startDate
endDate
sumInsured
status
branchId
```

Never duplicate the existing HMS patient.

------------------------------------------------------------------------

# 6. Member Management

``` text
memberId
patientId
policyId
payerId
schemeId
memberNumber
principalMemberId
subscriberId
relationship
employer
effectiveDate
expiryDate
status
branchId
```

Statuses:

``` text
DRAFT
ACTIVE
SUSPENDED
EXPIRED
CANCELLED
DECEASED
TERMINATED
```

Only active and date-valid members should normally pass eligibility.

------------------------------------------------------------------------

# 7. Benefit Management

``` text
benefitId
schemeId
policyId
benefitCode
benefitType
name
benefitLimit
annualLimit
opdLimit
ipdLimit
frequencyLimit
usedAmount
remainingAmount
copay
deductible
waitingPeriod
exclusions
authorizationRequired
effectiveFrom
effectiveTo
status
```

Benefit decisions:

``` text
COVERED
PARTIALLY_COVERED
NOT_COVERED
AUTHORIZATION_REQUIRED
LIMIT_EXCEEDED
```

Rules must support:

-   Annual limits
-   Service limits
-   Frequency limits
-   Copay
-   Deductible
-   Exclusions
-   Waiting period
-   Remaining balance
-   Authorization requirement

------------------------------------------------------------------------

# 8. Tariff Management

``` text
tariffId
payerId
schemeId
serviceId
serviceCode
contractRate
patientRate
copay
effectiveFrom
effectiveTo
authorizationRequired
currency
status
```

`serviceId` references the existing HMS Service.

When used by a claim, snapshot the applicable tariff and financial facts
into the claim line.

------------------------------------------------------------------------

# 9. Integration Architecture

Do not put payer-specific code directly inside the claim module.

Use:

``` text
Insurance System
       ↓
Payer Integration Gateway
       ↓
Payer Adapter
       ↓
SHA / Private Insurer / TPA
```

The gateway handles:

``` text
Authentication
Request/Response Mapping
Validation
Idempotency
Retries
Errors
External References
Webhooks
Logging
```

Supported methods:

``` text
API
EDI
Portal
Secure File
Manual/Email
```

------------------------------------------------------------------------

# 10. Patient Insurance Coverage

Use the existing HMS patient:

``` text
Patient
  └── Insurance
       ├── Payer
       ├── Scheme
       ├── Policy
       ├── Member Number
       ├── Principal/Dependant
       ├── Coverage Dates
       └── Status
```

No duplicate patient record is allowed.

------------------------------------------------------------------------

# 11. Eligibility Verification

Workflow:

``` text
Patient
  ↓
Member Number
  ↓
Verify Membership
  ↓
Check Policy
  ↓
Check Effective Date
  ↓
Check Member Status
  ↓
Check Scheme
  ↓
Store Verification
  ↓
Eligibility Result
```

Channels:

``` text
API
EDI
Portal
Manual
```

Results:

``` text
ELIGIBLE
NOT_ELIGIBLE
INACTIVE
EXPIRED
NOT_FOUND
PENDING
MANUAL_VERIFICATION
```

Record:

``` text
eligibilityVerificationId
memberId
patientId
encounterId
payerId
schemeId
policyId
channel
requestedAt
responseAt
result
reason
validUntil
externalReference
status
```

------------------------------------------------------------------------

# 12. Benefit Verification

Workflow:

``` text
Eligible Member
  ↓
Identify Service
  ↓
Find Benefit
  ↓
Check Coverage
  ↓
Check Exclusions
  ↓
Check Limits/Frequency
  ↓
Calculate Copay/Deductible
  ↓
Check Authorization Requirement
  ↓
Benefit Decision
```

------------------------------------------------------------------------

# 13. Preauthorization

Authorization is required when payer/scheme/benefit rules demand it.

The service flow must explicitly branch here:

```text
Service Request
      ↓
Preauthorization Required?
      |
   +--+--+
  Yes     No
   |       |
   ↓       ↓
Submit   Provide
Authorization
Request   Service
```

If authorization is not required, the service can proceed directly to service delivery and the existing HMS service/invoice flow.

If authorization is required, continue through the authorization decision workflow below.

## Authorization

``` text
authorizationId
authorizationNumber
memberId
patientId
encounterId
payerId
schemeId
providerId
doctorId
diagnosis
clinicalJustification
requestedAt
decisionAt
requestedAmount
approvedAmount
expiryDate
urgency
externalReference
status
```

## Authorization Line

``` text
authorizationId
lineNo
serviceId
serviceCode
serviceName
quantity
requestedAmount
approvedAmount
decision
reason
```

## Status

``` text
DRAFT
SUBMITTED
PENDING
APPROVED
PARTIALLY_APPROVED
REJECTED
CANCELLED
EXPIRED
CLOSED
```

Workflow:

``` text
Service Requires Authorization
       ↓
Create Authorization
       ↓
Eligibility Check
       ↓
Benefit Check
       ↓
Clinical Review
       ↓
Cost Review
       ↓
Payer Decision
```

Maintain authorization history for every transition.

------------------------------------------------------------------------

# 14. Service Utilization

Authorization does not mean the service was actually consumed.

``` text
Authorized Service
       ↓
Service Actually Used
       ↓
Actual Quantity
       ↓
Actual Cost
       ↓
Benefit Utilization
       ↓
Remaining Authorization
       ↓
Remaining Benefit
```

Control:

``` text
Authorized Quantity vs Utilized Quantity
Authorized Amount vs Actual Amount
Remaining Authorization
Remaining Benefit
```

------------------------------------------------------------------------

# 15. Existing HMS Care and Billing

Insurance integrates with:

``` text
Patient
  ↓
Encounter
  ↓
Service
  ↓
Invoice
  ↓
Invoice Item
```

Insurance must reference these records rather than create copies.

------------------------------------------------------------------------

# 16. Claim Intake

Claim sources:

``` text
Hospital / Provider
Pharmacy
Laboratory
Doctor
Dental Provider
Optical Provider
Other Contracted Provider
```

Workflow:

``` text
Provider Service
      ↓
Claim Created
      ↓
Member Linked
      ↓
Authorization Linked
      ↓
Benefit Linked
      ↓
Invoice Linked
      ↓
Documents Linked
```

------------------------------------------------------------------------

# 17. Claim Model

## Claim

``` text
claimId
claimNumber
claimVersion
providerId
payerId
schemeId
policyId
memberId
patientId
encounterId
invoiceId
authorizationId
claimDate
serviceStartDate
serviceEndDate
submissionDate
grossAmount
allowedAmount
approvedAmount
rejectedAmount
patientResponsibility
paidAmount
outstandingAmount
externalReference
status
```

## Claim Line

``` text
claimLineId
claimId
lineNo
invoiceItemId
serviceId
serviceCode
serviceName
serviceDate
quantity
grossAmount
allowedAmount
approvedAmount
rejectedAmount
rejectionReason
status
```

Service and financial facts must be snapshots.

------------------------------------------------------------------------

# 18. Claim Documents

``` text
claimDocumentId
claimId
documentId
documentType
fileName
uploadedBy
uploadedAt
version
status
```

Examples:

``` text
Invoice
Clinical Report
Discharge Summary
Prescription
Lab Report
Imaging Report
Authorization
Referral
Other Supporting Document
```

Reuse existing HMS documents where applicable.

------------------------------------------------------------------------

# 19. Claim Validation

Validation sequence:

``` text
Patient
 ↓
Member
 ↓
Policy
 ↓
Eligibility
 ↓
Authorization
 ↓
Benefit
 ↓
Tariff
 ↓
Duplicate
 ↓
Documents
 ↓
Amount
```

Mandatory checks:

1.  Patient exists.
2.  Member exists.
3.  Member is active.
4.  Coverage dates are valid.
5.  Payer is active.
6.  Scheme is active.
7.  Policy is valid.
8.  Required authorization exists.
9.  Authorization is valid.
10. Claim has lines.
11. Invoice exists.
12. Invoice items exist.
13. Service is active/valid.
14. Benefit is available.
15. Tariff is valid.
16. Required documents exist.
17. Duplicate claim does not exist.
18. Claim amount is valid.
19. Claim version is current.
20. Required fields are present.

Outcomes:

``` text
VALIDATED
VALIDATION_FAILED
```

A claim cannot proceed to adjudication if mandatory validation fails.

------------------------------------------------------------------------

# 20. Claim Submission

``` text
DRAFT
  ↓
VALIDATING
  ↓
VALIDATED
  ↓
SUBMITTED
  ↓
Integration Message
  ↓
Payer Gateway
  ↓
External Payer
  ↓
ACKNOWLEDGED
```

Integration profile:

``` text
profileId
payerId
payerAdapter
endpoint
mappingVersion
secretReference
status
```

Integration message:

``` text
messageId
profileId
direction
type
correlationId
idempotencyKey
status
externalReference
retryCount
nextRetryAt
requestPayloadReference
responsePayloadReference
```

Retries must not create duplicate external claims.

------------------------------------------------------------------------

# 21. Claim Query

Workflow:

``` text
Claim
  ↓
Payer Query
  ↓
Assign
  ↓
Provider/Hospital Response
  ↓
Document Upload
  ↓
Review
  ↓
Resolve
  ↓
Resubmit
```

Statuses:

``` text
OPEN
ASSIGNED
AWAITING_PROVIDER
RESPONSE_RECEIVED
UNDER_REVIEW
RESOLVED
REJECTED
OVERDUE
```

------------------------------------------------------------------------

# 22. Claim Adjudication

Workflow:

``` text
Validated Claim
  ↓
Coverage
  ↓
Benefit
  ↓
Tariff
  ↓
Authorization
  ↓
Clinical/Rule Check
  ↓
Duplicate/Fraud Controls
  ↓
Financial Calculation
  ↓
Decision
```

Calculation:

``` text
Gross Claim
 - Contractual Adjustment
 - Non-Covered Amount
 - Benefit Limit Adjustment
 - Copay
 - Deductible
 = Insurance Liability
```

Decisions:

``` text
APPROVED
PARTIALLY_APPROVED
REJECTED
```

------------------------------------------------------------------------

# 23. Claim Rejection

Workflow:

``` text
Rejected
  ↓
Rejection Reason
  ↓
Provider Notification
  ↓
Correction / Appeal
  ↓
Internal Review
  ↓
Resubmission
  ↓
Adjudication
```

Reason examples:

``` text
INVALID_MEMBER
EXPIRED_POLICY
BENEFIT_EXHAUSTED
EXCLUDED_SERVICE
NO_AUTHORIZATION
AUTHORIZATION_EXCEEDED
INCORRECT_TARIFF
DUPLICATE_CLAIM
MISSING_DOCUMENTATION
DATA_ERROR
CODING_ERROR
OTHER
```

Every rejection requires a reason code.

------------------------------------------------------------------------

# 24. Appeals

``` text
Rejected / Disputed Claim
      ↓
Appeal Raised
      ↓
Supporting Documents
      ↓
Internal Review
      ↓
Appeal Submitted
      ↓
Payer Review
      ↓
Decision
```

Outcomes:

``` text
APPEAL_APPROVED
APPEAL_PARTIALLY_APPROVED
APPEAL_REJECTED
```

------------------------------------------------------------------------

# 25. Resubmission

Never overwrite the original submitted claim.

``` text
Claim Version 1
      ↓
Correction
      ↓
Claim Version 2
      ↓
Validation
      ↓
Submission
      ↓
Acknowledgement
      ↓
Adjudication
```

------------------------------------------------------------------------

# 26. Payment Batch

``` text
Approved Claims
      ↓
Payment Batch
      ↓
Payment Approval
      ↓
Payment Instruction
      ↓
Bank Payment
      ↓
Payment Confirmation
      ↓
Remittance
```

Statuses:

``` text
DRAFT
APPROVAL_PENDING
APPROVED
PROCESSING
PAID
PARTIALLY_ALLOCATED
FULLY_ALLOCATED
RECONCILED
```

------------------------------------------------------------------------

# 27. Payer Payment

Use dedicated insurance payment records.

``` text
paymentId
payerId
paymentMethod
amount
currency
paymentDate
bankReference
remittanceReference
status
```

Critical rule:

``` text
Patient Payment != Payer Payment
```

------------------------------------------------------------------------

# 28. Remittance

Remittance identifies which claims are included in a payer payment.

``` text
Payment
  ↓
Remittance
  ├── Claim Reference
  ├── Claim Amount
  ├── Paid Amount
  ├── Deduction
  └── Variance
```

Remittance must remain traceable to the payer bank payment.

------------------------------------------------------------------------

# 29. Payment Allocation

Workflow:

``` text
Payment Received
  ↓
Read Remittance
  ↓
Match Claim Numbers
  ↓
Match Amounts
  ↓
Allocate
  ↓
Calculate Variance
```

Allocation:

``` text
allocationId
paymentId
claimId
allocatedAmount
varianceAmount
varianceReason
status
```

Outcomes:

``` text
FULL_MATCH
PARTIAL_MATCH
OVERPAYMENT
UNDERPAYMENT
UNALLOCATED
```

Allocation must never exceed payer receipt.

------------------------------------------------------------------------

# 30. Three-Way Reconciliation

Match:

``` text
Approved Claim
      ↕
Remittance Advice
      ↕
Bank Payment
```

Results:

``` text
RECONCILED
VARIANCE
UNALLOCATED
PENDING_INVESTIGATION
```

Variance reasons:

``` text
CONTRACTUAL_DEDUCTION
BENEFIT_ADJUSTMENT
TARIFF_DIFFERENCE
DISPUTED_AMOUNT
ADMINISTRATIVE_DEDUCTION
OTHER
```

------------------------------------------------------------------------

# 31. Variance Resolution

``` text
Variance
  ↓
Investigation
  ↓
Reason
  ↓
Adjustment / Dispute / Write-off
  ↓
Approval
  ↓
Receivable Update
  ↓
Reconciliation
```

Every financial adjustment requires:

``` text
Reason
Approver
Timestamp
Audit Record
```

Posted financial records cannot be deleted.

------------------------------------------------------------------------

# 32. Receivable and Benefit Update

After allocation/reconciliation:

``` text
Approved Claim
  ↓
Payment
  ↓
Allocation
  ↓
Reconciliation
  ↓
Receivable Update
  ↓
Benefit Utilization Update
```

Example:

``` text
Approved = 100,000
Paid = 100,000
Outstanding = 0
```

Partial:

``` text
Approved = 100,000
Paid = 70,000
Outstanding = 30,000
```

Partially paid claims remain outstanding until resolved or formally
adjusted.

------------------------------------------------------------------------

# 33. Claim Closure

A claim can close after required processing is complete:

``` text
Adjudication
   +
Payment
   +
Allocation
   +
Reconciliation
   +
Outstanding Amount Resolved
   ↓
CLOSED
```

Closed claims cannot be directly edited.

Corrections must use controlled adjustment/resubmission.

------------------------------------------------------------------------

# 34. Complete Claim State Machine

``` text
DRAFT
  ↓
VALIDATING
  ↓
VALIDATION_FAILED
  ↓
CORRECTION
  ↓
VALIDATING
  ↓
READY_FOR_ADJUDICATION
  ↓
UNDER_REVIEW
  ├── APPROVED
  ├── PARTIALLY_APPROVED
  └── REJECTED
          ├── QUERY
          ├── APPEAL
          └── RESUBMISSION
                    ↓
                VALIDATING
                    ↓
                ADJUDICATION
                    ↓
              PAYMENT_PENDING
                    ↓
          PARTIALLY_PAID / PAID
                    ↓
                RECONCILED
                    ↓
                  CLOSED
```

Never allow direct:

``` text
DRAFT → PAID
SUBMITTED → PAID
```

------------------------------------------------------------------------

# 35. Member Lifecycle

``` text
DRAFT
  ↓
ACTIVE
  ↓
SUSPENDED
  ↓
ACTIVE
  ↓
EXPIRED
  ↓
TERMINATED
```

Other configured states may include:

``` text
CANCELLED
DECEASED
```

------------------------------------------------------------------------

# 36. Authorization Lifecycle

``` text
DRAFT
  ↓
SUBMITTED
  ↓
PENDING
  ├── APPROVED
  ├── PARTIALLY_APPROVED
  └── REJECTED
        ↓
EXPIRED / CANCELLED
        ↓
CLOSED
```

------------------------------------------------------------------------

# 37. Payment Lifecycle

``` text
DRAFT
  ↓
APPROVAL_PENDING
  ↓
APPROVED
  ↓
PROCESSING
  ↓
PAID
  ↓
PARTIALLY_ALLOCATED / FULLY_ALLOCATED
  ↓
RECONCILED
```

------------------------------------------------------------------------

# 38. Permissions

Create/extend:

``` text
INSURANCE_MASTER
INSURANCE_MEMBERSHIP
INSURANCE_ELIGIBILITY
INSURANCE_AUTHORIZATION
INSURANCE_CLAIMS
INSURANCE_ADJUDICATION
INSURANCE_PAYMENT
INSURANCE_APPEAL
INSURANCE_REPORT
```

Enforce server-side:

``` text
Authenticated User
Role
Permission
Branch Scope
Patient Scope
Resource Ownership
```

------------------------------------------------------------------------

# 39. Approval Rules

Approval limits must be configurable by:

``` text
Payer
Scheme
Transaction Type
Amount
```

Rules:

-   No user can approve their own transaction.
-   High-value authorizations require escalation.
-   High-value claims require escalation.
-   Financial adjustments require authorized approval.
-   Write-offs require authorized approval.
-   Material payment variances require Finance Manager/authorized
    management approval.
-   Overrides require reason, approver, timestamp and audit record.

------------------------------------------------------------------------

# 40. Audit

Audit at minimum:

``` text
Payer Created
Payer Activated
Scheme Created
Policy Created
Member Activated
Eligibility Verified
Benefit Verified
Authorization Submitted
Authorization Approved
Authorization Rejected
Service Utilized
Claim Created
Claim Validated
Claim Submitted
Claim Acknowledged
Claim Queried
Claim Resubmitted
Claim Adjudicated
Claim Rejected
Appeal Submitted
Payment Batch Created
Payment Approved
Payment Received
Payment Allocated
Payment Reversed
Reconciliation Completed
Financial Adjustment
Claim Closed
```

Capture:

``` text
actor
timestamp
branchId
resourceId
event
before
after
reasonCode
correlationId
```

Reuse existing HMS audit infrastructure.

------------------------------------------------------------------------

# 41. Notifications

Authorization:

``` text
Submitted
Approved
Rejected
Expiring
```

Claims:

``` text
Ready
Submitted
Acknowledged
Query
Rejected
Resubmission Due
Approved
Payment Received
```

Finance:

``` text
Payment Received
Variance
Unallocated Payment
Overdue Receivable
```

Channels where configured:

``` text
In-System
Email
SMS
```

------------------------------------------------------------------------

# 42. Main Screens

``` text
Insurance Dashboard
Payers
Contracts
Schemes
Policies
Members
Benefits
Benefit Rules
Tariffs
Eligibility
Authorizations
Service Utilization
Claims
Claim Queries
Appeals
Payments
Payment Batches
Remittance
Allocation
Reconciliation
Receivables
Reports
```

Claim Detail:

``` text
Claim Header
Patient
Member
Payer
Scheme
Policy
Provider
Encounter
Invoice
Claim Lines
Validation
Authorization
Service Utilization
Documents
Queries
Rejections
Resubmissions
Appeals
Adjudication
Payment
Remittance
Allocation
Reconciliation
Audit
```

------------------------------------------------------------------------

# 43. Reports

Claims:

``` text
Submitted
Approved
Rejected
Queried
Pending
Paid
Outstanding
Aging
By Payer
By Scheme
By Provider
Rejection Analysis
```

Membership:

``` text
Active
Expired
New
Dependants
Benefit Utilization
```

Finance:

``` text
Receivables
Payment Reconciliation
Unallocated Payments
Payment Variance
Outstanding Balances
Write-offs
```

Authorization:

``` text
Pending
Approved
Rejected
High-Value
Expiring
Utilization vs Authorization
```

------------------------------------------------------------------------

# 44. Core Database Tables

``` text
payers
insurance_contracts
insurance_schemes
insurance_policies
insurance_members
insurance_benefits
insurance_benefit_rules
insurance_benefit_utilization
payer_tariffs
insurance_eligibility_verifications
insurance_authorizations
insurance_authorization_lines
insurance_authorization_history
insurance_service_utilization
insurance_claims
insurance_claim_lines
insurance_claim_documents
insurance_claim_validations
insurance_integration_profiles
insurance_integration_messages
insurance_claim_queries
insurance_claim_adjudications
insurance_claim_adjudication_lines
insurance_claim_appeals
insurance_claim_appeal_documents
insurance_payment_batches
insurance_payments
insurance_remittances
insurance_payment_allocations
insurance_reconciliations
insurance_financial_adjustments
```

------------------------------------------------------------------------

# 45. Common Insurance Fields

Where applicable:

``` text
_id
branchId
version
createdAt
createdBy
updatedAt
updatedBy
status
reasonCode
correlationId
auditReference
```

Money must contain currency.

Event timestamps must use UTC.

------------------------------------------------------------------------

# 46. Mandatory Safety Rules

## Duplicate prevention

``` text
payer = branchId + payerCode
scheme = branchId + payerId + schemeCode
policy = branchId + payerId + policyNumber
member = branchId + payerId + memberNumber
claim = branchId + claimNumber + claimVersion
claimLine = claimId + lineNumber
payment = branchId + payerId + bankReference
integrationMessage = profileId + idempotencyKey
```

## Financial

-   Allocation cannot exceed payer receipt.
-   Posted financial records cannot be deleted.
-   Reversal creates a linked reversal record.
-   Patient payments are never interpreted as payer payments.

## Lifecycle

-   UI cannot bypass service transition rules.
-   Stale transitions are rejected.
-   Rejection, cancellation, override, adjustment and reversal require
    reason codes.
-   Closed claims cannot be edited directly.

------------------------------------------------------------------------

# 47. Legacy Three-Day MVP Reference — Non-Production Only

The full architecture above is the target architecture. The following
3-day outline may be used only for a disposable, non-production workflow
spike. It must not be used to commit production insurance, adjudication,
payment, allocation or reconciliation functionality. Production delivery
must follow the controlled execution plan referenced in Section 60.

## Day 1 --- Insurance Foundation

Implement:

``` text
Payer
Scheme
Policy
Member
Benefit
Tariff
Patient Insurance Section
```

Screens:

``` text
Insurance Dashboard
Payers
Schemes
Policies
Members
Benefits
Tariffs
```

Exit criteria:

-   Payer CRUD works.
-   Scheme CRUD works.
-   Policy links to existing patient.
-   Member can be created/activated.
-   Benefit can be configured.
-   Tariff references existing Service.
-   Branch scope works.
-   Uniqueness works.
-   Audit works.
-   No duplicate HMS master records are created.

## Day 2 --- Coverage to Claim

Implement:

``` text
Eligibility
Benefit Verification
Mock Payer Adapter
Preauthorization
Authorization Lines
Authorization History
Service Utilization Foundation
Claim Preparation
Claim Documents Foundation
Claim Draft
```

Demonstrate:

``` text
Patient
 → Member
 → Eligibility
 → Benefits
 → Authorization
 → Service
 → Invoice
 → Claim Draft
```

## Day 3 --- Claim to Closure

Implement:

``` text
Claim Validation
Claim Submission
Integration Profile
Integration Message
Idempotency
Mock Payer Acknowledgement
Claim Query
Adjudication
Payer Payment
Payment Allocation
Basic Reconciliation
Basic Appeal
Claim Closure
Dashboard
Claim Detail
```

Demonstrate:

``` text
Claim Draft
 → Validation
 → Submission
 → Acknowledgement
 → Query if required
 → Adjudication
 → Payment
 → Allocation
 → Reconciliation
 → Closure
```

------------------------------------------------------------------------

# 48. Legacy Three-Day Estimate — Not a Production Commitment

## Day 1 --- 8 hours

``` text
Architecture analysis       0.5h
Insurance models            2.0h
Payer/Scheme/Policy         1.0h
Member/Benefits/Tariff      1.5h
Patient Insurance UI        1.5h
Validation/Audit            0.75h
Testing/Fixes               0.75h
Total                       8.0h
```

## Day 2 --- 8 hours

``` text
Eligibility                 1.25h
Benefit Verification        1.00h
Mock Payer Adapter           0.75h
Authorization                2.00h
Authorization History        0.50h
Service Utilization/Claims  1.75h
Testing/Fixes                0.75h
Total                        8.0h
```

## Day 3 --- 8 hours

``` text
Claim Validation             1.00h
Submission/Idempotency       0.75h
Query Handling               0.50h
Adjudication                 1.50h
Payment/Allocation           1.25h
Reconciliation/Closure       0.75h
Dashboard/Claim Detail       0.50h
E2E Testing/Bug Fixing       1.00h
Final Verification           0.75h
Total                        8.0h
```

------------------------------------------------------------------------

# 49. MVP Out of Scope

Do not consume the 24-hour MVP timebox with:

``` text
Production SHA integration
Production private payer integration
Insurer certification
Full EDI implementation
Complex payer payload mapping
Advanced dynamic benefit engine
Full finance reconciliation engine
Advanced approval/batch workflows
Complex multi-level appeals
Advanced provider contract management
Advanced tariff engine
Advanced BI
Automated SLA workers
Advanced notification orchestration
Historical data migration
Production security certification
Full UAT
Performance/load testing
```

These become post-MVP phases.

------------------------------------------------------------------------

# 50. Post-MVP Roadmap

## Phase 2 --- Real Payer Integration

``` text
Real API
EDI
Portal
Secure File
Retry Queues
Webhooks
Payer Mapping
External References
Remittance Ingestion
```

## Phase 3 --- Advanced Insurance

``` text
Dynamic Benefit Rules
Complex Authorization Rules
Provider Contracts
Advanced Tariffs
Service Utilization Controls
Query SLA
Advanced Rejection/Resubmission
Advanced Appeals
```

## Phase 4 --- Finance

``` text
Payment Batches
Approval Matrix
Remittance Processing
Three-Way Reconciliation
Variance Management
Adjustments
Reversals
Write-offs
Aging
Receivables
```

## Phase 5 --- Operations

``` text
Management Dashboards
Payer Performance
Claims Analytics
Membership Analytics
Financial Analytics
Monitoring
Audit Reporting
Migration
Full UAT
Performance Testing
Production Security
```

------------------------------------------------------------------------

# 51. Agent Execution Rules

Before changing code:

1.  Inspect the current HMS architecture.
2.  Identify Patient, Encounter, Service, Invoice, Invoice Item,
    Document, Branch, User, Role, Audit and Notification
    implementations.
3.  Reuse existing services/components/utilities.
4.  Do not create duplicate HMS master records.
5.  Follow existing naming conventions.
6.  Follow existing API/error conventions.
7.  Follow existing authentication/authorization.
8.  Follow existing UI patterns.
9.  Do not introduce new frameworks unless necessary.
10. Keep insurance changes isolated.
11. Preserve existing HMS behavior.
12. Use controlled status transitions.
13. Keep payer-specific logic behind integration interfaces.
14. Keep posted financial records immutable.
15. Add audit events for important state changes.

After each phase:

``` text
Run tests
Inspect changed files
Verify migrations
Verify APIs
Verify permissions
Verify audit
Verify status transitions
Verify financial constraints
Verify idempotency
Verify no unrelated HMS module is broken
```

Do not spend MVP time on cosmetic improvements while P0 workflow is
incomplete.

------------------------------------------------------------------------

# 52. Codex Agent Prompt --- Day 1

> Analyze the existing HMS repository before changing code.
>
> Identify Patient, Encounter, Service, Invoice, Invoice Item, Document,
> Branch, User, Role, Audit and Notification implementations.
>
> Implement the insurance foundation using the existing architecture.
>
> Create/implement Payer, Contract foundation, Insurance Scheme,
> Insurance Policy, Insurance Member, Insurance Benefit and Payer
> Tariff.
>
> Reuse patientId, serviceId and branchId.
>
> Implement CRUD, validation, uniqueness, branch scope, effective dates,
> status handling and audit.
>
> Add an Insurance section to the existing Patient context.
>
> Create clean architecture hooks for Provider, Dependants, Benefit
> Rules, Service Utilization and Payer Integration.
>
> Do not create duplicate Patient, Service, Encounter or Invoice models.
>
> Do not implement real payer integration on Day 1.
>
> Run tests and report files changed, APIs, models, UI, tests and
> remaining issues.

------------------------------------------------------------------------

# 53. Codex Agent Prompt --- Day 2

> Continue from Day 1.
>
> Implement Eligibility Verification, Benefit Verification,
> Preauthorization, Authorization Lines, Authorization History, Service
> Utilization foundation, Mock Payer Adapter, Claim Preparation, Claim
> Documents foundation and Claim Draft.
>
> Reuse existing Patient, Encounter, Service, Invoice and Invoice Item.
>
> Implement membership, policy, coverage, benefit, authorization and
> utilization validations.
>
> Create claims from existing HMS billing records and snapshot required
> service and financial facts.
>
> Keep payer integration behind an adapter interface.
>
> Demonstrate:
>
> Patient → Member → Eligibility → Benefits → Authorization → Service →
> Invoice → Claim Draft
>
> Run focused tests and report changes.

------------------------------------------------------------------------

# 54. Codex Agent Prompt --- Day 3

> Continue from Day 2 and complete the minimum end-to-end insurance
> lifecycle.
>
> Implement:
>
> Claim Validation → Submission → Acknowledgement → Query → Adjudication
> → Payer Payment → Allocation → Reconciliation → Closure.
>
> Implement claim validation records, integration profiles, integration
> messages, idempotency, mock payer response, claim query, adjudication,
> benefit utilization, payer payment, payment allocation, basic
> reconciliation, basic appeal, claim closure, Insurance Dashboard and
> Claim Detail.
>
> Ensure payer payments remain separate from patient billing payments.
>
> Implement duplicate prevention, claim version checks, allocation
> limits, reversal-safe financial handling and audit logging.
>
> Execute positive and negative end-to-end tests.
>
> Fix P0/P1 issues first.
>
> Report files changed, APIs, models, status transitions, test results,
> known limitations and production follow-up items.

------------------------------------------------------------------------

# 55. Master End-to-End Business Flow — Diagram-Aligned

This is the canonical business workflow for the implementation. The detailed architecture sections above provide the data model, controls and technical behavior behind each step.

```text
1. Set up Payer
        ↓
2. Set up Contract
        ↓
3. Set up Scheme
        ↓
4. Set up Policy
        ↓
5. Configure Benefits
        ↓
6. Configure Tariffs
        ↓
7. Configure Authorization Rules
        ↓
8. Configure Payer Integration
        ↓
9. Activate Payer/Scheme
        ↓
10. Register / Identify Member
        ↓
11. Verify Eligibility and Benefits
        ↓
12. Eligible and Service Covered?
        |
        +---- NO
        |      ↓
        |  Resolve Coverage Issue
        |  or Confirm Patient Payment
        |
        +---- YES
               ↓
13. Preauthorization Required?
        |
        +---- NO
        |      ↓
        |  Provide Service
        |
        +---- YES
               ↓
14. Submit Authorization Request
               ↓
15. Authorization Decision
        |
        +---- REJECTED
        |      ↓
        |  Resolve Coverage Issue
        |  or Confirm Patient Payment
        |
        +---- APPROVED /
             PARTIALLY APPROVED
                ↓
16. Provide Approved Service
                ↓
17. Record Service Utilization
                ↓
18. Finalize Service and HMS Invoice
                ↓
19. Create and Submit Claim
                ↓
20. Validate Member, Coverage,
    Authorization, Benefit,
    Tariff, Documents, Duplicate
    and Amount
                ↓
21. Validation Passed?
        |
        +---- NO
        |      ↓
        |  Correct Claim
        |      ↓
        |  Resubmit
        |      ↓
        |  Validate Again
        |
        +---- YES
               ↓
22. Submit Claim to Payer
               ↓
23. Payer Acknowledgement
               ↓
24. Claim Adjudication / Claim Decision
        |
        +---- QUERY
        |      ↓
        |  Provide Response / Documents
        |      ↓
        |  Review Claim
        |      ↓
        |  Continue / Resubmit
        |
        +---- REJECTED
        |      ↓
        |  Appeal or Correct?
        |      |
        |      +---- APPEAL
        |      |      ↓
        |      |  Submit Appeal
        |      |      ↓
        |      |  Appeal Decision
        |      |
        |      +---- CORRECT
        |             ↓
        |         Correct & Resubmit
        |
        +---- APPROVED /
             PARTIALLY APPROVED
                ↓
25. Record Approved Amount
    and Outstanding Balance
                ↓
26. Payment Batch / Payment Processing
                ↓
27. Receive Payer Payment
    and Remittance
                ↓
28. Allocate Payment to Claims
                ↓
29. Amounts Match?
        |
        +---- YES
        |      ↓
        |  Reconcile and Close Claim
        |
        +---- NO
               ↓
30. Investigate Variance
               ↓
31. Resolve Balance
               ↓
32. Adjustment / Dispute / Write-off
               ↓
33. Approval
               ↓
34. Reallocate / Reconcile
               ↓
35. Update Receivable
               ↓
36. Close Claim
```

---

# 56. Mandatory Positive Acceptance Test

The agent must demonstrate the following successful path:

```text
Payer
 ↓
Contract
 ↓
Scheme
 ↓
Policy
 ↓
Benefit
 ↓
Tariff
 ↓
Integration
 ↓
Existing HMS Patient
 ↓
Member
 ↓
Eligibility
 ↓
Benefit Verification
 ↓
Coverage Decision
 ↓
Preauthorization Decision
 ↓
Service Utilization
 ↓
Existing HMS Encounter
 ↓
Existing HMS Service
 ↓
Existing HMS Invoice
 ↓
Insurance Claim
 ↓
Claim Documents
 ↓
Claim Validation
 ↓
Claim Submission
 ↓
Payer Acknowledgement
 ↓
Claim Adjudication / Decision
 ↓
Payment Batch
 ↓
Payer Payment
 ↓
Remittance
 ↓
Payment Allocation
 ↓
Three-Way Reconciliation
 ↓
Receivable Update
 ↓
Benefit Utilization Update
 ↓
Audit
 ↓
Claim Closure
```

The agent must also demonstrate the two important coverage branches:

### Coverage Not Available

```text
Eligibility / Benefit Verification
        ↓
Service Covered?
        ↓
NO
        ↓
Resolve Coverage Issue
OR
Confirm Patient Payment
```

### Authorization Not Required

```text
Service Covered?
        ↓
Preauthorization Required?
        ↓
NO
        ↓
Provide Service
        ↓
Finalize HMS Service/Invoice
        ↓
Create Claim
```

### Authorization Rejected

```text
Authorization Decision
        ↓
REJECTED
        ↓
Resolve Coverage Issue
OR
Confirm Patient Payment
```

---

# 57. Mandatory Negative Tests

Test at least:

```text
Inactive Member
Expired Policy
Member Not Found
Benefit Not Covered
Benefit Limit Exceeded
Authorization Required
Authorization Rejected
Authorization Expired
Missing Claim Document
Invalid Tariff
Duplicate Claim
Invalid Claim Amount
Claim Query
Claim Rejection
Claim Resubmission
Appeal
Partial Adjudication
Partial Payment
Underpayment
Overpayment
Unallocated Payment
Reconciliation Variance
Unauthorized Adjustment
Duplicate Integration Submission
Invalid Status Transition
```

---

# 58. Repository-Alignment Addendum — Authoritative

This section resolves differences between the generic insurance workflow
and the actual HMS repository. If an earlier section conflicts with this
addendum, this addendum takes precedence.

## 58.1 Existing clinical context is polymorphic

The current HMS does not provide one universal Encounter model. Insurance
must reuse the existing clinical source context:

``` text
sourceType: OPD_VISIT | EMERGENCY_ENCOUNTER | INPATIENT_ADMISSION | PROCEDURE_BOOKING
sourceId
patientId
branchId
encounterId?
admissionId?
procedureId?
visitId?
```

References to `encounterId` elsewhere in this document mean this approved
source-context structure. Do not create a duplicate generic Encounter.

## 58.2 Stable references and immutable snapshots

Insurance records must reference existing Patient, Service, Invoice,
Invoice Item and Patient Document records. Claim and authorization lines
must also snapshot the material facts used for the decision, including
service code/name, service date, quantity, charge, tariff, currency and
relevant source version. Later edits to HMS masters or invoices must not
silently rewrite a submitted claim.

## 58.3 Billing and insurer finance remain separate

- Existing billing invoices remain the patient/service charge ledger.
- Existing billing payments remain patient or self-pay transactions.
- Claim status must not be stored as invoice status.
- Payer payment, remittance, allocation, reconciliation and reversal must
  use dedicated Insurance records.
- A payer settlement must not automatically set the HMS invoice to paid.
  Any future cross-ledger posting requires a separately approved contract.

## 58.4 Coverage evidence is not verified coverage

An existing Patient Document with insurance metadata is evidence only.
Active coverage requires a structured Insurance Member/Policy record and,
where required, a dated eligibility verification. Insurance documents may
be linked using `patientDocumentId`; they must not be treated as membership.

## 58.5 Benefit utilization is ledger-based

Do not rely only on mutable `usedAmount` or `remainingAmount` counters.
Maintain immutable utilization entries such as `RESERVE`, `CONSUME`,
`RELEASE`, `REVERSE` and `ADJUST`, and derive or transactionally maintain
the balance. Every adjustment requires actor, reason, timestamp and source.

## 58.6 Concurrency, idempotency and transactions

- Every workflow transition must use an explicit transition map and a
  version/conditional update to reject stale writes.
- Submission, webhook and posting commands require idempotency keys and
  unique indexes.
- Multi-document financial, utilization and claim-state operations must be
  transactional and fail closed when MongoDB transactions are unavailable.
  The existing fallback that executes without a transaction is not
  permitted for these Insurance commands.
- Posted financial records are corrected using reversal/adjustment records,
  never destructive edits.

## 58.7 Scope and authority decisions required before implementation

Phase 0 must explicitly approve:

``` text
Provider-side claims only vs in-HMS payer adjudication
Global vs organization/branch ownership of payer and scheme masters
Provider identity: organization/hospital/branch mapping
Eligible invoice statuses and claimable item rules
Money representation, currency snapshot and rounding rules
Member/dependant uniqueness and overlapping coverage rules
Claim numbering, versioning, correction and resubmission rules
Authorization expiry, extension, cancellation and utilization rules
Patient-responsibility and cross-ledger posting rules
Retention, document requirements and external payer integration ownership
```

Do not infer these safety or finance rules from UI behavior.

## 58.8 Existing infrastructure to reuse

- Use the existing Fastify module registration, service registry,
  repository/service separation, Zod validation and API response format.
- Reuse authenticated user and branch scope; never trust frontend scope.
- Reuse the existing audit collection. Store insurance resource,
  before/after, reason, correlation and source identifiers in structured
  audit metadata rather than creating another audit subsystem.
- Reuse the notification infrastructure. Add synchronized backend and
  frontend notification types only when approved; `GENERAL` may be used
  initially where a specialized type is unnecessary.
- Reuse Patient, Service, Billing, Settings and Patient Document APIs
  through narrow read contracts. Do not query their models from Insurance
  services.
- Reuse existing UI components, permission gates, URL query state, TanStack
  Query conventions, React Hook Form, Zod and Sonner.

## 58.9 Money, integration and production restrictions

- Insurance must use the shared HMS Finance Money & Currency Policy; it must
  not define independent currency, rounding, tax or reconciliation rules.
- Currency codes and minor-unit metadata use centrally maintained ISO 4217
  definitions. The current single-hospital deployment maps finance policy to
  singleton Settings; do not introduce an Insurance-only Organization model.
- New financial persistence uses integer `amountMinor` plus `currencyCode`.
  Intermediate calculations use an approved high-precision decimal
  MoneyService and centralized currency-specific rounding.
- Finance policies are effective-dated, versioned and maker-checker approved:
  `DRAFT -> PENDING_APPROVAL -> APPROVED -> ACTIVE -> SUPERSEDED`.
  Active policies are never edited in place, and financial transactions
  snapshot the applied policy version.
- Claim-comparison and payment-reconciliation tolerances are separate policy
  values. Tax rounding supports approved `LINE` or `DOCUMENT` strategy.
- No implicit currency conversion is permitted. Cross-currency settlement
  requires an approved, dated and auditable exchange-rate contract.
- Engineering defaults may seed a non-active draft policy only. Production
  financial processing fails closed unless an approved active policy applies.
- The current Billing module stores JavaScript numbers without transaction
  currency and hard-rounds to two decimals. Do not refactor or migrate Billing
  incidentally during Insurance work. The shared Finance Foundation,
  compatibility adapter and any migration require separate explicit approval.
- A mock payer adapter is allowed only in automated tests or an explicit
  non-production environment. It must not be a production fallback.
- External payloads, retries and acknowledgements must be recorded in
  dedicated integration records without logging patient-sensitive data.

## 58.10 Phase stop gate

No phase is complete until API and web typecheck, lint and build pass,
focused authorization/scope/concurrency/idempotency tests pass, live API
behavior is verified, and a phase verification note is recorded. Do not
start the next phase without explicit approval.

------------------------------------------------------------------------

# 59. Two-Developer Delivery and Merge Contract

The authoritative implementation split for Kamesh and Fazil is defined in:

`HMS_INSURANCE_TWO_DEVELOPER_PHASE_WISE_EXECUTION_PLAN.md`

The ownership boundary is:

``` text
Kamesh: Insurance backend, database, backend RBAC/audit/integration contracts
Fazil:  Insurance frontend, UI routing, frontend access control and UX
```

Kamesh must not edit `apps/web` Insurance implementation files. Fazil must
not edit `apps/api` Insurance implementation files. Shared backend registry
and seed files belong only to Kamesh; shared frontend route, sidebar and
access-control files belong only to Fazil. API contracts are frozen at the
start of each implementation phase, and contract changes require a new
contract revision before either developer continues.

------------------------------------------------------------------------

# 60. Final Architecture Rule

The final implementation must preserve:

```text
                 EXISTING HMS
                      |
        +-------------+-------------+
        |             |             |
     Patient       Clinical       Billing
        |          Encounter      Invoice
        |             |             |
        +-------------+-------------+
                      |
                      v
              INSURANCE PLATFORM
                      |
       +--------------+--------------+
       |              |              |
    Coverage        Claims         Finance
    Eligibility     Adjudication   Settlement
    Benefits        Appeals        Allocation
    Preauth         Queries        Reconciliation
                      |
                      v
               PAYER GATEWAY
                      |
            +---------+---------+
            |         |         |
           SHA     Insurer     TPA
```

**Insurance extends the HMS; it does not duplicate the HMS.**

Production insurance delivery must follow approved phase contracts, strict
verification gates and the two-developer execution plan. A 3-day spike, if
separately authorized, must remain isolated from production data and must
not be represented as a production-ready insurance lifecycle.

The canonical visual/business flow and the technical implementation flow must remain aligned:

```text
Setup
 → Member
 → Eligibility & Benefits
 → Coverage Decision
 → Preauthorization Decision
 → Service
 → HMS Invoice
 → Claim
 → Validation
 → Claim Adjudication / Decision
 → Query / Rejection / Appeal / Resubmission when required
 → Payment
 → Remittance
 → Allocation
 → Reconciliation
 → Variance Resolution when required
 → Receivable Update
 → Closure
```
