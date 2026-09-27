# Phase 8 — Documents & Dental Capability Audit

## 1. Executive Summary

This audit evaluates the Documents and Dental capabilities in the HMS backend and existing Patient Portal contracts to guide the implementation of Phase 8 for `@hms/patient-mobile`.

---

## 2. Documents Capability Matrix

| Capability | Backend Support | Patient Web Support | Mobile Action / Status |
|---|---|---|---|
| **Document List** | **YES** (`GET /api/patient-portal/documents?patient_id=<id>&limit=100`) | **YES** (`PortalDocuments.tsx`) | **Reuse**: Implement in `DocumentsApi` and `DocumentsScreen` |
| **Document Metadata** | **YES** (`id`, `title`, `file_name`, `mime_type`, `file_size_bytes`, `document_type`, `source`, `review_status`, `document_date`, `provider_name`, `created_at`) | **YES** | **Reuse**: Fully typed via Zod schemas & displayed in document cards / detail modal |
| **Document Upload** | **YES** (`POST /api/patient-portal/documents/upload` multipart) | **YES** | **Reuse**: Fully supported in `DocumentsApi` |
| **Document Download** | **YES** (`GET /api/patient-portal/patients/:patientId/documents/:documentId/download`) | **YES** | **Reuse**: Supported via authenticated transport download |
| **Authenticated File Access** | **YES** (Bearer token validated, patient authorization verified) | **YES** | **Reuse**: Integrated with `SessionManager.authenticatedRequest` |
| **Document Viewing** | **YES** (Metadata, itemized details, and download capability) | **YES** | **Reuse**: Display structured document preview and detail modal |
| **Context Isolation** | **YES** (`patient_id` parameter) | **YES** | **Reuse**: Purge document state on patient / dependent context switch |

---

## 3. Dental Capability Matrix

| Capability | Backend Support | Patient Web Support | Mobile Action / Status |
|---|---|---|---|
| **Dental Quotations List** | **YES** (`GET /api/opd/dental/quotations/patient/:patientId`) | **YES** (`PortalDentalQuotations.tsx`) | **Reuse**: Implement in `DentalApi` and `DentalQuotationsScreen` |
| **Quotation Details** | **YES** (`GET /api/opd/dental/quotations/:quotationId`) | **YES** (`PortalQuotationDetailModal.tsx`) | **Reuse**: Implement `DentalQuotationDetailsModal` |
| **Treatment / Procedure Details** | **YES** (`procedure_name`, `quantity`, `unit_price`, `discount_amount`, `tax_amount`, `line_total`) | **YES** | **Reuse**: Display itemized treatment procedure cards |
| **Tooth Information** | **YES** (`tooth_number`: FDI notation or single tooth) | **YES** | **Reuse**: Read-only display of tooth number / location |
| **Treatment Options** | **YES** (`options` array with sequence, subtotal, total) | **YES** | **Reuse**: Option selection and multi-plan display |
| **Quotation Status** | **YES** (`DRAFT`, `SENT`, `ACCEPTED`, `REJECTED`, `POSTPONED`, `EXPIRED`) | **YES** | **Reuse**: Exact status lifecycle badges and labels |
| **Quotation Amount & Breakdown** | **YES** (`subtotal`, `discount_amount`, `tax_amount`, `total`, `currency`) | **YES** | **Reuse**: Display authoritative currency amounts |
| **Patient Decision Actions** | **YES** (`/accept`, `/reject`, `/postpone`) | **YES** | **Reuse**: Patient decision actions with confirmation and notes |
| **Quotation PDF** | Client-side in Patient Web (`jspdf`) | **YES** (Web) | **Native Digital View**: Display complete itemized digital quotation on mobile |
| **Odontogram Editing / Clinical Examination** | Hospital OPD Staff Only | Excluded | **Excluded**: Mobile app remains patient read-only/decision only |

---

## 4. Security & Safety Invariants

1. **Patient Isolation**: All document queries and dental quotation queries strictly mandate the active `patient_id`. Context switching clears all active lists, selected items, modals, and cached data immediately.
2. **Read-Only Clinical Boundaries**: No mobile endpoints for creating clinical dental diagnoses, odontograms, or doctor prescriptions.
3. **Safe File Handling**: No credentials, private bucket names, internal file paths, or bearer tokens are ever exposed in user-facing logs or persistent storage.
