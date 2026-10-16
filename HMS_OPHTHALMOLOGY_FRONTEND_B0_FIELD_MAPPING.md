# Ophthalmology frontend B0 field mapping

**Current continuation:** Repeated code, dilation, image-set and IOL calculation controls plus multi-document selection are implemented; the 13-area shell/header is also present. The row inventory below remains historical contract evidence, not certification that all 178 rows passed live acceptance. Current remaining schemas/acceptance are in `HMS_OPHTHALMOLOGY_FRONTEND_B1_B2_REMAINING_GAPS.md`.

**Date:** 16 October 2026. **Status:** assessment complete; frontend forms not implemented.

**Historical baseline:** The inventory below was written against contract v1.4.0. Backend commit `537c55a` now delivers A6/A7 and contract v1.10.0; statements below saying those phases are absent are historical, not current blockers. B2 implementation and remaining exact nested-field/control gaps are tracked in `HMS_OPHTHALMOLOGY_FRONTEND_B2_GAP_NOTE.md` and its verification record. Initial controls do not certify all 178 rows complete.

This inventory preserves each source field row from FSD sections 9.1–9.21 and identifies the current API destination or exact missing schema. It is an analysis artifact, not a replacement API contract. Source table ordinals below refer to the supplied copy only.

**Source:** `C:/Users/Admin/Downloads/Ophthalmology_OPD_Consultation_Functional_Specification_Document 1.docx`; FSD v1.0, 10 September 2026. SHA-256: `6b338277eb07a446323a6c0cee8e5e3654cd353adffba7607c4586eee23881f2`.

**Code sources:** `apps/api/src/modules/ophthalmology/ophthalmology.types.ts`, `ophthalmology.schemas.ts`, `ophthalmology-core-test-contract.ts`; published contract `HMS_OPHTHALMOLOGY_BACKEND_API_CONTRACT_V1.md` v1.4.0. Read-only inspection. No dedicated staff specialty form exists yet.

## Conventions and common behaviour

- Paths are relative to result `payload`; `@` marks common DTO/task/response metadata. `{OD,OS}` means independent right/left values, not a single OU measurement. Dates on the wire are ISO strings even where backend source types declare Date.
- Every implemented form uses `GET /api/ophthalmology/test-tasks/:taskId/result`, `PUT .../result/draft`, `POST .../result/complete` and the supported completed-result `POST .../result/amendments`. These routes currently accept eight core form types only. Other form names are reserved vocabulary, not callable contracts.
- Draft DTO: exact task status/version, expected result version (null only on create), form/schema/profile identity, performed time, source, reliability/reason, comments, existing document references and payload. Completion and amendment use their own exact schemas.
- Scope: Queue View for permitted task/result reads; Queue Edit/Complete for draft/completion; Test Review Amend for amendment, plus backend user/branch/department/assignment/station/resource checks. Confirm the exact per-route permission in implementation; a role name or page access alone grants nothing.
- Source type, performer/time, device/calibration and configuration snapshots, result/task versions and immutable amendment history must stay visible to permitted users. Poor reliability requires explanation. Draft save does not imply test completion, review or clinician approval.
- Mandatory/optional decisions come from structural backend validation plus the bound active FORM_PROFILE; complete-only rules do not prevent legitimate incomplete drafts. The FSD rules below are preserved verbatim as requirements, not seeded clinical values.
- Axis structural range is 0–180. Other clinical limits/options/units/formulas are configuration or approved contract inputs. Derived values retain source readings and the selected final source; server validation is authoritative.
- Broad `Record<string, unknown>` containers are not a field-level specification. Rows marked nested-shape handoff need Developer A to publish the accepted substructure/options before that control is integrated. Do not invent its nested keys or use casts to bypass it.
- Attachments are permitted existing patient-document references at A5. New specialty upload/annotation/video/device-import controls remain gated by policy and implemented API. Old values must not be replaced when viewing historical results.
- Acceptance for each row: correct eye/context, entry and validation, draft save/reload, completion error/success, no duplicate retry, denied access, stale conflict and supported amendment. Comparisons must match patient/eye/test/protocol/unit and preserve the current visit.

## 9.1 Visual acuity

**Frontend:** B2b. **Backend:** A5. **Form type:** `VISUAL_ACUITY`. **UI baseline:** missing specialty form.

