import { z } from 'zod';
import type { MainTab } from '../ui/components/BottomNavBar';

export const notificationTypeSchema = z.enum([
  'REFERRAL',
  'CALL_NEXT_PATIENT',
  'GENERAL',
  'DENTAL_LAB_READY',
  'LAB_RESULT',
  'IMAGING_REPORT',
  'CONSENT_REQUIRED',
  'INVOICE_PENDING',
  'QUOTATION_AVAILABLE',
]).or(z.string());

export const portalNotificationSchema = z.object({
  id: z.string(),
  title: z.string(),
  message: z.string(),
  type: notificationTypeSchema,
  recipient_role: z.string().nullable().optional().transform((v) => v ?? null),
  recipient_user_id: z.string().nullable().optional().transform((v) => v ?? null),
  recipient_branch_id: z.string().nullable().optional().transform((v) => v ?? null),
  patient_id: z.string().nullable().optional().transform((v) => v ?? null),
  related_entity_id: z.string().nullable().optional().transform((v) => v ?? null),
  is_read: z.boolean().default(false),
  created_at: z.string(),
  updated_at: z.string().optional(),
});

export const portalNotificationsListResponseSchema = z.object({
  data: z.array(portalNotificationSchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
  }),
});

export type NotificationType = z.infer<typeof notificationTypeSchema>;
export type PortalNotification = z.infer<typeof portalNotificationSchema>;
export type PortalNotificationsListResponse = z.infer<
  typeof portalNotificationsListResponseSchema
>;

export function formatNotificationTime(dateString: string): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;

    const now = Date.now();
    const diffMs = now - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return dateString;
  }
}

export function getNotificationTypeLabel(type: string): string {
  switch (type?.toUpperCase()) {
    case 'QUOTATION_AVAILABLE':
      return 'Treatment Quotation';
    case 'CALL_NEXT_PATIENT':
      return 'Queue Alert';
    case 'DENTAL_LAB_READY':
      return 'Dental Lab';
    case 'REFERRAL':
      return 'Referral Notice';
    case 'LAB_RESULT':
      return 'Lab Result';
    case 'IMAGING_REPORT':
      return 'Imaging Report';
    case 'CONSENT_REQUIRED':
      return 'Consent Required';
    case 'INVOICE_PENDING':
      return 'Pending Invoice';
    case 'GENERAL':
    default:
      return 'Hospital Notice';
  }
}

export function getNotificationTypeIcon(type: string): string {
  switch (type?.toUpperCase()) {
    case 'QUOTATION_AVAILABLE':
      return '🦷';
    case 'CALL_NEXT_PATIENT':
      return '🔔';
    case 'DENTAL_LAB_READY':
      return '🦷';
    case 'REFERRAL':
      return '📋';
    case 'LAB_RESULT':
      return '🧪';
    case 'IMAGING_REPORT':
      return '🩻';
    case 'CONSENT_REQUIRED':
      return '✍️';
    case 'INVOICE_PENDING':
      return '💳';
    case 'GENERAL':
    default:
      return '💬';
  }
}

export function getNotificationDestination(type: string): {
  tab: MainTab;
  label: string;
} | null {
  switch (type?.toUpperCase()) {
    case 'QUOTATION_AVAILABLE':
      return { tab: 'dental', label: 'View Quotations' };
    case 'CALL_NEXT_PATIENT':
      return { tab: 'appointments', label: 'View Appointment' };
    case 'DENTAL_LAB_READY':
      return { tab: 'dental', label: 'View Dental Plans' };
    case 'REFERRAL':
      return { tab: 'appointments', label: 'View Visits' };
    case 'LAB_RESULT':
      return { tab: 'records', label: 'View Lab Reports' };
    case 'IMAGING_REPORT':
      return { tab: 'records', label: 'View Imaging Scans' };
    case 'INVOICE_PENDING':
      return { tab: 'billing', label: 'View Invoices' };
    case 'CONSENT_REQUIRED':
      return { tab: 'records', label: 'View Records' };
    default:
      return null;
  }
}

export interface NotificationTarget {
  tab: MainTab;
  entityId: string | null;
  patientId: string | null;
  label: string;
}

export function getNotificationTarget(notification: PortalNotification): NotificationTarget | null {
  const destination = getNotificationDestination(notification.type);
  if (!destination) return null;

  return {
    tab: destination.tab,
    entityId: notification.related_entity_id ?? null,
    patientId: notification.patient_id ?? null,
    label: destination.label,
  };
}


