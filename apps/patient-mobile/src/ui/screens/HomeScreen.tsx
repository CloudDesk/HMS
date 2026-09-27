import React, { useEffect, useMemo, useState } from 'react';
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
import { relationshipLabel } from '../../portal/formatters';
import { NotificationsApi } from '../../notifications/notifications-api';
import { PatientCard } from '../components/PatientCard';
import { PatientContextSelector } from '../components/PatientContextSelector';
import type { MainTab } from '../components/BottomNavBar';

interface HomeScreenProps {
  onNavigateTab: (tab: MainTab) => void;
}

export function HomeScreen({ onNavigateTab }: HomeScreenProps) {
  const { logout, manager } = useAuth();
  const {
    context,
    selectedPatient,
    selectedPatientId,
    overview,
    isLoading,
    isRefreshing,
    error,
    refresh,
  } = usePatient();

  const [unreadNotifsCount, setUnreadNotifsCount] = useState<number>(0);
  const notificationsApi = useMemo(() => new NotificationsApi(manager), [manager]);

  useEffect(() => {
    let isMounted = true;
    if (!selectedPatientId) {
      setUnreadNotifsCount(0);
      return;
    }

    notificationsApi
      .getUnreadCount()
      .then((count) => {
        if (isMounted) setUnreadNotifsCount(count);
      })
      .catch(() => {
        if (isMounted) setUnreadNotifsCount(0);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedPatientId, notificationsApi, isRefreshing]);

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your patient portal session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  if (isLoading && !isRefreshing && !overview) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0284C7" />
        <Text style={styles.loadingText}>Loading patient dashboard…</Text>
      </View>
    );
  }

  if (error && !overview) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorIconCircle}>
          <Text style={styles.errorIconText}>⚠️</Text>
        </View>
        <Text style={styles.errorTitle}>Unable to Load Dashboard</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refresh}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const patient = overview?.patient;
  const summary = overview?.summary;
  const relationship = selectedPatient
    ? relationshipLabel(selectedPatient.relationship)
    : undefined;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={refresh}
          colors={['#0284C7']}
          tintColor="#0284C7"
        />
      }
    >
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.headerName}>
            {context?.account.full_name ?? selectedPatient?.full_name ?? 'Patient'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.notifIconBtn}
            onPress={() => onNavigateTab('notifications')}
            accessibilityLabel="Notifications"
          >
            <Text style={styles.notifIconText}>🔔</Text>
            {unreadNotifsCount > 0 ? (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {unreadNotifsCount > 9 ? '9+' : unreadNotifsCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signOutIconBtn}
            onPress={handleLogout}
            accessibilityLabel="Sign Out"
          >
            <Text style={styles.signOutIconText}>🚪</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Patient Context Selector (Family / Dependents Switcher) */}
      <PatientContextSelector />

      {/* Patient Identity Card */}
      {patient ? (
        <PatientCard patient={patient} relationship={relationship} />
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyCardText}>No patient record linked to this account.</Text>
        </View>
      )}

      {/* Health Overview Summary Cards */}
      {summary ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Health Overview</Text>
          <View style={styles.summaryGrid}>
            <TouchableOpacity
              style={styles.summaryCard}
              onPress={() => onNavigateTab('appointments')}
              activeOpacity={0.7}
            >
              <Text style={styles.summaryValue}>{summary.upcoming_appointments}</Text>
              <Text style={styles.summaryLabel}>Upcoming Appointments</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.summaryCard}
              onPress={() => onNavigateTab('records')}
              activeOpacity={0.7}
            >
              <Text style={styles.summaryValue}>{summary.verified_lab_results}</Text>
              <Text style={styles.summaryLabel}>Verified Lab Tests</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.summaryCard}
              onPress={() => onNavigateTab('records')}
              activeOpacity={0.7}
            >
              <Text style={styles.summaryValue}>{summary.verified_imaging_reports}</Text>
              <Text style={styles.summaryLabel}>Imaging Reports</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.summaryCard}
              onPress={() => onNavigateTab('billing')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.summaryValue,
                  summary.outstanding_invoices > 0 ? styles.alertValue : undefined,
                ]}
              >
                {summary.outstanding_invoices}
              </Text>
              <Text style={styles.summaryLabel}>Outstanding Invoices</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Quick Services Navigation */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Portal Services</Text>
        <View style={styles.servicesGrid}>
          <TouchableOpacity
            style={styles.serviceItem}
            onPress={() => onNavigateTab('profile')}
            activeOpacity={0.7}
          >
            <View style={[styles.serviceIconCircle, { backgroundColor: '#E0F2FE' }]}>
              <Text style={styles.serviceEmoji}>👤</Text>
            </View>
            <Text style={styles.serviceName}>My Profile</Text>
            <Text style={styles.serviceDesc}>View identity & contacts</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceItem}
            onPress={() => onNavigateTab('appointments')}
            activeOpacity={0.7}
          >
            <View style={[styles.serviceIconCircle, { backgroundColor: '#FEF3C7' }]}>
              <Text style={styles.serviceEmoji}>📅</Text>
            </View>
            <Text style={styles.serviceName}>Appointments</Text>
            <Text style={styles.serviceDesc}>Schedules & visits</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceItem}
            onPress={() => onNavigateTab('records')}
            activeOpacity={0.7}
          >
            <View style={[styles.serviceIconCircle, { backgroundColor: '#DCFCE7' }]}>
              <Text style={styles.serviceEmoji}>📋</Text>
            </View>
            <Text style={styles.serviceName}>Medical Records</Text>
            <Text style={styles.serviceDesc}>Labs, imaging & history</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceItem}
            onPress={() => onNavigateTab('prescriptions')}
            activeOpacity={0.7}
          >
            <View style={[styles.serviceIconCircle, { backgroundColor: '#F3E8FF' }]}>
              <Text style={styles.serviceEmoji}>💊</Text>
            </View>
            <Text style={styles.serviceName}>Prescriptions</Text>
            <Text style={styles.serviceDesc}>Medicines & dosages</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceItem}
            onPress={() => onNavigateTab('billing')}
            activeOpacity={0.7}
          >
            <View style={[styles.serviceIconCircle, { backgroundColor: '#FEF9C3' }]}>
              <Text style={styles.serviceEmoji}>🧾</Text>
            </View>
            <Text style={styles.serviceName}>Billing & Invoices</Text>
            <Text style={styles.serviceDesc}>Bills, payments & balances</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceItem}
            onPress={() => onNavigateTab('documents')}
            activeOpacity={0.7}
          >
            <View style={[styles.serviceIconCircle, { backgroundColor: '#E0E7FF' }]}>
              <Text style={styles.serviceEmoji}>📁</Text>
            </View>
            <Text style={styles.serviceName}>My Documents</Text>
            <Text style={styles.serviceDesc}>Insurance, files & forms</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceItem}
            onPress={() => onNavigateTab('dental')}
            activeOpacity={0.7}
          >
            <View style={[styles.serviceIconCircle, { backgroundColor: '#CCFBF1' }]}>
              <Text style={styles.serviceEmoji}>🦷</Text>
            </View>
            <Text style={styles.serviceName}>Dental Plans</Text>
            <Text style={styles.serviceDesc}>Treatment quotations & options</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Account Info Footer */}
      {context?.account ? (
        <View style={styles.accountCard}>
          <Text style={styles.accountCardTitle}>Account Information</Text>
          <View style={styles.accountRow}>
            <Text style={styles.accountLabel}>Account Type</Text>
            <Text style={styles.accountValue}>
              {context.account.type === 'GUARDIAN' ? 'Parent / Guardian' : 'Patient Account'}
            </Text>
          </View>
          {context.account.phone ? (
            <View style={styles.accountRow}>
              <Text style={styles.accountLabel}>Registered Phone</Text>
              <Text style={styles.accountValue}>{context.account.phone}</Text>
            </View>
          ) : null}
          {context.account.email ? (
            <View style={styles.accountRow}>
              <Text style={styles.accountLabel}>Email</Text>
              <Text style={styles.accountValue}>{context.account.email}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#F8FAFC',
    padding: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 24,
  },
  errorIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorIconText: {
    fontSize: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  greeting: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  headerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notifIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notifIconText: {
    fontSize: 16,
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  signOutIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signOutIconText: {
    fontSize: 16,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  emptyCardText: {
    color: '#64748B',
    fontSize: 14,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0284C7',
    marginBottom: 4,
  },
  alertValue: {
    color: '#DC2626',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  serviceItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  serviceIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  serviceEmoji: {
    fontSize: 18,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  serviceDesc: {
    fontSize: 11,
    color: '#94A3B8',
  },
  accountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 4,
  },
  accountCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  accountLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  accountValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
});
