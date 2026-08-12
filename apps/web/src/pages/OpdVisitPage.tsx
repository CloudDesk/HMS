import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  opdApi,
  type ApiOpdVisitStatus,
  type CreateOpdVitalsPayload,
  type OpdConsultationResponse,
  type OpdVisitResponse,
  type OpdVitalsResponse,
  type SaveOpdConsultationPayload,
} from '../api/opd';
import { Toast } from '../components/ui/Toast';
import { navigate, useAppLocation } from '../routing/navigation';
import {
  formatVisitDateTime,
  getOpdErrorMessage,
  opdVisitPriorityLabels,
  opdVisitStatusLabels,
  opdVisitTypeLabels,
  patientInitials,
  visitPriorityClass,
  visitStatusClass,
} from './opd-utils';

type VisitAction = {
  icon: string;
  label: string;
  notes: string;
  status: ApiOpdVisitStatus;
  tone: 'default' | 'primary' | 'danger';
};

type VitalsFormState = {
  blood_pressure_systolic: string;
  blood_pressure_diastolic: string;
  weight_kg: string;
  height_cm: string;
  temperature_c: string;
  pulse_bpm: string;
  respiratory_rate_per_min: string;
  oxygen_saturation_percent: string;
  notes: string;
};

type ConsultationFormState = {
  chief_complaint: string;
  history_present_illness: string;
  past_history: string;
  family_history: string;
  allergies: string;
  physical_examination: string;
  assessment: string;
  treatment_plan: string;
  doctor_notes: string;
};

const statusSteps: ApiOpdVisitStatus[] = [
  'CHECKED_IN',
  'WAITING_FOR_VITALS',
  'READY_FOR_CONSULTATION',
  'IN_CONSULTATION',
  'COMPLETED',
];

const actionForStatus = (visit: OpdVisitResponse): VisitAction[] => {
  if (visit.status === 'COMPLETED' || visit.status === 'CANCELLED' || visit.status === 'NO_SHOW') {
    return [];
  }

  const actions: VisitAction[] = [
    {
      icon: 'ph-activity',
      label: 'Send to Vitals',
      notes: 'Patient moved from check-in to vitals.',
      status: 'WAITING_FOR_VITALS',
      tone: 'default',
    },
    {
      icon: 'ph-check-circle',
      label: 'Ready for Doctor',
      notes: 'Patient marked ready for doctor consultation.',
      status: 'READY_FOR_CONSULTATION',
      tone: 'default',
    },
    {
      icon: 'ph-stethoscope',
      label: 'Start Consultation',
      notes: 'Doctor consultation started from OPD visit workspace.',
      status: 'IN_CONSULTATION',
      tone: 'primary',
    },
    {
      icon: 'ph-user-minus',
      label: 'Mark No Show',
      notes: 'Patient did not appear for OPD visit after check-in.',
      status: 'NO_SHOW',
      tone: 'danger',
    },
  ];

  return actions.filter((action) => action.status !== visit.status);
};

const emptyVitalsForm: VitalsFormState = {
  blood_pressure_systolic: '',
  blood_pressure_diastolic: '',
  weight_kg: '',
  height_cm: '',
  temperature_c: '',
  pulse_bpm: '',
  respiratory_rate_per_min: '',
  oxygen_saturation_percent: '',
  notes: '',
};

const emptyConsultationForm: ConsultationFormState = {
  allergies: '',
  assessment: '',
  chief_complaint: '',
  doctor_notes: '',
  family_history: '',
  history_present_illness: '',
  past_history: '',
  physical_examination: '',
  treatment_plan: '',
};

const consultationFormFromRecord = (consultation: OpdConsultationResponse | null): ConsultationFormState => ({
  allergies: consultation?.allergies ?? '',
  assessment: consultation?.assessment ?? '',
  chief_complaint: consultation?.chief_complaint ?? '',
  doctor_notes: consultation?.doctor_notes ?? '',
  family_history: consultation?.family_history ?? '',
  history_present_illness: consultation?.history_present_illness ?? '',
  past_history: consultation?.past_history ?? '',
  physical_examination: consultation?.physical_examination ?? '',
  treatment_plan: consultation?.treatment_plan ?? '',
});

const optionalNumber = (value: string) => {
  if (!value.trim()) return null;
  return Number(value);
};

