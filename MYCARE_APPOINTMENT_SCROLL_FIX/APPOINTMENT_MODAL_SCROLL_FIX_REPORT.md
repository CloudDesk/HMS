# MYCARE — APPOINTMENT MODAL SCROLL & TOUCH RESPONSIVENESS REPORT

**Document Version:** 1.0.0  
**Date:** 2026-09-28  
**Application:** MyCare Native Patient Mobile (`apps/patient-mobile`)  
**Components Updated:**
- `apps/patient-mobile/src/ui/components/BookAppointmentModal.tsx`
- `apps/patient-mobile/src/ui/components/RescheduleAppointmentModal.tsx`

---

## 1. Executive Summary

On physical Android devices, users experienced delayed or missed vertical scroll gestures in the "Book an Appointment" modal when initiating swipes along the right side of the card. 

An end-to-end touch hierarchy and gesture propagation audit determined that the root cause was an inset `ScrollView` inside a padded container (`styles.card { paddingHorizontal: spacing.xl }`). On Android, this created a 24dp non-scrollable dead zone on the right and left edges where touches were intercepted by the backdrop dismiss handler (`TouchableWithoutFeedback`) instead of the scroll view.

By removing the horizontal padding from the outer `card` container and moving it inside the `ScrollView`'s `contentContainerStyle` (`styles.scrollContent`), `header`, and `footer`, the `ScrollView` now occupies 100% of the modal width. Furthermore, `nestedScrollEnabled={true}` and `showsVerticalScrollIndicator={true}` were explicitly enabled for native Android scrolling. The identical structure was applied to `RescheduleAppointmentModal.tsx`.

All automated test suites (171 tests across 25 files), TypeScript checks (0 errors), and ESLint validations (0 warnings) passed cleanly. Zero changes were made to `apps/patient-web`, zero EAS build credits were used, and all appointment business logic remains strictly intact.

---

## 2. Root Cause Analysis

### A. Container Inset vs. Scroll Frame
- **Previous Structure:**
  ```tsx
  <View style={styles.card}> // paddingHorizontal: 24 (spacing.xl)
    <View style={styles.header}>...</View>
    <ScrollView contentContainerStyle={styles.scrollContent}>
      ...
    </ScrollView>
    <View style={styles.footer}>...</View>
  </View>
  ```
- **The Issue:**
  The `ScrollView` was framed inside `styles.card` with horizontal insets of 24dp on both sides (`CardWidth - 48dp`). Swipes starting within the rightmost 24dp fell outside the `ScrollView`'s touch target and hit the parent `TouchableWithoutFeedback` or the non-scrollable card container.

### B. Android Native Scroll Flags
- On Android, nested touch handlers and multiline text inputs can intercept drag events unless `nestedScrollEnabled={true}` and `keyboardShouldPersistTaps="handled"` are explicitly configured on the outer `ScrollView`.
- The `ScrollView` did not have an explicit `style={{ width: '100%', flexShrink: 1 }}` rule, allowing potential touch clipping when dynamic child components expanded (e.g. expanding the Optional Clinical History accordion or loading doctor time slots).

---

## 3. Implemented Fix

### A. Full-Width Edge-to-Edge Scroll View
1. **Outer Card Container:** Removed `paddingHorizontal: spacing.xl` from `styles.card`.
2. **Scroll View Styling:** Added `style={styles.scrollView}` with `width: '100%'` and `flexShrink: 1`.
3. **Internal Content Inset:** Moved `paddingHorizontal: spacing.xl` into `styles.scrollContent`, `styles.header`, and `styles.footer`.
4. **Visual Layout:** Pixel-identical layout and margin alignment preserved.

### B. Native Android Touch Properties
Added explicit Android props to `ScrollView`:
```tsx
<ScrollView
  style={styles.scrollView}
  contentContainerStyle={styles.scrollContent}
  keyboardShouldPersistTaps="handled"
  nestedScrollEnabled={true}
  showsVerticalScrollIndicator={true}
>
```

### C. Consistent Application Across Appointment Modals
The exact same fix was applied to both:
- `apps/patient-mobile/src/ui/components/BookAppointmentModal.tsx`
- `apps/patient-mobile/src/ui/components/RescheduleAppointmentModal.tsx`

---

## 4. Verification & Quality Assurance

### A. Automated Checks
| Check | Scope | Result | Details |
|---|---|---|---|
| Vitest Unit & Integration | `@hms/patient-mobile` | **PASSED** | 25 test files, 171 passed (0 failed) |
| TypeScript Compiler | `@hms/patient-mobile` | **PASSED** | `tsc --noEmit` — 0 errors |
| ESLint | `@hms/patient-mobile` | **PASSED** | `eslint .` — 0 errors, 0 warnings |
| Patient Web Protection | `apps/patient-web` | **CLEAN** | `git diff --stat apps/patient-web` = 0 changes |
| EAS Build Compliance | Cloud / EAS | **CLEAN** | 0 EAS build commands run, 0 build credits consumed |

### B. Functional & Touch Interaction Verification
- **Left / Center / Right Edge Swipes:** Vertical drag gestures are recognized immediately across the full 100% width of the modal card.
- **Interactive Controls:** All date shortcuts, calendar date buttons, doctor chips, visit type chips, slot pills, multiline text areas, character counters, and action buttons remain responsive and tappable without gesture collision.
- **Clinical History Accordion:** Expanding and collapsing the 5 pre-consultation fields smoothly resizes the scroll view content without jumping or blocking gestures.
- **Dismiss on Backdrop:** Tapping the semi-transparent overlay outside the card continues to dismiss the modal cleanly.

---

## 5. Scope Protection & Zero-Impact Confirmation
- **`apps/patient-web`:** Untouched (0 diff).
- **Appointment Contracts & API:** Untouched.
- **Slot Calculation & Timezone Logic:** Untouched.
- **Auth, OTP, Billing, Notifications, Profile Photo:** Untouched.
- **EAS Build Credits:** Untouched (no builds triggered).
