# MyCare — Appointment Booking Mobile UI Fix

## 1. Problem Statements & Requirements

1. **Modal Scrolling & Android Navigation Insets:**
   - On physical Android devices, the bottom modal footer ("Confirm Booking" button) was cut off or hidden behind the Android software navigation bar / home indicator.
   - The outer `TouchableWithoutFeedback` conflicted with touch gestures on the inner `ScrollView`, preventing smooth scrolling through slots, notes, and clinical history.

2. **Department Selection Locked to Dental:**
   - The department selector allowed choosing arbitrary departments.
   - Requirement: The booking flow must show **Dental only** as a locked/fixed department badge (with tooth icon 🦷) and auto-select Dental doctors and slots.

3. **Removal of Visit Type:**
   - The booking form displayed "Visit Type" selector chips (New Consultation, Follow Up, Procedure).
   - Requirement: Remove Visit Type from the patient-facing UI and default it internally to `NEW_CONSULTATION` in API payloads.

---

## 2. Implemented Fixes

### A. Modal Layout, Safe Area Insets & Gesture Handling
- In `apps/patient-mobile/src/ui/components/BookAppointmentModal.tsx`:
  - Utilized `useSafeAreaInsets()` from `react-native-safe-area-context`.
  - Added dynamic padding bottom `Math.max(insets.bottom, spacing.md)` to the card container and `Math.max(insets.bottom, spacing.xs)` to the sticky footer.
  - Replaced the outer blocking `TouchableWithoutFeedback` with a dedicated backdrop overlay touchable (`styles.backdropTouchable`), allowing unobstructed touch responder handling on `ScrollView`.
  - Configured `nestedScrollEnabled={true}` and `keyboardShouldPersistTaps="handled"` on all modal `ScrollView` components.

### B. Dental Department Locked & Auto-Selected
- In `apps/patient-mobile/src/ui/components/BookAppointmentModal.tsx`:
  - Filtered branch departments to `Dental` (`d.name.toLowerCase() === 'dental' || d.code === 'DENT' || d.code === 'DENTAL'`).
  - Auto-selected Dental department ID on branch load.
  - Replaced department interactive dropdown trigger with a locked badge:
    ```tsx
    <View style={styles.selectTriggerLocked}>
      <View style={styles.lockedDeptBadge}>
        <Text style={styles.dentalIcon}>🦷</Text>
        <Text style={styles.lockedDeptText} numberOfLines={1}>
          {selectedDepartment?.name ?? 'Dental'}
        </Text>
      </View>
    </View>
    ```

### C. Visit Type Removed from UI
- Removed `visitType` state and UI chips from `BookAppointmentModal.tsx`.
- Defaulted `visit_type: 'NEW_CONSULTATION'` directly inside `bookAppointment` payload.
- Updated `bookAppointmentInputSchema` in `apps/patient-mobile/src/appointments/contracts.ts` to make `visit_type` optional with a default of `'NEW_CONSULTATION'`.

---

## 3. UI/UX Verification
- Entire booking modal scrolls smoothly from top (Patient/Branch/Doctor selection) to bottom (Date/Time Slot/Reason/Clinical History/Confirm button).
- Confirm Booking button is always visible, tappable, and elevated above the Android navigation bar.
- Department displays clean "🦷 Dental" styling.
