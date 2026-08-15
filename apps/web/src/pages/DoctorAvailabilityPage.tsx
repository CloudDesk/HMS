import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  doctorsApi,
  type DoctorAvailabilityExceptionResponse,
  type DoctorLeaveResponse,
  type DoctorResponse,
  type SaveDoctorAvailabilityPayload,
} from '../api/doctors';
import { useAuth } from '../auth/useAuth';
import {
  DoctorAvailabilityEditor,
  createDefaultDoctorAvailability,
  doctorAvailabilityToForm,
  type WorkingBlockForm,
} from '../components/doctors/DoctorAvailabilityEditor';
import { Toast } from '../components/ui/Toast';
import { navigate, useAppLocation } from '../routing/navigation';
import { getPatientErrorMessage } from './patient-utils';

const todayValue = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function DoctorAvailabilityPage() {
  const { user } = useAuth();
  const { search } = useAppLocation();
  const initialDoctorId = new URLSearchParams(search).get('doctor_id') ?? '';
  const isDoctorUser = user?.roles.some((role) => role.code === 'DOCTOR' || role.name.toLowerCase() === 'doctor') ?? false;
  const [doctors, setDoctors] = useState<DoctorResponse[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState(initialDoctorId);
  const [availability, setAvailability] = useState(createDefaultDoctorAvailability);
  const [leaves, setLeaves] = useState<DoctorLeaveResponse[]>([]);
  const [exceptions, setExceptions] = useState<DoctorAvailabilityExceptionResponse[]>([]);
  const [leaveForm, setLeaveForm] = useState({ start_date: todayValue(), end_date: todayValue(), reason: '' });
  const [exceptionForm, setExceptionForm] = useState({
    date: todayValue(),
    is_available: false,
    working_blocks: [] as WorkingBlockForm[],
    slot_duration_minutes: 30,
    reason: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');

  const selectedDoctor = useMemo(
    () => doctors.find((doctor) => doctor.id === selectedDoctorId) ?? null,
    [doctors, selectedDoctorId],
  );

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastTone(tone);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2800);
  };

  const loadDoctors = useCallback(async () => {
    const data = isDoctorUser
      ? [await doctorsApi.getCurrent()]
      : (await doctorsApi.list({ limit: 100, sortBy: 'display_name', sortOrder: 'asc' })).data;
    setDoctors(data);
    setSelectedDoctorId((current) => (isDoctorUser ? data[0]?.id ?? '' : current || data[0]?.id || ''));
  }, [isDoctorUser]);

  const loadSchedule = useCallback(async () => {
    if (!selectedDoctorId) return;
    const [doctor, leaveResponse, exceptionResponse] = await Promise.all([
      doctorsApi.getById(selectedDoctorId),
      doctorsApi.listLeaves(selectedDoctorId, { limit: 100 }),
      doctorsApi.listExceptions(selectedDoctorId, { limit: 100 }),
    ]);
    setDoctors((current) => current.map((item) => item.id === doctor.id ? doctor : item));
    setAvailability(doctorAvailabilityToForm(doctor));
    setLeaves(leaveResponse.data);
    setExceptions(exceptionResponse.data);
  }, [selectedDoctorId]);

  useEffect(() => {
    setLoading(true);
    setError('');
    void loadDoctors().catch((loadError) => setError(getPatientErrorMessage(loadError))).finally(() => setLoading(false));
  }, [loadDoctors]);

  useEffect(() => {
    if (!selectedDoctorId) return;
    const params = new URLSearchParams({ doctor_id: selectedDoctorId });
    navigate(`/doctors/availability?${params.toString()}`, { replace: true });
    setLoading(true);
    setError('');
    void loadSchedule().catch((loadError) => setError(getPatientErrorMessage(loadError))).finally(() => setLoading(false));
  }, [loadSchedule, selectedDoctorId]);

  const saveAvailability = async () => {
    if (!selectedDoctorId) return;
    setSaving(true);
    setError('');
    try {
      const payload: SaveDoctorAvailabilityPayload = { availability };
      const doctor = await doctorsApi.updateAvailability(selectedDoctorId, payload);
      setAvailability(doctorAvailabilityToForm(doctor));
      showToast('Doctor availability saved.');
    } catch (saveError) {
      setError(getPatientErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const submitLeave = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedDoctorId) return;
    setSaving(true);
    setError('');
    try {
      await doctorsApi.createLeave(selectedDoctorId, leaveForm);
      setLeaveForm({ start_date: todayValue(), end_date: todayValue(), reason: '' });
      await loadSchedule();
      showToast('Doctor leave added.');
    } catch (saveError) {
      setError(getPatientErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const cancelLeave = async (leaveId: string) => {
    if (!selectedDoctorId) return;
    setSaving(true);
    try {
      await doctorsApi.cancelLeave(selectedDoctorId, leaveId);
      await loadSchedule();
      showToast('Doctor leave cancelled.');
    } catch (saveError) {
      setError(getPatientErrorMessage(saveError));
      showToast(getPatientErrorMessage(saveError), 'error');
    } finally {
      setSaving(false);
    }
  };

  const submitException = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedDoctorId) return;
    setSaving(true);
    setError('');
    try {
      await doctorsApi.saveException(selectedDoctorId, exceptionForm);
      setExceptionForm({ date: todayValue(), is_available: false, working_blocks: [], slot_duration_minutes: 30, reason: '' });
      await loadSchedule();
      showToast('Availability exception saved.');
    } catch (saveError) {
      setError(getPatientErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const deleteException = async (exceptionId: string) => {
    if (!selectedDoctorId) return;
    setSaving(true);
    try {
      await doctorsApi.deleteException(selectedDoctorId, exceptionId);
      await loadSchedule();
      showToast('Availability exception removed.');
    } catch (saveError) {
      setError(getPatientErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="doctor-page">
        <section className="doctor-page-header">
          <div className="doctor-page-title"><h2>Availability Management</h2><p>Configure recurring blocks, dated exceptions, and doctor leave.</p></div>
          <div className="doctor-page-actions">
            <button className="doc-btn" onClick={() => navigate(`/doctors/profile?id=${selectedDoctorId}`)} type="button"><i className="ph ph-user-circle" /> Profile</button>
            <button className="doc-btn primary" disabled={saving || !selectedDoctorId} onClick={() => void saveAvailability()} type="button"><i className="ph ph-floppy-disk" /> Save Working Hours</button>
          </div>
        </section>

        <section className="doc-toolbar">
          <div className="doc-field grow"><label htmlFor="availability-doctor">Doctor</label><select disabled={isDoctorUser || loading} id="availability-doctor" onChange={(event) => setSelectedDoctorId(event.target.value)} value={selectedDoctorId}>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.display_name} · {doctor.specialization}</option>)}</select></div>
          {selectedDoctor ? <div className="doctor-availability-summary"><div><span>Status</span><strong>{selectedDoctor.status.replace('_', ' ')}</strong></div></div> : null}
        </section>

        {error ? <section className="form-error-banner" role="alert"><i className="ph ph-warning-circle" /><span>{error}</span></section> : null}
        {loading ? <section className="doc-card um-state-cell">Loading doctor availability...</section> : doctors.length === 0 ? <section className="doc-card um-state-cell">No doctor records are available.</section> : (
          <>
            <section className="doc-card">
              <div className="doc-card-header"><div><h3>Recurring Working Hours</h3><p>Add multiple non-overlapping blocks for each available day.</p></div></div>
              <DoctorAvailabilityEditor disabled={saving} onChange={setAvailability} value={availability} />
            </section>

            <div className="doc-grid two doctor-availability-management-grid">
              <section className="doc-card">
                <div className="doc-card-header"><div><h3>Doctor Leave</h3><p>Date ranges block all generated appointment slots.</p></div></div>
                <form className="doc-form-grid two" onSubmit={submitLeave}><label className="doc-field"><span>From</span><input min={todayValue()} onChange={(event) => setLeaveForm({ ...leaveForm, start_date: event.target.value })} required type="date" value={leaveForm.start_date} /></label><label className="doc-field"><span>To</span><input min={leaveForm.start_date} onChange={(event) => setLeaveForm({ ...leaveForm, end_date: event.target.value })} required type="date" value={leaveForm.end_date} /></label><label className="doc-field full"><span>Reason</span><input minLength={3} onChange={(event) => setLeaveForm({ ...leaveForm, reason: event.target.value })} required value={leaveForm.reason} /></label><div className="full"><button className="doc-btn primary" disabled={saving} type="submit"><i className="ph ph-plus" /> Add Leave</button></div></form>
                <div className="doc-table-wrap doctor-subtable"><table className="doc-table"><thead><tr><th>From</th><th>To</th><th>Reason</th><th>Status</th><th /></tr></thead><tbody>{leaves.length === 0 ? <tr><td className="um-state-cell" colSpan={5}>No leave records.</td></tr> : leaves.map((leave) => <tr key={leave.id}><td>{leave.start_date.slice(0, 10)}</td><td>{leave.end_date.slice(0, 10)}</td><td>{leave.reason}</td><td>{leave.status}</td><td>{leave.status === 'ACTIVE' ? <button className="doc-action danger" disabled={saving} onClick={() => void cancelLeave(leave.id)} title="Cancel leave" type="button"><i className="ph ph-x" /></button> : null}</td></tr>)}</tbody></table></div>
              </section>

              <section className="doc-card">
                <div className="doc-card-header"><div><h3>Availability Exceptions</h3><p>Override a single date with closure or custom working blocks.</p></div></div>
                <form className="doc-form-grid two" onSubmit={submitException}><label className="doc-field"><span>Date</span><input min={todayValue()} onChange={(event) => setExceptionForm({ ...exceptionForm, date: event.target.value })} required type="date" value={exceptionForm.date} /></label><label className="doc-field"><span>Availability</span><select onChange={(event) => setExceptionForm({ ...exceptionForm, is_available: event.target.value === 'available', working_blocks: event.target.value === 'available' ? exceptionForm.working_blocks.length ? exceptionForm.working_blocks : [{ start_time: '09:00', end_time: '13:00' }] : [] })} value={exceptionForm.is_available ? 'available' : 'unavailable'}><option value="unavailable">Unavailable</option><option value="available">Custom hours</option></select></label>{exceptionForm.is_available ? <><label className="doc-field"><span>From</span><input onChange={(event) => setExceptionForm({ ...exceptionForm, working_blocks: [{ ...exceptionForm.working_blocks[0]!, start_time: event.target.value }] })} required type="time" value={exceptionForm.working_blocks[0]?.start_time ?? ''} /></label><label className="doc-field"><span>To</span><input onChange={(event) => setExceptionForm({ ...exceptionForm, working_blocks: [{ ...exceptionForm.working_blocks[0]!, end_time: event.target.value }] })} required type="time" value={exceptionForm.working_blocks[0]?.end_time ?? ''} /></label></> : null}<label className="doc-field full"><span>Reason</span><input minLength={3} onChange={(event) => setExceptionForm({ ...exceptionForm, reason: event.target.value })} required value={exceptionForm.reason} /></label><div className="full"><button className="doc-btn primary" disabled={saving} type="submit"><i className="ph ph-plus" /> Save Exception</button></div></form>
                <div className="doc-table-wrap doctor-subtable"><table className="doc-table"><thead><tr><th>Date</th><th>Override</th><th>Reason</th><th /></tr></thead><tbody>{exceptions.length === 0 ? <tr><td className="um-state-cell" colSpan={4}>No dated exceptions.</td></tr> : exceptions.map((exception) => <tr key={exception.id}><td>{exception.date.slice(0, 10)}</td><td>{exception.is_available ? exception.working_blocks.map((block) => `${block.start_time}–${block.end_time}`).join(', ') : 'Unavailable'}</td><td>{exception.reason}</td><td><button className="doc-action danger" disabled={saving} onClick={() => void deleteException(exception.id)} title="Delete exception" type="button"><i className="ph ph-trash" /></button></td></tr>)}</tbody></table></div>
              </section>
            </div>
          </>
        )}
      </div>
      <Toast message={toastMessage} tone={toastTone} visible={toastVisible} />
    </>
  );
}
