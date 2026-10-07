import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { friendlyError } from '../../api/errors';
import { useAuth } from '../AuthContext';
import { AppointmentsApi } from '../../appointments/appointments-api';
import type {
  AppointmentCreated,
  PortalAppointment,
  PublicDoctor,
  PublicDoctorSlots,
  RescheduleEligibility,
  SlotItem,
} from '../../appointments/contracts';
import {
  AppointmentDatePicker,
  formatAppointmentDate,
  formatToDateString,
  getSlotStatusLabel,
  isSlotSelectable,
} from './AppointmentDatePicker';
import { ErrorDiagnosticView } from './ErrorDiagnosticView';
import { colors, radius, shadows, spacing, typography } from '../theme';

interface RescheduleAppointmentModalProps {
  appointment: PortalAppointment | null;
  onClose: () => void;
  onRescheduled: (updatedAppointment?: AppointmentCreated) => void;
}

const minutesBetween = (start: string, end: string) => {
  const [startHour = 0, startMinute = 0] = start.split(':').map(Number);
  const [endHour = 0, endMinute = 0] = end.split(':').map(Number);
  return endHour * 60 + endMinute - (startHour * 60 + startMinute);
};

export function RescheduleAppointmentModal({
  appointment,
  onClose,
  onRescheduled,
}: RescheduleAppointmentModalProps) {
  const insets = useSafeAreaInsets();
  const { manager } = useAuth();
  const appointmentsApi = useMemo(() => new AppointmentsApi(manager), [manager]);

  const todayStr = useMemo(() => formatToDateString(new Date()), []);

  const [eligibility, setEligibility] = useState<RescheduleEligibility | null>(null);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);

  const [doctorId, setDoctorId] = useState<string>('');
  const [appointmentDate, setAppointmentDate] = useState<string>(todayStr);
  const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null);
  const [doctors, setDoctors] = useState<PublicDoctor[]>([]);
  const [slotData, setSlotData] = useState<PublicDoctorSlots | null>(null);

  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorObj, setErrorObj] = useState<unknown>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!appointment) {
      setEligibility(null);
      return;
    }

    let active = true;
    setIsCheckingEligibility(true);
    setErrorMessage(null);
    setErrorObj(null);
    setSelectedSlot(null);
    setDoctorId(appointment.doctor_id);
    setAppointmentDate(formatToDateString(new Date()));

    void appointmentsApi
      .checkRescheduleEligibility(appointment.id)
      .then((data) => {
        if (active) setEligibility(data);
      })
      .catch((err) => {
        if (active) {
          setErrorObj(err);
          setErrorMessage(friendlyError(err));
        }
      })
      .finally(() => {
        if (active) setIsCheckingEligibility(false);
      });

    // Load doctors in same branch/department if available
    void appointmentsApi
      .getDoctors(appointment.branch?.id, appointment.department_id)
      .then((data) => {
        if (active) setDoctors(data);
      })
      .catch(() => {
        if (active) setDoctors([]);
      });

    return () => {
      active = false;
    };
  }, [appointment, appointmentsApi]);

  // Load slots when doctor or date changes
  useEffect(() => {
    if (!appointment || !doctorId || !appointmentDate || !eligibility?.eligible) {
      setSlotData(null);
      return;
    }
    let active = true;
    setIsLoadingSlots(true);
    setSelectedSlot(null);
    void appointmentsApi
      .getDoctorSlots(doctorId, appointmentDate)
      .then((data) => {
        if (active) setSlotData(data);
      })
      .catch(() => {
        if (active) setSlotData(null);
      })
      .finally(() => {
        if (active) setIsLoadingSlots(false);
      });
    return () => {
      active = false;
    };
  }, [appointment, doctorId, appointmentDate, eligibility, appointmentsApi]);

  const handleSubmit = async () => {
    if (!appointment || isSubmitting) return;

    setErrorMessage(null);
    setErrorObj(null);

    if (!selectedSlot || !isSlotSelectable(selectedSlot, appointmentDate)) {
      setErrorMessage('Please select a valid, available appointment time slot.');
      return;
    }

    setIsSubmitting(true);
    try {
      const duration = minutesBetween(selectedSlot.start_time, selectedSlot.end_time);
      const result = await appointmentsApi.rescheduleAppointment(appointment.id, {
        doctor_id: doctorId,
        appointment_date: appointmentDate,
        start_time: selectedSlot.start_time,
        duration_minutes: duration > 0 ? duration : 15,
      });

      const selectedDoctor = doctors.find((d) => d.id === doctorId);

      onRescheduled({
        ...result,
        appointment_date: result.appointment_date || appointmentDate,
        start_time: result.start_time || selectedSlot.start_time,
        end_time: result.end_time || selectedSlot.end_time,
        duration_minutes: result.duration_minutes || (duration > 0 ? duration : 15),
        doctor_id: result.doctor_id || doctorId,
        doctor_name: result.doctor_name || selectedDoctor?.display_name || appointment.doctor_name,
        doctor_specialization:
          result.doctor_specialization ||
          selectedDoctor?.specialization ||
          appointment.doctor_specialization,
      });
      onClose();
    } catch (err) {
      setErrorObj(err);
      setErrorMessage(friendlyError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!appointment) return null;

  return (
    <Modal
      visible={Boolean(appointment)}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.backdropTouchable}
            activeOpacity={1}
            onPress={onClose}
            disabled={isSubmitting}
          />
          <View
            style={[
              styles.card,
              {
                paddingBottom: Math.max(insets.bottom, spacing.md),
              },
            ]}
          >
            <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>Reschedule Appointment</Text>
                <Text style={styles.subNumber}>#{appointment.appointment_number}</Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                disabled={isSubmitting}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close reschedule modal"
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
              {isCheckingEligibility ? (
                <View style={styles.centerLoading}>
                  <ActivityIndicator size="small" color="#0284C7" />
                  <Text style={styles.loadingText}>Checking reschedule eligibility…</Text>
                </View>
              ) : eligibility && !eligibility.eligible ? (
                <View style={styles.ineligibleBox}>
                  <Text style={styles.ineligibleTitle}>Rescheduling Not Available</Text>
                  <Text style={styles.ineligibleReason}>
                    {eligibility.reason ??
                      `Appointments must be rescheduled at least ${eligibility.minimum_notice_hours} hours in advance.`}
                  </Text>
                </View>
              ) : (
                <>
                  {errorObj || errorMessage ? (
                    <ErrorDiagnosticView
                      error={errorObj ?? errorMessage}
                      onDismiss={() => {
                        setErrorMessage(null);
                        setErrorObj(null);
                      }}
                    />
                  ) : null}

                  {/* Current info banner */}
                  <View style={styles.currentBox}>
                    <Text style={styles.currentLabel}>Current Scheduled Time:</Text>
                    <Text style={styles.currentValue}>
                      {formatAppointmentDate(appointment.appointment_date)} · {appointment.start_time}–{appointment.end_time}
                    </Text>
                    <Text style={styles.currentDoctor}>{appointment.doctor_name}</Text>
                  </View>

                  {/* Doctor selection (if alternate doctor allowed) */}
                  {doctors.length > 1 ? (
                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Doctor</Text>
                      <View style={styles.chipSelector}>
                        {doctors.map((doc) => (
                          <TouchableOpacity
                            key={doc.id}
                            style={[
                              styles.selectorChip,
                              doctorId === doc.id && styles.selectorChipActive,
                            ]}
                            onPress={() => setDoctorId(doc.id)}
                            disabled={isSubmitting}
                          >
                            <Text
                              style={[
                                styles.selectorChipText,
                                doctorId === doc.id && styles.selectorChipTextActive,
                              ]}
                            >
                              {doc.display_name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  {/* New Date via AppointmentDatePicker */}
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>New Appointment Date</Text>
                    <AppointmentDatePicker
                      value={appointmentDate}
                      onChange={(date) => setAppointmentDate(date)}
                      minDate={todayStr}
                      disabled={isSubmitting}
                    />
                  </View>

                  {/* New Slots */}
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Choose New Time Slot</Text>
                    {isLoadingSlots ? (
                      <ActivityIndicator size="small" color="#0284C7" style={styles.loadingSpinner} />
                    ) : slotData && slotData.slots.length > 0 ? (
                      <View style={styles.slotGrid}>
                        {slotData.slots.map((slot) => {
                          const status = getSlotStatusLabel(slot, appointmentDate);
                          const isSelected = selectedSlot?.start_time === slot.start_time;

                          return (
                            <TouchableOpacity
                              key={slot.start_time}
                              style={[
                                styles.slotBtn,
                                !status.isSelectable && styles.slotBtnUnavailable,
                                isSelected && styles.slotBtnSelected,
                              ]}
                              onPress={() => {
                                if (status.isSelectable) {
                                  setSelectedSlot(slot);
                                  setErrorMessage(null);
                                }
                              }}
                              disabled={!status.isSelectable || isSubmitting}
                              activeOpacity={0.7}
                            >
                              <Text
                                style={[
                                  styles.slotText,
                                  !status.isSelectable && styles.slotTextUnavailable,
                                  isSelected && styles.slotTextSelected,
                                ]}
                              >
                                {slot.start_time}
                              </Text>
                              <Text
                                style={[
                                  styles.slotSubText,
                                  !status.isSelectable && styles.slotSubTextUnavailable,
                                  isSelected && styles.slotSubTextSelected,
                                ]}
                              >
                                {status.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ) : (
                      <Text style={styles.emptyHint}>
                        {slotData?.unavailable_reason ?? 'No open slots on this date. Try another date.'}
                      </Text>
                    )}
                  </View>
                </>
              )}
            </ScrollView>

            {eligibility?.eligible ? (
              <View
                style={[
                  styles.footer,
                  { paddingBottom: Math.max(insets.bottom, spacing.xs) },
                ]}
              >
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onClose}
                  disabled={isSubmitting}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmBtn, isSubmitting && styles.confirmBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.confirmBtnText}>Confirm Reschedule</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  backdropTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  card: {
    backgroundColor: colors.neutral.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '90%',
    paddingTop: spacing.xl,
    ...shadows.modal,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerTitle: {
    ...typography.presets.sectionTitle,
    color: colors.text.primary,
  },
  subNumber: {
    ...typography.presets.code,
    fontSize: typography.size.xs,
    color: colors.text.muted,
    marginTop: 2,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  closeBtnText: {
    ...typography.presets.sectionTitle,
    color: colors.text.secondary,
  },
  scrollView: {
    width: '100%',
    flexShrink: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  centerLoading: {
    paddingVertical: spacing.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.sm + 2,
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  ineligibleBox: {
    backgroundColor: colors.status.dangerBg,
    borderWidth: 1,
    borderColor: colors.status.dangerBorder,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginVertical: spacing.lg,
  },
  ineligibleTitle: {
    ...typography.presets.bodyStrong,
    color: '#991B1B',
    marginBottom: spacing.xs,
  },
  ineligibleReason: {
    ...typography.presets.bodySmall,
    color: '#7F1D1D',
    lineHeight: typography.lineHeight.snug,
  },
  currentBox: {
    backgroundColor: colors.neutral.background,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.lg,
  },
  currentLabel: {
    fontSize: typography.size.micro,
    lineHeight: typography.lineHeight.micro,
    fontWeight: typography.weight.semibold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
  },
  currentValue: {
    ...typography.presets.bodyStrong,
    color: colors.text.primary,
    marginTop: 2,
  },
  currentDoctor: {
    ...typography.presets.bodySmallMedium,
    color: colors.brand.primary,
    marginTop: 2,
  },
  formGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.presets.bodySmallStrong,
    color: colors.text.secondary,
    marginBottom: spacing.xs + 2,
  },
  chipSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  selectorChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.neutral.background,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  selectorChipActive: {
    backgroundColor: colors.brand.primaryLight,
    borderColor: colors.brand.primary,
  },
  selectorChipText: {
    ...typography.presets.bodySmallMedium,
    color: colors.text.secondary,
  },
  selectorChipTextActive: {
    color: colors.brand.primary,
    fontWeight: typography.weight.bold,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  slotBtn: {
    width: '30%',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.neutral.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotBtnUnavailable: {
    backgroundColor: colors.neutral.surfaceSubtle,
    borderColor: colors.border.subtle,
    opacity: 0.6,
  },
  slotBtnSelected: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  slotText: {
    ...typography.presets.bodyStrong,
    color: colors.text.primary,
  },
  slotTextUnavailable: {
    color: colors.text.muted,
    textDecorationLine: 'line-through',
  },
  slotTextSelected: {
    color: colors.text.inverse,
  },
  slotSubText: {
    fontSize: typography.size.micro,
    color: colors.status.success,
    fontWeight: typography.weight.semibold,
    marginTop: 2,
  },
  slotSubTextSelected: {
    color: colors.brand.primaryLight,
  },
  slotSubTextUnavailable: {
    color: colors.text.muted,
  },
  emptyHint: {
    fontSize: typography.size.sm,
    color: colors.text.muted,
    fontStyle: 'italic',
    paddingVertical: spacing.sm,
  },
  loadingSpinner: {
    paddingVertical: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  cancelBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
    justifyContent: 'center',
  },
  cancelBtnText: {
    ...typography.presets.buttonSmall,
    color: colors.text.secondary,
  },
  confirmBtn: {
    backgroundColor: colors.brand.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.7,
  },
  confirmBtnText: {
    ...typography.presets.button,
    color: colors.text.inverse,
  },
});
