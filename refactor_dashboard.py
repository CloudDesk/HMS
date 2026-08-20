import re

with open('apps/web/src/pages/AdministrationDashboardPage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

import_feature = "import { useAdministrationDashboardFeature } from '../hooks/admin/useAdministrationDashboardFeature';\n"

text = text.replace("import { useMemo } from 'react';\n", import_feature)
text = text.replace("import { useAdministrationDashboard } from '../hooks/admin/useAdministrationDashboard';\n", '')
text = text.replace("import { ApiError } from '../api/api-error';\n", '')

old_body = '''  const { data: dashboard, isFetching: loading, error: requestError, refetch } = useAdministrationDashboard();

  const error = requestError
    ? requestError instanceof ApiError && requestError.status === 403
      ? 'You do not have permission to view the Administration Dashboard.'
      : requestError instanceof Error
        ? requestError.message
        : 'Administration statistics could not be loaded.'
    : '';

  const kpis = useMemo(() => dashboard ? [
    { detail: `${dashboard.kpis.activeUsers} active`, icon: 'ph-users-three', label: 'Total Users', tone: 'blue' as const, value: dashboard.kpis.totalUsers },
    { detail: 'Configured access roles', icon: 'ph-shield-check', label: 'Roles', tone: 'purple' as const, value: dashboard.kpis.totalRoles },
    { detail: 'Clinical and support units', icon: 'ph-buildings', label: 'Departments', tone: 'green' as const, value: dashboard.kpis.totalDepartments },
    { detail: 'Available catalogue items', icon: 'ph-first-aid-kit', label: 'Services', tone: 'orange' as const, value: dashboard.kpis.totalServices },
    { detail: 'Hospital locations', icon: 'ph-map-pin', label: 'Branches', tone: 'red' as const, value: dashboard.kpis.totalBranches },
  ] : [], [dashboard]);'''

new_body = '''  const { data, status, actions } = useAdministrationDashboardFeature();
  const { dashboard, kpis } = data;
  const { isFetching: loading, loadError: error } = status;
  const { refetch } = actions;'''

text = text.replace(old_body, new_body)

with open('apps/web/src/pages/AdministrationDashboardPage.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('done')
