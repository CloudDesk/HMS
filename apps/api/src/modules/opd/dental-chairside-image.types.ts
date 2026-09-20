import type { Types } from 'mongoose';

export type DentalChairsideImageFields = {
  _id: Types.ObjectId;
  patientId: Types.ObjectId;
  patientNumber: string;
  patientName: string;
  visitId: Types.ObjectId;
  visitNumber: string;
  episodeId?: Types.ObjectId | null;
  episodeNumber?: string | null;
  examinationId?: Types.ObjectId | null;
  toothNumber?: number | null;
  imagingSource: 'CHAIRSIDE';
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storageKey: string;
  notes?: string | null;
  doctorId: Types.ObjectId;
  doctorName: string;
  branchId: Types.ObjectId;
  departmentId: Types.ObjectId;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DentalChairsideImage = {
  id: string;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  visit_id: string;
  visit_number: string;
  episode_id: string | null;
  episode_number: string | null;
  examination_id: string | null;
  tooth_number: number | null;
  imaging_source: 'CHAIRSIDE';
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  storage_key: string;
  file_url: string;
  notes: string | null;
  doctor_id: string;
  doctor_name: string;
  branch_id: string;
  department_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type CreateChairsideImageDTO = {
  tooth_number?: number | null;
  episode_id?: string | null;
  notes?: string | null;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  data: Buffer;
};

export type ChairsideImageListQuery = {
  patient_id?: string;
  visit_id?: string;
  episode_id?: string;
  tooth_number?: number;
};
