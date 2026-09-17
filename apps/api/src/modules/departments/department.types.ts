export type DepartmentStatus = 'ACTIVE' | 'INACTIVE';

export const departmentModuleKeys = [
  'patients',
  'doctors',
  'appointments',
  'opd',
  'emergency',
  'admissions',
  'surgery',
  'pharmacy',
  'laboratory',
  'imaging',
  'billing',
  'reports',
  'administration',
] as const;

export type DepartmentModuleKey = (typeof departmentModuleKeys)[number];

export type Department = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  branch_ids: string[];
  status: DepartmentStatus;
  isClinical: boolean;
  hiddenModules: DepartmentModuleKey[];
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type DepartmentListQuery = {
  search?: string;
  status?: DepartmentStatus;
  isClinical?: boolean;
  branch_id?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'code' | 'status' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
};

export type CreateDepartmentDTO = {
  code: string;
  name: string;
  branch_ids: string[];
  description?: string | null;
  status?: DepartmentStatus;
  isClinical?: boolean;
  hiddenModules?: DepartmentModuleKey[];
};

export type UpdateDepartmentDTO = Partial<CreateDepartmentDTO>;

export type DepartmentRequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};
