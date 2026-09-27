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
  getNotificationDestination,
  getNotificationTypeIcon,
  getNotificationTypeLabel,
  type PortalNotification,
} from '../../notifications/contracts';
import { PatientContextSelector } from '../components/PatientContextSelector';
import { NotificationDetailsModal } from '../components/NotificationDetailsModal';
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

  // Clear stale notifications immediately on patient context change
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
        // Optimistic fallback or silent ignore
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadItems = notifications.filter((n) => !n.is_read);
    if (unreadItems.length === 0) return;

    // Optimistically update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

    // Send mark as read requests
    await Promise.allSettled(unreadItems.map((n) => api.markAsRead(n.id)));
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadNotifications(true)}
            colors={['#0284C7']}
            tintColor="#0284C7"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          {onNavigateBack ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onNavigateBack}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
          ) : null}
          <View style={styles.headerTitleWrap}>
            <Text style={styles.screenTitle}>Notifications</Text>
            <Text style={styles.screenSubtitle}>
              Alerts, queue calls & hospital notices
            </Text>
          </View>
          {unreadCount > 0 ? (
            <TouchableOpacity
              style={styles.markAllBtn}
              onPress={handleMarkAllAsRead}
            >
              <Text style={styles.markAllBtnText}>Mark all read</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Patient Context Selector */}
        <PatientContextSelector />

        {/* Filter Tabs */}
        <View style={styles.filterTabs}>
          <TouchableOpacity
            style={[
              styles.filterTab,
              activeFilter === 'ALL' && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter('ALL')}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === 'ALL' && styles.filterTabTextActive,
              ]}
            >
              All ({notifications.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterTab,
              activeFilter === 'UNREAD' && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter('UNREAD')}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === 'UNREAD' && styles.filterTabTextActive,
              ]}
            >
              Unread ({unreadCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Notifications List */}
        {isLoading && !isRefreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0284C7" />
            <Text style={styles.loadingText}>Loading notifications…</Text>
          </View>
        ) : error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Unable to Load Notifications</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => loadNotifications(false)}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : filteredNotifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>
              {activeFilter === 'UNREAD'
                ? 'No Unread Notifications'
                : 'No Notifications'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter === 'UNREAD'
                ? 'You have caught up with all patient alerts and messages.'
                : `Hospital alerts and notifications for ${
                    selectedPatient?.full_name ?? 'this patient'
                  } will appear here.`}
            </Text>
          </View>
        ) : (
          <View style={styles.notifsList}>
            {filteredNotifications.map((notif) => {
              const typeIcon = getNotificationTypeIcon(notif.type);
              const typeLabel = getNotificationTypeLabel(notif.type);
              const destination = getNotificationDestination(notif.type);

              return (
                <TouchableOpacity
                  key={notif.id}
                  style={[
                    styles.notifCard,
                    !notif.is_read && styles.notifCardUnread,
                  ]}
                  onPress={() => void handleOpenNotification(notif)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.iconCircle}>
                      <Text style={styles.notifIcon}>{typeIcon}</Text>
                    </View>
                    <View style={styles.headInfo}>
                      <Text style={styles.typeLabel}>{typeLabel}</Text>
                      <Text
                        style={[
                          styles.titleText,
                          !notif.is_read && styles.titleTextUnread,
                        ]}
                        numberOfLines={1}
                      >
                        {notif.title}
                      </Text>
                    </View>
                    <View style={styles.metaCol}>
                      {!notif.is_read ? <View style={styles.unreadDot} /> : null}
                      <Text style={styles.timeText}>
                        {formatNotificationTime(notif.created_at)}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.messageSnippet} numberOfLines={2}>
                    {notif.message}
                  </Text>

                  {destination && onNavigateTab ? (
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={styles.directActionBtn}
                        onPress={() => onNavigateTab(destination.tab)}
                      >
                        <Text style={styles.directActionText}>
                          {destination.label} →
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Detail Modal */}
      <NotificationDetailsModal
        visible={Boolean(selectedNotif)}
        onClose={() => setSelectedNotif(null)}
        notification={selectedNotif}
        onNavigateTab={onNavigateTab}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerTitleWrap: {
    flex: 1,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  screenSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  markAllBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  markAllBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  filterTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterTabTextActive: {
    color: '#0284C7',
    fontWeight: '700',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  errorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
    marginVertical: 12,
  },
  errorIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  notifsList: {
    gap: 12,
  },
  notifCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  notifCardUnread: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  notifIcon: {
    fontSize: 18,
  },
  headInfo: {
    flex: 1,
  },
  typeLabel: {
    fontSize: 10,
    color: '#0284C7',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  titleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 1,
  },
  titleTextUnread: {
    fontWeight: '800',
    color: '#0F172A',
  },
  metaCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0284C7',
  },
  timeText: {
    fontSize: 11,
    color: '#64748B',
  },
  messageSnippet: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  actionRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'flex-start',
  },
  directActionBtn: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  directActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
});
