# Sidebar utility UX refinement

## Gap note and scope

Reuse the compact footer, authentication context, branch context, notification API and query cache, route access checks, and Modal primitive. Existing working-tree shell and Dental changes belong to other work and must be preserved.

Current gaps: independent popup booleans, clipped absolute positioning inside an overflow-hidden sidebar, no keyboard focus management, no bulk-read endpoint, and no account profile/help/preferences destinations. Notification types are REFERRAL, CALL_NEXT_PATIENT and GENERAL; do not infer criticality from message text. System Settings is the only applicable existing account action and remains permission-gated.

Intended files: sidebar utility components and scoped CSS, existing notification hook, a notification service for paginated mark-read orchestration, and focused regression tests. No backend, auth, branch-state, page or Dental changes. This is a shell refinement, not a Scope 2 Phase 3 implementation phase.

Verification results will be recorded after implementation.
