# HMS Emergency, Admissions & Surgery — Current Implementation

## 1. Purpose

This document provides a comprehensive, ground-truth analysis of how the **Emergency**, **Admissions**, and **Surgery** modules are currently implemented in the HMS repository across frontend pages, components, hooks, routes, API endpoints, backend services, schemas, and database-backed RBAC assignments.

No code modifications, architectural redesigns, or hypothetical workflows are introduced in this analysis; it reflects the exact state of the repository as implemented.

---

## 2. Emergency

### 2.1 Navigation
In `apps/web/src/data/ui-foundation.ts`, the `emergency` navigation group is configured as follows:

```text
Emergency (icon: ph-warning-circle)
├── Dashboard           → /emergency
├── Emergency Queue     → /emergency/queue
└── Emergency Workspace → /emergency/workspace
```

Route permissions defined in `apps/web/src/auth/access-control.ts`:
- `/emergency` → requires `{ module: 'Emergency', screen: 'Encounters' }` (Action: `View`)
- `/emergency/queue` → requires `{ module: 'Emergency', screen: 'Encounters' }` (Action: `View`)
- `/emergency/workspace` → requires `{ module: 'Emergency', screen: 'Encounters' }` (Action: `View`)

---

### 2.2 Pages

#### 1. Emergency Dashboard (`/emergency` — `EmergencyDashboardPage.tsx`)
- **Purpose**: High-level statistical overview and rapid entry point for Emergency department operations.
- **Main UI Sections**:
  - Stat KPI cards: Total Active, Critical / Resuscitation cases, In Treatment, Ready for Disposition / Admission.
  - Priority Breakdown (Level 1 Critical down to Level 5 Non-Urgent).
  - Quick action to register a new emergency patient.
  - Recent Emergency Registrations / Encounters table.
- **Statuses Displayed**: `REGISTERED`, `WAITING_FOR_TRIAGE`, `TRIAGED`, `WAITING_FOR_DOCTOR`, `IN_CONSULTATION`, `IN_TREATMENT`, `READY_FOR_DISPOSITION`, `DISCHARGED`, `TRANSFERRED`, `CONVERTED_TO_IP`, `LEFT`, `NO_SHOW`, `CANCELLED`.
- **Permissions Required**: `Emergency -> Encounters -> View` (page); `Emergency -> Encounters -> Register` (Quick Registration modal).
- **APIs Used**: `GET /api/emergency`, `GET /api/emergency/summary`, `POST /api/emergency`.

#### 2. Emergency Queue (`/emergency/queue` — `EmergencyQueuePage.tsx`)
- **Purpose**: Operational queue management for incoming and active emergency patients.
- **Main UI Sections**:
  - Metric counters: Waiting, Critical, In Consultation, In Treatment, Ready for Admission.
  - Active Serving Patient banner (Call Next / Open Workspace).
  - Filter bar (Doctor assignment, Search, Triage level filter).
  - Queue Table: Arrival time, wait duration, patient identity, triage level badge, status badge, assigned doctor, actions.
- **Main Actions**:
  - *Start Consultation / Call Patient* → Assigns current user / selected doctor and shifts status to `IN_CONSULTATION`.
  - *Open Workspace* → Navigates to `/emergency/workspace?id=<encounter_id>`.
  - *Direct Actions Menu* → Cancel encounter, Mark No-Show.
- **Permissions Required**: `Emergency -> Encounters -> View`. Actions inside gated by `Emergency -> Consultation -> Edit` / `Emergency -> Encounters -> Edit` / `Emergency -> Disposition -> Cancel | MarkNoShow`.
- **APIs Used**: `GET /api/emergency`, `POST /api/emergency/:id/consultation`, `POST /api/emergency/:id/disposition/cancel`, `POST /api/emergency/:id/disposition/no-show`.

#### 3. Emergency Workspace (`/emergency/workspace` — `EmergencyWorkspacePage.tsx`)
- **Purpose**: Comprehensive clinical workspace for single emergency encounter handling.
- **Main UI Sections**:
  - Header: Patient demographics, temporary identity badge, triage level badge, status dropdown, quick action modals (Link Patient, Override Priority, Assign Doctor).
  - Vitals Banner & Bedside Monitor widget (`EmergencyVitalsWidget`).
  - 11 Tabbed Panels:
    1. `Registration`: Arrival details, identity linking, mode of transport, provisional demographics.
    2. `Triage`: ABCDE primary survey, pain score, vital signs capture, triage level calculation (Level 1–5), resuscitation area assignment.
    3. `Consultation`: Subjective history, physical examination, preliminary diagnosis, treatment plan, doctor notes, ready-for-disposition toggle.
    4. `Treatment`: Nursing procedures, oxygenation, fluids, ongoing interventions.
    5. `Medication`: STAT / Emergency medication orders linked with OPD/Pharmacy data structures.
    6. `Lab Orders`: Urgent / Stat laboratory orders.
    7. `Imaging Orders`: Urgent / Stat X-Ray, CT, Ultrasound orders.
    8. `Referral`: In-hospital specialist referrals (Cardiology, Surgery, Orthopedics, etc.).
    9. `Notes`: Clinical progress notes & shift handover logs.
    10. `Documents`: Upload/view trauma sheets, external records, consent forms.
    11. `Disposition`: Final disposition execution (`DISCHARGE`, `ADMIT` [Convert to IP], `TRANSFER`, `LEFT`).
- **Permissions Required**: `Emergency -> Encounters -> View`. Tab and modal permissions:
  - `Emergency -> Triage -> View | Assess | OverridePriority`
  - `Emergency -> Consultation -> View | Edit`
  - `Emergency -> Orders -> View | Create`
  - `Emergency -> Disposition -> View | Discharge | Transfer | ConvertToIP | MarkLeft`
  - `Emergency -> Patient Linking -> Link | Correct`
- **APIs Used**: `GET /api/emergency/:id`, `POST /api/emergency/:id/triage`, `POST /api/emergency/:id/priority-override`, `POST /api/emergency/:id/consultation`, `POST /api/emergency/:id/orders`, `POST /api/emergency/:id/referral`, `POST /api/emergency/:id/disposition`, `POST /api/emergency/:id/link-patient`.

---

### 2.3 End-to-End Workflow

```text
Patient Arrival
  │
  ├─► 1. Emergency Registration (POST /api/emergency)
  │      • Registered or Provisional Identity (Unknown Patient / Trauma)
  │      • Mode of arrival (Ambulance, Walk-in, Wheelchair), Chief complaint
  │      • Initial Status: REGISTERED / WAITING_FOR_TRIAGE
  │
  ├─► 2. Triage Assessment (POST /api/emergency/:id/triage)
  │      • ABCDE Assessment (Airway, Breathing, Circulation, Disability, Exposure)
  │      • Vitals & Pain score
  │      • Triage Category: Level 1 (Resuscitation) to Level 5 (Non-urgent)
  │      • Status becomes: TRIAGED / WAITING_FOR_DOCTOR
  │
  ├─► 3. Doctor Evaluation & Consultation (POST /api/emergency/:id/consultation)
  │      • Assigned doctor starts evaluation
  │      • Status becomes: IN_CONSULTATION
  │      • Clinical examination, diagnosis, and treatment plan recorded
  │
  ├─► 4. Emergency Orders & Interventions (POST /api/emergency/:id/orders)
  │      • Status transitions to: IN_TREATMENT
  │      • STAT Medications, Urgent Lab Tests, Imaging Orders
  │      • Internal Specialist Referrals
  │
  ├─► 5. Disposition Ready (Consultation flag ready_for_disposition = true)
  │      • Status becomes: READY_FOR_DISPOSITION
  │
  └─► 6. Final Disposition (POST /api/emergency/:id/disposition)
         • DISCHARGE       ──► Status: DISCHARGED
         • ADMIT (IP)      ──► Status: CONVERTED_TO_IP (automatically initiates Admission Request)
         • TRANSFER        ──► Status: TRANSFERRED (External facility transfer)
         • LEFT (LAMA)     ──► Status: LEFT (Left against medical advice)
         • Non-clinical terminal: NO_SHOW, CANCELLED
```