const requiredNumber = (value: string) => Number(value);

const formatVitalsTime = (value: string) =>
  new Intl.DateTimeFormat('en', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));

export function OpdVisitPage() {
  const { search } = useAppLocation();
  const visitId = new URLSearchParams(search).get('id') ?? '';
  const [visit, setVisit] = useState<OpdVisitResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updating, setUpdating] = useState('');
  const [latestVitals, setLatestVitals] = useState<OpdVitalsResponse | null>(null);
  const [vitalsHistory, setVitalsHistory] = useState<OpdVitalsResponse[]>([]);
  const [vitalsLoading, setVitalsLoading] = useState(false);
  const [vitalsForm, setVitalsForm] = useState<VitalsFormState>(emptyVitalsForm);
  const [vitalsError, setVitalsError] = useState('');
  const [consultation, setConsultation] = useState<OpdConsultationResponse | null>(null);
  const [consultationForm, setConsultationForm] = useState<ConsultationFormState>(emptyConsultationForm);
  const [consultationLoading, setConsultationLoading] = useState(false);
  const [consultationError, setConsultationError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const actions = useMemo(() => (visit ? actionForStatus(visit) : []), [visit]);
  const calculatedBmi = useMemo(() => {
    const weight = requiredNumber(vitalsForm.weight_kg);
    const heightM = requiredNumber(vitalsForm.height_cm) / 100;
    if (!weight || !heightM) return '';
    return (weight / (heightM * heightM)).toFixed(1);
  }, [vitalsForm.height_cm, vitalsForm.weight_kg]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 3000);
  };

  const loadVisit = useCallback(async () => {
    if (!visitId) {
      setVisit(null);
      setLoadError('Open this workspace from an OPD visit record.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');

    try {
      const response = await opdApi.getVisitById(visitId);
      setVisit(response);
    } catch (error) {
      setVisit(null);
      setLoadError(getOpdErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [visitId]);

  const loadVitals = useCallback(async () => {
    if (!visitId) return;

    setVitalsLoading(true);
    try {
      const [latestResponse, historyResponse] = await Promise.all([
        opdApi.getLatestVitals(visitId),
        opdApi.listVitals(visitId, { limit: 5, sortBy: 'recorded_at', sortOrder: 'desc' }),
      ]);
      setLatestVitals(latestResponse);
      setVitalsHistory(historyResponse.data);
    } catch (error) {
      setVitalsError(getOpdErrorMessage(error));
      setLatestVitals(null);
      setVitalsHistory([]);
    } finally {
      setVitalsLoading(false);
    }
  }, [visitId]);

  const loadConsultation = useCallback(async () => {
    if (!visitId) return;

    setConsultationLoading(true);
    setConsultationError('');

    try {
      const response = await opdApi.getConsultation(visitId);
      setConsultation(response);
      setConsultationForm(consultationFormFromRecord(response));
    } catch (error) {
      setConsultation(null);
      setConsultationForm(emptyConsultationForm);
      setConsultationError(getOpdErrorMessage(error));
    } finally {
      setConsultationLoading(false);
    }
  }, [visitId]);

  useEffect(() => {
    void loadVisit();
  }, [loadVisit]);

  useEffect(() => {
    void loadVitals();
  }, [loadVitals]);

  useEffect(() => {
    void loadConsultation();
  }, [loadConsultation]);

  const updateStatus = async (action: VisitAction) => {
    if (!visit) return;

    setUpdating(action.status);
    try {
      const updatedVisit = await opdApi.updateVisitStatus(visit.id, {
        notes: action.notes,
        status: action.status,
      });
      setVisit(updatedVisit);
      showToast(`${updatedVisit.visit_number} moved to ${opdVisitStatusLabels[action.status].toLowerCase()}.`);
    } catch (error) {
      showToast(getOpdErrorMessage(error));
    } finally {
      setUpdating('');
    }
  };

  const updateVitalsField = (field: keyof VitalsFormState, value: string) => {
    setVitalsForm((current) => ({ ...current, [field]: value }));
    if (vitalsError) setVitalsError('');
  };

  const buildVitalsPayload = (): CreateOpdVitalsPayload | null => {
    const payload: CreateOpdVitalsPayload = {
      blood_pressure_diastolic: requiredNumber(vitalsForm.blood_pressure_diastolic),
      blood_pressure_systolic: requiredNumber(vitalsForm.blood_pressure_systolic),
      height_cm: requiredNumber(vitalsForm.height_cm),
      notes: vitalsForm.notes.trim() || null,
      oxygen_saturation_percent: optionalNumber(vitalsForm.oxygen_saturation_percent),
      pulse_bpm: optionalNumber(vitalsForm.pulse_bpm),
      respiratory_rate_per_min: optionalNumber(vitalsForm.respiratory_rate_per_min),
      temperature_c: optionalNumber(vitalsForm.temperature_c),
      weight_kg: requiredNumber(vitalsForm.weight_kg),
    };

    if (
      !Number.isFinite(payload.blood_pressure_systolic) ||
      !Number.isFinite(payload.blood_pressure_diastolic) ||
      !Number.isFinite(payload.weight_kg) ||
      !Number.isFinite(payload.height_cm)
    ) {
      setVitalsError('Blood pressure, weight and height are required.');
      return null;
    }

    if (payload.blood_pressure_diastolic >= payload.blood_pressure_systolic) {
      setVitalsError('Systolic blood pressure must be greater than diastolic blood pressure.');
      return null;
    }

    return payload;
  };

  const submitVitals = async () => {
    if (!visit) return;
    const payload = buildVitalsPayload();
    if (!payload) return;

    setUpdating('vitals');
    try {
      await opdApi.createVitals(visit.id, payload);
      setVitalsForm(emptyVitalsForm);
      await Promise.all([loadVisit(), loadVitals()]);
      showToast('Vitals recorded and patient marked ready for consultation.');
    } catch (error) {
      setVitalsError(getOpdErrorMessage(error));
    } finally {
      setUpdating('');
    }
  };

  const updateConsultationField = (field: keyof ConsultationFormState, value: string) => {
    setConsultationForm((current) => ({ ...current, [field]: value }));
    if (consultationError) setConsultationError('');
  };

  const buildConsultationPayload = (): SaveOpdConsultationPayload => ({
    allergies: consultationForm.allergies.trim() || null,
    assessment: consultationForm.assessment.trim() || null,
    chief_complaint: consultationForm.chief_complaint.trim() || null,
    doctor_notes: consultationForm.doctor_notes.trim() || null,
    family_history: consultationForm.family_history.trim() || null,
    history_present_illness: consultationForm.history_present_illness.trim() || null,
    past_history: consultationForm.past_history.trim() || null,
    physical_examination: consultationForm.physical_examination.trim() || null,
    treatment_plan: consultationForm.treatment_plan.trim() || null,
  });

  const validateConsultationCompletion = () => {
    if (!consultationForm.chief_complaint.trim()) {
      setConsultationError('Chief complaint is required before completing consultation.');
      return false;
    }
    if (!consultationForm.assessment.trim()) {
      setConsultationError('Assessment is required before completing consultation.');
      return false;
    }
    if (!consultationForm.treatment_plan.trim()) {
      setConsultationError('Treatment plan is required before completing consultation.');
      return false;
    }
    if (!latestVitals) {
      setConsultationError('Vitals must be recorded before completing consultation.');
      return false;
    }
    return true;
  };

  const saveConsultationDraft = async () => {
    if (!visit) return;

    setUpdating('consultation-draft');
    try {
      const response = await opdApi.saveConsultationDraft(visit.id, buildConsultationPayload());
      setConsultation(response);
      await loadVisit();
      showToast('Consultation draft saved.');
    } catch (error) {
      setConsultationError(getOpdErrorMessage(error));
    } finally {
      setUpdating('');
    }
  };

  const completeConsultation = async () => {
    if (!visit || !validateConsultationCompletion()) return;

    setUpdating('consultation-complete');
    try {
      const response = await opdApi.completeConsultation(visit.id, buildConsultationPayload());
      setConsultation(response);
      await loadVisit();
      showToast('Consultation completed and published to EMR timeline.');
    } catch (error) {
      setConsultationError(getOpdErrorMessage(error));
    } finally {
      setUpdating('');
    }
  };

  const currentStepIndex = visit ? statusSteps.findIndex((status) => status === visit.status) : -1;

  return (
    <>
      <div className="opd-page">
        <section className="opd-page-header">
          <div className="opd-page-title">
            <h2>OPD Visit Workspace</h2>
            <p>Manage check-in handoff and outpatient visit readiness</p>
          </div>
          <div className="opd-page-actions">
            <button className="doc-btn" onClick={() => navigate('/opd/queue')} type="button">
              <i className="ph ph-arrow-left" aria-hidden="true" />
              Back to Queue
            </button>
            <button className="doc-btn" disabled={loading} onClick={loadVisit} type="button">
              <i className="ph ph-arrow-clockwise" aria-hidden="true" />
              Refresh
            </button>
          </div>
        </section>

        {loadError ? <div className="form-error-banner">{loadError}</div> : null}

        {loading ? (
          <section className="doc-card">
            <div className="um-state-cell">Loading OPD visit...</div>
          </section>
        ) : visit ? (
          <>
            <section className="doc-card opd-patient-header">
              <div className="opd-patient-main">
                <span className="doc-avatar large">{patientInitials(visit.patient_name)}</span>
                <div>
                  <p className="eyebrow">Visit {visit.visit_number}</p>
                  <h3>{visit.patient_name}</h3>
                  <div className="opd-patient-meta">
                    <span>{visit.patient_number}</span>
                    <span>{opdVisitTypeLabels[visit.visit_type]}</span>
                    <span>{formatVisitDateTime(visit.check_in_time)}</span>
                  </div>
                </div>
              </div>
              <div className="opd-patient-id">
                <span className={`doc-status ${visitPriorityClass(visit.priority)}`}>
                  {opdVisitPriorityLabels[visit.priority]}
                </span>
                <span className={`doc-status ${visitStatusClass(visit.status)}`}>
                  {opdVisitStatusLabels[visit.status]}
                </span>
              </div>
            </section>

            <section className="opd-workspace">
              <div className="opd-clinical-main">
                <article className="doc-card">
                  <div className="doc-card-header">
                    <div>
                      <h3>Visit Progress</h3>
                      <p>Check-in to consultation readiness</p>
                    </div>
                  </div>
                  <div className="opd-status-steps">
                    {statusSteps.map((status, index) => (
                      <div
                        className={[
                          'opd-status-step',
                          index <= currentStepIndex ? 'complete' : '',
                          status === visit.status ? 'active' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        key={status}
                      >
                        <span>{index + 1}</span>
                        <strong>{opdVisitStatusLabels[status]}</strong>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="doc-card">
                  <div className="doc-card-header">
                    <div>
                      <h3>Doctor Consultation</h3>
                      <p>Document clinical history, examination, assessment and care plan</p>
                    </div>
                    <span className={`doc-status ${consultation?.status === 'COMPLETED' ? 'completed' : 'draft'}`}>
                      {consultation?.status === 'COMPLETED' ? 'Completed' : 'Draft'}
                    </span>
                  </div>
                  {consultationLoading ? (
                    <div className="um-state-cell">Loading consultation draft...</div>
                  ) : (
                    <>
                      <section className="opd-form-section">
                        <div className="opd-form-section-head">
                          <div>
                            <h3>Clinical History</h3>
                            <p>Presenting complaint and relevant history</p>
                          </div>
                        </div>
                        <div className="doc-form-grid two">
                          <label className="doc-field" htmlFor="chief-complaint">
                            <span>Chief Complaint *</span>
                            <textarea
                              id="chief-complaint"
                              onChange={(event) => updateConsultationField('chief_complaint', event.target.value)}
                              rows={3}
                              value={consultationForm.chief_complaint}
                            />
                          </label>
                          <label className="doc-field" htmlFor="history-present-illness">
                            <span>History of Present Illness</span>
                            <textarea
                              id="history-present-illness"
                              onChange={(event) => updateConsultationField('history_present_illness', event.target.value)}
                              rows={3}
                              value={consultationForm.history_present_illness}
                            />
                          </label>
                          <label className="doc-field" htmlFor="past-history">
                            <span>Past History</span>
                            <textarea
                              id="past-history"
                              onChange={(event) => updateConsultationField('past_history', event.target.value)}
                              rows={3}
                              value={consultationForm.past_history}
                            />
                          </label>
                          <label className="doc-field" htmlFor="family-history">
                            <span>Family History</span>
                            <textarea
                              id="family-history"
                              onChange={(event) => updateConsultationField('family_history', event.target.value)}
                              rows={3}
                              value={consultationForm.family_history}
                            />
                          </label>
                          <label className="doc-field full" htmlFor="consultation-allergies">
                            <span>Allergies / Sensitivities</span>
                            <textarea
                              id="consultation-allergies"
                              onChange={(event) => updateConsultationField('allergies', event.target.value)}
                              rows={2}
                              value={consultationForm.allergies}
                            />
                          </label>
                        </div>
                      </section>

                      <section className="opd-form-section">
                        <div className="opd-form-section-head">
                          <div>
                            <h3>Examination & Plan</h3>
                            <p>Clinical findings and consultation outcome</p>
                          </div>
                        </div>
                        <div className="doc-form-grid two">
                          <label className="doc-field" htmlFor="physical-examination">
                            <span>Physical Examination</span>
                            <textarea
                              id="physical-examination"
                              onChange={(event) => updateConsultationField('physical_examination', event.target.value)}
                              rows={3}
                              value={consultationForm.physical_examination}
                            />
                          </label>
                          <label className="doc-field" htmlFor="assessment">
                            <span>Assessment *</span>
                            <textarea
                              id="assessment"
                              onChange={(event) => updateConsultationField('assessment', event.target.value)}
                              rows={3}
                              value={consultationForm.assessment}
                            />
                          </label>
                          <label className="doc-field" htmlFor="treatment-plan">
                            <span>Treatment Plan *</span>
                            <textarea
                              id="treatment-plan"
                              onChange={(event) => updateConsultationField('treatment_plan', event.target.value)}
                              rows={3}
                              value={consultationForm.treatment_plan}
                            />
                          </label>
                          <label className="doc-field" htmlFor="doctor-notes">
                            <span>Doctor Notes</span>
                            <textarea
                              id="doctor-notes"
                              onChange={(event) => updateConsultationField('doctor_notes', event.target.value)}
                              rows={3}
                              value={consultationForm.doctor_notes}
                            />
                          </label>
                        </div>
                      </section>

                      <div className="opd-consultation-context">
                        <i className="ph ph-heartbeat" aria-hidden="true" />
                        <div>
                          <strong>Latest vitals available for consultation</strong>
                          <span>
                            {latestVitals
                              ? `${latestVitals.blood_pressure}, BMI ${latestVitals.bmi}${
                                  latestVitals.pulse_bpm ? `, pulse ${latestVitals.pulse_bpm} bpm` : ''
                                }`
                              : 'Record vitals before completing consultation.'}
                          </span>
                        </div>
                      </div>

                      {consultationError ? <p className="field-error">{consultationError}</p> : null}
                      <div className="opd-sticky-actions">
                        <span className="opd-autosave saved">
                          <i className="ph ph-check-circle" aria-hidden="true" />
                          Live API draft
                        </span>
                        <div>
                          <button
                            className="doc-btn"
                            disabled={updating === 'consultation-draft'}
                            onClick={saveConsultationDraft}
                            type="button"
                          >
                            <i className="ph ph-floppy-disk" aria-hidden="true" />
                            Save Draft
                          </button>
                          <button
                            className="doc-btn primary"
                            disabled={updating === 'consultation-complete'}
                            onClick={completeConsultation}
                            type="button"
                          >
                            <i className="ph ph-check-circle" aria-hidden="true" />
                            Complete Consultation
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </article>

                <article className="doc-card">
                  <div className="doc-card-header">
                    <div>
                      <h3>Check-in Actions</h3>
                      <p>Move the visit through the OPD handoff stages</p>
                    </div>
                  </div>
                  <div className="opd-action-grid">
                    {actions.length === 0 ? (
                      <div className="um-state-cell">This visit is closed and cannot be updated.</div>
                    ) : (
                      actions.map((action) => (
                        <button
                          className={`doc-quick-action ${action.tone === 'primary' ? 'primary' : ''} ${
                            action.tone === 'danger' ? 'danger' : ''
                          }`}
                          disabled={Boolean(updating)}
                          key={action.status}
                          onClick={() => updateStatus(action)}
                          type="button"
                        >
                          <i className={`ph ${action.icon}`} aria-hidden="true" />
                          <span>
                            <strong>{action.label}</strong>
                            <small>{action.notes}</small>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </article>

                <article className="doc-card">
                  <div className="doc-card-header">
                    <div>
                      <h3>Vital Signs</h3>
                      <p>Record current observations before consultation</p>
                    </div>
                  </div>
                  <div className="opd-vitals-grid">
                    <label className="opd-vital" htmlFor="bp-systolic">
                      <span>Systolic BP *</span>
                      <input
                        id="bp-systolic"
                        min="50"
                        max="260"
                        onChange={(event) => updateVitalsField('blood_pressure_systolic', event.target.value)}
                        placeholder="120"
                        type="number"
                        value={vitalsForm.blood_pressure_systolic}
                      />
                    </label>
                    <label className="opd-vital" htmlFor="bp-diastolic">
                      <span>Diastolic BP *</span>
                      <input
                        id="bp-diastolic"
                        min="30"
                        max="160"
                        onChange={(event) => updateVitalsField('blood_pressure_diastolic', event.target.value)}
                        placeholder="80"
                        type="number"
                        value={vitalsForm.blood_pressure_diastolic}
                      />
                    </label>
                    <label className="opd-vital" htmlFor="weight-kg">
                      <span>Weight (kg) *</span>
                      <input
                        id="weight-kg"
                        min="1"
                        max="350"
                        onChange={(event) => updateVitalsField('weight_kg', event.target.value)}
                        placeholder="72"
                        step="0.1"
                        type="number"
                        value={vitalsForm.weight_kg}
                      />
                    </label>
                    <label className="opd-vital" htmlFor="height-cm">
                      <span>Height (cm) *</span>
                      <input
                        id="height-cm"
                        min="30"
                        max="250"
                        onChange={(event) => updateVitalsField('height_cm', event.target.value)}
                        placeholder="170"
                        step="0.1"
                        type="number"
                        value={vitalsForm.height_cm}
                      />
                    </label>
                    <label className="opd-vital" htmlFor="temperature-c">
                      <span>Temperature (C)</span>
                      <input
                        id="temperature-c"
                        min="30"
                        max="45"
                        onChange={(event) => updateVitalsField('temperature_c', event.target.value)}
                        placeholder="36.8"
                        step="0.1"
                        type="number"
                        value={vitalsForm.temperature_c}
                      />
                    </label>
                    <label className="opd-vital" htmlFor="pulse-bpm">
                      <span>Pulse (bpm)</span>
                      <input
                        id="pulse-bpm"
                        min="20"
                        max="240"
                        onChange={(event) => updateVitalsField('pulse_bpm', event.target.value)}
                        placeholder="76"
                        type="number"
                        value={vitalsForm.pulse_bpm}
                      />
                    </label>
                    <label className="opd-vital" htmlFor="respiratory-rate">
                      <span>Resp. Rate</span>
                      <input
                        id="respiratory-rate"
                        min="5"
                        max="80"
                        onChange={(event) => updateVitalsField('respiratory_rate_per_min', event.target.value)}
                        placeholder="18"
                        type="number"
                        value={vitalsForm.respiratory_rate_per_min}
                      />
                    </label>
                    <label className="opd-vital" htmlFor="spo2">
                      <span>SpO2 (%)</span>
                      <input
                        id="spo2"
                        min="50"
                        max="100"
                        onChange={(event) => updateVitalsField('oxygen_saturation_percent', event.target.value)}
                        placeholder="98"
                        type="number"
                        value={vitalsForm.oxygen_saturation_percent}
                      />
                    </label>
                    <label className="opd-vital readonly" htmlFor="bmi">
                      <span>BMI</span>
                      <input id="bmi" readOnly type="text" value={calculatedBmi} />
                    </label>
                    <label className="opd-vital notes" htmlFor="vitals-notes">
                      <span>Observation Notes</span>
                      <textarea
                        id="vitals-notes"
                        onChange={(event) => updateVitalsField('notes', event.target.value)}
                        placeholder="Clinical observations, posture, pain, or measurement notes"
                        rows={3}
                        value={vitalsForm.notes}
                      />
                    </label>
                  </div>
                  {vitalsError ? <p className="field-error">{vitalsError}</p> : null}
                  <div className="opd-sticky-actions">
                    <button className="doc-btn" disabled={updating === 'vitals'} onClick={() => setVitalsForm(emptyVitalsForm)} type="button">
                      Clear
                    </button>
                    <button className="doc-btn primary" disabled={updating === 'vitals'} onClick={submitVitals} type="button">
                      <i className="ph ph-heartbeat" aria-hidden="true" />
                      Save Vitals
                    </button>
                  </div>
                </article>

                <article className="doc-card">
                  <div className="doc-card-header">
                    <div>
                      <h3>Vitals History</h3>
                      <p>Recent recorded observations for this visit</p>
                    </div>
                  </div>
                  {vitalsLoading ? (
                    <div className="um-state-cell">Loading vitals...</div>
                  ) : vitalsHistory.length === 0 ? (
                    <div className="um-state-cell">No vitals recorded yet.</div>
                  ) : (
                    <div className="opd-vitals-history">
                      {vitalsHistory.map((vitals) => (
                        <div className="opd-vitals-history-item" key={vitals.id}>
                          <div>
                            <strong>{vitals.blood_pressure}</strong>
                            <span>{formatVitalsTime(vitals.recorded_at)}</span>
                          </div>
                          <div className="opd-vitals-history-values">
                            <span>BMI {vitals.bmi}</span>
                            <span>{vitals.pulse_bpm ? `${vitals.pulse_bpm} bpm` : 'Pulse -'}</span>
                            <span>{vitals.oxygen_saturation_percent ? `SpO2 ${vitals.oxygen_saturation_percent}%` : 'SpO2 -'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              </div>

              <aside className="doc-card opd-summary-panel">
                <div className="doc-card-header">
                  <div>
                    <h3>Visit Summary</h3>
                    <p>Patient, doctor and registration snapshot</p>
                  </div>
                </div>
                <div className="opd-summary-list">
                  <div className="opd-summary-row">
                    <span>Doctor</span>
                    <strong>{visit.doctor_name}</strong>
                  </div>
                  <div className="opd-summary-row">
                    <span>Specialization</span>
                    <strong>{visit.doctor_specialization}</strong>
                  </div>
                  <div className="opd-summary-row">
                    <span>Visit Date</span>
                    <strong>{formatVisitDateTime(visit.visit_date)}</strong>
                  </div>
                  <div className="opd-summary-row">
                    <span>Reason</span>
                    <strong>{visit.reason || '-'}</strong>
                  </div>
                  <div className="opd-summary-row">
                    <span>Notes</span>
                    <strong>{visit.notes || '-'}</strong>
                  </div>
                  <div className="opd-summary-row">
                    <span>Appointment Link</span>
                    <strong>{visit.appointment_id ? 'Linked' : 'Walk-in'}</strong>
                  </div>
                  <div className="opd-summary-row">
                    <span>Consultation</span>
                    <strong>{consultation?.status === 'COMPLETED' ? 'Completed' : 'Draft / pending'}</strong>
                  </div>
                </div>
                <div className="opd-summary-card">
                  <h4>Latest Vitals</h4>
                  <div className="opd-summary-list">
                    <div className="opd-summary-row">
                      <span>Blood Pressure</span>
                      <strong>{latestVitals?.blood_pressure ?? '-'}</strong>
                    </div>
                    <div className="opd-summary-row">
                      <span>Pulse</span>
                      <strong>{latestVitals?.pulse_bpm ? `${latestVitals.pulse_bpm} bpm` : '-'}</strong>
                    </div>
                    <div className="opd-summary-row">
                      <span>Temperature</span>
                      <strong>{latestVitals?.temperature_c ? `${latestVitals.temperature_c} C` : '-'}</strong>
                    </div>
                    <div className="opd-summary-row">
                      <span>SpO2</span>
                      <strong>
                        {latestVitals?.oxygen_saturation_percent ? `${latestVitals.oxygen_saturation_percent}%` : '-'}
                      </strong>
                    </div>
                    <div className="opd-summary-row">
                      <span>BMI</span>
                      <strong>{latestVitals?.bmi ?? '-'}</strong>
                    </div>
                  </div>
                </div>
              </aside>
            </section>
          </>
        ) : null}
      </div>

      <Toast message={toastMessage} visible={toastVisible} />
    </>
  );
}
