import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import type { ImagingReportRecord } from '../../records/contracts';
import { formatDateTime } from './LabResultDetailsModal';
import { colors, radius, shadows, spacing, typography } from '../theme';

interface ImagingReportDetailsModalProps {
  report: ImagingReportRecord | null;
  onClose: () => void;
}

export function ImagingReportDetailsModal({
  report,
  onClose,
}: ImagingReportDetailsModalProps) {
  if (!report) return null;

  return (
    <Modal
      visible={Boolean(report)}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              {/* Modal Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <Text style={styles.headerSubtitle}>Radiology & Imaging</Text>
                  <Text style={styles.headerTitle}>Diagnostic Imaging Report</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Verification Metadata */}
                <View style={styles.metaRow}>
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedBadgeText}>✓ VERIFIED</Text>
                  </View>
                  <Text style={styles.dateText}>
                    📅 Verified: {formatDateTime(report.verified_at)}
                  </Text>
                </View>

                {/* Impression Section */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Radiological Impression</Text>
                  <View style={styles.impressionBox}>
                    <Text style={styles.impressionText}>{report.impression}</Text>
                  </View>
                </View>

                {/* Findings Section */}
                {report.findings ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Clinical Findings</Text>
                    <View style={styles.findingsBox}>
                      <Text style={styles.findingsText}>{report.findings}</Text>
                    </View>
                  </View>
                ) : null}

                {/* Recommendations Section */}
                {report.recommendations ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Clinical Recommendations</Text>
                    <View style={styles.recommendationsBox}>
                      <Text style={styles.recommendationsText}>{report.recommendations}</Text>
                    </View>
                  </View>
                ) : null}

                {/* Timestamp Details */}
                <View style={styles.timelineRow}>
                  <Text style={styles.timelineText}>
                    Entered: {formatDateTime(report.entered_at)} · Verified:{' '}
                    {formatDateTime(report.verified_at)}
                  </Text>
                </View>

                {/* Clinical Disclaimer */}
                <View style={styles.disclaimerBox}>
                  <Text style={styles.disclaimerIcon}>ℹ️</Text>
                  <Text style={styles.disclaimerText}>
                    This imaging report was interpreted and verified by the radiology team. Please review with your doctor for next steps.
                  </Text>
                </View>
              </ScrollView>

              {/* Footer */}
              <View style={styles.footer}>
                <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.8}>
                  <Text style={styles.doneBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: colors.neutral.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '88%',
    paddingBottom: spacing.xxl,
    ...shadows.modal,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerLeft: {
    flex: 1,
    marginRight: spacing.sm + 2,
  },
  headerSubtitle: {
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.tight,
    color: colors.brand.primary,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.widest,
  },
  headerTitle: {
    ...typography.presets.sectionTitle,
    color: colors.text.primary,
    marginTop: 2,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  closeBtnText: {
    ...typography.presets.sectionTitle,
    color: colors.text.secondary,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  verifiedBadge: {
    backgroundColor: colors.status.successBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.xs + 2,
  },
  verifiedBadgeText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.status.success,
  },
  dateText: {
    ...typography.presets.captionMedium,
    color: colors.text.secondary,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.tight,
    fontWeight: typography.weight.bold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.widest,
    marginBottom: spacing.sm,
  },
  impressionBox: {
    backgroundColor: colors.brand.primarySubtle,
    borderWidth: 1,
    borderColor: colors.brand.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md + 2,
  },
  impressionText: {
    ...typography.presets.bodyStrong,
    color: colors.brand.primaryDark,
  },
  findingsBox: {
    backgroundColor: colors.neutral.background,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    padding: spacing.md + 2,
  },
  findingsText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  recommendationsBox: {
    backgroundColor: colors.status.successBg,
    borderWidth: 1,
    borderColor: colors.status.successBorder,
    borderRadius: radius.md,
    padding: spacing.md + 2,
  },
  recommendationsText: {
    ...typography.presets.bodySmall,
    color: colors.status.success,
  },
  timelineRow: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  timelineText: {
    ...typography.presets.caption,
    color: colors.text.muted,
    fontStyle: 'italic',
  },
  disclaimerBox: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm + 2,
  },
  disclaimerIcon: {
    fontSize: typography.size.sm,
    marginRight: spacing.sm,
    marginTop: 1,
  },
  disclaimerText: {
    flex: 1,
    ...typography.presets.caption,
    color: colors.text.secondary,
    lineHeight: typography.lineHeight.tight,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  doneBtn: {
    backgroundColor: colors.neutral.surfaceSubtle,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  doneBtnText: {
    ...typography.presets.button,
    color: colors.text.secondary,
  },
});