| ID | FSD field | FSD type or findings | FSD rule | API destination and integration state |
|---|---|---|---|---|
| F-9.1-01 | Chart Type | Snellen / LogMAR / Tumbling E / Lea / Numbers | Configured formats must be stored as structured values. | `chart_type`; CORE CONTRACT AVAILABLE |
| F-9.1-02 | Test Distance | Number plus Unit | Required for distance testing. | `test_distance.value / unit`; CORE CONTRACT AVAILABLE |
| F-9.1-03 | Lighting and Correction Used | Dropdown and Yes/No | Record actual test conditions. | `lighting / correction_used`; CORE CONTRACT AVAILABLE |
| F-9.1-04 | Unaided and Presenting Vision | Configured Visual Acuity Dropdown | Separate value for each eye. | `distance.{OD,OS}.unaided_or_presenting`; CORE CONTRACT AVAILABLE |
| F-9.1-05 | Vision with Current Glasses | Configured Visual Acuity Dropdown | Available when spectacles are used. | `distance.{OD,OS}.current_glasses`; CORE CONTRACT AVAILABLE |
| F-9.1-06 | Pinhole Vision | Configured Visual Acuity Dropdown | Record when performed. | `distance.{OD,OS}.pinhole`; CORE CONTRACT AVAILABLE |
| F-9.1-07 | Best Corrected Vision | Configured Visual Acuity Dropdown | Separate from presenting vision. | `distance.{OD,OS}.bcva`; CORE CONTRACT AVAILABLE |
| F-9.1-08 | Counting Fingers | Distance Entry | Used when chart acuity cannot be recorded. | `low_vision.{OD,OS}.counting_fingers_distance`; CORE CONTRACT AVAILABLE |
| F-9.1-09 | Hand Movement | Present / Absent | Eye-specific. | `low_vision.{OD,OS}.hand_movement`; CORE CONTRACT AVAILABLE |
| F-9.1-10 | Perception of Light | Present / Absent | Eye-specific. | `low_vision.{OD,OS}.perception_of_light`; CORE CONTRACT AVAILABLE |
| F-9.1-11 | Projection of Rays | Directional Selection | Accurate or inaccurate by direction. | `low_vision.{OD,OS}.projection_of_rays`; CORE CONTRACT AVAILABLE |
| F-9.1-12 | Near Vision | Unaided / Existing Correction / Best Correction | Record chart and testing distance. | `near.{OD,OS}.{unaided,existing_correction,best_correction,chart,distance}`; CORE CONTRACT AVAILABLE |
| F-9.1-13 | Cooperation and Reliability | Good / Fair / Poor | Poor reliability requires a reason. | `@reliability / reliability_reason; separate cooperation path not contracted`; PARTIAL CONTRACT |
| F-9.1-14 | Result Conclusion | Multi-select | Reduced vision, pinhole response, refraction required, urgent review or unable to complete. | `conclusion_codes`; CORE CONTRACT AVAILABLE |

## 9.2 Lensometry

**Frontend:** B2b. **Backend:** A5. **Form type:** `LENSOMETRY`. **UI baseline:** missing specialty form.

| ID | FSD field | FSD type or findings | FSD rule | API destination and integration state |
|---|---|---|---|---|
| F-9.2-01 | OD and OS Power | SPH / CYL / AXIS / Addition | Signed decimal values; axis 0 to 180. | `optical_power.{OD,OS}.{sphere,cylinder,axis,addition}`; CORE CONTRACT AVAILABLE |
| F-9.2-02 | Prism | Value plus Base | Optional structured entry. | `optical_power.{OD,OS}.{prism,prism_base}`; CORE CONTRACT AVAILABLE |
| F-9.2-03 | Lens Type, Material and Coating | Dropdowns | Use configured optical masters. | `lens_type / material / coating_codes`; CORE CONTRACT AVAILABLE |
| F-9.2-04 | Optical Centre and Monocular PD | Decimal | Eye-specific where applicable. | `optical_centre_pd.{OD,OS} (nested shape needs handoff)`; PARTIAL CONTRACT |
| F-9.2-05 | Segment Height | Decimal | Required only for applicable lens types. | `segment_height.{OD,OS} (nested shape needs handoff)`; PARTIAL CONTRACT |
| F-9.2-06 | Lens Condition | Dropdown plus Notes | Include scratches or damage. | `lens_condition / condition_notes`; CORE CONTRACT AVAILABLE |
| F-9.2-07 | Spectacle Age and Usage Type | Number plus Unit / Dropdown | Distance, near, full-time or computer. | `spectacle_age / usage_type`; CORE CONTRACT AVAILABLE |
| F-9.2-08 | Comfort and Reason for Change | Yes/No / Multi-select | Captures the patient’s experience. | `comfortable / change_reason_codes`; CORE CONTRACT AVAILABLE |
| F-9.2-09 | Existing Prescription | File Upload | Optional supporting document. | `existing_prescription_document_id`; CORE CONTRACT AVAILABLE |

## 9.3 Autorefraction and keratometry

**Frontend:** B2b. **Backend:** A5. **Form type:** `AUTOREFRACTION_KERATOMETRY`. **UI baseline:** missing specialty form.

