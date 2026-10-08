# Insurance Phase 4 hotfix gap note

Scope: benefit resolution and configured financial terms only. Phase 5 is not authorized.

Reuse the existing BenefitConfig model, repository, service, route permissions, effective-date filtering, overlap conflict checks, audit event, and insurance test suite. Policy IDs are already supported by configuration inputs and persistence, but matching ignores policy identity and ranks target specificity before scope. Conflict checks also omit policy identity.

Implement policy > scheme > payer, then service ID > service code > category within each scope. Applicable policy exclusions remain authoritative; inactive/out-of-period configurations retain existing non-applicable semantics. Restrict candidate queries to the member policy and unscoped fallbacks. Preserve effective periods and same-level conflict handling.

Expose configuredPatientResponsibility and a CONFIGURED_ONLY marker; retain patientResponsibility as a deprecated configured-copay alias. No invoice, payment, approved amount, balance, or adjudication calculations.

Intended files: insurance repository, service, types, focused tests, and this hotfix's verification note. No frontend consumer of patientResponsibility was found. No UI change or prototype change is needed. Working tree was clean on entry. Referenced Developer 1 prompt/FSD documents are absent; the explicit hotfix requirements and existing insurance model supply this narrow contract without new lifecycle assumptions.
