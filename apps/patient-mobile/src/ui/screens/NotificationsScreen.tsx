import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../AuthContext';
import { usePatient } from '../../portal/PatientContext';
import { NotificationsApi } from '../../notifications/notifications-api';
import {
  formatNotificationTime,
  getNotificationTypeIcon,
  getNotificationTypeLabel,
  type PortalNotification,
} from '../../notifications/contracts';
import { PatientContextSelector } from '../components/PatientContextSelector';
import { NotificationDetailsModal } from '../components/NotificationDetailsModal';
import { AppHeader } from '../components/AppHeader';
import { EmptyState } from '../components/EmptyState';
import { colors, radius, shadows, spacing, typography } from '../theme';
import type { MainTab } from '../components/BottomNavBar';

type FilterMode = 'ALL' | 'UNREAD';

interface NotificationsScreenProps {
  onNavigateBack?: () => void;
  onNavigateTab?: (tab: MainTab) => void;
}

export function NotificationsScreen({
  onNavigateBack,
  onNavigateTab,
}: NotificationsScreenProps) {
  const { manager } = useAuth();
  const { selectedPatient, selectedPatientId } = usePatient();

  const [activeFilter, setActiveFilter] = useState<FilterMode>('ALL');
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Selected notification for detail modal
  const [selectedNotif, setSelectedNotif] = useState<PortalNotification | null>(
    null
  );

  const api = useMemo(() => new NotificationsApi(manager), [manager]);

  const loadNotifications = useCallback(
    async (isRefresh = false) => {
      if (!selectedPatientId) return;

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const response = await api.listNotifications(undefined, 1, 50);
        setNotifications(response.data);
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Unable to load notifications. Please retry.';
        setError(msg);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [api, selectedPatientId]
  );

  useEffect(() => {
    setNotifications([]);
    setSelectedNotif(null);
    if (selectedPatientId) {
      void loadNotifications(false);
    }
  }, [selectedPatientId, loadNotifications]);

  const handleOpenNotification = async (item: PortalNotification) => {
    setSelectedNotif(item);
    if (!item.is_read) {
      try {
        const updated = await api.markAsRead(item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? updated : n))
        );
      } catch {
        // Optimistic fallback
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const unreadList = notifications.filter((n) => !n.is_read);
      await Promise.all(unreadList.map((n) => api.markAsRead(n.id)));
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
    } catch {
      // Optimistic fallback
    }
  };

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'UNREAD') {
      return notifications.filter((n) => !n.is_read);
    }
    return notifications;
  }, [notifications, activeFilter]);

  return (
    <View style={styles.screenContainer}>
      <AppHeader
        title="Notifications"
        subtitle={`Care updates & alerts for ${selectedPatient?.full_name ?? 'selected profile'}`}
        onBack={onNavigateBack}
        rightAction={
          unreadCount > 0 ? (
            <TouchableOpacity onPress={handleMarkAllRead} activeOpacity={0.7}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadNotifications(true)}
            colors={[colors.brand.primary]}
            tintColor={colors.brand.primary}
          />
        }
      >
        {/* Patient Switcher */}
        <PatientContextSelector />

        {/* Filter Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeFilter === 'ALL' && styles.tabButtonActive]}
            onPress={() => setActiveFilter('ALL')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeFilter === 'ALL' && styles.tabTextActive]}>
              All ({notifications.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeFilter === 'UNREAD' && styles.tabButtonActive]}
            onPress={() => setActiveFilter('UNREAD')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeFilter === 'UNREAD' && styles.tabTextActive]}>
              Unread ({unreadCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Loading State */}
        {isLoading && !isRefreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color={colors.brand.primary} />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        ) : null}

        {/* Error State */}
        {error && !isLoading ? (
          <EmptyState
            icon="⚠️"
            title="Unable to Load Notifications"
            description={error}
            actionLabel="Try Again"
            onAction={() => loadNotifications()}
          />
        ) : null}

        {/* Empty State */}
        {!isLoading && !error && filteredNotifications.length === 0 ? (
          <EmptyState
            icon="🔔"
            title="No Notifications"
            description={
              activeFilter === 'UNREAD'
                ? 'All caught up! You have no unread notifications.'
                : 'Care alerts, appointment reminders, and report updates will appear here.'
            }
          />
        ) : null}

        {/* Notifications List */}
        {!isLoading && !error && filteredNotifications.length > 0 ? (
          <View style={styles.listContainer}>
            {filteredNotifications.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.card,
                  !item.is_read && styles.cardUnread,
                ]}
                onPress={() => void handleOpenNotification(item)}
                activeOpacity={0.75}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.notifIconCircle}>
                    <Text style={styles.notifIconEmoji}>
                      {getNotificationTypeIcon(item.type)}
                    </Text>
                  </View>
                  <View style={styles.notifContent}>
                    <View style={styles.titleRow}>
                      <Text
                        style={[
                          styles.notifTitle,
                          !item.is_read && styles.notifTitleUnread,
                        ]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      {!item.is_read ? <View style={styles.unreadDot} /> : null}
                    </View>
                    <Text style={styles.notifMessage} numberOfLines={2}>
                      {item.message}
                    </Text>
                    <View style={styles.notifFooter}>
                      <Text style={styles.typeBadge}>
                        {getNotificationTypeLabel(item.type)}
                      </Text>
                      <Text style={styles.timeText}>
                        {formatNotificationTime(item.created_at)}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {/* Notification Details Modal */}
      <NotificationDetailsModal
        notification={selectedNotif}
        visible={Boolean(selectedNotif)}
        onClose={() => setSelectedNotif(null)}
        onNavigateTab={onNavigateTab}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  markAllText: {
    fontSize: typography.size.xs + 1,
    color: colors.brand.primary,
    fontWeight: typography.weight.bold,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.surfaceSubtle,
    borderRadius: radius.md,
    padding: spacing.xxs,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  tabButtonActive: {
    backgroundColor: colors.neutral.surface,
    ...shadows.subtle,
  },
  tabText: {
    fontSize: typography.size.xs + 1,
    fontWeight: typography.weight.medium,
    color: colors.text.secondary,
  },
  tabTextActive: {
    color: colors.brand.primaryDark,
    fontWeight: typography.weight.bold,
  },
  centerContainer: {
    paddingVertical: spacing.xxxl,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.size.sm,
    color: colors.text.secondary,
  },
  listContainer: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    ...shadows.subtle,
  },
  cardUnread: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.primarySubtle,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notifIconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.neutral.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  notifIconEmoji: {
    fontSize: 18,
  },
  notifContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxs,
  },
  notifTitle: {
    fontSize: typography.size.sm + 1,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
    flex: 1,
  },
  notifTitleUnread: {
    fontWeight: typography.weight.bold,
    color: colors.brand.primaryDark,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.brand.primary,
    marginLeft: spacing.xs,
  },
  notifMessage: {
    fontSize: typography.size.xs + 1,
    color: colors.text.secondary,
    lineHeight: typography.lineHeight.normal,
    marginBottom: spacing.sm,
  },
  notifFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    fontWeight: typography.weight.medium,
  },
  timeText: {
    fontSize: 10,
    color: colors.text.muted,
  },
});