| ID | FSD field | FSD type or findings | FSD rule | API destination and integration state |
|---|---|---|---|---|
| F-9.3-01 | Device and Device ID | Dropdown / Auto Display | Only branch-configured devices. | `@device_code / device_snapshot (task/start and result response)`; CORE CONTRACT AVAILABLE |
| F-9.3-02 | Calibration Status | Display | Show latest available equipment status. | `@device_snapshot.calibration_status`; CORE CONTRACT AVAILABLE |
| F-9.3-03 | Cycloplegic Test | Yes/No | If Yes, capture medication administration details. | `cycloplegic / cycloplegic_medication (nested shape needs handoff)`; PARTIAL CONTRACT |
| F-9.3-04 | Multiple OD and OS Readings | SPH / CYL / AXIS | Allow multiple readings and one selected final reading. | `readings.{OD,OS}[] / selected_reading_index.{OD,OS} (index shape needs handoff)`; PARTIAL CONTRACT |
| F-9.3-05 | Spherical Equivalent | Calculated | Calculated from the recorded power values. | `spherical_equivalent.{OD,OS} (value shape needs handoff)`; PARTIAL CONTRACT |
| F-9.3-06 | PD and Pupil Diameter | Decimal | Store the recorded units. | `pd / pupil_diameter.{OD,OS} (nested units/shape need handoff)`; PARTIAL CONTRACT |
| F-9.3-07 | K1 and K2 Power with Axes | Decimal plus Axis | Store OD and OS separately. | `keratometry.{OD,OS}.{k1,k1_axis,k2,k2_axis}`; CORE CONTRACT AVAILABLE |
| F-9.3-08 | Average K and Corneal Astigmatism | Calculated | Derived values must remain traceable to readings. | `keratometry.{OD,OS}.{average_k,corneal_astigmatism}`; CORE CONTRACT AVAILABLE |
| F-9.3-09 | Measurement Quality | Good / Fair / Poor | Poor result may require repeat. | `@reliability / reliability_reason`; CORE CONTRACT AVAILABLE |
| F-9.3-10 | Observation | Multi-select | Myopia, hypermetropia, astigmatism, anisometropia, irregular reading or subjective refraction required. | `observations`; CORE CONTRACT AVAILABLE |

## 9.4 Objective refraction

**Frontend:** B2b. **Backend:** A5. **Form type:** `OBJECTIVE_REFRACTION`. **UI baseline:** missing specialty form.

| ID | FSD field | FSD type or findings | FSD rule | API destination and integration state |
|---|---|---|---|---|
| F-9.4-01 | Refraction Method | Dry / Wet / Cycloplegic | Required. | `method`; CORE CONTRACT AVAILABLE |
| F-9.4-02 | Retinoscopy Type | Static / Dynamic | Required when performed. | `retinoscopy_type`; CORE CONTRACT AVAILABLE |
| F-9.4-03 | Working Distance | Number plus Unit | Used for working-distance adjustment. | `working_distance.value / unit`; CORE CONTRACT AVAILABLE |
| F-9.4-04 | Cycloplegic Drug and Strength | Dropdown / Text | Required for cycloplegic refraction. | `cycloplegic_drug (nested shape needs handoff)`; PARTIAL CONTRACT |
| F-9.4-05 | Administration and Examination Time | Date-Time | Supports safe timing and traceability. | `administration_at / examination_at`; CORE CONTRACT AVAILABLE |
| F-9.4-06 | OD and OS Readings | SPH / CYL / AXIS | Capture raw and final objective values. | `raw_power.{OD,OS} / final_power.{OD,OS}`; CORE CONTRACT AVAILABLE |
| F-9.4-07 | Reflex and Media Observation | Dropdown / Text | Regular, scissoring, dull, irregular or other. | `reflex_media.{OD,OS} (nested shape needs handoff)`; PARTIAL CONTRACT |
| F-9.4-08 | Observation | Multi-select | High refractive error, keratoconus suspicion, media opacity, unreliable result or cycloplegic recommendation. | `observation_codes`; CORE CONTRACT AVAILABLE |

## 9.5 Subjective refraction

**Frontend:** B2b. **Backend:** A5. **Form type:** `SUBJECTIVE_REFRACTION`. **UI baseline:** missing specialty form.

| ID | FSD field | FSD type or findings | FSD rule | API destination and integration state |
|---|---|---|---|---|
| F-9.5-01 | Starting and Final OD/OS Power | SPH / CYL / AXIS | Retain final accepted values and, where required, starting values. | `starting_power.{OD,OS} / final_power.{OD,OS}`; CORE CONTRACT AVAILABLE |
| F-9.5-02 | BCVA | Visual Acuity Dropdown | Eye-specific. | `bcva.{OD,OS} (value shape needs handoff)`; PARTIAL CONTRACT |
| F-9.5-03 | Duochrome Response | Red / Green / Equal | Optional when performed. | `duochrome.{OD,OS} (value shape needs handoff)`; PARTIAL CONTRACT |
| F-9.5-04 | Jackson Cross Cylinder | Structured Entry / Text | Record the performed result. | `jcc.{OD,OS} (nested shape needs handoff)`; PARTIAL CONTRACT |
| F-9.5-05 | Fogging | Yes/No | Optional. | `fogging`; CORE CONTRACT AVAILABLE |
| F-9.5-06 | Patient Acceptance | Accepted / Partially Accepted / Not Accepted | Required before finalizing refraction. | `acceptance`; CORE CONTRACT AVAILABLE |
| F-9.5-07 | Binocular Balance and Acuity | Structured Entry | Capture balanced status and binocular acuity. | `binocular_balance (nested shape needs handoff)`; PARTIAL CONTRACT |
| F-9.5-08 | Dominant Eye and Diplopia | Dropdown / Yes-No | Record when assessed. | `dominant_eye / diplopia`; CORE CONTRACT AVAILABLE |
| F-9.5-09 | Near Addition | OD / OS Decimal | Capture working distance and achieved near acuity. | `near_addition.{OD,OS} / working_distance / near_acuity.{OD,OS} (value shape needs handoff)`; PARTIAL CONTRACT |
| F-9.5-10 | Usage Requirement | Multi-select | Reading, occupation, computer or other. | `usage_requirement_codes`; CORE CONTRACT AVAILABLE |
| F-9.5-11 | Optometrist Impression | Dropdown | Emmetropia, myopia, hypermetropia, astigmatism categories, presbyopia, anisometropia or suspected irregularity. | `impression`; CORE CONTRACT AVAILABLE |

