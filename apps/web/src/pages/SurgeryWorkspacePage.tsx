import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { ProcedureBooking, ProcedureRecommendation } from '../api/surgery';
import { NewProcedureRecommendationModal } from '../components/surgery/NewProcedureRecommendationModal';
import { SurgeryRecommendationsTab } from '../components/surgery/SurgeryRecommendationsTab';
import { SurgeryBookingsTab } from '../components/surgery/SurgeryBookingsTab';
import { SurgeryScheduleTab } from '../components/surgery/SurgeryScheduleTab';
import { SurgeryBookingCreateModal } from '../components/surgery/SurgeryBookingCreateModal';
import { SurgeryBookingActionModal, type ActionMode } from '../components/surgery/SurgeryBookingActionModal';
import { SurgeryBookingDetailModal } from '../components/surgery/SurgeryBookingDetailModal';
import { useSurgeryWorkspaceFeature } from '../hooks/surgery/useSurgeryWorkspaceFeature';

const statusTone = (status: string) =>
  status === 'BOOKED' || status === 'COMPLETED'
    ? ('green' as const)
    : status === 'CANCELLED'
      ? ('red' as const)
      : status === 'PENDING_CONFIRMATION'
        ? ('orange' as const)
        : ('blue' as const);

const displayDate = (value: string) =>
  new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export function SurgeryWorkspacePage() {
  const [recommendationOpen, setRecommendationOpen] = useState(false);
  const [bookingFor, setBookingFor] = useState<ProcedureRecommendation | null>(null);
  const [selected, setSelected] = useState<ProcedureBooking | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [viewBookingDetail, setViewBookingDetail] = useState<ProcedureBooking | null>(null);

  const feature = useSurgeryWorkspaceFeature({
    selectedBookingId: selected?.id,
    selectedBookingStatus: selected?.status,
  });
  const { state, actions } = feature;

  const departmentId = bookingFor?.department_id ?? '';
  const eligibleDoctors = useMemo(
    () => state.doctors.filter((item) => !departmentId || item.department_id === departmentId),
    [departmentId, state.doctors]
  );

  const procedure = bookingFor
    ? state.services.find((item) => item.id === bookingFor.service_id)
    : selected
      ? state.services.find((item) => item.id === selected.service_id)
      : undefined;

  const handleViewBooking = async (bookingId: string) => {
    const found = state.bookings.find((b) => b.id === bookingId);
    if (found) {
      setViewBookingDetail(found);
      return;
    }
    try {
      const fetched = await actions.fetchBookingDetails(bookingId);
      if (fetched) {
        setViewBookingDetail(fetched);
      } else {
        toast.error('Booking record not found.');
      }
    } catch {
      toast.error('Unable to load booking details.');
    }
  };

  return (
    <div className="surgery-page">
      {/* Top Header */}
      <div className="surgery-header">
        <div>
          <h2>Surgery &amp; Procedure Workspace</h2>
          <p>Schedule, verify prerequisites, and manage procedures across operating theaters</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {state.isSuperAdmin ? (
            <select
              className="um-filter"
              onChange={(event) => actions.setBranchId(event.target.value)}
              style={{ minWidth: '170px', fontWeight: 500 }}
              value={state.branchId}
            >
              {state.branches.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          ) : null}
          <button
            className="btn-primary"
            onClick={() => setRecommendationOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '38px',
              padding: '0 16px',
              borderRadius: '8px',
              fontWeight: 600,
            }}
            type="button"
          >
            <i className="ph ph-plus" /> New Recommendation
          </button>
        </div>
      </div>

      {/* 4 Modern Surgery KPI Metric Cards */}
      <section className="surgery-kpi-grid">
        <div className="surgery-kpi">
          <div className="surgery-kpi-icon blue">
            <i className="ph ph-clipboard-text" />
          </div>
          <div className="surgery-kpi-copy">
            <span>Active Recommendations</span>
            <strong>{state.recommendations.filter((item) => item.status === 'ACTIVE').length}</strong>
            <small>Awaiting booking</small>
          </div>
        </div>
        <div className="surgery-kpi">
          <div className="surgery-kpi-icon orange">
            <i className="ph ph-clock-countdown" />
          </div>
          <div className="surgery-kpi-copy">
            <span>Pending Confirmation</span>
            <strong>
              {state.bookings.filter((item) => item.status === 'PENDING_CONFIRMATION').length}
            </strong>
            <small>Prerequisites pending</small>
          </div>
        </div>
        <div className="surgery-kpi">
          <div className="surgery-kpi-icon purple">
            <i className="ph ph-calendar-check" />
          </div>
          <div className="surgery-kpi-copy">
            <span>Booked / Scheduled</span>
            <strong>{state.bookings.filter((item) => item.status === 'BOOKED').length}</strong>
            <small>Confirmed slots</small>
          </div>
        </div>
        <div className="surgery-kpi">
          <div className="surgery-kpi-icon green">
            <i className="ph ph-check-circle" />
          </div>
          <div className="surgery-kpi-copy">
            <span>Completed</span>
            <strong>{state.bookings.filter((item) => item.status === 'COMPLETED').length}</strong>
            <small>Discharged / Done</small>
          </div>
        </div>
      </section>

      {/* Toolbar & Filters */}
      <div className="surgery-toolbar">
        <div className="segmented-control">
          <button
            className={state.tab === 'recommendations' ? 'active' : ''}
            onClick={() => actions.setTab('recommendations')}
            type="button"
          >
            Recommendations
          </button>
          <button
            className={state.tab === 'bookings' ? 'active' : ''}
            onClick={() => actions.setTab('bookings')}
            type="button"
          >
            Bookings
          </button>
          <button
            className={state.tab === 'schedule' ? 'active' : ''}
            onClick={() => actions.setTab('schedule')}
            type="button"
          >
            Schedule
          </button>
        </div>

        <div className="surgery-toolbar-controls">
          <div style={{ position: 'relative', minWidth: '260px' }}>
            <input
              onChange={(event) => actions.setSearchText(event.target.value)}
              placeholder="Number, MRN, patient or procedure..."
              style={{
                width: '100%',
                height: '38px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                padding: '0 10px 0 32px',
                fontSize: '0.84rem',
              }}
              value={state.searchText}
            />
            <i
              className="ph ph-magnifying-glass"
              style={{ position: 'absolute', left: '10px', top: '11px', color: '#94a3b8' }}
            />
          </div>

          <select
            onChange={(event) => actions.setStatus(event.target.value)}
            style={{
              height: '38px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              padding: '0 10px',
              fontSize: '0.84rem',
              background: '#fff',
            }}
            value={state.status}
          >
            <option value="">All statuses</option>
            {state.tab === 'recommendations' ? (
              <>
                <option value="ACTIVE">Active</option>
                <option value="BOOKED">Booked</option>
                <option value="CANCELLED">Cancelled</option>
              </>
            ) : (
              <>
                <option value="PENDING_CONFIRMATION">Pending confirmation</option>
                <option value="BOOKED">Booked</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </>
            )}
          </select>

          {state.tab === 'schedule' ? (
            <input
              onChange={(event) => actions.setDate(event.target.value)}
              style={{
                height: '38px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                padding: '0 10px',
                fontSize: '0.84rem',
                background: '#fff',
              }}
              type="date"
              value={state.date}
            />
          ) : null}
        </div>
      </div>

      {/* Main Tab Views */}
      {state.tab === 'recommendations' ? (
        <SurgeryRecommendationsTab
          isError={state.recommendationsQuery.isError}
          isLoading={state.recommendationsQuery.isLoading}
          onBook={(item) => setBookingFor(item)}
          onCancel={(item) => {
            setBookingFor(item);
            setActionMode('cancel-recommendation');
          }}
          onViewBooking={(bookingId) => void handleViewBooking(bookingId)}
          recommendations={state.recommendations}
          statusTone={statusTone}
        />
      ) : null}

      {state.tab === 'bookings' ? (
        <SurgeryBookingsTab
          bookings={state.bookings}
          displayDate={displayDate}
          isError={state.bookingsQuery.isError}
          isLoading={state.bookingsQuery.isLoading}
          onSelect={(item) => setSelected(item)}
          services={state.services}
          statusTone={statusTone}
        />
      ) : null}

      {state.tab === 'schedule' ? (
        <SurgeryScheduleTab
          date={state.date}
          isError={state.bookingsQuery.isError}
          isLoading={state.bookingsQuery.isLoading}
          onSelect={(item) => setSelected(item)}
          scheduleRows={state.scheduleRows}
          services={state.services}
          statusTone={statusTone}
        />
      ) : null}

      {/* Modal 1: New Procedure Recommendation */}
      <NewProcedureRecommendationModal
        branchId={state.branchId}
        departments={state.departments}
        doctors={state.doctors}
        onClose={() => setRecommendationOpen(false)}
        onCreateSuccess={() => {
          void state.recommendationsQuery.refetch();
        }}
        open={recommendationOpen}
        services={state.services}
      />

      {/* Modal 2: Book Recommended Procedure */}
      <SurgeryBookingCreateModal
        alternatives={state.alternatives}
        alternativesLoading={state.alternativesLoading}
        bookingFor={bookingFor && !actionMode ? bookingFor : null}
        branchId={state.branchId}
        createBooking={actions.createBooking}
        createBookingPending={state.pending.createBooking}
        eligibleDoctors={eligibleDoctors}
        onClose={() => setBookingFor(null)}
        onSuccess={() => {
          void state.recommendationsQuery.refetch();
          void state.bookingsQuery.refetch();
        }}
        procedure={procedure}
        recommendedSlots={state.recommendedSlots}
        setAvailability={actions.setAvailability}
      />

      {/* Modal 3 & 5: Procedure Booking Detail */}
      <SurgeryBookingDetailModal
        booking={viewBookingDetail ?? (actionMode ? null : selected)}
        displayDate={displayDate}
        onCancel={(b) => {
          setSelected(b);
          setActionMode('cancel-booking');
          setViewBookingDetail(null);
        }}
        onClose={() => {
          setViewBookingDetail(null);
          setSelected(null);
        }}
        onComplete={(b) => {
          setSelected(b);
          setActionMode('complete');
          setViewBookingDetail(null);
        }}
        onConfirm={(b) => {
          setSelected(b);
          setActionMode('confirm');
          setViewBookingDetail(null);
        }}
        onReschedule={(b) => {
          setSelected(b);
          setActionMode('reschedule');
          setViewBookingDetail(null);
        }}
        statusTone={statusTone}
      />

      {/* Modal 4: Action Execution Modal */}
      <SurgeryBookingActionModal
        actionMode={actionMode}
        alternatives={state.alternatives}
        alternativesLoading={state.alternativesLoading}
        bookingFor={bookingFor}
        branchId={state.branchId}
        cancelBooking={actions.cancelBooking}
        cancelRecommendation={actions.cancelRecommendation}
        completeBooking={actions.completeBooking}
        confirmBooking={actions.confirmBooking}
        doctors={state.doctors}
        onClose={() => setActionMode(null)}
        onSuccess={() => {
          void state.bookingsQuery.refetch();
          void state.recommendationsQuery.refetch();
        }}
        procedure={procedure}
        recommendedSlots={state.recommendedSlots}
        rescheduleBooking={actions.rescheduleBooking}
        selected={selected}
        setAvailability={actions.setAvailability}
      />
    </div>
  );
}
