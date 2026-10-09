import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  type ColorValue,
} from 'react-native';
import type { PrescriptionRecord } from '../../prescriptions/contracts';
import { colors, typography } from '../theme';

interface PrescriptionDetailsModalProps {
  prescription: PrescriptionRecord | null;
  onClose: () => void;
}

export function prescriptionStatusBadge(status: string): { bg: ColorValue; text: ColorValue; label: string } {
  switch (status.toUpperCase()) {
    case 'DISPENSED':
      return { bg: colors.status.successBg, text: colors.status.success, label: 'Dispensed' };
    case 'SUBMITTED':
      return { bg: colors.brand.primaryLight, text: colors.brand.primaryDark, label: 'Doctor Issued' };
    case 'CANCELLED':
      return { bg: colors.status.dangerBg, text: colors.status.danger, label: 'Cancelled' };
    default:
      return { bg: colors.neutral.surfaceSubtle, text: colors.text.secondary, label: status };
  }
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

export function PrescriptionDetailsModal({
  prescription,
  onClose,
}: PrescriptionDetailsModalProps) {
  if (!prescription) return null;

  const status = prescriptionStatusBadge(prescription.status);
  const cleanDoctorName = prescription.doctor_name.replace(/^Dr\.?\s+/i, '');

  return (
    <Modal
      visible={Boolean(prescription)}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <Text style={styles.headerTitle}>Prescription Details</Text>
                  <Text style={styles.doctorTitle}>Dr. {cleanDoctorName}</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Status & Date Bar */}
                <View style={styles.metaRow}>
                  <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.statusText, { color: status.text }]}>
                      {status.label}
                    </Text>
                  </View>
                  <Text style={styles.dateText}>
                    📅 Issued: {formatDateTime(prescription.submitted_at)}
                  </Text>
                </View>

                {/* Prescribed Medicines Section */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>
                      Prescribed Medicines ({prescription.items.length})
                    </Text>
                  </View>

                  {prescription.items.length === 0 ? (
                    <Text style={styles.emptyItemsText}>No medicines listed in this prescription.</Text>
                  ) : (
                    <View style={styles.medicinesList}>
                      {prescription.items.map((item, index) => (
                        <View key={item.id || String(index)} style={styles.medicineCard}>
                          <View style={styles.medHeader}>
                            <View style={styles.medIconBox}>
                              <Text style={styles.medIcon}>💊</Text>
                            </View>
                            <View style={styles.medTitleContainer}>
                              <Text style={styles.medicineName}>{item.medicine_name}</Text>
                              {item.strength ? (
                                <Text style={styles.medicineStrength}>{item.strength}</Text>
                              ) : null}
                            </View>
                            {item.quantity ? (
                              <View style={styles.qtyBadge}>
                                <Text style={styles.qtyText}>Qty: {item.quantity}</Text>
                              </View>
                            ) : null}
                          </View>

                          <View style={styles.medDetailsGrid}>
                            <View style={styles.medDetailCol}>
                              <Text style={styles.medDetailLabel}>Dosage & Route</Text>
                              <Text style={styles.medDetailValue}>
                                {[item.dosage, item.route].filter(Boolean).join(' · ') || '—'}
                              </Text>
                            </View>
                            <View style={styles.medDetailCol}>
                              <Text style={styles.medDetailLabel}>Frequency</Text>
                              <Text style={styles.medDetailValue}>{item.frequency || '—'}</Text>
                            </View>
                            <View style={styles.medDetailCol}>
                              <Text style={styles.medDetailLabel}>Duration</Text>
                              <Text style={styles.medDetailValue}>{item.duration || '—'}</Text>
                            </View>
                          </View>

                          {item.instructions ? (
                            <View style={styles.instructionRow}>
                              <Text style={styles.instructionIcon}>ℹ️</Text>
                              <Text style={styles.instructionText}>{item.instructions}</Text>
                            </View>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Doctor's Advice / Patient Instructions */}
                {prescription.patient_instructions ? (
                  <View style={styles.adviceBox}>
                    <Text style={styles.adviceTitle}>🩺 Doctor's Advice & Instructions</Text>
                    <Text style={styles.adviceContent}>{prescription.patient_instructions}</Text>
                  </View>
                ) : null}

                {/* Follow-up Date */}
                {prescription.follow_up_date ? (
                  <View style={styles.followUpBox}>
                    <Text style={styles.followUpTitle}>
                      🗓️ Scheduled Follow-up: {formatDateTime(prescription.follow_up_date)}
                    </Text>
                  </View>
                ) : null}
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
    borderBottomColor: colors.border.subtle,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    ...typography.presets.sectionTitle,
    color: colors.text.primary,
  },
  doctorTitle: {
    ...typography.presets.bodyStrong,
    color: colors.text.brand,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: typography.size.title,
    color: colors.text.secondary,
    fontWeight: typography.weight.semibold,
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
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    ...typography.presets.captionStrong,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
  },
  dateText: {
    ...typography.presets.captionMedium,
    color: colors.text.secondary,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    ...typography.presets.cardTitle,
    color: colors.text.primary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
  },
  emptyItemsText: {
    ...typography.presets.bodySmall,
    color: colors.text.muted,
    fontStyle: 'italic',
  },
  medicinesList: {
    gap: 12,
  },
  medicineCard: {
    backgroundColor: colors.neutral.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: 14,
  },
  medHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  medIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  medIcon: {
    fontSize: typography.size.subtitle,
  },
  medTitleContainer: {
    flex: 1,
  },
  medicineName: {
    ...typography.presets.bodyStrong,
    fontSize: typography.size.md,
    color: colors.text.primary,
  },
  medicineStrength: {
    ...typography.presets.captionMedium,
    color: colors.text.brand,
    marginTop: 1,
  },
  qtyBadge: {
    backgroundColor: colors.neutral.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  qtyText: {
    ...typography.presets.captionMedium,
    fontSize: typography.size.xs,
    color: colors.text.secondary,
  },
  medDetailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.neutral.surface,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: 8,
  },
  medDetailCol: {
    flex: 1,
  },
  medDetailLabel: {
    ...typography.presets.micro,
    color: colors.text.secondary,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  medDetailValue: {
    ...typography.presets.captionStrong,
    color: colors.text.primary,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.brand.primarySubtle,
    borderRadius: 6,
    padding: 8,
    marginTop: 2,
  },
  instructionIcon: {
    fontSize: typography.size.caption,
    marginRight: 6,
    marginTop: 1,
  },
  instructionText: {
    flex: 1,
    ...typography.presets.caption,
    color: colors.brand.primaryDark,
    lineHeight: typography.lineHeight.normal,
  },
  adviceBox: {
    backgroundColor: colors.status.infoBg,
    borderWidth: 1,
    borderColor: colors.status.infoBorder,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  adviceTitle: {
    ...typography.presets.bodySmallStrong,
    color: colors.status.info,
    marginBottom: 4,
  },
  adviceContent: {
    ...typography.presets.caption,
    color: colors.status.info,
    lineHeight: typography.lineHeight.relaxed,
  },
  followUpBox: {
    backgroundColor: colors.status.successBg,
    borderWidth: 1,
    borderColor: colors.status.successBorder,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  followUpTitle: {
    ...typography.presets.bodySmallMedium,
    fontWeight: typography.weight.semibold,
    color: colors.status.success,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  doneBtn: {
    backgroundColor: colors.neutral.surfaceSubtle,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    ...typography.presets.button,
    color: colors.text.secondary,
  },
});
