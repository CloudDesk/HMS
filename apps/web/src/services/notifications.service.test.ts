import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notificationsApi, type NotificationResponse } from '../api/notifications';
import { notificationsService } from './notifications.service';
vi.mock('../api/notifications', () => ({ notificationsApi: { listMe: vi.fn(), markAsRead: vi.fn() } }));
const notification = (id: string): NotificationResponse => ({ id, title: 'Referral', message: 'Test', type: 'REFERRAL', is_read: false,
  recipient_role: null, recipient_user_id: 'u', recipient_branch_id: null, related_entity_id: null, created_at: '2026-09-17', updated_at: '2026-09-17' });
beforeEach(() => vi.resetAllMocks());
describe('mark all unread notifications', () => {
  it('drains paginated unread results without skipping records', async () => {
    vi.mocked(notificationsApi.listMe).mockResolvedValueOnce({ data: [notification('1'), notification('2')], meta: {} })
      .mockResolvedValueOnce({ data: [notification('3')], meta: {} }).mockResolvedValueOnce({ data: [], meta: {} });
    await notificationsService.markAllRead();
    expect(vi.mocked(notificationsApi.markAsRead).mock.calls).toEqual([['1'], ['2'], ['3']]);
    expect(vi.mocked(notificationsApi.listMe).mock.calls.every(([query]) => query?.page === 1)).toBe(true);
  });
  it('reports partial failure and stops instead of pretending all are read', async () => {
    vi.mocked(notificationsApi.listMe).mockResolvedValue({ data: [notification('1'), notification('2')], meta: {} });
    vi.mocked(notificationsApi.markAsRead).mockResolvedValueOnce(notification('1')).mockRejectedValueOnce(new Error('Failed'));
    await expect(notificationsService.markAllRead()).rejects.toThrow('Failed');
  });
  it('stops if the server repeats unread records after successful writes', async () => {
    vi.mocked(notificationsApi.listMe).mockResolvedValue({ data: [notification('1')], meta: {} });
    await expect(notificationsService.markAllRead()).rejects.toThrow('could not be refreshed');
    expect(notificationsApi.markAsRead).toHaveBeenCalledTimes(1);
  });
});
