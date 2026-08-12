import { apiClient } from './client';

export type ApiRoleStatus = 'active' | 'inactive';
export type ApiRoleType = 'system' | 'custom';

export type RoleAssignedUser = {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  status: string;
  assignedAt: string;
  assignedBy: string | null;
};

export type RoleResponse = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: ApiRoleType;
  status: ApiRoleStatus;
  color: string | null;
  userCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  deletedBy: string | null;
  users?: RoleAssignedUser[];
  audit: {
    createdAt: string;
    updatedAt: string;
    createdBy: string | null;
    updatedBy: string | null;
  };
};

export type RoleListResponse = {
  items: RoleResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type RoleListParams = Partial<{
  search: string;
  status: ApiRoleStatus;
  type: ApiRoleType;
  page: number;
  limit: number;
  sortBy: 'name' | 'code' | 'type' | 'status' | 'userCount' | 'createdAt' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
}>;

export type SaveRolePayload = {
  code: string;
  name: string;
  description?: string | null;
  type?: ApiRoleType;
  status?: ApiRoleStatus;
  color?: string | null;
};

export type RoleAuditLogItem = {
  id: string;
  eventType: string;
  actorName: string;
  createdAt: string;
  ipAddress: string | null;
};

export type RoleAuditLogList = {
  items: RoleAuditLogItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

const toQueryString = (params: RoleListParams) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).length > 0) {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const rolesApi = {
  list(params: RoleListParams) {
    return apiClient.request<RoleListResponse>(`/roles${toQueryString(params)}`);
  },

  async listAll() {
    const firstPage = await this.list({ limit: 100, page: 1, sortBy: 'name', sortOrder: 'asc' });

    if (firstPage.meta.totalPages <= 1) {
      return firstPage;
    }

    const remainingPages = await Promise.all(
      Array.from({ length: firstPage.meta.totalPages - 1 }, (_, index) =>
        this.list({ limit: 100, page: index + 2, sortBy: 'name', sortOrder: 'asc' }),
      ),
    );

    return {
      items: [firstPage, ...remainingPages].flatMap((page) => page.items),
      meta: firstPage.meta,
    };
  },

  getById(id: string) {
    return apiClient.request<RoleResponse>(`/roles/${encodeURIComponent(id)}`);
  },

  auditLogs(id: string, page = 1) {
    return apiClient.request<RoleAuditLogList>(`/roles/${encodeURIComponent(id)}/audit-logs?page=${page}&limit=20`);
  },

  create(payload: SaveRolePayload) {
    return apiClient.request<RoleResponse>('/roles', {
      body: payload,
      method: 'POST',
    });
  },

  update(id: string, payload: Partial<Omit<SaveRolePayload, 'status'>>) {
    return apiClient.request<RoleResponse>(`/roles/${encodeURIComponent(id)}`, {
      body: payload,
      method: 'PATCH',
    });
  },

  updateStatus(id: string, status: ApiRoleStatus) {
    return apiClient.request<RoleResponse>(`/roles/${encodeURIComponent(id)}/status`, {
      body: { status },
      method: 'PATCH',
    });
  },

  assignUser(id: string, userId: string) {
    return apiClient.request<RoleResponse>(`/roles/${encodeURIComponent(id)}/users`, {
      body: { userId },
      method: 'POST',
    });
  },

  removeUser(id: string, userId: string) {
    return apiClient.request<RoleResponse>(
      `/roles/${encodeURIComponent(id)}/users/${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
    );
  },

  delete(id: string) {
    return apiClient.request<{ ok: true }>(`/roles/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};
