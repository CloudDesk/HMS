import { describe, expect, it } from 'vitest';
import {
  formatNotificationTime,
  getNotificationDestination,
  getNotificationTarget,
  getNotificationTypeIcon,
  getNotificationTypeLabel,
  portalNotificationSchema,
  portalNotificationsListResponseSchema,
} from './contracts';

describe('Notifications Contracts & Schemas', () => {
  it('parses valid notification object', () => {
    const raw = {
      id: 'notif-001',
      title: 'Your Token #12 is Called',
      message: 'Please proceed to Consultation Room 3 for Dr. John Smith',
      type: 'CALL_NEXT_PATIENT',
      recipient_role: null,
      recipient_user_id: 'user-123',
      recipient_branch_id: 'branch-01',
      related_entity_id: 'apt-001',
      is_read: false,
      created_at: '2026-09-24T10:30:00.000Z',
    };

    const parsed = portalNotificationSchema.parse(raw);
    expect(parsed.id).toBe('notif-001');
    expect(parsed.type).toBe('CALL_NEXT_PATIENT');
    expect(parsed.is_read).toBe(false);
    expect(parsed.title).toBe('Your Token #12 is Called');
  });

  it('parses notifications list response', () => {
    const raw = {
      data: [
        {
          id: 'notif-001',
          title: 'Dental Lab Ready',
          message: 'Crown fabrication completed',
          type: 'DENTAL_LAB_READY',
          is_read: true,
          created_at: '2026-09-24T10:00:00.000Z',
        },
      ],
      meta: {
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      },
    };

    const parsed = portalNotificationsListResponseSchema.parse(raw);
    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0]?.type).toBe('DENTAL_LAB_READY');
    expect(parsed.meta.total).toBe(1);
  });

  describe('Notification formatters and deep link resolver', () => {
    it('formats notification relative timestamps', () => {
      const nowIso = new Date().toISOString();
      expect(formatNotificationTime(nowIso)).toBe('Just now');
      expect(formatNotificationTime('')).toBe('-');
    });

    it('returns appropriate labels and icons for notification types', () => {
      expect(getNotificationTypeLabel('CALL_NEXT_PATIENT')).toBe('Queue Alert');
      expect(getNotificationTypeLabel('DENTAL_LAB_READY')).toBe('Dental Lab');
      expect(getNotificationTypeLabel('REFERRAL')).toBe('Referral Notice');
      expect(getNotificationTypeLabel('QUOTATION_AVAILABLE')).toBe('Treatment Quotation');
      expect(getNotificationTypeLabel('GENERAL')).toBe('Hospital Notice');

      expect(getNotificationTypeIcon('CALL_NEXT_PATIENT')).toBe('🔔');
      expect(getNotificationTypeIcon('DENTAL_LAB_READY')).toBe('🦷');
      expect(getNotificationTypeIcon('QUOTATION_AVAILABLE')).toBe('🦷');
    });

    it('resolves safe deep link navigation destinations', () => {
      const quotation = getNotificationDestination('QUOTATION_AVAILABLE');
      expect(quotation?.tab).toBe('dental');
      expect(quotation?.label).toBe('View Quotations');

      const callNext = getNotificationDestination('CALL_NEXT_PATIENT');
      expect(callNext?.tab).toBe('appointments');
      expect(callNext?.label).toBe('View Appointment');

      const dentalLab = getNotificationDestination('DENTAL_LAB_READY');
      expect(dentalLab?.tab).toBe('dental');
      expect(dentalLab?.label).toBe('View Dental Plans');

      const referral = getNotificationDestination('REFERRAL');
      expect(referral?.tab).toBe('appointments');

      const general = getNotificationDestination('GENERAL');
      expect(general).toBeNull();
    });

    it('resolves exact notification target with entity ID and patient context', () => {
      const target = getNotificationTarget({
        id: 'notif-100',
        title: 'Dental Quotation Available',
        message: 'Dental Treatment Quotation DTQ-00001 is ready for your review.',
        type: 'QUOTATION_AVAILABLE',
        recipient_role: 'PATIENT',
        recipient_user_id: 'user-001',
        recipient_branch_id: null,
        patient_id: 'pat-001',
        related_entity_id: 'quote-001',
        is_read: false,
        created_at: new Date().toISOString(),
      });

      expect(target).toEqual({
        tab: 'dental',
        entityId: 'quote-001',
        patientId: 'pat-001',
        label: 'View Quotations',
      });

      // Fallback when entity/patient is missing
      const fallbackTarget = getNotificationTarget({
        id: 'notif-101',
        title: 'Appointment Notice',
        message: 'Your token is called',
        type: 'CALL_NEXT_PATIENT',
        recipient_role: 'PATIENT',
        recipient_user_id: 'user-001',
        recipient_branch_id: null,
        patient_id: null,
        related_entity_id: null,
        is_read: false,
        created_at: new Date().toISOString(),
      });

      expect(fallbackTarget).toEqual({
        tab: 'appointments',
        entityId: null,
        patientId: null,
        label: 'View Appointment',
      });

      // Null target for general notice
      const nullTarget = getNotificationTarget({
        id: 'notif-102',
        title: 'Notice',
        message: 'Holiday hours notice',
        type: 'GENERAL',
        recipient_role: 'PATIENT',
        recipient_user_id: 'user-001',
        recipient_branch_id: null,
        patient_id: null,
        related_entity_id: null,
        is_read: true,
        created_at: new Date().toISOString(),
      });

      expect(nullTarget).toBeNull();
    });
  });
});

