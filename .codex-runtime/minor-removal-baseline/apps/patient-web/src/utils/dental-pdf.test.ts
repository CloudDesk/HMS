import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadPortalDentalQuotationPdf } from './dental-pdf';
import type { PortalDentalQuotation } from '../api/patient-portal';

const mockSave = vi.fn();
const mockText = vi.fn();
const mockLine = vi.fn();
const mockRoundedRect = vi.fn();
const mockAddPage = vi.fn();
const mockSplitTextToSize = vi.fn((text: string) => [text]);

vi.mock('jspdf', () => {
  return {
    jsPDF: class {
      save = mockSave;
      text = mockText;
      line = mockLine;
      roundedRect = mockRoundedRect;
      addPage = mockAddPage;
      splitTextToSize = mockSplitTextToSize;
      setTextColor = vi.fn();
      setFont = vi.fn();
      setFontSize = vi.fn();
      setDrawColor = vi.fn();
      setFillColor = vi.fn();
      setLineWidth = vi.fn();
    },
  };
});

describe('Patient Portal Dental PDF Generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates real PDF for patient dental quotation with expected filename format', () => {
    const quotation: PortalDentalQuotation = {
      id: 'quote-1',
      quotation_number: 'DTQ-2026-00006',
      patient_id: 'pat-1',
      patient_name: 'John Doe',
      patient_number: 'PAT-001',
      treatment_episode_id: 'ep-1',
      treatment_episode_number: 'DTE-2026-00002',
      doctor_id: 'doc-1',
      doctor_name: 'Dr. Anderson James',
      status: 'SENT',
      subtotal: 3500,
      discount_amount: 0,
      tax_amount: 0,
      total: 3500,
      currency: 'KES',
      selected_option_id: null,
      selected_option_name: null,
      accepted_at: null,
      accepted_by: null,
      decision_reason: null,
      decision_at: null,
      sent_at: null,
      sent_by: null,
      notes: null,
      valid_until: null,
      items: [
        {
          treatment_plan_item_id: 'tpi-1',
          service_id: 'srv-1',
          procedure_name: 'Composite Restoration',
          tooth_number: 12,
          quantity: 1,
          unit_price: 3500,
          discount_amount: 0,
          tax_amount: 0,
          line_total: 3500,
          notes: null,
        },
      ],
      options: [
        {
          id: 'opt-1',
          name: 'Composite Restoration Standard',
          description: 'Single tooth restoration',
          sequence: 1,
          items: [
            {
              treatment_plan_item_id: 'tpi-1',
              service_id: 'srv-1',
              procedure_name: 'Composite Restoration',
              tooth_number: 12,
              quantity: 1,
              unit_price: 3500,
              discount_amount: 0,
              tax_amount: 0,
              line_total: 3500,
              notes: null,
            },
          ],
          subtotal: 3500,
          discount_amount: 0,
          tax_amount: 0,
          total: 3500,
        },
      ],
      branch_id: 'b-1',
      department_id: 'd-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    downloadPortalDentalQuotationPdf({
      quotation,
      patientName: 'John Doe',
      patientId: 'PAT-001',
    });

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith('HMS_Dental_Quotation_DTQ-2026-00006.pdf');
  });
});
