# D-05 Finance Money Policy — Repository Reconciliation

**Status:** Target architecture approved; shared-foundation change approval required  
**Date:** 24 September 2026

## Accepted target

- One shared HMS Finance Money & Currency Policy, not Insurance-owned rules.
- ISO 4217 currency codes and minor-unit metadata.
- New persisted financial values use `amount_minor` plus `currency_code`.
- High-precision decimal intermediate calculations through one MoneyService.
- Versioned, effective-dated, maker-checker-approved finance policies.
- Separate claim-comparison and payment-reconciliation tolerances.
- Configurable `LINE` or `DOCUMENT` tax rounding.
- Financial transactions snapshot the applied policy version.
- No implicit currency conversion.
- Active policies are superseded, never edited in place.

## Current repository reality

| Area | Current implementation | D-05 impact |
|---|---|---|
| Tenancy | No Organization/Tenant model | Map current policy to singleton System Settings; preserve future migration boundary |
| Currency | Settings enum: KES, UGX, USD, TZS, NGN, INR | Replace/extend only through an approved shared Settings contract |
| Billing storage | Mongoose `Number` fields without transaction currency | Requires compatibility adapter or migration before shared adoption |
| Billing calculations | JavaScript number arithmetic and fixed two-decimal `Math.round` | Shared MoneyService is a behavioral change requiring regression tests |
| API dependency | No direct high-precision decimal dependency | Adding one requires explicit dependency/architecture approval |
| Tax rounding | Billing accepts a numeric tax amount; no LINE/DOCUMENT engine | Ownership and migration belong to shared Finance/Billing, not Insurance |
| Policy/version | No finance policy or transaction policy snapshot | New shared models/contracts required |

## Safe delivery boundary

### May proceed after Phase 1A approval

``` text
Insurance operating mode
Insurance provider and provider/branch mapping
Payer identity
Non-monetary contract/scheme/policy fields
Approval foundation
Non-monetary member identity and priority structure
```

### Must wait for shared Finance Foundation

``` text
Benefit monetary limits
Tariff amounts
Claim/adjudication amounts
Payer payments and remittance
Allocation and reconciliation
Variance and write-off
Financial reports
```

## Required shared-foundation decisions

1. Name the owner of the shared Finance domain and existing Billing migration.
2. Approve a direct high-precision decimal dependency or an equivalent
   implementation allowed by project rules.
3. Approve API serialization for minor-unit amounts and display decimals.
4. Define the compatibility adapter for existing Billing number values.
5. Decide whether and when historical Billing values are backfilled.
6. Define ISO metadata source/version/update governance.
7. Define singleton Settings now and any future Organization migration.
8. Define policy activation permissions and failure behavior when no policy
   is active.
9. Freeze rounding, allocation and overflow test vectors.
10. Confirm that engineering defaults create only a `DRAFT` policy and that
    production financial operations fail closed until Finance activates it.

## Phase 1B release gates

| Gate | Required approval |
|---|---|
| F-01 | Named ownership for shared Finance Foundation, Billing compatibility and Finance business approval |
| F-02 | Approved direct high-precision decimal dependency and MoneyService boundary |
| F-03 | Canonical API money representation and serialization |
| F-04 | Billing compatibility and migration approach |
| F-05 | Historical currency/backfill strategy |
| F-06 | Production Finance Policy approval and activation workflow |

## Stop rule

Do not refactor existing Billing or introduce mixed monetary persistence as
an incidental part of Insurance Phase 1. The shared Finance Foundation must
be approved, implemented and verified as its own controlled prerequisite.
