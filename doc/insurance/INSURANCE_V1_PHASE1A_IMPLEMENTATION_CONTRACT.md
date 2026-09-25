# Insurance v1 Phase 1A — Non-Monetary Implementation Contract

**Contract ID:** `insurance-v1-phase1a`  
**Status:** APPROVED AND FROZEN — READY TO START  
**Application code status:** Not started  
**Owners:** Kamesh - backend; Fazil - frontend

**Kamesh backend branch:** `Insurance-module-k`

## 1. Scope

Phase 1A implements only:

``` text
Insurance operating mode
Insurance provider
Effective-dated provider/branch mapping
Payer identity
Contract non-monetary configuration
Scheme non-monetary configuration
Policy non-monetary configuration and lifecycle
Approval foundation for non-monetary actions
Member identity and lifecycle
Coverage priority
Permissions
Audit
```

## 2. Explicit exclusions

Phase 1A must not implement or persist:

``` text
Benefit monetary limits
Tariff amounts
Authorization or utilization amounts
Claim or claim-line amounts
Adjudication amounts
Insurance liability
Payer payments or payment batches
Remittance amounts
Allocation or reconciliation
Variance or write-off
Insurance financial reports
Currency conversion
Independent money/rounding/tolerance logic
```

Do not add temporary `number` amount fields, mock amounts or localStorage
workarounds. These belong to Phase 1B after Finance Foundation gates pass.

## 3. Tenancy and scope

- Current HMS has one singleton System Settings record and no Organization
  or Tenant model.
- Store `insurance_operating_mode` in an Insurance section of System Settings
  or an equivalently approved singleton Insurance configuration record.
- Do not add `organizationId` only to Insurance.
- Payer identity is system-level and `payer_code` is globally unique in the
  current deployment.
- Contracts, schemes, provider mappings and operational access are
  branch-scoped.
- Backend scope is derived from the authenticated user. Frontend branch IDs
  are validated and never authoritative.

## 4. Operating mode

``` text
PROVIDER
PAYER
TPA
HYBRID
```

Mode limits which capabilities may be configured, but server-side
permissions are the final enforcement mechanism. `PROVIDER` users cannot
create payer decisions. Test adapters record decisions as external/test
source and are unavailable as a production fallback.

## 5. Entity contracts

All mutable records include `version`, creation/update actors and timestamps.
Soft-deletable masters use the existing deletion convention.

### 5.1 Insurance Provider

``` text
id
provider_code              required, normalized, globally unique
legal_name                 required
trading_name?
provider_type              HOSPITAL | CLINIC | PHARMACY | LABORATORY |
                           IMAGING | DENTAL | OPTICAL | OTHER
registration_number?
tax_id?
contact_name?
phone?
email?
address?
status                     DRAFT | ACTIVE | INACTIVE
version
audit fields
```

### 5.2 Provider Branch Mapping

``` text
id
provider_id                required
branch_id                  required
effective_from             required
effective_to?
status                     ACTIVE | INACTIVE | EXPIRED
version
audit fields
```

Active effective periods for the same provider/branch must not overlap.

### 5.3 Payer

``` text
id
payer_code                 required, normalized, globally unique
name                       required
legal_name?
payer_type                 INSURER | TPA | GOVERNMENT | EMPLOYER
registration_number?
tax_id?
claims_contact_name?
claims_contact_phone?
claims_contact_email?
finance_contact_name?
finance_contact_phone?
finance_contact_email?
address?
submission_mode            MANUAL | PORTAL | API | FILE
portal_url?
api_enabled                boolean
edi_enabled                boolean
portal_enabled             boolean
member_number_scope        PAYER | PAYER_POLICY
status                     DRAFT | ACTIVE | INACTIVE
version
audit fields
```

### 5.4 Contract — non-monetary subset

``` text
id
contract_number            required
payer_id                   required
provider_id                required
branch_id                  required
name                       required
effective_from             required
effective_to?
provider_network?
claim_submission_days?
status                     DRAFT | PENDING_APPROVAL | APPROVED | ACTIVE |
                           SUSPENDED | EXPIRED | TERMINATED
version
audit fields
```

Unique key: `branch_id + payer_id + contract_number`.

### 5.5 Scheme — non-monetary subset

``` text
id
payer_id                   required
contract_id                required
branch_id                  required
scheme_code                required
name                       required
scheme_type?
plan_type?
coverage_type?
network_type?
effective_from             required
effective_to?
authorization_required     boolean
status                     DRAFT | PENDING_APPROVAL | ACTIVE | SUSPENDED |
                           EXPIRED | TERMINATED
version
audit fields
```

Unique key: `branch_id + payer_id + scheme_code`.

### 5.6 Policy — non-monetary subset

``` text
id
scheme_id                  required
branch_id                  required
policy_number              required
policy_holder_name         required
employer_or_group_name?
effective_from             required
effective_to?
status                     DRAFT | PENDING_APPROVAL | ACTIVE | SUSPENDED |
                           EXPIRED | CANCELLED | TERMINATED
version
audit fields
```