---

### 2.4 Actions

| Action | Where It Appears | Current Permission Required | What It Does | Resulting Status |
|---|---|---|---|---|
| **Register Emergency Patient** | Dashboard & Queue Modals | `Emergency -> Encounters -> Register` | Creates new emergency encounter with known patient ID or provisional identity | `REGISTERED` / `WAITING_FOR_TRIAGE` |
| **Assess Triage** | Workspace (Triage Tab) | `Emergency -> Triage -> Assess` | Records ABCDE assessment, vitals, assigns Level 1–5 & treatment area | `TRIAGED` / `WAITING_FOR_DOCTOR` |
| **Override Priority** | Workspace Header Modal | `Emergency -> Triage -> OverridePriority` | Overrides computed triage level with clinical rationale | Preserves triage state, updates `effective_level` |
| **Start / Save Consultation** | Queue / Workspace (Consultation Tab) | `Emergency -> Consultation -> Edit` | Records doctor findings, preliminary diagnosis, treatment plan | `IN_CONSULTATION` / `READY_FOR_DISPOSITION` |
| **Submit Emergency Order** | Workspace (Medication / Lab / Imaging Tabs) | `Emergency -> Orders -> Create` | Dispatches STAT orders for pharmacy/lab/imaging | `IN_TREATMENT` |
| **Submit Emergency Referral** | Workspace (Referral Tab) | `Emergency -> Consultation -> Edit` | Dispatches specialist consultation request | Retains current status |
| **Link Provisional Patient** | Workspace Header Modal | `Emergency -> Patient Linking -> Link` | Merges temporary emergency identity into registered patient master | Retains current status |
| **Discharge Patient** | Workspace (Disposition Tab) | `Emergency -> Disposition -> Discharge` | Completes emergency care, records summary, frees emergency bay | `DISCHARGED` |
| **Convert to Inpatient (Admit)** | Workspace (Disposition Tab) | `Emergency -> Disposition -> ConvertToIP` | Dispositions patient to Inpatient; generates linked Admission Request | `CONVERTED_TO_IP` |
| **Transfer Out** | Workspace (Disposition Tab) | `Emergency -> Disposition -> Transfer` | Documents external hospital transfer with receiving facility details | `TRANSFERRED` |
| **Mark LAMA / Left** | Workspace (Disposition Tab) | `Emergency -> Disposition -> MarkLeft` | Records patient leaving against medical advice | `LEFT` |
| **Mark No-Show** | Queue Action Menu | `Emergency -> Disposition -> MarkNoShow` | Closes encounter if patient left before evaluation | `NO_SHOW` |
| **Cancel Encounter** | Queue Action Menu | `Emergency -> Disposition -> Cancel` | Cancels mistakenly created encounter | `CANCELLED` |

---

### 2.5 Statuses

- `REGISTERED`: Initial state upon patient arrival and demographic capture.
- `WAITING_FOR_TRIAGE`: Awaiting nurse clinical triage scoring.
- `TRIAGED`: Triage level assigned; patient prioritized.
- `WAITING_FOR_DOCTOR`: Triaged and awaiting physician evaluation.
- `IN_CONSULTATION`: Doctor is actively performing consultation/examination.
- `IN_TREATMENT`: Active emergency treatments, medications, or diagnostic tests are underway.
- `READY_FOR_DISPOSITION`: Clinical treatment concluded; awaiting final disposition decision.
- `DISCHARGED`: Patient treated and sent home.
- `TRANSFERRED`: Patient transferred to another medical facility.
- `CONVERTED_TO_IP`: Converted to Inpatient admission.
- `LEFT`: Patient left against medical advice (LAMA) or eloped.
- `NO_SHOW`: Patient departed prior to examination.
- `CANCELLED`: Encounter voided/cancelled.

---

### 2.6 Permissions Catalog (Emergency)

| Permission Code | Meaning in Current Implementation | Used by UI | Used by API | Roles Currently Assigned (in seed.ts) |
|---|---|---|---|---|
| `EMERGENCY_ENCOUNTERS_VIEW` | View emergency dashboard, queue, encounter list | Yes | Yes | `DOCTOR`, `CLINICIAN_NURSE`, `RECEPTIONIST`, `ADMINISTRATOR` |
| `EMERGENCY_ENCOUNTERS_REGISTER` | Register new emergency patient / trauma case | Yes | Yes | `RECEPTIONIST`, `ADMINISTRATOR` |
| `EMERGENCY_ENCOUNTERS_EDIT` | Edit arrival notes or demographic details | Yes | Yes | `ADMINISTRATOR` |
| `EMERGENCY_TRIAGE_VIEW` | View triage assessment and vital signs | Yes | Yes | `DOCTOR`, `CLINICIAN_NURSE`, `RECEPTIONIST`, `ADMINISTRATOR` |
| `EMERGENCY_TRIAGE_ASSESS` | Perform and save primary ABCDE triage scoring | Yes | Yes | `CLINICIAN_NURSE`, `ADMINISTRATOR` |
| `EMERGENCY_TRIAGE_OVERRIDEPRIORITY`| Override algorithmic triage priority level | Yes | Yes | `ADMINISTRATOR` |
| `EMERGENCY_CONSULTATION_VIEW` | View doctor notes, diagnosis, clinical history | Yes | Yes | `DOCTOR`, `CLINICIAN_NURSE`, `ADMINISTRATOR` |
| `EMERGENCY_CONSULTATION_EDIT` | Record doctor examination, assessment, and plan | Yes | Yes | `DOCTOR`, `ADMINISTRATOR` |
| `EMERGENCY_ORDERS_VIEW` | View diagnostic orders and emergency medications | Yes | Yes | `DOCTOR`, `CLINICIAN_NURSE`, `ADMINISTRATOR` |
| `EMERGENCY_ORDERS_CREATE` | Create emergency pharmacy, lab, and imaging orders | Yes | Yes | `DOCTOR`, `ADMINISTRATOR` |
| `EMERGENCY_DISPOSITION_VIEW` | View disposition summary and transfer history | Yes | Yes | `DOCTOR`, `CLINICIAN_NURSE`, `ADMINISTRATOR` |
| `EMERGENCY_DISPOSITION_DISCHARGE` | Discharge emergency patient | Yes | Yes | `DOCTOR`, `ADMINISTRATOR` |
| `EMERGENCY_DISPOSITION_TRANSFER` | Transfer patient to outside hospital | Yes | Yes | `DOCTOR`, `ADMINISTRATOR` |
| `EMERGENCY_DISPOSITION_CONVERTTOIP`| Convert emergency patient to inpatient admission | Yes | Yes | `DOCTOR`, `ADMINISTRATOR` |
| `EMERGENCY_DISPOSITION_MARKLEFT` | Record LAMA / left without treatment | Yes | Yes | `DOCTOR`, `ADMINISTRATOR` |
| `EMERGENCY_DISPOSITION_MARKNOSHOW`| Mark registered emergency patient as no-show | Yes | Yes | `RECEPTIONIST`, `ADMINISTRATOR` |
| `EMERGENCY_DISPOSITION_CANCEL` | Cancel emergency encounter | Yes | Yes | `RECEPTIONIST`, `ADMINISTRATOR` |
| `EMERGENCY_PATIENT_LINKING_LINK` | Link provisional trauma record to patient master | Yes | Yes | `RECEPTIONIST`, `ADMINISTRATOR` |
| `EMERGENCY_PATIENT_LINKING_CORRECT`| Correct linked patient ID | No | Yes | `ADMINISTRATOR` |

---

### 2.7 Current Role Behavior (Emergency)

