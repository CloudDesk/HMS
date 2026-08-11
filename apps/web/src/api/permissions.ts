import { apiClient } from './client';

export type ApiPermissionStatus = 'active' | 'inactive';
export type ApiPermissionType = 'system' | 'custom';

export type PermissionResponse = {
  id: string;
  code: string;
  name: string;
  module: string;
  screen: string;
  action: string;
  description: string | null;
  type: ApiPermissionType;
  status: ApiPermissionStatus;
  categoryId: string | null;
  categoryCode: string | null;
  categoryName: string | null;
  groupId: string | null;
  groupCode: string | null;
  groupName: string | null;
  roleCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  deletedBy: string | null;
  audit: {
    createdAt: string;
    updatedAt: string;
    createdBy: string | null;
    updatedBy: string | null;
  };
};

export type PermissionListResponse = {
  items: PermissionResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type PermissionListParams = Partial<{
  search: string;
  status: ApiPermissionStatus;
  type: ApiPermissionType;
  module: string;
  screen: string;
  action: string;
  categoryId: string;
  groupId: string;
  page: number;
  limit: number;
  sortBy: 'module' | 'screen' | 'action' | 'name' | 'code' | 'type' | 'status' | 'roleCount' | 'createdAt';
  sortOrder: 'asc' | 'desc';
}>;

export type RolePermissionsResponse = {
  items: PermissionResponse[];
};

const toQueryString = (params: PermissionListParams) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).length > 0) {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const permissionsApi = {
  list(params: PermissionListParams) {
    return apiClient.request<PermissionListResponse>(`/permissions${toQueryString(params)}`);
  },

  async listAll() {
    const firstPage = await this.list({ limit: 100, page: 1, sortBy: 'module', sortOrder: 'asc' });

    if (firstPage.meta.totalPages <= 1) {
      return firstPage;
    }

    const remainingPages = await Promise.all(
      Array.from({ length: firstPage.meta.totalPages - 1 }, (_, index) =>
        this.list({ limit: 100, page: index + 2, sortBy: 'module', sortOrder: 'asc' }),
      ),
    );

    return {
      items: [firstPage, ...remainingPages].flatMap((page) => page.items),
      meta: firstPage.meta,
    };
  },

  getByRole(roleId: string) {
    return apiClient.request<RolePermissionsResponse>(
      `/roles/${encodeURIComponent(roleId)}/permissions`,
    );
  },

  replaceForRole(roleId: string, permissionIds: string[]) {
    return apiClient.request<RolePermissionsResponse>(
      `/roles/${encodeURIComponent(roleId)}/permissions`,
      {
        body: { permissionIds },
        method: 'PUT',
      },
    );
  },
};
