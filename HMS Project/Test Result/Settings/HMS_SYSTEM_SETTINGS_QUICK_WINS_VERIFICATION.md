# HMS System Settings Quick Wins Verification

## Implemented scope

- Default role for new users
- Password minimum length
- Maximum failed login attempts
- Require strong passwords
- First day of week

No Medium/Large System Settings functionality was implemented.

## Runtime verification

- User creation omitting `roleIds` resolves the configured active role in the backend. `Nurse` maps to the existing `CLINICIAN_NURSE` system role; Receptionist and Doctor map to their existing codes.
- Explicitly supplied role IDs bypass default-role resolution and remain authoritative.
- Missing settings or a missing/inactive configured role preserve the existing `ROLE_ASSIGNMENT_REQUIRED` failure.
- Effective password policy uses the stored minimum length and independently enables/disables the existing environment-backed complexity checks.
- Settings retrieval failure or invalid runtime values fall back to the existing environment policy and failed-login limit.
- Failed-login tracking still uses `AuthRepository.incrementFailedLogin`; only the limit source changed.
- Successful login still clears failed attempts through `AuthRepository.clearFailedLogin`.
- The authenticated first-day runtime endpoint returns only `firstDayOfWeek`, avoiding exposure of the administration settings document.
- Appointment Calendar and Doctor Schedule both consume the same TanStack-backed first-day hook with the existing Sunday fallback.
- Saving User Preferences invalidates the effective auth password-policy query; saving Localization invalidates the first-day runtime query.

## Automated checks

- `npm.cmd exec vitest run apps/api/src/modules/settings/system-settings-quick-wins.test.ts apps/web/src/hooks/settings/useSettings.test.tsx` — passed, 7 tests.
- `npm.cmd exec vitest run apps/api/src/modules/auth/auth-rate-limit.test.ts` with the test bootstrap `MONGODB_URI` — passed, 4 tests.
- `npm.cmd run typecheck --workspace=@hms/api` — passed.
- `npm.cmd run build --workspace=@hms/api` — passed.
- `npm.cmd run typecheck --workspace=@hms/web` — passed.
- `npm.cmd run build --workspace=@hms/web` — passed.
- ESLint over all phase-owned API/web files — passed.

Repository-wide lint remains blocked by pre-existing unrelated errors: 42 API errors and 33 web errors in scratch scripts, existing tests, patient/appointment/inventory/surgery files, and other modules. No reported repository-wide lint error is in a quick-win-owned file.

## Live checks

- Local API connected to the configured HMS MongoDB successfully.
- Administrator authentication succeeded.
- `GET /api/auth/password-policy` returned the effective stored policy.
- `GET /api/settings/runtime/first-day-of-week` returned `Monday`.
- A seeded non-administrative nurse account also retrieved `Monday`, confirming that calendar users do not require Administration/Settings/View permission.

No live settings values or user records were mutated during manual verification. The requested click-through browser acceptance could not be completed because no in-app or external browser was connected to this session.

## Excluded settings

Billing, inventory, notifications, Security Settings, integrations, backup/restore, maintenance mode, dark mode, session timeout, password expiry, self-registration, hospital branding, application name, date/time format, multi-branch mode, timezone, currency, and number format were not implemented or behaviorally changed.
