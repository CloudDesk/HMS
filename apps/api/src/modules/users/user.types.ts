export type UserStatus = 'active' | 'inactive' | 'locked';

export type AssignmentInput = {
  id: string;
  name?: string | null;
  isPrimary?: boolean;
};

export type UserRecord = {
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
  status: UserStatus;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  passwordChangedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
  deletedBy: string | null;
  roleIds: string[];
};

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

export type UserResponse = Omit<UserRecord, 'failedLoginAttempts'> & {
  branches: UserAssignment[];
  departments: UserAssignment[];
  roles: UserRoleAssignment[];
  audit: {
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt: Date | null;
    passwordChangedAt: Date | null;
    createdBy: string | null;
    updatedBy: string | null;
  };
};

export type UserListQuery = {
  search?: string;
  status?: UserStatus;
  branchId?: string;
  departmentId?: string;
  roleId?: string;
  page: number;
  limit: number;
  sortBy: 'fullName' | 'username' | 'email' | 'employeeCode' | 'status' | 'createdAt' | 'lastLoginAt';
  sortOrder: 'asc' | 'desc';
};

export type RequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

export type ProvisionDoctorAccountInput = {
  employeeCode: string;
  username: string;
  email: string;
  password: string;
  fullName: string;
  phone?: string | null;
  branchId: string;
  departmentId: string;
};
