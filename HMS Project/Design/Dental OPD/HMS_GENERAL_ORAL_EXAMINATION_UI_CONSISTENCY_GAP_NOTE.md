# General & Oral Examination UI Consistency — Gap Note

## Implemented

- Split the dental workspace into distinct **General Examination**, **Oral Examination**, and **Odontogram** steps while preserving the existing draft-save workflow.
- Removed whole-mouth soft-tissue fields from the selected-tooth panel.
- Simplified Oral Examination into two concise groups: **Soft tissues** and **Function & bite**.
- Added contextual icons to dental navigation, selected-tooth tabs, tooth conditions, and common high-value actions.
- Standardized shared font, control height, radius, icon spacing, and focus tokens used by common application buttons.

## Intentionally unchanged

- Clinical data fields, API payloads, permissions, draft behavior, treatment planning, imaging, laboratory, and billing workflows.
- Existing specialized colors that communicate clinical status or destructive actions.

## Remaining broader cleanup

- Some older screens still contain page-local inline styles and bespoke controls. They should be migrated incrementally to shared UI components to avoid risky application-wide visual changes in one release.
- The production build reports existing large-chunk warnings for the dental 3D and OPD bundles; route-level code splitting can address this separately.

## Verification

- Web TypeScript type-check: passed.
- Focused ESLint for changed TypeScript/TSX files: passed.
- Dental component tests: 47 passed.
- Production web build: passed.
