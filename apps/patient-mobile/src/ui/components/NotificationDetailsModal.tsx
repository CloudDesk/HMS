import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  formatNotificationTime,
  getNotificationDestination,
  getNotificationTypeIcon,
  getNotificationTypeLabel,
  type PortalNotification,
} from '../../notifications/contracts';
import type { MainTab } from '../components/BottomNavBar';
import { colors, typography } from '../theme';

interface NotificationDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  notification: PortalNotification | null;
  onNavigateTab?: (
    tab: MainTab,
    options?: {
      entityId?: string | null;
      patientId?: string | null;
      initialQuotationId?: string | null;
    }
  ) => void;
}

export function NotificationDetailsModal({
  visible,
  onClose,
  notification,
  onNavigateTab,
}: NotificationDetailsModalProps) {
  if (!notification) return null;

  const typeIcon = getNotificationTypeIcon(notification.type);
  const typeLabel = getNotificationTypeLabel(notification.type);
  const destination = getNotificationDestination(notification.type);

  const handleAction = () => {
    if (destination && onNavigateTab && notification) {
      onClose();
      onNavigateTab(destination.tab, {
        entityId: notification.related_entity_id,
        patientId: notification.patient_id,
        initialQuotationId:
          notification.type === 'QUOTATION_AVAILABLE'
            ? notification.related_entity_id
            : undefined,
      });
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleGroup}>
              <Text style={styles.headerIcon}>{typeIcon}</Text>
              <Text style={styles.headerTitle}>Notification</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.badgeRow}>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>{typeLabel}</Text>
                </View>
                <Text style={styles.timeText}>
                  {formatNotificationTime(notification.created_at)}
                </Text>
              </View>

              <Text style={styles.titleText}>{notification.title}</Text>
            </View>

            {/* Message Body */}
            <View style={styles.messageCard}>
              <Text style={styles.messageText}>{notification.message}</Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            {destination && onNavigateTab ? (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleAction}
              >
                <Text style={styles.actionButtonText}>
                  {destination.label} →
                </Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity style={styles.closeFullButton} onPress={onClose}>
              <Text style={styles.closeFullButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '35%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    fontSize: typography.size.xl,
  },
  headerTitle: {
    ...typography.presets.sectionTitle,
    color: colors.text.primary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: typography.size.subtitle,
    color: '#64748B',
    fontWeight: typography.weight.semibold,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 20,
    paddingBottom: 16,
  },
  summaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    ...typography.presets.captionStrong,
    fontSize: typography.size.xs,
    color: '#0284C7',
    textTransform: 'uppercase',
  },
  timeText: {
    ...typography.presets.caption,
    color: '#64748B',
  },
  titleText: {
    ...typography.presets.cardTitle,
    fontSize: typography.size.subtitle,
    color: colors.text.primary,
    lineHeight: typography.lineHeight.relaxed,
  },
  messageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  messageText: {
    ...typography.presets.body,
    color: '#334155',
    lineHeight: typography.lineHeight.normal,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  actionButton: {
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    ...typography.presets.button,
    color: '#FFFFFF',
  },
  closeFullButton: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeFullButtonText: {
    ...typography.presets.button,
    fontWeight: typography.weight.semibold,
    color: '#475569',
  },
});
