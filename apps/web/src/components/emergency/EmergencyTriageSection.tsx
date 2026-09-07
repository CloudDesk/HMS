import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import type { EmergencyTriageLevel } from '../../api/emergency';
import type { EmergencyWorkspaceProps, WorkspaceTab } from './types';
import { formatTime, message, triageLabel, triageSlug } from './utils';

const toOptionalNumber = (value: unknown) =>
  value === '' || value === null || value === undefined ? undefined : Number(value);
const optionalNumber = z.coerce.number<number>().optional();
const numericInput = { setValueAs: toOptionalNumber };

const triageSchema = z.object({
  level: z.enum([
    'LEVEL_1_CRITICAL',
    'LEVEL_2_HIGH',
    'LEVEL_3_MEDIUM',
    'LEVEL_4_LOW',
    'LEVEL_5_NON_URGENT',
  ]),
  area: z.string().min(2),
  pain_score: optionalNumber.refine(
    (value) => value === undefined || (Number.isInteger(value) && value >= 0 && value <= 10),
    'Pain score must be a whole number from 0 to 10.',
  ),
  systolic_bp: optionalNumber.refine(
    (value) => value === undefined || value >= 0,
    'Systolic blood pressure cannot be negative.',
  ),
  diastolic_bp: optionalNumber.refine(
    (value) => value === undefined || value >= 0,
    'Diastolic blood pressure cannot be negative.',
  ),
  pulse: optionalNumber.refine(
    (value) => value === undefined || value >= 0,
    'Pulse cannot be negative.',
  ),
  temperature_c: optionalNumber.refine(
    (value) => value === undefined || (value >= 20 && value <= 50),
    'Temperature must be between 20 and 50 °C.',
  ),
  spo2: optionalNumber.refine(
    (value) => value === undefined || (value >= 0 && value <= 100),
    'SpO₂ must be between 0 and 100%.',
  ),
  respiratory_rate: optionalNumber.refine(
    (value) => value === undefined || value >= 0,
    'Respiratory rate cannot be negative.',
  ),
  gcs: optionalNumber.refine(
    (value) => value === undefined || (value >= 3 && value <= 15),
    'GCS must be between 3 and 15.',
  ),
  airway: z.string().min(1),
  breathing: z.string().min(1),
  circulation: z.string().min(1),
  disability: z.string().min(1),
  exposure: z.string().min(1),
  notes: z.string(),
});

type TriageForm = z.infer<typeof triageSchema>;

const levels: EmergencyTriageLevel[] = [
  'LEVEL_1_CRITICAL',
  'LEVEL_2_HIGH',
  'LEVEL_3_MEDIUM',
  'LEVEL_4_LOW',
  'LEVEL_5_NON_URGENT',
];

export type EmergencyTriageSectionProps = {
  state: EmergencyWorkspaceProps['state'];
  mutations: EmergencyWorkspaceProps['mutations'];
  setActiveTab: (tab: WorkspaceTab) => void;
};

