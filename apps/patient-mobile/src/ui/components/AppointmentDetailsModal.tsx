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

interface AppointmentDetailsModalProps {
  appointment: PortalAppointment | null;
  onClose: () => void;
  onReschedule?: (appointment: PortalAppointment) => void;
}

export function statusColor(status: PortalAppointment['status']): { bg: string; text: string } {
  switch (status) {
    case 'SCHEDULED':
      return { bg: '#E0F2FE', text: '#0369A1' };
    case 'CONFIRMED':
      return { bg: '#DCFCE7', text: '#15803D' };
    case 'CHECKED_IN':
      return { bg: '#FEF3C7', text: '#B45309' };
    case 'COMPLETED':
      return { bg: '#F1F5F9', text: '#475569' };
    case 'CANCELLED':
      return { bg: '#FEE2E2', text: '#B91C1C' };
    case 'RESCHEDULED':
      return { bg: '#F3E8FF', text: '#7E22CE' };
    case 'NO_SHOW':
    case 'SKIPPED':
      return { bg: '#FFEDD5', text: '#C2410C' };
    default:
      return { bg: '#F1F5F9', text: '#475569' };
  }
}

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

  const colors = statusColor(appointment.status);
  const canReschedule = ['SCHEDULED', 'CONFIRMED', 'NO_SHOW', 'SKIPPED'].includes(
    appointment.status
  );

  return (
    <Modal
      visible={Boolean(appointment)}
      transparent
      animationType="slide"
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
                    {appointment.appointment_number}
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Status Badge */}
                <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.statusText, { color: colors.text }]}>
                    {appointment.status.replace(/_/g, ' ')}
                  </Text>
                </View>

                {/* Doctor and Clinic Info */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Doctor & Speciality</Text>
                  <Text style={styles.doctorName}>{appointment.doctor_name}</Text>
                  <Text style={styles.specialization}>
                    {appointment.doctor_specialization}
                  </Text>
                </View>

                {/* Schedule Info */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Date & Time</Text>
                  <View style={styles.row}>
                    <Text style={styles.infoIcon}>📅</Text>
                    <Text style={styles.infoValue}>{appointment.appointment_date}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.infoIcon}>⏰</Text>
                    <Text style={styles.infoValue}>
                      {appointment.start_time} – {appointment.end_time} (
                      {appointment.duration_minutes} mins)
                    </Text>
                  </View>
                </View>

                {/* Location */}
                {appointment.branch ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Hospital Location</Text>
                    <View style={styles.row}>
                      <Text style={styles.infoIcon}>📍</Text>
                      <Text style={styles.infoValue}>
                        {appointment.branch.name}
                        {appointment.branch.city ? ` · ${appointment.branch.city}` : ''}
                      </Text>
                    </View>
                    {appointment.branch.address ? (
                      <Text style={styles.subAddress}>
                        {appointment.branch.address}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {/* Visit Type & Reason */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Visit Purpose</Text>
                  <View style={styles.row}>
                    <Text style={styles.infoIcon}>🩺</Text>
                    <Text style={styles.infoValue}>
                      {formatVisitType(appointment.visit_type)}
                    </Text>
                  </View>
                  {appointment.reason ? (
                    <Text style={styles.reasonBox}>{appointment.reason}</Text>
                  ) : null}
                </View>
              </ScrollView>

              {/* Actions Footer */}
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

                <TouchableOpacity
                  style={styles.doneBtn}
                  onPress={onClose}
                  activeOpacity={0.8}
                >
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
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  appointmentNumber: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
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
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  specialization: {
    fontSize: 13,
    color: '#0284C7',
    marginTop: 2,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  infoIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  infoValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  subAddress: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 22,
    marginTop: 2,
  },
  reasonBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
  },
  rescheduleBtn: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  rescheduleBtnText: {
    color: '#0284C7',
    fontSize: 14,
    fontWeight: '700',
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
