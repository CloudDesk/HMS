export type OpdVitals = {
  id: string;
  visit_id: string;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  recorded_at: Date;
  blood_pressure_systolic: number;
  blood_pressure_diastolic: number;
  blood_pressure: string;
  weight_kg: number;
  height_cm: number;
  bmi: number;
  temperature_c: number | null;
  pulse_bpm: number | null;
  respiratory_rate_per_min: number | null;
  oxygen_saturation_percent: number | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type OpdVitalsListQuery = {
  page?: number;
  limit?: number;
  sortBy?: 'recorded_at' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
};

export type CreateOpdVitalsDTO = {
  blood_pressure_systolic: number;
  blood_pressure_diastolic: number;
  weight_kg: number;
  height_cm: number;
  temperature_c?: number | null;
  pulse_bpm?: number | null;
  respiratory_rate_per_min?: number | null;
  oxygen_saturation_percent?: number | null;
  notes?: string | null;
};
