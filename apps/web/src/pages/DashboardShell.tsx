import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import { useDashboardOverviewFeature } from '../hooks/dashboard/useDashboardOverviewFeature';
import { useAuth } from '../auth/useAuth';
import {
  getAccessibleSidebarModules,
  hasPermission,
  isSuperAdministrator,
} from '../auth/access-control';
import type { AuthUser } from '../auth/auth-types';
import { navigate, useAppLocation } from '../routing/navigation';
import { formatDateTime } from './patient-utils';
import { MedicalLoader } from '../components/ui/MedicalLoader';
import { useCurrencyFormatter } from '../api/useSettings';

const DoctorDashboardPage = lazy(() => import('./DoctorDashboardPage').then((m) => ({ default: m.DoctorDashboardPage })));
const AppointmentDashboardPage = lazy(() => import('./AppointmentDashboardPage').then((m) => ({ default: m.AppointmentDashboardPage })));
const OpdDashboardPage = lazy(() => import('./OpdDashboardPage').then((m) => ({ default: m.OpdDashboardPage })));
const BillingDashboardPage = lazy(() => import('./BillingDashboardPage').then((m) => ({ default: m.BillingDashboardPage })));
const AdministrationDashboardPage = lazy(() => import('./AdministrationDashboardPage').then((m) => ({ default: m.AdministrationDashboardPage })));
const PharmacyQueueDashboardPage = lazy(() => import('./PharmacyQueueDashboardPage').then((m) => ({ default: m.PharmacyQueueDashboardPage })));
const PharmacyInventoryDashboardPage = lazy(() => import('./PharmacyInventoryDashboardPage').then((m) => ({ default: m.PharmacyInventoryDashboardPage })));
const LaboratoryDashboardPage = lazy(() => import('./LaboratoryDashboardPage').then((m) => ({ default: m.LaboratoryDashboardPage })));
const ImagingDashboardPage = lazy(() => import('./ImagingDashboardPage').then((m) => ({ default: m.ImagingDashboardPage })));

