# AGENTS.md --- HMS Insurance 3-Day MVP

## Objective

Implement a **working, testable insurance MVP in 3 working days /
approximately 24 hours** using the existing HMS architecture.

The MVP must cover:

`Patient → Insurance Coverage → Eligibility → Benefits → Preauthorization → HMS Service/Invoice → Claim → Validation → Submission → Adjudication → Payer Payment → Allocation → Reconciliation → Closure`

This is a **scope-controlled MVP**, not the complete production-grade
insurance platform.

The field mapping analysis confirms that HMS already has authoritative
Patient, Patient Document, Encounter, Service, Invoice, Invoice Item,
User/Role, Branch, Audit and Notification infrastructure, while payer,
policy, eligibility, authorization, claim, adjudication, remittance and
insurer settlement require dedicated insurance records.
fileciteturn3file0L5-L18

------------------------------------------------------------------------

# 1. Non-Negotiable Architecture Rules

## Reuse / Reference

Reuse existing HMS records:

-   `patientId` → existing Patient
-   `documentId` → existing Patient Document
-   `encounterId` → existing OPD/IP/Emergency Encounter
-   `serviceId` → existing Service
-   `invoiceId` → existing Invoice
-   `invoiceItemId` → existing Invoice Item
-   `userId` / role → existing User and Role
-   `branchId` → existing Branch
-   audit → existing Audit infrastructure
-   notifications → existing Notification infrastructure

The field mapping specifically states that patient demographics,
services, users, roles, doctors, departments, branches, encounters,
invoices and patient documents must remain in their existing domains.
fileciteturn3file0L201-L226

## Never Reuse

Do **not** use:

-   patient payment records as payer settlement
-   invoice status as claim status
-   generic insurance document metadata as verified coverage
-   browser/localStorage prototype data as production insurance data

Payer settlement must have dedicated insurance payment/allocation
records. fileciteturn3file0L201-L226

## Common Insurance Fields

Every insurance record should follow the existing application's
conventions and, where applicable, contain:

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
audit reference
```

Money must include currency. Event timestamps should be UTC.

------------------------------------------------------------------------

# 2. Three-Day Scope

## DAY 1 --- Insurance Foundation and Coverage

### Goal

Create the insurance master/coverage foundation and connect it to the
existing Patient.

### P0 Models / Collections

Implement:

1.  `payers`
2.  `insurance_schemes`
3.  `insurance_policies`
4.  `insurance_members`
5.  `insurance_benefits`
6.  `payer_tariffs`

These are the core fields identified in the mapping document.
fileciteturn3file0L83-L114

### Payer

``` text
payerCode
name
type
taxId
contacts
address
portalUrl
status
branchId
```

Rules:

-   unique `branchId + payerCode`
-   active payer required for active schemes
-   reference existing branch

### Scheme

``` text
payerId
schemeCode
name
planType
coverageType
networkType
effectiveFrom
effectiveTo
status
branchId
```

Rules:

-   reference `payerId`
-   unique payer/branch scheme code
-   validate coverage dates

### Policy

``` text
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

Rules:

-   `holderPatientId` references the existing patient
-   unique policy number in the applicable scope
-   never duplicate patient demographics

### Member

``` text
policyId
patientId
memberNumber
subscriberId
relationship
coverageStart
coverageEnd
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
TERMINATED
```

Only ACTIVE and date-valid members can pass eligibility.

### Benefits

Minimum:

``` text
schemeId
policyId
benefitCode
name
annualLimit
opdLimit
ipdLimit
copay
deductible
waitingPeriod
exclusions
status
```

### Payer Tariff

``` text
payerId
schemeId
serviceId
code
amount
currency
effectiveFrom
effectiveTo
status
```

`serviceId` references the existing service. Snapshot the applicable
contracted price when used by a claim.

### Day 1 UI

Implement only functional screens:

``` text
Insurance Dashboard
Payers
Schemes
Policies
Members
Benefits
Tariffs
```

Add an Insurance section to the existing Patient page:

``` text
Patient
  └─ Insurance
      ├─ Payer
      ├─ Scheme
      ├─ Policy
      ├─ Member
      ├─ Coverage Dates
      └─ Status
```

### Day 1 Exit Criteria

-   Payer CRUD works.
-   Scheme CRUD works.
-   Policy can be linked to an existing patient.
-   Member can be created.
-   Benefit can be configured.
-   Tariff can reference an existing service.
-   Branch scope and uniqueness work.
-   Audit events are created.
-   No duplicate patient/service/invoice records are introduced.

------------------------------------------------------------------------

# 3. DAY 2 --- Eligibility, Benefits, Authorization and Claim Preparation

## Goal

Connect insurance coverage to HMS encounters/services and create a
claim.

------------------------------------------------------------------------

## 3.1 Eligibility

Create:

`insurance_eligibility_verifications`

Fields:

``` text
memberId
patientId
encounterId
channel
requestedAt
responseAt
result
reason
validUntil
externalReference
status
```

Results:

``` text
ELIGIBLE
NOT_ELIGIBLE
EXPIRED
SUSPENDED
NOT_FOUND
VERIFICATION_FAILED
```

Workflow:

``` text
Existing Patient
 → Select Insurance
 → Verify Eligibility
 → Validate Member
 → Validate Policy Dates
 → Validate Scheme
 → Store Verification
 → Display Result
```

The field mapping identifies eligibility verification as a new insurance
transaction rather than a manual review. fileciteturn3file0L24-L50

------------------------------------------------------------------------

## 3.2 Benefit Verification

Verify:

``` text
Membership Active
Policy Active
Coverage Valid
Benefit Exists
Service Covered
Remaining Limit
Copay
Deductible
Authorization Required
```

Return one of:

``` text
COVERED
NOT_COVERED
AUTHORIZATION_REQUIRED
LIMIT_EXCEEDED
```

For the 3-day MVP, implement simple benefit rules rather than a complete
dynamic rule engine.

------------------------------------------------------------------------

## 3.3 Optional Benefit Rule Model

If time permits, create:

`insurance_benefit_rules`

``` text
benefitId
serviceId
ruleType
operator
value
priority
effectiveFrom
effectiveTo
status
```

Implement only:

``` text
COVERED
NOT_COVERED
LIMIT
COPAY
DEDUCTIBLE
AUTH_REQUIRED
```

------------------------------------------------------------------------

## 3.4 Preauthorization

Create:

`insurance_authorizations`

``` text
authorizationNumber
memberId
patientId
encounterId
providerId
doctorId
diagnosis
requestedAt
decisionAt
requestedAmount
approvedAmount
expiryDate
status
```

Create:

`insurance_authorization_lines`

``` text
authorizationId
lineNo
serviceId
serviceCode
quantity
requestedAmount
approvedAmount
decision
reason
```

Statuses:

``` text
DRAFT
SUBMITTED
PENDING
APPROVED
PARTIALLY_APPROVED
REJECTED
EXPIRED
CANCELLED
```

Create basic history:

`insurance_authorization_history`

``` text
authorizationId
fromStatus
toStatus
actorId
timestamp
reason
externalReference
snapshot
```

Workflow:

``` text
Service Requires Authorization
 → Create Authorization
 → Add Lines
 → Submit
 → Mock Payer Decision
 → Approved / Partially Approved / Rejected
 → Store History
```

------------------------------------------------------------------------

## 3.5 Mock Payer Adapter

Implement:

``` text
Insurance Service
      ↓
Payer Adapter Interface
      ↓
Mock Payer Adapter
```

Methods:

``` text
verifyEligibility()
verifyBenefits()
submitAuthorization()
getAuthorizationDecision()
submitClaim()
getClaimAcknowledgement()
getClaimAdjudication()
```

Do not connect to a real payer during the 3-day implementation unless an
already-working sandbox is provided.

The adapter must be replaceable later by API/EDI/portal/file
integrations.

------------------------------------------------------------------------

## 3.6 Care and Billing Integration

Use existing:

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

Insurance must reference these records rather than duplicate them.

At claim preparation:

-   validate invoice
-   validate invoice items
-   validate service
-   validate member
-   validate authorization where required
-   snapshot the charge/service facts
-   do not modify the source invoice

------------------------------------------------------------------------

## 3.7 Claim

Create:

`insurance_claims`

``` text
claimNumber
claimVersion
payerId
memberId
patientId
encounterId
invoiceId
claimDate
submissionDate
grossAmount
allowedAmount
approvedAmount
rejectedAmount
patientResponsibility
externalReference
status
```

Create:

`insurance_claim_lines`

``` text
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
reason
```

Claim statuses:

``` text
DRAFT
VALIDATED
SUBMITTED
ACKNOWLEDGED
QUERIED
UNDER_REVIEW
APPROVED
PARTIALLY_APPROVED
REJECTED
PAID
CLOSED
CANCELLED
```

Claim line service code/name and financial facts must be snapshots so
the submitted claim remains reproducible.
fileciteturn3file0L129-L147

### Day 2 Exit Criteria

The following must work:

``` text
Patient
 → Member
 → Eligibility
 → Benefit Verification
 → Authorization
 → Existing Encounter
 → Existing Invoice
 → Claim Draft
```

------------------------------------------------------------------------

# 4. DAY 3 --- Validation, Submission, Adjudication, Payment and Closure

## Goal

Complete the basic end-to-end insurance lifecycle.

------------------------------------------------------------------------

## 4.1 Claim Validation

Create:

`insurance_claim_validations`

``` text
claimId
claimVersion
ruleCode
ruleVersion
result
reason
fieldPath
checkedAt
overrideActor
overrideReason
```

Mandatory validations:

1.  Patient exists.
2.  Member exists.
3.  Member is ACTIVE.
4.  Coverage dates are valid.
5.  Payer is active.
6.  Scheme is active.
7.  Required authorization exists.
8.  Authorization is not expired.
9.  Claim has lines.
10. Invoice exists.
11. Invoice items exist.
12. Service is active.
13. Duplicate claim does not exist.
14. Claim amount is valid.
15. Required documents exist.
16. Claim version is current.

A claim cannot proceed when mandatory validation fails.

------------------------------------------------------------------------

## 4.2 Claim Submission

Create minimum integration records:

`insurance_integration_profiles`

``` text
payerAdapter
endpoint
mappingVersion
secretReference
status
```

`insurance_integration_messages`

``` text
profileId
direction
type
correlationId
idempotencyKey
status
externalReference
retryCount
nextRetryAt
```

Submission:

``` text
DRAFT
 → Validate
 → VALIDATED
 → Submit
 → Integration Message
 → Mock Payer
 → ACKNOWLEDGED
```

Double-submit must not create duplicate external submissions.

------------------------------------------------------------------------

## 4.3 Claim Query

Create:

`insurance_claim_queries`

``` text
claimId
queryNumber
type
subject
dueDate
assignedTo
response
resolvedAt
status
```

Statuses:

``` text
OPEN
ASSIGNED
RESPONDED
RESOLVED
REJECTED
OVERDUE
```

Basic workflow:

``` text
Claim
 → Payer Query
 → Assign
 → Respond
 → Resolve
```

Do not implement a complex SLA worker in the 3-day MVP.

------------------------------------------------------------------------

## 4.4 Adjudication

Create:

`insurance_claim_adjudications`

``` text
claimId
claimVersion
decision
grossAmount
allowedAmount
approvedAmount
patientResponsibility
rejectedAmount
reasons
calculationSnapshot
```

Decisions:

``` text
APPROVED
PARTIALLY_APPROVED
REJECTED
```

Basic calculation:

``` text
Gross
 ↓
Allowed
 ↓
Benefit Limit
 ↓
Deductible
 ↓
Copay
 ↓
Approved
 ↓
Patient Responsibility
```

The exact patient-responsibility formula must remain configurable
because the field analysis identifies money/rounding/liability formulas
as business decisions requiring approval.
fileciteturn3file0L230-L275

Never directly edit adjudicated amounts from the UI.

------------------------------------------------------------------------

## 4.5 Benefit Utilization

Create:

`insurance_benefit_utilizations`

