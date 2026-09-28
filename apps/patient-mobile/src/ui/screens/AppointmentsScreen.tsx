import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../AuthContext';
import { usePatient } from '../../portal/PatientContext';
import { AppointmentsApi } from '../../appointments/appointments-api';
import type { PortalAppointment } from '../../appointments/contracts';
import { PatientContextSelector } from '../components/PatientContextSelector';
import {
  AppointmentDetailsModal,
  formatVisitType,
} from '../components/AppointmentDetailsModal';
import { BookAppointmentModal } from '../components/BookAppointmentModal';
import { RescheduleAppointmentModal } from '../components/RescheduleAppointmentModal';
import { ErrorDiagnosticView } from '../components/ErrorDiagnosticView';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge, type StatusVariant } from '../components/StatusBadge';
import { friendlyError } from '../../api/errors';
import { colors, radius, shadows, spacing, typography } from '../theme';

const getStatusVariant = (status: string): StatusVariant => {
  switch (status.toUpperCase()) {
    case 'CONFIRMED':
    case 'COMPLETED':
      return 'success';
    case 'SCHEDULED':
      return 'info';
    case 'IN_PROGRESS':
    case 'SKIPPED':
      return 'warning';
    case 'CANCELLED':
    case 'NO_SHOW':
      return 'danger';
    default:
      return 'neutral';
  }
};

