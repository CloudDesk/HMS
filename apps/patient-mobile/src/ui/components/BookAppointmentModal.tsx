import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { friendlyError } from '../../api/errors';
import { useAuth } from '../AuthContext';
import { usePatient } from '../../portal/PatientContext';
import { AppointmentsApi } from '../../appointments/appointments-api';
import {
  emptyClinicalHistory,
  type PublicBranch,
  type PublicDepartment,
  type PublicDoctor,
  type PublicDoctorSlots,
  type SlotItem,
  type ClinicalHistoryFormState,
} from '../../appointments/contracts';
import {
  AppointmentDatePicker,
  formatToDateString,
  getSlotStatusLabel,
  isSlotSelectable,
} from './AppointmentDatePicker';
import { ErrorDiagnosticView } from './ErrorDiagnosticView';
import { colors, radius, shadows, spacing, typography } from '../theme';

export type { ClinicalHistoryFormState };
export { emptyClinicalHistory };

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
  const insets = useSafeAreaInsets();
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
  const [reason, setReason] = useState<string>('');

  // Dropdown Picker Modals
  const [isDoctorPickerOpen, setIsDoctorPickerOpen] = useState<boolean>(false);

  // Optional Clinical History State
  const [isClinicalHistoryExpanded, setIsClinicalHistoryExpanded] = useState<boolean>(false);
  const [clinicalHistory, setClinicalHistory] =
    useState<ClinicalHistoryFormState>(emptyClinicalHistory);

  // Keyboard awareness & Auto-scrolling refs
  const scrollViewRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates?.height ?? 280);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleFieldFocus = useCallback(
    (
      field:
        | 'reason'
        | 'chiefComplaint'
        | 'historyPresentIllness'
        | 'pastMedicalHistory'
        | 'familyHistory'
        | 'allergies'
    ) => {
      setTimeout(() => {
        if (!scrollViewRef.current) return;
        if (field === 'allergies' || field === 'familyHistory') {
          scrollViewRef.current.scrollToEnd({ animated: true });
        } else if (field === 'pastMedicalHistory' || field === 'historyPresentIllness') {
          scrollViewRef.current.scrollTo({ y: 780, animated: true });
        } else if (field === 'chiefComplaint') {
          scrollViewRef.current.scrollTo({ y: 640, animated: true });
        } else if (field === 'reason') {
          scrollViewRef.current.scrollTo({ y: 480, animated: true });
        }
      }, 120);
    },
    []
  );

  const handleToggleClinicalHistory = useCallback(() => {
    setIsClinicalHistoryExpanded((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ y: 600, animated: true });
        }, 100);
      }
      return next;
    });
  }, []);

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
  const [reasonError, setReasonError] = useState<string | null>(null);

  // Find active patient context
  const currentPatient = useMemo(() => {
    return context?.patients.find((p) => p.id === patientId) ?? selectedPatient ?? null;
  }, [context, patientId, selectedPatient]);

  const selectedDepartment = useMemo(() => {
    return departments.find((d) => d.id === departmentId) ?? null;
  }, [departments, departmentId]);

  const selectedDoctor = useMemo(() => {
    return doctors.find((d) => d.id === doctorId) ?? null;
  }, [doctors, doctorId]);

  const handleClose = () => {
    setIsDoctorPickerOpen(false);
    setIsClinicalHistoryExpanded(false);
    setClinicalHistory(emptyClinicalHistory);
    setErrorMessage(null);
    setErrorObj(null);
    setReasonError(null);
    onClose();
  };

  // Sync state on modal open or patient selection
  useEffect(() => {
    if (visible) {
      const activeId = selectedPatientId ?? context?.patients[0]?.id ?? '';
      setPatientId(activeId);
      setDepartmentId('');
      setDoctorId('');
      setDoctors([]);
      setAppointmentDate(formatToDateString(new Date()));
      setSelectedSlot(null);
      setSlotData(null);
      setReason('');
      setIsDoctorPickerOpen(false);
      setIsClinicalHistoryExpanded(false);
      setClinicalHistory(emptyClinicalHistory);
      setErrorMessage(null);
      setErrorObj(null);
      setReasonError(null);
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
    setIsClinicalHistoryExpanded(false);
    setClinicalHistory(emptyClinicalHistory);
  };

  // When branch changes, reset downstream fields
  const handleBranchChange = (newBranchId: string) => {
    if (branchId === newBranchId) return;
    setBranchId(newBranchId);
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
      setDoctorId('');
      setDoctors([]);
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
          const dentalDepts = data.filter(
            (d) =>
              d.name.trim().toLowerCase() === 'dental' ||
              d.code.trim().toUpperCase() === 'DENT' ||
              d.code.trim().toUpperCase() === 'DENTAL'
          );
          const eligible = dentalDepts.length > 0 ? dentalDepts : data;
          setDepartments(eligible);
          const first = eligible[0];
          if (first) {
            setDepartmentId(first.id);
          }
        }
      })
      .catch((err) => {
        if (active) {
          setDepartments([]);
          setErrorObj(err);
          setErrorMessage(friendlyError(err));
        }
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
      setSelectedSlot(null);
      setSlotData(null);
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
        }
      })
      .catch((err) => {
        if (active) {
          setDoctors([]);
          setErrorObj(err);
          setErrorMessage(friendlyError(err));
        }
      })
      .finally(() => {
        if (active) setIsLoadingDoctors(false);
      });

    return () => {
      active = false;
    };
  }, [visible, branchId, departmentId, appointmentsApi]);

  const handleDoctorSelect = (newDocId: string) => {
    setIsDoctorPickerOpen(false);
    if (doctorId === newDocId) return;
    setDoctorId(newDocId);
    setSelectedSlot(null);
    setSlotData(null);
    setErrorMessage(null);
  };

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
    if (!departmentId) {
      setErrorMessage('Please select a department.');
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
    if (!selectedSlot || !isSlotSelectable(selectedSlot, appointmentDate)) {
      setErrorMessage('Please select a valid, available appointment time slot.');
      return;
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setReasonError('Reason for visit is required.');
      return;
    }
    if (trimmedReason.length < 3) {
      setReasonError('Reason for visit must be at least 3 characters.');
      return;
    }
    setReasonError(null);
    setErrorMessage(null);
    setErrorObj(null);

    const effectiveReason = trimmedReason;

    setIsSubmitting(true);
    try {
      const duration = minutesBetween(selectedSlot.start_time, selectedSlot.end_time);

      const hasClinicalData = Boolean(
        clinicalHistory.chiefComplaint.trim() ||
        clinicalHistory.historyPresentIllness.trim() ||
        clinicalHistory.pastMedicalHistory.trim() ||
        clinicalHistory.familyHistory.trim() ||
        clinicalHistory.allergies.trim()
      );

      const clinicalHistoryPayload = hasClinicalData
        ? {
            chief_complaint: clinicalHistory.chiefComplaint.trim() || undefined,
            history_present_illness: clinicalHistory.historyPresentIllness.trim() || undefined,
            past_medical_history: clinicalHistory.pastMedicalHistory.trim() || undefined,
            family_history: clinicalHistory.familyHistory.trim() || undefined,
            allergies: clinicalHistory.allergies.trim() || undefined,
          }
        : undefined;

      const result = await appointmentsApi.bookAppointment({
        patient_id: patientId,
        doctor_id: doctorId,
        appointment_date: appointmentDate,
        start_time: selectedSlot.start_time,
        duration_minutes: duration > 0 ? duration : 15,
        visit_type: 'NEW_CONSULTATION',
        reason: effectiveReason,
        clinical_history: clinicalHistoryPayload,
      });

      Alert.alert(
        'Appointment Confirmed',
        `Your appointment (${result.appointment_number}) has been scheduled successfully.`,
        [
          {
            text: 'View Appointments',
            onPress: () => {
              onBooked();
              handleClose();
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
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={handleClose}
      >
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.overlay}>
            <TouchableOpacity
              style={styles.backdropTouchable}
              activeOpacity={1}
              onPress={handleClose}
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
                <Text style={styles.headerTitle}>Book an Appointment</Text>
                <TouchableOpacity
                  onPress={handleClose}
                  disabled={isSubmitting}
                  style={styles.closeBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Close appointment booking"
                >
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                ref={scrollViewRef}
                style={styles.scrollView}
                contentContainerStyle={[
                  styles.scrollContent,
                  keyboardHeight > 0 && { paddingBottom: keyboardHeight + spacing.xxl },
                ]}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
              >
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
                  <ActivityIndicator size="small" color={colors.brand.primary} style={styles.loadingSpinner} />
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
                        onPress={() => handleBranchChange(b.id)}
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

              {/* 3 & 4. Compact Cascading Department & Doctor Row (Dental Locked) */}
              <View style={styles.formGroup}>
                <View style={styles.cascadingRow}>
                  {/* Department Column (Fixed Dental Only) */}
                  <View style={styles.cascadingColLeft}>
                    <Text style={styles.label}>Department</Text>
                    <View style={styles.selectTriggerLocked}>
                      {isLoadingDepartments ? (
                        <View style={styles.selectTriggerLoading}>
                          <ActivityIndicator size="small" color={colors.brand.primary} />
                          <Text style={styles.selectPlaceholderText} numberOfLines={1}>
                            Loading…
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.lockedDeptBadge}>
                          <Text style={styles.dentalIcon}>🦷</Text>
                          <Text style={styles.lockedDeptText} numberOfLines={1}>
                            {selectedDepartment?.name ?? 'Dental'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Doctor Column */}
                  <View style={styles.cascadingColRight}>
                    <Text style={styles.label}>Doctor</Text>
                    <TouchableOpacity
                      style={[
                        styles.selectTrigger,
                        (!departmentId ||
                          isLoadingDoctors ||
                          isSubmitting ||
                          doctors.length === 0) &&
                          styles.selectTriggerDisabled,
                      ]}
                      onPress={() => setIsDoctorPickerOpen(true)}
                      disabled={
                        !departmentId ||
                        isLoadingDoctors ||
                        isSubmitting ||
                        doctors.length === 0
                      }
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Doctor: ${
                        selectedDoctor
                          ? selectedDoctor.display_name
                          : !departmentId
                          ? 'Loading…'
                          : doctors.length === 0
                          ? 'No doctors available'
                          : 'Select Doctor'
                      }`}
                    >
                      {isLoadingDoctors ? (
                        <View style={styles.selectTriggerLoading}>
                          <ActivityIndicator size="small" color={colors.brand.primary} />
                          <Text style={styles.selectPlaceholderText} numberOfLines={1}>
                            Loading…
                          </Text>
                        </View>
                      ) : (
                        <>
                          <Text
                            style={[
                              styles.selectValueText,
                              !selectedDoctor && styles.selectPlaceholderText,
                            ]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {selectedDoctor
                              ? selectedDoctor.display_name
                              : !departmentId
                              ? 'Loading…'
                              : doctors.length === 0
                              ? 'No doctors available'
                              : 'Select Doctor'}
                          </Text>
                          <Text style={styles.selectArrow}>▾</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

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
                  <ActivityIndicator size="small" color={colors.brand.primary} style={styles.loadingSpinner} />
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

              {/* 7. Reason for Visit */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Reason for Visit <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.textArea,
                    reasonError ? styles.inputError : undefined,
                  ]}
                  value={reason}
                  onChangeText={(text) => {
                    setReason(text);
                    if (reasonError) {
                      if (text.trim().length >= 3) {
                        setReasonError(null);
                      } else if (text.trim().length === 0) {
                        setReasonError('Reason for visit is required.');
                      } else {
                        setReasonError('Reason for visit must be at least 3 characters.');
                      }
                    }
                  }}
                  onFocus={() => handleFieldFocus('reason')}
                  placeholder="Describe your symptoms or consultation reason (min 3 chars)…"
                  placeholderTextColor={colors.text.muted}
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                  editable={!isSubmitting}
                />
                {reasonError ? (
                  <Text style={styles.inlineErrorText}>{reasonError}</Text>
                ) : null}
                <Text style={styles.charCount}>{reason.length}/500</Text>
              </View>

              {/* 8. Optional Clinical History */}
              <View style={styles.clinicalHistoryCard}>
                <View style={styles.clinicalHistoryHeader}>
                  <View style={styles.clinicalHistoryTitleRow}>
                    <Text style={styles.clinicalHistoryTitle}>Clinical History</Text>
                    <View style={styles.optionalBadge}>
                      <Text style={styles.optionalBadgeText}>Optional</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={handleToggleClinicalHistory}
                    style={styles.toggleBtn}
                    disabled={isSubmitting}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isClinicalHistoryExpanded
                        ? 'Collapse clinical history'
                        : 'Expand clinical history'
                    }
                  >
                    <Text style={styles.toggleBtnText}>
                      {isClinicalHistoryExpanded ? 'Hide ▲' : '+ Add Details ▼'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.clinicalHistorySubtitle}>
                  Provide additional health context for your doctor ahead of your visit.
                </Text>

                {isClinicalHistoryExpanded && (
                  <View style={styles.clinicalFieldsContainer}>
                    {/* 1. Chief Complaint */}
                    <View style={styles.clinicalFieldGroup}>
                      <Text style={styles.clinicalFieldLabel}>Chief Complaint</Text>
                      <TextInput
                        style={[styles.input, styles.clinicalTextArea]}
                        value={clinicalHistory.chiefComplaint}
                        onChangeText={(text) =>
                          setClinicalHistory((prev) => ({ ...prev, chiefComplaint: text }))
                        }
                        onFocus={() => handleFieldFocus('chiefComplaint')}
                        placeholder="What is the main reason for your visit?"
                        placeholderTextColor={colors.text.muted}
                        multiline
                        numberOfLines={2}
                        maxLength={500}
                        editable={!isSubmitting}
                      />
                      <Text style={styles.charCount}>
                        {clinicalHistory.chiefComplaint.length}/500
                      </Text>
                    </View>

                    {/* 2. History of Present Illness */}
                    <View style={styles.clinicalFieldGroup}>
                      <Text style={styles.clinicalFieldLabel}>History of Present Illness</Text>
                      <TextInput
                        style={[styles.input, styles.clinicalTextArea]}
                        value={clinicalHistory.historyPresentIllness}
                        onChangeText={(text) =>
                          setClinicalHistory((prev) => ({ ...prev, historyPresentIllness: text }))
                        }
                        onFocus={() => handleFieldFocus('historyPresentIllness')}
                        placeholder="Tell us about your current symptoms or concern."
                        placeholderTextColor={colors.text.muted}
                        multiline
                        numberOfLines={2}
                        maxLength={500}
                        editable={!isSubmitting}
                      />
                      <Text style={styles.charCount}>
                        {clinicalHistory.historyPresentIllness.length}/500
                      </Text>
                    </View>

                    {/* 3. Past Medical History */}
                    <View style={styles.clinicalFieldGroup}>
                      <Text style={styles.clinicalFieldLabel}>Past Medical History</Text>
                      <TextInput
                        style={[styles.input, styles.clinicalTextArea]}
                        value={clinicalHistory.pastMedicalHistory}
                        onChangeText={(text) =>
                          setClinicalHistory((prev) => ({ ...prev, pastMedicalHistory: text }))
                        }
                        onFocus={() => handleFieldFocus('pastMedicalHistory')}
                        placeholder="Previous illnesses, conditions, surgeries, or treatments."
                        placeholderTextColor={colors.text.muted}
                        multiline
                        numberOfLines={2}
                        maxLength={500}
                        editable={!isSubmitting}
                      />
                      <Text style={styles.charCount}>
                        {clinicalHistory.pastMedicalHistory.length}/500
                      </Text>
                    </View>

                    {/* 4. Family History */}
                    <View style={styles.clinicalFieldGroup}>
                      <Text style={styles.clinicalFieldLabel}>Family History</Text>
                      <TextInput
                        style={[styles.input, styles.clinicalTextArea]}
                        value={clinicalHistory.familyHistory}
                        onChangeText={(text) =>
                          setClinicalHistory((prev) => ({ ...prev, familyHistory: text }))
                        }
                        onFocus={() => handleFieldFocus('familyHistory')}
                        placeholder="Relevant medical conditions in your family."
                        placeholderTextColor={colors.text.muted}
                        multiline
                        numberOfLines={2}
                        maxLength={500}
                        editable={!isSubmitting}
                      />
                      <Text style={styles.charCount}>
                        {clinicalHistory.familyHistory.length}/500
                      </Text>
                    </View>

                    {/* 5. Allergies / Sensitivities */}
                    <View style={styles.clinicalFieldGroup}>
                      <Text style={styles.clinicalFieldLabel}>Allergies / Sensitivities</Text>
                      <TextInput
                        style={[styles.input, styles.clinicalTextArea]}
                        value={clinicalHistory.allergies}
                        onChangeText={(text) =>
                          setClinicalHistory((prev) => ({
                            ...prev,
                            allergies: text,
                          }))
                        }
                        onFocus={() => handleFieldFocus('allergies')}
                        placeholder="Medicines, food, or other known allergies or sensitivities."
                        placeholderTextColor={colors.text.muted}
                        multiline
                        numberOfLines={2}
                        maxLength={500}
                        editable={!isSubmitting}
                      />
                      <Text style={styles.charCount}>
                        {clinicalHistory.allergies.length}/500
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Submit / Cancel Actions */}
            <View
              style={[
                styles.footer,
                { paddingBottom: Math.max(insets.bottom, spacing.xs) },
              ]}
            >
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={handleClose}
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
                  <ActivityIndicator color={colors.text.inverse} size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirm Booking</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    {/* Doctor Selection Modal */}
    <Modal
      visible={isDoctorPickerOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setIsDoctorPickerOpen(false)}
    >
      <View style={styles.pickerOverlay}>
        <TouchableOpacity
          style={styles.pickerBackdropTouchable}
          activeOpacity={1}
          onPress={() => setIsDoctorPickerOpen(false)}
        />
        <View style={styles.pickerCard}>
          <View style={styles.pickerHeader}>
            <View style={styles.pickerHeaderLeft}>
              <Text style={styles.pickerTitle}>Select Doctor</Text>
              <Text style={styles.pickerSubtitle}>
                {selectedDepartment
                  ? `${selectedDepartment.name} Specialists`
                  : 'Available Doctors'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsDoctorPickerOpen(false)}
              style={styles.pickerCloseBtn}
              activeOpacity={0.7}
              accessibilityLabel="Close doctor selector"
            >
              <Text style={styles.pickerCloseBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.pickerListScroll}
            contentContainerStyle={styles.pickerListContent}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
          >
            {doctors.length === 0 ? (
              <Text style={styles.pickerEmptyText}>No doctors available in this department.</Text>
            ) : (
              doctors.map((doc) => {
                const isSelected = doc.id === doctorId;
                return (
                  <TouchableOpacity
                    key={doc.id}
                    style={[
                      styles.pickerItem,
                      isSelected && styles.pickerItemSelected,
                    ]}
                    onPress={() => handleDoctorSelect(doc.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.pickerItemInfo}>
                      <Text
                        style={[
                          styles.pickerItemTitle,
                          isSelected && styles.pickerItemTitleSelected,
                        ]}
                      >
                        {doc.display_name}
                      </Text>
                      <Text style={styles.pickerItemSubtitle}>
                        {doc.specialization}
                        {doc.qualification ? ` • ${doc.qualification}` : ''}
                        {doc.experience_years ? ` • ${doc.experience_years} yrs exp` : ''}
                      </Text>
                    </View>
                    {isSelected ? (
                      <View style={styles.pickerCheckBadge}>
                        <Text style={styles.pickerCheckText}>✓</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>
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
  pickerBackdropTouchable: {
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
    alignItems: 'center',
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
  formGroup: {
    marginBottom: spacing.lg,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs + 2,
  },
  label: {
    ...typography.presets.bodySmallStrong,
    color: colors.text.secondary,
    marginBottom: spacing.xs + 2,
  },
  preferredBadge: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.brand.primary,
    backgroundColor: colors.brand.primaryLight,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: spacing.xxs,
    borderRadius: radius.xs,
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
  singleBranchChip: {
    backgroundColor: colors.brand.primarySubtle,
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
  doctorChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.neutral.background,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  doctorChipActive: {
    backgroundColor: colors.brand.primaryLight,
    borderColor: colors.brand.primary,
  },
  doctorChipName: {
    ...typography.presets.bodySmallStrong,
    color: colors.text.primary,
  },
  doctorChipNameActive: {
    color: colors.brand.primary,
  },
  doctorChipSpec: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  input: {
    backgroundColor: colors.neutral.background,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.size.base,
    color: colors.text.primary,
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: colors.status.danger,
    borderWidth: 1.5,
  },
  inlineErrorText: {
    ...typography.presets.caption,
    color: colors.status.danger,
    marginTop: spacing.xs,
    fontWeight: typography.weight.medium,
  },
  requiredAsterisk: {
    color: colors.status.danger,
    fontWeight: typography.weight.bold,
  },
  charCount: {
    ...typography.presets.caption,
    color: colors.text.muted,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  clinicalHistoryCard: {
    backgroundColor: colors.neutral.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.md + 2,
    marginBottom: spacing.lg,
  },
  clinicalHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  clinicalHistoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  clinicalHistoryTitle: {
    ...typography.presets.bodyStrong,
    color: colors.text.primary,
  },
  optionalBadge: {
    backgroundColor: colors.neutral.surfaceSubtle,
    borderColor: colors.border.default,
    borderWidth: 1,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
  },
  optionalBadgeText: {
    fontSize: typography.size.micro,
    lineHeight: typography.lineHeight.micro,
    fontWeight: typography.weight.semibold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
  },
  clinicalHistorySubtitle: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  toggleBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.xs + 2,
    backgroundColor: colors.brand.primaryLight,
  },
  toggleBtnText: {
    ...typography.presets.captionStrong,
    color: colors.brand.primary,
  },
  clinicalFieldsContainer: {
    marginTop: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  clinicalFieldGroup: {
    marginBottom: 2,
  },
  clinicalFieldLabel: {
    ...typography.presets.captionStrong,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  clinicalTextArea: {
    minHeight: 56,
    backgroundColor: colors.neutral.surface,
    textAlignVertical: 'top',
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
    minWidth: 140,
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
  // Cascading Dropdown Row
  cascadingRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  cascadingColLeft: {
    flex: 1,
  },
  cascadingColRight: {
    flex: 1.1,
  },
  selectTrigger: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.neutral.surface,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectTriggerDisabled: {
    backgroundColor: colors.neutral.surfaceSubtle,
    borderColor: colors.border.subtle,
    opacity: 0.7,
  },
  selectTriggerLocked: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.status.infoBorder,
    backgroundColor: colors.brand.primarySubtle,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  lockedDeptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dentalIcon: {
    fontSize: 14,
  },
  lockedDeptText: {
    ...typography.presets.bodySmallMedium,
    color: colors.brand.primaryDark,
    fontWeight: '600',
  },
  selectTriggerLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  selectValueText: {
    ...typography.presets.bodySmallMedium,
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing.xs,
  },
  selectPlaceholderText: {
    color: colors.text.muted,
  },
  selectArrow: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    marginLeft: 2,
  },
  // Picker Modals
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '75%',
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    ...shadows.modal,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  pickerHeaderLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  pickerTitle: {
    ...typography.presets.sectionTitle,
    color: colors.text.primary,
  },
  pickerSubtitle: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  pickerCloseBtn: {
    padding: spacing.xs,
  },
  pickerCloseBtnText: {
    ...typography.presets.sectionTitle,
    color: colors.text.secondary,
  },
  pickerListScroll: {
    maxHeight: 360,
  },
  pickerListContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.neutral.background,
    marginVertical: spacing.xs,
  },
  pickerItemSelected: {
    backgroundColor: colors.brand.primaryLight,
    borderColor: colors.brand.primary,
  },
  pickerItemInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  pickerItemTitle: {
    ...typography.presets.bodyStrong,
    color: colors.text.primary,
  },
  pickerItemTitleSelected: {
    color: colors.brand.primary,
  },
  pickerItemSubtitle: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  pickerCheckBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCheckText: {
    color: colors.text.inverse,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },
  pickerEmptyText: {
    ...typography.presets.bodySmall,
    color: colors.text.muted,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
});
