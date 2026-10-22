import { z } from 'zod';
import { ophthalmologyIdSchema as id } from './ophthalmology';

// Read only the existing summary contract. Unknown source states remain visible;
// they must never be promoted to fulfilled by a client-side enum/default.
const record = z.object({ id, status: z.string().optional() });
const invoiceRecord = z.object({
  invoiceNumber: z.string(),
  status: z.string(),
  totalAmount: z.number(),
  paidAmount: z.number(),
  balanceAmount: z.number(),
  invoiceDate: z.string().nullable().optional(),
});

export const ophthalmologyJourneySchema = z.object({
  context: z.object({ id, visit_id: id, patient_id: id, branch_id: id, department_id: id, workflow_status: z.string() }),
  tasks: z.array(record.extend({ test_name: z.string(), laterality: z.string(), priority: z.string() })),
  medication_prescriptions: z.array(record),
  clinical_orders: z.array(record.extend({ order_type: z.string() })),
  procedure_recommendations: z.array(record.extend({ procedure_name: z.string(), booking_id: id.nullable(), booking_status: z.string().nullable() })),
  referrals: z.array(record.extend({ appointment_id: id.nullable() })),
  follow_ups: z.array(record.extend({ appointment_id: id.nullable() })),
  optical_prescription: record.nullable(),
  invoices: z.array(invoiceRecord).optional(),
  emergency_source: z.object({ emergency_encounter_id: id, encounter_number: z.string(), appointment_id: id, visit_id: id, patient_id: id }).nullable().optional(),
});
export type OphthalmologyJourney = z.infer<typeof ophthalmologyJourneySchema>;