- **Doctor**:
  - *Sidebar*: Sees Emergency (`Dashboard`, `Emergency Queue`, `Emergency Workspace`).
  - *Queue & Workspace*: Can view all emergency cases, call patients into consultation, record consultation notes, examination, and diagnosis.
  - *Clinical Actions*: Can prescribe emergency medications, order stat lab tests/imaging, create specialist referrals, and execute dispositions (`Discharge`, `Convert to IP`, `Transfer`, `Mark Left`).
  - *Cannot*: Register new emergency cases (lacks `Register`), perform initial nursing triage (lacks `Assess`), override priority, or link provisional identities.
- **Nurse (`CLINICIAN_NURSE`)**:
  - *Sidebar*: Sees Emergency module and workspace.
  - *Queue & Workspace*: Can view queue, view encounters, and record triage assessments (`Assess`).
  - *Clinical Actions*: Can view doctor consultation notes and orders.
  - *Cannot*: Register arrivals (lacks `Register`), record doctor consultations (lacks `Consultation -> Edit`), create emergency diagnostic/medication orders (lacks `Orders -> Create`), or execute clinical dispositions (`Discharge`, `Convert to IP`).
- **Receptionist**:
  - *Sidebar*: Sees Emergency module and queue.
  - *Front-desk Actions*: Registers new emergency patients (with full or provisional identity), views queue status, marks no-shows, cancels mistaken registrations, and links provisional patient records to master patient files.
  - *Cannot*: View or edit clinical consultations, triage assessments, orders, or clinical dispositions.

---

### 2.8 UI / Route / API Authorization Alignment (Emergency)

- **Sidebar vs Route**: Sidebar modules match route requirements (`/emergency`, `/emergency/queue`, `/emergency/workspace` all require `Emergency -> Encounters -> View`).
- **Data Redaction in API**: The backend `GET /api/emergency/:id` actively redacts `triage`, `consultation`, `orders`, and `disposition` if the requesting user lacks respective `View` permissions (`redactEmergencyDetail` in `emergency.routes.ts`).
- **Backend Disposition Enforcement**: `POST /api/emergency/:id/disposition` checks dynamic granular action permissions (`Discharge`, `Transfer`, `ConvertToIP`, `MarkLeft`) via `dispositionPermission` helper before executing the transition.

---

### 2.9 Important Emergency Files

- **Frontend Pages**:
  - `apps/web/src/pages/EmergencyDashboardPage.tsx`: Dashboard overview and stats.
  - `apps/web/src/pages/EmergencyQueuePage.tsx`: Queue list and calling interface.
  - `apps/web/src/pages/EmergencyWorkspacePage.tsx`: 11-tab clinical workspace.
- **Frontend Components & Hooks**:
  - `apps/web/src/components/emergency/*`: Header, Vitals widget, Modals, and 11 Tab sections.
  - `apps/web/src/hooks/emergency/useEmergencyWorkspaceFeature.ts`: Workspace business state management.
  - `apps/web/src/api/emergency.ts`: Emergency API client.
- **Backend API & Service**:
  - `apps/api/src/modules/emergency/emergency.routes.ts`: Fastify route handlers & permission guards.
  - `apps/api/src/modules/emergency/emergency.service.ts`: Business logic & transactional status transitions.
  - `apps/api/src/modules/emergency/emergency.repository.ts`: Mongo queries and projections.
  - `apps/api/src/modules/emergency/emergency.model.ts`: Mongoose schema and indexes.
  - `apps/api/src/modules/emergency/emergency.types.ts`: TypeScript contracts and statuses.

---

## 3. Admissions

### 3.1 Navigation
In `apps/web/src/data/ui-foundation.ts`, the `admissions` navigation group is configured as follows:

```text
Admissions (icon: ph-bed)
├── Admission Requests → /admissions/inpatients
├── Bed Management     → /admissions/beds
└── Inpatient Workspace→ /admissions/workspace
```

Route permissions defined in `apps/web/src/auth/access-control.ts`:
- `/admissions` → requires `Admissions -> Inpatient Admissions -> View`
- `/admissions/inpatients` → requires `Admissions -> Admission Requests -> View`
- `/admissions/beds` → requires `Admissions -> Beds -> View`
- `/admissions/workspace` → requires `Admissions -> Inpatient Admissions -> View`

---

### 3.2 Pages

#### 1. Admission Requests (`/admissions/inpatients` — `InpatientAdmissionPage.tsx`)
- **Purpose**: Intake and processing of admission requests originating from OPD, Emergency, Surgery, or Direct Walk-in.
- **Main UI Sections**:
  - Status filter tabs (`Pending Validation`, `Ready For Confirmation`, `Confirmed`, `Cancelled`).
  - Request summary cards (Total Requests, Pending Bed Validation, Ready, Confirmed).
  - Request Table (Patient, Source Type, Department, Priority, Bed Allocation Status, Actions).
  - *New Admission Request Modal*: Form to create requests.
  - *Admission Request Detail Modal*: Bed assignment, hold creation, consent attachment, advance deposit invoice linking, validation, and confirmation.
- **Statuses Handled**: `PENDING_VALIDATION`, `READY_FOR_CONFIRMATION`, `CONFIRMED`, `CANCELLED`.
- **Permissions Required**: `Admissions -> Admission Requests -> View | Create | Validate | Confirm | Cancel`.
- **APIs Used**: `GET /api/admissions/requests`, `GET /api/admissions/requests/:id`, `POST /api/admissions/requests`, `PATCH /api/admissions/requests/:id/validate`, `POST /api/admissions/requests/:id/confirm`, `POST /api/admissions/requests/:id/cancel`.

#### 2. Bed Management (`/admissions/beds` — `BedManagementPage.tsx`)
- **Purpose**: Interactive ward and bed grid, occupancy tracking, bed status administration, bed holds, and patient transfers.
- **Main UI Sections**:
  - Summary KPI cards (Total Beds, Available, Occupied, Reserved / Held, Blocked, Under Maintenance, Inactive).
  - Filter Controls: Ward dropdown, Bed status filter, Search, Branch selector.
  - Bed Board Grid: Cards representing individual beds with color-coded status badges, patient tags, and action buttons.
  - Action Modals: Create Ward, Create Bed, Edit Policy, Place Bed Hold, Transfer Bed, Update Bed Status.
- **Statuses Handled**: `AVAILABLE`, `OCCUPIED`, `RESERVED`, `BLOCKED`, `UNDER_MAINTENANCE`, `INACTIVE`.
- **Permissions Required**: `Admissions -> Beds -> View | Create | Edit | ChangeStatus`, `Admissions -> Wards -> View | Create | Edit | ChangeStatus`, `Admissions -> Bed Holds -> Create | Release | Cancel`, `Admissions -> Bed Transfers -> Create | Complete | Cancel | CrossBranch`, `Admissions -> Admission Policy -> View | Edit`.
- **APIs Used**: `GET /api/admissions/beds`, `GET /api/admissions/beds/summary`, `GET /api/admissions/wards`, `POST /api/admissions/beds/:id/holds`, `POST /api/admissions/bed-holds/:id/release`, `POST /api/admissions/inpatients/:id/transfers`, `POST /api/admissions/bed-transfers/:id/complete`, `PATCH /api/admissions/beds/:id/status`.

#### 3. Inpatient Workspace (`/admissions/workspace` — `InpatientWorkspacePage.tsx`)
- **Purpose**: Daily inpatient clinical management for currently admitted patients.
- **Main UI Sections**:
  - Admitted Inpatients List (Left Sidebar): Ward filter, Care level filter, Search, Inpatient patient cards.
  - Patient Overview Banner: Demographics, Admitting doctor, Ward/Bed number, Admission date, Length of stay.
  - 5 Tabbed Clinical Panels:
    1. `Orders`: Active and past diagnostic orders (Lab & Imaging), New Diagnostic Order Modal.
    2. `Rounds`: SOAP progress notes history, Add Ward Round Note Modal.
    3. `Vitals`: Bedside vital signs charts and timeline, Record Vitals Modal.
    4. `Surgeries`: Linked procedure recommendations and bookings, New Procedure Recommendation Modal.
    5. `Discharge`: Discharge summary editor (Diagnosis, Hospital course, Discharge medications, Follow-up instructions) and Finalize Discharge action.
