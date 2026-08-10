import { LoadingState } from '../components/LoadingState';
import { useAuth } from '../auth/useAuth';
import { AuthSupportPage } from '../pages/AuthSupportPage';
import { ComingSoonPage } from '../pages/ComingSoonPage';
import { DashboardShell } from '../pages/DashboardShell';
import { LoginPage } from '../pages/LoginPage';
import { RolesPermissionsPage } from '../pages/RolesPermissionsPage';
import { UserManagementPage } from '../pages/UserManagementPage';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { sidebarModules } from '../data/ui-foundation';
import { ProtectedRoute } from './ProtectedRoute';
import { navigate, useAppLocation } from './navigation';

function NotFoundPage() {
  return (
    <main className="app-shell app-shell--center">
      <section className="auth-support-panel" aria-labelledby="not-found-title">
        <p className="eyebrow">Route not found</p>
        <h1 id="not-found-title">Page unavailable</h1>
        <p>The requested HMS route is not available.</p>
        <button className="secondary-action" onClick={() => navigate('/dashboard')} type="button">
          Go to dashboard
        </button>
      </section>
    </main>
  );
}

export function AppRouter() {
  const { status } = useAuth();
  const { pathname } = useAppLocation();

  if (status === 'loading' && pathname !== '/login') {
    return <LoadingState />;
  }

  // ── Public routes ────────────────────────────────────────────────────────────

  if (pathname === '/login') {
    return <LoginPage />;
  }

  if (pathname === '/forgot-password') {
    return <AuthSupportPage mode="forgot-password" />;
  }

  if (pathname === '/reset-password') {
    return <AuthSupportPage mode="reset-password" />;
  }

  // ── Protected routes ─────────────────────────────────────────────────────────

  let content = <NotFoundPage />;
  let title = 'Not Found';
  let breadcrumbs = ['Home', 'Not Found'];

  // Look up the route dynamically from ui-foundation.ts sidebar config
  let matchedLink = undefined;
  let matchedModule = undefined;

  for (const module of sidebarModules) {
    const link = module.links.find(
      (l) => l.href === pathname || l.href + '/' === pathname
    );
    if (link) {
      matchedModule = module;
      matchedLink = link;
      break;
    }
  }

  // 1. Explicitly implemented pages override dynamic matching
  if (pathname === '/' || pathname === '/dashboard') {
    title = 'Dashboard';
    breadcrumbs = ['Home', 'Dashboard'];
    content = <DashboardShell />;
  } else if (pathname === '/administration/users') {
    title = 'User Management';
    breadcrumbs = ['Home', 'Administration', 'User Management'];
    content = <UserManagementPage />;
  } else if (pathname === '/administration/roles-permissions') {
    title = 'Roles & Permissions';
    breadcrumbs = ['Home', 'Administration', 'Roles & Permissions'];
    content = <RolesPermissionsPage />;
  } 
  // 2. All other sidebar routes automatically get a ComingSoonPage stub
  else if (matchedModule && matchedLink) {
    title = matchedLink.label;
    breadcrumbs = ['Home', matchedModule.label, matchedLink.label];
    content = (
      <ComingSoonPage
        title={matchedLink.label}
        icon={matchedModule.icon}
        description={`${matchedLink.label} is under development. Use the sidebar to access other functionality.`}
        activeHref={matchedLink.href}
        activeModule={matchedModule.key}
      />
    );
  }

  return (
    <ProtectedRoute>
      <DashboardLayout title={title} breadcrumbs={breadcrumbs}>
        {content}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
