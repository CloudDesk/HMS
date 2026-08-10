export type RoleStatus = 'active' | 'inactive';

export type RoleType = 'system' | 'custom';

export type RoleRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: RoleType;
  status: RoleStatus;
  color: string | null;
  userCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
  deletedBy: string | null;
};

export type RoleAssignedUser = {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  status: string;
  assignedAt: Date;
  assignedBy: string | null;
};

export type RoleResponse = RoleRecord & {
  users?: RoleAssignedUser[];
  audit: {
    createdAt: Date;
    updatedAt: Date;
    createdBy: string | null;
    updatedBy: string | null;
  };
};

export type RoleListQuery = {
  search?: string;
  status?: RoleStatus;
  type?: RoleType;
  page: number;
  limit: number;
  sortBy: 'name' | 'code' | 'type' | 'status' | 'userCount' | 'createdAt' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
};

export type RequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};
