export type WardStatus = 'ACTIVE' | 'INACTIVE';
export type BedStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'BLOCKED' | 'UNDER_MAINTENANCE' | 'INACTIVE';

export type Ward = { id: string; branch_id: string; name: string; ward_type: string; floor: string; description: string | null; status: WardStatus; created_at: Date; updated_at: Date };
export type Bed = { id: string; branch_id: string; ward_id: string; ward_name: string; bed_number: string; bed_category: string; room_number: string | null; status: BedStatus; created_at: Date; updated_at: Date };
export type PageMeta = { total: number; page: number; limit: number; totalPages: number };
export type WardListQuery = { branch_id: string; search?: string; ward_type?: string; floor?: string; status?: WardStatus; page?: number; limit?: number };
export type BedListQuery = { branch_id: string; ward_id?: string; search?: string; bed_category?: string; room_number?: string; status?: BedStatus; page?: number; limit?: number };
export type BedSummary = { total: number; available: number; occupied: number; reserved: number; blocked: number; under_maintenance: number; inactive: number };
export type CreateWardDTO = { branch_id: string; name: string; ward_type: string; floor: string; description?: string | null };
export type UpdateWardDTO = Partial<Omit<CreateWardDTO, 'branch_id'>> & { branch_id: string };
export type CreateBedDTO = { ward_id: string; branch_id: string; bed_number: string; bed_category: string; room_number?: string | null };
export type UpdateBedDTO = Partial<Omit<CreateBedDTO, 'branch_id' | 'ward_id'>>;
export type StatusActionMetadata = { ipAddress?: string; userAgent?: string };
