export type MedicineStatus = 'ACTIVE' | 'INACTIVE';

export type Medicine = {
  id: string;
  code: string;
  name: string;
  generic_name: string | null;
  strength: string | null;
  dosage_form: string | null;
  unit: string | null;
  description: string | null;
  status: MedicineStatus;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type MedicineListQuery = {
  search?: string;
  status?: MedicineStatus;
  dosage_form?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'code' | 'generic_name' | 'status' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
};

export type CreateMedicineDTO = {
  code: string;
  name: string;
  generic_name?: string | null;
  strength?: string | null;
  dosage_form?: string | null;
  unit?: string | null;
  description?: string | null;
  status?: MedicineStatus;
};

export type UpdateMedicineDTO = Partial<CreateMedicineDTO>;

export type MedicineRequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};
