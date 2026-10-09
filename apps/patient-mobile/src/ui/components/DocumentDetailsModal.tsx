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
  formatDocumentDate,
  formatFileSize,
  getDocumentTypeIcon,
  getDocumentTypeLabel,
  type PortalDocument,
} from '../../documents/contracts';
import { colors, radius, shadows, spacing, typography } from '../theme';

interface DocumentDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  document: PortalDocument | null;
}

export function DocumentDetailsModal({
  visible,
  onClose,
  document,
}: DocumentDetailsModalProps) {
  if (!document) return null;

  const reviewBadge = (() => {
    switch (document.review_status?.toUpperCase()) {
      case 'VERIFIED': return { label: 'Verified', bg: colors.status.successBg, text: colors.status.success, border: colors.status.successBorder };
      case 'PENDING': return { label: 'Under Review', bg: colors.status.warningBg, text: colors.status.warning, border: colors.status.warningBorder };
      case 'REJECTED': return { label: 'Rejected', bg: colors.status.dangerBg, text: colors.status.danger, border: colors.status.dangerBorder };
      default: return { label: 'Hospital Record', bg: colors.neutral.surfaceSubtle, text: colors.text.secondary, border: colors.border.default };
    }
  })();
  const typeIcon = getDocumentTypeIcon(document.document_type);
  const typeLabel = getDocumentTypeLabel(document.document_type);

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
              <Text style={styles.headerTitle}>Document Details</Text>
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
            {/* Title & Status Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryTopRow}>
                <View style={styles.titleWrap}>
                  <Text style={styles.documentCategory}>{typeLabel}</Text>
                  <Text style={styles.documentTitle}>{document.title}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: reviewBadge.bg,
                      borderColor: reviewBadge.border,
                    },
                  ]}
                >
                  <Text style={[styles.statusText, { color: reviewBadge.text }]}>
                    {reviewBadge.label}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaItem}>
                  📅 Added {formatDocumentDate(document.created_at)}
                </Text>
                <Text style={styles.metaItem}>
                  📁 {formatFileSize(document.file_size_bytes)}
                </Text>
              </View>
            </View>

            {/* Document Details Metadata */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Document Information</Text>
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>File Name</Text>
                  <Text style={styles.infoValue}>{document.file_name}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Document Format</Text>
                  <Text style={styles.infoValue}>{document.mime_type}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>File Size</Text>
                  <Text style={styles.infoValue}>
                    {formatFileSize(document.file_size_bytes)}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Source</Text>
                  <Text style={styles.infoValue}>
                    {document.source === 'HOSPITAL'
                      ? 'Hospital Issued'
                      : document.source === 'GUARDIAN'
                      ? 'Uploaded by Guardian'
                      : 'Uploaded by Patient'}
                  </Text>
                </View>

                {document.provider_name ? (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Provider / Facility</Text>
                    <Text style={styles.infoValue}>{document.provider_name}</Text>
                  </View>
                ) : null}

                {document.document_date ? (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Document Date</Text>
                    <Text style={styles.infoValue}>
                      {formatDocumentDate(document.document_date)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Description / Notes */}
            {document.description ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Description & Notes</Text>
                <View style={styles.descriptionCard}>
                  <Text style={styles.descriptionText}>{document.description}</Text>
                </View>
              </View>
            ) : null}

            {/* Security & Access Notice */}
            <View style={styles.securityBanner}>
              <Text style={styles.securityIcon}>🔒</Text>
              <View style={styles.securityContent}>
                <Text style={styles.securityTitle}>Secure Record Storage</Text>
                <Text style={styles.securityText}>
                  This medical document is protected under patient health confidentiality
                  rules and verified within your hospital health records.
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
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
    backgroundColor: colors.neutral.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '85%',
    minHeight: '40%',
    paddingBottom: spacing.xxl,
    ...shadows.modal,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
    borderRadius: radius.full,
    backgroundColor: colors.neutral.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    ...typography.presets.bodySmallStrong,
    color: colors.text.secondary,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: spacing.xl,
    paddingBottom: spacing.lg,
  },
  summaryCard: {
    backgroundColor: colors.neutral.background,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.lg,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  titleWrap: {
    flex: 1,
    marginRight: spacing.sm,
  },
  documentCategory: {
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.tight,
    color: colors.brand.primary,
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  documentTitle: {
    ...typography.presets.sectionTitle,
    color: colors.text.primary,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  statusText: {
    ...typography.presets.captionStrong,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    paddingTop: spacing.sm + 2,
  },
  metaItem: {
    ...typography.presets.captionMedium,
    color: colors.text.secondary,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.presets.bodyStrong,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  infoCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.md,
    padding: spacing.md + 2,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.background,
  },
  infoLabel: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  infoValue: {
    ...typography.presets.bodySmallStrong,
    color: colors.text.primary,
    maxWidth: '60%',
    textAlign: 'right',
  },
  descriptionCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.md,
    padding: spacing.md + 2,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  descriptionText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  securityBanner: {
    flexDirection: 'row',
    backgroundColor: colors.status.successBg,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.status.successBorder,
    gap: spacing.sm + 2,
    marginTop: spacing.xs,
  },
  securityIcon: {
    fontSize: typography.size.title,
  },
  securityContent: {
    flex: 1,
  },
  securityTitle: {
    ...typography.presets.bodySmallStrong,
    color: colors.status.success,
    marginBottom: 2,
  },
  securityText: {
    ...typography.presets.caption,
    color: colors.status.success,
    lineHeight: typography.lineHeight.tight,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  closeFullButton: {
    backgroundColor: colors.neutral.surfaceSubtle,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  closeFullButtonText: {
    ...typography.presets.button,
    color: colors.text.secondary,
  },
});
