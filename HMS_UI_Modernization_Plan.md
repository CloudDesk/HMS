# HMS Enterprise — UI Modernization & Responsiveness Plan

Goal: keep the existing design language (colors, spacing, component names, class contracts) but rebuild the *mechanics* underneath it — layout, sizing, breakpoints — so it works cleanly on mobile / tablet / laptop / desktop **and** stays legible at browser zoom 80%–100%–125%–150%.

No new CSS framework. Everything stays in `styles.css`, additive, grouped at the bottom by module — consistent with your existing rule.

---

## 1. Why the current system breaks at other sizes/zoom

| Current pattern | Problem |
|---|---|
| Sidebar: `280px` / collapsed `72px` fixed px | Doesn't scale with root font-size → at 150% zoom it eats half the viewport on a laptop; at 80% zoom it looks tiny and wastes space |
| `.data-table { min-width: 760px }` | Forces horizontal scroll on anything under ~800px, including many tablets in portrait |
| `top-header { height: 70px }` fixed | Doesn't adapt to larger zoomed text — content clips |
| No container queries | Cards/panels can't adapt to *their own* width (e.g. sidebar collapsed vs expanded) independent of viewport |
| `dashboard-container { height: 100vh }` | Breaks on mobile Safari (address bar resize) and doesn't respect zoom-driven reflow |
| Spacing/radius/font all in `rem`/`px` mixed ad hoc | Zoom mostly works with `rem` already (good), but px-based structural values (280px sidebar, 760px table) don't |

**Key principle for zoom support:** browser zoom scales everything proportional to `rem`/`em`/`%`, *except* raw `px` used for structural layout (fixed widths, min-widths). So the fix isn't "support zoom" as a separate feature — it's "stop hardcoding structural px, use rem/clamp/relative units," and zoom + responsiveness both fall out of that for free.

---

## 2. New Foundational Tokens (additive, in `:root`)

Add fluid tokens alongside the existing ones — don't remove the existing `--primary`, `--text-main`, etc.

```css
:root {
  /* Fluid spacing scale — replaces hardcoded rem values in new code */
  --space-1: clamp(0.25rem, 0.2rem + 0.2vw, 0.375rem);
  --space-2: clamp(0.5rem, 0.4rem + 0.4vw, 0.75rem);
  --space-3: clamp(0.75rem, 0.6rem + 0.5vw, 1rem);
  --space-4: clamp(1rem, 0.85rem + 0.6vw, 1.5rem);
  --space-5: clamp(1.5rem, 1.3rem + 0.8vw, 2rem);

  /* Fluid type scale */
  --text-xs:  clamp(0.72rem, 0.7rem + 0.1vw, 0.76rem);
  --text-sm:  clamp(0.82rem, 0.8rem + 0.1vw, 0.86rem);
  --text-base: clamp(0.9rem, 0.88rem + 0.15vw, 1rem);
  --text-lg:  clamp(1.05rem, 1rem + 0.3vw, 1.25rem);
  --text-xl:  clamp(1.2rem, 1.1rem + 0.5vw, 1.5rem);

  /* Structural layout — rem instead of px so zoom scales it */
  --sidebar-width: 17.5rem;       /* was 280px */
  --sidebar-width-collapsed: 4.5rem; /* was 72px */
  --header-height: clamp(3.75rem, 3.5rem + 1vw, 4.5rem); /* was fixed 70px */

  /* Responsive breakpoints as custom properties for JS/media use */
  --bp-sm: 480px;
  --bp-md: 768px;
  --bp-lg: 1024px;
  --bp-xl: 1280px;
}
```

Why `rem` for sidebar width: `1rem` = root font size, which browser zoom scales directly. `17.5rem` at default 16px root = 280px (identical to today), but at 125% zoom it grows proportionally instead of the content around it shrinking relative to a frozen 280px sidebar.

---

## 3. Layout Shell Changes (`DashboardLayout`, `Sidebar`, `TopHeader`)

### Sidebar
- Switch `width: 280px` → `width: var(--sidebar-width)`, collapsed → `var(--sidebar-width-collapsed)`.
- **Mobile (< 768px):** sidebar is *always* the off-canvas drawer (already exists) — but also auto-collapse-to-drawer at any zoom level where computed viewport width (`window.innerWidth`, which already reflects zoom) drops below 768px. No JS breakpoint changes needed since `mobileOpen` logic is width-based already — just confirm the check uses `window.innerWidth`, not a device sniff.
- **Tablet (768–1024px):** default to *collapsed* (icon-only) sidebar, expandable on tap — new default, currently likely defaults to expanded.