## 9.6 Intraocular pressure

**Frontend:** B2b. **Backend:** A5. **Form type:** `INTRAOCULAR_PRESSURE`. **UI baseline:** missing specialty form.

| ID | FSD field | FSD type or findings | FSD rule | API destination and integration state |
|---|---|---|---|---|
| F-9.6-01 | IOP OD and OS | Decimal mmHg | Separate readings for each eye. | `readings.{OD,OS}[] / final_iop.{OD,OS} / unit`; CORE CONTRACT AVAILABLE |
| F-9.6-02 | Method | Dropdown | Goldmann, non-contact, rebound, Tono-Pen, Schiotz, digital estimation or configured method. | `method`; CORE CONTRACT AVAILABLE |
| F-9.6-03 | Measurement Time and Position | Date-Time / Sitting / Supine | Required. | `measured_at / position`; CORE CONTRACT AVAILABLE |
| F-9.6-04 | Anaesthetic and Fluorescein | Yes/No plus Drug | Capture when used. | `anesthetic_used / fluorescein_used / drug`; CORE CONTRACT AVAILABLE |
| F-9.6-05 | Repeat Readings | Repeatable OD/OS Values | Allow selection of final reading; retain all readings. | `readings.{OD,OS}[] / selected_reading_index.{OD,OS} (index shape needs handoff)`; PARTIAL CONTRACT |
| F-9.6-06 | Reliability | Good / Fair / Poor | Poor reliability requires comment. | `@reliability / reliability_reason`; CORE CONTRACT AVAILABLE |
| F-9.6-07 | Alert Interpretation | Configured Status | Within range, borderline, elevated, low, asymmetry, repeat required or immediate review. | `alert_interpretation (server-derived)`; CORE CONTRACT AVAILABLE |

## 9.7 Pachymetry

**Frontend:** B2c. **Backend:** A6. **Form type:** `PACHYMETRY`. **UI baseline:** missing specialty form.

| ID | FSD field | FSD type or findings | FSD rule | API destination and integration state |
|---|---|---|---|---|
| F-9.7-01 | Method | Ultrasound / Optical | Required. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.7-02 | Central Corneal Thickness OD and OS | Numeric in micrometres | Eye-specific. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.7-03 | Repeat Readings and Average | Repeatable Numeric / Calculated | Retain source readings. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.7-04 | Quality | Good / Fair / Poor | Poor quality may trigger repeat. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.7-05 | Technician Impression | Dropdown | Normal, thin, thick, asymmetry, unreliable or repeat recommended. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.7-06 | Report and Remarks | File Upload / Text | Linked to the encounter. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |

## 9.8 Colour vision

**Frontend:** B2c. **Backend:** A6. **Form type:** `COLOUR_VISION`. **UI baseline:** missing specialty form.

| ID | FSD field | FSD type or findings | FSD rule | API destination and integration state |
|---|---|---|---|---|
| F-9.8-01 | Method | Ishihara / HRR / Farnsworth / Other | Configured by hospital. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.8-02 | Testing Eye | OD / OS / OU | Required. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.8-03 | Plates Shown, Correct and Incorrect | Numbers | Score is calculated where applicable. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.8-04 | Result | Normal / Abnormal / Inconclusive | Store by tested eye. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.8-05 | Defect Type and Severity | Dropdowns | Red-green, blue-yellow or unclassified; mild, moderate or severe. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.8-06 | Reliability and Remarks | Good / Fair / Poor and Text | Poor reliability requires explanation. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |

## 9.9 Motility squint and binocular vision

**Frontend:** B2c. **Backend:** A6. **Form type:** `MOTILITY_SQUINT_BINOCULAR`. **UI baseline:** missing specialty form.

