import { useEffect, useRef } from 'react';
import { useAuth } from '../auth/useAuth';


// ─── KPI Stat Card ────────────────────────────────────────────────────────────

type StatCardProps = {
  icon: string;
  label: string;
  tone: 'blue' | 'green' | 'orange' | 'purple' | 'red';
  value: string;
  note: string;
};

function StatCard({ icon, label, tone, value, note }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>
        <i className={`ph-fill ${icon}`} aria-hidden="true" />
      </div>
      <div className="stat-info">
        <p>{label}</p>
        <h3>{value}</h3>
        <span>{note}</span>
      </div>
    </div>
  );
}

// ─── Line Chart Card ──────────────────────────────────────────────────────────

function PatientVisitsChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<unknown>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Chart.js is expected to be available globally via the app bundle or CDN
    type ChartConstructor = new (ctx: CanvasRenderingContext2D, config: object) => { destroy: () => void };
    const ChartJs = (window as unknown as { Chart?: ChartConstructor }).Chart;

    if (!ChartJs) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (chartRef.current) {
      (chartRef.current as { destroy: () => void }).destroy();
    }

    const today = new Date();
    const labels: string[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      labels.push(d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
    }

    chartRef.current = new ChartJs(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Patient Visits',
            data: [42, 58, 37, 65, 52, 71, 48],
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.08)',
            borderWidth: 2,
            pointBackgroundColor: '#3b82f6',
            pointRadius: 4,
            tension: 0.35,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(226,232,240,0.7)' },
            ticks: { color: '#64748b', font: { size: 11 } },
          },
          x: {
            grid: { display: false },
            ticks: { color: '#64748b', font: { size: 11 } },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        (chartRef.current as { destroy: () => void }).destroy();
      }
    };
  }, []);

  return (
    <div className="card chart-card line-chart-card">
      <div className="card-header">
        <h3>Patient Visits (Last 7 Days)</h3>
        <div className="chart-dropdown">
          <span>Current branch</span>
        </div>
      </div>
      <div className="chart-container" style={{ height: '220px', padding: '1rem' }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

// ─── Donut Chart Card ─────────────────────────────────────────────────────────

const departmentData = [
  { label: 'OPD', value: 38, color: '#3b82f6' },
  { label: 'Emergency', value: 12, color: '#ef4444' },
  { label: 'Admissions', value: 18, color: '#10b981' },
  { label: 'Laboratory', value: 16, color: '#f59e0b' },
  { label: 'Imaging', value: 10, color: '#8b5cf6' },
  { label: 'Pharmacy', value: 6, color: '#06b6d4' },
];

function DepartmentDonutChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<unknown>(null);
  const total = departmentData.reduce((acc, d) => acc + d.value, 0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    type ChartConstructor = new (ctx: CanvasRenderingContext2D, config: object) => { destroy: () => void };
    const ChartJs = (window as unknown as { Chart?: ChartConstructor }).Chart;

    if (!ChartJs) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (chartRef.current) {
      (chartRef.current as { destroy: () => void }).destroy();
    }

    chartRef.current = new ChartJs(ctx, {
      type: 'doughnut',
      data: {
        labels: departmentData.map((d) => d.label),
        datasets: [
          {
            data: departmentData.map((d) => d.value),
            backgroundColor: departmentData.map((d) => d.color),
            borderWidth: 0,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: { legend: { display: false } },
      },
    });

    return () => {
      if (chartRef.current) {
        (chartRef.current as { destroy: () => void }).destroy();
      }
    };
  }, []);

  return (
    <div className="card chart-card donut-chart-card">
      <div className="card-header">
        <h3>Clinical Activity by Department</h3>
      </div>
      <div className="donut-container" style={{ display: 'flex', gap: '1rem', padding: '1rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: '140px', height: '140px', flexShrink: 0 }}>
          <canvas ref={canvasRef} />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <strong style={{ fontSize: '1.4rem', color: '#0f172a' }}>{total}</strong>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Events</span>
          </div>
        </div>
        <div className="chart-legend" style={{ display: 'grid', gap: '0.4rem', fontSize: '0.8rem' }}>
          {departmentData.map((d) => (
            <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: d.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: '#64748b' }}>{d.label}</span>
              <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#0f172a' }}>{d.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Recent Patient Activity Card ─────────────────────────────────────────────

const recentPatients = [
  { id: 'P-00412', name: 'Amina Osei', action: 'OPD visit', time: '8 min ago', tone: 'blue' },
  { id: 'P-00389', name: 'James Kariuki', action: 'Lab sample collected', time: '22 min ago', tone: 'green' },
  { id: 'P-00401', name: 'Fatuma Mwangi', action: 'Admitted to ward', time: '45 min ago', tone: 'orange' },
  { id: 'P-00378', name: 'David Otieno', action: 'Prescription dispensed', time: '1 hr ago', tone: 'purple' },
  { id: 'P-00367', name: 'Mary Njeri', action: 'Imaging completed', time: '2 hrs ago', tone: 'blue' },
];

function RecentPatientActivityCard() {
  return (
    <div className="card appointments-card">
      <div className="card-header">
        <h3>Recent Patient Activity</h3>
      </div>
      <div style={{ padding: '0.5rem 0' }}>
        {recentPatients.map((p) => (
          <div
            key={p.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.65rem 1.25rem',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <span
              className={`avatar-initials ${p.tone}`}
              style={{ fontSize: '0.68rem' }}
            >
              {p.name.split(' ').map((n) => n[0]).join('')}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.86rem', color: '#0f172a' }}>{p.name}</p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>{p.action}</p>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>{p.time}</span>
          </div>
        ))}
      </div>
      <div style={{ padding: '0.85rem 1.25rem' }}>
        <a
          href="/patients/search"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.82rem',
            color: '#2563eb',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          <i className="ph ph-users" aria-hidden="true" />
          Open patient records
        </a>
      </div>
    </div>
  );
}

// ─── Small Info Card ─────────────────────────────────────────────────────────

type SmallInfoCardProps = {
  icon: string;
  label: string;
  value: string;
  href: string;
};

function SmallInfoCard({ icon, label, value, href }: SmallInfoCardProps) {
  return (
    <div className="card small-info-card" style={{ padding: '1rem 1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.86rem', color: '#334155', marginBottom: '0.5rem' }}>
        <i className={`ph ${icon}`} aria-hidden="true" style={{ fontSize: '1rem', color: '#64748b' }} />
        {label}
      </div>
      <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>{value}</div>
      <a
        href={href}
        style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}
      >
        View details
      </a>
    </div>
  );
}

// ─── Recent Activities Card ───────────────────────────────────────────────────

const recentActivities = [
  { icon: 'ph-user-plus', text: 'New patient registered — P-00412 Amina Osei', time: '8 min ago', tone: '#3b82f6' },
  { icon: 'ph-flask', text: 'Lab order completed — CBC panel for P-00389', time: '22 min ago', tone: '#10b981' },
  { icon: 'ph-bed', text: 'Admission approved — P-00401 Fatuma Mwangi, Ward 3', time: '45 min ago', tone: '#f59e0b' },
  { icon: 'ph-pill', text: 'Prescription dispensed — Amoxicillin 500mg × 10', time: '1 hr ago', tone: '#8b5cf6' },
  { icon: 'ph-user-gear', text: 'User role updated — Nurse Grace Nyambura → Senior Nurse', time: '2 hrs ago', tone: '#64748b' },
  { icon: 'ph-image-square', text: 'Imaging report released — Chest X-Ray, P-00367', time: '3 hrs ago', tone: '#06b6d4' },
];

function RecentActivitiesCard() {
  return (
    <div className="card recent-activities" style={{ flex: 1 }}>
      <div className="card-header">
        <h3>Recent Activities</h3>
      </div>
      <div style={{ padding: '0.5rem 0' }}>
        {recentActivities.map((a, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              padding: '0.7rem 1.25rem',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: `${a.tone}18`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: a.tone,
                fontSize: '1rem',
              }}
            >
              <i className={`ph ${a.icon}`} aria-hidden="true" />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#334155', lineHeight: 1.4 }}>{a.text}</p>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{a.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Records Requiring Attention Card ────────────────────────────────────────

const attentionItems = [
  { icon: 'ph-warning', label: 'Incomplete EMR', count: 7, tone: '#f59e0b', href: '/patients/emr' },
  { icon: 'ph-clock', label: 'Pending admissions', count: 3, tone: '#3b82f6', href: '/admissions/requests' },
  { icon: 'ph-flask', label: 'Overdue lab results', count: 5, tone: '#ef4444', href: '/laboratory/queue' },
  { icon: 'ph-receipt', label: 'Unpaid billing invoices', count: 12, tone: '#8b5cf6', href: '/billing/history' },
  { icon: 'ph-image-square', label: 'Pending imaging reports', count: 4, tone: '#06b6d4', href: '/imaging/reports' },
];

function RecordsAttentionCard() {
  return (
    <div className="card pending-tasks" style={{ flex: 1 }}>
      <div className="card-header">
        <h3>Records Requiring Attention</h3>
      </div>
      <div style={{ padding: '0.5rem 0' }}>
        {attentionItems.map((item) => (
          <a
            key={item.label}
            href={item.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1.25rem',
              borderBottom: '1px solid #f1f5f9',
              textDecoration: 'none',
              color: 'inherit',
              transition: 'background 120ms',
            }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: '8px',
                background: `${item.tone}18`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: item.tone,
                fontSize: '1rem',
              }}
            >
              <i className={`ph ${item.icon}`} aria-hidden="true" />
            </span>
            <span style={{ flex: 1, fontWeight: 600, fontSize: '0.86rem', color: '#334155' }}>{item.label}</span>
            <span
              style={{
                minWidth: 28,
                height: 24,
                borderRadius: '20px',
                background: `${item.tone}18`,
                color: item.tone,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.78rem',
                fontWeight: 800,
                padding: '0 8px',
              }}
            >
              {item.count}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export function DashboardShell() {
  const { user } = useAuth();
  const firstName = user?.fullName?.split(' ')[0] ?? user?.username ?? 'there';

  return (
    <div className="dashboard-grid">

        {/* Welcome greeting */}
        <p
          style={{
            margin: '0 0 1.25rem',
            color: '#64748b',
            fontSize: '0.92rem',
          }}
        >
          Welcome back, {firstName} 👋
        </p>

        {/* KPI Stat Cards */}
        <div className="stat-cards-container" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
          <StatCard
            icon="ph-users"
            label="Registered Patients"
            tone="blue"
            value="1,284"
            note="All-time registered"
          />
          <StatCard
            icon="ph-user-check"
            label="Active Staff"
            tone="green"
            value="94"
            note="Currently active"
          />
          <StatCard
            icon="ph-buildings"
            label="Active Departments"
            tone="orange"
            value="12"
            note="Across all branches"
          />
          <StatCard
            icon="ph-list-checks"
            label="Active Services"
            tone="purple"
            value="218"
            note="In service catalogue"
          />
          <StatCard
            icon="ph-wallet"
            label="Catalogue Value"
            tone="blue"
            value="KSh 4.2M"
            note="Total service value"
          />
        </div>

        {/* Charts Row */}
        <div className="charts-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <PatientVisitsChart />
          <DepartmentDonutChart />
          <RecentPatientActivityCard />
        </div>

        {/* Small Info Cards Row */}
        <div
          className="small-cards-row"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '1rem', marginBottom: '1rem' }}
        >
          <SmallInfoCard icon="ph-stethoscope" label="OPD Services" value="43" href="/administration/services" />
          <SmallInfoCard icon="ph-pill" label="Pharmacy Services" value="61" href="/administration/services" />
          <SmallInfoCard icon="ph-flask" label="Laboratory Services" value="38" href="/administration/services" />
          <SmallInfoCard icon="ph-image-square" label="Imaging Services" value="22" href="/administration/services" />
          <SmallInfoCard icon="ph-buildings" label="Active Branches" value="3" href="/administration/branches" />
        </div>

        {/* Bottom Row */}
        <div
          className="bottom-row"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}
        >
          <RecentActivitiesCard />
          <RecordsAttentionCard />
        </div>

      </div>
  );
}