function DashboardSuspenseFallback({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={`Loading ${label}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '280px',
        padding: '2rem',
      }}
    >
      <MedicalLoader text={`Loading ${label}…`} subtext="Retrieving workspace telemetry" />
    </div>
  );
}

const withSuspense = (label: string, component: ReactNode) => (
  <Suspense fallback={<DashboardSuspenseFallback label={label} />}>
    {component}
  </Suspense>
);


import { useBranchesList } from '../hooks/branches/useBranches';

type StatCardProps = {
  icon: string;
  label: string;
  note: string;
  tone: 'blue' | 'green' | 'orange' | 'purple' | 'red';
  value: string | number;
};

function StatCard({ icon, label, note, tone, value }: StatCardProps) {
  return (
    <div className="stat-card" style={{ minWidth: 0, padding: '1rem', display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
      <div className={`stat-icon ${tone}`} style={{ flexShrink: 0 }}>
        <i className={`ph ${icon}`} aria-hidden="true" style={{ fontSize: '1.5rem' }} />
      </div>
      <div className="stat-info" style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
        <p style={{ margin: 0, fontSize: '0.825rem', fontWeight: 600, color: '#64748b', whiteSpace: 'normal', lineHeight: 1.2 }}>{label}</p>
        <h3 style={{ margin: '0.2rem 0', fontSize: '1.35rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </h3>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note}</span>
      </div>
    </div>
  );
}

function getSplinePath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  const first = pts[0];
  if (!first) return '';
  if (pts.length === 1) return `M ${first.x} ${first.y}`;
  let path = `M ${first.x} ${first.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1] ?? first;
    const p1 = pts[i] ?? first;
    const p2 = pts[i + 1] ?? p1;
    const p3 = pts[i + 2 >= pts.length ? pts.length - 1 : i + 2] ?? p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return path;
}

function ExecutiveOverviewTab({ onSelectTab }: { onSelectTab?: (key: string) => void }) {
  const { user } = useAuth();
  const formatCurrency = useCurrencyFormatter();
  const firstName = user?.fullName?.split(' ')[0] ?? user?.username ?? 'Doctor';
  const [chartRange, setChartRange] = useState<'week' | 'month' | 'year'>('week');
  const { data, isLoading: loading, isError, isFetching, refresh, selectedBranchId, setSelectedBranchId } = useDashboardOverviewFeature(chartRange);
  const { data: branchesData } = useBranchesList({ limit: 100 });

  const accessibleBranches = branchesData?.data || [];
  const loadError = isError ? 'Executive dashboard metrics could not be updated.' : '';

  // Calendar week days strip with reactive navigation
  const now = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [weekOffset, setWeekOffset] = useState(0);

  const monday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    const dayOfWeek = (d.getDay() + 6) % 7; // Mon = 0
    d.setDate(d.getDate() - dayOfWeek);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [weekOffset]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const isSelected =
        d.getFullYear() === selectedDate.getFullYear() &&
        d.getMonth() === selectedDate.getMonth() &&
        d.getDate() === selectedDate.getDate();
      const isRealToday =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();

      return {
        date: d,
        dayNum: d.getDate(),
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        isSelected,
        isRealToday,
      };
    });
  }, [monday, selectedDate, now]);

  const isSelectedDateToday =
    selectedDate.getFullYear() === now.getFullYear() &&
    selectedDate.getMonth() === now.getMonth() &&
    selectedDate.getDate() === now.getDate();

  const formattedSelectedDate = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(selectedDate);

  // Live dynamic trend data points directly from backend
  const trendList = useMemo(() => {
    return data?.trend ?? [];
  }, [data?.trend]);

  const numPts = trendList.length;
  const maxVal = Math.max(5, ...trendList.map((t) => t.encounters));
  const stepX = numPts > 1 ? 600 / (numPts - 1) : 300;

  // Compute curve 1 points (Total patients / encounters)
  const ptsCurve1 = trendList.map((pt, idx) => {
    const x = 50 + idx * stepX;
    const y = 160 - (pt.encounters / maxVal) * 110;
    return { x, y };
  });

  const curve1Path = getSplinePath(ptsCurve1);
  const firstPt = ptsCurve1[0];
  const lastPt = ptsCurve1[ptsCurve1.length - 1];
  const area1Path = firstPt && lastPt
    ? `${curve1Path} L ${lastPt.x} 175 L ${firstPt.x} 175 Z`
    : '';

  // Peak index for the highlight capsule marker
  let peakIdx = 0;
  trendList.forEach((pt, idx) => {
    const currPeak = trendList[peakIdx];
    if (currPeak && pt.encounters > currPeak.encounters) peakIdx = idx;
  });
  const peakPt = ptsCurve1[peakIdx] ?? ptsCurve1[0] ?? { x: 350, y: 50 };
  const peakVal = trendList[peakIdx]?.encounters ?? 0;

  // Date formatting for header pill
  const formattedToday = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now);

  const waiting = data.operationalMetrics?.patientsWaiting ?? 0;
  const inConsultation = data.operationalMetrics?.patientsInConsultation ?? 0;
  const completed = data.operationalMetrics?.completedConsultationsToday ?? 0;
  const activeFlowTotal = waiting + inConsultation;

  const balancePercentage = data.financialSummary?.totalBilledAmount
    ? Math.min(100, Math.round(((data.financialSummary.collectedFunds ?? 0) / data.financialSummary.totalBilledAmount) * 100))
    : (completed + activeFlowTotal > 0 ? Math.min(100, Math.round((completed / (completed + activeFlowTotal)) * 100)) : 0);

  // Filter live visits for the selected day in timeline
  const dayVisits = useMemo(() => {
    if (!data.recentVisits || data.recentVisits.length === 0) return [];
    return data.recentVisits.filter((v) => {
      if (!v.check_in_time) return false;
      const vDate = new Date(v.check_in_time);
      return (
        vDate.getFullYear() === selectedDate.getFullYear() &&
        vDate.getMonth() === selectedDate.getMonth() &&
        vDate.getDate() === selectedDate.getDate()
      );
    });
  }, [data.recentVisits, selectedDate]);

  return (
    <div className="hms-dash-wrapper">
      {/* Header & Greeting Bar */}
      <div className="hms-dash-greeting">
        <div className="hms-greeting-left">
          <div className="hms-dash-scope-tag">
            <i className="ph ph-shield-check" aria-hidden="true" /> Hospital Executive Overview
          </div>
          <h2 className="hms-greeting-title">Hello, {firstName} 👋</h2>
          <p className="hms-greeting-sub">Live operational and clinical activity for your hospital network.</p>
        </div>
        <div className="hms-greeting-right">
          {accessibleBranches.length > 1 ? (
            <select
              aria-label="Dashboard branch"
              className="hms-dash-select"
              value={selectedBranchId ?? ''}
              onChange={(e) => setSelectedBranchId(e.target.value || undefined)}
            >
              <option value="">All Accessible Branches ({accessibleBranches.length})</option>
              {accessibleBranches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          ) : null}
          <button
            className="hms-date-pill"
            onClick={() => (onSelectTab ? onSelectTab('appointments') : navigate('/appointments'))}
            title="Open appointment calendar"
            type="button"
          >
            <i className="ph ph-calendar" aria-hidden="true" />
            <span>{formattedToday}</span>
          </button>
          <button
            className="hms-dash-btn secondary"
            disabled={loading || isFetching}
            onClick={() => refresh()}
            type="button"
          >
            <i className={`ph ph-arrow-clockwise${isFetching ? ' ph-spin' : ''}`} aria-hidden="true" />
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="um-state-cell" role="alert" style={{ color: '#ef4444', backgroundColor: '#fef2f2', padding: '0.75rem', borderRadius: '12px' }}>
          {loadError}
        </div>
      ) : null}

      {/* Top 4 KPI Row (Live values only, brand blue) */}
      <div className="hms-dash-kpi-grid">
        {/* Card 1: Hero Royal Blue Gradient Card */}
        <div
          className="hms-dash-kpi-card hero"
          onClick={() => (onSelectTab ? onSelectTab('appointments') : navigate('/appointments'))}
          role="button"
          tabIndex={0}
          title="Open Appointments workspace"
        >
          <div className="hms-kpi-top">
            <span className="hms-kpi-icon hero-circle">
              <i className="ph ph-calendar-check" aria-hidden="true" />
            </span>
            <span className="hms-kpi-label">Appointments</span>
          </div>
          <div className="hms-kpi-bottom">
            <div className="hms-kpi-value">
              {loading || !data ? '—' : (data.kpis?.todayAppointments ?? 0).toLocaleString()}
            </div>
            <span className="hms-kpi-subtext" style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <i className="ph ph-calendar-check" /> Today's bookings
            </span>
          </div>
        </div>

        {/* Card 2: Active Doctors */}
        <div
          className="hms-dash-kpi-card"
          onClick={() => (onSelectTab ? onSelectTab('doctors') : navigate('/doctors'))}
          role="button"
          tabIndex={0}
          title="Open Doctors directory"
        >
          <div className="hms-kpi-top">
            <span className="hms-kpi-icon phone-blue">
              <i className="ph ph-phone-call" aria-hidden="true" />
            </span>
            <span className="hms-kpi-label">Active Doctors</span>
          </div>
          <div className="hms-kpi-bottom">
            <div className="hms-kpi-value">
              {loading || !data ? '—' : (data.kpis?.activeDoctors ?? 0).toLocaleString()}
            </div>
            <span className="hms-kpi-subtext" style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <i className="ph ph-stethoscope" /> On-duty clinical staff
            </span>
          </div>
        </div>

        {/* Card 3: OPD Visits Today */}
        <div
          className="hms-dash-kpi-card"
          onClick={() => (onSelectTab ? onSelectTab('opd') : navigate('/opd'))}
          role="button"
          tabIndex={0}
          title="Open OPD workspace"
        >
          <div className="hms-kpi-top">
            <span className="hms-kpi-icon doctor-cyan">
              <i className="ph ph-first-aid" aria-hidden="true" />
            </span>
            <span className="hms-kpi-label">OPD Visits</span>
          </div>
          <div className="hms-kpi-bottom">
            <div className="hms-kpi-value">
              {loading || !data ? '—' : (data.kpis?.todayOpdVisits ?? 0).toLocaleString()}
            </div>
            <span className="hms-kpi-subtext" style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <i className="ph ph-users" /> {waiting} currently in queue
            </span>
          </div>
        </div>

        {/* Card 4: Total Patients */}
        <div
          className="hms-dash-kpi-card"
          onClick={() => navigate('/patients')}
          role="button"
          tabIndex={0}
          title="Open Patients directory"
        >
          <div className="hms-kpi-top">
            <span className="hms-kpi-icon patient-teal">
              <i className="ph ph-handshake" aria-hidden="true" />
            </span>
            <span className="hms-kpi-label">Total Patients</span>
          </div>
          <div className="hms-kpi-bottom">
            <div className="hms-kpi-value">
              {loading || !data ? '—' : (data.kpis?.registeredPatients ?? 0).toLocaleString()}
            </div>
            <span className="hms-kpi-subtext" style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <i className="ph ph-identification-card" /> Registered patient directory
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Column (Chart + 3 Bottom Cards) / Right Column (Today's Schedule & Calendar) */}
      <div className="hms-dash-grid two-col-7-5">
        {/* ── Left Column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Patient Statistics Spline Wave Chart */}
          <div className="hms-dash-card">
            <div className="hms-card-header">
              <div className="hms-card-header-left">
                <h3 className="hms-card-title">Patient statistics</h3>
              </div>
              <div className="hms-chart-pills">
                <button
                  className={`hms-chart-pill-btn${chartRange === 'week' ? ' active' : ''}`}
                  onClick={() => setChartRange('week')}
                  type="button"
                >
                  Week
                </button>
                <button
                  className={`hms-chart-pill-btn${chartRange === 'month' ? ' active' : ''}`}
                  onClick={() => setChartRange('month')}
                  type="button"
                >
                  Month
                </button>
                <button
                  className={`hms-chart-pill-btn${chartRange === 'year' ? ' active' : ''}`}
                  onClick={() => setChartRange('year')}
                  type="button"
                >
                  <i className="ph ph-calendar-blank" style={{ marginRight: '4px' }} /> Year-{now.getFullYear()}
                </button>
              </div>
            </div>
            <div className="hms-card-body" style={{ padding: '1rem 1.35rem 1.25rem' }}>
              {loading ? (
                <div className="hms-dash-empty">
                  <i className="ph ph-chart-line" />
                  <div className="hms-dash-empty-title">Loading patient statistics...</div>
                </div>
              ) : trendList.length === 0 ? (
                <div className="hms-dash-empty" style={{ padding: '3rem 1rem' }}>
                  <i className="ph ph-chart-line" style={{ fontSize: '2rem', color: '#94a3b8' }} />
                  <div className="hms-dash-empty-title">No patient statistics recorded for this period</div>
                  <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Data updates live as visits and consultations occur.</p>
                </div>
              ) : (
                <div className="hms-chart-wrap">
                  <svg
                    aria-label="Patient statistics spline chart"
                    className="hms-chart-svg"
                    preserveAspectRatio="none"
                    role="img"
                    style={{ height: '220px' }}
                    viewBox="0 0 700 210"
                  >
                    <defs>
                      <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity="0.22" />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="capsuleGrad" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#1d4ed8" />
                        <stop offset="100%" stopColor="#60a5fa" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Dashed Gridlines with Dynamic Y Labels */}
                    {(() => {
                      const yGridMax = Math.max(10, Math.ceil(maxVal / 10) * 10);
                      const step = Math.round(yGridMax / 3);
                      return [
                        { y: 35, val: yGridMax.toString() },
                        { y: 80, val: (step * 2).toString() },
                        { y: 125, val: step.toString() },
                        { y: 170, val: '0' },
                      ].map((grid) => (
                        <g key={grid.y}>
                          <text x="30" y={grid.y + 4} fill="#94a3b8" fontSize="11" fontWeight="600" textAnchor="end">
                            {grid.val}
                          </text>
                          <line
                            className="hms-chart-gridline"
                            x1="38"
                            x2="680"
                            y1={grid.y}
                            y2={grid.y}
                          />
                        </g>
                      ));
                    })()}

                    {/* Curve 1 Area Fill */}
                    {area1Path && <path d={area1Path} fill="url(#areaGrad)" />}

                    {/* Peak Highlight Vertical Capsule Marker */}
                    {peakPt && peakVal > 0 && (
                      <g>
                        <rect
                          fill="url(#capsuleGrad)"
                          height="135"
                          rx="13"
                          width="26"
                          x={peakPt.x - 13}
                          y={35}
                        />
                        <circle
                          cx={peakPt.x}
                          cy={peakPt.y}
                          fill="#ffffff"
                          r="5.5"
                          stroke="#1d4ed8"
                          strokeWidth="3.5"
                        />
                        {/* Peak Badge */}
                        <rect
                          fill="#1e3a8a"
                          height="24"
                          rx="12"
                          width="56"
                          x={peakPt.x - 28}
                          y={peakPt.y - 34}
                        />
                        <text
                          fill="#ffffff"
                          fontSize="11"
                          fontWeight="800"
                          textAnchor="middle"
                          x={peakPt.x}
                          y={peakPt.y - 18}
                        >
                          {peakVal.toLocaleString()}
                        </text>
                      </g>
                    )}

                    {/* Curve 1: Blue Wave (Total Patient Encounters) */}
                    {curve1Path && (
                      <path
                        d={curve1Path}
                        fill="none"
                        stroke="#2563eb"
                        strokeLinecap="round"
                        strokeWidth="3"
                      />
                    )}
                  </svg>

                  {/* X Axis Labels */}
                  <div className="hms-chart-axis-labels">
                    {trendList.map((pt, idx) => {
                      const showLabel =
                        chartRange === 'week' ||
                        chartRange === 'year' ||
                        idx % 5 === 0 ||
                        idx === numPts - 1;
                      return (
                        <div
                          className="hms-chart-axis-item"
                          key={pt.date || pt.day || idx}
                          style={{ width: `${100 / numPts}%`, opacity: showLabel ? 1 : 0 }}
                        >
                          {showLabel ? pt.day.toUpperCase() : ''}
                        </div>
                      );
                    })}
                  </div>

                  {/* Chart Legend */}
                  <div className="hms-chart-legend">
                    <span className="hms-legend-item">
                      <span className="hms-legend-dot dark" /> Total patient encounters
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom 3 Cards: Balance / Room Occupancy / Reports */}
          <div className="hms-dash-grid three-col-equal">
            {/* Card 1: Balance / Consultation Flow */}
            <div className="hms-dash-card">
              <div className="hms-card-header">
                <h4 className="hms-card-title">Balance</h4>
                <button
                  className="hms-report-link"
                  onClick={() => (onSelectTab ? onSelectTab('billing') : navigate('/billing/history'))}
                  style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}
                  type="button"
                >
                  Open <i className="ph ph-arrow-up-right" />
                </button>
              </div>
              <div className="hms-card-body" style={{ padding: '0.95rem 1.15rem' }}>
                <div className="hms-donut-card-content">
                  <div className="hms-donut-wrap">
                    <svg height="84" viewBox="0 0 84 84" width="84">
                      <circle cx="42" cy="42" fill="none" r="32" stroke="#e2e8f0" strokeWidth="8" />
                      <circle
                        cx="42"
                        cy="42"
                        fill="none"
                        r="32"
                        stroke="#2563eb"
                        strokeDasharray={201}
                        strokeDashoffset={201 - (201 * balancePercentage) / 100}
                        strokeLinecap="round"
                        strokeWidth="8"
                        transform="rotate(-90 42 42)"
                      />
                    </svg>
                    <div className="hms-donut-center">{balancePercentage}%</div>
                  </div>
                  <div className="hms-donut-info">
                    {data.financialSummary ? (
                      <>
                        <div className="hms-spark-stat">
                          <div>
                            <small>Collected</small>
                            <strong>{formatCurrency(data.financialSummary.collectedFunds ?? 0)}</strong>
                          </div>
                        </div>
                        <div className="hms-spark-stat">
                          <div>
                            <small>Pending</small>
                            <strong>{formatCurrency(data.financialSummary.pendingOutstanding ?? 0)}</strong>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="hms-spark-stat">
                          <div>
                            <small>Total flow</small>
                            <strong>{(completed + activeFlowTotal).toLocaleString()}</strong>
                          </div>
                        </div>
                        <div className="hms-spark-stat">
                          <div>
                            <small>In queue</small>
                            <strong>{waiting.toLocaleString()}</strong>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Room occupancy */}
            <div className="hms-dash-card">
              <div className="hms-card-header">
                <h4 className="hms-card-title">Room occupancy</h4>
                <button
                  aria-label="Room options"
                  className="hms-event-menu"
                  onClick={() => navigate('/admissions/bed-availability')}
                  title="View Bed Availability"
                  type="button"
                >
                  <i className="ph ph-arrow-up-right" />
                </button>
              </div>
              <div className="hms-card-body" style={{ padding: '0.95rem 1.15rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>
                    {activeFlowTotal}
                  </span>
                  <span className="hms-kpi-subtext" style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    active in facility
                  </span>
                </div>
                <div
                  className="hms-occupancy-item"
                  onClick={() => (onSelectTab ? onSelectTab('opd') : navigate('/opd'))}
                  role="button"
                  style={{ cursor: 'pointer' }}
                  tabIndex={0}
                >
                  <div className="hms-occupancy-left">
                    <div className="hms-occupancy-icon">
                      <i className="ph ph-stethoscope" />
                    </div>
                    <span className="hms-occupancy-label">In Consultation</span>
                  </div>
                  <strong className="hms-occupancy-val">{inConsultation}</strong>
                </div>
                <div
                  className="hms-occupancy-item"
                  onClick={() => (onSelectTab ? onSelectTab('opd') : navigate('/opd'))}
                  role="button"
                  style={{ cursor: 'pointer' }}
                  tabIndex={0}
                >
                  <div className="hms-occupancy-left">
                    <div className="hms-occupancy-icon">
                      <i className="ph ph-clock" />
                    </div>
                    <span className="hms-occupancy-label">Waiting in Queue</span>
                  </div>
                  <strong className="hms-occupancy-val">{waiting}</strong>
                </div>
              </div>
            </div>

            {/* Card 3: Reports */}
            <div className="hms-dash-card">
              <div className="hms-card-header">
                <h4 className="hms-card-title">Reports</h4>
                <button
                  aria-label="Report options"
                  className="hms-event-menu"
                  onClick={() => navigate('/reports/library')}
                  title="View all reports"
                  type="button"
                >
                  <i className="ph ph-arrow-up-right" />
                </button>
              </div>
              <div className="hms-card-body" style={{ padding: '0.95rem 1.15rem' }}>
                {data.recentVisits.length > 0 ? (
                  data.recentVisits.slice(0, 2).map((visit) => (
                    <div
                      className="hms-report-item"
                      key={visit.id}
                      onClick={() => navigate(`/opd/visit?id=${encodeURIComponent(visit.id)}`)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="hms-report-icon">
                        <i className="ph ph-clipboard-text" />
                      </div>
                      <div className="hms-report-body">
                        <div className="hms-report-title">{visit.patient_name}</div>
                        <div className="hms-report-meta">
                          <span>{formatDateTime(visit.check_in_time)}</span>
                          <span className="hms-report-link">View visit →</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="hms-dash-empty" style={{ padding: '1rem', textAlign: 'center' }}>
                    <i className="ph ph-clipboard-text" style={{ fontSize: '1.5rem', color: '#94a3b8' }} />
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginTop: '0.25rem' }}>
                      No recent consultation reports
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                      Completed visits will appear here.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Column: Today's Schedule & Mini Calendar ── */}
        <div>
          <div className="hms-dash-card" style={{ height: '100%' }}>
            <div className="hms-card-header">
              <div className="hms-card-header-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ph ph-calendar-check" style={{ color: '#2563eb', fontSize: '1.25rem' }} />
                <h3 className="hms-card-title">
                  {isSelectedDateToday ? 'Today, ' : ''}
                  {formattedSelectedDate}
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  aria-label="Previous week"
                  className="hms-event-menu"
                  onClick={() => {
                    setWeekOffset((prev) => prev - 1);
                    const prevD = new Date(selectedDate);
                    prevD.setDate(prevD.getDate() - 7);
                    setSelectedDate(prevD);
                  }}
                  title="Previous week"
                  type="button"
                >
                  <i className="ph ph-caret-left" />
                </button>
                {weekOffset !== 0 ? (
                  <button
                    className="hms-chart-pill-btn"
                    onClick={() => {
                      setWeekOffset(0);
                      setSelectedDate(new Date());
                    }}
                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                    type="button"
                  >
                    Today
                  </button>
                ) : null}
                <button
                  aria-label="Next week"
                  className="hms-event-menu"
                  onClick={() => {
                    setWeekOffset((prev) => prev + 1);
                    const nextD = new Date(selectedDate);
                    nextD.setDate(nextD.getDate() + 7);
                    setSelectedDate(nextD);
                  }}
                  title="Next week"
                  type="button"
                >
                  <i className="ph ph-caret-right" />
                </button>
                <button
                  aria-label="Add schedule item"
                  className="hms-event-menu"
                  onClick={() => (onSelectTab ? onSelectTab('appointments') : navigate('/appointments'))}
                  style={{ color: '#2563eb', fontSize: '1.25rem' }}
                  title="Book appointment or add schedule"
                  type="button"
                >
                  <i className="ph ph-plus-circle-fill" />
                </button>
              </div>
            </div>
            <div className="hms-card-body">
              {/* Horizontal 7-Day Week Strip */}
              <div className="hms-week-strip">
                {weekDays.map((day) => (
                  <button
                    className={`hms-day-pill${day.isSelected ? ' active' : ''}`}
                    key={`${day.dayName}-${day.dayNum}`}
                    onClick={() => setSelectedDate(day.date)}
                    type="button"
                  >
                    <span className="hms-day-num">{day.dayNum}</span>
                    <span className="hms-day-name">{day.dayName}</span>
                  </button>
                ))}
              </div>

              {/* Time-Slotted Live Schedule Feed */}
              {dayVisits.length > 0 ? (
                <div className="hms-schedule-timeline">
                  {dayVisits.map((v, i) => {
                    const checkIn = new Date(v.check_in_time);
                    const timeStr = checkIn.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                    return (
                      <div className="hms-schedule-slot" key={v.id || i}>
                        <span className="hms-schedule-time">{timeStr}</span>
                        <div
                          className={`hms-schedule-event${i % 2 === 1 ? ' cyan' : ''}`}
                          onClick={() => navigate(`/opd/visit?id=${encodeURIComponent(v.id)}`)}
                          role="button"
                          tabIndex={0}
                          title="Open consultation details"
                        >
                          <div className="hms-event-info">
                            <strong>{`Consultation: ${v.patient_name}`}</strong>
                            <span>
                              {v.doctor_name ? `Dr. ${v.doctor_name}` : 'Attending Doctor'} • {v.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <button
                            aria-label="Event options"
                            className="hms-event-menu"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onSelectTab) onSelectTab('appointments');
                              else navigate('/appointments');
                            }}
                            title="View appointments"
                            type="button"
                          >
                            <i className="ph ph-arrow-square-out" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="hms-dash-empty" style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
                  <i className="ph ph-calendar-blank" style={{ fontSize: '2.25rem', color: '#94a3b8' }} />
                  <div className="hms-dash-empty-title" style={{ marginTop: '0.5rem', fontWeight: 600, color: '#334155' }}>
                    No consultations recorded for this day
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.35rem 0 1rem' }}>
                    Patient check-ins and appointments for this date will appear here in real time.
                  </p>
                  <button
                    className="hms-dash-btn secondary"
                    onClick={() => (onSelectTab ? onSelectTab('appointments') : navigate('/appointments'))}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    type="button"
                  >
                    <i className="ph ph-plus" /> Book Appointment
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type DashboardTabDefinition = {
  key: string;
  label: string;
  icon: string;
  content: ReactNode;
};

const canView = (user: AuthUser, module: string, screen: string) =>
  hasPermission(user.permissions, { module, screen, action: 'View' });

const hasRole = (user: AuthUser, roleCode: string) =>
  user.roles.some((role) => role.code === roleCode);

const dashboardShortcutOnlyModules = new Set(['emergency', 'admissions', 'surgery']);

function AccessibleModulesOverview({ user }: { user: AuthUser }) {
  const modules = getAccessibleSidebarModules(user.permissions, user.roles, user.departments ?? [])
    .filter((module) => !dashboardShortcutOnlyModules.has(module.key));

  return (
    <div className="doctor-page">
      <section className="doctor-page-header">
        <div className="doctor-page-title">
          <h2>My HMS Workspace</h2>
          <p>Modules available through your current role and permissions.</p>
        </div>
      </section>

      {modules.length === 0 ? (
        <div className="admin-dashboard-state" role="status">
          <i className="ph ph-shield-warning" aria-hidden="true" />
          <strong>No dashboard summary is available</strong>
          <span>Use the sidebar for any separately authorized operational modules.</span>
        </div>
      ) : (
        <section className="doc-grid dashboard-bottom" aria-label="Permitted HMS modules">
          {modules.map((module) => (
            <article className="doc-card" key={module.key}>
              <div className="doc-card-header">
                <div>
                  <h3><i className={`ph ${module.icon}`} aria-hidden="true" /> {module.label}</h3>
                  <p>{module.links.length} permitted {module.links.length === 1 ? 'workspace' : 'workspaces'}</p>
                </div>
              </div>
              <div className="doc-quick-actions">
                {module.links.map((link) => (
                  <button className="doc-quick-action" key={link.href} onClick={() => navigate(link.href)} type="button">
                    <i className="ph ph-arrow-square-out" aria-hidden="true" />
                    <span><strong>{link.label}</strong><span>Open permitted workspace</span></span>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

const buildSuperAdministratorTabs = (onSelectTab?: (key: string) => void): DashboardTabDefinition[] => [
  { key: 'overview', label: 'Overview', icon: 'ph-squares-four', content: <ExecutiveOverviewTab onSelectTab={onSelectTab} /> },
  { key: 'doctors', label: 'Doctors', icon: 'ph-stethoscope', content: withSuspense('Doctors', <DoctorDashboardPage />) },
  { key: 'appointments', label: 'Appointments', icon: 'ph-calendar-blank', content: withSuspense('Appointments', <AppointmentDashboardPage />) },
  { key: 'opd', label: 'OPD', icon: 'ph-first-aid', content: withSuspense('OPD', <OpdDashboardPage />) },
  { key: 'pharmacy', label: 'Pharmacy Queue', icon: 'ph-pill', content: withSuspense('Pharmacy Queue', <PharmacyQueueDashboardPage />) },
  { key: 'pharmacy-inventory', label: 'Pharmacy Inventory', icon: 'ph-package', content: withSuspense('Pharmacy Inventory', <PharmacyInventoryDashboardPage />) },
  { key: 'laboratory', label: 'Laboratory', icon: 'ph-flask', content: withSuspense('Laboratory', <LaboratoryDashboardPage />) },
  { key: 'imaging', label: 'Imaging', icon: 'ph-image-square', content: withSuspense('Imaging', <ImagingDashboardPage />) },
  { key: 'admin', label: 'Administration', icon: 'ph-gear', content: withSuspense('Administration', <AdministrationDashboardPage />) },
];

const buildPermissionTabs = (user: AuthUser, onSelectTab?: (key: string) => void): DashboardTabDefinition[] => {
  const doctorUser = user.roles.some((role) => role.code === 'DOCTOR');
  const tabs: DashboardTabDefinition[] = [];

  if (
    doctorUser &&
    canView(user, 'Doctors', 'Doctor Directory') &&
    canView(user, 'Appointments', 'Appointment Records')
  ) {
    tabs.push({ key: 'clinical', label: 'My Clinical Day', icon: 'ph-stethoscope', content: withSuspense('Clinical Day', <DoctorDashboardPage />) });
  }

  if (canView(user, 'Administration', 'Dashboard')) {
    tabs.push({ key: 'admin', label: 'Administration', icon: 'ph-gear', content: withSuspense('Administration', <AdministrationDashboardPage />) });
  }

  if (canView(user, 'Pharmacy', 'Dispensing')) {
    tabs.push({ key: 'pharmacy', label: 'Pharmacy Queue', icon: 'ph-pill', content: withSuspense('Pharmacy Queue', <PharmacyQueueDashboardPage />) });
  }
  if (canView(user, 'Pharmacy', 'Medicine Inventory')) {
    tabs.push({ key: 'pharmacy-inventory', label: 'Pharmacy Inventory', icon: 'ph-package', content: withSuspense('Pharmacy Inventory', <PharmacyInventoryDashboardPage />) });
  }
  if (canView(user, 'Laboratory', 'Orders')) {
    tabs.push({ key: 'laboratory', label: 'Laboratory', icon: 'ph-flask', content: withSuspense('Laboratory', <LaboratoryDashboardPage />) });
  }
  if (canView(user, 'Imaging', 'Orders')) {
    tabs.push({ key: 'imaging', label: 'Imaging', icon: 'ph-image-square', content: withSuspense('Imaging', <ImagingDashboardPage />) });
  }
  if (hasRole(user, 'BILLING_AUTHORIZED') && canView(user, 'Billing', 'Invoices')) {
    tabs.push({ key: 'billing', label: 'Billing', icon: 'ph-receipt', content: withSuspense('Billing', <BillingDashboardPage />) });
  }
  if (canView(user, 'Appointments', 'Appointment Records')) {
    tabs.push({ key: 'appointments', label: 'Appointments', icon: 'ph-calendar-blank', content: withSuspense('Appointments', <AppointmentDashboardPage />) });
  }
  if (canView(user, 'OPD', 'OPD Visits')) {
    tabs.push({ key: 'opd', label: 'OPD', icon: 'ph-first-aid', content: withSuspense('OPD', <OpdDashboardPage />) });
  }
  return tabs.length > 0
    ? tabs
    : [{ key: 'access', label: 'My Access', icon: 'ph-squares-four', content: <AccessibleModulesOverview user={user} /> }];
};

export function DashboardShell() {
  const { user } = useAuth();
  const location = useAppLocation();
  const searchParams = new URLSearchParams(location.search);
  const [selectedTabKey, setSelectedTabKey] = useState<string | null>(null);
  if (!user) return null;

  const selectTab = (key: string) => setSelectedTabKey(key);

  const tabs = isSuperAdministrator(user.roles)
    ? buildSuperAdministratorTabs(selectTab)
    : buildPermissionTabs(user, selectTab);
  const requestedTab = searchParams.get('tab');
  const activeTab = tabs.find((tab) => tab.key === selectedTabKey) ??
    tabs.find((tab) => tab.key === requestedTab) ?? tabs[0] ?? {
    key: 'access',
    label: 'My Access',
    icon: 'ph-squares-four',
    content: <AccessibleModulesOverview user={user} />,
  };

  return (
    <div className="dashboard-master-wrapper">
      <div aria-label="Dashboard sections" className="dashboard-tab-bar" role="tablist">
        {tabs.map((tab) => (
          <button
            aria-selected={activeTab.key === tab.key}
            className={`dashboard-tab-btn${activeTab.key === tab.key ? ' active' : ''}`}
            key={tab.key}
            onClick={() => selectTab(tab.key)}
            role="tab"
            type="button"
          >
            <i className={`ph ${tab.icon}`} aria-hidden="true" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="dashboard-tab-content" role="tabpanel">
        {activeTab.content}
      </div>
    </div>
  );
}