| ID | FSD field | FSD type or findings | FSD rule | API destination and integration state |
|---|---|---|---|---|
| F-9.9-01 | Assessment Method | Multi-select | Hirschberg, Krimsky, cover, cover-uncover, alternate cover or prism measurement. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.9-02 | Fixing Eye | OD / OS / Alternating | Required where applicable. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.9-03 | Deviation Type and Nature | Dropdowns | Esotropia, exotropia, hypertropia, hypotropia; manifest, latent or intermittent. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.9-04 | Distance and Near Measurement | Numeric Prism Dioptre | Record with or without correction. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.9-05 | Ocular Movements | Directional Structured Entry | Capture limitation and overaction/underaction grades. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.9-06 | Nystagmus and Diplopia | Yes/No | Details required when positive. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.9-07 | Abnormal Head Posture | Yes/No plus Description | Structured positive finding. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.9-08 | Stereopsis and Worth Four Dot | Numeric / Dropdown | Record the method and result. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.9-09 | Impression | Multi-select | Orthophoria, phoria/tropia, vertical deviation, restriction, paralytic squint, amblyopia suspicion or orthoptic review. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |

## 9.10 Slit lamp and anterior segment

**Frontend:** B2b. **Backend:** A5. **Form type:** `SLIT_LAMP_ANTERIOR_SEGMENT`. **UI baseline:** missing specialty form.

Each eye/structure has contracted `status`, `finding`, `location`, `grade`, `diagram_document_id`, `image_document_ids`, `remarks`. FSD structure-specific subfields such as pupil reactions/RAPD need a precise representation if these generic fields are insufficient; do not invent nested structure keys.

| ID | FSD field | FSD type or findings | FSD rule | API destination and integration state |
|---|---|---|---|---|
| F-9.10-01 | Lids and Lashes | Position, swelling, lesion, ptosis, crusting, misdirection or loss. | Per-eye normal/abnormal, finding/location/grade and permitted media/remarks; FSD 9.10. | `eyes.{OD,OS}.lids_lashes`; CORE CONTRACT AVAILABLE |
| F-9.10-02 | Lacrimal System | Normal, swelling, regurgitation or other. | Per-eye normal/abnormal, finding/location/grade and permitted media/remarks; FSD 9.10. | `eyes.{OD,OS}.lacrimal`; CORE CONTRACT AVAILABLE |
| F-9.10-03 | Conjunctiva | Quiet, congestion, chemosis, follicles, papillae or other. | Per-eye normal/abnormal, finding/location/grade and permitted media/remarks; FSD 9.10. | `eyes.{OD,OS}.conjunctiva`; CORE CONTRACT AVAILABLE |
| F-9.10-04 | Sclera | Normal, inflammation, thinning, pigmentation or other. | Per-eye normal/abnormal, finding/location/grade and permitted media/remarks; FSD 9.10. | `eyes.{OD,OS}.sclera`; CORE CONTRACT AVAILABLE |
| F-9.10-05 | Cornea | Clear, opacity, scar, ulcer, abrasion, oedema or other. | Per-eye normal/abnormal, finding/location/grade and permitted media/remarks; FSD 9.10. | `eyes.{OD,OS}.cornea`; CORE CONTRACT AVAILABLE |
| F-9.10-06 | Anterior Chamber | Depth, cells, flare, hypopyon, hyphaema or other. | Per-eye normal/abnormal, finding/location/grade and permitted media/remarks; FSD 9.10. | `eyes.{OD,OS}.anterior_chamber`; CORE CONTRACT AVAILABLE |
| F-9.10-07 | Iris | Normal, atrophy, defect, neovascularization or other. | Per-eye normal/abnormal, finding/location/grade and permitted media/remarks; FSD 9.10. | `eyes.{OD,OS}.iris`; CORE CONTRACT AVAILABLE |
| F-9.10-08 | Pupil | Size, shape, direct/consensual reaction, accommodation and RAPD. | Per-eye normal/abnormal, finding/location/grade and permitted media/remarks; FSD 9.10. | `eyes.{OD,OS}.pupil`; CORE CONTRACT AVAILABLE |
| F-9.10-09 | Lens | Clear, cataract type, pseudophakia, aphakia or other. | Per-eye normal/abnormal, finding/location/grade and permitted media/remarks; FSD 9.10. | `eyes.{OD,OS}.lens`; CORE CONTRACT AVAILABLE |
| F-9.10-10 | Anterior Vitreous | Clear, cells, pigment or other. | Per-eye normal/abnormal, finding/location/grade and permitted media/remarks; FSD 9.10. | `eyes.{OD,OS}.anterior_vitreous`; CORE CONTRACT AVAILABLE |
| F-9.10-11 | Tear Film | Normal, reduced, unstable, debris or other. | Per-eye normal/abnormal, finding/location/grade and permitted media/remarks; FSD 9.10. | `eyes.{OD,OS}.tear_film`; CORE CONTRACT AVAILABLE |

## 9.11 Dry eye

**Frontend:** B2c. **Backend:** A6. **Form type:** `DRY_EYE`. **UI baseline:** missing specialty form.

