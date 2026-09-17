import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { toast } from 'sonner';
import { notificationsService } from '../../services/notifications.service';

export const notificationKeys = {
  unread: ['notifications', 'unread'] as const,
};

export function useUnreadNotifications(enabled = true) {
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: () => notificationsService.listMe({ is_read: false, limit: 10 }),
    enabled,
    refetchInterval: 5_000,
  });
}

export function useSidebarNotifications(enabled: boolean) {
  const query = useUnreadNotifications(enabled);
  const client = useQueryClient();
  const pending = useRef(false);
  const mutation = useMutation({
    mutationFn: async (id: string | undefined) => {
      if (id) await notificationsService.markAsRead(id);
      else await notificationsService.markAllRead();
    },
    onSuccess: () => { toast.success('Notifications marked as read.'); },
    onError: () => { toast.error('Unable to mark notifications as read. Please retry.'); },
    onSettled: () => client.invalidateQueries({ queryKey: notificationKeys.unread }),
  });
  const markRead = async (id?: string) => {
    if (pending.current) return;
    pending.current = true;
    try { await mutation.mutateAsync(id); }
    catch { return; /* Mutation provides user feedback. */ }
    finally { pending.current = false; }
  };
  const meta = query.data?.meta;
  const total = meta && typeof meta === 'object' && 'total' in meta &&
    typeof meta.total === 'number' && Number.isFinite(meta.total) && meta.total >= 0
    ? meta.total : query.data?.data.length ?? 0;
  return { query, markRead, isMarking: mutation.isPending, markError: mutation.isError, total };
}
