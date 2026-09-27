import React, { useMemo, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {
  formatHumanReadableDate,
  formatToDateString,
  getQuickDateOptions,
  parseFromDateString,
} from '../../appointments/date-utils';

export {
  formatHumanReadableDate,
  formatToDateString,
  getQuickDateOptions,
  parseFromDateString,
};

export interface AppointmentDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  minDate?: string; // YYYY-MM-DD (defaults to today)
  disabled?: boolean;
}

export function AppointmentDatePicker({
  value,
  onChange,
  minDate,
  disabled = false,
}: AppointmentDatePickerProps) {
  const todayStr = useMemo(() => formatToDateString(new Date()), []);
  const effectiveMinDate = minDate ?? todayStr;

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Month navigation in calendar modal
  const initialSelected = useMemo(
    () => (value ? parseFromDateString(value) : new Date()),
    [value]
  );
  const [viewYear, setViewYear] = useState<number>(initialSelected.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialSelected.getMonth());

  const quickOptions = useMemo(() => getQuickDateOptions(effectiveMinDate), [effectiveMinDate]);

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
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Generate days in month grid
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

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
      const isPast = dateStr < effectiveMinDate;
      days.push({ day, dateStr, isPast });
    }

    return days;
  }, [viewYear, viewMonth, effectiveMinDate]);

  const handleSelectDay = (dateStr: string) => {
    onChange(dateStr);
    setIsCalendarOpen(false);
  };

  return (
    <View style={styles.container}>
      {/* Quick Select Buttons */}
      <View style={styles.quickOptionsRow}>
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
      </View>

      {/* Selected Date Summary & Custom Date Button */}
      <TouchableOpacity
        style={[styles.dateDisplayBtn, disabled && styles.disabledBtn]}
        onPress={() => {
          if (!disabled) {
            const current = value ? parseFromDateString(value) : new Date();
            setViewYear(current.getFullYear());
            setViewMonth(current.getMonth());
            setIsCalendarOpen(true);
          }
        }}
        activeOpacity={0.7}
        disabled={disabled}
      >
        <View style={styles.dateDisplayLeft}>
          <Text style={styles.calendarIcon}>📅</Text>
          <Text style={styles.dateDisplayText}>
            {formatHumanReadableDate(value)}
          </Text>
        </View>
        <Text style={styles.changeDateAction}>Change Date ▾</Text>
      </TouchableOpacity>

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

                  <Text style={styles.monthTitle}>
                    {monthNames[viewMonth]} {viewYear}
                  </Text>

                  <TouchableOpacity
                    style={styles.navBtn}
                    onPress={handleNextMonth}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.navBtnText}>›</Text>
                  </TouchableOpacity>
                </View>

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
    marginVertical: 4,
  },
  quickOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  quickChipSelected: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  disabledChip: {
    opacity: 0.5,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  quickChipTextSelected: {
    color: '#FFFFFF',
  },
  dateDisplayBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0284C7',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  dateDisplayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calendarIcon: {
    fontSize: 16,
  },
  dateDisplayText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  changeDateAction: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284C7',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBtnText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#334155',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  weekDayLabel: {
    width: 36,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dayCellEmpty: {
    width: '14.28%',
    height: 38,
  },
  dayCell: {
    width: '14.28%',
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
    borderRadius: 8,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: '#0284C7',
  },
  dayCellSelected: {
    backgroundColor: '#0284C7',
  },
  dayCellDisabled: {
    opacity: 0.25,
  },
  dayCellText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  dayCellTextToday: {
    color: '#0284C7',
    fontWeight: '700',
  },
  dayCellTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dayCellTextDisabled: {
    color: '#94A3B8',
  },
  cancelModalBtn: {
    marginTop: 16,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  cancelModalBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
});
