// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OpdConsultationSection,
  type ConsultationFormState,
  type OpdConsultationSectionProps,
} from './OpdConsultationSection';

describe('OpdConsultationSection Component', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    root = null;
  });

  const defaultFormState: ConsultationFormState = {
    chief_complaint: 'Tooth pain in lower right jaw',
    history_present_illness: 'Started 3 days ago, worsening with cold drinks',
    past_history: 'Hypertension',
    family_history: 'Diabetes',
    allergies: 'Penicillin',
    physical_examination: '',
    assessment: '',
    doctor_notes: '',
  };

  const renderComponent = (props: Partial<OpdConsultationSectionProps> = {}) => {
    const defaultProps: OpdConsultationSectionProps = {
      consultationForm: defaultFormState,
      setConsultationForm: vi.fn(),
      saveConsultationDraft: vi.fn(),
      handleNextStep: vi.fn(),
      canEdit: true,
      nextTab: 'Dental Examination',
      ...props,
    };

    act(() => {
      root!.render(<OpdConsultationSection {...defaultProps} />);
    });

    return defaultProps;
  };

  it('renders Clinical History section with all fields', () => {
    renderComponent();

    expect(container?.textContent).toContain('Clinical History');
    expect(container?.textContent).toContain('Chief Complaint');
    expect(container?.textContent).toContain('History of Present Illness');
    expect(container?.textContent).toContain('Past Medical History');
    expect(container?.textContent).toContain('Family History');
    expect(container?.textContent).toContain('Allergies / Sensitivities');

    const chiefComplaint = container?.querySelector('#chief-complaint') as HTMLTextAreaElement;
    expect(chiefComplaint).toBeTruthy();
    expect(chiefComplaint.value).toBe('Tooth pain in lower right jaw');
  });

  it('does NOT render Examination & Assessment section or textareas', () => {
    renderComponent();

    expect(container?.textContent).not.toContain('Examination & Assessment');
    expect(container?.textContent).not.toContain('Physical Examination');
    expect(container?.textContent).not.toContain('Assessment / Impression');

    expect(container?.querySelector('#physical-examination')).toBeNull();
    expect(container?.querySelector('#assessment')).toBeNull();
  });

  it('renders bottom actions and triggers handlers', () => {
    const props = renderComponent();

    expect(container?.textContent).toContain('Auto-save enabled');
    expect(container?.textContent).toContain('Save Draft');
    expect(container?.textContent).toContain('Next: Dental Examination');

    const saveBtn = Array.from(container?.querySelectorAll('button') || []).find((btn) =>
      btn.textContent?.includes('Save Draft')
    );
    expect(saveBtn).toBeTruthy();
    act(() => {
      saveBtn?.click();
    });
    expect(props.saveConsultationDraft).toHaveBeenCalled();

    const nextBtn = Array.from(container?.querySelectorAll('button') || []).find((btn) =>
      btn.textContent?.includes('Next: Dental Examination')
    );
    expect(nextBtn).toBeTruthy();
    act(() => {
      nextBtn?.click();
    });
    expect(props.handleNextStep).toHaveBeenCalledWith('Dental Examination');
  });
});
