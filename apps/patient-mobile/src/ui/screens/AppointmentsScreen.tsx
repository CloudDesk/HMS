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
  statusColor,
} from '../components/AppointmentDetailsModal';
import { BookAppointmentModal } from '../components/BookAppointmentModal';
import { RescheduleAppointmentModal } from '../components/RescheduleAppointmentModal';

import { ErrorDiagnosticView } from '../components/ErrorDiagnosticView';
import { friendlyError } from '../../api/errors';

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
            colors={['#0284C7']}
            tintColor="#0284C7"
          />
        }
      >
        {/* Header Title & Book Button */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Appointments</Text>
            <Text style={styles.subtitle}>
              Manage consultations for {selectedPatient?.full_name ?? 'selected patient'}
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
            <ActivityIndicator size="large" color="#0284C7" />
            <Text style={styles.loadingText}>Loading {scope} appointments…</Text>
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
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>
              {scope === 'upcoming' ? 'No Upcoming Appointments' : 'No Past Appointments'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {scope === 'upcoming'
                ? 'You do not have any scheduled appointments for this profile.'
                : 'No historical consultation records found.'}
            </Text>
            {scope === 'upcoming' ? (
              <TouchableOpacity
                style={styles.bookNowBtn}
                onPress={() => setIsBookingOpen(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.bookNowBtnText}>Book an Appointment</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* Appointments List */}
        {!isLoading && !error && appointments.length > 0 ? (
          <View style={styles.listContainer}>
            {appointments.map((apt) => {
              const colors = statusColor(apt.status);
              const canReschedule = ['SCHEDULED', 'CONFIRMED', 'NO_SHOW', 'SKIPPED'].includes(
                apt.status
              );

              return (
                <TouchableOpacity
                  key={apt.id}
                  style={styles.card}
                  onPress={() => setViewingAppointment(apt)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <Text style={styles.doctorName}>{apt.doctor_name}</Text>
                      <Text style={styles.specialization}>{apt.doctor_specialization}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
                      <Text style={[styles.statusText, { color: colors.text }]}>
                        {apt.status.replace(/_/g, ' ')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardDivider} />

                  <View style={styles.cardDetails}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailIcon}>📅</Text>
                      <Text style={styles.detailText}>
                        {apt.appointment_date} · {apt.start_time} - {apt.end_time}
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
                      <Text style={styles.detailsChevron}>View Details →</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      {/* Appointment Details Modal */}
      <AppointmentDetailsModal
        appointment={viewingAppointment}
        onClose={() => setViewingAppointment(null)}
        onReschedule={(apt) => {
          setViewingAppointment(null);
          setReschedulingAppointment(apt);
        }}
      />

      {/* Book Appointment Modal */}
      <BookAppointmentModal
        visible={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        onBooked={handleBookingSuccess}
      />

      {/* Reschedule Appointment Modal */}
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
    backgroundColor: '#F8FAFC',
  },
  container: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  bookBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  bookBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#0284C7',
    fontWeight: '700',
  },
  centerContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  errorIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  bookNowBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  bookNowBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  listContainer: {
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: 10,
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  cardDetails: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIcon: {
    fontSize: 13,
    marginRight: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  appointmentNum: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionRescheduleBtn: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  actionRescheduleText: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '600',
  },
  detailsChevron: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '600',
  },
  errorDiagnosticWrapper: {
    width: '100%',
    maxWidth: 360,
  },
});
