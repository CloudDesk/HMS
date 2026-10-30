import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OphthalmologyLabOrdersSection } from './OphthalmologyLabOrdersSection';
import { OphthalmologyImagingOrdersSection } from './OphthalmologyImagingOrdersSection';
import type { LabOrderItem } from '../opd/OpdLabSection';
import type { ImagingOrderItem } from '../opd/OpdImagingSection';

describe('Ophthalmology Orders Sections (Screens 3B & 3C)', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  describe('OphthalmologyLabOrdersSection (Screen 3B)', () => {
    it('renders the 2-column layout, header, 4 config dropdowns, chips, search, and summary panel', async () => {
      const handleToggle = vi.fn();
      const handleSubmit = vi.fn();
      const saveDraft = vi.fn();
      const labOrders: LabOrderItem[] = [
        {
          id: '507f1f77bcf86cd799439011',
          name: 'Pre-Operative Cataract / Retinal Clearance (CBC, PT/INR, Electrolytes)',
          local_id: 'order-1',
          category: 'Pre-Operative',
        },
      ];

      await act(async () => {
        root.render(
          <OphthalmologyLabOrdersSection
            labPriority="ROUTINE"
            setLabPriority={vi.fn()}
            labFacility="Main Branch - Laboratory"
            setLabFacility={vi.fn()}
            labFacilities={['Main Branch - Laboratory']}
            labSampleType="All Sample Types"
            setLabSampleType={vi.fn()}
            labSampleTypeOptions={['All Sample Types', 'Blood']}
            labCategory="All Categories"
            setLabCategory={vi.fn()}
            labCategoryOptions={['All Categories']}
            availableLabTests={[]}
            labOrders={labOrders}
            setLabOrders={vi.fn()}
            handleToggleLabTest={handleToggle}
            labSearchQuery=""
            setLabSearchQuery={vi.fn()}
            labClinicalNotes=""
            setLabClinicalNotes={vi.fn()}
            labOrderSummary=""
            setLabOrderSummary={vi.fn()}
            saveConsultationDraft={saveDraft}
            handleNextStep={vi.fn()}
            handleSubmitLabOrder={handleSubmit}
            isSubmitting={false}
            canEdit={true}
          />,
        );
      });

      expect(container.textContent).toContain('Laboratory orders');
      expect(container.textContent).toContain('Select tests for this patient.');
      expect(container.textContent).toContain('Priority');
      expect(container.textContent).toContain('Laboratory');
      expect(container.textContent).toContain('Sample type');
      expect(container.textContent).toContain('Category');

      // Chips
      expect(container.textContent).toContain('All tests');
      expect(container.textContent).toContain('Commonly used');
      expect(container.textContent).toContain('Pre-operative');

      // Summary Panel
      expect(container.querySelector('.oph-summary-header')?.textContent).toContain('Order summary');
      expect(container.querySelector('.oph-summary-header .oph-order-status')?.textContent).toBe('1');
      expect(container.textContent).toContain('Pre-Operative Cataract / Retinal Clearance');

      // Submit Button
      const submitBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Submit order'),
      );
      expect(submitBtn).toBeDefined();
      expect(submitBtn?.disabled).toBe(false);

      await act(async () => {
        submitBtn?.click();
      });
      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });

    it('allows toggling configured lab test card with valid ObjectId', async () => {
      const handleToggle = vi.fn();
      const mockTest = {
        id: '507f1f77bcf86cd799439011',
        code: 'LAB-CATARACT-RET',
        name: 'Pre-Operative Cataract / Retinal Clearance (CBC, PT/INR, Electrolytes)',
        service_type: 'LAB_TEST' as const,
        category: 'Pre-Operative',
        sample_type: 'Whole Blood / Serum / Plasma',
        description: 'Pre-Operative Cataract clearance',
        department_id: '507f1f77bcf86cd799439012',
        standard_price: 150,
        default_duration_minutes: 15,
        booking_capacity: 10,
        requires_bed: false,
        requires_consent: false,
        requires_advance_deposit: false,
        minimum_advance_deposit_amount: null,
        status: 'ACTIVE' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: null,
        updated_by: null,
      };

      await act(async () => {
        root.render(
          <OphthalmologyLabOrdersSection
            labPriority="ROUTINE"
            setLabPriority={vi.fn()}
            labFacility="Main Branch - Laboratory"
            setLabFacility={vi.fn()}
            labFacilities={['Main Branch - Laboratory']}
            labSampleType="All Sample Types"
            setLabSampleType={vi.fn()}
            labSampleTypeOptions={['All Sample Types']}
            labCategory="All Categories"
            setLabCategory={vi.fn()}
            labCategoryOptions={['All Categories']}
            availableLabTests={[mockTest]}
            labOrders={[]}
            setLabOrders={vi.fn()}
            handleToggleLabTest={handleToggle}
            labSearchQuery=""
            setLabSearchQuery={vi.fn()}
            labClinicalNotes=""
            setLabClinicalNotes={vi.fn()}
            labOrderSummary=""
            setLabOrderSummary={vi.fn()}
            saveConsultationDraft={vi.fn()}
            handleNextStep={vi.fn()}
            isSubmitting={false}
            canEdit={true}
          />,
        );
      });

      const cards = container.querySelectorAll('.oph-test-card');
      expect(cards.length).toBeGreaterThan(0);

      await act(async () => {
        (cards[0] as HTMLElement).click();
      });

      expect(handleToggle).toHaveBeenCalledTimes(1);
      expect(handleToggle).toHaveBeenCalledWith(
        expect.objectContaining({ id: '507f1f77bcf86cd799439011' }),
      );
    });

    it('prevents selecting unconfigured lab test and does not toggle or submit fake ID', async () => {
      const handleToggle = vi.fn();

      await act(async () => {
        root.render(
          <OphthalmologyLabOrdersSection
            labPriority="ROUTINE"
            setLabPriority={vi.fn()}
            labFacility="Main Branch - Laboratory"
            setLabFacility={vi.fn()}
            labFacilities={['Main Branch - Laboratory']}
            labSampleType="All Sample Types"
            setLabSampleType={vi.fn()}
            labSampleTypeOptions={['All Sample Types']}
            labCategory="All Categories"
            setLabCategory={vi.fn()}
            labCategoryOptions={['All Categories']}
            availableLabTests={[]}
            labOrders={[]}
            setLabOrders={vi.fn()}
            handleToggleLabTest={handleToggle}
            labSearchQuery=""
            setLabSearchQuery={vi.fn()}
            labClinicalNotes=""
            setLabClinicalNotes={vi.fn()}
            labOrderSummary=""
            setLabOrderSummary={vi.fn()}
            saveConsultationDraft={vi.fn()}
            handleNextStep={vi.fn()}
            isSubmitting={false}
            canEdit={true}
          />,
        );
      });

      const unconfiguredCards = container.querySelectorAll('.oph-test-card.unconfigured');
      expect(unconfiguredCards.length).toBeGreaterThan(0);
      expect(container.textContent).toContain('Not Configured');

      await act(async () => {
        (unconfiguredCards[0] as HTMLElement).click();
      });

      expect(handleToggle).not.toHaveBeenCalled();
    });
  });

  describe('OphthalmologyImagingOrdersSection (Screen 3C)', () => {
    it('renders the 2-column layout, header, 2 config dropdowns, modality chips, search, and summary panel', async () => {
      const handleToggle = vi.fn();
      const handleSubmit = vi.fn();
      const saveDraft = vi.fn();
      const imagingOrders: ImagingOrderItem[] = [
        {
          id: 'img-cat-01',
          name: 'Anterior Segment OCT (AS-OCT) — Iridocorneal Angle & Flap Assessment',
          local_id: 'order-img-1',
          category: 'Ophthalmic Tomography & Diagnostics',
        },
      ];

      await act(async () => {
        root.render(
          <OphthalmologyImagingOrdersSection
            imagingPriority="ROUTINE"
            setImagingPriority={vi.fn()}
            imagingCategory="Modalities"
            setImagingCategory={vi.fn()}
            imagingCategoryOptions={['Modalities']}
            availableImagingTests={[]}
            imagingOrders={imagingOrders}
            setImagingOrders={vi.fn()}
            handleToggleImagingTest={handleToggle}
            imagingSearchQuery=""
            setImagingSearchQuery={vi.fn()}
            imagingClinicalInfo=""
            setImagingClinicalInfo={vi.fn()}
            imagingOrderInstructions=""
            setImagingOrderInstructions={vi.fn()}
            saveConsultationDraft={saveDraft}
            handleNextStep={vi.fn()}
            handleSubmitImagingOrder={handleSubmit}
            isSubmitting={false}
            canEdit={true}
          />,
        );
      });

      expect(container.textContent).toContain('Imaging & radiology requisition');
      expect(container.textContent).toContain('Order scans for this patient.');
      expect(container.textContent).toContain('Priority');
      expect(container.textContent).toContain('Imaging category');

      // Modality Chips
      expect(container.textContent).toContain('All Scans');
      expect(container.textContent).toContain('Ophthalmic Imaging');
      expect(container.textContent).toContain('Systemic Imaging');

      // Summary Panel
      expect(container.querySelector('.oph-summary-header')?.textContent).toContain('Order summary');
      expect(container.querySelector('.oph-summary-header .oph-order-status')?.textContent).toBe('1');
      expect(container.textContent).toContain('Anterior Segment OCT (AS-OCT)');

      // Submit Button
      const submitBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Submit Imaging Order'),
      );
      expect(submitBtn).toBeDefined();
      expect(submitBtn?.disabled).toBe(false);

      await act(async () => {
        submitBtn?.click();
      });
      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });

    it('allows toggling available imaging test card', async () => {
      const handleToggle = vi.fn();

      await act(async () => {
        root.render(
          <OphthalmologyImagingOrdersSection
            imagingPriority="ROUTINE"
            setImagingPriority={vi.fn()}
            imagingCategory="Modalities"
            setImagingCategory={vi.fn()}
            imagingCategoryOptions={['Modalities']}
            availableImagingTests={[]}
            imagingOrders={[]}
            setImagingOrders={vi.fn()}
            handleToggleImagingTest={handleToggle}
            imagingSearchQuery=""
            setImagingSearchQuery={vi.fn()}
            imagingClinicalInfo=""
            setImagingClinicalInfo={vi.fn()}
            imagingOrderInstructions=""
            setImagingOrderInstructions={vi.fn()}
            saveConsultationDraft={vi.fn()}
            handleNextStep={vi.fn()}
            isSubmitting={false}
            canEdit={true}
          />,
        );
      });

      const cards = container.querySelectorAll('.oph-test-card');
      expect(cards.length).toBeGreaterThan(0);

      await act(async () => {
        (cards[0] as HTMLElement).click();
      });

      expect(handleToggle).toHaveBeenCalledTimes(1);
    });
  });
});
