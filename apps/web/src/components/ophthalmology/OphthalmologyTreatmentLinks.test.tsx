import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';

vi.mock('../../hooks/ophthalmology/useOphthalmologyTreatmentLinksFeature', () => ({
  useOphthalmologyTreatmentLinksFeature: (_workspace: unknown, open: boolean) => ({
    enabled: open, ready: open, invalid: false, query: { isLoading: false, isFetching: false, isError: false }, refresh: vi.fn(),
    data: { medication_prescriptions: [{ id: '111111111111111111111111', status: 'SUBMITTED' }],
      optical_prescription: { id: '222222222222222222222222', status: 'APPROVED' }, clinical_orders: [{ id: '333333333333333333333333', status: 'SUBMITTED', order_type: 'LABORATORY' }],
      procedure_recommendations: [{ id: '444444444444444444444444', status: 'ACTIVE' }], referrals: [{ id: '555555555555555555555555', status: 'SUBMITTED' }], follow_ups: [{ id: '666666666666666666666666', status: 'SCHEDULED' }] },
  }),
}));
import { OphthalmologyTreatmentLinks } from './OphthalmologyTreatmentLinks';

const base = {
  workspace: {} as ComponentProps<typeof OphthalmologyTreatmentLinks>['workspace'],
  values: { medication_prescription_id: null, optical_prescription_id: null, clinical_order_ids: [], procedure_recommendation_id: null, referral_id: null, follow_up_id: null },
  onSelect: vi.fn(), onOrders: vi.fn(),
};

describe('structured treatment action selectors', () => {
  it('shows only the selected action owner and keeps live options scoped to it', () => {
    const medication = renderToStaticMarkup(<OphthalmologyTreatmentLinks {...base} actionType="MEDICATION" />);
    expect(medication).toContain('Saved medication prescription'); expect(medication).toContain('111111111111111111111111');
    expect(medication).not.toContain('Saved optical prescription'); expect(medication).not.toContain('Laboratory / imaging orders');
    const optical = renderToStaticMarkup(<OphthalmologyTreatmentLinks {...base} actionType="OPTICAL" />);
    expect(optical).toContain('Saved optical prescription'); expect(optical).toContain('222222222222222222222222'); expect(optical).not.toContain('Saved medication prescription');
  });
  it('uses a multi-select only for investigations and no lookup for narrative other care', () => {
    const investigation = renderToStaticMarkup(<OphthalmologyTreatmentLinks {...base} actionType="INVESTIGATION" />);
    expect(investigation).toContain('Laboratory / imaging orders'); expect(investigation).toContain('multiple=""'); expect(investigation).toContain('333333333333333333333333');
    const other = renderToStaticMarkup(<OphthalmologyTreatmentLinks {...base} actionType="OTHER" />);
    expect(other).toContain('narrative-only'); expect(other).not.toContain('Refresh care references');
  });

  it('renders + New Procedure Recommendation button for PROCEDURE action and respects isRoutineBlocked', () => {
    const onCreateProcedure = vi.fn();
    const procedureHtml = renderToStaticMarkup(
      <OphthalmologyTreatmentLinks
        {...base}
        actionType="PROCEDURE"
        onCreateProcedure={onCreateProcedure}
      />
    );
    expect(procedureHtml).toContain('Saved procedure recommendation');
    expect(procedureHtml).toContain('444444444444444444444444');
    expect(procedureHtml).toContain('+ New Procedure Recommendation');
    expect(procedureHtml).not.toContain('disabled=""');

    const blockedHtml = renderToStaticMarkup(
      <OphthalmologyTreatmentLinks
        {...base}
        actionType="PROCEDURE"
        onCreateProcedure={onCreateProcedure}
        isRoutineBlocked={true}
      />
    );
    expect(blockedHtml).toContain('+ New Procedure Recommendation');
    expect(blockedHtml).toContain('disabled=""');
    expect(blockedHtml).toContain('Procedure recommendations blocked during active emergency alert');
  });
});
