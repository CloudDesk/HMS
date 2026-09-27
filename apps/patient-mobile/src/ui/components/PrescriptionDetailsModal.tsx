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
import type { PrescriptionRecord } from '../../prescriptions/contracts';

interface PrescriptionDetailsModalProps {
  prescription: PrescriptionRecord | null;
  onClose: () => void;
}

export function prescriptionStatusBadge(status: string): { bg: string; text: string; label: string } {
  switch (status.toUpperCase()) {
    case 'DISPENSED':
      return { bg: '#DCFCE7', text: '#15803D', label: 'Dispensed' };
    case 'SUBMITTED':
      return { bg: '#E0F2FE', text: '#0369A1', label: 'Doctor Issued' };
    case 'CANCELLED':
      return { bg: '#FEE2E2', text: '#B91C1C', label: 'Cancelled' };
    default:
      return { bg: '#F1F5F9', text: '#475569', label: status };
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  doctorTitle: {
    fontSize: 14,
    color: '#0284C7',
    fontWeight: '600',
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
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyItemsText: {
    color: '#94A3B8',
    fontSize: 13,
    fontStyle: 'italic',
  },
  medicinesList: {
    gap: 12,
  },
  medicineCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  medIcon: {
    fontSize: 16,
  },
  medTitleContainer: {
    flex: 1,
  },
  medicineName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  medicineStrength: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '500',
    marginTop: 1,
  },
  qtyBadge: {
    backgroundColor: '#EEF2F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  qtyText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  medDetailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    marginBottom: 8,
  },
  medDetailCol: {
    flex: 1,
  },
  medDetailLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  medDetailValue: {
    fontSize: 12,
    color: '#1E293B',
    fontWeight: '600',
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0F9FF',
    borderRadius: 6,
    padding: 8,
    marginTop: 2,
  },
  instructionIcon: {
    fontSize: 12,
    marginRight: 6,
    marginTop: 1,
  },
  instructionText: {
    flex: 1,
    fontSize: 12,
    color: '#0369A1',
    lineHeight: 16,
  },
  adviceBox: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  adviceTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E40AF',
    marginBottom: 4,
  },
  adviceContent: {
    fontSize: 12,
    color: '#1E3A8A',
    lineHeight: 18,
  },
  followUpBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  followUpTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#166534',
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