| ID | FSD field | FSD type or findings | FSD rule | API destination and integration state |
|---|---|---|---|---|
| F-9.11-01 | Symptoms | Multi-select and Questionnaire Score | Dryness, burning, grittiness, watering, fluctuating vision, screen-related symptoms and contact-lens intolerance. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.11-02 | Schirmer Test | OD/OS mm plus Duration | Store method and duration. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.11-03 | TBUT | OD/OS Seconds | Eye-specific. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.11-04 | Fluorescein and Lissamine Staining | Grade plus Location | Eye-specific. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.11-05 | Tear Meniscus Height | OD/OS Numeric | Store unit. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.11-06 | Meibomian Glands and Meibum | Dropdowns | Normal, blocked or atrophy; clear, cloudy, thick or absent. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.11-07 | Blink, Lid Margin and Corneal Sensation | Structured Findings | Complete/incomplete; normal/abnormal; normal/reduced/absent. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.11-08 | Test Impression | Multi-select | No findings, aqueous-deficient, evaporative, mixed, MGD suspected, ocular-surface disease suspected or doctor review. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |

## 9.12 Visual field

**Frontend:** B2c. **Backend:** A6. **Form type:** `VISUAL_FIELD`. **UI baseline:** missing specialty form.

| ID | FSD field | FSD type or findings | FSD rule | API destination and integration state |
|---|---|---|---|---|
| F-9.12-01 | Machine, Program and Strategy | Dropdowns | Branch-configured equipment and protocols. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.12-02 | Eye and Correction Used | OD / OS plus Structured Entry | Required. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.12-03 | Pupil Diameter and Fixation Target | Decimal / Dropdown | Record actual setup. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.12-04 | Reliability | Fixation Losses / False Positives / False Negatives | Include test duration, cooperation and gaze tracking. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.12-05 | Result Indices | Numeric | Mean deviation, pattern standard deviation and visual field index. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.12-06 | Clinical Pattern | Dropdown / Text | Hemifield result, defect location and defect pattern. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.12-07 | Progression | Stable / Improved / Worsened / Not Compared | Compare only with an eligible prior test. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.12-08 | Report and Impression | File Upload / Dropdown | Reliable, borderline, unreliable, normal, abnormal, repeat or urgent review. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |

## 9.13 Optical coherence tomography

**Frontend:** B2c. **Backend:** A6. **Form type:** `OCT`. **UI baseline:** missing specialty form.

| ID | FSD field | FSD type or findings | FSD rule | API destination and integration state |
|---|---|---|---|---|
| F-9.13-01 | OCT Type | Dropdown | Macula, optic nerve/RNFL, ganglion cell, anterior segment, corneal or angiography. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.13-02 | Eye and Requested Scans | OD / OS / OU and Multi-select | Must match the order. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.13-03 | Scan Quality and Signal Strength | Numeric / Dropdown | Required to judge reliability. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.13-04 | Measurements | Numeric | Central macular thickness, average RNFL and cup-to-disc measurement where applicable. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.13-05 | Segmentation Error and Artefact | Yes/No | Positive value requires comment. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.13-06 | Previous Comparison | Stable / Improved / Worsened / Not Compared | Do not imply progression without a valid comparison. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.13-07 | Report and Images | File / Multiple Image Upload | Stored against order and encounter. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.13-08 | Technician Observation | Multi-select | Successful, poor quality, motion artefact, segmentation error, abnormality detected, repeat or doctor review. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |

## 9.14 Fundus photography

**Frontend:** B2c. **Backend:** A6. **Form type:** `FUNDUS_PHOTOGRAPHY`. **UI baseline:** missing specialty form.

| ID | FSD field | FSD type or findings | FSD rule | API destination and integration state |
|---|---|---|---|---|
| F-9.14-01 | Eye | OD / OS | Required per image set. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.14-02 | Image Type | Colour / Red-free / Autofluorescence | Configured options. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.14-03 | Field | Macula / Disc / Posterior Pole / Peripheral | Multiple fields allowed. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.14-04 | Dilatation | Dilated / Undilated | Record examination state. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.14-05 | Image Quality and Count | Good / Fair / Poor and Auto Count | Poor quality may require repeat. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.14-06 | Visible Abnormality | Multi-select | Disc, haemorrhage, exudate, drusen, pigment, macular, vascular, scar, detachment suspicion, opacity or not gradable. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.14-07 | Images, Notes and Repeat | Image Upload / Text / Yes-No | Link every image to correct eye. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |

## 9.15 Posterior segment and fundus

**Frontend:** B2b. **Backend:** A5. **Form type:** `POSTERIOR_FUNDUS_EXAM`. **UI baseline:** missing specialty form.

