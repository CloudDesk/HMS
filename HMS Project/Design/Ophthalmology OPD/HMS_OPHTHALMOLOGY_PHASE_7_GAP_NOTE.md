# HMS Ophthalmology OPD Phase 7 Gap Note

**Date:** 15 October 2026  
**Phase:** 7 - Contact lens and paediatric vision assessments  
**Status:** COMPLETE

## Approved scope

Phase 7 extends the existing versioned Ophthalmology result resource with `CONTACT_LENS` and `PAEDIATRIC_VISION`. It contracts every FSD Table 30 and Table 31 field, preserves manual/correction provenance, validates branch-versioned clinical references, retains task eye and performer context, supports draft/completion/amendment, and remains permission-visible through the unified current/history result read.

## Existing functionality reused

- Phase 5-6 result head, append-only clinical versions, form-profile snapshots, task/result optimistic versions, transactions, audit, station assignment, device context, scoped reads, and active same-patient documents.
- Branch-versioned `OPTICAL_PRODUCT` and `DRUG_OPTION` configuration records. Phase 7 references these resources instead of creating contact-lens or medication masters.
- The authoritative Patient record for date of birth and guardian-presence context. Guardian names are not copied into the test result.
- The existing OPD follow-up resource. A contact-lens assessment may reference an existing follow-up for the same visit/patient but does not create or reschedule it.
- Existing Patient consent/document services remain authoritative. The supplied FSD does not mandate a new consent for either assessment.
- HMS Local OPD consultation, patient, consent, prescription, and follow-up patterns were inspected for contract compatibility. There is no dedicated Contact Lens or Paediatric Ophthalmology prototype and no prototype file will be changed.

## Missing contracts and explicit boundaries

1. `doc/HMS_Release2_FSD.docx` remains absent; the root release document is unrelated to Ophthalmology. The supplied Ophthalmology FSD and approved DEC-01 through DEC-12 remain authoritative.
2. DEC-06 production contact-lens types/brands/materials/schedules/fit grades/outcomes, paediatric methods/results, age boundary, and cycloplegic medication options remain branch configuration dependencies. No production clinical values are seeded.
3. Patient consent contexts do not include an Ophthalmology test assessment, and the FSD does not require one. Phase 7 will not invent a mandatory consent type. Any later approved consent rule must use the existing consent service.
4. Contact-lens acceptance in this result is an assessment outcome, not an optical prescription approval. Final prescription/doctor approval remains Phase 8.
5. Contact-lens follow-up captures education, recommendation, and an optional validated existing OPD follow-up reference. It does not duplicate appointment/follow-up scheduling.
6. Paediatric age is derived from authoritative date of birth at performed time. The active form profile must provide `paediatric_max_age_years`; an older patient is rejected. Guardian presence is recorded as a derived boolean only. No guardian identity is duplicated.

## Frozen Phase 7 design

- `CONTACT_LENS` stores `TRIAL | FINAL` stage, OD/OS configured optical-product references and lens attributes, power, trial/schedule details, fit, over-refraction, visual acuity, comfort/ocular response, outcome, required training/hygiene education, and follow-up recommendation/reference.
- Each supplied optical-product ID must be an active branch `OPTICAL_PRODUCT` configuration. An optional follow-up ID must be the existing non-deleted OPD follow-up for the same visit and patient.
- `FINAL` contact-lens assessments and outcomes requiring doctor review set task doctor-review visibility; they do not approve an optical prescription.
- `PAEDIATRIC_VISION` stores age-appropriate methods, cycloplegic refraction with medication/timing, OD/OS alignment and red reflex, amblyopia/binocular vision including stereopsis/colour vision when performed, cooperation, separately recorded parent symptoms, birth/development history, and result codes.
- Cycloplegic assessment requires an active branch `DRUG_OPTION` reference plus administration and examination times. Performed/examination timing must be internally ordered.
- Paediatric age months and guardian-presence are derived server-side and persisted in the result payload. Configured age limit, required/allowed/range rules, task laterality, axes, source, documents, and performer scope remain backend authoritative.

## Intended files

- Extend the existing Ophthalmology types, result model form enum, schema enum, form contract, repository reference lookups, service validation/review derivation, and Phase 7 tests.
- Add `apps/api/src/modules/ophthalmology/ophthalmology.phase7.test.ts`.
- Update API contract version, Phase 0 alignment matrix, Developer A prompt, this gap note, and add Phase 7 verification.
- Do not change frontend code, patient/consent/OPD follow-up implementations, permission seeds, shared service registries, generated artifacts, or `scope/HMS Local`.

## Acceptance checks

- Successful draft, completion, scoped read, amendment, persistence, audit, and appropriate review visibility for both forms.
- Trial/final distinction; per-eye optical product/power/fit/over-refraction/response; education and follow-up conditionals.
- Paediatric derived age/guardian context, configured age boundary, cycloplegic medication/timing, eye findings, cooperation, parent/observed separation, and result conditionals.
- Wrong branch/inactive/wrong-type optical or drug configuration, wrong-visit/patient follow-up, task-eye conflict, unsafe approval fields, incomplete forms, stale versions, concurrent completion, and rollback.
- Phase 5-7 result regression, API/web typecheck/lint/build, focused tests, and full API regression.

## Stop gate

After Phase 7 verification and documentation are complete, stop. Do not begin Phase 8 without explicit owner approval.