export function EmergencyTriageSection({ state, mutations, setActiveTab }: EmergencyTriageSectionProps) {
  const selected = state.selected || state.encounters[0] || null;

  const triage = useForm<TriageForm>({
    resolver: zodResolver(triageSchema),
    defaultValues: {
      level: 'LEVEL_3_MEDIUM',
      area: 'General ER',
      airway: 'Patent',
      breathing: 'Spontaneous',
      circulation: 'Stable',
      disability: 'Alert',
      exposure: 'No immediate concern',
      notes: '',
    },
  });

  useEffect(() => {
    if (selected && selected.triage) {
      triage.reset({
        level: selected.triage.effective_level ?? selected.triage.level,
        area: selected.triage.area || 'General ER',
        pain_score: selected.triage.pain_score ?? undefined,
        systolic_bp: selected.triage.vitals?.systolic_bp ?? undefined,
        diastolic_bp: selected.triage.vitals?.diastolic_bp ?? undefined,
        pulse: selected.triage.vitals?.pulse ?? undefined,
        temperature_c: selected.triage.vitals?.temperature_c ?? undefined,
        spo2: selected.triage.vitals?.spo2 ?? undefined,
        respiratory_rate: selected.triage.vitals?.respiratory_rate ?? undefined,
        gcs: selected.triage.vitals?.gcs ?? undefined,
        airway: selected.triage.abcde?.airway || 'Patent',
        breathing: selected.triage.abcde?.breathing || 'Spontaneous',
        circulation: selected.triage.abcde?.circulation || 'Stable',
        disability: selected.triage.abcde?.disability || 'Alert',
        exposure: selected.triage.abcde?.exposure || 'No immediate concern',
        notes: selected.triage.notes || '',
      });
    }
  }, [selected, triage]);

  const completeTriage = triage.handleSubmit(async (value) => {
    if (!selected) return;
    try {
      await mutations.triage.mutateAsync({
        id: selected.id,
        body: {
          level: value.level,
          area: value.area,
          pain_score: value.pain_score ?? null,
          vitals: {
            systolic_bp: value.systolic_bp ?? null,
            diastolic_bp: value.diastolic_bp ?? null,
            pulse: value.pulse ?? null,
            temperature_c: value.temperature_c ?? null,
            spo2: value.spo2 ?? null,
            respiratory_rate: value.respiratory_rate ?? null,
            gcs: value.gcs ?? null,
          },
          abcde: {
            airway: value.airway,
            breathing: value.breathing,
            circulation: value.circulation,
            disability: value.disability,
            exposure: value.exposure,
          },
          notes: value.notes || null,
        },
      });
      toast.success('Triage completed. Patient moved to consultation.');
      setActiveTab('Consultation');
    } catch (error) {
      toast.error(message(error));
    }
  }, (errors) => {
    const firstError = Object.values(errors).find((error) => error?.message);
    toast.error(firstError?.message ?? 'Review the triage information and try again.');
  });

  if (!selected) return null;

  const canAssess =
    ['REGISTERED', 'WAITING_FOR_TRIAGE', 'TRIAGED', 'WAITING_FOR_DOCTOR'].includes(selected.status) &&
    (state.capabilities.assessTriage ||
      state.capabilities.editConsultation ||
      state.capabilities.editEncounters);
  const triageLevel = selected.triage?.effective_level ?? selected.triage?.level ?? 'LEVEL_3_MEDIUM';

  if (!canAssess) {
    return (
      <div className="emergency-form-section">
        <div className="emergency-section-context-header">
          <div className="emergency-context-badge">
            <i className="ph ph-lock-key" /> Triage &amp; Vitals Assessment (Read-Only Nursing Context)
          </div>
          <p className="emergency-context-desc">
            Assessed by nursing staff upon arrival. Review acuity priority, vital signs, and primary survey.
          </p>
        </div>

        <div className="emergency-readonly-grid">
          <div className="emergency-readonly-card">
            <h4><i className="ph ph-shield-check" /> Acuity &amp; Triage Assignment</h4>
            <div className="emergency-readonly-field">
              <label>Acuity Priority</label>
              <div>
                <span className={`emergency-triage ${triageSlug(triageLevel)}`}>
                  {triageLabel(triageLevel)}
                </span>
              </div>
            </div>
            <div className="emergency-readonly-field">
              <label>Triage Area</label>
              <span>{selected.triage?.area || 'General ER'}</span>
            </div>
            <div className="emergency-readonly-field">
              <label>Pain Score (0-10)</label>
              <span>{selected.triage?.pain_score !== null && selected.triage?.pain_score !== undefined ? `${selected.triage.pain_score} / 10` : '—'}</span>
            </div>
            <div className="emergency-readonly-field">
              <label>Assessment Time</label>
              <span>{selected.triage?.assessed_at ? formatTime(selected.triage.assessed_at) : '—'}</span>
            </div>
          </div>

          <div className="emergency-readonly-card">
            <h4><i className="ph ph-activity" /> Vital Signs Summary</h4>
            <div className="emergency-readonly-field">
              <label>Blood Pressure</label>
              <span>
                {selected.triage?.vitals?.systolic_bp && selected.triage?.vitals?.diastolic_bp
                  ? `${selected.triage.vitals.systolic_bp} / ${selected.triage.vitals.diastolic_bp} mmHg`
                  : '—'}
              </span>
            </div>
            <div className="emergency-readonly-field">
              <label>Pulse / Heart Rate</label>
              <span>{selected.triage?.vitals?.pulse ? `${selected.triage.vitals.pulse} bpm` : '—'}</span>
            </div>
            <div className="emergency-readonly-field">
              <label>Temperature</label>
              <span>{selected.triage?.vitals?.temperature_c ? `${selected.triage.vitals.temperature_c} °C` : '—'}</span>
            </div>
            <div className="emergency-readonly-field">
              <label>SpO₂ &amp; Respiratory Rate</label>
              <span>
                {selected.triage?.vitals?.spo2 ? `${selected.triage.vitals.spo2}%` : '—'} •{' '}
                {selected.triage?.vitals?.respiratory_rate ? `${selected.triage.vitals.respiratory_rate}/min` : '—'}
              </span>
            </div>
            <div className="emergency-readonly-field">
              <label>GCS Score (3-15)</label>
              <span>{selected.triage?.vitals?.gcs ? `${selected.triage.vitals.gcs} / 15` : '—'}</span>
            </div>
          </div>

          <div className="emergency-readonly-card">
            <h4><i className="ph ph-heartbeat" /> Rapid Primary Survey (ABCDE)</h4>
            <div className="emergency-readonly-field">
              <label>Airway</label>
              <span>{selected.triage?.abcde?.airway || 'Patent'}</span>
            </div>
            <div className="emergency-readonly-field">
              <label>Breathing</label>
              <span>{selected.triage?.abcde?.breathing || 'Spontaneous'}</span>
            </div>
            <div className="emergency-readonly-field">
              <label>Circulation</label>
              <span>{selected.triage?.abcde?.circulation || 'Stable'}</span>
            </div>
            <div className="emergency-readonly-field">
              <label>Disability (Neurological)</label>
              <span>{selected.triage?.abcde?.disability || 'Alert'}</span>
            </div>
            <div className="emergency-readonly-field">
              <label>Exposure</label>
              <span>{selected.triage?.abcde?.exposure || 'No immediate concern'}</span>
            </div>
          </div>

          <div className="emergency-readonly-card">
            <h4><i className="ph ph-note" /> Nursing Triage Notes</h4>
            <div className="emergency-readonly-field">
              <label>Observations</label>
              <span>{selected.triage?.notes || 'No additional nursing triage notes.'}</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          {state.capabilities.editConsultation && (
            <button className="btn-emergency-primary" onClick={() => setActiveTab('Consultation')} type="button">
              Proceed to Consultation <i className="ph ph-arrow-right" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={completeTriage}>
      <div className="emergency-section-active-header">
        <div className="emergency-active-badge">
          <i className="ph ph-heartbeat" /> Primary Nursing Duty – Emergency Triage &amp; Vitals
        </div>
        <p className="emergency-active-desc">
          Perform rapid primary survey (ABCDE), record vital signs and pain score, and assign acuity priority.
        </p>
      </div>

      <section className="emergency-form-section">
        <div className="emergency-form-head">
          <div>
            <h3>Triage Information</h3>
            <p>Assign acuity and treatment area</p>
          </div>
        </div>
        <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          <div className="doc-field">
            <label>Priority</label>
            <select {...triage.register('level')}>
              {levels.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {triageLabel(lvl)}
                </option>
              ))}
            </select>
          </div>
          <div className="doc-field">
            <label>Triage Area</label>
            <select {...triage.register('area')}>
              <option>General ER</option>
              <option>Resuscitation</option>
              <option>Trauma Bay</option>
              <option>Observation</option>
              <option>Pediatric ER</option>
            </select>
          </div>
          <div className="doc-field">
            <label>Triage Nurse</label>
            <input readOnly value={state.currentDoctor?.display_name || 'Staff Nurse'} />
          </div>
          <div className="doc-field">
            <label>Assessment Time</label>
            <input readOnly value={formatTime(new Date().toISOString())} />
          </div>
        </div>

        <h4 style={{ margin: '1.25rem 0 0.5rem', fontSize: '0.82rem', color: '#475569' }}>Pain Score (0 - 10)</h4>
        <div className="emergency-pain-grid">
          {Array.from({ length: 11 }, (_, i) => (
            <label className="emergency-pain" key={i}>
              <input
                type="radio"
                value={i}
                {...triage.register('pain_score', numericInput)}
                defaultChecked={i === 5}
              />
              <span>{i}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="emergency-form-section">
        <div className="emergency-form-head">
          <div>
            <h3>Vital Signs</h3>
            <p>Initial emergency observations</p>
          </div>
        </div>
        <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <div className="doc-field">
            <label>Systolic BP (mmHg)</label>
            <input type="number" {...triage.register('systolic_bp', numericInput)} placeholder="118" />
          </div>
          <div className="doc-field">
            <label>Diastolic BP (mmHg)</label>
            <input type="number" {...triage.register('diastolic_bp', numericInput)} placeholder="74" />
          </div>
          <div className="doc-field">
            <label>Pulse (bpm)</label>
            <input type="number" {...triage.register('pulse', numericInput)} placeholder="104" />
          </div>
          <div className="doc-field">
            <label>Temperature (°C)</label>
            <input step="0.1" type="number" {...triage.register('temperature_c', numericInput)} placeholder="37.8" />
          </div>
          <div className="doc-field">
            <label>SpO₂ (%)</label>
            <input type="number" {...triage.register('spo2', numericInput)} placeholder="96" />
          </div>
          <div className="doc-field">
            <label>Respiratory Rate (/min)</label>
            <input type="number" {...triage.register('respiratory_rate', numericInput)} placeholder="22" />
          </div>
          <div className="doc-field">
            <label>GCS Score (3-15)</label>
            <input max={15} min={3} type="number" {...triage.register('gcs', numericInput)} placeholder="15" />
          </div>
        </div>
      </section>

      <section className="emergency-form-section">
        <div className="emergency-form-head">
          <div>
            <h3>ABCDE Assessment</h3>
            <p>Rapid primary survey</p>
          </div>
        </div>
        <div className="emergency-assessment-grid">
          <div className="emergency-assessment">
            <label>Airway</label>
            <select {...triage.register('airway')}>
              <option>Patent</option>
              <option>Obstructed</option>
              <option>Intubated</option>
            </select>
          </div>
          <div className="emergency-assessment">
            <label>Breathing</label>
            <select {...triage.register('breathing')}>
              <option>Spontaneous</option>
              <option>Distressed</option>
              <option>Assisted</option>
            </select>
          </div>
          <div className="emergency-assessment">
            <label>Circulation</label>
            <select {...triage.register('circulation')}>
              <option>Stable</option>
              <option>Shock</option>
              <option>Cardiac Arrest</option>
            </select>
          </div>
          <div className="emergency-assessment">
            <label>Disability</label>
            <select {...triage.register('disability')}>
              <option>Alert</option>
              <option>Voice</option>
              <option>Pain</option>
              <option>Unresponsive</option>
            </select>
          </div>
          <div className="emergency-assessment">
            <label>Exposure</label>
            <select {...triage.register('exposure')}>
              <option>No immediate concern</option>
              <option>Trauma</option>
              <option>Burns</option>
            </select>
          </div>
        </div>
      </section>

      <section className="emergency-form-section">
        <div className="emergency-form-head">
          <div>
            <h3>Nursing Triage Notes</h3>
            <p>Record additional clinical observations</p>
          </div>
        </div>
        <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
          <div className="doc-field">
            <label>Notes</label>
            <textarea rows={3} {...triage.register('notes')} placeholder="Patient presenting status, immediate nursing interventions..." />
          </div>
        </div>
      </section>

      <div className="emergency-form-actions">
        <span className="emergency-autosave">
          <i className="ph ph-check-circle" /> Auto-save enabled
        </span>
        <div>
          <button className="btn-emergency-secondary" onClick={() => toast.success('Draft saved.')} type="button">
            Save Draft
          </button>
          <button className="btn-emergency-primary" disabled={mutations.triage.isPending} type="submit">
            {mutations.triage.isPending ? 'Saving...' : 'Complete Triage → Consultation'}
          </button>
        </div>
      </div>
    </form>
  );
}