| ID | FSD field | FSD type or findings | FSD rule | API destination and integration state |
|---|---|---|---|---|
| F-9.15-01 | Dilatation Required | Yes/No | If Yes, capture consent/confirmation, contraindication check and drug administration. | `dilation_required / dilation_confirmation / contraindication`; CORE CONTRACT AVAILABLE |
| F-9.15-02 | Dilatation Drug, Dose and Eye | Dropdown / Text / OD-OS-OU | Record instillation and ready times. | `dilation_medications[].{drug,dose,laterality,instilled_at,ready_at}`; CORE CONTRACT AVAILABLE |
| F-9.15-03 | Examination Method | Dropdown | Direct, indirect, slit-lamp biomicroscopy, fundus photography or other. | `method`; CORE CONTRACT AVAILABLE |
| F-9.15-04 | Media and Vitreous | Structured OD/OS Findings | Clear, opacity, cells, haemorrhage or other. | `eyes.{OD,OS}.{media,vitreous,media_vitreous} (nested shape needs handoff)`; PARTIAL CONTRACT |
| F-9.15-05 | Optic Disc | Structured OD/OS Findings | Colour, margin, cup-to-disc ratio and neuroretinal rim. | `eyes.{OD,OS}.optic_disc (nested shape needs handoff)`; PARTIAL CONTRACT |
| F-9.15-06 | Macula and Fovea | Structured OD/OS Findings | Include reflex, oedema, drusen or lesion. | `eyes.{OD,OS}.{macula,fovea,macula_fovea} (nested shape needs handoff)`; PARTIAL CONTRACT |
| F-9.15-07 | Vessels and Retina | Structured OD/OS Findings | Include haemorrhage, exudate, vascular and peripheral findings. | `eyes.{OD,OS}.{vessels,retina,vessels_retina} (nested shape needs handoff)`; PARTIAL CONTRACT |
| F-9.15-08 | Diagram, Images and Remarks | Annotation / Upload / Text | Eye-specific and encounter-linked. | `eyes.{OD,OS}.{diagram_document_id,image_document_ids,remarks}`; CORE CONTRACT AVAILABLE |

## 9.16 Corneal topography

**Frontend:** B2c. **Backend:** A6. **Form type:** `CORNEAL_TOPOGRAPHY`. **UI baseline:** missing specialty form.

| ID | FSD field | FSD type or findings | FSD rule | API destination and integration state |
|---|---|---|---|---|
| F-9.16-01 | K1, K2 and Axes | Numeric | OD and OS. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.16-02 | Kmax and Average K | Numeric / Calculated | Retain source map. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.16-03 | Corneal Astigmatism and Thickness | Numeric | Store units. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.16-04 | Anterior and Posterior Elevation | Numeric / Map | Eye-specific. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.16-05 | Asphericity, Pupil and White-to-White | Numeric | Structured values. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.16-06 | Scan Quality and Attachments | Dropdown / Multiple Files | Poor quality may require repeat. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.16-07 | Impression | Multi-select | Regular/irregular astigmatism, keratoconus pattern, post-surgical pattern, contact-lens warpage, poor quality or repeat. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |

## 9.17 Biometry and IOL

**Frontend:** B2c. **Backend:** A6. **Form type:** `BIOMETRY_IOL`. **UI baseline:** missing specialty form.

| ID | FSD field | FSD type or findings | FSD rule | API destination and integration state |
|---|---|---|---|---|
| F-9.17-01 | Axial Length | OD/OS Decimal | Required for calculation. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.17-02 | K1 and K2 with Axes | OD/OS Numeric | Structured values. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.17-03 | Anterior Chamber Depth and Lens Thickness | OD/OS Decimal | Store units. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.17-04 | White-to-White and Corneal Thickness | OD/OS Decimal | Store units. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.17-05 | Target Refraction | Signed Decimal | Doctor-confirmed target. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.17-06 | Formula, IOL Model and IOL Power | Dropdown / Decimal | Use configured lens catalogue. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.17-07 | Predicted Refraction | Signed Decimal | Calculated result. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.17-08 | Measurement Quality | Good / Fair / Poor | Poor result requires review. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.17-09 | Special Factors | Multi-select | Prior refractive surgery, contact lens use, discontinuation date or dense cataract. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.17-10 | Selected and Backup IOL | Dropdowns | Final selection requires doctor approval. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.17-11 | Report and Remarks | File Upload / Text | Retain alternative calculations. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |

## 9.18 B scan

**Frontend:** B2c. **Backend:** A6. **Form type:** `B_SCAN`. **UI baseline:** missing specialty form.

| ID | FSD field | FSD type or findings | FSD rule | API destination and integration state |
|---|---|---|---|---|
| F-9.18-01 | Eye and Indication | OD / OS / OU and Dropdown/Text | Must match order. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.18-02 | Probe Orientation and Gain | Dropdown / Numeric | Record acquisition setup. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.18-03 | Axial Length | Decimal | Optional when measured. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.18-04 | Vitreous, Retina and Choroid | Structured Findings | Eye-specific. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.18-05 | Mass or Lesion | Yes/No plus Dimensions | Capture mobility where applicable. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.18-06 | Images or Videos and Report | Multiple Uploads | Encounter-linked. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.18-07 | Technician Observation | Text | Not the final diagnosis. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.18-08 | Doctor Review Status | Pending / Reviewed | Reviewer and time recorded. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |

## 9.19 Gonioscopy

**Frontend:** B2c. **Backend:** A6. **Form type:** `GONIOSCOPY`. **UI baseline:** missing specialty form.

| ID | FSD field | FSD type or findings | FSD rule | API destination and integration state |
|---|---|---|---|---|
| F-9.19-01 | Angle Grade | Configured Grading Dropdown | Required for each examined quadrant. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.19-02 | Pigmentation | Configured Grade | Quadrant-specific. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.19-03 | Peripheral Anterior Synechiae | Yes/No | Positive finding may include extent. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.19-04 | Neovascularization | Yes/No | Positive finding requires location/notes. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.19-05 | Other Finding | Text | Optional supporting note. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |
| F-9.19-06 | Overall Examination | Lens, static/dynamic, classification, cooperation, diagram and impression | Store OD and OS independently. | BLOCKED: exact payload/type/units/validation not published; Developer A A6 |

