# Department Module Visibility Gap Note

## Reusable foundations

- Existing RBAC permissions remain the source of granted access.
- Department CRUD already provides validated and audited administration workflows.
- Authentication already returns the user's access context.
- Sidebar modules are centrally defined and filtered by the existing access-control helper.

## Gap

The sidebar is filtered only by role permissions. A shared `DOCTOR` role therefore exposes the same modules to Dental, General Doctor, Cardiology, and other clinical departments.

## Additive design

- Add a configurable `hiddenModules` deny-list to departments.
- Default it to an empty list so existing departments and users behave exactly as before.
- Return assigned active departments in the authenticated user context.
- Apply department visibility only to users with the `DOCTOR` role and only after permission filtering.
- Preserve existing API authorization and clinical workflows; this setting controls navigation visibility and never grants permissions.
- For multiple department assignments, hide the union of configured modules.
- Validate module keys at the API boundary and use the existing department audit workflow.

## Intended files

- Department model, types, schemas, repository, and service.
- Auth access-context types, repository, and response schema.
- Web auth types and access-control filtering.
- Department Management editor and API types.
- Focused backend/frontend tests and a verification note.
