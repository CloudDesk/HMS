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
import type { PortalAppointment } from '../../appointments/contracts';
import { formatAppointmentDate } from '../../appointments/date-utils';
import { StatusBadge, type StatusVariant } from './StatusBadge';
import { colors, radius, shadows, spacing, typography } from '../theme';

interface AppointmentDetailsModalProps {
  appointment: PortalAppointment | null;
  onClose: () => void;
  onReschedule?: (appointment: PortalAppointment) => void;
}

export function statusColor(status: PortalAppointment['status']): { bg: string; text: string } {
  switch (status) {
    case 'SCHEDULED':
      return { bg: colors.brand.primaryLight, text: colors.brand.primaryDark };
    case 'CONFIRMED':
      return { bg: colors.status.successBg, text: colors.status.success };
    case 'CHECKED_IN':
      return { bg: colors.status.warningBg, text: colors.status.warning };
    case 'COMPLETED':
      return { bg: colors.neutral.surfaceSubtle, text: colors.text.secondary };
    case 'CANCELLED':
      return { bg: colors.status.dangerBg, text: colors.status.danger };
    case 'RESCHEDULED':
      return { bg: '#F3E8FF', text: '#7E22CE' };
    case 'NO_SHOW':
    case 'SKIPPED':
      return { bg: colors.status.warningBg, text: colors.status.warning };
    default:
      return { bg: colors.neutral.surfaceSubtle, text: colors.text.secondary };
  }
}

const getStatusBadgeVariant = (status: PortalAppointment['status']): StatusVariant => {
  switch (status) {
    case 'CONFIRMED':
    case 'COMPLETED':
      return 'success';
    case 'SCHEDULED':
      return 'info';
    case 'CHECKED_IN':
    case 'SKIPPED':
    case 'RESCHEDULED':
      return 'warning';
    case 'CANCELLED':
    case 'NO_SHOW':
      return 'danger';
    default:
      return 'neutral';
  }
};

export function formatVisitType(type: string): string {
  switch (type) {
    case 'NEW_CONSULTATION':
      return 'New Consultation';
    case 'FOLLOW_UP':
      return 'Follow-up';
    case 'PROCEDURE':
      return 'Procedure';
    default:
      return type.replace(/_/g, ' ');
  }
}

export function AppointmentDetailsModal({
  appointment,
  onClose,
  onReschedule,
}: AppointmentDetailsModalProps) {
  if (!appointment) return null;

  const canReschedule = ['SCHEDULED', 'CONFIRMED', 'NO_SHOW', 'SKIPPED'].includes(
    appointment.status
  );

  return (
    <Modal
      visible={Boolean(appointment)}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              <View style={styles.header}>
                <View>
                  <Text style={styles.headerTitle}>Appointment Details</Text>
                  <Text style={styles.appointmentNumber}>
                    #{appointment.appointment_number}
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Status Badge */}
                <View style={styles.badgeRow}>
                  <StatusBadge
                    label={appointment.status.replace(/_/g, ' ')}
                    variant={getStatusBadgeVariant(appointment.status)}
                  />
                </View>

                {/* Doctor and Clinic Info */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Doctor & Speciality</Text>
                  <Text style={styles.doctorName}>{appointment.doctor_name}</Text>
                  <Text style={styles.specialization}>
                    {appointment.doctor_specialization || 'Consultant Specialist'}
                  </Text>
                </View>

                {/* Date & Time */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Schedule</Text>
                  <Text style={styles.scheduleText}>
                    📅 {formatAppointmentDate(appointment.appointment_date)}
                  </Text>
                  <Text style={styles.scheduleText}>
                    ⏰ {appointment.start_time} - {appointment.end_time}
                  </Text>
                </View>

                {/* Hospital Location */}
                {appointment.branch?.name ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Hospital Facility</Text>
                    <Text style={styles.locationText}>{appointment.branch.name}</Text>
                    {appointment.branch.address || appointment.branch.city ? (
                      <Text style={styles.addressText}>
                        {[appointment.branch.address, appointment.branch.city]
                          .filter(Boolean)
                          .join(', ')}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {/* Visit Type */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Visit Information</Text>
                  <Text style={styles.visitTypeText}>
                    Type: {formatVisitType(appointment.visit_type)}
                  </Text>
                  {appointment.reason ? (
                    <Text style={styles.reasonText}>
                      Reason: {appointment.reason}
                    </Text>
                  ) : null}
                </View>
              </ScrollView>

              {/* Action Buttons */}
              <View style={styles.footer}>
                {canReschedule && onReschedule ? (
                  <TouchableOpacity
                    style={styles.rescheduleBtn}
                    onPress={() => {
                      onClose();
                      onReschedule(appointment);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.rescheduleBtnText}>Reschedule Visit</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.dismissBtn} onPress={onClose} activeOpacity={0.8}>
                  <Text style={styles.dismissBtnText}>Close</Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.xl,
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: colors.border.default,
    ...shadows.modal,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerTitle: {
    ...typography.presets.sectionTitle,
    color: colors.text.primary,
  },
  appointmentNumber: {
    ...typography.presets.code,
    fontSize: typography.size.xs,
    color: colors.text.muted,
    marginTop: spacing.xxs,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.neutral.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    ...typography.presets.bodySmallStrong,
    color: colors.text.secondary,
  },
  scrollContent: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  badgeRow: {
    alignSelf: 'flex-start',
  },
  section: {
    backgroundColor: colors.neutral.surfaceSubtle,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  sectionLabel: {
    fontSize: typography.size.micro,
    lineHeight: typography.lineHeight.micro,
    fontWeight: typography.weight.bold,
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.widest,
    marginBottom: spacing.xs,
  },
  doctorName: {
    ...typography.presets.cardTitle,
    color: colors.text.primary,
  },
  specialization: {
    ...typography.presets.captionStrong,
    color: colors.brand.primaryDark,
    marginTop: spacing.xxs,
  },
  department: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  scheduleText: {
    ...typography.presets.bodySmallMedium,
    color: colors.text.primary,
    marginTop: spacing.xxs,
  },
  locationText: {
    ...typography.presets.bodySmallStrong,
    color: colors.text.primary,
  },
  addressText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  visitTypeText: {
    ...typography.presets.bodySmallMedium,
    color: colors.text.primary,
  },
  reasonText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    gap: spacing.sm,
  },
  rescheduleBtn: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  rescheduleBtnText: {
    ...typography.presets.buttonSmall,
    color: colors.text.inverse,
  },
  dismissBtn: {
    backgroundColor: colors.neutral.surfaceSubtle,
    borderRadius: radius.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  dismissBtnText: {
    ...typography.presets.buttonSmall,
    color: colors.text.secondary,
  },
});