## 9.20 Contact lens

**Frontend:** B2d. **Backend:** A7. **Form type:** `CONTACT_LENS`. **UI baseline:** missing specialty form.

| ID | FSD field | FSD type or findings | FSD rule | API destination and integration state |
|---|---|---|---|---|
| F-9.20-01 | Lens Details | Type, Brand, Material, Base Curve and Diameter | Trial and final lens records must be distinguishable. | BLOCKED: exact payload/type/units/validation not published; Developer A A7 |
| F-9.20-02 | Power | SPH / CYL / AXIS / Addition | OD and OS. | BLOCKED: exact payload/type/units/validation not published; Developer A A7 |
| F-9.20-03 | Trial Lens and Schedule | Number / Wearing / Replacement | Structured selections. | BLOCKED: exact payload/type/units/validation not published; Developer A A7 |
| F-9.20-04 | Fit Assessment | Centration, Coverage, Movement, Push-up and Rotation | Eye-specific. | BLOCKED: exact payload/type/units/validation not published; Developer A A7 |
| F-9.20-05 | Over-refraction and Visual Acuity | Structured Values | OD and OS. | BLOCKED: exact payload/type/units/validation not published; Developer A A7 |
| F-9.20-06 | Comfort and Ocular Response | Dropdowns / Findings | Include corneal, conjunctival and tear exchange. | BLOCKED: exact payload/type/units/validation not published; Developer A A7 |
| F-9.20-07 | Outcome | Dropdown | Accepted, different lens, extended trial, contraindicated or doctor review. | BLOCKED: exact payload/type/units/validation not published; Developer A A7 |
| F-9.20-08 | Education and Follow-up | Checkboxes / Date | Training and hygiene instructions must be recorded. | BLOCKED: exact payload/type/units/validation not published; Developer A A7 |

## 9.21 Paediatric vision

**Frontend:** B2d. **Backend:** A7. **Form type:** `PAEDIATRIC_VISION`. **UI baseline:** missing specialty form.

| ID | FSD field | FSD type or findings | FSD rule | API destination and integration state |
|---|---|---|---|---|
| F-9.21-01 | Assessment Method | Multi-select | Fix and follow, CSM fixation, preferential looking, Lea, Kay, Cardiff or Teller. | BLOCKED: exact payload/type/units/validation not published; Developer A A7 |
| F-9.21-02 | Cycloplegic Refraction | Structured OD/OS | Capture medication and timing. | BLOCKED: exact payload/type/units/validation not published; Developer A A7 |
| F-9.21-03 | Alignment and Red Reflex | Structured Findings | Eye-specific. | BLOCKED: exact payload/type/units/validation not published; Developer A A7 |
| F-9.21-04 | Amblyopia and Binocular Vision | Structured Assessment | Include stereopsis and colour vision where possible. | BLOCKED: exact payload/type/units/validation not published; Developer A A7 |
| F-9.21-05 | Cooperation | Good / Fair / Poor / Unable | Age and cooperation must contextualize results. | BLOCKED: exact payload/type/units/validation not published; Developer A A7 |
| F-9.21-06 | Parent-Reported Symptoms | Multi-select / Text | Record separately from observed findings. | BLOCKED: exact payload/type/units/validation not published; Developer A A7 |
| F-9.21-07 | Birth and Developmental History | Structured / Text | Relevant paediatric background. | BLOCKED: exact payload/type/units/validation not published; Developer A A7 |
| F-9.21-08 | Result | Multi-select | Age-appropriate, reduced vision, amblyopia/squint/refractive error suspected, developmental review or repeat. | BLOCKED: exact payload/type/units/validation not published; Developer A A7 |

## Cross-form requirements and unresolved details

- Visual acuity source uses one `unaided_or_presenting` field although the FSD names unaided and presenting vision. Obtain an explicit policy/schema decision if both must be saved independently; do not encode two results into one field.
- Several numeric/refraction/PD/calculation containers are intentionally broad in v1.4.0 source types. The next implementation slice must resolve their accepted shapes against Developer A, configuration and representative responses. Scalar versus object must never be guessed.
- Posterior structures are broad maps and dilation uses a confirmation field. Confirm a patient-consent reference if an approved workflow requires one; a local checkbox cannot prove consent.
- A5 result schema has reliability but no separately contracted cooperation field. Do not claim full FSD cooperation capture unless an approved mapping/configuration defines it.
- New clinical values, advanced calculations, comparison eligibility and report/image policies remain external inputs. All 13 A6/A7 forms are retained here as explicit requirements with individual source rows.

**Coverage count:** 21 form families; 178 source field rows. No row is silently marked N/A. This is complete source-field inventory; unresolved mappings remain explicitly blocked and do not mean the frontend is production-ready.
