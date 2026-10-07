// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpdLabSection, type OpdLabSectionProps } from './OpdLabSection';
import { OpdImagingSection, type OpdImagingSectionProps } from './OpdImagingSection';

describe('OpdLabSection & OpdImagingSection Buttons', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
  });

  describe('OpdLabSection Send To Laboratory button', () => {
    const defaultLabProps: OpdLabSectionProps = {
      labPriority: 'ROUTINE',
      setLabPriority: vi.fn(),
      labFacility: 'Main Branch - Laboratory',
      setLabFacility: vi.fn(),
      labFacilities: ['Main Branch - Laboratory'],
      labSampleType: 'Blood',
      setLabSampleType: vi.fn(),
      labSampleTypeOptions: ['Blood'],
      labCategory: 'All',
      setLabCategory: vi.fn(),
      labCategoryOptions: ['All'],
      availableLabTests: [],
      labOrders: [{ id: 'srv-1', name: 'CBC', local_id: 'l-1', category: 'Hematology' }],
      setLabOrders: vi.fn(),
      handleToggleLabTest: vi.fn(),
      labSearchQuery: '',
      setLabSearchQuery: vi.fn(),
      labClinicalNotes: '',
      setLabClinicalNotes: vi.fn(),
      labOrderSummary: '',
      setLabOrderSummary: vi.fn(),
      saveConsultationDraft: vi.fn(),
      handleNextStep: vi.fn(),
      canEdit: true,
      handleSendToLaboratory: vi.fn(),
      isSentToLaboratory: false,
    };

    it('renders [ Send To Laboratory ] button and triggers handler on click', () => {
      const handleSend = vi.fn();
      act(() => {
        root?.render(<OpdLabSection {...defaultLabProps} handleSendToLaboratory={handleSend} />);
      });

      const buttons = Array.from(container?.querySelectorAll('button') || []);
      const sendBtn = buttons.find((btn) => btn.textContent?.includes('Send To Laboratory'));
      expect(sendBtn).toBeDefined();
      expect(sendBtn?.disabled).toBe(false);

      act(() => {
        sendBtn?.click();
      });
      expect(handleSend).toHaveBeenCalledTimes(1);
    });

    it('renders disabled [ Sent To Laboratory ] with checkmark and sent-disabled styling when isSentToLaboratory is true', () => {
      act(() => {
        root?.render(<OpdLabSection {...defaultLabProps} isSentToLaboratory={true} />);
      });

      const buttons = Array.from(container?.querySelectorAll('button') || []);
      const sentBtn = buttons.find((btn) => btn.textContent?.includes('Sent To Laboratory'));
      expect(sentBtn).toBeDefined();
      expect(sentBtn?.disabled).toBe(true);
      expect(sentBtn?.classList.contains('sent-disabled')).toBe(true);
      expect(sentBtn?.querySelector('.ph-check-circle')).toBeDefined();
    });
  });

  describe('OpdImagingSection Send To Imaging button', () => {
    const defaultImagingProps: OpdImagingSectionProps = {
      imagingPriority: 'ROUTINE',
      setImagingPriority: vi.fn(),
      imagingCategory: 'All',
      setImagingCategory: vi.fn(),
      imagingCategoryOptions: ['All'],
      availableImagingTests: [],
      imagingOrders: [{ id: 'srv-2', name: 'Chest X-Ray', local_id: 'i-1', category: 'X-Ray' }],
      setImagingOrders: vi.fn(),
      handleToggleImagingTest: vi.fn(),
      imagingSearchQuery: '',
      setImagingSearchQuery: vi.fn(),
      imagingClinicalInfo: '',
      setImagingClinicalInfo: vi.fn(),
      imagingOrderInstructions: '',
      setImagingOrderInstructions: vi.fn(),
      saveConsultationDraft: vi.fn(),
      handleNextStep: vi.fn(),
      canEdit: true,
      handleSendToImaging: vi.fn(),
      isSentToImaging: false,
    };

    it('renders [ Send To Imaging ] button and triggers handler on click', () => {
      const handleSend = vi.fn();
      act(() => {
        root?.render(<OpdImagingSection {...defaultImagingProps} handleSendToImaging={handleSend} />);
      });

      const buttons = Array.from(container?.querySelectorAll('button') || []);
      const sendBtn = buttons.find((btn) => btn.textContent?.includes('Send To Imaging'));
      expect(sendBtn).toBeDefined();
      expect(sendBtn?.disabled).toBe(false);

      act(() => {
        sendBtn?.click();
      });
      expect(handleSend).toHaveBeenCalledTimes(1);
    });

    it('renders disabled [ Sent To Imaging ] with checkmark and sent-disabled styling when isSentToImaging is true', () => {
      act(() => {
        root?.render(<OpdImagingSection {...defaultImagingProps} isSentToImaging={true} />);
      });

      const buttons = Array.from(container?.querySelectorAll('button') || []);
      const sentBtn = buttons.find((btn) => btn.textContent?.includes('Sent To Imaging'));
      expect(sentBtn).toBeDefined();
      expect(sentBtn?.disabled).toBe(true);
      expect(sentBtn?.classList.contains('sent-disabled')).toBe(true);
      expect(sentBtn?.querySelector('.ph-check-circle')).toBeDefined();
    });
  });
});