Policy-number uniqueness follows the approved payer configuration. Rejected
approval requests remain in approval history; the policy returns to `DRAFT`
for correction rather than hiding the rejection audit.

### 5.7 Insurance Member

``` text
id
patient_id                 required; existing Patient reference
payer_id                   required
scheme_id                  required
policy_id                  required
branch_id                  required
member_number              required
principal_member_id?
relationship_to_holder     SELF | SPOUSE | CHILD | PARENT | OTHER
dependant_code?
employer?
coverage_start             required
coverage_end               required
priority                   positive integer; 1 = primary
patient_document_id?       existing Patient Document evidence
status                     DRAFT | ACTIVE | SUSPENDED | EXPIRED |
                           CANCELLED | DECEASED | TERMINATED
version
audit fields
```

Member-number uniqueness uses the payer's `member_number_scope`. Only one
overlapping active priority `1` membership is allowed per patient. Phase 1A
records additional priorities but does not perform coordination of benefits.

### 5.8 Approval Rule — Phase 1A subset

``` text
id
branch_id?
payer_id?
scheme_id?
transaction_type           PAYER_ACTIVATION | PROVIDER_ACTIVATION |
                           CONTRACT_ACTIVATION | SCHEME_ACTIVATION |
                           POLICY_ACTIVATION
required_permission        required
effective_from             required
effective_to?
status                     ACTIVE | INACTIVE
version
audit fields
```

Amount thresholds and financial transaction types are excluded until Finance
Foundation is available.

### 5.9 Approval Request

``` text
id
approval_rule_id           required
resource_type              required enum of Phase 1A approvable resources
resource_id                required
resource_version           required
requested_by               required
requested_at               required
status                     PENDING | APPROVED | REJECTED | CANCELLED
decided_by?
decided_at?
decision_reason?
version
audit fields
```

`requested_by != decided_by` is enforced by the backend. A stale resource
version rejects the decision with conflict.

## 6. Transition maps

``` text
Provider/Payer:
DRAFT -> ACTIVE -> INACTIVE
INACTIVE -> ACTIVE

Contract:
DRAFT -> PENDING_APPROVAL
PENDING_APPROVAL -> APPROVED | DRAFT
APPROVED -> ACTIVE
ACTIVE -> SUSPENDED | EXPIRED | TERMINATED
SUSPENDED -> ACTIVE | TERMINATED

Scheme/Policy:
DRAFT -> PENDING_APPROVAL
PENDING_APPROVAL -> ACTIVE | DRAFT
ACTIVE -> SUSPENDED | EXPIRED | TERMINATED
Policy ACTIVE -> CANCELLED is also permitted with reason and approval
SUSPENDED -> ACTIVE | TERMINATED

Member:
DRAFT -> ACTIVE
ACTIVE -> SUSPENDED | EXPIRED | CANCELLED | DECEASED | TERMINATED
SUSPENDED -> ACTIVE | EXPIRED | CANCELLED | TERMINATED
Terminal statuses do not reactivate
```

Every adverse, override, cancellation, suspension, termination and rejection
action requires an approved reason code or reason text as defined by its
action schema.

## 7. API endpoints

``` text
GET/PATCH  /api/insurance/configuration

GET/POST   /api/insurance/providers
GET/PATCH  /api/insurance/providers/:id
POST       /api/insurance/providers/:id/actions/:action
GET/POST   /api/insurance/providers/:id/branches
PATCH      /api/insurance/provider-branches/:id

GET/POST   /api/insurance/payers
GET/PATCH  /api/insurance/payers/:id
POST       /api/insurance/payers/:id/actions/:action

GET/POST   /api/insurance/contracts
GET/PATCH  /api/insurance/contracts/:id
POST       /api/insurance/contracts/:id/actions/:action

GET/POST   /api/insurance/schemes
GET/PATCH  /api/insurance/schemes/:id
POST       /api/insurance/schemes/:id/actions/:action

GET/POST   /api/insurance/policies
GET/PATCH  /api/insurance/policies/:id
POST       /api/insurance/policies/:id/actions/:action

GET/POST   /api/insurance/members
GET/PATCH  /api/insurance/members/:id
POST       /api/insurance/members/:id/actions/:action
GET        /api/insurance/patients/:patientId/coverage

GET/POST   /api/insurance/approval-rules
GET/PATCH  /api/insurance/approval-rules/:id
GET/POST   /api/insurance/approval-requests
GET        /api/insurance/approval-requests/:id
POST       /api/insurance/approval-requests/:id/actions/:action
```

All lists use `page`, `limit`, approved filters, `sortBy` and `sortOrder`.

## 8. Permission contract

Use the existing permission seed format with module `Insurance`:

``` text
Insurance.Configuration.View
Insurance.Configuration.Manage
Insurance.Providers.View
Insurance.Providers.Create
Insurance.Providers.Edit
Insurance.Providers.Activate
Insurance.Payers.View
Insurance.Payers.Create
Insurance.Payers.Edit
Insurance.Payers.Activate
Insurance.Contracts.View
Insurance.Contracts.Create
Insurance.Contracts.Edit
Insurance.Contracts.Submit
Insurance.Contracts.Activate
Insurance.Schemes.View
Insurance.Schemes.Create
Insurance.Schemes.Edit
Insurance.Schemes.Submit
Insurance.Schemes.Activate
Insurance.Policies.View
Insurance.Policies.Create
Insurance.Policies.Edit
Insurance.Policies.Submit
Insurance.Policies.Activate
Insurance.Members.View
Insurance.Members.Create
Insurance.Members.Edit
Insurance.Members.Activate
Insurance.Approvals.View
Insurance.Approvals.Configure
Insurance.Approvals.Request
Insurance.Approvals.Decide
```

Operating mode and permission must both permit an action. Permission checks
remain backend-authoritative.

## 9. Error contract

``` text
INSURANCE_RESOURCE_NOT_FOUND                 404
INSURANCE_SCOPE_DENIED                       403
INSURANCE_STALE_VERSION                      409
INSURANCE_INVALID_STATUS_TRANSITION          409
INSURANCE_DUPLICATE_CODE                     409
INSURANCE_EFFECTIVE_DATE_OVERLAP              409
INSURANCE_INACTIVE_REFERENCE                 409
INSURANCE_PROVIDER_BRANCH_NOT_AUTHORIZED      409
INSURANCE_DUPLICATE_MEMBER                   409
INSURANCE_PRIMARY_COVERAGE_OVERLAP            409
INSURANCE_SELF_APPROVAL_FORBIDDEN             409
INSURANCE_APPROVAL_REQUIRED                   409
INSURANCE_APPROVAL_STALE_RESOURCE             409
INSURANCE_OPERATING_MODE_DENIED               403
INSURANCE_FINANCE_FOUNDATION_REQUIRED         503
```

Zod validation failures use the existing `VALIDATION_ERROR` response pattern.

## 10. Required indexes

``` text
provider: unique providerCode; status + createdAt
provider branch: providerId + branchId + effective dates/status
payer: unique payerCode; name/status
contract: unique branchId + payerId + contractNumber; effective dates/status
scheme: unique branchId + payerId + schemeCode; contract/status
policy: approved payer-specific policy-number key; scheme/effective dates/status
member: payer-configured member-number key; patient/effective dates/status;
        partial uniqueness/control for overlapping active primary coverage
approval rule: transaction type + scope + effective dates/status
approval request: resource type + resource ID + status; requester/date
```

Effective-date overlap checks require repository queries plus unique/partial
indexes where MongoDB can enforce the invariant.

## 11. Audit contract

Reuse the existing Audit collection. Each event includes structured metadata:

``` text
branchId
insuranceResourceType
insuranceResourceId
resourceVersion
before
after
reasonCode?
reasonNotes?
approvalRequestId?
correlationId
```

Do not log sensitive member documents, full patient data or external secrets.

## 12. Frontend contract

Fazil owns:

``` text
api/insurance.ts
services/insurance.service.ts
hooks/insurance/**
pages/insurance/**
components/insurance/**
frontend routes/navigation/access control
```

Required screens:

``` text
Insurance configuration
Providers and provider/branch mappings
Payers
Contracts
Schemes
Policies
Members
Patient Profile Insurance tab
Approval rules
Approval queue/history
```

All server state uses TanStack Query. Page/filter/tab/sort/search state uses
URL parameters. Forms use React Hook Form and Zod. Modal-only lookups are
on-demand. Every screen handles loading, empty, error, permission, stale
conflict and success states.

## 13. File ownership and merge order

- Kamesh exclusively owns `apps/api` Insurance implementation and backend
  shared registration/permission files.
- Fazil exclusively owns `apps/web` Insurance implementation and frontend
  shared routing/navigation/access-control files.
- Neither developer edits existing Billing monetary behavior in Phase 1A.
- Backend contract implementation merges first; Fazil rebases and completes
  live API acceptance before frontend merge.

## 14. Acceptance gate

- No monetary Insurance fields or calculations are introduced.
- No Organization/Tenant subsystem is introduced.
- RBAC, operating mode and branch scope are enforced by backend.
- Self-approval and stale approvals are rejected.
- Duplicate codes, member identity and overlapping primary coverage are
  rejected consistently.
- All transition maps and reason requirements are enforced in services.
- Lists are paginated, projected and indexed.
- Audit evidence contains actor, reason, before/after and resource version.
- Patient, Patient Document and Branch are referenced, not duplicated.
- Live frontend uses APIs with no production mock/localStorage data.
- API and web typecheck, lint and build pass.
- Focused permission, scope, transition, concurrency and persistence tests
  pass.
- Phase 1B remains blocked and no Finance/Billing migration starts.
