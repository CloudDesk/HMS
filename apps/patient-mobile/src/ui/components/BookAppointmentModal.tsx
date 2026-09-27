import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { friendlyError } from '../../api/errors';
import { useAuth } from '../AuthContext';
import { usePatient } from '../../portal/PatientContext';
import { AppointmentsApi } from '../../appointments/appointments-api';
import type {
  PublicBranch,
  PublicDepartment,
  PublicDoctor,
  PublicDoctorSlots,
  SlotItem,
} from '../../appointments/contracts';
import { AppointmentDatePicker, formatToDateString } from './AppointmentDatePicker';
import { ErrorDiagnosticView } from './ErrorDiagnosticView';

interface BookAppointmentModalProps {
  visible: boolean;
  onClose: () => void;
  onBooked: () => void;
}

const minutesBetween = (start: string, end: string) => {
  const [startHour = 0, startMinute = 0] = start.split(':').map(Number);
  const [endHour = 0, endMinute = 0] = end.split(':').map(Number);
  return endHour * 60 + endMinute - (startHour * 60 + startMinute);
};

export function BookAppointmentModal({
  visible,
  onClose,
  onBooked,
}: BookAppointmentModalProps) {
  const { manager } = useAuth();
  const { context, selectedPatient, selectedPatientId } = usePatient();
  const appointmentsApi = useMemo(() => new AppointmentsApi(manager), [manager]);

  const todayStr = useMemo(() => formatToDateString(new Date()), []);

  // Form selections
  const [patientId, setPatientId] = useState<string>(selectedPatientId ?? '');
  const [branchId, setBranchId] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [doctorId, setDoctorId] = useState<string>('');
  const [appointmentDate, setAppointmentDate] = useState<string>(todayStr);
  const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null);
  const [visitType, setVisitType] = useState<'NEW_CONSULTATION' | 'FOLLOW_UP' | 'PROCEDURE'>(
    'NEW_CONSULTATION'
  );
  const [reason, setReason] = useState<string>('');

  // Catalogue data
  const [branches, setBranches] = useState<PublicBranch[]>([]);
  const [departments, setDepartments] = useState<PublicDepartment[]>([]);
  const [doctors, setDoctors] = useState<PublicDoctor[]>([]);
  const [slotData, setSlotData] = useState<PublicDoctorSlots | null>(null);

  // Loading and error states
  const [isLoadingCatalogues, setIsLoadingCatalogues] = useState(false);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorObj, setErrorObj] = useState<unknown>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Find active patient context
  const currentPatient = useMemo(() => {
    return context?.patients.find((p) => p.id === patientId) ?? selectedPatient ?? null;
  }, [context, patientId, selectedPatient]);

  // Sync state on modal open or patient selection
  useEffect(() => {
    if (visible) {
      const activeId = selectedPatientId ?? context?.patients[0]?.id ?? '';
      setPatientId(activeId);
      setAppointmentDate(formatToDateString(new Date()));
      setSelectedSlot(null);
      setSlotData(null);
      setReason('');
      setErrorMessage(null);
      setErrorObj(null);
    }
  }, [visible, selectedPatientId, context]);

  // Load branches and enforce patient preferred branch
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setIsLoadingCatalogues(true);

    void appointmentsApi
      .getBranches()
      .then((data) => {
        if (!active) return;

        // If patient has preferred branch, restrict to it
        if (currentPatient?.preferred_branch?.id) {
          const preferredId = currentPatient.preferred_branch.id;
          const matched = data.filter((b) => b.id === preferredId);
          const eligible = matched.length > 0
            ? matched
            : [{
                id: preferredId,
                code: 'MAIN',
                name: currentPatient.preferred_branch.name,
                city: currentPatient.preferred_branch.city ?? null,
                address: currentPatient.preferred_branch.address ?? null,
              }];
          setBranches(eligible);
          setBranchId(preferredId);
        } else {
          setBranches(data);
          if (data.length > 0 && !branchId) {
            setBranchId(data[0]?.id ?? '');
          }
        }
      })
      .catch((err) => {
        if (active) {
          setErrorObj(err);
          setErrorMessage(friendlyError(err));
        }
      })
      .finally(() => {
        if (active) setIsLoadingCatalogues(false);
      });

    return () => {
      active = false;
    };
  }, [visible, currentPatient, appointmentsApi]);

  // When patient selection changes, reset all downstream fields
  const handlePatientChange = (newPatientId: string) => {
    setPatientId(newPatientId);
    setDepartmentId('');
    setDepartments([]);
    setDoctorId('');
    setDoctors([]);
    setSelectedSlot(null);
    setSlotData(null);
  };

  // When branch selection changes, reset downstream fields and load departments
  useEffect(() => {
    if (!visible || !branchId) {
      setDepartments([]);
      setDepartmentId('');
      return;
    }

    let active = true;
    setIsLoadingDepartments(true);
    setDepartmentId('');
    setDoctorId('');
    setDoctors([]);
    setSelectedSlot(null);
    setSlotData(null);

    void appointmentsApi
      .getDepartments(branchId)
      .then((data) => {
        if (active) {
          setDepartments(data);
          if (data.length > 0) {
            setDepartmentId(data[0]?.id ?? '');
          }
        }
      })
      .catch(() => {
        if (active) setDepartments([]);
      })
      .finally(() => {
        if (active) setIsLoadingDepartments(false);
      });

    return () => {
      active = false;
    };
  }, [visible, branchId, appointmentsApi]);

  // When department selection changes, reset doctors and load doctors
  useEffect(() => {
    if (!visible || !branchId || !departmentId) {
      setDoctors([]);
      setDoctorId('');
      return;
    }

    let active = true;
    setIsLoadingDoctors(true);
    setDoctorId('');
    setSelectedSlot(null);
    setSlotData(null);

    void appointmentsApi
      .getDoctors(branchId, departmentId)
      .then((data) => {
        if (active) {
          setDoctors(data);
          if (data.length > 0) {
            setDoctorId(data[0]?.id ?? '');
          }
        }
      })
      .catch(() => {
        if (active) setDoctors([]);
      })
      .finally(() => {
        if (active) setIsLoadingDoctors(false);
      });

    return () => {
      active = false;
    };
  }, [visible, branchId, departmentId, appointmentsApi]);

  // When doctor or appointment date changes, load slots
  useEffect(() => {
    if (!visible || !doctorId || !appointmentDate) {
      setSlotData(null);
      setSelectedSlot(null);
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
  }, [visible, doctorId, appointmentDate, appointmentsApi]);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    setErrorMessage(null);
    setErrorObj(null);

    if (!patientId) {
      setErrorMessage('Please select a patient.');
      return;
    }
    if (!branchId) {
      setErrorMessage('Please select a hospital branch.');
      return;
    }
    if (!doctorId) {
      setErrorMessage('Please select a doctor.');
      return;
    }
    if (!appointmentDate) {
      setErrorMessage('Please select an appointment date.');
      return;
    }
    if (!selectedSlot) {
      setErrorMessage('Please select an available appointment time slot.');
      return;
    }
    if (!reason.trim() || reason.trim().length < 3) {
      setErrorMessage('Please provide a reason for the visit (at least 3 characters).');
      return;
    }

    setIsSubmitting(true);
    try {
      const duration = minutesBetween(selectedSlot.start_time, selectedSlot.end_time);
      const result = await appointmentsApi.bookAppointment({
        patient_id: patientId,
        doctor_id: doctorId,
        appointment_date: appointmentDate,
        start_time: selectedSlot.start_time,
        duration_minutes: duration > 0 ? duration : 15,
        visit_type: visitType,
        reason: reason.trim(),
      });

      Alert.alert(
        'Appointment Confirmed',
        `Your appointment (${result.appointment_number}) has been scheduled successfully.`,
        [
          {
            text: 'View Appointments',
            onPress: () => {
              onBooked();
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Book an Appointment</Text>
                <TouchableOpacity onPress={onClose} disabled={isSubmitting} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                {errorObj || errorMessage ? (
                  <ErrorDiagnosticView
                    error={errorObj ?? errorMessage}
                    onDismiss={() => {
                      setErrorMessage(null);
                      setErrorObj(null);
                    }}
                  />
                ) : null}

                {/* 1. Patient Selector */}
                {context && context.patients.length > 1 ? (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Patient</Text>
                    <View style={styles.chipSelector}>
                      {context.patients.map((p) => (
                        <TouchableOpacity
                          key={p.id}
                          style={[
                            styles.selectorChip,
                            patientId === p.id && styles.selectorChipActive,
                          ]}
                          onPress={() => handlePatientChange(p.id)}
                          disabled={isSubmitting}
                        >
                          <Text
                            style={[
                              styles.selectorChipText,
                              patientId === p.id && styles.selectorChipTextActive,
                            ]}
                          >
                            {p.full_name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : null}

                {/* 2. Hospital Branch (Respects Patient Context) */}
                <View style={styles.formGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Hospital Branch</Text>
                    {currentPatient?.preferred_branch?.name ? (
                      <Text style={styles.preferredBadge}>Eligible Branch</Text>
                    ) : null}
                  </View>
                  {isLoadingCatalogues ? (
                    <ActivityIndicator size="small" color="#0284C7" style={styles.loadingSpinner} />
                  ) : (
                    <View style={styles.chipSelector}>
                      {branches.map((b) => (
                        <TouchableOpacity
                          key={b.id}
                          style={[
                            styles.selectorChip,
                            branchId === b.id && styles.selectorChipActive,
                            branches.length === 1 && styles.singleBranchChip,
                          ]}
                          onPress={() => {
                            if (branchId !== b.id) {
                              setBranchId(b.id);
                            }
                          }}
                          disabled={isSubmitting || branches.length === 1}
                        >
                          <Text
                            style={[
                              styles.selectorChipText,
                              branchId === b.id && styles.selectorChipTextActive,
                            ]}
                          >
                            {b.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* 3. Department */}
                {isLoadingDepartments ? (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Department</Text>
                    <ActivityIndicator size="small" color="#0284C7" style={styles.loadingSpinner} />
                  </View>
                ) : departments.length > 0 ? (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Department</Text>
                    <View style={styles.chipSelector}>
                      {departments.map((d) => (
                        <TouchableOpacity
                          key={d.id}
                          style={[
                            styles.selectorChip,
                            departmentId === d.id && styles.selectorChipActive,
                          ]}
                          onPress={() => {
                            if (departmentId !== d.id) {
                              setDepartmentId(d.id);
                            }
                          }}
                          disabled={isSubmitting}
                        >
                          <Text
                            style={[
                              styles.selectorChipText,
                              departmentId === d.id && styles.selectorChipTextActive,
                            ]}
                          >
                            {d.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : null}

                {/* 4. Doctor */}
                {isLoadingDoctors ? (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Doctor</Text>
                    <ActivityIndicator size="small" color="#0284C7" style={styles.loadingSpinner} />
                  </View>
                ) : doctors.length > 0 ? (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Doctor</Text>
                    <View style={styles.chipSelector}>
                      {doctors.map((doc) => (
                        <TouchableOpacity
                          key={doc.id}
                          style={[
                            styles.doctorChip,
                            doctorId === doc.id && styles.doctorChipActive,
                          ]}
                          onPress={() => {
                            if (doctorId !== doc.id) {
                              setDoctorId(doc.id);
                            }
                          }}
                          disabled={isSubmitting}
                        >
                          <Text
                            style={[
                              styles.doctorChipName,
                              doctorId === doc.id && styles.doctorChipNameActive,
                            ]}
                          >
                            {doc.display_name}
                          </Text>
                          <Text style={styles.doctorChipSpec}>{doc.specialization}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : (
                  <Text style={styles.emptyHint}>No doctors found for this department.</Text>
                )}

                {/* 5. Date Selection via AppointmentDatePicker */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Appointment Date</Text>
                  <AppointmentDatePicker
                    value={appointmentDate}
                    onChange={(date) => setAppointmentDate(date)}
                    minDate={todayStr}
                    disabled={isSubmitting}
                  />
                </View>

                {/* 6. Live Slots */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Available Times</Text>
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

                {/* 7. Visit Type */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Visit Type</Text>
                  <View style={styles.chipSelector}>
                    {(
                      [
                        { id: 'NEW_CONSULTATION', label: 'New Consultation' },
                        { id: 'FOLLOW_UP', label: 'Follow Up' },
                        { id: 'PROCEDURE', label: 'Procedure' },
                      ] as const
                    ).map((t) => (
                      <TouchableOpacity
                        key={t.id}
                        style={[
                          styles.selectorChip,
                          visitType === t.id && styles.selectorChipActive,
                        ]}
                        onPress={() => setVisitType(t.id)}
                        disabled={isSubmitting}
                      >
                        <Text
                          style={[
                            styles.selectorChipText,
                            visitType === t.id && styles.selectorChipTextActive,
                          ]}
                        >
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* 8. Reason */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Reason for Visit (Required)</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={reason}
                    onChangeText={setReason}
                    placeholder="Describe your symptoms or consultation reason (min 3 chars)…"
                    placeholderTextColor="#94A3B8"
                    multiline
                    numberOfLines={3}
                    maxLength={500}
                    editable={!isSubmitting}
                  />
                  <Text style={styles.charCount}>{reason.length}/500</Text>
                </View>
              </ScrollView>

              {/* Submit / Cancel Actions */}
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
                    <Text style={styles.confirmBtnText}>Confirm Booking</Text>
                  )}
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
    alignItems: 'center',
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
  formGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  preferredBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0284C7',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
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
  singleBranchChip: {
    backgroundColor: '#F0F9FF',
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
  doctorChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  doctorChipActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0284C7',
  },
  doctorChipName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  doctorChipNameActive: {
    color: '#0284C7',
  },
  doctorChipSpec: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'right',
    marginTop: 4,
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
    minWidth: 140,
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
