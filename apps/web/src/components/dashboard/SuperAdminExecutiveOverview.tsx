import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDashboardOverviewFeature } from '../../hooks/dashboard/useDashboardOverviewFeature';
import { useAuth } from '../../auth/useAuth';
import { useBranchesList } from '../../hooks/branches/useBranches';
import { admissionsConfigurationApi } from '../../api/admissions-configuration';
import { appointmentsApi } from '../../api/appointments';
import { navigate } from '../../routing/navigation';

export function SuperAdminExecutiveOverview() {
  const { user } = useAuth();
  const firstName = user?.fullName?.split(' ')[0] ?? user?.username ?? 'System';
  const { data, isLoading: loading, isError, isFetching, refresh, selectedBranchId, setSelectedBranchId } = useDashboardOverviewFeature();
  const { data: branchesData } = useBranchesList({ limit: 100 });
  const accessibleBranches = branchesData?.data || [];
  const loadError = isError ? 'Executive dashboard metrics could not be updated.' : '';

  // Bed summary query for selected branch
  const effectiveBranchId = selectedBranchId || accessibleBranches[0]?.id;
  const { data: bedSummary } = useQuery({
    queryKey: ['admin-beds-summary', effectiveBranchId],
    queryFn: () => admissionsConfigurationApi.summary(effectiveBranchId!),
    enabled: Boolean(effectiveBranchId),
    staleTime: 60_000,
  });

  // Recent appointments query
  const { data: recentAppointmentsData } = useQuery({
    queryKey: ['admin-recent-appointments', effectiveBranchId],
    queryFn: () => appointmentsApi.list({ branch_id: effectiveBranchId, limit: 5 }),
    enabled: Boolean(effectiveBranchId),
    staleTime: 30_000,
  });

  const appointmentsList = recentAppointmentsData?.data || [];

  // Formatted date string matching screenshot (e.g., Thu, Oct 15, 2026)
  const todayFormatted = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date());
  }, []);

  const totalBeds = bedSummary?.total ?? 0;
  const occupiedBeds = bedSummary?.occupied ?? 0;
  const availableBeds = bedSummary?.available ?? 0;
  const occupancyPercent = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  const maxEncounters = Math.max(1, ...data.trend.map((t) => t.encounters));

  // Department counts derived solely from real recent visits
  const departmentCounts = useMemo(() => {
    const counts: Record<string, number> = {
      'General Medicine': 0,
      Pediatrics: 0,
      Orthopedics: 0,
      Dermatology: 0,
      Cardiology: 0,
      Others: 0,
    };
    if (data.recentVisits.length > 0) {
      data.recentVisits.forEach((v) => {
        const doc = (v.doctor_name || '').toLowerCase();
        const key = doc.includes('ped') || doc.includes('child')
          ? 'Pediatrics'
          : doc.includes('orth')
            ? 'Orthopedics'
            : doc.includes('card')
              ? 'Cardiology'
              : doc.includes('derm')
                ? 'Dermatology'
                : 'General Medicine';
        counts[key] = (counts[key] ?? 0) + 1;
      });
    }
    return counts;
  }, [data.recentVisits]);

  const maxDeptCount = Math.max(...Object.values(departmentCounts), 1);
  const hasDeptVisits = Object.values(departmentCounts).some((count) => count > 0);

  return (
    <div className="super-admin-overview" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%', boxSizing: 'border-box' }}>
      {/* Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#0f172a' }}>Hospital Executive Overview</h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            Welcome back, {firstName}. Here is today's hospital performance and operational overview.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {accessibleBranches.length > 0 ? (
            <select
              className="doc-form-select"
              style={{
                padding: '0.45rem 0.8rem',
                fontSize: '0.825rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontWeight: 500,
              }}
              onChange={(e) => setSelectedBranchId(e.target.value || undefined)}
              value={selectedBranchId || ''}
            >
              <option value="">All Accessible Branches ({accessibleBranches.length})</option>
              {accessibleBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          ) : null}

          <div
            style={{
              padding: '0.45rem 0.8rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              fontSize: '0.825rem',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontWeight: 500,
            }}
          >
            <i className="ph ph-calendar-blank" style={{ fontSize: '1rem', color: '#64748b' }} />
            <span>{todayFormatted}</span>
          </div>

          <button
            onClick={() => refresh()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              fontSize: '0.825rem',
              fontWeight: 600,
              color: '#1e293b',
              cursor: 'pointer',
            }}
            type="button"
          >
            <i className={`ph ph-arrow-clockwise${isFetching ? ' ph-spin' : ''}`} style={{ fontSize: '1rem' }} />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {loadError ? (
        <div style={{ color: '#ef4444', backgroundColor: '#fef2f2', padding: '0.75rem', borderRadius: '8px', border: '1px solid #fecaca' }}>
          {loadError}
        </div>
      ) : null}

      {/* Primary 4 KPI Cards: Balanced Desktop Grid */}
      <div
        className="super-admin-kpi-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '1rem',
        }}
      >
        {/* Registered Patients */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="ph ph-users" style={{ fontSize: '1.35rem' }} />
            </div>
            <div>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Registered Patients</span>
              <h3 style={{ margin: '0.1rem 0 0', fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
                {loading ? '...' : (data.kpis?.registeredPatients ?? 0).toLocaleString()}
              </h3>
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
            Total registered patient records
          </span>
        </div>

        {/* Active Doctors */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="ph ph-stethoscope" style={{ fontSize: '1.35rem' }} />
            </div>
            <div>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Active Doctors</span>
              <h3 style={{ margin: '0.1rem 0 0', fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
                {loading ? '...' : (data.kpis?.activeDoctors ?? 0).toLocaleString()}
              </h3>
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
            On-duty clinical staff
          </span>
        </div>

        {/* Today's Appointments */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#fff7ed', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="ph ph-calendar-check" style={{ fontSize: '1.35rem' }} />
            </div>
            <div>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Today's Appointments</span>
              <h3 style={{ margin: '0.1rem 0 0', fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
                {loading ? '...' : (data.kpis?.todayAppointments ?? 0).toLocaleString()}
              </h3>
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
            Bookings & encounters
          </span>
        </div>

        {/* OPD Visits Today */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#faf5ff', color: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="ph ph-first-aid" style={{ fontSize: '1.35rem' }} />
            </div>
            <div>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>OPD Visits Today</span>
              <h3 style={{ margin: '0.1rem 0 0', fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
                {loading ? '...' : (data.kpis?.todayOpdVisits ?? 0).toLocaleString()}
              </h3>
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
            Checked-in patient visits
          </span>
        </div>
      </div>

      {/* Operational 3 Real Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem' }} className="super-admin-operational-grid">
        {/* Patients Waiting */}
        <div
          onClick={() => navigate('/opd/queue')}
          style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'border-color 0.15s' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#fff7ed', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ph ph-hourglass" style={{ fontSize: '1.3rem' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Patients Waiting</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f172a' }}>{loading ? '...' : data.operationalMetrics.patientsWaiting}</div>
            </div>
          </div>
          <i className="ph ph-caret-right" style={{ color: '#94a3b8', fontSize: '1rem' }} />
        </div>

        {/* In Consultation */}
        <div
          onClick={() => navigate('/opd/queue')}
          style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'border-color 0.15s' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ph ph-user-focus" style={{ fontSize: '1.3rem' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>In Consultation</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f172a' }}>{loading ? '...' : data.operationalMetrics.patientsInConsultation}</div>
            </div>
          </div>
          <i className="ph ph-caret-right" style={{ color: '#94a3b8', fontSize: '1rem' }} />
        </div>

        {/* Completed Today */}
        <div
          onClick={() => navigate('/opd/queue')}
          style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'border-color 0.15s' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ph ph-check-circle" style={{ fontSize: '1.3rem' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Completed Today</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f172a' }}>{loading ? '...' : data.operationalMetrics.completedConsultationsToday}</div>
            </div>
          </div>
          <i className="ph ph-caret-right" style={{ color: '#94a3b8', fontSize: '1rem' }} />
        </div>
      </div>

      {/* Main Analytics: 2 Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '1rem' }} className="super-admin-analytics-grid">
        {/* Left: 7-Day Encounter Flow */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>7-Day Encounter Flow</h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>Outpatient encounter volume for the selected branch scope</p>
            </div>
            <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.8rem', fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#2563eb' }}>
                <span style={{ width: '8px', height: '8px', backgroundColor: '#2563eb', borderRadius: '50%', display: 'inline-block' }} />
                Encounters
              </span>
            </div>
          </div>

          {loading ? (
            <div style={{ height: '190px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Loading encounters...</div>
          ) : data.trend.length === 0 ? (
            <div style={{ height: '190px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
              No encounter history recorded for the current week.
            </div>
          ) : (
            <div>
              <svg aria-label="Seven-day encounter chart" preserveAspectRatio="none" style={{ display: 'block', height: '170px', width: '100%' }} viewBox="0 0 700 170">
                {[0, 1, 2, 3, 4].map((i) => (
                  <line key={i} stroke="#f1f5f9" strokeDasharray="3 3" strokeWidth="1" x1="30" x2="680" y1={15 + i * 32} y2={15 + i * 32} />
                ))}

                {/* Real Encounter curve */}
                {(() => {
                  const pts = data.trend.map((pt, idx) => {
                    const x = 50 + idx * (600 / Math.max(1, data.trend.length - 1));
                    const y = 145 - Math.min(120, (pt.encounters / maxEncounters) * 115);
                    return { x, y };
                  });
                  const pathStr = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                  const lastX = pts[pts.length - 1]?.x ?? 680;
                  const firstX = pts[0]?.x ?? 50;
                  const areaStr = pts.length > 0 ? `${pathStr} L ${lastX} 145 L ${firstX} 145 Z` : '';

                  return (
                    <g key="encounters-curve">
                      <defs>
                        <linearGradient id="opd-flow-grad" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      {areaStr && <path d={areaStr} fill="url(#opd-flow-grad)" />}
                      {pathStr && <path d={pathStr} fill="none" stroke="#2563eb" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />}
                      {pts.map((p, idx) => (
                        <circle cx={p.x} cy={p.y} fill="#2563eb" key={idx} r="3.5" stroke="#ffffff" strokeWidth="2" />
                      ))}
                    </g>
                  );
                })()}
              </svg>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 1rem 0' }}>
                {data.trend.map((pt) => (
                  <span key={pt.date} style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{pt.day}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Department-wise OPD Visits */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>Department-wise OPD Visits</h3>
            <button onClick={() => navigate('/opd/queue')} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }} type="button">
              View All
            </button>
          </div>

          {!hasDeptVisits ? (
            <div style={{ height: '170px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
              No department visits recorded today.
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.5rem', height: '170px', paddingBottom: '0.5rem' }}>
              {Object.entries(departmentCounts).map(([dept, count], idx) => {
                const barHeight = Math.max(8, (count / maxDeptCount) * 120);
                const colors = ['#3b82f6', '#38bdf8', '#34d399', '#fbbf24', '#a855f7', '#94a3b8'];
                const color = colors[idx % colors.length]!;

                return (
                  <div key={dept} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>{count}</span>
                    <div style={{ width: '28px', height: `${barHeight}px`, background: color, borderRadius: '4px 4px 0 0' }} />
                    <span
                      style={{
                        fontSize: '0.65rem',
                        color: '#64748b',
                        marginTop: '0.4rem',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        width: '100%',
                      }}
                      title={dept}
                    >
                      {dept.split(' ')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bed Occupancy & Operational Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)', gap: '1rem' }} className="super-admin-bed-grid">
        {/* Real Bed Occupancy */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.75rem' }}>Inpatient Bed Occupancy</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ position: 'relative', width: '74px', height: '74px', flexShrink: 0 }}>
              <svg height="74" viewBox="0 0 36 36" width="74">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f1f5f9" strokeWidth="4.2" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={occupancyPercent > 80 ? '#ef4444' : '#2563eb'} strokeDasharray={`${occupancyPercent}, 100`} strokeWidth="4.2" />
              </svg>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{occupancyPercent}%</span>
                <span style={{ fontSize: '0.55rem', color: '#64748b' }}>Occupied</span>
              </div>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <div><span style={{ color: '#ef4444' }}>●</span> Occupied Beds: <strong style={{ color: '#0f172a' }}>{occupiedBeds}</strong></div>
              <div><span style={{ color: '#16a34a' }}>●</span> Available Beds: <strong style={{ color: '#0f172a' }}>{availableBeds}</strong></div>
              <div>Total Configured Beds: <strong style={{ color: '#0f172a' }}>{totalBeds}</strong></div>
            </div>
          </div>
        </div>

        {/* Operational Scope Overview */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Hospital Scope & Activity Overview</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Active Doctors</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>{data.kpis?.activeDoctors ?? 0}</div>
              <div style={{ fontSize: '0.7rem', color: '#16a34a', marginTop: '0.15rem' }}>Verified records</div>
            </div>
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Encounters Today</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>{data.kpis?.todayOpdVisits ?? 0}</div>
              <div style={{ fontSize: '0.7rem', color: '#2563eb', marginTop: '0.15rem' }}>Checked-in visits</div>
            </div>
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Appointments</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>{data.kpis?.todayAppointments ?? 0}</div>
              <div style={{ fontSize: '0.7rem', color: '#ea580c', marginTop: '0.15rem' }}>Scheduled today</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom 3 Real Information Panels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '1rem' }}>
        {/* Recent Appointments */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>Recent Appointments</h3>
            <button onClick={() => navigate('/appointments')} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }} type="button">
              View All
            </button>
          </div>
          {appointmentsList.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>No recent appointments scheduled today.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#64748b', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem 0.25rem' }}>Time</th>
                    <th style={{ padding: '0.5rem 0.25rem' }}>Patient Name</th>
                    <th style={{ padding: '0.5rem 0.25rem' }}>Doctor</th>
                    <th style={{ padding: '0.5rem 0.25rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {appointmentsList.map((apt) => (
                    <tr key={apt.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '0.5rem 0.25rem', color: '#475569' }}>{apt.start_time || '—'}</td>
                      <td style={{ padding: '0.5rem 0.25rem', fontWeight: 600, color: '#0f172a' }}>{apt.patient_name}</td>
                      <td style={{ padding: '0.5rem 0.25rem', color: '#64748b' }}>{apt.doctor_name}</td>
                      <td style={{ padding: '0.5rem 0.25rem' }}>
                        <span className={`status-badge ${apt.status === 'CHECKED_IN' ? 'green' : 'neutral'}`} style={{ fontSize: '0.7rem' }}>
                          {apt.status.replaceAll('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent OPD Encounters */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>Recent OPD Encounters</h3>
            <button onClick={() => navigate('/opd/queue')} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }} type="button">
              View All
            </button>
          </div>
          {data.recentVisits.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>No OPD visits recorded today.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#64748b', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem 0.25rem' }}>Time</th>
                    <th style={{ padding: '0.5rem 0.25rem' }}>Patient Name</th>
                    <th style={{ padding: '0.5rem 0.25rem' }}>Attending</th>
                    <th style={{ padding: '0.5rem 0.25rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentVisits.slice(0, 5).map((visit) => (
                    <tr key={visit.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '0.5rem 0.25rem', color: '#475569' }}>
                        {new Date(visit.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '0.5rem 0.25rem', fontWeight: 600, color: '#0f172a' }}>{visit.patient_name}</td>
                      <td style={{ padding: '0.5rem 0.25rem', color: '#64748b' }}>{visit.doctor_name}</td>
                      <td style={{ padding: '0.5rem 0.25rem' }}>
                        <span className={`status-badge ${visit.status === 'COMPLETED' ? 'green' : 'neutral'}`} style={{ fontSize: '0.7rem' }}>
                          {visit.status.replaceAll('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Operational Attention Alerts (Real State Driven) */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>Operational Attention</h3>
            <button onClick={() => navigate('/opd/queue')} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }} type="button">
              Queue
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {data.operationalMetrics.patientsWaiting > 0 ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.65rem', background: '#fff7ed', borderRadius: '8px' }}>
                <i className="ph ph-hourglass-medium" style={{ color: '#ea580c', fontSize: '1.25rem', marginTop: '2px', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#9a3412' }}>OPD Patients Waiting</div>
                  <div style={{ fontSize: '0.75rem', color: '#7c2d12' }}>{data.operationalMetrics.patientsWaiting} patient(s) ready or waiting for vitals</div>
                </div>
              </div>
            ) : null}

            {data.kpis?.activeDoctors === 0 ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.65rem', background: '#fef2f2', borderRadius: '8px' }}>
                <i className="ph ph-warning" style={{ color: '#ef4444', fontSize: '1.25rem', marginTop: '2px', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#991b1b' }}>Doctor Coverage</div>
                  <div style={{ fontSize: '0.75rem', color: '#7f1d1d' }}>No active doctors are currently marked available</div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.65rem', background: '#f0fdf4', borderRadius: '8px' }}>
                <i className="ph ph-check-circle" style={{ color: '#16a34a', fontSize: '1.25rem', marginTop: '2px', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#166534' }}>Clinical Coverage Active</div>
                  <div style={{ fontSize: '0.75rem', color: '#14532d' }}>{data.kpis?.activeDoctors} active doctor(s) on duty</div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.65rem', background: '#eff6ff', borderRadius: '8px' }}>
              <i className="ph ph-info" style={{ color: '#2563eb', fontSize: '1.25rem', marginTop: '2px', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e40af' }}>Today's Encounters</div>
                <div style={{ fontSize: '0.75rem', color: '#1e3a8a' }}>{data.kpis?.todayOpdVisits} patient(s) registered for today</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