- **Statuses Handled**: `ADMITTED`, `DISCHARGED`.
- **Permissions Required**: `Admissions -> Inpatient Admissions -> View | Create | Edit | Discharge`, `OPD -> OPD Prescription -> View | Edit`, `OPD -> OPD Clinical Orders -> View | Edit`, `Surgery -> Recommendations -> View | Create`.
- **APIs Used**: `GET /api/admissions/inpatients`, `GET /api/admissions/inpatients/:id`, `GET /api/admissions/inpatients/:id/round-notes`, `POST /api/admissions/inpatients/:id/round-notes`, `GET /api/admissions/inpatients/:id/vitals`, `POST /api/admissions/inpatients/:id/vitals`, `POST /api/admissions/inpatients/:id/discharge-summary`, `POST /api/admissions/inpatients/:id/finalize-discharge`.

---

### 3.3 Admission Request Workflow

```text
1. Recommendation / Request Creation
   ├─► Created from: OPD Consultation, Emergency Disposition, Surgery Recommendation, or Direct Intake
   ├─► API: POST /api/admissions/requests
   ├─► Captures: Patient ID, Department, Recommending Doctor, Source Type/ID, Priority, Reason
   └─► Status: PENDING_VALIDATION

2. Validation & Bed Allocation
   ├─► Review prerequisites: Check ward availability, place Bed Hold (POST /api/admissions/beds/:id/holds)
   ├─► Check Admission Policy (Consent upload, Advance deposit payment if required)
   ├─► API: PATCH /api/admissions/requests/:id/validate
   └─► Status: READY_FOR_CONFIRMATION

3. Admission Confirmation
   ├─► Final confirmation of bed allotment and admission time
   ├─► API: POST /api/admissions/requests/:id/confirm
   ├─► Backend Transaction:
   │     • Marks Admission Request -> CONFIRMED
   │     • Creates Inpatient Admission record -> ADMITTED
   │     • Atomically transitions Bed status: AVAILABLE/RESERVED -> OCCUPIED
   │     • Links bed to patient and admission record
   └─► Patient appears in Inpatient Workspace (/admissions/workspace)
```

---

### 3.4 Bed Management Workflow

- **Bed Selection & Hold**: An available bed can be held for a configurable duration (`bed_hold_duration_minutes`, default 30 min). Holding transitions the bed from `AVAILABLE` to `RESERVED` and attaches the `patient_id`.
- **Bed Allotment / Occupancy**: Occurs atomically upon Admission Request confirmation or direct inpatient admission creation. Bed transitions to `OCCUPIED`.
- **Bed Transfer**:
  - Initiated via `POST /api/admissions/inpatients/:id/transfers`.
  - Can be internal (same branch) or Cross-Branch (requires `Bed Transfers -> CrossBranch` permission).
  - Holds destination bed; upon completion (`POST /api/admissions/bed-transfers/:id/complete`), atomically marks old bed `AVAILABLE` and new bed `OCCUPIED`.
- **Maintenance / Blocking**: Beds can be manually transitioned between `AVAILABLE`, `BLOCKED`, `UNDER_MAINTENANCE`, `INACTIVE` with a mandatory reason.

---

### 3.5 Inpatient Care & Discharge Workflow

```text
Inpatient Workspace Active Care
  │
  ├─► Ward Rounds: Doctors/Nurses record SOAP notes (POST /api/admissions/inpatients/:id/round-notes)
  ├─► Bedside Vitals: Nursing captures BP, HR, Temp, SpO2, Pain (POST /api/admissions/inpatients/:id/vitals)
  ├─► Diagnostic Orders: Lab & Imaging orders submitted (POST /api/admissions/inpatients/:id/clinical-orders/:type)
  ├─► Surgery Recommendations: Procedures recommended (POST /api/surgery/recommendations)
  │
  └─► Discharge Process:
        1. Doctor drafts Discharge Summary (POST /api/admissions/inpatients/:id/discharge-summary)
        2. Doctor finalizes Discharge (POST /api/admissions/inpatients/:id/finalize-discharge)
        3. Backend Transaction:
             • Inpatient Admission status -> DISCHARGED
             • Bed status automatically released -> AVAILABLE
```

---

### 3.6 Actions (Admissions)

| Action | Where It Appears | Current Permission Required | What It Does | Resulting Status |
|---|---|---|---|---|
| **Create Admission Request** | Admission Requests Modal / OPD / Emergency | `Admissions -> Admission Requests -> Create` | Captures admission request from clinical source | `PENDING_VALIDATION` |
| **Validate Request & Hold Bed** | Admission Request Detail Modal | `Admissions -> Admission Requests -> Validate` | Validates consent/deposit, attaches ward and bed | `READY_FOR_CONFIRMATION` |
| **Confirm Admission** | Admission Request Detail Modal | `Admissions -> Admission Requests -> Confirm` | Converts request to live inpatient admission, occupies bed | `CONFIRMED` / Bed: `OCCUPIED` |
| **Cancel Admission Request** | Admission Request Detail Modal | `Admissions -> Admission Requests -> Cancel` | Cancels pending request and releases any bed hold | `CANCELLED` |
| **Create Ward / Bed** | Bed Management Page | `Admissions -> Wards -> Create` / `Beds -> Create` | Configures new physical wards and beds | Ward: `ACTIVE` / Bed: `AVAILABLE` |
| **Hold Bed** | Bed Management Bed Card | `Admissions -> Bed Holds -> Create` | Reserves bed for patient for policy duration | Bed: `RESERVED` |
| **Release / Cancel Hold** | Bed Management Bed Card | `Admissions -> Bed Holds -> Release \| Cancel` | Cancels hold, makes bed available | Bed: `AVAILABLE` |
| **Transfer Bed** | Bed Management / Inpatient Workspace | `Admissions -> Bed Transfers -> Create \| Complete` | Transfers patient to different bed/ward/branch | Old Bed: `AVAILABLE`, New Bed: `OCCUPIED` |
| **Change Bed Status** | Bed Management Bed Card | `Admissions -> Beds -> ChangeStatus` | Sets bed to Maintenance, Blocked, or Inactive | `UNDER_MAINTENANCE` / `BLOCKED` / `INACTIVE` |
| **Record Round Note** | Inpatient Workspace (Rounds Tab) | `Admissions -> Inpatient Admissions -> Create` | Adds SOAP clinical progress note | Retains `ADMITTED` |
| **Record Vitals** | Inpatient Workspace (Vitals Tab) | `Admissions -> Inpatient Admissions -> Create` | Adds bedside vital sign record | Retains `ADMITTED` |
| **Save Discharge Summary** | Inpatient Workspace (Discharge Tab) | `Admissions -> Inpatient Admissions -> Edit` | Saves draft discharge summary | Retains `ADMITTED` |
| **Finalize Discharge** | Inpatient Workspace (Discharge Tab) | `Admissions -> Inpatient Admissions -> Discharge` | Finalizes discharge, discharges patient, frees bed | Admission: `DISCHARGED`, Bed: `AVAILABLE` |

---

### 3.7 Statuses (Admissions)

- **Admission Request Statuses**:
  - `PENDING_VALIDATION`: Request created; prerequisites and bed not yet locked.
  - `READY_FOR_CONFIRMATION`: Bed held and policy requirements validated.
  - `CONFIRMED`: Inpatient admission generated and active.
  - `CANCELLED`: Request abandoned or rejected.
- **Inpatient Admission Statuses**:
  - `ADMITTED`: Active admitted patient receiving inpatient care.
  - `DISCHARGED`: Patient completed inpatient stay and discharged.
