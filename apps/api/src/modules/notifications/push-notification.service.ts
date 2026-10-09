import type { DeviceService } from '../devices/device.service.js';
import type { MobileDevice } from '../devices/device.types.js';
import type { Notification } from './notification.types.js';

export type PushNotificationPayload = {
  notificationId: string;
  type: string;
  title: string;
  body: string;
  entityType: string;
  entityId?: string;
  deepLink: string;
  priority: 'normal' | 'high';
};

type ExpoPushTicket = {
  status?: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
};

type ExpoPushResponse = { data?: ExpoPushTicket[] };

const safeBodyFor = (type: Notification['type']) => {
  switch (type) {
    case 'LAB_RESULT': return 'A new laboratory update is available in MyCare.';
    case 'IMAGING_REPORT': return 'A new imaging update is available in MyCare.';
    case 'CONSENT_REQUIRED': return 'A document requires your review in MyCare.';
    case 'INVOICE_PENDING': return 'A billing update is available in MyCare.';
    case 'QUOTATION_AVAILABLE': return 'A treatment quotation is available in MyCare.';
    case 'DENTAL_LAB_READY': return 'A dental treatment update is available in MyCare.';
    case 'REFERRAL': return 'A care referral update is available in MyCare.';
    case 'CALL_NEXT_PATIENT': return 'An appointment update is available in MyCare.';
    default: return 'A new notification is available in MyCare.';
  }
};

const safeTitleFor = (type: Notification['type']) => {
  switch (type) {
    case 'CALL_NEXT_PATIENT': return 'Appointment update';
    case 'REFERRAL': return 'Care referral update';
    case 'LAB_RESULT': return 'Laboratory update';
    case 'IMAGING_REPORT': return 'Imaging update';
    case 'CONSENT_REQUIRED': return 'Document review required';
    case 'INVOICE_PENDING': return 'Billing update';
    case 'QUOTATION_AVAILABLE': return 'Treatment quotation available';
    case 'DENTAL_LAB_READY': return 'Dental treatment update';
    default: return 'HMS notification';
  }
};

export class PushNotificationService {
  constructor(
    private readonly devices: DeviceService,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  buildPayload(notification: Notification): PushNotificationPayload {
    const target = (() => {
      switch (notification.type) {
        case 'CALL_NEXT_PATIENT':
        case 'REFERRAL': return { deepLink: '/appointments', entityType: 'APPOINTMENT' };
        case 'LAB_RESULT': return { deepLink: '/records', entityType: 'LAB_RESULT' };
        case 'IMAGING_REPORT': return { deepLink: '/records', entityType: 'IMAGING_REPORT' };
        case 'CONSENT_REQUIRED': return { deepLink: '/records', entityType: 'CONSENT' };
        case 'INVOICE_PENDING': return { deepLink: '/billing', entityType: 'INVOICE' };
        case 'QUOTATION_AVAILABLE':
        case 'DENTAL_LAB_READY': return { deepLink: '/dental', entityType: 'DENTAL_TREATMENT' };
        default: return { deepLink: '/notifications', entityType: 'GENERAL' };
      }
    })();
    return {
      notificationId: notification.id,
      type: notification.type,
      title: safeTitleFor(notification.type),
      body: safeBodyFor(notification.type),
      ...target,
      entityId: notification.related_entity_id ?? undefined,
      priority: notification.type === 'CALL_NEXT_PATIENT' ? 'high' : 'normal',
    };
  }

  async sendToUser(userId: string, notification: Notification): Promise<void> {
    try {
      const devices = await this.devices.getActiveDevicesForUser(userId);
      if (!devices.length) return;
      await this.send(devices, this.buildPayload(notification));
    } catch {
      // Push delivery is best-effort and must never fail the clinical transaction.
    }
  }

  private async send(devices: MobileDevice[], payload: PushNotificationPayload) {
    const expoDevices = devices.filter((device) => /^ExponentPushToken\[[^\]]+\]$|^ExpoPushToken\[[^\]]+\]$/.test(device.pushToken));
    if (!expoDevices.length) return;
    const response = await this.fetcher('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(expoDevices.map((device) => ({
        to: device.pushToken,
        title: payload.title,
        body: payload.body,
        priority: payload.priority,
        channelId: this.channelFor(payload.type),
        data: {
          notificationId: payload.notificationId,
          type: payload.type,
          entityType: payload.entityType,
          entityId: payload.entityId ?? '',
          deepLink: payload.deepLink,
        },
      }))),
    });
    if (!response.ok) return;
    const result = await response.json() as ExpoPushResponse;
    const invalidTokens = (result.data ?? []).flatMap((ticket, index) =>
      ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
        ? [expoDevices[index]?.pushToken].filter((token): token is string => Boolean(token))
        : []
    );
    if (invalidTokens.length) await this.devices.markTokensInactive(invalidTokens);
  }

  private channelFor(type: string) {
    if (type === 'CALL_NEXT_PATIENT' || type === 'REFERRAL') return 'hms_appointments';
    if (type === 'LAB_RESULT' || type === 'IMAGING_REPORT' || type === 'CONSENT_REQUIRED') return 'hms_clinical';
    if (type === 'INVOICE_PENDING') return 'hms_billing';
    return 'hms_general';
  }
}
