# Dental affected surfaces interactive 3D correction

## Final implementation audit on 10 September 2026

The selector now loads licensed BodyParts3D anatomical category meshes for upper and lower central/lateral incisors, canines, first/second premolars, and first/second molars. Permanent position 8 uses the second-molar representative because the source has no third-molar mesh. Primary incisors/canines use their matching categories; primary positions 4 and 5 correctly use first/second molar representatives rather than premolars. These are representative anatomy meshes, not patient-specific or diagnostically validated scans.

The real OBJ coordinates are normalized at runtime. The renderer derives the broad crown axis for the default facial view and handles the opposite crown/root directions of maxillary and mandibular source meshes. Existing surface IDs, selection state, disabled handling, API/save contracts, and parent persistence remain unchanged.

The current implementation supersedes the static-image version documented below. The selector uses native WebGL with five selectable crown regions and unselectable roots. Existing ToothSurface values remain unchanged. Buttons and mesh clicks use the same controlled toggle without forcing a camera change. Dragging, arrow keys, rotate controls, zoom and reset affect only the view.

Multiple selected regions remain highlighted while rotating or zooming. The selected surface name and leader arrow appear only for a surface recorded on the current tooth; changing teeth with zero selections clears the annotation. In read-only mode, recorded regions can be identified without mutating data. Patient-right versus patient-left changes the mesial/distal mapping. WebGL failure preserves the labelled button workflow.

New renderer: apps/web/src/components/opd/dental/tooth-3d.ts. Static artwork is no longer imported or included in the application build. No new package, backend route, clinical status, permission, schema, save payload or persistence code was introduced. WebGL failure or context loss produces an explicit fallback while the labelled surface buttons remain usable. Restored contexts rebuild their buffers and reapply the controlled selections. Renderer resources and listeners are cleaned up on unmount/tooth change.

Current verification: web typecheck, lint and production build passed; 21 focused dental tests passed. Earlier headless Edge checks confirmed each of the five selections changes visible mesh pixels and picking returns its matching enum. Direct canvas clicks toggle the same controlled surface value. Read-only interaction does not change selections, and camera interaction does not change clinical data. This is component/browser verification, not live patient acceptance or clinical validation of the source mesh segmentation.

Production web build also passed. The 320 px mobile layout and the mesial-only and all-selected renderings were inspected. Temporary preview routes were removed; screenshots and the obsolete generated bitmap were moved outside application source to the task's visualization output directory.

## Superseded static-image implementation

Scope: replace the earlier dimensional SVG with realistic fixed tooth artwork and accessible surface controls. No lifecycle, backend, permission, API, schema, or persistence changes; no new release phase.

Reused: ToothSurface enum, TOOTH_SURFACES, existing arch/anterior helpers, the controlled surfaces/onChange/disabled props, and the parent examination save workflow. The same five values and append/remove semantics are retained. Primary posterior tooth illustrations use the molar asset.

Changed: ToothSurfaceSelector.tsx, the selector section of DentalExamination.module.css, ToothSurfaceSelector.test.tsx, and tooth-models.webp. No shared registries changed. Existing blue selection colors and white bordered clinical panels are reused. scope/HMS Local is absent in this checkout, so the existing dental panel provided layout context.

The model is illustrative artwork, not patient-specific anatomy or a rotatable 3D mesh. Surface selection uses labelled native buttons; artwork is decorative and does not infer findings. Selected buttons expose aria-pressed; disabled buttons preserve visible recorded values.

Verification: web typecheck, lint and build passed. Existing dental examination suite passed 18 tests. Headless Edge verified selection and keyboard deselection, unchanged values, upper/lower labels, and no overflow at 320 px viewport width. Incisor, molar and mobile screenshots were visually inspected. This was an isolated rendering of the production component, not live patient acceptance.

Asset: apps/web/src/components/opd/dental/tooth-models.webp, 14,656 bytes, generated with the built-in image tool and optimized to WebP. Generation prompt: four evenly spaced realistic tooth renders on a white background, left to right incisor, canine, premolar, molar; ivory enamel, beige roots, soft studio lighting, slight three-quarter frontal view; no text, UI, gums, labels or additional teeth; decorative educational artwork for separately implemented surface controls.
