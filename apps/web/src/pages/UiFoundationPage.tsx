import { useMemo, useState } from 'react';

import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { DataTable, type DataTableColumn } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { FilterToolbar } from '../components/ui/FilterToolbar';
import { KpiCard } from '../components/ui/KpiCard';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { SearchInput } from '../components/ui/SearchInput';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Toast } from '../components/ui/Toast';

type StaffRow = {
  id: string;
  name: string;
  role: string;
  department: string;
  branch: string;
  status: 'Active' | 'Inactive' | 'Locked';
};

const staffRows: StaffRow[] = [
  {
    id: 'EMP-1001',
    name: 'Aarav Mehta',
    role: 'Administrator',
    department: 'Administration',
    branch: 'Main Branch',
    status: 'Active',
  },
  {
    id: 'EMP-1042',
    name: 'Priya Shah',
    role: 'Doctor',
    department: 'OPD',
    branch: 'Downtown Clinic',
    status: 'Active',
  },
  {
    id: 'EMP-1088',
    name: 'Neha Rao',
    role: 'Lab Technician',
    department: 'Laboratory',
    branch: 'Main Branch',
    status: 'Inactive',
  },
  {
    id: 'EMP-1120',
    name: 'Vikram Singh',
    role: 'Pharmacist',
    department: 'Pharmacy',
    branch: 'North Wing',
    status: 'Locked',
  },
];

const statusTone = {
  Active: 'green',
  Inactive: 'orange',
  Locked: 'red',
} as const;

export function UiFoundationPage() {
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(true);

  const filteredRows = useMemo(
    () =>
      staffRows.filter((row) =>
        [row.id, row.name, row.role, row.department, row.branch, row.status]
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [query],
  );

  const columns: DataTableColumn<StaffRow>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => (
        <div className="table-user">
          <span className="avatar-initials purple">
            {row.name
              .split(' ')
              .map((name) => name[0])
              .join('')}
          </span>
          <div>
            <strong>{row.name}</strong>
            <span>{row.id}</span>
          </div>
        </div>
      ),
    },
    { key: 'role', header: 'Role', render: (row) => row.role },
    { key: 'department', header: 'Department', render: (row) => row.department },
    { key: 'branch', header: 'Branch', render: (row) => row.branch },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge tone={statusTone[row.status]}>{row.status}</StatusBadge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: () => (
        <div className="table-actions">
          <button onClick={() => setModalOpen(true)} type="button" aria-label="View details">
            <i className="ph ph-eye" aria-hidden="true" />
          </button>
          <button onClick={() => setConfirmOpen(true)} type="button" aria-label="Open confirmation">
            <i className="ph ph-lock" aria-hidden="true" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="dashboard-grid foundation-page">
        <section className="stat-cards-container" aria-label="KPI cards">
          <KpiCard detail="+12 this month" icon="ph-users-three" label="Total Users" tone="blue" value="1,248" />
          <KpiCard detail="93% available" icon="ph-check-circle" label="Active Staff" tone="green" value="1,164" />
          <KpiCard detail="Across 12 modules" icon="ph-shield-check" label="Roles" tone="purple" value="28" />
          <KpiCard detail="Needs review" icon="ph-warning-circle" label="Locked Accounts" tone="orange" value="9" />
        </section>

        <section className="foundation-layout">
          <Card className="foundation-table-card" description="Static mock content for component validation." title="Data Table">
            <FilterToolbar
              actions={
                <button className="btn-primary" onClick={() => setModalOpen(true)} type="button">
                  <i className="ph ph-plus" aria-hidden="true" />
                  Add New
                </button>
              }
              search={
                <SearchInput
                  label="Search foundation table"
                  onChange={setQuery}
                  placeholder="Search users, roles, departments..."
                  value={query}
                />
              }
            >
              <select aria-label="Role filter" defaultValue="">
                <option value="">All Roles</option>
                <option>Administrator</option>
                <option>Doctor</option>
                <option>Pharmacist</option>
              </select>
              <select aria-label="Status filter" defaultValue="">
                <option value="">All Statuses</option>
                <option>Active</option>
                <option>Inactive</option>
                <option>Locked</option>
              </select>
              <button className="btn-secondary" type="button">
                Clear Filters
              </button>
            </FilterToolbar>
            {filteredRows.length ? (
              <>
                <DataTable columns={columns} getRowKey={(row) => row.id} rows={filteredRows} />
                <Pagination page={1} pageCount={3} totalLabel={`Showing ${filteredRows.length} of ${staffRows.length}`} />
              </>
            ) : (
              <EmptyState
                icon="ph-magnifying-glass"
                message="Adjust the search or clear filters to show mock records."
                title="No matching records"
              />
            )}
          </Card>

          <aside className="foundation-side">
            <Card title="Status Badges">
              <div className="badge-demo">
                <StatusBadge tone="green">Active</StatusBadge>
                <StatusBadge tone="orange">Pending</StatusBadge>
                <StatusBadge tone="red">Locked</StatusBadge>
                <StatusBadge tone="purple">System</StatusBadge>
              </div>
            </Card>

            <Card title="Quick Actions">
              <div className="quick-list">
                <button className="quick-btn" onClick={() => setModalOpen(true)} type="button">
                  <i className="ph ph-window" aria-hidden="true" />
                  <span>Open Modal</span>
                </button>
                <button className="quick-btn" onClick={() => setConfirmOpen(true)} type="button">
                  <i className="ph ph-warning" aria-hidden="true" />
                  <span>Open Confirm Dialog</span>
                </button>
                <button className="quick-btn" onClick={() => setToastVisible((current) => !current)} type="button">
                  <i className="ph ph-chat-circle-text" aria-hidden="true" />
                  <span>Toggle Toast</span>
                </button>
              </div>
            </Card>

            <Card title="Empty State">
              <EmptyState message="Reusable fallback for lists, cards, and panels." title="No data available" />
            </Card>
          </aside>
        </section>
      </div>

      <Modal
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)} type="button">
              Cancel
            </button>
            <button className="btn-primary" onClick={() => setModalOpen(false)} type="button">
              Save
            </button>
          </>
        }
        onClose={() => setModalOpen(false)}
        open={modalOpen}
        title="Foundation Modal"
      >
        <div className="form-grid-2">
          <label className="form-field">
            <span>Display Name</span>
            <input defaultValue="Mock Component" />
          </label>
          <label className="form-field">
            <span>Status</span>
            <select defaultValue="Active">
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        confirmLabel="Continue"
        message="This is a static confirmation dialog for validating the shared UI foundation."
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => setConfirmOpen(false)}
        open={confirmOpen}
        title="Confirm Action"
      />
      <Toast message="Static UI foundation loaded with mock data." visible={toastVisible} />
    </>
  );
}
