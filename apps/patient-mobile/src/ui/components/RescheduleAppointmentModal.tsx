import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { friendlyError } from '../../api/errors';
import { useAuth } from '../AuthContext';
import { AppointmentsApi } from '../../appointments/appointments-api';
import type {
  PortalAppointment,
  PublicDoctor,
  PublicDoctorSlots,
  RescheduleEligibility,
  SlotItem,
} from '../../appointments/contracts';
import { AppointmentDatePicker, formatToDateString } from './AppointmentDatePicker';
import { ErrorDiagnosticView } from './ErrorDiagnosticView';

interface RescheduleAppointmentModalProps {
  appointment: PortalAppointment | null;
  onClose: () => void;
  onRescheduled: () => void;
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

    if (!selectedSlot) {
      setErrorMessage('Please select a new available appointment time slot.');
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

      Alert.alert(
        'Appointment Rescheduled',
        `Your visit has been rescheduled to ${appointmentDate} at ${selectedSlot.start_time} (${result.appointment_number}).`,
        [
          {
            text: 'OK',
            onPress: () => {
              onRescheduled();
              onClose();
            },
          },
        ]
      );
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
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              <View style={styles.header}>
                <View>
                  <Text style={styles.headerTitle}>Reschedule Appointment</Text>
                  <Text style={styles.subNumber}>#{appointment.appointment_number}</Text>
                </View>
                <TouchableOpacity onPress={onClose} disabled={isSubmitting} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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
                        {appointment.appointment_date} · {appointment.start_time}–{appointment.end_time}
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
                            const isAvailable =
                              slot.available !== false && slot.is_available !== false;
                            const isSelected = selectedSlot?.start_time === slot.start_time;

                            return (
                              <TouchableOpacity
                                key={slot.start_time}
                                style={[
                                  styles.slotBtn,
                                  !isAvailable && styles.slotBtnUnavailable,
                                  isSelected && styles.slotBtnSelected,
                                ]}
                                onPress={() => {
                                  if (isAvailable) setSelectedSlot(slot);
                                }}
                                disabled={!isAvailable || isSubmitting}
                              >
                                <Text
                                  style={[
                                    styles.slotText,
                                    !isAvailable && styles.slotTextUnavailable,
                                    isSelected && styles.slotTextSelected,
                                  ]}
                                >
                                  {slot.start_time}
                                </Text>
                                <Text
                                  style={[
                                    styles.slotSubText,
                                    isSelected && styles.slotSubTextSelected,
                                  ]}
                                >
                                  {isAvailable ? 'Open' : 'Booked'}
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
                <View style={styles.footer}>
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
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  subNumber: {
    fontSize: 12,
    color: '#64748B',
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
    paddingBottom: 20,
  },
  centerLoading: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748B',
  },
  ineligibleBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
  },
  ineligibleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 4,
  },
  ineligibleReason: {
    fontSize: 13,
    color: '#7F1D1D',
    lineHeight: 18,
  },
  currentBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  currentLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  currentValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  currentDoctor: {
    fontSize: 13,
    color: '#0284C7',
    marginTop: 2,
    fontWeight: '500',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  chipSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectorChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  selectorChipActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0284C7',
  },
  selectorChipText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  selectorChipTextActive: {
    color: '#0284C7',
    fontWeight: '700',
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotBtn: {
    width: '30%',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotBtnUnavailable: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    opacity: 0.6,
  },
  slotBtnSelected: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  slotText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  slotTextUnavailable: {
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  slotTextSelected: {
    color: '#FFFFFF',
  },
  slotSubText: {
    fontSize: 10,
    color: '#16A34A',
    fontWeight: '600',
    marginTop: 2,
  },
  slotSubTextSelected: {
    color: '#E0F2FE',
  },
  emptyHint: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  loadingSpinner: {
    paddingVertical: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelBtnText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 14,
  },
  confirmBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 160,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.7,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
