# Insurance v1 Phase 0 — Field and API Contract Draft

**Contract ID:** `insurance-v1-phase0`  
**Status:** PHASE 0 ARCHITECTURE APPROVED — monetary implementation deferred to Finance Foundation  
**Scope:** Full-domain contract outline; detailed Phase 1 foundation fields

The authoritative non-monetary implementation subset is frozen in
`INSURANCE_V1_PHASE1A_IMPLEMENTATION_CONTRACT.md`. Monetary portions of this
full-domain outline remain non-implementable until the shared Finance
Foundation gates pass.

## 1. Contract conventions

- API path prefix: `/api/insurance`
- API fields: `snake_case`
- Database fields: existing Mongoose `camelCase` convention
- Responses: existing `{ success, data }` response contract
- Lists: `page`, `limit`, approved filters, `sortBy`, `sortOrder`
- Default page size: repository convention; proposed `20`
- Every protected route: authentication plus an Insurance permission
- Branch/organization scope: resolved from authenticated user on backend
- Mutable workflow resources: integer `version` required for commands
- Retriable commands: `idempotency_key` required where identified
- Dates/times: ISO 8601 in API; timestamps stored as dates
- Soft-deletable masters: `deletedAt/deletedBy` repository convention
- Audit: resource, resource ID, before/after, reason, actor and correlation ID
- D-05 target: new financial amounts use integer minor units plus ISO 4217
  currency and a versioned shared Finance Policy. Monetary implementation is
  BLOCKED until the shared Finance Foundation contract is approved.

## 2. Reused reference fields

| Insurance field | Existing source | Mapping rule |
|---|---|---|
| `patient_id` | Patient `id` | Stable reference; patient identity is not duplicated |
| `patient_number_snapshot` | Patient `patient_number` | Display/export snapshot when required |
| `patient_name_snapshot` | Patient names | Snapshot only where submission/export requires it |
| `patient_document_id` | Patient Document `id` | Evidence link; not proof of active membership |
| `service_id` | Service `id` | Stable reference |
| `service_code_snapshot` | Service `code` | Immutable decision/claim snapshot |
| `service_name_snapshot` | Service `name` | Immutable decision/claim snapshot |
| `invoice_id` | Billing Invoice `id` | Claim source reference |
| `invoice_number_snapshot` | Billing Invoice `invoice_number` | Claim display/export snapshot |
| `invoice_item_id` | Billing Invoice Item `id` | Claim-line source reference |
| `source_type` | Clinical context | `OPD_VISIT`, `EMERGENCY_ENCOUNTER`, `INPATIENT_ADMISSION`, `PROCEDURE_BOOKING` |
| `source_id` | Clinical context | Required context record ID |
| `encounter_id` | Clinical context | Nullable |
| `admission_id` | Clinical context | Nullable |
| `procedure_id` | Clinical context | Nullable |
| `visit_id` | Clinical context/Billing | Nullable in Insurance |
| `branch_id` | Authenticated scope/source | Never trusted without backend validation |
| `currency` | Approved Settings/contract | Snapshotted; decision D-05 pending |

## 3. Common Insurance fields

The current HMS is a single system/hospital deployment with branch scope;
it has no Organization/Tenant model. Do not add `organization_id` only to
Insurance. All persistent Insurance resources use the applicable subset:

``` text
id
branch_id?             // required for branch-scoped operational/config records
status
version
created_by
updated_by
created_at
updated_at
deleted_by?
deleted_at?
```

Transaction resources additionally use:

``` text
correlation_id
idempotency_key?
reason_code?
reason_notes?
effective_at?
source_system
```

## 4. Phase 1 foundation entities

Fields marked **BLOCKED** cannot be finalized before the linked decision.

### 4.0 Insurance configuration, provider and approval foundation

``` text
insurance configuration (singleton or Insurance section of System Settings):
operating_mode               PROVIDER | PAYER | TPA | HYBRID
member_number_scope_default  PAYER | PAYER_POLICY
primary_coverage_only        true for initial implementation
money_policy                 shared Finance Foundation reference; BLOCKED D-05

insurance provider:
id, provider_code, legal_name, trading_name?, provider_type,
registration_number?, tax_id?, contact fields, address?, status,
version, audit fields

provider branch mapping:
id, provider_id, branch_id, effective_from, effective_to?, status,
version, audit fields

approval rule:
id, branch_id?, payer_id?, scheme_id?, transaction_type,
min_amount?, max_amount?, required_level?, required_permission,
effective_from, effective_to?, status, version, audit fields

approval request:
id, rule_id, resource_type, resource_id, requested_by, requested_at,
status, decided_by?, decided_at?, decision_reason?, resource_version,
audit fields
```

