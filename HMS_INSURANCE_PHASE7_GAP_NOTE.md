# Insurance Phase 7 gap note

Reuse BillingInvoice.patientId/visitId/branchId/sourceType/status and BillingInvoiceItem.invoiceId/serviceId/quantity/unitPrice/lineTotal, existing OPD context, insurance membership/policy, Phase 2 coverage, Phase 4 benefits and Phase 6 mapping/authorization matching. No Patient/Invoice/Service/clinical model changes.

Implement immutable invoice-item snapshots in an embedded-line draft claim. No submitted status transitions, external calls or financial liability calculation. Missing SHA mapping, unvalidated configured codes, missing authorization, unconfirmed payer validity and missing ICD-11 remain explicit readiness issues. Header discounts/taxes have no approved claim allocation rule and are flagged rather than allocated speculatively.

Unique invoice/member context prevents duplicate item claims, including changed invoice revisions; correction/recreation is deferred. Claim creation and validation audit use MongoDB transactions. New claim model/schemas/repository/service/tests; minimal routes, service registries, permission seed and plan tracking. Preserve prior phase changes.
