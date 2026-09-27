import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { usePatient } from '../../portal/PatientContext';
import { relationshipLabel } from '../../portal/formatters';

export function PatientContextSelector() {
  const { context, selectedPatient, switchPatient } = usePatient();
  const [modalOpen, setModalOpen] = useState(false);

  if (!context || context.patients.length <= 1) {
    // Only one patient profile (Self) — show simple context badge
    if (!selectedPatient) return null;
    return (
      <View style={styles.singleContextBadge}>
        <Text style={styles.singleContextText}>
          👤 {selectedPatient.full_name} ({relationshipLabel(selectedPatient.relationship)})
        </Text>
      </View>
    );
  }

  const handleSelect = async (patientId: string) => {
    setModalOpen(false);
    if (patientId !== selectedPatient?.id) {
      await switchPatient(patientId);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={styles.selectorButton}
        onPress={() => setModalOpen(true)}
        activeOpacity={0.7}
      >
        <View style={styles.selectorLeft}>
          <Text style={styles.selectorLabel}>Viewing Patient:</Text>
          <Text style={styles.selectorName} numberOfLines={1}>
            {selectedPatient?.full_name ?? 'Select Patient'}
          </Text>
        </View>
        <View style={styles.selectorRight}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>
              {selectedPatient ? relationshipLabel(selectedPatient.relationship) : ''}
            </Text>
          </View>
          <Text style={styles.arrowIcon}>▼</Text>
        </View>
      </TouchableOpacity>

      <Modal
        visible={modalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModalOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Switch Patient Context</Text>
                  <TouchableOpacity
                    onPress={() => setModalOpen(false)}
                    style={styles.closeButton}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalSubtitle}>
                  Select a registered family member to view their records and appointments.
                </Text>

                <View style={styles.patientList}>
                  {context.patients.map((patient) => {
                    const isSelected = patient.id === selectedPatient?.id;
                    const initials = patient.full_name
                      .split(' ')
                      .slice(0, 2)
                      .map((p) => p[0])
                      .join('')
                      .toUpperCase();

                    return (
                      <TouchableOpacity
                        key={patient.id}
                        style={[
                          styles.patientItem,
                          isSelected && styles.patientItemSelected,
                        ]}
                        onPress={() => void handleSelect(patient.id)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.avatar, isSelected && styles.avatarSelected]}>
                          <Text
                            style={[
                              styles.avatarText,
                              isSelected && styles.avatarTextSelected,
                            ]}
                          >
                            {initials}
                          </Text>
                        </View>
                        <View style={styles.patientInfo}>
                          <Text
                            style={[
                              styles.patientName,
                              isSelected && styles.patientNameSelected,
                            ]}
                          >
                            {patient.full_name}
                          </Text>
                          <Text style={styles.patientMeta}>
                            MRN: {patient.patient_number} ·{' '}
                            {relationshipLabel(patient.relationship)}
                          </Text>
                        </View>
                        {isSelected ? (
                          <View style={styles.checkBadge}>
                            <Text style={styles.checkText}>✓</Text>
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  singleContextBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  singleContextText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  selectorLeft: {
    flex: 1,
    marginRight: 8,
  },
  selectorLabel: {
    fontSize: 11,
    color: '#0369A1',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectorName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0C4A6E',
    marginTop: 1,
  },
  selectorRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tag: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  arrowIcon: {
    fontSize: 10,
    color: '#0369A1',
    marginLeft: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '600',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },
  patientList: {
    gap: 8,
  },
  patientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  patientItemSelected: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarSelected: {
    backgroundColor: '#0284C7',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  avatarTextSelected: {
    color: '#FFFFFF',
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  patientNameSelected: {
    color: '#0284C7',
    fontWeight: '700',
  },
  patientMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
