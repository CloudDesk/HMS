import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadDentalStagesPdf, downloadDentalQuotationPdf } from './dental-pdf';
import type { DentalTreatmentPlanItem, DentalTreatmentStageResponse, DentalTreatmentQuotationResponse } from '../api/opd';

const mockSave = vi.fn();
const mockText = vi.fn();
const mockLine = vi.fn();
const mockRect = vi.fn();
const mockRoundedRect = vi.fn();
const mockAddPage = vi.fn();
const mockSplitTextToSize = vi.fn((text: string) => [text]);

vi.mock('jspdf', () => {
  return {
    jsPDF: class {
      save = mockSave;
      text = mockText;
      line = mockLine;
      rect = mockRect;
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

describe('Dental PDF Generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates real PDF for Dental Treatment Stages with expected filename format', () => {
    const item: DentalTreatmentPlanItem = {
      id: 'plan-1',
      tooth_number: 12,
      procedure_name: 'Composite Restoration',
      status: 'ACCEPTED',
    };

    const stages: DentalTreatmentStageResponse[] = [
      {
        id: 'stage-1',
        episode_id: 'ep-1',
        plan_item_id: 'plan-1',
        tooth_number: 12,
        stage_name: 'Cavity Preparation',
        sequence: 1,
        assigned_doctor_id: 'doc-1',
        assigned_doctor_name: 'Dr. Anderson James',
        status: 'COMPLETED',
        branch_id: 'b-1',
        department_id: 'd-1',
        patient_id: 'pat-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'stage-2',
        episode_id: 'ep-1',
        plan_item_id: 'plan-1',
        tooth_number: 12,
        stage_name: 'Composite Placement & Curing',
        sequence: 2,
        assigned_doctor_id: 'doc-1',
        assigned_doctor_name: 'Dr. Anderson James',
        status: 'PLANNED',
        branch_id: 'b-1',
        department_id: 'd-1',
        patient_id: 'pat-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    downloadDentalStagesPdf({
      item,
      stages,
      patientName: 'John Doe',
      patientId: 'PAT-001',
      episodeNumber: 'DTE-2026-00002',
    });

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith('HMS_Dental_Treatment_Stages_Tooth_12.pdf');
  });

  it('generates real PDF for Dental Treatment Quotations with expected filename format', () => {
    const quotation: DentalTreatmentQuotationResponse = {
      id: 'quote-1',
      quotation_number: 'DTQ-2026-00006',
      patient_id: 'pat-1',
      patient_number: 'PAT-001',
      patient_name: 'John Doe',
      treatment_episode_id: 'ep-1',
      treatment_episode_number: 'DTE-2026-00002',
      doctor_id: 'doc-1',
      doctor_name: 'Dr. Anderson James',
      status: 'ACCEPTED',
      selected_option_id: 'opt-1',
      subtotal: 3500,
      discount_amount: 0,
      tax_amount: 0,
      total: 3500,
      currency: 'KES',
      items: [
        {
          procedure_name: 'Composite Restoration',
          tooth_number: 12,
          quantity: 1,
          unit_price: 3500,
          discount_amount: 0,
          tax_amount: 0,
          line_total: 3500,
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
              procedure_name: 'Composite Restoration',
              tooth_number: 12,
              quantity: 1,
              unit_price: 3500,
              discount_amount: 0,
              tax_amount: 0,
              line_total: 3500,
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

    downloadDentalQuotationPdf({
      quotation,
      patientName: 'John Doe',
      patientId: 'PAT-001',
      episodeNumber: 'DTE-2026-00002',
      formatCurrency: (val) => `KES ${val.toFixed(2)}`,
    });

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith('HMS_Dental_Quotation_DTQ-2026-00006.pdf');
  });
});