- **Bed Statuses**:
  - `AVAILABLE`: Ready for patient allotment or hold.
  - `OCCUPIED`: Currently assigned to an active admitted patient.
  - `RESERVED`: Temporarily held for incoming patient.
  - `BLOCKED`: Temporarily unavailable due to administrative isolation or block.
  - `UNDER_MAINTENANCE`: Bed undergoing repair or deep sanitation.
  - `INACTIVE`: Bed decommissioned.

---

### 3.8 Permissions Catalog (Admissions)

| Permission Code | Meaning in Current Implementation | Used by UI | Used by API | Roles Currently Assigned (in seed.ts) |
|---|---|---|---|---|
| `ADMISSIONS_WARDS_VIEW` | View wards list and ward details | Yes | Yes | `DOCTOR`, `CLINICIAN_NURSE`, `RECEPTIONIST`, `ADMINISTRATOR` |
| `ADMISSIONS_WARDS_CREATE` | Create new hospital ward | Yes | Yes | `ADMINISTRATOR` |
| `ADMISSIONS_WARDS_EDIT` | Edit ward metadata and floor | Yes | Yes | `ADMINISTRATOR` |
| `ADMISSIONS_WARDS_CHANGESTATUS` | Activate / Deactivate ward | Yes | Yes | `ADMINISTRATOR` |
| `ADMISSIONS_BEDS_VIEW` | View bed board and bed availability | Yes | Yes | `DOCTOR`, `CLINICIAN_NURSE`, `RECEPTIONIST`, `ADMINISTRATOR` |
| `ADMISSIONS_BEDS_CREATE` | Create new physical bed | Yes | Yes | `ADMINISTRATOR` |
| `ADMISSIONS_BEDS_EDIT` | Edit bed number, category, room number | Yes | Yes | `ADMINISTRATOR` |
| `ADMISSIONS_BEDS_CHANGESTATUS` | Mark bed blocked/maintenance/inactive | Yes | Yes | `ADMINISTRATOR` |
| `ADMISSIONS_ADMISSION_POLICY_VIEW` | View admission deposit/consent rules | Yes | Yes | `RECEPTIONIST`, `ADMINISTRATOR` |
| `ADMISSIONS_ADMISSION_POLICY_EDIT` | Update admission deposit/consent rules | Yes | Yes | `ADMINISTRATOR` |
| `ADMISSIONS_BED_HOLDS_VIEW` | View active and expired bed holds | Yes | Yes | `ADMINISTRATOR` |
| `ADMISSIONS_BED_HOLDS_CREATE` | Place a temporary hold on an available bed | Yes | Yes | `RECEPTIONIST`, `ADMINISTRATOR` |
| `ADMISSIONS_BED_HOLDS_RELEASE` | Release an active bed hold | Yes | Yes | `RECEPTIONIST`, `ADMINISTRATOR` |
| `ADMISSIONS_BED_HOLDS_CANCEL` | Cancel an active bed hold | Yes | Yes | `RECEPTIONIST`, `ADMINISTRATOR` |
| `ADMISSIONS_BED_TRANSFERS_VIEW` | View bed transfer logs | Yes | Yes | `CLINICIAN_NURSE`, `ADMINISTRATOR` |
| `ADMISSIONS_BED_TRANSFERS_CREATE` | Initiate internal bed transfer | Yes | Yes | `ADMINISTRATOR` |
| `ADMISSIONS_BED_TRANSFERS_COMPLETE`| Complete bed transfer | Yes | Yes | `ADMINISTRATOR` |
| `ADMISSIONS_BED_TRANSFERS_CANCEL` | Cancel initiated bed transfer | Yes | Yes | `ADMINISTRATOR` |
| `ADMISSIONS_BED_TRANSFERS_CROSSBRANCH`| Initiate/complete transfer across branches | Yes | Yes | `ADMINISTRATOR` |
| `ADMISSIONS_INPATIENT_ADMISSIONS_VIEW`| View active inpatient list and details | Yes | Yes | `DOCTOR`, `CLINICIAN_NURSE`, `BILLING_AUTHORIZED`, `RECEPTIONIST`, `ADMINISTRATOR` |
| `ADMISSIONS_INPATIENT_ADMISSIONS_CREATE`| Record round notes, vitals | Yes | Yes | `DOCTOR`, `CLINICIAN_NURSE`, `ADMINISTRATOR` |
| `ADMISSIONS_INPATIENT_ADMISSIONS_EDIT`| Edit admission details & discharge summary | Yes | Yes | `DOCTOR`, `CLINICIAN_NURSE`, `ADMINISTRATOR` |
| `ADMISSIONS_INPATIENT_ADMISSIONS_DISCHARGE`| Finalize discharge and free bed | Yes | Yes | `DOCTOR`, `ADMINISTRATOR` |
| `ADMISSIONS_ADMISSION_RECOMMENDATIONS_VIEW`| View doctor admission recommendations | Yes | Yes | `DOCTOR`, `ADMINISTRATOR` |
| `ADMISSIONS_ADMISSION_RECOMMENDATIONS_CREATE`| Recommend inpatient admission from OPD | Yes | Yes | `DOCTOR`, `ADMINISTRATOR` |
| `ADMISSIONS_ADMISSION_RECOMMENDATIONS_CANCEL`| Cancel admission recommendation | Yes | Yes | `DOCTOR`, `ADMINISTRATOR` |
| `ADMISSIONS_ADMISSION_REQUESTS_VIEW`| View admission requests queue | Yes | Yes | `RECEPTIONIST`, `CLINICIAN_NURSE`, `BILLING_AUTHORIZED`, `ADMINISTRATOR` |
| `ADMISSIONS_ADMISSION_REQUESTS_CREATE`| Create admission request intake | Yes | Yes | `RECEPTIONIST`, `ADMINISTRATOR` |
| `ADMISSIONS_ADMISSION_REQUESTS_VALIDATE`| Validate prerequisites & allocate bed | Yes | Yes | `RECEPTIONIST`, `ADMINISTRATOR` |
| `ADMISSIONS_ADMISSION_REQUESTS_CONFIRM`| Confirm admission and admit patient | Yes | Yes | `RECEPTIONIST`, `ADMINISTRATOR` |
| `ADMISSIONS_ADMISSION_REQUESTS_CANCEL`| Cancel admission request | Yes | Yes | `RECEPTIONIST`, `ADMINISTRATOR` |

---

### 3.9 Current Role Behavior (Admissions)

- **Doctor**:
  - *Sidebar*: Sees Admissions (`Bed Management`, `Inpatient Workspace`).
  - *Clinical Inpatient Care*: Views admitted inpatients, writes ward round SOAP notes, records bedside vitals, orders diagnostic investigations, recommends procedures, drafts discharge summaries, and finalizes patient discharge (`Discharge`).
  - *Cannot*: Process administrative admission requests (validate/confirm), manage ward/bed infrastructure, or place administrative bed holds.
- **Nurse (`CLINICIAN_NURSE`)**:
  - *Sidebar*: Sees Admissions (`Admission Requests`, `Bed Management`, `Inpatient Workspace`).
  - *Inpatient Care*: Views admitted inpatients, records bedside vitals and round notes.
  - *Cannot*: Finalize patient discharge (lacks `Discharge`), create admission recommendations, or validate/confirm admission requests.
- **Receptionist**:
  - *Sidebar*: Sees Admissions (`Admission Requests`, `Bed Management`).
  - *Intake & Allotment*: Creates admission requests, validates prerequisites (consents and advance deposits), creates bed holds, and confirms admissions (generating active inpatient records and occupying beds).
  - *Cannot*: Record clinical notes, order medications/investigations, or finalize medical discharge in Inpatient Workspace.

---

### 3.10 UI / Route / API Authorization Alignment (Admissions)

- **Admission Creation Endpoint**: `/api/admissions/requests` requires `Admissions -> Admission Requests -> Create` (assigned to `RECEPTIONIST`), while `/api/admissions/recommendations` allows doctors with `Admissions -> Admission Recommendations -> Create` to initiate recommendations.
- **Discharge Authorization**: Discharge summary drafting requires `Inpatient Admissions -> Edit`, but finalizing discharge strictly requires `Inpatient Admissions -> Discharge`, which is exclusively assigned to `DOCTOR` and `ADMINISTRATOR`.

