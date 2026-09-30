import React, { useMemo, useState } from 'react';
import {
  Modal,
  Keyboard,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {
  formatAppointmentDate,
  formatHumanReadableDate,
  formatToDateString,
  getQuickDateOptions,
  getSlotStatusLabel,
  isSlotExpired,
  isSlotSelectable,
  parseFromDateString,
} from '../../appointments/date-utils';
import { colors, radius, shadows, spacing, typography } from '../theme';

export {
  formatAppointmentDate,
  formatHumanReadableDate,
  formatToDateString,
  getQuickDateOptions,
  getSlotStatusLabel,
  isSlotExpired,
  isSlotSelectable,
  parseFromDateString,
};

export interface AppointmentDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  minDate?: string; // YYYY-MM-DD (defaults to today)
  maxDate?: string;
  showQuickOptions?: boolean;
  allowClear?: boolean;
  label?: string;
  disabled?: boolean;
}

export function AppointmentDatePicker({
  value,
  onChange,
  minDate,
  maxDate,
  showQuickOptions = true,
  allowClear = false,
  label = 'Change Date',
  disabled = false,
}: AppointmentDatePickerProps) {
  const todayStr = useMemo(() => formatToDateString(new Date()), []);
  const effectiveMinDate = minDate ?? todayStr;

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectingYear, setSelectingYear] = useState(false);

  // Month navigation in calendar modal
  const initialSelected = useMemo(
    () => (value ? parseFromDateString(value) : new Date()),
    [value]
  );
  const [viewYear, setViewYear] = useState<number>(initialSelected.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialSelected.getMonth());

  const quickOptions = useMemo(() => showQuickOptions
    ? getQuickDateOptions(effectiveMinDate).filter((option) => !maxDate || option.date <= maxDate)
    : [], [effectiveMinDate, maxDate, showQuickOptions]);

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const handlePrevMonth = () => {
    if (selectingYear) { setViewYear((year) => Math.max(1, year - 12)); return; }
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectingYear) { setViewYear((year) => Math.min(9999, year + 12)); return; }
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Generate days in month grid
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1, 12, 0, 0).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0, 12, 0, 0).getDate();

    const days: ({ day: number; dateStr: string; isPast: boolean } | null)[] = [];

    // Empty cells before 1st day of month
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }

    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
      const monthStr = String(viewMonth + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const dateStr = `${viewYear}-${monthStr}-${dayStr}`;
      const isPast = dateStr < effectiveMinDate || Boolean(maxDate && dateStr > maxDate);
      days.push({ day, dateStr, isPast });
    }

    return days;
  }, [viewYear, viewMonth, effectiveMinDate, maxDate]);

  const handleSelectDay = (dateStr: string) => {
    if (dateStr < effectiveMinDate || (maxDate && dateStr > maxDate)) return;
    onChange(dateStr);
    setIsCalendarOpen(false);
  };

  return (
    <View style={styles.container}>
      {/* Quick Select Buttons */}
      {showQuickOptions ? <View style={styles.quickOptionsRow}>
        {quickOptions.map((opt) => {
          const isSelected = value === opt.date;
          return (
            <TouchableOpacity
              key={opt.date}
              style={[
                styles.quickChip,
                isSelected && styles.quickChipSelected,
                disabled && styles.disabledChip,
              ]}
              onPress={() => onChange(opt.date)}
              disabled={disabled}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.quickChipText,
                  isSelected && styles.quickChipTextSelected,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View> : null}

      {/* Selected Date Summary & Custom Date Button */}
      <TouchableOpacity
        style={[styles.dateDisplayBtn, disabled && styles.disabledBtn]}
        onPress={() => {
          if (!disabled) {
            Keyboard.dismiss();
            const current = value ? parseFromDateString(value) : maxDate ? parseFromDateString(maxDate) : new Date();
            setViewYear(current.getFullYear());
            setViewMonth(current.getMonth());
            setSelectingYear(false);
            setIsCalendarOpen(true);
          }
        }}
        activeOpacity={0.7}
        disabled={disabled}
      >
        <View style={styles.dateDisplayLeft}>
          <Text style={styles.calendarIcon}>📅</Text>
          <Text style={styles.dateDisplayText}>
            {value ? formatHumanReadableDate(value) : 'Select date'}
          </Text>
        </View>
        <Text style={styles.changeDateAction}>{label} ▾</Text>
      </TouchableOpacity>
      {allowClear && value ? <TouchableOpacity disabled={disabled} onPress={() => onChange('')}>
        <Text style={styles.changeDateAction}>Clear date</Text>
      </TouchableOpacity> : null}

      {/* Calendar Grid Modal */}
      <Modal
        visible={isCalendarOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCalendarOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsCalendarOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.calendarCard}>
                {/* Month/Year Header */}
                <View style={styles.calendarHeader}>
                  <TouchableOpacity
                    style={styles.navBtn}
                    onPress={handlePrevMonth}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.navBtnText}>‹</Text>
                  </TouchableOpacity>

                  <TouchableOpacity accessibilityLabel="Choose year" onPress={() => setSelectingYear((current) => !current)}>
                    <Text style={styles.monthTitle}>{monthNames[viewMonth]} {viewYear} ▾</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.navBtn}
                    onPress={handleNextMonth}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.navBtnText}>›</Text>
                  </TouchableOpacity>
                </View>

                {selectingYear ? <View style={styles.daysGrid}>
                  {Array.from({ length: 12 }, (_, index) => Math.floor(viewYear / 12) * 12 + index)
                    .filter((year) => year >= 1 && year <= 9999).map((year) => (
                      <TouchableOpacity key={year} style={[styles.dayCell, { width: '25%' }]}
                        onPress={() => { setViewYear(year); setSelectingYear(false); }}>
                        <Text style={styles.dayCellText}>{year}</Text>
                      </TouchableOpacity>
                    ))}
                </View> : <>
                {/* Day of Week Labels */}
                <View style={styles.weekRow}>
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
                    <Text key={i} style={styles.weekDayLabel}>
                      {d}
                    </Text>
                  ))}
                </View>

                {/* Days Grid */}
                <View style={styles.daysGrid}>
                  {calendarDays.map((item, idx) => {
                    if (!item) {
                      return <View key={`empty-${idx}`} style={styles.dayCellEmpty} />;
                    }

                    const isSelected = value === item.dateStr;
                    const isToday = todayStr === item.dateStr;

                    return (
                      <TouchableOpacity
                        key={item.dateStr}
                        style={[
                          styles.dayCell,
                          isToday && styles.dayCellToday,
                          isSelected && styles.dayCellSelected,
                          item.isPast && styles.dayCellDisabled,
                        ]}
                        onPress={() => !item.isPast && handleSelectDay(item.dateStr)}
                        disabled={item.isPast}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.dayCellText,
                            isToday && styles.dayCellTextToday,
                            isSelected && styles.dayCellTextSelected,
                            item.isPast && styles.dayCellTextDisabled,
                          ]}
                        >
                          {item.day}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                </>}
                {/* Close Button */}
                <TouchableOpacity
                  style={styles.cancelModalBtn}
                  onPress={() => setIsCalendarOpen(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelModalBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.xs,
  },
  quickOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    marginBottom: spacing.sm,
  },
  quickChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 1,
    borderRadius: radius.sm,
    backgroundColor: colors.neutral.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  quickChipSelected: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  disabledChip: {
    opacity: 0.5,
  },
  quickChipText: {
    ...typography.presets.captionStrong,
    color: colors.text.secondary,
  },
  quickChipTextSelected: {
    color: colors.text.inverse,
  },
  dateDisplayBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.neutral.surface,
    borderWidth: 1.5,
    borderColor: colors.brand.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  dateDisplayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  calendarIcon: {
    fontSize: typography.size.subtitle,
  },
  dateDisplayText: {
    ...typography.presets.bodyStrong,
    color: colors.text.primary,
  },
  changeDateAction: {
    ...typography.presets.captionStrong,
    color: colors.brand.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  calendarCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 360,
    ...shadows.modal,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  monthTitle: {
    ...typography.presets.sectionTitle,
    color: colors.text.primary,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.neutral.surfaceSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBtnText: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.text.secondary,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: spacing.sm,
  },
  weekDayLabel: {
    width: '14.285%',
    textAlign: 'center',
    ...typography.presets.captionStrong,
    color: colors.text.muted,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  dayCellEmpty: {
    width: '14.285%',
    height: 38,
  },
  dayCell: {
    width: '14.285%',
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: spacing.xxs,
    borderRadius: radius.sm,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: colors.brand.primary,
  },
  dayCellSelected: {
    backgroundColor: colors.brand.primary,
  },
  dayCellDisabled: {
    opacity: 0.25,
  },
  dayCellText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
  dayCellTextToday: {
    color: colors.brand.primary,
    fontWeight: typography.weight.bold,
  },
  dayCellTextSelected: {
    color: colors.text.inverse,
    fontWeight: typography.weight.bold,
  },
  dayCellTextDisabled: {
    color: colors.text.muted,
  },
  cancelModalBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    backgroundColor: colors.neutral.surfaceSubtle,
    borderRadius: radius.sm,
  },
  cancelModalBtnText: {
    ...typography.presets.buttonSmall,
    color: colors.text.secondary,
  },
});
