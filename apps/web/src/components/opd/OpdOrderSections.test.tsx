import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpdLabSection, type LabOrderItem } from './OpdLabSection';
import { OpdImagingSection, type ImagingOrderItem } from './OpdImagingSection';

describe('OpdOrderSections - Phase 3 downstream submission controls', () => {
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

  describe('OpdLabSection', () => {
    it('renders Submit Laboratory Order button when handleSubmitLabOrder is provided', async () => {
      const handleSubmit = vi.fn();
      const labOrders: LabOrderItem[] = [
        { id: 'lab-1', name: 'Serum Creatinine', local_id: 'CREAT', category: 'BIOCHEMISTRY' },
      ];

      await act(async () => {
        root.render(
          <OpdLabSection
            labPriority="ROUTINE"
            setLabPriority={vi.fn()}
            labFacility="Main Lab"
            setLabFacility={vi.fn()}
            labFacilities={['Main Lab']}
            labSampleType="BLOOD"
            setLabSampleType={vi.fn()}
            labSampleTypeOptions={['BLOOD']}
            labCategory="BIOCHEMISTRY"
            setLabCategory={vi.fn()}
            labCategoryOptions={['BIOCHEMISTRY']}
            availableLabTests={[]}
            labOrders={labOrders}
            setLabOrders={vi.fn()}
            handleToggleLabTest={vi.fn()}
            labSearchQuery=""
            setLabSearchQuery={vi.fn()}
            labClinicalNotes=""
            setLabClinicalNotes={vi.fn()}
            labOrderSummary=""
            setLabOrderSummary={vi.fn()}
            saveConsultationDraft={vi.fn()}
            handleNextStep={vi.fn()}
            handleSubmitLabOrder={handleSubmit}
            isSubmitting={false}
            canEdit={true}
          />
        );
      });

      const submitButton = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('Submit Laboratory Order')
      );
      expect(submitButton).toBeDefined();
      expect(submitButton?.textContent).toContain('(1)');
      expect(submitButton?.disabled).toBe(false);

      await act(async () => {
        submitButton?.click();
      });

      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });

    it('disables submit button and shows loading spinner when isSubmitting is true', async () => {
      const handleSubmit = vi.fn();
      const labOrders: LabOrderItem[] = [
        { id: 'lab-1', name: 'Serum Creatinine', local_id: 'CREAT' },
      ];

      await act(async () => {
        root.render(
          <OpdLabSection
            labPriority="ROUTINE"
            setLabPriority={vi.fn()}
            labFacility="Main Lab"
            setLabFacility={vi.fn()}
            labFacilities={['Main Lab']}
            labSampleType="BLOOD"
            setLabSampleType={vi.fn()}
            labSampleTypeOptions={['BLOOD']}
            labCategory="BIOCHEMISTRY"
            setLabCategory={vi.fn()}
            labCategoryOptions={['BIOCHEMISTRY']}
            availableLabTests={[]}
            labOrders={labOrders}
            setLabOrders={vi.fn()}
            handleToggleLabTest={vi.fn()}
            labSearchQuery=""
            setLabSearchQuery={vi.fn()}
            labClinicalNotes=""
            setLabClinicalNotes={vi.fn()}
            labOrderSummary=""
            setLabOrderSummary={vi.fn()}
            saveConsultationDraft={vi.fn()}
            handleNextStep={vi.fn()}
            handleSubmitLabOrder={handleSubmit}
            isSubmitting={true}
            canEdit={true}
          />
        );
      });

      const submitButton = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('Submitting...')
      );
      expect(submitButton).toBeDefined();
      expect(submitButton?.disabled).toBe(true);
    });

    it('disables submit button when labOrders list is empty', async () => {
      const handleSubmit = vi.fn();

      await act(async () => {
        root.render(
          <OpdLabSection
            labPriority="ROUTINE"
            setLabPriority={vi.fn()}
            labFacility="Main Lab"
            setLabFacility={vi.fn()}
            labFacilities={['Main Lab']}
            labSampleType="BLOOD"
            setLabSampleType={vi.fn()}
            labSampleTypeOptions={['BLOOD']}
            labCategory="BIOCHEMISTRY"
            setLabCategory={vi.fn()}
            labCategoryOptions={['BIOCHEMISTRY']}
            availableLabTests={[]}
            labOrders={[]}
            setLabOrders={vi.fn()}
            handleToggleLabTest={vi.fn()}
            labSearchQuery=""
            setLabSearchQuery={vi.fn()}
            labClinicalNotes=""
            setLabClinicalNotes={vi.fn()}
            labOrderSummary=""
            setLabOrderSummary={vi.fn()}
            saveConsultationDraft={vi.fn()}
            handleNextStep={vi.fn()}
            handleSubmitLabOrder={handleSubmit}
            isSubmitting={false}
            canEdit={true}
          />
        );
      });

      const submitButton = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('Submit Laboratory Order')
      );
      expect(submitButton).toBeDefined();
      expect(submitButton?.disabled).toBe(true);
    });
  });

  describe('OpdImagingSection', () => {
    it('renders Submit Imaging Order button when handleSubmitImagingOrder is provided', async () => {
      const handleSubmit = vi.fn();
      const imagingOrders: ImagingOrderItem[] = [
        { id: 'img-1', name: 'OCT Macula', local_id: 'OCT-MAC', category: 'OPHTHALMOLOGY' },
      ];

      await act(async () => {
        root.render(
          <OpdImagingSection
            imagingPriority="ROUTINE"
            setImagingPriority={vi.fn()}
            imagingCategory="OPHTHALMOLOGY"
            setImagingCategory={vi.fn()}
            imagingCategoryOptions={['OPHTHALMOLOGY']}
            availableImagingTests={[]}
            imagingOrders={imagingOrders}
            setImagingOrders={vi.fn()}
            handleToggleImagingTest={vi.fn()}
            imagingSearchQuery=""
            setImagingSearchQuery={vi.fn()}
            imagingClinicalInfo=""
            setImagingClinicalInfo={vi.fn()}
            imagingOrderInstructions=""
            setImagingOrderInstructions={vi.fn()}
            saveConsultationDraft={vi.fn()}
            handleNextStep={vi.fn()}
            handleSubmitImagingOrder={handleSubmit}
            isSubmitting={false}
            canEdit={true}
          />
        );
      });

      const submitButton = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('Submit Imaging Order')
      );
      expect(submitButton).toBeDefined();
      expect(submitButton?.textContent).toContain('(1)');
      expect(submitButton?.disabled).toBe(false);

      await act(async () => {
        submitButton?.click();
      });

      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });

    it('disables submit button and shows loading spinner when isSubmitting is true', async () => {
      const handleSubmit = vi.fn();
      const imagingOrders: ImagingOrderItem[] = [
        { id: 'img-1', name: 'OCT Macula', local_id: 'OCT-MAC' },
      ];

      await act(async () => {
        root.render(
          <OpdImagingSection
            imagingPriority="ROUTINE"
            setImagingPriority={vi.fn()}
            imagingCategory="OPHTHALMOLOGY"
            setImagingCategory={vi.fn()}
            imagingCategoryOptions={['OPHTHALMOLOGY']}
            availableImagingTests={[]}
            imagingOrders={imagingOrders}
            setImagingOrders={vi.fn()}
            handleToggleImagingTest={vi.fn()}
            imagingSearchQuery=""
            setImagingSearchQuery={vi.fn()}
            imagingClinicalInfo=""
            setImagingClinicalInfo={vi.fn()}
            imagingOrderInstructions=""
            setImagingOrderInstructions={vi.fn()}
            saveConsultationDraft={vi.fn()}
            handleNextStep={vi.fn()}
            handleSubmitImagingOrder={handleSubmit}
            isSubmitting={true}
            canEdit={true}
          />
        );
      });

      const submitButton = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('Submitting...')
      );
      expect(submitButton).toBeDefined();
      expect(submitButton?.disabled).toBe(true);
    });

    it('disables submit button when imagingOrders list is empty', async () => {
      const handleSubmit = vi.fn();

      await act(async () => {
        root.render(
          <OpdImagingSection
            imagingPriority="ROUTINE"
            setImagingPriority={vi.fn()}
            imagingCategory="OPHTHALMOLOGY"
            setImagingCategory={vi.fn()}
            imagingCategoryOptions={['OPHTHALMOLOGY']}
            availableImagingTests={[]}
            imagingOrders={[]}
            setImagingOrders={vi.fn()}
            handleToggleImagingTest={vi.fn()}
            imagingSearchQuery=""
            setImagingSearchQuery={vi.fn()}
            imagingClinicalInfo=""
            setImagingClinicalInfo={vi.fn()}
            imagingOrderInstructions=""
            setImagingOrderInstructions={vi.fn()}
            saveConsultationDraft={vi.fn()}
            handleNextStep={vi.fn()}
            handleSubmitImagingOrder={handleSubmit}
            isSubmitting={false}
            canEdit={true}
          />
        );
      });

      const submitButton = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('Submit Imaging Order')
      );
      expect(submitButton).toBeDefined();
      expect(submitButton?.disabled).toBe(true);
    });
  });
});
