# M-013 HTTP Response Contracts Gap Note

## Scope

M-013 establishes Fastify response serialization as a security boundary for representative high-risk HTTP endpoints. It does not attempt a backend-wide response-schema migration.

## Existing Architecture Reused

- Routes use Fastify JSON Schema objects for request validation and OpenAPI metadata.
- Successful JSON responses use the shared `{ data: ... }` wrapper from `shared/http/response.ts`.
- Existing response schemas are plain `as const` JSON Schema objects, as demonstrated by the health routes.
- Services and repositories already map MongoDB documents into public DTOs for auth, users, and patients.
- Existing authentication, permission, branch scope, OTP, and HttpOnly refresh-cookie behavior remains authoritative and unchanged.

## Gap

Most high-risk routes had request schemas but no `schema.response` entry. Fastify therefore serialized arbitrary enumerable properties returned by handlers, allowing DTO drift or accidental model/security fields to cross the HTTP boundary.

## Selected Representative Boundaries

- Staff authentication: login, refresh, and current user.
- Patient authentication: OTP request/verify and OTP login (using the same safe session contract).
- Patient portal: authenticated patient/guardian context.
- Administration users: paginated list and detail.
- Administration patients: branch-scoped paginated list and detail.

## Intended Changes

- Add reusable `{ data: ... }` response-schema wrapping consistent with the existing API format.
- Define explicit, closed response schemas under the owning modules.
- Attach success-only response schemas so existing error status behavior is preserved.
- Add Fastify-inject tests proving compatibility, scoping, and removal of unexpected security/model fields.

## Deliberate Remaining Coverage

Public catalogues, patient overview/appointment/document payloads, user mutations, patient mutations/history/documents, and the rest of the backend remain outside this representative M-013 pass. They should be migrated incrementally after their intended public DTOs are reviewed; no permissive catch-all schema was added.
