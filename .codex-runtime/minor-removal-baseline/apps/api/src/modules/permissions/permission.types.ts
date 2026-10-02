export type PermissionStatus = 'active' | 'inactive';

export type PermissionType = 'system' | 'custom';

export type PermissionRecord = {
  id: string;
  code: string;
  name: string;
  module: string;
  screen: string;
  action: string;
  description: string | null;
  type: PermissionType;
  status: PermissionStatus;
  categoryId: string | null;
  categoryCode: string | null;
  categoryName: string | null;
  groupId: string | null;
  groupCode: string | null;
  groupName: string | null;
  roleCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
  deletedBy: string | null;
};

export type PermissionResponse = PermissionRecord & {
  audit: {
    createdAt: Date;
    updatedAt: Date;
    createdBy: string | null;
    updatedBy: string | null;
  };
};

export type PermissionListQuery = {
  search?: string;
  status?: PermissionStatus;
  type?: PermissionType;
  module?: string;
  screen?: string;
  action?: string;
  categoryId?: string;
  groupId?: string;
  page: number;
  limit: number;
  sortBy: 'module' | 'screen' | 'action' | 'name' | 'code' | 'type' | 'status' | 'roleCount' | 'createdAt';
  sortOrder: 'asc' | 'desc';
};

export type RolePermissionSummary = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: string;
  assignedAt: Date;
  assignedBy: string | null;
};

export type RequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};
