// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DentalHistory } from '../../../api/opd';
import { DentalHistorySection } from './DentalHistorySection';

describe('DentalHistorySection Header Alert Badge', () => {
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

  it('renders "3 Medical Alerts Active" badge with proper badge class and no hardcoded 26px circle class', () => {
    const historyWithAlerts: DentalHistory = {
      chief_complaint: 'Routine check',
      pain_scale: 0,
      bleeding_gums: false,
      sensitivity_hot_cold_sweet: false,
      bruxism: false,
      habits: [],
      medical_alerts: ['Hypertension', 'Diabetes Mellitus', 'Asthma'],
    };

    act(() => {
      root!.render(<DentalHistorySection history={historyWithAlerts} onChange={vi.fn()} />);
    });

    const headerText = container?.textContent ?? '';
    expect(headerText).toContain('3 Medical Alerts Active');

    // Find the badge element
    const badge = Array.from(container?.querySelectorAll('span') || []).find((s) =>
      s.textContent?.includes('3 Medical Alerts Active')
    );
    expect(badge).toBeTruthy();
    // It should use medicalAlertBadge and NOT statusBadgeDraft
    expect(badge?.className).toContain('medicalAlertBadge');
    expect(badge?.className).not.toContain('statusBadgeDraft');
  });

  it('renders allergy alert badge alongside medical alerts when allergies are present', () => {
    const historyWithAllergy: DentalHistory = {
      chief_complaint: 'Routine check',
      pain_scale: 0,
      bleeding_gums: false,
      sensitivity_hot_cold_sweet: false,
      bruxism: false,
      habits: [],
      medical_alerts: ['Allergy to Penicillin', 'Hypertension'],
    };

    act(() => {
      root!.render(<DentalHistorySection history={historyWithAllergy} onChange={vi.fn()} />);
    });

    const headerText = container?.textContent ?? '';
    expect(headerText).toContain('1 Allergy Alert');
    expect(headerText).toContain('2 Medical Alerts Active');

    const allergyBadge = Array.from(container?.querySelectorAll('span') || []).find((s) =>
      s.textContent?.includes('1 Allergy Alert')
    );
    expect(allergyBadge).toBeTruthy();
    expect(allergyBadge?.className).toContain('medicalAlertBadgeAllergy');
  });
});
