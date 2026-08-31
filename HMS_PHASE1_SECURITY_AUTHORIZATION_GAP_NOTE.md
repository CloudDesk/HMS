# Phase 1 Security and Authorization Gap Note

**Status:** Completed on 31 August 2026

## Scope

This phase is limited to the user-privilege and authentication rate-limit findings supplied in the review request. No frontend or Phase 2 work is included.

## Existing functionality reused

- Database-backed users, roles, permissions, and permission middleware.
- `PermissionRepository.userHasActiveRole` and effective permission-set checks.
- User-service validation, password policy, refresh-token revocation, and audit events.
- MongoDB-backed OTP and authentication fixed-window rate limits.
- Fastify's validated `request.ip` resolution.

## Confirmed gaps

- User create and update validate that roles exist but do not verify that the actor may delegate those roles.
- User update, status, password reset, and delete do not compare the actor's effective authority with the target user's authority.
- The role-to-user assignment endpoint provides a second path around user-service role protections.
- Boolean `TRUST_PROXY=true` trusts forwarding headers from any connected peer, allowing attacker-controlled IP identities when the API is directly reachable or the network boundary is misconfigured.

## Intended changes

- Extend the existing permission service/repository with reusable effective-authority comparisons.
- Enforce role delegation and target-user authority checks in user mutations and role assignment/removal.
- Keep SUPER_ADMIN handling inside the existing role/permission model.
- Replace boolean proxy trust with a validated list of trusted proxy IP addresses, CIDR ranges, or Fastify-supported named ranges.
- Add focused authorization and spoofed-forwarding-header tests.

All intended Phase 1 changes were implemented and verified. Phase 2 was not started.

## Source constraints

- The code-review report attachment is not present in the workspace; the concrete findings in the request control this phase and were checked against the implementation.
- `HMS_Scope2_Developer1(Kamesh)_Phase_3_Prompts.docx` and `doc/HMS_Release2_FSD.docx` are also absent. They do not define the requested security authority contract, and no lifecycle, consent, payment, temporary-patient, or clinical rule is changed here.
