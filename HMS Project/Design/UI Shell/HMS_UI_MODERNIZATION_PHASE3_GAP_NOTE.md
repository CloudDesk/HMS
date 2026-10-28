# HMS UI Modernization Phase 3 Forms and Modals Audit and Gap Note

## Scope

Phase 3 is limited to responsive form and modal mechanics in Staff Web. It does not change form semantics, validation, API calls, React state, routing, modal contracts, business logic, table behavior, KPI/filter layouts, Patient Portal, or print layouts.

## Repository audit

### Shared primitives

- `apps/web/src/components/ui/Modal.tsx` is the shared portal-based dialog. It owns the overlay, centered `.modal-box`, header, independently scrolling body, optional footer, close behavior, and the temporary `body.modal-backdrop` class.
- `ConfirmDialog` and feature dialogs compose the shared modal; patient profile/timeline detail dialogs reuse the same modal class vocabulary directly.
- Shared form primitives in `apps/web/src/styles.css` include `.form-grid-2`, `.form-grid-3`, `.form-grid`, `.form-field`, `.form-group`, `.doc-form-grid`, `.doc-field`, `.modal-actions`, and `.modal-footer`.
- Shared controls already preserve focus, error, required, disabled, and locked states. The base controls did not consistently guarantee `min-width: 0`, `max-width: 100%`, or wrapping for long labels and validation text.

### Feature and domain ownership

- Inpatient owns `.modal-form-grid`, its two-column bed/ward forms, full-span fields, checkbox rows, and the existing one-column mobile rule.
- Billing owns `.billing-modal-form`, `.billing-form-grid`, and the intentional quantity/unit item-builder geometry. The modal form lacked its own narrow-screen collapse; the item builder already reflows and remains intentionally paired.
- Emergency owns sticky `.emergency-form-actions` and complex clinical grids. Its outer action bar becomes vertical at tablet width, but the inner button group did not wrap.
- Appointment, clinical, doctor, pharmacy, admission, surgery, and diagnostic forms have specialized layouts. Existing date/time, quantity/unit, clinical measurement, checklist, and stepper pairings are retained where their domain CSS already provides a safe layout.

### Responsive and cascade-sensitive rules

- `.modal-box` already uses bounded width and a flex-column, single-scroll-body model.
- Later legacy rules intentionally use `!important` to keep the body backdrop fixed above the application and to preserve the single modal scrollbar. Removing them would regress overlay layering and scroll behavior.
- Required asterisks, invalid controls, patient consent controls, and locked fields also use intentional cascade overrides and will remain unchanged.
- The body backdrop uses `100vw`/`100vh`; `100vw` can include scrollbar width and `100vh` does not track the dynamic mobile viewport.
- The shared title can overlap its absolutely positioned close button when the title is long.
- `.modal-footer` wraps below 640px, but `.modal-actions` does not share that responsive behavior.
- `.doc-form-grid` has an existing one-column rule below 768px, but several form consumers set `gridTemplateColumns` inline, which wins over that stylesheet rule.

### Fixed widths, overflow, and special cases

- Fixed widths found in clinical steppers, checkboxes, icons, and print documents are control geometry rather than structural form widths and are intentionally preserved.
- Native select/date/time controls and long validation messages need shared shrink/wrap protection.
- Complex custom dropdowns keep their existing behavior; modal bodies retain one intentional vertical scrollbar instead of gaining a second overlay scrollbar.
- No nested shared `Modal` component invocation was found. Direct patient detail dialogs reuse the same overlay/modal structure and receive the shared safeguards.
- HMS Local uses centered, viewport-bounded dialogs, responsive grids, and footer actions. The current Phase 3 brief explicitly says not to convert every modal to a bottom sheet, so the older reference plan's blanket bottom-sheet example is not applied.

## Intended implementation

- Add screen-only shared containment rules for modal boxes, headers, bodies, form fields, labels, controls, and validation text.
- Replace backdrop `100vw` with percentage width and add dynamic-viewport height while retaining the existing fixed-overlay cascade.
- Keep the single modal-body scrollbar and use a dynamic viewport-aware maximum modal height.
- Make long modal titles wrap without colliding with the close control.
- Collapse shared modal/form grids safely at narrow widths; use one targeted cascade override so inline `.doc-form-grid` column declarations cannot defeat the mobile layout.
- Extend wrapping and tappable button sizing to both `.modal-footer` and `.modal-actions`.
- Add only the missing billing modal and Emergency action-group exceptions in their existing owner stylesheets.
- Use `@media screen` so the responsive changes do not participate in invoice, receipt, clinical document, report, or other print rendering.

## Intended files

- `apps/web/src/styles.css`
- `apps/web/src/features/billing.css`
- `apps/web/src/domains/emergency.css`
- Phase 3 gap, verification, and modernization-plan status documents.

