# Dental flow, consultation intake, and patient check-in gap note

## Baseline gaps

- Dental OPD exposed Consultation, Dental Examination, Prescription, and Referral as peer workspace tabs.
- The consultation history form was clinician-editable in the dental workspace instead of being collected during booking.
- Appointment records did not persist the five-field basic consultation intake.
- Patient portal appointments had no self-check-in action or patient-scoped check-in endpoint.
- Dental styles introduced a second heading font (`Sora`) and shared typography did not expose semantic size tokens.

## Implemented

- Dental visits expose Dental Examination as their sole workspace tab.
- Prescription and Referral are dedicated OPD sidebar subsections and routes.
- Patient and staff/reception booking collect chief complaint, HPI, past history, family history, and allergies/sensitivities.
- Booking intake is persisted on the appointment and copied transactionally into the OPD consultation record at check-in for read-only dental context.
- Patient self-check-in is patient-authorized, limited to scheduled/confirmed appointments on the appointment date, and uses existing active-visit and unique appointment/visit protections.
- Staff and patient applications now share an Inter-based font stack and semantic heading/body size tokens; the dental-only font override was removed.

## Verification

- API, staff web, and patient web type checks passed.
- API, staff web, and patient web production builds passed.
- Focused OPD and patient portal tests passed (23 tests total).
- ESLint passed for every file changed by this implementation.
- Full API/web lint remains blocked by unrelated pre-existing errors in dental quotation/staging tests, `OdontogramChart.tsx`, `dental-3d-scene.ts`, and `dental-pdf.ts`.