An approval request may not be decided by its requester. The backend must
enforce this independently of UI visibility.

### 4.1 Payer

``` text
id
code                         required, normalized, unique within approved tenancy
name                         required
legal_name?
payer_type                   proposed: INSURER | TPA | GOVERNMENT | EMPLOYER
registration_number?
tax_number?
contact_name?
contact_phone?
contact_email?
address?
claim_submission_mode        proposed: MANUAL | PORTAL | API | FILE
default_currency             sourced from Finance Money Policy; value BLOCKED D-05
status                       proposed: DRAFT | ACTIVE | INACTIVE
version
audit fields
```

### 4.2 Contract

``` text
id
contract_number              required; unique by branch + payer + number
payer_id                     required
provider_id                  required
branch_id                    required
name                         required
effective_from               required
effective_to?
currency                     BLOCKED D-05
claim_submission_days?
payment_due_days?
rounding_rule                BLOCKED D-05
status                       proposed: DRAFT | ACTIVE | SUSPENDED | EXPIRED | TERMINATED
version
audit fields
```

### 4.3 Scheme

``` text
id
payer_id                     required
contract_id                  required
code                         required
name                         required
description?
effective_from               required
effective_to?
status                       proposed: DRAFT | ACTIVE | INACTIVE | EXPIRED
version
audit fields
```

### 4.4 Policy

``` text
id
scheme_id                    required
policy_number                required; uniqueness follows payer configuration
policy_holder_name           required
employer_or_group_name?
effective_from               required
effective_to?
status                       DRAFT | PENDING_APPROVAL | ACTIVE | SUSPENDED | EXPIRED | CANCELLED | TERMINATED
version
audit fields
```

### 4.5 Insurance member

``` text
id
patient_id                   required
policy_id                    required
member_number                required; uniqueness follows payer configuration
dependant_code?
relationship_to_holder       proposed: SELF | SPOUSE | CHILD | PARENT | OTHER
priority                     required positive integer; `1` is primary
effective_from               required
effective_to?
patient_document_id?
status                       proposed: DRAFT | ACTIVE | SUSPENDED | EXPIRED | TERMINATED
version
audit fields
```

### 4.6 Benefit

``` text
id
scheme_id                    required
code                         required
name                         required
service_id?                  optional service-specific benefit
service_type?
coverage_type                proposed: PERCENTAGE | FIXED | FULL | EXCLUDED
coverage_value_minor?        BLOCKED until shared Finance Foundation
limit_amount_minor?          BLOCKED until shared Finance Foundation
currency_code?               ISO 4217; required with monetary values
financial_policy_version?    required once monetary values are enabled
limit_period?                proposed: VISIT | DAY | MONTH | YEAR | POLICY
waiting_period_days?
preauthorization_required    required boolean
status                       proposed: ACTIVE | INACTIVE
version
audit fields
```

### 4.7 Tariff

``` text
id
contract_id                  required
scheme_id?
service_id                   required
amount_minor                 BLOCKED until shared Finance Foundation
currency_code                ISO 4217
financial_policy_version     required
effective_from               required
effective_to?
status                       proposed: ACTIVE | INACTIVE | EXPIRED
version
audit fields
```

## 5. Later-phase transaction contracts

These fields define integration boundaries, not approved implementation
schemas. Their statuses remain provisional until the owning phase.

### Eligibility verification

``` text
id, patient_id, member_id, policy_id, source context, requested_at,
verified_at, valid_until, result, payer_reference, response_source,
benefit_snapshot, correlation_id, idempotency_key, version, audit fields
```

Proposed result: `PENDING | ELIGIBLE | INELIGIBLE | PARTIAL | ERROR`.

### Authorization and line

``` text
authorization: id, authorization_number, patient_id, member_id,
source context, request/decision/expiry dates, status, payer_reference,
reason, version, audit fields

line: id, authorization_id, service_id, service snapshots, requested qty/
amount, approved qty/amount, decision, reason, version
```

### Utilization ledger entry

``` text
id, member_id, benefit_id, authorization_id?, claim_id?, claim_line_id?,
entry_type, quantity?, amount?, currency, effective_at, reason,
reversal_of_id?, correlation_id, idempotency_key, audit fields
```

Entry type: `RESERVE | CONSUME | RELEASE | REVERSE | ADJUST`.

### Claim and claim version

