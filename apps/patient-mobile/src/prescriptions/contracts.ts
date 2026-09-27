import { z } from 'zod';

export const prescriptionItemSchema = z.object({
  id: z.string(),
  medicine_name: z.string(),
  strength: z.string().nullable().optional(),
  dosage: z.string(),
  route: z.string(),
  frequency: z.string(),
  duration: z.string(),
  quantity: z.number().nullable().optional(),
  instructions: z.string().nullable().optional(),
});

export const prescriptionRecordSchema = z.object({
  id: z.string(),
  doctor_name: z.string(),
  status: z.string(),
  submitted_at: z.string(),
  follow_up_date: z.string().nullable().optional(),
  doctor_instructions: z.string().nullable().optional(),
  patient_instructions: z.string().nullable().optional(),
  items: z.array(prescriptionItemSchema).default([]),
});

export const purchasedMedicineSchema = z.object({
  id: z.string(),
  medicine_name: z.string(),
  quantity: z.number(),
  unit_price: z.number(),
  total_amount: z.number(),
  purchased_at: z.string(),
  invoice_number: z.string(),
  payment_status: z.string(),
  branch: z
    .object({
      id: z.string(),
      name: z.string(),
      city: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export const prescriptionsDataSchema = z.object({
  prescriptions: z.array(prescriptionRecordSchema).default([]),
  purchased_medicines: z.array(purchasedMedicineSchema).default([]),
});

export type PrescriptionItem = z.infer<typeof prescriptionItemSchema>;
export type PrescriptionRecord = z.infer<typeof prescriptionRecordSchema>;
export type PurchasedMedicine = z.infer<typeof purchasedMedicineSchema>;
export type PrescriptionsData = z.infer<typeof prescriptionsDataSchema>;
