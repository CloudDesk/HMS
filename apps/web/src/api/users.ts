import { apiClient } from './client';

export type ApiUserStatus = 'active' | 'inactive' | 'locked';

export type UserAssignment = {
  id: string;
  name: string | null;
  isPrimary: boolean;
};

export type UserRoleAssignment = {
  id: string;
  code: string;
  name: string;
  status: 'active' | 'inactive';
};

export type UserResponse = {
  id: string;
  employeeCode: string | null;
  username: string;
  email: string | null;
  fullName: string;
  phone: string | null;
  jobTitle: string | null;
  employeeType: string | null;
  hireDate: string | null;
  profilePhotoUrl: string | null;
  address: string | null;
  status: ApiUserStatus;
  lockedUntil: string | null;
  passwordChangedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  deletedBy: string | null;
  roleIds: string[];
  branches: UserAssignment[];
  departments: UserAssignment[];
  roles: UserRoleAssignment[];
  audit: {
    createdAt: string;
    updatedAt: string;
    lastLoginAt: string | null;
    passwordChangedAt: string | null;
    createdBy: string | null;
    updatedBy: string | null;
  };
};

export type UserListResponse = {
  items: UserResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type UserListParams = Partial<{
  search: string;
  status: ApiUserStatus;
  branchId: string;
  departmentId: string;
  roleId: string;
  page: number;
  limit: number;
  sortBy: 'fullName' | 'username' | 'email' | 'employeeCode' | 'status' | 'createdAt' | 'lastLoginAt';
  sortOrder: 'asc' | 'desc';
}>;

export type SaveUserPayload = {
  employeeCode: string;
  username: string;
  email?: string | null;
  fullName: string;
  phone?: string | null;
  jobTitle?: string | null;
  employeeType?: string | null;
  hireDate?: string | null;
  profilePhotoUrl?: string | null;
  address?: string | null;
  status?: ApiUserStatus;
  password?: string;
  branches: UserAssignment[];
  departments: UserAssignment[];
  roleIds: string[];
};

export type UserSummary = {
  total: number;
  active: number;
  inactive: number;
  locked: number;
  addedThisMonth: number;
};

const toQueryString = (params: UserListParams) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).length > 0) {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const usersApi = {
  list(params: UserListParams) {
    return apiClient.request<UserListResponse>(`/users${toQueryString(params)}`);
  },

  getById(id: string) {
    return apiClient.request<UserResponse>(`/users/${encodeURIComponent(id)}`);
  },

  summary() {
    return apiClient.request<UserSummary>('/users/summary');
  },

  export(params: UserListParams) {
    return apiClient.requestBlob(`/users/export${toQueryString(params)}`);
  },

  create(payload: SaveUserPayload & { password: string }) {
    return apiClient.request<UserResponse>('/users', {
      body: payload,
      method: 'POST',
    });
  },

  update(id: string, payload: SaveUserPayload) {
    const body: Omit<SaveUserPayload, 'password' | 'status'> = {
      address: payload.address,
      branches: payload.branches,
      departments: payload.departments,
      email: payload.email,
      employeeCode: payload.employeeCode,
      employeeType: payload.employeeType,
      fullName: payload.fullName,
      hireDate: payload.hireDate,
      jobTitle: payload.jobTitle,
      phone: payload.phone,
      profilePhotoUrl: payload.profilePhotoUrl,
      roleIds: payload.roleIds,
      username: payload.username,
    };

    return apiClient.request<UserResponse>(`/users/${encodeURIComponent(id)}`, {
      body,
      method: 'PATCH',
    });
  },

  updateStatus(id: string, status: ApiUserStatus) {
    return apiClient.request<UserResponse>(`/users/${encodeURIComponent(id)}/status`, {
      body: { status },
      method: 'PATCH',
    });
  },

  changePassword(id: string, currentPassword: string, newPassword: string) {
    return apiClient.request<{ ok: true }>(`/users/${encodeURIComponent(id)}/change-password`, {
      body: { currentPassword, newPassword },
      method: 'POST',
    });
  },

  resetPassword(id: string, newPassword: string) {
    return apiClient.request<{ ok: true }>(`/users/${encodeURIComponent(id)}/reset-password`, {
      body: { newPassword },
      method: 'POST',
    });
  },

  delete(id: string) {
    return apiClient.request<{ ok: true }>(`/users/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};
