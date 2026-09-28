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
import { colors, radius, shadows, spacing, typography } from '../theme';

export function PatientContextSelector() {
  const { context, selectedPatient, switchPatient } = usePatient();
  const [modalOpen, setModalOpen] = useState(false);

  if (!context || context.patients.length <= 1) {
    if (!selectedPatient) return null;
    return (
      <View style={styles.singleContextBadge}>
        <View style={styles.badgeDot} />
        <Text style={styles.singleContextText}>
          {selectedPatient.full_name} ({relationshipLabel(selectedPatient.relationship)})
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
        activeOpacity={0.75}
      >
        <View style={styles.selectorLeft}>
          <Text style={styles.selectorLabel}>ACTIVE PROFILE</Text>
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
          <Text style={styles.arrowIcon}>▾</Text>
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
                  <View>
                    <Text style={styles.modalTitle}>Switch Profile</Text>
                    <Text style={styles.modalSubtitle}>
                      Select a family member to view their records
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setModalOpen(false)}
                    style={styles.closeButton}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>

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
                        <View
                          style={[
                            styles.avatar,
                            isSelected && styles.avatarSelected,
                          ]}
                        >
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
                          <Text style={styles.patientRel}>
                            {relationshipLabel(patient.relationship)} • MRN: {patient.patient_number}
                          </Text>
                        </View>
                        {isSelected ? (
                          <View style={styles.checkCircle}>
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brand.primarySubtle,
    borderWidth: 1,
    borderColor: colors.brand.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.lg,
    alignSelf: 'flex-start',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand.primary,
    marginRight: spacing.sm,
  },
  singleContextText: {
    fontSize: typography.size.xs + 1,
    color: colors.brand.primaryDark,
    fontWeight: typography.weight.semibold,
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.xl,
    ...shadows.subtle,
  },
  selectorLeft: {
    flex: 1,
  },
  selectorLabel: {
    fontSize: 10,
    color: colors.text.muted,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.5,
    marginBottom: spacing.xxs,
  },
  selectorName: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
  },
  selectorRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tag: {
    backgroundColor: colors.neutral.surfaceSubtle,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  tagText: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
  },
  arrowIcon: {
    fontSize: 14,
    color: colors.text.muted,
    fontWeight: typography.weight.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.xl,
    width: '100%',
    maxWidth: 380,
    padding: spacing.xl,
    ...shadows.modal,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
  },
  modalSubtitle: {
    fontSize: typography.size.xs + 1,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
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
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    fontWeight: typography.weight.bold,
  },
  patientList: {
    gap: spacing.sm,
  },
  patientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.neutral.surface,
  },
  patientItemSelected: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.primarySubtle,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.neutral.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarSelected: {
    backgroundColor: colors.brand.primary,
  },
  avatarText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.text.secondary,
  },
  avatarTextSelected: {
    color: colors.text.inverse,
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: typography.size.sm + 1,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
  patientNameSelected: {
    color: colors.brand.primaryDark,
    fontWeight: typography.weight.bold,
  },
  patientRel: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    marginTop: spacing.xxs,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: colors.text.inverse,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },
});
