# HMS System Settings Quick Wins Gap Note

## Scope

Implement only `userPreferences.defaultRole`, `passwordMinLength`,
`maxFailedLoginAttempts`, `requireStrongPasswords`, and
`localization.firstDayOfWeek` as runtime controls.

## Reusable implementation

- System settings already persist through the singleton `SystemSettings` document, `SettingsRepository`, and `SettingsService`.
- Staff creation already resolves active roles through `RoleRepository` and validates assignments in `UserService`.
- Password creation, change, and reset flows already share `assertPasswordPolicy`.
- Staff login lockout already uses `AuthRepository.incrementFailedLogin` and preserves failed-attempt/reset behavior.
- Appointment Calendar and Doctor Schedule already pass a first-day value into the shared week-range utilities.

## Gaps

- User creation requires `roleIds` before the service can apply a configured default.
- Password policy and failed-login limits read only environment configuration.
- The password-policy API reports only environment configuration.
- Calendar pages read the permission-restricted full settings document through a stale module-level cache.

## Intended files

Changes are limited to settings, auth, users, the service registry, the User Management create form, the two calendar consumers, focused tests, and the verification note.

## Boundaries

No Medium/Large setting or unrelated localization, branding, billing, inventory, notification, integration, backup, maintenance, theme, session, password-expiry, self-registration, date/time-format, or multi-branch functionality is included.