``` text
claim: id, claim_number, patient_id, member_id, payer_id, scheme_id,
invoice_id, source context, current_version_id, status, version, audit fields

claim version: id, claim_id, version_number, submission_type,
invoice_number_snapshot, currency, totals, submitted_at?, payer_reference?,
previous_version_id?, correction_reason?, immutable submission snapshot

claim line: id, claim_version_id, invoice_item_id, service_id,
service/date/quantity/charge/tariff snapshots, covered/noncovered/patient/
claimed/adjudicated amounts, decision and reason
```

### Payer finance

``` text
payer payment: id, payer_id, payment_reference, payment_date, currency,
amount, status, idempotency_key, version, audit fields

remittance: id, payer_payment_id, external_reference, received_at, currency,
declared_amount, status, version, audit fields

allocation: id, remittance_id, claim_id, claim_version_id, allocated_amount,
posting status, reversal_of_id?, correlation_id, audit fields
```

### Billing claim-eligibility adapter

The existing Billing contract maps claim eligibility as follows:

``` text
Eligible:   PENDING | PARTIALLY_PAID | PAID
Ineligible: DRAFT | CANCELLED
VOID:       not present in the current Billing contract
```

`PENDING` is the repository's issued/finalized-for-payment state because
Billing refuses payment collection from `DRAFT`. However, an unpaid
`PENDING` invoice remains editable. Claim creation therefore snapshots the
invoice and items, and claim submission must re-read and compare the current
invoice/item state. A claim lock or Billing immutability change may be added
only through an approved Phase 4 integration contract.

## 6. Proposed endpoint surface

All endpoints are provisional until contract approval.

| Phase | Method/path | Purpose |
|---|---|---|
| 1 | `GET/PATCH /api/insurance/configuration` | Operating mode and approved Insurance settings |
| 1 | `GET/POST /api/insurance/providers` | Legal provider setup |
| 1 | `GET/PATCH /api/insurance/providers/:id` | Provider detail/update |
| 1 | `GET/POST /api/insurance/providers/:id/branches` | Effective-dated provider/branch mapping |
| 1 | `GET/POST /api/insurance/payers` | List/create payer |
| 1 | `GET/PATCH /api/insurance/payers/:id` | Detail/update payer |
| 1 | `POST /api/insurance/payers/:id/activate` | Controlled activation |
| 1 | `GET/POST /api/insurance/contracts` | List/create contract |
| 1 | `GET/PATCH /api/insurance/contracts/:id` | Detail/update contract |
| 1 | `GET/POST /api/insurance/schemes` | List/create scheme |
| 1 | `GET/PATCH /api/insurance/schemes/:id` | Detail/update scheme |
| 1 | `GET/POST /api/insurance/policies` | List/create policy |
| 1 | `GET/PATCH /api/insurance/policies/:id` | Detail/update policy |
| 1 | `GET/POST /api/insurance/members` | List/create membership |
| 1 | `GET/PATCH /api/insurance/members/:id` | Detail/update membership |
| 1 | `GET /api/insurance/patients/:patientId/coverage` | Patient Insurance tab |
| 1 | `GET/POST /api/insurance/benefits` | List/create benefit |
| 1 | `GET/PATCH /api/insurance/benefits/:id` | Detail/update benefit |
| 1 | `GET/POST /api/insurance/tariffs` | List/create tariff |
| 1 | `GET/PATCH /api/insurance/tariffs/:id` | Detail/update tariff |
| 1 | `GET/POST /api/insurance/approval-rules` | Maker-checker rule configuration |
| 1 | `GET/POST /api/insurance/approval-requests` | Approval queue/create request |
| 1 | `POST /api/insurance/approval-requests/:id/actions/:action` | Approve/reject with self-approval protection |
| 2 | `POST /api/insurance/eligibility-verifications` | Verify eligibility |
| 2 | `GET /api/insurance/eligibility-verifications/:id` | Verification result |
| 3 | `GET/POST /api/insurance/authorizations` | List/create authorization |
| 3 | `POST /api/insurance/authorizations/:id/actions/:action` | Versioned transition |
| 3 | `GET /api/insurance/members/:id/utilization` | Utilization history/balance |
| 4 | `GET/POST /api/insurance/claims` | List/create draft claim |
| 4 | `POST /api/insurance/claims/:id/validate` | Validate draft/version |
| 4 | `POST /api/insurance/claims/:id/submit` | Idempotent submission |
| 5 | `/api/insurance/claim-queries`, `/adjudications`, `/appeals` | Conditional on D-01 |
| 6 | `/api/insurance/payer-payments`, `/remittances`, `/allocations`, `/reconciliations` | Dedicated payer finance |
| 7 | `/api/insurance/integration-messages`, `/reports`, `/dashboard` | Operations and reporting |