---

### 3.11 Important Admissions Files

- **Frontend Pages**:
  - `apps/web/src/pages/InpatientAdmissionPage.tsx`: Admission requests queue, validation modal, and confirmation.
  - `apps/web/src/pages/BedManagementPage.tsx`: Bed board, bed holds, status changes, transfers.
  - `apps/web/src/pages/InpatientWorkspacePage.tsx`: Inpatient clinical workspace.
- **Frontend Components & Hooks**:
  - `apps/web/src/hooks/admissions/useInpatientAdmissionFeature.ts`: Request feature hook.
  - `apps/web/src/hooks/admissions/useBedManagementFeature.ts`: Bed feature hook.
  - `apps/web/src/hooks/admissions/useInpatientWorkspaceFeature.ts`: Inpatient workspace feature hook.
  - `apps/web/src/api/inpatient-admissions.ts` & `apps/web/src/api/admissions-configuration.ts`: API clients.
- **Backend API & Service**:
  - `apps/api/src/modules/inpatient-admissions/inpatient-admission.routes.ts`: Routes for requests, rounds, vitals, discharge.
  - `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts`: Transactional admission logic.
  - `apps/api/src/modules/admissions-configuration/admissions-configuration.routes.ts`: Wards, beds, holds, transfers.
  - `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts`: Bed management and hold lifecycle service.

---

## 4. Surgery

### 4.1 Navigation
In `apps/web/src/data/ui-foundation.ts`, the `surgery` navigation group is configured as follows:

```text
Surgery (icon: ph-scissors)
└── Procedure Workflow → /surgery
```

Route permissions defined in `apps/web/src/auth/access-control.ts`:
- `/surgery` is listed in `anyPermissionRoutes`, requiring **any** of:
  - `{ module: 'Surgery', screen: 'Recommendations' }` (View)
  - `{ module: 'Surgery', screen: 'Bookings' }` (View)
  - `{ module: 'Surgery', screen: 'Schedule' }` (View)

---

### 4.2 Pages

#### Surgery & Procedure Workspace (`/surgery` — `SurgeryWorkspacePage.tsx`)
- **Purpose**: Unified multi-tab operational workspace managing the complete lifecycle of surgical procedures.
- **Main UI Sections**:
  - Workspace Header: Branch selector, "+ New Recommendation" button.
  - 3 Tabbed Panels:
    1. `Recommendations` (`SurgeryRecommendationsTab.tsx`): List of procedure recommendations, status badges, priority, recommending doctor, and "+ Book Surgery" action.
    2. `Bookings` (`SurgeryBookingsTab.tsx`): Table of scheduled and confirmed surgeries with filtering by theater, date, status, and direct action modals (Confirm, Reschedule, Complete, Cancel).
    3. `Schedule` (`SurgeryScheduleTab.tsx`): Operating Theater (OT) timeline/calendar view showing theater occupancy, slot utilization, and conflicting bookings.
  - Modals:
    - *New Procedure Recommendation Modal* (`NewProcedureRecommendationModal.tsx`)
    - *Surgery Booking Create Modal* (`SurgeryBookingCreateModal.tsx`)
    - *Surgery Booking Action Modal* (`SurgeryBookingActionModal.tsx` — handles Confirm, Reschedule, Complete, Cancel)
    - *Surgery Booking Detail Modal* (`SurgeryBookingDetailModal.tsx`)
- **Statuses Handled**: `RECOMMENDED`, `PENDING_CONFIRMATION`, `BOOKED`, `COMPLETED`, `CANCELLED`.
- **Permissions Required**: `Surgery -> Recommendations -> View | Create | Cancel`, `Surgery -> Bookings -> View | Create | Confirm | Reschedule | Cancel | Complete`, `Surgery -> Schedule -> View`.
- **APIs Used**: `GET /api/surgery/recommendations`, `POST /api/surgery/recommendations`, `POST /api/surgery/recommendations/:id/cancel`, `GET /api/surgery/bookings`, `GET /api/surgery/bookings/:id`, `POST /api/surgery/bookings`, `POST /api/surgery/bookings/:id/confirm`, `POST /api/surgery/bookings/:id/reschedule`, `POST /api/surgery/bookings/:id/complete`, `POST /api/surgery/bookings/:id/cancel`, `GET /api/surgery/schedule`, `GET /api/surgery/availability/alternatives`.

---

### 4.3 Recommendation Workflow

- **Origination**: Can be initiated from OPD Consultation, Inpatient Workspace, or directly in the Surgery Workspace.
- **Captured Fields**: `patient_id`, `department_id`, `service_id` (procedure service from service catalog), `recommending_doctor_id`, `priority` (`ROUTINE`, `URGENT`, `EMERGENCY`), `clinical_indication`, `notes`.
- **Permission**: Controlled by `Surgery -> Recommendations -> Create`.
- **Status Assigned**: `RECOMMENDED`.
- **Outcome**: Recommendation enters the Recommendations tab awaiting administrative or clinical OT slot booking.

---

### 4.4 Booking Workflow

```text
1. Create Booking (POST /api/surgery/bookings)
   ├─► Selected from existing Recommendation (or direct scheduling)
   ├─► Captures: recommendation_id, operating_theater_id, lead_surgeon_id,
   │             scheduled_start, scheduled_end, anesthesia_type, post_op_bed_id
   ├─► Concurrency Validation: Backend validates OT slot conflict and surgeon availability
   └─► Status: PENDING_CONFIRMATION (or BOOKED if immediate confirmation selected)

2. Confirm Booking (POST /api/surgery/bookings/:id/confirm)
   ├─► Prerequisite check: Surgical consent verified, pre-op clearance notes attached
   ├─► Permission: Surgery -> Bookings -> Confirm
   └─► Status: BOOKED

3. Reschedule Booking (POST /api/surgery/bookings/:id/reschedule)
   ├─► Updates scheduled_start, scheduled_end, operating_theater_id, and reason
   ├─► Permission: Surgery -> Bookings -> Reschedule
   └─► Status: BOOKED (with updated schedule)

4. Cancel Booking (POST /api/surgery/bookings/:id/cancel)
   ├─► Requires mandatory cancellation reason
   ├─► Permission: Surgery -> Bookings -> Cancel
   └─► Status: CANCELLED
```

---

### 4.5 Schedule Workflow

- Displayed in `SurgeryScheduleTab.tsx`.
- Queries `GET /api/surgery/schedule` grouped by Operating Theater (e.g., OT 1, OT 2, Minor OT).
- Highlights occupied slots, lead surgeon assignments, and estimated procedure durations.
- Slot alternative search via `GET /api/surgery/availability/alternatives` assists coordinators in identifying open OT slots without overlapping schedules.

---

### 4.6 Procedure & Completion Workflow

- **Intra-op & Post-op Clinical Documentation**:
  - Prescription orders for surgical booking: `POST /api/surgery/bookings/:id/prescription`
  - Intra-op diagnostic/specimen orders: `POST /api/surgery/bookings/:id/clinical-orders/:orderType`
- **Completion**:
  - Lead Surgeon or authorized physician executes completion: `POST /api/surgery/bookings/:id/complete`.
  - Captures actual procedure start/end timestamps, surgeon operative notes, and post-op disposition.
  - Transitions status to `COMPLETED`.
  - If a post-op bed hold was linked, patient transitions towards recovery/inpatient care.

---

### 4.7 Actions (Surgery)

