# Dental odontogram UI replacement — gap assessment

Date: 15 September 2026

## Inspected and reused

- Existing `OdontogramChart` owns only dentition-view presentation and calls the parent `onSelectTooth`; Dental Examination remains the owner of selected tooth, findings, affected surfaces, imaging context, diagnosis, treatment, save and completion behavior.
- Existing FDI constants preserve the correct patient-perspective order for all 32 permanent and 20 primary teeth.
- Existing Dental SVG surface colors, legend meanings, accessibility names, selected state and keyboard activation can be retained.
- Existing anatomical OBJ assets are optimized for the larger interactive affected-surface viewer. Reusing 52 WebGL models in the overview chart would be unnecessarily expensive; lightweight inline SVG is appropriate for independently interactive chart teeth.
- The attached anatomical reference establishes the upper/lower U-shaped arches and tooth-group labeling. HMS Local supplies the compact clinical panel, tabs, status and responsive patterns.

## Gap and intended files

The current tooth controls are rectangular cards in four straight rows, and their inner SVG is a rectangular five-surface diagram. Replace this presentation with a single curved maxillary arch and single curved mandibular arch, anatomical SVG silhouettes by tooth class, patient-perspective orientation, FDI labels, group brackets, condition/surface overlays, selected/focus states, and an internal responsive chart viewport.

Only `apps/web/src/components/opd/dental/OdontogramChart.tsx`, its existing Dental CSS module and focused Dental tests require production/test changes. No backend, API, persistence, permission, global CSS, generic OPD CSS, Imaging, Lab, diagnosis, treatment or billing change is intended.
