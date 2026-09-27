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
    marginBottom: 8,
  },
  impressionBox: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 10,
    padding: 14,
  },
  impressionText: {
    fontSize: 14,
    color: '#0369A1',
    fontWeight: '600',
    lineHeight: 20,
  },
  findingsBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 14,
  },
  findingsText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
  },
  recommendationsBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 14,
  },
  recommendationsText: {
    fontSize: 13,
    color: '#166534',
    lineHeight: 19,
  },
  timelineRow: {
    marginTop: 4,
    marginBottom: 14,
  },
  timelineText: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
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