## 7. Proposed permission catalogue

``` text
Insurance.Payers.View
Insurance.Payers.Manage
Insurance.Providers.View
Insurance.Providers.Manage
Insurance.Configuration.View
Insurance.Configuration.Manage
Insurance.Contracts.View
Insurance.Contracts.Manage
Insurance.Coverage.View
Insurance.Coverage.Manage
Insurance.Eligibility.Verify
Insurance.Authorizations.View
Insurance.Authorizations.Request
Insurance.Authorizations.Decide
Insurance.Claims.View
Insurance.Claims.Create
Insurance.Claims.Validate
Insurance.Claims.Submit
Insurance.Claims.RespondToQuery
Insurance.Claims.Adjudicate        // conditional on D-01
Insurance.Claims.Appeal
Insurance.Finance.View
Insurance.Finance.PostRemittance
Insurance.Finance.Allocate
Insurance.Finance.Reconcile
Insurance.Finance.Reverse
Insurance.Reports.View
Insurance.Integration.Manage
Insurance.Approvals.View
Insurance.Approvals.Request
Insurance.Approvals.Decide
```

Exact group/resource/action codes must follow the existing permission seed
format and are frozen before Phase 1.

## 8. Standard command fields

``` json
{
  "version": 3,
  "reason_code": "REQUIRED_FOR_ADVERSE_OR_OVERRIDE_ACTIONS",
  "reason_notes": "Optional or required by action",
  "idempotency_key": "Required for retriable submission/posting commands"
}
```

Backend returns `409` for stale version or uniqueness conflict and must not
silently overwrite a newer record.

## 9. Proposed error catalogue

``` text
INSURANCE_RESOURCE_NOT_FOUND
INSURANCE_SCOPE_DENIED
INSURANCE_STALE_VERSION
INSURANCE_INVALID_STATUS_TRANSITION
INSURANCE_DUPLICATE_CODE
INSURANCE_EFFECTIVE_DATE_OVERLAP
INSURANCE_INACTIVE_REFERENCE
INSURANCE_MEMBER_NOT_ACTIVE
INSURANCE_POLICY_NOT_ACTIVE
INSURANCE_ELIGIBILITY_REQUIRED
INSURANCE_BENEFIT_NOT_COVERED
INSURANCE_BENEFIT_LIMIT_EXCEEDED
INSURANCE_AUTHORIZATION_REQUIRED
INSURANCE_AUTHORIZATION_EXPIRED
INSURANCE_DUPLICATE_CLAIM
INSURANCE_INVOICE_NOT_CLAIMABLE
INSURANCE_CLAIM_VALIDATION_FAILED
INSURANCE_IDEMPOTENCY_CONFLICT
INSURANCE_TRANSACTION_REQUIRED
INSURANCE_RECONCILIATION_VARIANCE
```

## 10. Frontend screen-to-contract map

| Screen/workspace | Primary APIs | Reused data | Required UI states |
|---|---|---|---|
| Payers | `/payers` | Branch/scope display | loading, empty, error, permission, conflict |
| Contracts | `/contracts` | Payer lookup, settings currency | inactive payer, date conflict |
| Schemes/Policies | `/schemes`, `/policies` | Payer/contract lookup | overlap, inactive parent |
| Members | `/members` | Patient search, document link | duplicate, inactive patient/policy |
| Patient Insurance tab | `/patients/:id/coverage` | Patient profile context | no coverage, expired, multiple coverage |
| Benefits/Tariffs | `/benefits`, `/tariffs` | Service lookup | effective-date overlap, invalid amount |
| Eligibility | `/eligibility-verifications` | Patient/member/context | pending, ineligible, partial, unavailable |
| Authorization | `/authorizations` | Context, service, documents | stale, rejected, expired, partial |
| Claims | `/claims` | Invoice/items/documents | validation issues, duplicate, submitted |
| Finance | finance endpoints | Claim/adjudication refs | partial/unallocated/variance/reversal |

All filter, page, sort, search and active-tab state belongs in URL query
parameters. Modal-only lookups are fetched only while the modal is open.

## 11. Contract freeze blockers

The full monetary contract cannot be approved for implementation until:

- The cross-HMS Finance Foundation architecture and ownership are explicitly
  approved because they affect existing Billing and Payments.
- MoneyService, ISO currency metadata, versioned policy, serialization and
  existing-Billing compatibility contracts are frozen.
- D-05 implementation replaces all monetary `BLOCKED` fields.
- Phase 1 permissions and transition rules are finalized.
- Kamesh and Fazil both confirm the backend DTO and UI-field mapping.
- Finance approves the production policy before financial go-live.