| Action | Where It Appears | Current Permission Required | What It Does | Resulting Status |
|---|---|---|---|---|
| **Create Recommendation** | Surgery Workspace / OPD / Inpatient | `Surgery -> Recommendations -> Create` | Captures surgical procedure recommendation | `RECOMMENDED` |
| **Cancel Recommendation** | Recommendations Tab | `Surgery -> Recommendations -> Cancel` | Cancels surgery recommendation | `CANCELLED` |
| **Create Surgery Booking** | Recommendations Tab / Booking Modal | `Surgery -> Bookings -> Create` | Schedules procedure slot in OT | `PENDING_CONFIRMATION` or `BOOKED` |
| **Confirm Booking** | Bookings Tab (Action Menu) | `Surgery -> Bookings -> Confirm` | Validates prerequisites and confirms OT slot | `BOOKED` |
| **Reschedule Booking** | Bookings Tab (Action Menu) | `Surgery -> Bookings -> Reschedule` | Updates OT time slot or theater | `BOOKED` |
| **Cancel Booking** | Bookings Tab (Action Menu) | `Surgery -> Bookings -> Cancel` | Cancels scheduled surgery with reason | `CANCELLED` |
| **Complete Surgery** | Bookings Tab (Action Menu) | `Surgery -> Bookings -> Complete` | Concludes procedure, records operative summary | `COMPLETED` |
| **View OT Schedule** | Schedule Tab | `Surgery -> Schedule -> View` | Displays theater occupancy and slot grid | N/A (Read-only) |

---

### 4.8 Statuses (Surgery)

- **Recommendation Statuses**:
  - `RECOMMENDED`: Initial recommendation awaiting booking.
  - `BOOKED`: Recommendation converted into a scheduled booking.
  - `CANCELLED`: Recommendation cancelled.
- **Booking Statuses**:
  - `PENDING_CONFIRMATION`: Scheduled in OT, awaiting pre-op clearance or administrative confirmation.
  - `BOOKED`: Confirmed and locked in OT schedule.
  - `COMPLETED`: Procedure successfully conducted and concluded.
  - `CANCELLED`: Booking cancelled.

---

### 4.9 Permissions Catalog (Surgery)

| Permission Code | Meaning in Current Implementation | Used by UI | Used by API | Roles Currently Assigned (in seed.ts) |
|---|---|---|---|---|
| `SURGERY_RECOMMENDATIONS_VIEW` | View surgery recommendations list | Yes | Yes | `DOCTOR`, `RECEPTIONIST`, `ADMINISTRATOR` |
| `SURGERY_RECOMMENDATIONS_CREATE` | Create surgical procedure recommendation | Yes | Yes | `DOCTOR`, `ADMINISTRATOR` |
| `SURGERY_RECOMMENDATIONS_CANCEL` | Cancel surgery recommendation | Yes | Yes | `DOCTOR`, `ADMINISTRATOR` |
| `SURGERY_BOOKINGS_VIEW` | View bookings and procedure details | Yes | Yes | `DOCTOR`, `RECEPTIONIST`, `BILLING_AUTHORIZED`, `ADMINISTRATOR` |
| `SURGERY_BOOKINGS_CREATE` | Create OT booking from recommendation | Yes | Yes | `RECEPTIONIST`, `ADMINISTRATOR` |
| `SURGERY_BOOKINGS_CONFIRM` | Confirm scheduled booking | Yes | Yes | `RECEPTIONIST`, `ADMINISTRATOR` |
| `SURGERY_BOOKINGS_RESCHEDULE` | Reschedule booking time slot / theater | Yes | Yes | `RECEPTIONIST`, `ADMINISTRATOR` |
| `SURGERY_BOOKINGS_CANCEL` | Cancel scheduled surgery booking | Yes | Yes | `RECEPTIONIST`, `ADMINISTRATOR` |
| `SURGERY_BOOKINGS_COMPLETE` | Finalize surgery and record operative notes | Yes | Yes | `DOCTOR`, `ADMINISTRATOR` |
| `SURGERY_SCHEDULE_VIEW` | View Operating Theater schedule grid | Yes | Yes | `DOCTOR`, `RECEPTIONIST`, `ADMINISTRATOR` |

---

### 4.10 Current Role Behavior (Surgery)

- **Doctor**:
  - *Sidebar*: Sees Surgery (`Procedure Workflow`).
  - *Clinical Surgery Actions*: Recommends procedures from OPD, Inpatient, or Surgery workspace; views recommendations and bookings; views OT schedule; completes surgeries (`Complete`) and submits operative notes/prescriptions.
  - *Cannot*: Book OT slots, confirm administrative bookings, reschedule, or cancel bookings (these are currently gated by `Surgery -> Bookings -> Create | Confirm | Reschedule | Cancel`, which are assigned to Receptionist/Admin).
- **Nurse (`CLINICIAN_NURSE`)**:
  - *Sidebar*: Does **not** currently see Surgery (lacks `Surgery -> Recommendations -> View`, `Bookings -> View`, `Schedule -> View` in `seed.ts`).
- **Receptionist**:
  - *Sidebar*: Sees Surgery (`Procedure Workflow`).
  - *Administrative Scheduling*: Views recommendations, creates bookings, confirms bookings, reschedules slots, and cancels bookings.
  - *Cannot*: Create clinical recommendations or complete surgical procedures.

---

### 4.11 UI / Route / API Authorization Alignment (Surgery)

- **Single Route Access**: `/surgery` uses `anyPermissionRoutes` logic in `access-control.ts`, granting access if the user has `Recommendations -> View`, `Bookings -> View`, or `Schedule -> View`.
- **Prescription & Clinical Orders in Surgery**: Endpoints `/api/surgery/bookings/:id/prescription` and `/api/surgery/bookings/:id/clinical-orders/:orderType` leverage shared OPD permission keys (`OPD -> OPD Prescription -> View | Edit` and `OPD -> OPD Clinical Orders -> View | Edit`), allowing Doctors to seamlessly order meds and tests for surgical patients.

---

### 4.12 Important Surgery Files

- **Frontend Pages**:
  - `apps/web/src/pages/SurgeryWorkspacePage.tsx`: Single-page multi-tab Surgery & Procedure workspace.
- **Frontend Components & Hooks**:
  - `apps/web/src/components/surgery/SurgeryRecommendationsTab.tsx`: Recommendations list.
  - `apps/web/src/components/surgery/SurgeryBookingsTab.tsx`: Bookings management table.
  - `apps/web/src/components/surgery/SurgeryScheduleTab.tsx`: Operating Theater schedule calendar.
  - `apps/web/src/components/surgery/NewProcedureRecommendationModal.tsx`: Recommendation modal.
  - `apps/web/src/components/surgery/SurgeryBookingCreateModal.tsx`: Booking creation modal.
  - `apps/web/src/components/surgery/SurgeryBookingActionModal.tsx`: Booking action modal (Confirm/Reschedule/Cancel/Complete).
  - `apps/web/src/hooks/surgery/useSurgeryWorkspaceFeature.ts`: Feature hook managing tabs and mutations.
  - `apps/web/src/api/surgery.ts`: API client for surgery domain.
- **Backend API & Service**:
  - `apps/api/src/modules/surgery/surgery.routes.ts`: Fastify route declarations.
  - `apps/api/src/modules/surgery/surgery.service.ts`: Surgery scheduling and validation service.
  - `apps/api/src/modules/surgery/surgery.repository.ts`: Repository and MongoDB transactions.
  - `apps/api/src/modules/surgery/surgery.model.ts`: Schemas for recommendations and bookings.
  - `apps/api/src/modules/surgery/surgery.types.ts`: TypeScript contracts and statuses.

---

## 5. Cross-Module Patient Journey