``` text
memberId
benefitId
authorizationId
claimId
entryType
quantity
amount
effectiveAt
reversalOfId
```

Treat utilization as an immutable ledger.

------------------------------------------------------------------------

## 4.6 Payer Payment

Create:

`insurance_payments`

``` text
payerId
receiptNumber
bankReference
paymentDate
amount
currency
source
status
```

Important:

`billing_payments` = patient receipts.

`insurance_payments` = payer receipts.

Never merge the two.

------------------------------------------------------------------------

## 4.7 Payment Allocation

Create:

`insurance_payment_allocations`

``` text
paymentId
claimId
remittanceLineId
allocatedAmount
varianceAmount
reason
status
reversalOfId
```

Workflow:

``` text
Payer Payment
 → Match Claim
 → Allocate
 → Update Claim Balance
 → Reconcile
 → Paid
```

Rule:

``` text
Total allocations <= payment amount
```

------------------------------------------------------------------------

## 4.8 Basic Reconciliation

Create:

`insurance_reconciliations`

``` text
claimId
remittanceLineId
paymentAllocationId
expectedAmount
remittedAmount
receivedAmount
variance
result
resolution
```

MVP comparison:

``` text
Expected
vs
Approved
vs
Received
vs
Allocated
vs
Variance
```

Do not implement a full finance reconciliation engine.

------------------------------------------------------------------------

## 4.9 Basic Appeal

Create:

`insurance_claim_appeals`

``` text
claimId
appealNumber
level
grounds
submissionDate
dueDate
decisionDate
decision
status
```

Statuses:

``` text
DRAFT
SUBMITTED
UNDER_REVIEW
DECIDED
WITHDRAWN
CLOSED
```

Implement basic create, submit and decide functionality only.

------------------------------------------------------------------------

## 4.10 Claim Closure

Basic lifecycle:

``` text
DRAFT
 → VALIDATED
 → SUBMITTED
 → ACKNOWLEDGED
 → UNDER_REVIEW
 → APPROVED / PARTIALLY_APPROVED / REJECTED
 → PAID
 → CLOSED
```

Query path:

``` text
ACKNOWLEDGED
 → QUERIED
 → RESPONDED
 → UNDER_REVIEW
```

Do not allow direct:

``` text
DRAFT → PAID
SUBMITTED → PAID
```

Resubmission increments `claimVersion`.

------------------------------------------------------------------------

# 5. End-to-End Acceptance Scenario

The final demo must successfully execute:

``` text
1. Create Payer
2. Create Scheme
3. Create Policy for existing Patient
4. Create Member
5. Configure Benefit
6. Configure Payer Tariff
7. Open/use existing OPD/IP/Emergency Encounter
8. Verify Eligibility
9. Verify Benefit
10. Create Authorization if required
11. Submit Authorization
12. Mock Payer approves Authorization
13. Existing HMS service is provided
14. Existing HMS invoice is generated
15. Create Insurance Claim from Invoice
16. Validate Claim
17. Submit Claim
18. Mock Payer acknowledges
19. Adjudicate Claim
20. Calculate Approved / Rejected / Patient Responsibility
21. Record Payer Payment
22. Allocate Payment
23. Reconcile
24. Mark Claim Paid
25. Close Claim
```

This is the mandatory happy-path acceptance test.

------------------------------------------------------------------------

# 6. Required UI

Keep the UI simple and functional.

``` text
Insurance Dashboard
Payers
Schemes
Policies
Members
Benefits
Tariffs
Eligibility
Authorizations
Claims
Claim Queries
Payments
Reconciliation
Appeals
```

Claim detail:

``` text
Claim Header
Patient
Member
Payer
Scheme
Encounter
Invoice
Claim Lines
Validation Results
Authorization
Documents
Queries
Adjudication
Payment
Allocation
Audit History
```

------------------------------------------------------------------------

# 7. Permissions

Create/extend permissions for:

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

-   branch scope
-   patient scope
-   authenticated actor
-   role/permission
-   resource ownership where applicable

------------------------------------------------------------------------

# 8. Audit

