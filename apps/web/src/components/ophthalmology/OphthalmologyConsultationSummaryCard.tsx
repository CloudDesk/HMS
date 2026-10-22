import { queueTime } from '../../hooks/ophthalmology/queue-actions';
import type { OphthalmologyCompletionFeature } from '../../hooks/ophthalmology/useOphthalmologyCompletionFeature';
import { getOpdErrorMessage } from '../../pages/opd-utils';

export function OphthalmologyConsultationSummaryCard({ feature: f }: { feature: { summaryQuery: Pick<OphthalmologyCompletionFeature['summaryQuery'], 'data' | 'isLoading' | 'isError' | 'error' | 'refetch'> } }) {
  const data = f.summaryQuery.data;

  if (f.summaryQuery.isLoading) {
    return <section className="doc-card"><p role="status">Loading consolidated consultation summary…</p></section>;
  }

  if (f.summaryQuery.isError) {
    return (
      <section className="doc-card">
        <div className="oph-toolbar">
          <h4>Consolidated Consultation Summary</h4>
          <button type="button" className="doc-btn danger" onClick={() => void f.summaryQuery.refetch()}>
            Retry Summary
          </button>
        </div>
        <p className="doc-error-text" role="alert">
          Failed to load consolidated consultation summary. {getOpdErrorMessage(f.summaryQuery.error)}
        </p>
      </section>
    );
  }

  if (!data?.summary) {
    return (
      <section className="doc-card">
        <div className="oph-toolbar">
          <h4>Consolidated Consultation Summary</h4>
          <button type="button" className="doc-btn" onClick={() => void f.summaryQuery.refetch()}>
            Load Summary
          </button>
        </div>
        <p>The summary report is ready to be fetched from the server.</p>
      </section>
    );
  }

  const s = data.summary as {
    emergency_source?: { emergency_encounter_id: string; encounter_number: string; appointment_id: string; visit_id: string; patient_id: string } | null;
    patient?: { patientNumber?: string; firstName?: string; lastName?: string; dateOfBirth?: string; gender?: string; allergies?: string[] };
    consultation?: { assessment?: string; diagnoses?: Array<{ code: string; display: string; laterality?: string; status?: string; type?: string }> };
    clinical_review?: { current?: { clinical_summary?: string; treatment_plans?: Array<{ diagnosis_code: string; diagnosis_laterality: string; treatment: string; category: string; priority: string; status: string }>; follow_up_decision?: string; patient_instructions?: string } };
    optical_prescription?: { status?: string; current?: { prescription_type?: string; lens_type?: string; material?: string; valid_until?: string; usage_instructions?: string; power?: { OD?: { sphere?: number; cylinder?: number; axis?: number; addition?: number }; OS?: { sphere?: number; cylinder?: number; axis?: number; addition?: number } }; pupillary_distance?: { format?: string; binocular?: number; OD?: number; OS?: number } } };
    tasks?: Array<{ id: string; test_name: string; laterality: string; status: string; priority: string; completed_at?: string }>;
    medication_prescriptions?: Array<{ id: string; status?: string; medications?: Array<{ medicine_name?: string; dosage?: string; frequency?: string; duration?: string; instructions?: string }> }>;
    procedure_recommendations?: Array<{ id: string; status?: string; booking_id?: string | null; booking_status?: string | null; procedure_name?: string; urgency?: string | null; target_date?: string; reason?: string }>;
    referrals?: Array<{ id: string; status?: string; appointment_id?: string | null; target_department_name?: string; target_doctor_name?: string; reason?: string }>;
    follow_ups?: Array<{ id: string; status?: string; appointment_id?: string | null; follow_up_date?: string; instructions?: string }>;
    previous_results?: Array<{ id: string; current?: { form_type: string; performed_at: string; payload: Record<string, unknown> } }>;
  };

  const finalization = data.finalization;
  const latestApproval = finalization?.completions?.at(-1);

  return (
    <section className="doc-card oph-printable" id="oph-consultation-summary-card">
      <div className="oph-toolbar oph-no-print">
        <h4>Consolidated Consultation Summary Report</h4>
        <button type="button" className="doc-btn primary" onClick={() => window.print()}>
          Print Consultation Report
        </button>
        <button type="button" className="doc-btn" onClick={() => void f.summaryQuery.refetch()}>
          Refresh Summary
        </button>
      </div>

      <div className="doc-form-grid two">
        <div>
          <p>
            <strong>Patient:</strong> {s.patient?.firstName} {s.patient?.lastName} · MRN: {s.patient?.patientNumber}
          </p>
          <p>
            <strong>Gender / Age:</strong> {s.patient?.gender ?? 'Not recorded'} · DOB: {s.patient?.dateOfBirth ? new Date(s.patient.dateOfBirth).toLocaleDateString() : 'N/A'}
          </p>
        </div>
        <div>
          <p>
            <strong>Clinical Sign-off Status:</strong> {finalization?.status ?? 'IN_PROGRESS'}
          </p>
          {latestApproval && (
            <p>
              <strong>Doctor Approval:</strong> Approved {queueTime(latestApproval.approved_at)} by Doctor {latestApproval.approver_doctor_id}
            </p>
          )}
        </div>
      </div>

      <p>Clinical sign-off does not confirm downstream fulfillment or completion of the patient journey. Source statuses below reflect the latest retrieved records; submitted requests and scheduled appointments are not proof of care delivered.</p>
      {s.emergency_source && <p><strong>Emergency referral source:</strong> {s.emergency_source.encounter_number} · Emergency encounter {s.emergency_source.emergency_encounter_id} · Appointment {s.emergency_source.appointment_id} · OPD encounter {s.emergency_source.visit_id}</p>}

      <h4>Medication Requests</h4>
      {s.medication_prescriptions?.length ? s.medication_prescriptions.map((prescription) => <p key={prescription.id}>
        Prescription {prescription.id} · Source status: {prescription.status ?? 'Not recorded'}. Dispensing must be checked in Pharmacy.
      </p>) : <p>No medication requests recorded.</p>}

      <h4>Billing & Invoicing</h4>
      <p>Specialty clinical completion does not establish or finalize an invoice. Invoice generation, service charge mapping, and payment settlement must be managed in the Billing workspace; no automated charge mapping is confirmed for this specialty encounter.</p>

      <hr style={{ margin: '12px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />

      <h4>Structured Assessment & Diagnoses</h4>
      <p>{s.consultation?.assessment || 'No general assessment narrative recorded.'}</p>
      {s.consultation?.diagnoses && s.consultation.diagnoses.length > 0 ? (
        <div className="oph-table-scroll">
          <table className="doc-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Diagnosis</th>
                <th>Eye</th>
                <th>Status / Certainty</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {s.consultation.diagnoses.map((d, index) => (
                <tr key={index}>
                  <td>{d.code}</td>
                  <td>{d.display}</td>
                  <td>{d.laterality ?? 'NOT_APPLICABLE'}</td>
                  <td>{d.status ?? 'CONFIRMED'}</td>
                  <td>{d.type ?? 'PRIMARY'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No diagnoses recorded for this visit.</p>
      )}

      <h4>Clinical Review & Treatment Plan</h4>
      <p>{s.clinical_review?.current?.clinical_summary || 'No clinical summary recorded.'}</p>
      {s.clinical_review?.current?.treatment_plans && s.clinical_review.current.treatment_plans.length > 0 && (
        <div className="oph-table-scroll">
          <table className="doc-table">
            <thead>
              <tr>
                <th>Diagnosis & Eye</th>
                <th>Treatment</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {s.clinical_review.current.treatment_plans.map((tp, idx) => (
                <tr key={idx}>
                  <td>{tp.diagnosis_code} ({tp.diagnosis_laterality})</td>
                  <td>{tp.treatment}</td>
                  <td>{tp.category}</td>
                  <td>{tp.priority}</td>
                  <td>{tp.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {s.clinical_review?.current?.patient_instructions && (
        <p>
          <strong>Patient Instructions:</strong> {s.clinical_review.current.patient_instructions}
        </p>
      )}

      {s.optical_prescription?.current && (
        <>
          <h4>{s.optical_prescription?.status === 'APPROVED' ? 'Approved Optical Prescription' : 'Draft Optical Prescription (Pending Approval)'}</h4>
          <p>
            Type: {s.optical_prescription.current.prescription_type} · Lens: {s.optical_prescription.current.lens_type} · Material: {s.optical_prescription.current.material} · Valid until: {s.optical_prescription.current.valid_until ? new Date(s.optical_prescription.current.valid_until).toLocaleDateString() : 'N/A'}
          </p>
          <div className="oph-table-scroll">
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Eye</th>
                  <th>Sphere (SPH)</th>
                  <th>Cylinder (CYL)</th>
                  <th>Axis</th>
                  <th>Addition (ADD)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>OD (Right Eye)</td>
                  <td>{s.optical_prescription.current.power?.OD?.sphere != null ? (s.optical_prescription.current.power.OD.sphere > 0 ? `+${s.optical_prescription.current.power.OD.sphere}` : s.optical_prescription.current.power.OD.sphere) : '—'}</td>
                  <td>{s.optical_prescription.current.power?.OD?.cylinder ?? '—'}</td>
                  <td>{s.optical_prescription.current.power?.OD?.axis ?? '—'}</td>
                  <td>{s.optical_prescription.current.power?.OD?.addition ?? '—'}</td>
                </tr>
                <tr>
                  <td>OS (Left Eye)</td>
                  <td>{s.optical_prescription.current.power?.OS?.sphere != null ? (s.optical_prescription.current.power.OS.sphere > 0 ? `+${s.optical_prescription.current.power.OS.sphere}` : s.optical_prescription.current.power.OS.sphere) : '—'}</td>
                  <td>{s.optical_prescription.current.power?.OS?.cylinder ?? '—'}</td>
                  <td>{s.optical_prescription.current.power?.OS?.axis ?? '—'}</td>
                  <td>{s.optical_prescription.current.power?.OS?.addition ?? '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {s.optical_prescription.current.pupillary_distance && (
            <p>
              PD: {s.optical_prescription.current.pupillary_distance.format === 'BINOCULAR' ? `${s.optical_prescription.current.pupillary_distance.binocular} mm` : `OD: ${s.optical_prescription.current.pupillary_distance.OD} mm / OS: ${s.optical_prescription.current.pupillary_distance.OS} mm`}
            </p>
          )}
        </>
      )}

      <h4>Encounter Diagnostic Tests</h4>
      {s.tasks && s.tasks.length > 0 ? (
        <div className="oph-table-scroll">
          <table className="doc-table">
            <thead>
              <tr>
                <th>Test</th>
                <th>Eye</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Completed</th>
              </tr>
            </thead>
            <tbody>
              {s.tasks.map((task) => {
                const name = task.test_name ?? (task as Record<string, unknown>).testName ?? '';
                const comp = task.completed_at ?? (task as Record<string, unknown>).completedAt;
                return (
                  <tr key={task.id}>
                    <td>{name}</td>
                    <td>{task.laterality}</td>
                    <td>{task.status}</td>
                    <td>{task.priority}</td>
                    <td>{comp ? queueTime(comp as string) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No specialized test orders in this encounter.</p>
      )}

      {(s.procedure_recommendations?.length || s.referrals?.length || s.follow_ups?.length) ? (
        <>
          <h4>Continuing Care & Recommendations</h4>
          {s.procedure_recommendations?.map((p) => (
            <p key={p.id}>
              <strong>Surgery/Procedure Recommended:</strong> {p.procedure_name} · Source status: {p.status ?? 'Not recorded'} · Booking: {p.booking_id ?? 'Not linked'} · Booking status: {p.booking_status ?? 'Not available'} · Reason: {p.reason || 'Not recorded'}
            </p>
          ))}
          {s.referrals?.map((r) => (
            <p key={r.id}>
              <strong>Referral:</strong> To {r.target_department_name} ({r.target_doctor_name ?? 'Any Specialist'}) · Source status: {r.status ?? 'Not recorded'} · Appointment: {r.appointment_id ?? 'Not linked'} · Reason: {r.reason}
            </p>
          ))}
          {s.follow_ups?.map((f) => (
            <p key={f.id}>
              <strong>Follow-up:</strong> Source status: {f.status ?? 'Not recorded'} · Appointment: {f.appointment_id ?? 'Not linked'} · Date: {f.follow_up_date ? new Date(f.follow_up_date).toLocaleDateString() : 'Not recorded'} · Instructions: {f.instructions || 'Not recorded'}
            </p>
          ))}
        </>
      ) : null}
    </section>
  );
}
