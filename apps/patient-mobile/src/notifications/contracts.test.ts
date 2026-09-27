import { describe, expect, it } from 'vitest';
import {
  formatNotificationTime,
  getNotificationDestination,
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
      expect(getNotificationTypeLabel('GENERAL')).toBe('Hospital Notice');

      expect(getNotificationTypeIcon('CALL_NEXT_PATIENT')).toBe('🔔');
      expect(getNotificationTypeIcon('DENTAL_LAB_READY')).toBe('🦷');
    });

    it('resolves safe deep link navigation destinations', () => {
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
  });
});