### TopHeader
- `height: 70px` → `height: var(--header-height)`.
- Right-side cluster (`BranchSelector → NotificationsMenu → UserMenu`) needs a wrap strategy: at narrow widths, collapse `BranchSelector` label to icon-only and move it into a small overflow menu rather than letting it shrink illegibly.

### Dashboard container
- `height: 100vh` → `height: 100dvh` (dynamic viewport height — fixes mobile browser chrome resize jump). Fallback: keep `100vh` first, override with `100dvh` after (progressive enhancement, no support issues).

```css
.dashboard-container {
  height: 100vh;
  height: 100dvh;
}
```

---

## 4. Breakpoint Strategy (new, explicit)

Right now breakpoints are implicit/inconsistent per-module. Standardize on 4 tiers, mobile-first:

| Tier | Width | Sidebar | Tables | Forms/grids |
|---|---|---|---|---|
| Mobile | < 480px | drawer (hidden) | card-list view (see §5) | 1 column |
| Tablet | 480–1024px | collapsed icon rail, expandable | horizontal scroll, sticky first column | 2 columns |
| Laptop | 1024–1440px | expanded (current default) | full table | current (2–3 col) |
| Desktop | > 1440px | expanded, content gets `max-width` cap | full table | current, wider gutters |

Add one desktop-only change your doc flags as absent: **cap content width on very large monitors.**

```css
.main-content > * {
  max-width: 1600px;
  margin-inline: auto;
}
```
(Currently "no fixed max-width is enforced" — on ultra-wide monitors tables/forms stretch uncomfortably; this fixes that without touching the flex layout.)

---

## 5. Tables — the biggest responsiveness gap

`.data-table { min-width: 760px }` forcing scroll is fine for tablet/laptop, but bad for phones. Two-tier strategy, no component API changes needed in `DataTable.tsx`:

**≥ 640px:** keep exactly as-is (`table-responsive` horizontal scroll), just also make the **first column sticky** so users scrolling right don't lose row context:
```css
@media (min-width: 640px) {
  .data-table td:first-child,
  .data-table th:first-child {
    position: sticky;
    left: 0;
    background: inherit;
    z-index: 1;
  }
}
```

