import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpdPrescriptionSection, type OpdPrescriptionSectionProps } from './OpdPrescriptionSection';

describe('OPD stock availability display', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => { container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
  const medication = { medicine_name: '', strength: '', dosage: '', route: '', frequency: '', duration: '', quantity: '', instructions: '' };
  const props: OpdPrescriptionSectionProps = {
    selectedDiagnoses: [], setActiveTab: vi.fn(), masterMedicines: [], medicationForm: medication,
    setMedicationForm: vi.fn(), prescriptionForm: { items: [], follow_up_date: '', doctor_instructions: '', patient_instructions: '' },
    setPrescriptionForm: vi.fn(), emptyMedicationForm: medication, showToast: vi.fn(), saveConsultationDraft: vi.fn(),
    handleSendToPharmacy: vi.fn(), updating: '', handleNextStep: vi.fn(), canEdit: true,
  };
  it('distinguishes unknown inventory from an authoritative zero quantity', async () => {
    await act(async () => root.render(<OpdPrescriptionSection {...props} masterMedicines={[
      { id: 'unknown', name: 'Unknown stock medicine', available_quantity: null, unit: 'tablets' },
      { id: 'empty', name: 'Zero stock medicine', available_quantity: 0, unit: 'tablets' },
    ]} />));
    expect(container.querySelector('option[value="Unknown stock medicine"]')?.textContent).toContain('Stock unavailable');
    expect(container.querySelector('option[value="Zero stock medicine"]')?.textContent).toContain('0 tablets');
    expect(container.textContent).not.toContain('Auto-save enabled');
  });
});