```text
Emergency Encounter
       │
       ├─► (Patient requires immediate surgery)
       │         │
       │         ▼
       │   Surgery Recommendation (POST /api/surgery/recommendations)
       │         │
       │         ▼
       │   Surgery Booking & Emergency Procedure
       │         │
       │         ▼
       └─► (Patient requires Inpatient Admission)
                 │
                 ▼
           Emergency Disposition: ADMIT / Convert to IP (POST /api/emergency/:id/disposition)
                 │
                 ▼
           Admission Request Created (status: PENDING_VALIDATION)
                 │
                 ▼
           Bed Allocation & Hold (POST /api/admissions/beds/:id/holds)
                 │
                 ▼
           Admission Confirmation (POST /api/admissions/requests/:id/confirm)
                 │
                 ▼
           Patient Admitted to Ward (Bed status: OCCUPIED)
                 │
                 ▼
           Inpatient Care (Rounds, Vitals, Medications, Lab/Imaging Orders)
                 │
                 ▼
           Medical Discharge & Bed Release (POST /api/admissions/inpatients/:id/finalize-discharge)
                 │
                 ▼
           Bed becomes AVAILABLE; Admission record marked DISCHARGED
```

---

## 6. Current RBAC Summary Table

| Module | Sub-domain / Screen | Action | Doctor | Clinician / Nurse | Receptionist | Administrator |
|---|---|---|:---:|:---:|:---:|:---:|
| **Emergency** | `Encounters` | `View` | REQ | REQ | REQ | REQ |
| | | `Register` | — | — | REQ | REQ |
| | | `Edit` | — | — | — | REQ |
| | `Triage` | `View` | REQ | REQ | REQ | REQ |
| | | `Assess` | — | REQ | — | REQ |
| | | `OverridePriority`| — | — | — | REQ |
| | `Consultation` | `View` | REQ | REQ | — | REQ |
| | | `Edit` | REQ | — | — | REQ |
| | `Orders` | `View` | REQ | REQ | — | REQ |
| | | `Create` | REQ | — | — | REQ |
| | `Disposition` | `View` | REQ | REQ | — | REQ |
| | | `Discharge` | REQ | — | — | REQ |
| | | `Transfer` | REQ | — | — | REQ |
| | | `ConvertToIP`| REQ | — | — | REQ |
| | | `MarkLeft` | REQ | — | — | REQ |
| | | `MarkNoShow` | — | — | REQ | REQ |
| | | `Cancel` | — | — | REQ | REQ |
| | `Patient Linking` | `Link` | — | — | REQ | REQ |
| | | `Correct` | — | — | — | REQ |
| **Admissions** | `Wards` | `View` | REQ | REQ | REQ | REQ |
| | | `Create` / `Edit` / `ChangeStatus` | — | — | — | REQ |
| | `Beds` | `View` | REQ | REQ | REQ | REQ |
| | | `Create` / `Edit` / `ChangeStatus` | — | — | — | REQ |
| | `Admission Policy` | `View` | — | — | REQ | REQ |
| | | `Edit` | — | — | — | REQ |
| | `Bed Holds` | `View` / `Create` / `Release` / `Cancel` | — | — | REQ | REQ |
| | `Bed Transfers`| `View` | — | REQ | — | REQ |
| | | `Create` / `Complete` / `Cancel` / `CrossBranch` | — | — | — | REQ |
| | `Inpatient Admissions`| `View` | REQ | REQ | REQ | REQ |
| | | `Create` (Rounds/Vitals) | REQ | REQ | — | REQ |
| | | `Edit` (Discharge Summary) | REQ | REQ | — | REQ |
| | | `Discharge` (Finalize) | REQ | — | — | REQ |
| | `Admission Recommendations` | `View` / `Create` / `Cancel` | REQ | — | — | REQ |
| | `Admission Requests` | `View` | — | REQ | REQ | REQ |
| | | `Create` / `Validate` / `Confirm` / `Cancel` | — | — | REQ | REQ |
| **Surgery** | `Recommendations`| `View` | REQ | — | REQ | REQ |
| | | `Create` / `Cancel` | REQ | — | — | REQ |
| | `Bookings` | `View` | REQ | — | REQ | REQ |
| | | `Create` / `Confirm` / `Reschedule` / `Cancel` | — | — | REQ | REQ |
| | | `Complete` | REQ | — | — | REQ |
| | `Schedule` | `View` | REQ | — | REQ | REQ |

---

## 7. Current Gaps / Inconsistencies Identified

1. **Nurse Surgery Access**:
   - The `CLINICIAN_NURSE` role in `seed.ts` is not granted any permissions on `Surgery` (`Recommendations`, `Bookings`, or `Schedule`), meaning nurses currently have zero access to the `/surgery` page or procedure tracking, even for pre-op/post-op ward preparation.
2. **Bed Transfers Creation**:
   - In `seed.ts`, `Admissions -> Bed Transfers -> Create | Complete` is only assigned to `ADMINISTRATOR`. Neither Doctor, Nurse, nor Receptionist can execute bed transfers on the Bed Management page unless they have Administrator privileges.
3. **Emergency Priority Override**:
   - In `seed.ts`, `Emergency -> Triage -> OverridePriority` is only assigned to `ADMINISTRATOR`. Emergency Doctors currently cannot override computed triage scores without admin privileges.
4. **Admission Policy Viewing**:
   - `Admissions -> Admission Policy -> View` is assigned to Receptionist and Administrator, but not Doctor or Nurse.

---

## 8. Files Reviewed

### Emergency
- `apps/web/src/pages/EmergencyDashboardPage.tsx`
- `apps/web/src/pages/EmergencyQueuePage.tsx`
- `apps/web/src/pages/EmergencyWorkspacePage.tsx`
- `apps/web/src/components/emergency/*`
- `apps/web/src/hooks/emergency/useEmergencyWorkspaceFeature.ts`
- `apps/web/src/api/emergency.ts`
- `apps/api/src/modules/emergency/emergency.routes.ts`
- `apps/api/src/modules/emergency/emergency.service.ts`
- `apps/api/src/modules/emergency/emergency.repository.ts`
- `apps/api/src/modules/emergency/emergency.model.ts`
- `apps/api/src/modules/emergency/emergency.types.ts`
- `apps/api/src/modules/emergency/emergency.schemas.ts`

### Admissions
- `apps/web/src/pages/InpatientAdmissionPage.tsx`
- `apps/web/src/pages/BedManagementPage.tsx`
- `apps/web/src/pages/InpatientWorkspacePage.tsx`
- `apps/web/src/components/admissions/*`
- `apps/web/src/hooks/admissions/useInpatientAdmissionFeature.ts`
- `apps/web/src/hooks/admissions/useBedManagementFeature.ts`
- `apps/web/src/hooks/admissions/useInpatientWorkspaceFeature.ts`
- `apps/web/src/api/inpatient-admissions.ts`
- `apps/web/src/api/admissions-configuration.ts`
- `apps/api/src/modules/inpatient-admissions/inpatient-admission.routes.ts`
- `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts`
- `apps/api/src/modules/inpatient-admissions/inpatient-admission.repository.ts`
- `apps/api/src/modules/inpatient-admissions/inpatient-admission.model.ts`
- `apps/api/src/modules/admissions-configuration/admissions-configuration.routes.ts`
- `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts`
- `apps/api/src/modules/admissions-configuration/admissions-configuration.repository.ts`
- `apps/api/src/modules/admissions-configuration/admissions-configuration.model.ts`

### Surgery
- `apps/web/src/pages/SurgeryWorkspacePage.tsx`
- `apps/web/src/components/surgery/*`
- `apps/web/src/hooks/surgery/useSurgeryWorkspaceFeature.ts`
- `apps/web/src/api/surgery.ts`
- `apps/api/src/modules/surgery/surgery.routes.ts`
- `apps/api/src/modules/surgery/surgery.service.ts`
- `apps/api/src/modules/surgery/surgery.repository.ts`
- `apps/api/src/modules/surgery/surgery.model.ts`
- `apps/api/src/modules/surgery/surgery.types.ts`
- `apps/api/src/modules/surgery/surgery.schemas.ts`

### RBAC & Shared Foundations
- `apps/api/src/database/seed.ts`
- `apps/web/src/data/ui-foundation.ts`
- `apps/web/src/auth/access-control.ts`
- `apps/api/src/middleware/require-permission.ts`
