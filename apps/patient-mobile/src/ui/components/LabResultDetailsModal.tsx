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
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flex: 1,
    marginRight: 10,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  verifiedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  dateText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  itemsList: {
    gap: 10,
  },
  paramCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  paramHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paramName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
    marginRight: 8,
  },
  valueBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  paramValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  paramUnit: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#EDF2F7',
  },
  refLabel: {
    fontSize: 11,
    color: '#64748B',
    marginRight: 6,
  },
  refValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  commentsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  commentsLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  commentsValue: {
    fontSize: 11,
    color: '#475569',
    flex: 1,
  },
  remarksBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  remarksTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 4,
  },
  remarksContent: {
    fontSize: 12,
    color: '#14532D',
    lineHeight: 18,
  },
  disclaimerBox: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginBottom: 10,
  },
  disclaimerIcon: {
    fontSize: 13,
    marginRight: 8,
    marginTop: 1,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  doneBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
});
