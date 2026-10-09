import { describe, expect, it, vi } from 'vitest';
import type { DeviceService } from '../devices/device.service.js';
import type { MobileDevice } from '../devices/device.types.js';
import type { Notification } from './notification.types.js';
import { PushNotificationService } from './push-notification.service.js';

const notification: Notification = {
  id: 'notification-1',
  recipient_role: null,
  recipient_user_id: 'user-1',
  recipient_branch_id: null,
  patient_id: 'patient-secret-id',
  title: 'John Patient has a critical result',
  message: 'Sensitive clinical result details',
  type: 'LAB_RESULT',
  related_entity_id: 'result-1',
  is_read: false,
  created_at: new Date('2026-10-08T10:00:00.000Z'),
  updated_at: new Date('2026-10-08T10:00:00.000Z'),
};

const device = (pushToken: string): MobileDevice => ({
  id: 'device-1',
  userId: 'user-1',
  installationId: 'install-1',
  platform: 'android',
  pushToken,
  isActive: true,
  lastRegisteredAt: new Date(),
  lastSeenAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('PushNotificationService', () => {
  it('sends a PHI-minimized payload to every active Expo device', async () => {
    const devices = {
      getActiveDevicesForUser: vi.fn().mockResolvedValue([
        device('ExpoPushToken[token-a]'),
        device('ExponentPushToken[token-b]'),
      ]),
      markTokensInactive: vi.fn(),
    } as unknown as DeviceService;
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ status: 'ok', id: 'ticket-a' }, { status: 'ok', id: 'ticket-b' }],
    }), { status: 200 })) as unknown as typeof fetch;

    await new PushNotificationService(devices, fetcher).sendToUser('user-1', notification);

    expect(fetcher).toHaveBeenCalledOnce();
    const request = vi.mocked(fetcher).mock.calls[0]?.[1];
    const messages = JSON.parse(String(request?.body)) as Array<{ title: string; body: string; to: string }>;
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      to: 'ExpoPushToken[token-a]',
      title: 'Laboratory update',
      body: 'A new laboratory update is available in MyCare.',
    });
    expect(String(request?.body)).not.toContain('John Patient');
    expect(String(request?.body)).not.toContain('Sensitive clinical result details');
    expect(String(request?.body)).not.toContain('patient-secret-id');
  });

  it('deactivates tokens rejected as DeviceNotRegistered', async () => {
    const markTokensInactive = vi.fn().mockResolvedValue(1);
    const devices = {
      getActiveDevicesForUser: vi.fn().mockResolvedValue([device('ExpoPushToken[invalid]')]),
      markTokensInactive,
    } as unknown as DeviceService;
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }],
    }), { status: 200 })) as unknown as typeof fetch;

    await new PushNotificationService(devices, fetcher).sendToUser('user-1', notification);

    expect(markTokensInactive).toHaveBeenCalledWith(['ExpoPushToken[invalid]']);
  });

  it('does not fail the caller when the provider is unavailable', async () => {
    const devices = {
      getActiveDevicesForUser: vi.fn().mockResolvedValue([device('ExpoPushToken[token-a]')]),
      markTokensInactive: vi.fn(),
    } as unknown as DeviceService;
    const fetcher = vi.fn().mockRejectedValue(new Error('provider unavailable')) as unknown as typeof fetch;

    await expect(new PushNotificationService(devices, fetcher).sendToUser('user-1', notification))
      .resolves.toBeUndefined();
  });
});
