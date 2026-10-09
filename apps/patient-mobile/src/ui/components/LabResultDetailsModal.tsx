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
import type { LabResultRecord } from '../../records/contracts';
import { colors, radius, shadows, spacing, typography } from '../theme';

interface LabResultDetailsModalProps {
  result: LabResultRecord | null;
  onClose: () => void;
}

export function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function LabResultDetailsModal({
  result,
  onClose,
}: LabResultDetailsModalProps) {
  if (!result) return null;

  const testTitle =
    result.result_items.map((i) => i.serviceName).join(', ') || 'Laboratory Test Result';

  return (
    <Modal
      visible={Boolean(result)}
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
                  <Text style={styles.headerSubtitle}>Laboratory Report</Text>
                  <Text style={styles.headerTitle} numberOfLines={2}>
                    {testTitle}
                  </Text>
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
                    📅 Verified on {formatDateTime(result.verified_at)}
                  </Text>
                </View>

                {/* Test Items Breakdown */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    Test Parameters ({result.result_items.length})
                  </Text>

                  <View style={styles.itemsList}>
                    {result.result_items.map((item, index) => (
                      <View key={`${item.serviceName}-${index}`} style={styles.paramCard}>
                        <View style={styles.paramHeader}>
                          <Text style={styles.paramName}>{item.serviceName}</Text>
                          <View style={styles.valueBox}>
                            <Text style={styles.paramValue}>{item.value}</Text>
                            {item.unit ? <Text style={styles.paramUnit}> {item.unit}</Text> : null}
                          </View>
                        </View>

                        {item.referenceRange ? (
                          <View style={styles.refRow}>
                            <Text style={styles.refLabel}>Reference Range:</Text>
                            <Text style={styles.refValue}>{item.referenceRange}</Text>
                          </View>
                        ) : null}

                        {item.comments ? (
                          <View style={styles.commentsRow}>
                            <Text style={styles.commentsLabel}>Note: </Text>
                            <Text style={styles.commentsValue}>{item.comments}</Text>
                          </View>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>

                {/* Pathologist / Lab Remarks */}
                {result.remarks ? (
                  <View style={styles.remarksBox}>
                    <Text style={styles.remarksTitle}>📋 Laboratory Remarks</Text>
                    <Text style={styles.remarksContent}>{result.remarks}</Text>
                  </View>
                ) : null}

                {/* Clinical Disclaimer */}
                <View style={styles.disclaimerBox}>
                  <Text style={styles.disclaimerIcon}>ℹ️</Text>
                  <Text style={styles.disclaimerText}>
                    This diagnostic report is verified by the laboratory. Please consult your physician for clinical interpretation and treatment guidance.
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
    marginBottom: spacing.sm + 2,
  },
  itemsList: {
    gap: spacing.sm + 2,
  },
  paramCard: {
    backgroundColor: colors.neutral.background,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  paramHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paramName: {
    ...typography.presets.bodySmallStrong,
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing.sm,
  },
  valueBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: colors.neutral.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.xs + 2,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  paramValue: {
    ...typography.presets.bodyStrong,
    color: colors.text.primary,
  },
  paramUnit: {
    ...typography.presets.captionMedium,
    color: colors.text.secondary,
    marginLeft: spacing.xxs,
  },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs + 2,
    paddingTop: spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  refLabel: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    marginRight: spacing.xs + 2,
  },
  refValue: {
    ...typography.presets.captionStrong,
    color: colors.text.secondary,
  },
  commentsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.xs,
  },
  commentsLabel: {
    ...typography.presets.captionStrong,
    color: colors.text.secondary,
  },
  commentsValue: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    flex: 1,
  },
  remarksBox: {
    backgroundColor: colors.status.successBg,
    borderWidth: 1,
    borderColor: colors.status.successBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md + 2,
  },
  remarksTitle: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.status.success,
    marginBottom: spacing.xs,
  },
  remarksContent: {
    fontSize: typography.size.xs,
    color: colors.status.success,
    lineHeight: typography.lineHeight.snug,
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
