// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ICD10_DIAGNOSES, type Icd10Diagnosis } from '../../data/icd10-diagnoses';
import { OpdDiagnosisTab, type OpdDiagnosisTabProps } from './OpdDiagnosisTab';

describe('OpdDiagnosisTab Component', () => {
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

  const renderComponent = (props: Partial<OpdDiagnosisTabProps> = {}) => {
    const defaultProps: OpdDiagnosisTabProps = {
      dxSearchTerm: '',
      setDxSearchTerm: vi.fn(),
      filteredIcd10: ICD10_DIAGNOSES.slice(0, 5),
      selectedDiagnoses: [],
      handleAddDiagnosis: vi.fn(),
      handleRemoveDiagnosis: vi.fn(),
      assessment: '',
      onAssessmentChange: vi.fn(),
      onSaveDraft: vi.fn(),
      onNext: vi.fn(),
      canEdit: true,
      showToast: vi.fn(),
      isDental: false,
      ...props,
    };

    act(() => {
      root!.render(<OpdDiagnosisTab {...defaultProps} />);
    });

    return defaultProps;
  };

  it('renders standard diagnosis search for non-dental visits without tooth selector', () => {
    renderComponent({ isDental: false });
    expect(container?.textContent).toContain('Diagnosis Search');
    expect(container?.textContent).toContain('Search ICD-10 terminology and add diagnoses');
    expect(container?.querySelector('#dx-tooth-select')).toBeNull();
  });

  it('renders dental diagnosis search with tooth selector when isDental is true', () => {
    renderComponent({ isDental: true });
    expect(container?.textContent).toContain('Search Dental ICD-10 terminology');
    const select = container?.querySelector('#dx-tooth-select') as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(select.innerHTML).toContain('General / Full Mouth');
    expect(select.innerHTML).toContain('Tooth #11');
    expect(select.innerHTML).toContain('Tooth #48');
    expect(select.innerHTML).toContain('Tooth #51');
  });

  it('calls handleAddDiagnosis with tooth_number when a tooth is selected in dental mode', () => {
    const handleAddDiagnosis = vi.fn();
    renderComponent({
      isDental: true,
      handleAddDiagnosis,
      filteredIcd10: [
        { code: 'K02.9', name: 'Dental caries, unspecified', category: 'Dental & Oral Health' },
      ],
    });

    const select = container?.querySelector('#dx-tooth-select') as HTMLSelectElement;
    act(() => {
      select.value = '16';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const addBtn = container?.querySelector('.opd-dx-result-item button') as HTMLButtonElement;
    expect(addBtn).not.toBeNull();
    act(() => {
      addBtn.click();
    });

    expect(handleAddDiagnosis).toHaveBeenCalledTimes(1);
    expect(handleAddDiagnosis).toHaveBeenCalledWith({
      code: 'K02.9',
      name: 'Dental caries, unspecified',
      category: 'Dental & Oral Health',
      tooth_number: 16,
    });
  });

  it('calls handleAddDiagnosis with tooth_number=null when General / Full Mouth is selected', () => {
    const handleAddDiagnosis = vi.fn();
    renderComponent({
      isDental: true,
      handleAddDiagnosis,
      filteredIcd10: [
        { code: 'K05.10', name: 'Chronic gingivitis, plaque induced', category: 'Dental & Oral Health' },
      ],
    });

    const addBtn = container?.querySelector('.opd-dx-result-item button') as HTMLButtonElement;
    act(() => {
      addBtn.click();
    });

    expect(handleAddDiagnosis).toHaveBeenCalledTimes(1);
    expect(handleAddDiagnosis).toHaveBeenCalledWith({
      code: 'K05.10',
      name: 'Chronic gingivitis, plaque induced',
      category: 'Dental & Oral Health',
      tooth_number: null,
    });
  });

  it('displays tooth tags correctly on selected diagnoses chips', () => {
    const selectedDiagnoses: Icd10Diagnosis[] = [
      {
        code: 'K02.9',
        name: 'Dental caries, unspecified',
        category: 'Dental & Oral Health',
        tooth_number: 26,
      },
      {
        code: 'K05.10',
        name: 'Chronic gingivitis',
        category: 'Dental & Oral Health',
        tooth_number: null,
      },
    ];

    renderComponent({
      isDental: true,
      selectedDiagnoses,
    });

    expect(container?.textContent).toContain('Tooth #26');
    expect(container?.textContent).toContain('General');
    expect(container?.textContent).toContain('K02.9');
    expect(container?.textContent).toContain('K05.10');
  });

  it('calls handleRemoveDiagnosis with code and tooth_number when remove button is clicked', () => {
    const handleRemoveDiagnosis = vi.fn();
    const selectedDiagnoses: Icd10Diagnosis[] = [
      {
        code: 'K02.9',
        name: 'Dental caries, unspecified',
        category: 'Dental & Oral Health',
        tooth_number: 16,
      },
    ];

    renderComponent({
      isDental: true,
      selectedDiagnoses,
      handleRemoveDiagnosis,
    });

    const removeBtn = container?.querySelector('.opd-dx-chip button') as HTMLButtonElement;
    expect(removeBtn).not.toBeNull();
    act(() => {
      removeBtn.click();
    });

    expect(handleRemoveDiagnosis).toHaveBeenCalledWith('K02.9', 16);
  });

  it('adds custom diagnosis with selected tooth in dental mode', () => {
    const handleAddDiagnosis = vi.fn();
    const setDxSearchTerm = vi.fn();
    const showToast = vi.fn();

    renderComponent({
      isDental: true,
      dxSearchTerm: 'Enamel Hypoplasia',
      filteredIcd10: [],
      handleAddDiagnosis,
      setDxSearchTerm,
      showToast,
    });

    const select = container?.querySelector('#dx-tooth-select') as HTMLSelectElement;
    act(() => {
      select.value = '11';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const customBtn = container?.querySelector('.opd-dx-results-list button') as HTMLButtonElement;
    expect(customBtn).not.toBeNull();
    act(() => {
      customBtn.click();
    });

    expect(handleAddDiagnosis).toHaveBeenCalledTimes(1);
    const addedDx = handleAddDiagnosis.mock.calls[0]![0] as Icd10Diagnosis;
    expect(addedDx.name).toBe('Enamel Hypoplasia');
    expect(addedDx.category).toBe('Dental & Oral Health');
    expect(addedDx.tooth_number).toBe(11);
    expect(setDxSearchTerm).toHaveBeenCalledWith('');
    expect(showToast).toHaveBeenCalled();
  });

  it('renders disabled state when canEdit is false (read-only for unauthorized users/completed visits)', () => {
    renderComponent({
      isDental: true,
      canEdit: false,
      selectedDiagnoses: [
        {
          code: 'K02.9',
          name: 'Dental caries, unspecified',
          category: 'Dental & Oral Health',
          tooth_number: 36,
        },
      ],
    });

    const select = container?.querySelector('#dx-tooth-select') as HTMLSelectElement;
    expect(select?.disabled).toBe(true);

    const input = container?.querySelector('#icd-search-input') as HTMLInputElement;
    expect(input?.disabled).toBe(true);

    const textarea = container?.querySelector('#diagnostic-reasoning') as HTMLTextAreaElement;
    expect(textarea?.disabled).toBe(true);

    // No remove button rendered when canEdit is false
    const removeBtn = container?.querySelector('.opd-dx-chip button');
    expect(removeBtn).toBeNull();
  });

  it('correctly handles same ICD-10 code on multiple teeth independently without collapsing', () => {
    const selectedDiagnoses: Icd10Diagnosis[] = [
      {
        code: 'K02.9',
        name: 'Dental caries, unspecified',
        category: 'Dental & Oral Health',
        tooth_number: 36,
      },
      {
        code: 'K02.9',
        name: 'Dental caries, unspecified',
        category: 'Dental & Oral Health',
        tooth_number: 46,
      },
    ];

    renderComponent({
      isDental: true,
      selectedDiagnoses,
    });

    const chips = container?.querySelectorAll('.opd-dx-chip');
    expect(chips?.length).toBe(2);
    expect(chips?.[0]?.textContent).toContain('Tooth #36');
    expect(chips?.[0]?.textContent).toContain('K02.9');
    expect(chips?.[1]?.textContent).toContain('Tooth #46');
    expect(chips?.[1]?.textContent).toContain('K02.9');
  });
});
