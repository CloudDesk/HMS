import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => ({
  loading: true,
  loadError: '',
}));

vi.mock('../hooks/opd/useOpdVisitFeature', () => ({
  useOpdVisitFeature: () => ({
    state: {
      activeVisitId: '',
      activeTab: 'Consultation',
      recentVisits: [],
      visit: null,
      patient: null,
      vitals: null,
      consultation: null,
      prescription: null,
      laboratoryOrder: null,
      imagingOrder: null,
      doctors: [],
      masterMedicines: [],
      services: [],
      branches: [],
      departments: [],
      documents: [],
      loading: testState.loading,
      loadError: testState.loadError,
      updating: false,
    },
    actions: {
      setActiveTab: vi.fn(),
      selectVisit: vi.fn(),
      refetchVisit: vi.fn(),
      createVitals: vi.fn(),
      submitReferral: vi.fn(),
      saveWorkspaceDraft: vi.fn(),
      submitPrescription: vi.fn(),
      submitClinicalOrder: vi.fn(),
      completeWorkspace: vi.fn(),
      uploadDocument: vi.fn(),
      downloadDocument: vi.fn(),
      deleteDocument: vi.fn(),
      callNextPatient: vi.fn(),
    },
  }),
}));

vi.mock('../routing/navigation', () => ({ navigate: vi.fn() }));

import { OpdVisitPage } from './OpdVisitPage';

describe('OpdVisitPage feature-hook rendering', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    testState.loading = true;
    testState.loadError = '';
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('renders the loading state supplied by the feature hook', async () => {
    await act(async () => root.render(<OpdVisitPage />));

    expect(container.textContent).toContain('Loading consultation workspace');
  });

  it('renders the feature-hook error and empty states', async () => {
    testState.loading = false;
    testState.loadError = 'Unable to load OPD visit.';

    await act(async () => root.render(<OpdVisitPage />));

    expect(container.textContent).toContain('Unable to load OPD visit.');
    expect(container.textContent).toContain('No Active Visit Selected');
  });
});