export function AppointmentsScreen() {
  const { manager } = useAuth();
  const { selectedPatient, selectedPatientId } = usePatient();

  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const [appointments, setAppointments] = useState<PortalAppointment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorObj, setErrorObj] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [viewingAppointment, setViewingAppointment] = useState<PortalAppointment | null>(null);
  const [isBookingOpen, setIsBookingOpen] = useState<boolean>(false);
  const [reschedulingAppointment, setReschedulingAppointment] = useState<PortalAppointment | null>(
    null
  );

  const api = useMemo(() => new AppointmentsApi(manager), [manager]);

  const fetchAppointments = useCallback(
    async (isRefresh = false) => {
      if (!selectedPatientId) return;

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      setErrorObj(null);

      try {
        const response = await api.listAppointments(selectedPatientId, {
          scope,
          limit: 50,
        });
        setAppointments(response.data);
      } catch (err: unknown) {
        setErrorObj(err);
        setError(friendlyError(err));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [api, selectedPatientId, scope]
  );

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const handleBookingSuccess = () => {
    setIsBookingOpen(false);
    Alert.alert('Appointment Booked', 'Your appointment has been confirmed successfully.');
    fetchAppointments();
  };

  const handleRescheduleSuccess = () => {
    setReschedulingAppointment(null);
    Alert.alert('Appointment Rescheduled', 'Your appointment has been updated successfully.');
    fetchAppointments();
  };

  return (
    <View style={styles.screenContainer}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchAppointments(true)}
            colors={[colors.brand.primary]}
            tintColor={colors.brand.primary}
          />
        }
      >
        {/* Header Title & Book Button */}
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.title}>Appointments</Text>
            <Text style={styles.subtitle}>
              Manage consultations for {selectedPatient?.full_name ?? 'selected profile'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.bookBtn}
            onPress={() => setIsBookingOpen(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.bookBtnText}>+ Book</Text>
          </TouchableOpacity>
        </View>

        {/* Patient Switcher */}
        <PatientContextSelector />

        {/* Scope Tabs (Upcoming / Past) */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, scope === 'upcoming' && styles.tabButtonActive]}
            onPress={() => setScope('upcoming')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, scope === 'upcoming' && styles.tabTextActive]}>
              Upcoming
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, scope === 'past' && styles.tabButtonActive]}
            onPress={() => setScope('past')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, scope === 'past' && styles.tabTextActive]}>
              Past Visits
            </Text>
          </TouchableOpacity>
        </View>

        {/* Loading State */}
        {isLoading && !isRefreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color={colors.brand.primary} />
            <Text style={styles.loadingText}>Loading {scope} appointments...</Text>
          </View>
        ) : null}

        {/* Error State */}
        {error && !isLoading ? (
          <View style={styles.centerContainer}>
            <ErrorDiagnosticView
              error={errorObj ?? error}
              onRetry={() => fetchAppointments()}
              containerStyle={styles.errorDiagnosticWrapper}
            />
          </View>
        ) : null}

        {/* Empty State */}
        {!isLoading && !error && appointments.length === 0 ? (
          <EmptyState
            icon="📅"
            title={scope === 'upcoming' ? 'No Upcoming Appointments' : 'No Past Appointments'}
            description={
              scope === 'upcoming'
                ? 'You do not have any scheduled appointments for this profile.'
                : 'No historical consultation records found.'
            }
            actionLabel={scope === 'upcoming' ? 'Book an Appointment' : undefined}
            onAction={scope === 'upcoming' ? () => setIsBookingOpen(true) : undefined}
          />
        ) : null}

        {/* Appointments List */}
        {!isLoading && !error && appointments.length > 0 ? (
          <View style={styles.listContainer}>
            {appointments.map((apt) => {
              const canReschedule = ['SCHEDULED', 'CONFIRMED', 'NO_SHOW', 'SKIPPED'].includes(
                apt.status
              );

              return (
                <TouchableOpacity
                  key={apt.id}
                  style={styles.card}
                  onPress={() => setViewingAppointment(apt)}
                  activeOpacity={0.75}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <Text style={styles.doctorName}>{apt.doctor_name}</Text>
                      <Text style={styles.specialization}>{apt.doctor_specialization}</Text>
                    </View>
                    <StatusBadge
                      label={apt.status.replace(/_/g, ' ')}
                      variant={getStatusVariant(apt.status)}
                    />
                  </View>

                  <View style={styles.cardDivider} />

                  <View style={styles.cardDetails}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailIcon}>📅</Text>
                      <Text style={styles.detailText}>
                        {apt.appointment_date} • {apt.start_time} - {apt.end_time}
                      </Text>
                    </View>
                    {apt.branch?.name ? (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailIcon}>📍</Text>
                        <Text style={styles.detailText}>
                          {apt.branch.name}
                          {apt.branch.city ? `, ${apt.branch.city}` : ''}
                        </Text>
                      </View>
                    ) : null}
                    <View style={styles.detailRow}>
                      <Text style={styles.detailIcon}>🩺</Text>
                      <Text style={styles.detailText}>{formatVisitType(apt.visit_type)}</Text>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <Text style={styles.appointmentNum}>#{apt.appointment_number}</Text>
                    <View style={styles.cardActions}>
                      {canReschedule && scope === 'upcoming' ? (
                        <TouchableOpacity
                          style={styles.actionRescheduleBtn}
                          onPress={() => setReschedulingAppointment(apt)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.actionRescheduleText}>Reschedule</Text>
                        </TouchableOpacity>
                      ) : null}
                      <Text style={styles.viewDetailsText}>View Details →</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      {/* Appointment Modals */}
      <AppointmentDetailsModal
        appointment={viewingAppointment}
        onClose={() => setViewingAppointment(null)}
        onReschedule={(apt: PortalAppointment) => {
          setViewingAppointment(null);
          setReschedulingAppointment(apt);
        }}
      />

      <BookAppointmentModal
        visible={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        onBooked={handleBookingSuccess}
      />

      <RescheduleAppointmentModal
        appointment={reschedulingAppointment}
        onClose={() => setReschedulingAppointment(null)}
        onRescheduled={handleRescheduleSuccess}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingTop: spacing.xs,
  },
  headerTitleContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: typography.size.xs + 1,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  bookBtn: {
    backgroundColor: colors.brand.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    ...shadows.subtle,
  },
  bookBtnText: {
    color: colors.text.inverse,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.surfaceSubtle,
    borderRadius: radius.md,
    padding: spacing.xxs,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  tabButtonActive: {
    backgroundColor: colors.neutral.surface,
    ...shadows.subtle,
  },
  tabText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.text.secondary,
  },
  tabTextActive: {
    color: colors.brand.primaryDark,
    fontWeight: typography.weight.bold,
  },
  centerContainer: {
    paddingVertical: spacing.xxxl,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.size.sm,
    color: colors.text.secondary,
  },
  errorDiagnosticWrapper: {
    width: '100%',
  },
  listContainer: {
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  doctorName: {
    fontSize: typography.size.md + 1,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
  },
  specialization: {
    fontSize: typography.size.xs + 1,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.md,
  },
  cardDetails: {
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIcon: {
    fontSize: 14,
    marginRight: spacing.sm,
    width: 20,
  },
  detailText: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  appointmentNum: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    fontFamily: 'monospace',
    fontWeight: typography.weight.semibold,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  actionRescheduleBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.neutral.surfaceSubtle,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  actionRescheduleText: {
    fontSize: typography.size.xs,
    color: colors.brand.primaryDark,
    fontWeight: typography.weight.semibold,
  },
  viewDetailsText: {
    fontSize: typography.size.xs + 1,
    color: colors.brand.primary,
    fontWeight: typography.weight.semibold,
  },
});
