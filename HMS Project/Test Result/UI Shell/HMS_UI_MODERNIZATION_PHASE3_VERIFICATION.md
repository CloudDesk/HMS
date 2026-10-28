# HMS UI Modernization Phase 3 Verification

## Form audit summary

- Audited the shared `.form-grid-2`, `.form-grid-3`, `.form-grid`, `.form-field`, `.form-group`, `.doc-form-grid`, `.doc-field`, control, validation, and action primitives.
- Audited domain/feature forms for inpatient, billing, Emergency, appointments, clinical vitals, doctor, pharmacy, surgery, admission, diagnostics, and patient workflows.
- Preserved intentional date/time, quantity/unit, clinical measurement, checkbox, and compact control pairings.
- Identified inline column declarations that prevented the existing `.doc-form-grid` mobile rule from taking effect.

## Modal audit summary

- Audited the shared portal-based `Modal`, `ConfirmDialog`, modal consumers, and direct patient profile/timeline detail dialogs.
- Confirmed the intended single-scroll-container model: fixed overlay, flex-column modal, and vertically scrolling modal body.
- Confirmed that the late backdrop, modal-height, required, error, consent, and locked-field `!important` rules are cascade-sensitive and must remain.
- Found no nested shared `Modal` component use.
- Compared the implementation with HMS Local's centered, viewport-bounded modal, grid, and footer patterns.

## Implemented functionality

- Added screen-only width, `min-width`, `max-width`, and `box-sizing` containment to shared modal/form primitives and non-checkbox/radio controls.
- Added wrapping for long labels, form hints, validation messages, modal titles, and title content around the close button.
- Replaced the body backdrop's scrollbar-sensitive `100vw` width with `100%` and added dynamic viewport height.
- Added dynamic viewport-aware modal maximum height while preserving the existing modal-body scrollbar.
- Collapsed shared two/three-column modal grids at 640px and below.
- Made the existing one-column `.doc-form-grid` mobile intent win over legacy inline column declarations at 768px and below.
- Added wrapping and responsive button sizing to both `.modal-footer` and `.modal-actions` without changing button order.
- Kept mobile dialogs as centered cards; no blanket bottom-sheet redesign was introduced.

## Feature/domain-specific changes

- Billing: added a screen-only one-column rule for `.billing-modal-form` below 520px; the paired billing item builder remains unchanged.
- Emergency: added screen-only wrapping for the sticky form action button group below 768px and full-row action buttons below 520px.
- Inpatient `.modal-form-grid` retains its domain ownership and existing full-span/checkbox behavior while receiving the shared narrow-screen safeguard.

## Cascade and print safety

- Existing cascade-sensitive `!important` declarations were not removed or broadly cleaned up.
- Two existing backdrop declarations are intentionally overridden with the same priority to remove `100vw` overflow and use `100dvh`.
- One targeted `.doc-form-grid` mobile `!important` is required because inline `gridTemplateColumns` otherwise defeats the stylesheet breakpoint.
- All Phase 3 responsive additions are under `@media screen`; billing print rules and print-specific React layouts were not changed.
- Staff Web production CSS compiled successfully.

## Preserved behavior

- Modal open/close, portal, backdrop, footer, scroll, focus, and component contracts are unchanged.
- Form field names, semantics, React Hook Form/Zod validation, errors, required indicators, disabled/locked states, submission behavior, API calls, React state, and routing are unchanged.
- Desktop colors, typography, borders, radii, shadows, spacing language, modal widths, and button hierarchy are unchanged.
- No Phase 3 edit was made under `apps/patient-web/**`; its pre-existing dirty files were preserved.

## Files changed for Phase 3

- `apps/web/src/styles.css`
- `apps/web/src/features/billing.css`
- `apps/web/src/domains/emergency.css`
- `HMS_UI_Modernization_Plan.md`
- `HMS_UI_MODERNIZATION_PHASE3_GAP_NOTE.md`
- `HMS_UI_MODERNIZATION_PHASE3_VERIFICATION.md`

## Automated verification

- Staff Web typecheck: passed.
- Staff Web production build: passed.
- Patient Web typecheck: passed.
- Patient Web production build: passed with its existing large-chunk warning.
- API typecheck: passed.
- API production build: passed.
- Full Staff Web lint: blocked by the unchanged 34 unrelated baseline errors; no Phase 3-owned file is listed.
- Full API lint: blocked by the unchanged 42 unrelated baseline errors; no API file changed in Phase 3.
- Targeted lint was not applicable because Phase 3 changed only CSS and Markdown files, which are not covered by the ESLint configuration.
- `git diff --check`: passed before the final documentation update and is rerun as the final check.

## Browser QA and remaining risk

- Browser runtime discovery returned no connected browser, so the requested 375px, 480px, 640px, 768px, 1024px, 1440px, and 1920px viewport checks and 80%, 100%, 125%, and 150% zoom checks remain pending.
- No claim of visual acceptance or complete responsiveness is made.
- Interactive QA must still verify horizontal viewport overflow, native select/date/time behavior, long validation text, long titles, modal-body scrolling, and action reachability in representative live workflows.
- The pre-existing dirty working tree and generated `apps/web/tsconfig.tsbuildinfo` change were preserved.
- Phase 4 and Phase 5 have not started.

