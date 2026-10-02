export type BookingRouteParams = {
  doctorId?: string;
  branchId?: string;
  departmentId?: string;
};

export const patientRoutes = {
  home: () => '/',
  login: (options?: { returnUrl?: string; reason?: string }) => {
    const params = new URLSearchParams();
    if (options?.returnUrl) params.set('return', options.returnUrl);
    if (options?.reason) params.set('reason', options.reason);
    const qs = params.toString();
    return qs ? `/login?${qs}` : '/login';
  },
  signup: (options?: { returnUrl?: string; token?: string }) => {
    const params = new URLSearchParams();
    if (options?.returnUrl) params.set('return', options.returnUrl);
    if (options?.token) params.set('token', options.token);
    const qs = params.toString();
    return qs ? `/signup?${qs}` : '/signup';
  },
  portal: (options?: {
    tab?: string;
    book?: string;
    branch?: string;
    department?: string;
    patientId?: string;
  }) => {
    const params = new URLSearchParams();
    if (options?.tab && options.tab !== 'overview') params.set('tab', options.tab);
    if (options?.book) params.set('book', options.book);
    if (options?.branch) params.set('branch', options.branch);
    if (options?.department) params.set('department', options.department);
    if (options?.patientId) params.set('patientId', options.patientId);
    const qs = params.toString();
    return qs ? `/portal?${qs}` : '/portal';
  },
};

export function buildPortalBookingUrl(params: BookingRouteParams): string {
  const searchParams = new URLSearchParams();
  if (params.doctorId) searchParams.set('book', params.doctorId);
  if (params.branchId) searchParams.set('branch', params.branchId);
  if (params.departmentId) searchParams.set('department', params.departmentId);
  const qs = searchParams.toString();
  return qs ? `/portal?${qs}` : '/portal';
}

export function parseBookingRouteParams(search: string): BookingRouteParams {
  const params = new URLSearchParams(search);
  const doctorId = params.get('book') || params.get('doctor_id') || undefined;
  const branchId = params.get('branch') || params.get('branch_id') || undefined;
  const departmentId = params.get('department') || params.get('department_id') || undefined;
  return { doctorId, branchId, departmentId };
}

export function getSafeReturnPath(search: string): string | null {
  const params = new URLSearchParams(search);
  const requestedPath = params.get('return');
  if (requestedPath && requestedPath.startsWith('/') && !requestedPath.startsWith('//')) {
    return requestedPath;
  }
  const { doctorId, branchId, departmentId } = parseBookingRouteParams(search);
  if (doctorId || branchId || departmentId) {
    return buildPortalBookingUrl({ doctorId, branchId, departmentId });
  }
  return null;
}