Reuse HMS audit infrastructure.

Audit at least:

``` text
Payer Created
Scheme Created
Policy Created
Member Activated
Eligibility Verified
Authorization Submitted
Authorization Approved/Rejected
Claim Created
Claim Validated
Claim Submitted
Claim Queried
Claim Adjudicated
Payment Received
Payment Allocated
Payment Reversed
Appeal Submitted
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

------------------------------------------------------------------------

# 9. Mandatory Safety / Data Rules

Implement these before calling the MVP complete.

### Duplicate prevention

Unique/controlled keys:

``` text
payer: branchId + payerCode
scheme: branchId + payerId + schemeCode
policy: branchId + payerId + policyNumber
member: branchId + payerId + memberNumber
claim: branchId + claimNumber + claimVersion
claimLine: claimId + lineNumber
payment: branchId + payerId + bankReference
integrationMessage: profileId + idempotencyKey
```

### Financial

-   Allocation cannot exceed payer receipt.
-   Posted financial records are never deleted.
-   Reversal creates a linked reversal record.
-   Patient payments are never interpreted as payer payments.

### Lifecycle

-   UI cannot bypass service transition rules.
-   Stale transitions are rejected.
-   Rejection, cancellation, override, adjustment and reversal require
    reason codes.

These rules align with the lifecycle/validation controls in the field
mapping document. fileciteturn3file0L279-L307

------------------------------------------------------------------------

# 10. Three-Day Timebox

## Day 1 --- 8 hours

  Work                                 Hours
  -------------------------------- ---------
  Existing architecture analysis         0.5
  Insurance models/database              2.0
  Payer/Scheme/Policy                    1.0
  Member/Benefits/Tariff                 1.5
  Patient Insurance UI                   1.5
  Validation/Audit                      0.75
  Testing/Fixes                         0.75
  **Total**                          **8.0**

## Day 2 --- 8 hours

  Work                        Hours
  ----------------------- ---------
  Eligibility                  1.25
  Benefit verification          1.0
  Mock payer adapter           0.75
  Authorization                 2.0
  Authorization history         0.5
  Claim preparation            1.75
  Testing/Fixes                0.75
  **Total**                 **8.0**

## Day 3 --- 8 hours

  Work                               Hours
  ------------------------------ ---------
  Claim validation                     1.0
  Claim submission/idempotency        0.75
  Query handling                       0.5
  Adjudication                         1.5
  Payer payment/allocation            1.25
  Reconciliation/closure              0.75
  Dashboard/claim detail               0.5
  E2E testing/bug fixing               1.0
  Final verification                  0.75
  **Total**                        **8.0**

------------------------------------------------------------------------

# 11. Agent Execution Rules

Before modifying code:

1.  Inspect the current HMS architecture.
2.  Identify existing Patient, Encounter, Service, Invoice, Invoice
    Item, Document, Branch, User, Role, Audit and Notification
    implementations.
3.  Reuse existing services/components/utilities.
4.  Do not create duplicate HMS master records.
5.  Follow existing naming conventions.
6.  Follow existing API/error conventions.
7.  Follow existing authentication/authorization.
8.  Follow existing UI patterns.
9.  Do not introduce new frameworks unless necessary.
10. Keep insurance changes isolated.

After every phase:

-   run tests
-   inspect changed files
-   verify database migrations
-   verify API errors
-   verify permissions
-   verify audit entries
-   verify no unrelated modules were broken

Do not spend remaining time on cosmetic improvements while a P0 workflow
is incomplete.

------------------------------------------------------------------------

# 12. Codex Agent Prompt --- Day 1

> Analyze the existing HMS repository before changing code. Identify
> Patient, Encounter, Service, Invoice, Invoice Item, Document, Branch,
> User, Role, Audit and Notification implementations.
>
> Implement the insurance foundation using the existing architecture.
>
> Create/implement Payer, Insurance Scheme, Insurance Policy, Insurance
> Member, Insurance Benefit and Payer Tariff.
>
> Reuse patientId, serviceId and branchId references.
>
> Implement CRUD, validation, uniqueness, branch scope, status handling,
> audit and the minimum Insurance UI.
>
> Add an Insurance section to the existing Patient context.
>
> Do not create duplicate patient/service/invoice models.
>
> Do not implement real payer integration yet.
>
> Run tests and report files changed, APIs created, models created, UI
> created and remaining issues.

------------------------------------------------------------------------

# 13. Codex Agent Prompt --- Day 2

> Continue from the Day 1 implementation.
>
> Implement eligibility verification, benefit verification,
> preauthorization, authorization history and claim preparation.
>
> Reuse existing patient, encounter, service, invoice and invoice-item
> records.
>
> Implement a mock payer adapter behind an interface.
>
> Implement membership, coverage, benefit and authorization validations.
>
> Create insurance claims from existing invoices and snapshot required
> charge/service facts.
>
> Implement controlled status transitions and audit history.
>
> Run focused tests and demonstrate:
>
> Patient → Member → Eligibility → Benefits → Authorization → Invoice →
> Claim Draft.
>
> Do not start advanced reporting or production payer integration.

------------------------------------------------------------------------

# 14. Codex Agent Prompt --- Day 3

> Continue from Day 2 and complete the minimum insurance lifecycle:
>
> Claim Draft → Validation → Submission → Acknowledgement → Query →
> Adjudication → Payer Payment → Allocation → Reconciliation → Paid →
> Closed.
>
> Implement claim validation records, integration messages/idempotency,
> mock payer claim response, adjudication ledger, benefit utilization,
> payer payment, payment allocation, basic reconciliation and basic
> appeal.
>
> Ensure payer payments remain separate from patient billing payments.
>
> Implement duplicate prevention, claim version checks, allocation
> limits, reversal-safe financial handling and audit logging.
>
> Complete Insurance Dashboard and Claim Detail.
>
> Execute positive and negative end-to-end tests.
>
> Fix P0/P1 issues first.
>
> Do not start new advanced features once the complete happy path is
> working.
>
> Report final files changed, APIs, models, status transitions, test
> results, known limitations and production follow-up items.

------------------------------------------------------------------------

# 15. Explicitly Out of Scope for the 3-Day MVP

Do not allow these to consume the 24-hour timebox:

-   production SHA/private payer integrations
-   insurer certification
-   EDI implementation
-   complex payer payload mapping
-   advanced dynamic benefit engine
-   full finance reconciliation engine
-   advanced approval/batch workflows
-   complex multi-level appeals
-   advanced provider contract management
-   advanced tariff engine
-   advanced BI
-   automated SLA worker infrastructure
-   advanced notification orchestration
-   historical data migration
-   production security certification
-   full UAT
-   performance/load testing

These are follow-up phases.

------------------------------------------------------------------------

# 16. Post-MVP Phase Plan

After the 3-day MVP:

### Phase 2

-   Real payer integration
-   Integration retry queues
-   Webhooks
-   Payer-specific mapping
-   Remittance ingestion

### Phase 3

-   Advanced benefit/rule engine
-   Full query/resubmission
-   Full appeals
-   Provider contracts
-   Advanced tariff configuration

### Phase 4

-   Payment batches
-   Approval matrix
-   Three-way reconciliation
-   Financial adjustments
-   Reversals

### Phase 5

-   Advanced reports
-   Operational monitoring
-   Migration
-   UAT
-   Security/performance hardening

The field mapping document's recommended broader sequence is: approve
contract → build masters → eligibility/authorization → claims →
settlement → integration → migration/release. The 3-day plan
intentionally compresses that sequence into an MVP by using a mock payer
and limiting settlement/appeal capabilities.
fileciteturn3file0L342-L366

------------------------------------------------------------------------

# 17. Final Rule

**Do not interpret the 3-day requirement as completing every field and
every enterprise workflow from the full insurance design.**

The 3-day delivery target is:

> **A reliable, auditable, working insurance MVP integrated with the
> existing HMS patient, encounter, service and billing records, with a
> complete basic claim lifecycle using a mock payer.**

The architecture must make it possible to extend this MVP into the full
insurance workflow without replacing the core data model.
