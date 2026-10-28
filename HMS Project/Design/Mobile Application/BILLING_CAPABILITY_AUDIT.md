# Phase 7 — Billing, Invoices & Payments Capability Audit

## 1. Executive Summary

This audit reviews the billing, invoice, and payment infrastructure available in the HMS backend for the Patient Portal (`@hms/patient-mobile`).

Per **HMS Patient Mobile Phase 7 Instructions (Sections 6, 21, and 33)**:
> "If no complete backend contract exists for online payment, DO NOT invent one. DO NOT create fake Razorpay/Stripe flows. Report: ONLINE PAYMENT NOT AVAILABLE IN CURRENT HMS PAYMENT CONTRACT."

## 2. Capability Matrix

| Feature / Capability | Supported in Backend Contract? | Endpoint / Method | Status for Mobile Phase 7 |
| :--- | :--- | :--- | :--- |
| **Invoice Summary List** | **YES** | `GET /api/patient-portal/overview?patient_id=<id>` | Fully implemented via `invoices` array in overview response |
| **Outstanding Invoices Count** | **YES** | `GET /api/patient-portal/overview?patient_id=<id>` | Fully implemented via `summary.outstanding_invoices` |
| **Invoice Details** | **YES** | `GET /api/patient-portal/patients/:patientId/invoices/:invoiceId` | Fully implemented with line items, branch, patient, and payments |
| **Line Items Breakdown** | **YES** | Embedded in invoice details (`items` array) | Service name, service type, quantity, unit rate, line total |
| **Payment History per Invoice** | **YES** | Embedded in invoice details (`payments` array) | Payment number, date, amount, method, reference number |
| **Financial Aggregates** | **YES** | Derived from authoritative invoice amounts | Total Billed, Total Paid, Total Amount Due |
| **Multi-Profile Context** | **YES** | Query param `patient_id` | Scoped strictly to active patient/dependent context |
| **Online Payment Gateway** | **NO** | None in `patient-portal` routes | **NOT AVAILABLE IN CURRENT HMS PAYMENT CONTRACT** |
| **Payment Order Creation** | **NO** | None in `patient-portal` routes | Invoices are settled at hospital billing desk |
| **Direct Receipt PDF Download** | **NO** (Native) | Web uses client-side DOM-to-canvas/PDF generator | Mobile renders complete digital itemized receipt view |
| **Dental Quotations** | Separate API | `GET /api/patient-portal/patients/:id/dental-quotations` | Separate clinical dental domain |
| **Insurance Claims / Refunds** | **NO** | None | Excluded from patient portal scope |

## 3. Financial Invariants & Safety Rules

1. **Authoritative Backend Data**: The mobile app must never perform manual tax, discount, or balance calculations to override backend values. All line item totals, taxes, discounts, and balances are displayed directly from the backend response.
2. **Read-Only Billing & Payments**: Hospital invoices and payment receipts are issued and recorded by the hospital billing department.
3. **Clear User Guidance**: When an invoice has an outstanding balance (`balance_amount > 0`), the user is advised to settle the balance at the hospital billing counter, with clear messaging that online payment is not currently enabled.
4. **Context Isolation**: Switching the active patient or dependent immediately purges stale financial and invoice state.