**< 640px:** switch to a stacked "card row" layout using CSS only (no markup change — pure CSS table transform):
```css
@media (max-width: 639px) {
  .data-table thead { display: none; }
  .data-table, .data-table tbody, .data-table tr, .data-table td {
    display: block; width: 100%;
  }
  .data-table tr {
    border: 1px solid var(--border);
    border-radius: 10px;
    margin-bottom: var(--space-3);
    padding: var(--space-2);
  }
  .data-table td {
    display: flex; justify-content: space-between; gap: var(--space-2);
    border-bottom: 1px solid #f1f5f9;
    padding: 0.5rem 0.25rem;
  }
  .data-table td::before {
    content: attr(data-label);
    font-weight: 700; color: var(--text-muted); font-size: var(--text-xs);
  }
}
```
Only requirement: each `<td>` needs a `data-label="Column Name"` attribute — a one-line addition wherever tables are rendered (or bake it into `DataTable.tsx`'s `columns[].header` automatically, fixing it once for every module that uses the shared component).

---

## 6. Forms & Modals

- `.modal-form-grid` (2-col) and `.form-grid` (3-col): change fixed `repeat(2, minmax(0,1fr))` → `repeat(auto-fit, minmax(220px, 1fr))`. Collapses to 1 column automatically under ~460px modal width without a media query.
- `.modal-box { width: min(100%, 720px) }` already responsive — good, no change.
- On mobile, modal should go full-screen instead of centered card:
```css
@media (max-width: 480px) {
  .modal-overlay { padding: 0; align-items: flex-end; }
  .modal-box, .modal-box.large {
    width: 100%; max-height: 92dvh;
    border-radius: 16px 16px 0 0; /* bottom sheet feel */
  }
}
```

---

## 7. Zoom Support Checklist

| Rule | Action |
|---|---|
| No fixed `px` for structural widths | Sidebar, header height → `rem`/`clamp()` (§2) |
| Text stays legible at 150% zoom | Fluid type scale (§2) already caps growth so headers don't blow past their containers |
| No `overflow: hidden` on text containers with fixed height | Audit `.stat-card`, `.doc-card` headers — use `min-height` not `height` |
| Icon buttons stay tappable at 80% zoom | Keep `.action-icon-btn` at `min(30px, 1.875rem)` style floor so they don't shrink below ~28px touch target |
| Test matrix | Chrome/Edge/Firefox at 80%, 90%, 100%, 110%, 125%, 150% zoom, at 375px/768px/1024px/1440px/1920px viewport widths |

---

## 8. Rollout Plan (phased, non-breaking)

**Phase 1 — Foundation (1 PR, touches only `:root` + shell)**
- Add new tokens (§2)
- Convert `Sidebar.tsx`/`.sidebar`, `TopHeader.tsx`/`.top-header`, `.dashboard-container` to use them
- Switch `100vh` → `100dvh`
- Add `max-width` cap on `.main-content`
- Zero visual change at 100% zoom/1440px — this is the safety net phase

**Phase 2 — Tables**
- Add sticky-first-column CSS
- Add mobile card-row CSS + `data-label` attributes (start with `DataTable.tsx` so all its consumers get it free; then patch the modules that write `<table>` inline — BedManagement ward table, InpatientAdmission, PatientSearch, DoctorDirectory's `doc-table`)

**Phase 3 — Forms/Modals**
- `auto-fit` grid conversion on `.modal-form-grid`, `.form-grid`, `.doc-form-grid`
- Mobile bottom-sheet modal style

**Phase 4 — Per-module polish**
- KPI grids (`.bed-kpi-grid`, `.kpi-grid`, `.um-kpi-row`) → `grid-template-columns: repeat(auto-fit, minmax(160px, 1fr))` instead of fixed column counts, so 5-col grids reflow to 2 on mobile automatically
- Filter toolbars → `flex-wrap: wrap` audit (some already do, confirm all)

**Phase 5 — QA pass**
- Run the zoom/viewport test matrix from §7 against every page in Section 10 of your reference doc

---

## 9. What does NOT change

- Class names/contracts (`btn-primary`, `data-table`, `modal-form-grid`, `StatusBadge`, etc.) — stay identical, so no component code needs rewriting, only the CSS behind the classes
- Color tokens, border-radius scale, shadow values — untouched
- The two-button-system split (`btn-*` vs `doc-*`) — out of scope for this pass, orthogonal issue
- Routing, state management, React Query — untouched

---

## 10. Quick Reference — Before / After

| Element | Before | After |
|---|---|---|
| Sidebar width | `280px` | `var(--sidebar-width)` = `17.5rem` |
| Header height | `70px` | `var(--header-height)` = fluid `3.75–4.5rem` |
| Container height | `100vh` | `100vh` fallback → `100dvh` |
| Table on mobile | horizontal scroll, `min-width: 760px` | stacked card rows under 640px |
| Table on tablet/desktop | horizontal scroll | horizontal scroll + sticky first column |
| Modal grid columns | fixed `repeat(2, 1fr)` / `repeat(3, 1fr)` | `repeat(auto-fit, minmax(220px, 1fr))` |
| Modal on mobile | centered card | bottom sheet, full width |
| KPI grid columns | fixed count | `repeat(auto-fit, minmax(160px, 1fr))` |
| Content max-width | none (stretches on ultra-wide) | capped at `1600px`, centered |

---

## Implementation Status

| Phase | Status | Date | Evidence |
|---|---|---|---|
| Phase 1 - Foundation | Implemented; interactive browser QA pending because no browser was available in the verification session | 30 August 2026 | `HMS_UI_MODERNIZATION_PHASE1_GAP_NOTE.md`, `HMS_UI_MODERNIZATION_PHASE1_VERIFICATION.md` |
| Phase 2 - Tables | Implemented; interactive browser QA pending because no browser was available in the verification session | 30 August 2026 | `HMS_UI_MODERNIZATION_PHASE2_GAP_NOTE.md`, `HMS_UI_MODERNIZATION_PHASE2_VERIFICATION.md` |
| Phase 3 - Forms/Modals | Implemented; interactive browser QA pending because no browser was available in the verification session | 30 August 2026 | `HMS_UI_MODERNIZATION_PHASE3_GAP_NOTE.md`, `HMS_UI_MODERNIZATION_PHASE3_VERIFICATION.md` |
| Phase 4 - Per-module polish | Implemented; interactive browser QA pending because no browser was available in the verification session | 30 August 2026 | `HMS_UI_MODERNIZATION_PHASE4_GAP_NOTE.md`, `HMS_UI_MODERNIZATION_PHASE4_VERIFICATION.md` |
| Phase 5 - QA pass | Not started | - | - |
