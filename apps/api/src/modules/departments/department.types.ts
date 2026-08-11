export type DepartmentStatus = 'ACTIVE' | 'INACTIVE';

export type Department = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  branch_id: string;
  status: DepartmentStatus;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type DepartmentListQuery = {
  search?: string;
  status?: DepartmentStatus;
  branch_id?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'code' | 'status' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
};

export type CreateDepartmentDTO = {
  code: string;
  name: string;
  branch_id: string;
  description?: string | null;
  status?: DepartmentStatus;
};

export type UpdateDepartmentDTO = Partial<Omit<CreateDepartmentDTO, 'status'>>;
