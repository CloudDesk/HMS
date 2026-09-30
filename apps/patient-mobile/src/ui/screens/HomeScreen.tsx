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
import { EmptyState } from '../components/EmptyState';
import { colors, radius, shadows, spacing, typography } from '../theme';
import type { MainTab } from '../components/BottomNavBar';

interface HomeScreenProps {
  onNavigateTab: (tab: MainTab) => void;
}

export function HomeScreen({ onNavigateTab }: HomeScreenProps) {
  const { logout, manager } = useAuth();
  const {
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
      .getUnreadCount(selectedPatientId)
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
      'Are you sure you want to sign out of MyCare?',
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
        <ActivityIndicator size="small" color={colors.brand.primary} />
        <Text style={styles.loadingText}>Loading health dashboard...</Text>
      </View>
    );
  }

  if (error && !overview) {
    return (
      <View style={styles.errorContainer}>
        <EmptyState
          icon="⚠️"
          title="Unable to Load Dashboard"
          description={error}
          actionLabel="Try Again"
          onAction={refresh}
        />
      </View>
    );
  }

  const patient = overview?.patient;
  const summary = overview?.summary;
  const relationship = selectedPatient
    ? relationshipLabel(selectedPatient.relationship)
    : undefined;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={refresh}
          colors={[colors.brand.primary]}
          tintColor={colors.brand.primary}
        />
      }
    >
      {/* Top App Header */}
      <View style={styles.header}>
        <View style={styles.greetingContainer}>
          <Text style={styles.greetingText}>{getGreeting()},</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => onNavigateTab('notifications')}
            activeOpacity={0.7}
            accessibilityLabel="Notifications"
          >
            <Text style={styles.headerIconText}>🔔</Text>
            {unreadNotifsCount > 0 ? (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {unreadNotifsCount > 9 ? '9+' : unreadNotifsCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={handleLogout}
            activeOpacity={0.7}
            accessibilityLabel="Sign Out"
          >
            <Text style={styles.headerIconText}>🚪</Text>
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

      {/* Quick Access Services */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Healthcare Services</Text>
        <View style={styles.servicesGrid}>
          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => onNavigateTab('appointments')}
            activeOpacity={0.75}
          >
            <View style={[styles.serviceIconCircle, { backgroundColor: colors.brand.primaryLight }]}>
              <Text style={styles.serviceEmoji}>📅</Text>
            </View>
            <Text style={styles.serviceTitle}>Appointments</Text>
            <Text style={styles.serviceSubtitle}>Book & view visits</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => onNavigateTab('prescriptions')}
            activeOpacity={0.75}
          >
            <View style={[styles.serviceIconCircle, { backgroundColor: '#F3E8FF' }]}>
              <Text style={styles.serviceEmoji}>💊</Text>
            </View>
            <Text style={styles.serviceTitle}>Medicines</Text>
            <Text style={styles.serviceSubtitle}>Prescriptions & doses</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => onNavigateTab('records')}
            activeOpacity={0.75}
          >
            <View style={[styles.serviceIconCircle, { backgroundColor: '#DCFCE7' }]}>
              <Text style={styles.serviceEmoji}>📋</Text>
            </View>
            <Text style={styles.serviceTitle}>Medical Records</Text>
            <Text style={styles.serviceSubtitle}>Lab & imaging results</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => onNavigateTab('billing')}
            activeOpacity={0.75}
          >
            <View style={[styles.serviceIconCircle, { backgroundColor: '#FEF9C3' }]}>
              <Text style={styles.serviceEmoji}>🧾</Text>
            </View>
            <Text style={styles.serviceTitle}>Billing</Text>
            <Text style={styles.serviceSubtitle}>Invoices & receipts</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => onNavigateTab('documents')}
            activeOpacity={0.75}
          >
            <View style={[styles.serviceIconCircle, { backgroundColor: '#E0E7FF' }]}>
              <Text style={styles.serviceEmoji}>📁</Text>
            </View>
            <Text style={styles.serviceTitle}>Documents</Text>
            <Text style={styles.serviceSubtitle}>Files & health records</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => onNavigateTab('dental')}
            activeOpacity={0.75}
          >
            <View style={[styles.serviceIconCircle, { backgroundColor: '#CCFBF1' }]}>
              <Text style={styles.serviceEmoji}>🦷</Text>
            </View>
            <Text style={styles.serviceTitle}>Dental Care</Text>
            <Text style={styles.serviceSubtitle}>Treatment plans & stages</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => onNavigateTab('consents')}
            activeOpacity={0.75}
          >
            <View style={[styles.serviceIconCircle, { backgroundColor: '#FEE2E2' }]}>
              <Text style={styles.serviceEmoji}>✍️</Text>
            </View>
            <Text style={styles.serviceTitle}>Consent Forms</Text>
            <Text style={styles.serviceSubtitle}>Medical consents & signatures</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Health Overview Summary Cards */}
      {summary ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.summaryGrid}>
            <TouchableOpacity
              style={styles.summaryCard}
              onPress={() => onNavigateTab('appointments')}
              activeOpacity={0.75}
            >
              <Text style={styles.summaryValue}>{summary.upcoming_appointments}</Text>
              <Text style={styles.summaryLabel}>Upcoming Visits</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.summaryCard}
              onPress={() => onNavigateTab('records')}
              activeOpacity={0.75}
            >
              <Text style={styles.summaryValue}>{summary.verified_lab_results}</Text>
              <Text style={styles.summaryLabel}>Lab Reports</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.summaryCard}
              onPress={() => onNavigateTab('records')}
              activeOpacity={0.75}
            >
              <Text style={styles.summaryValue}>{summary.verified_imaging_reports}</Text>
              <Text style={styles.summaryLabel}>Imaging Scans</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.summaryCard}
              onPress={() => onNavigateTab('billing')}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.summaryValue,
                  summary.outstanding_invoices > 0 ? styles.alertValue : undefined,
                ]}
              >
                {summary.outstanding_invoices}
              </Text>
              <Text style={styles.summaryLabel}>Pending Invoices</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    backgroundColor: colors.neutral.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.neutral.background,
  },
  loadingText: {
    marginTop: spacing.md,
    ...typography.presets.bodySmallMedium,
    color: colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.neutral.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingTop: spacing.xs,
  },
  greetingContainer: {
    flex: 1,
  },
  greetingText: {
    ...typography.presets.screenTitle,
    color: colors.text.primary,
    letterSpacing: typography.letterSpacing.tight,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
  headerIconText: {
    fontSize: typography.size.title,
  },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.status.danger,
    borderRadius: radius.full,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.neutral.surface,
  },
  notifBadgeText: {
    color: colors.text.inverse,
    ...typography.presets.micro,
    fontWeight: typography.weight.bold,
  },
  emptyCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  emptyCardText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.presets.sectionTitle,
    color: colors.text.primary,
    marginBottom: spacing.md,
    letterSpacing: typography.letterSpacing.tight,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  serviceCard: {
    width: '47.5%',
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    ...shadows.subtle,
  },
  serviceIconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  serviceEmoji: {
    fontSize: typography.size.xl,
  },
  serviceTitle: {
    ...typography.presets.bodyStrong,
    color: colors.text.primary,
    marginBottom: spacing.xxs,
  },
  serviceSubtitle: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  summaryCard: {
    width: '47.5%',
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    ...shadows.subtle,
  },
  summaryValue: {
    ...typography.presets.display,
    color: colors.brand.primaryDark,
    marginBottom: spacing.xxs,
  },
  alertValue: {
    color: colors.status.danger,
  },
  summaryLabel: {
    ...typography.presets.captionMedium,
    color: colors.text.secondary,
  },
});
