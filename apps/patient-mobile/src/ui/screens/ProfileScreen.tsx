import React from 'react';
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
import { calculateAge, relationshipLabel } from '../../portal/formatters';
import { PatientContextSelector } from '../components/PatientContextSelector';
import type { MainTab } from '../components/BottomNavBar';

interface ProfileScreenProps {
  onNavigateTab?: (tab: MainTab) => void;
}

export function ProfileScreen({ onNavigateTab }: ProfileScreenProps = {}) {
  const { logout } = useAuth();
  const {
    context,
    selectedPatient,
    overview,
    isLoading,
    isRefreshing,
    error,
    refresh,
  } = usePatient();

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
        <Text style={styles.loadingText}>Loading patient profile…</Text>
      </View>
    );
  }

  if (error && !overview) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorIconCircle}>
          <Text style={styles.errorIconText}>⚠️</Text>
        </View>
        <Text style={styles.errorTitle}>Unable to Load Profile</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refresh}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const patient = overview?.patient;
  const guardianProfile = context?.account.guardian_profile;
  const isMinor = patient ? calculateAge(patient.date_of_birth) < 15 : false;
  const showGuardianInfo = Boolean(
    isMinor &&
      selectedPatient &&
      selectedPatient.relationship !== 'SELF' &&
      guardianProfile
  );

  const address = patient?.address as Record<string, string | null | undefined> | undefined;
  const addressParts = address
    ? [address.line1, address.line2, address.city, address.state, address.country, address.postalCode ?? address.postal_code]
        .filter(Boolean)
        .join(', ')
    : '';

  const emergency = patient?.emergency_contact;
  const initials = patient
    ? `${patient.first_name[0] ?? ''}${patient.last_name[0] ?? ''}`.toUpperCase()
    : '—';

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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Patient Profile</Text>
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={handleLogout}
          accessibilityLabel="Sign Out"
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Patient Context Selector */}
      <PatientContextSelector />

      {/* Identity Banner */}
      {patient ? (
        <View style={styles.identityCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>{initials}</Text>
          </View>
          <Text style={styles.patientFullName}>
            {patient.first_name} {patient.middle_name ? `${patient.middle_name} ` : ''}
            {patient.last_name}
          </Text>
          <View style={styles.mrnBadge}>
            <Text style={styles.mrnBadgeText}>MRN: {patient.patient_number}</Text>
          </View>
          {selectedPatient ? (
            <Text style={styles.relationshipSub}>
              Account Context: {relationshipLabel(selectedPatient.relationship)}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Personal Information */}
      {patient ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Information</Text>

          <View style={styles.row}>
            <Text style={styles.label}>First Name</Text>
            <Text style={styles.value}>{patient.first_name}</Text>
          </View>
          {patient.middle_name ? (
            <View style={styles.row}>
              <Text style={styles.label}>Middle Name</Text>
              <Text style={styles.value}>{patient.middle_name}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.label}>Last Name</Text>
            <Text style={styles.value}>{patient.last_name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Date of Birth</Text>
            <Text style={styles.value}>{patient.date_of_birth}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Age</Text>
            <Text style={styles.value}>
              {calculateAge(patient.date_of_birth)} years
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Gender</Text>
            <Text style={[styles.value, styles.capitalize]}>{patient.gender.toLowerCase()}</Text>
          </View>
          {patient.blood_group ? (
            <View style={styles.row}>
              <Text style={styles.label}>Blood Group</Text>
              <Text style={[styles.value, styles.bloodGroupText]}>
                {patient.blood_group}
              </Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.label}>Record Status</Text>
            <Text style={[styles.value, styles.capitalize]}>{patient.status.toLowerCase()}</Text>
          </View>
        </View>
      ) : null}

      {/* Contact Details */}
      {patient ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contact Details</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Phone Number</Text>
            <Text style={styles.value}>{patient.phone || 'Not recorded'}</Text>
          </View>
          {patient.email ? (
            <View style={styles.row}>
              <Text style={styles.label}>Email Address</Text>
              <Text style={styles.value}>{patient.email}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.label}>Residential Address</Text>
            <Text style={[styles.value, styles.addressValue]}>
              {addressParts || 'Not recorded'}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Emergency Contact */}
      {emergency?.name || emergency?.phone ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Emergency Contact</Text>

          {emergency.name ? (
            <View style={styles.row}>
              <Text style={styles.label}>Contact Name</Text>
              <Text style={styles.value}>{emergency.name}</Text>
            </View>
          ) : null}
          {emergency.relationship ? (
            <View style={styles.row}>
              <Text style={styles.label}>Relationship</Text>
              <Text style={styles.value}>{emergency.relationship}</Text>
            </View>
          ) : null}
          {emergency.phone ? (
            <View style={styles.row}>
              <Text style={styles.label}>Phone Number</Text>
              <Text style={styles.value}>{emergency.phone}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Guardian Details (for Minor Dependents) */}
      {showGuardianInfo && guardianProfile ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Parent / Guardian Information</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Guardian Name</Text>
            <Text style={styles.value}>{context?.account.full_name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Relationship</Text>
            <Text style={styles.value}>
              {relationshipLabel(guardianProfile.relationship)}
            </Text>
          </View>
          {context?.account.phone ? (
            <View style={styles.row}>
              <Text style={styles.label}>Guardian Phone</Text>
              <Text style={styles.value}>{context.account.phone}</Text>
            </View>
          ) : null}
          {guardianProfile.identification?.type ? (
            <View style={styles.row}>
              <Text style={styles.label}>ID Document</Text>
              <Text style={styles.value}>
                {guardianProfile.identification.type}: {guardianProfile.identification.number ?? '—'}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Preferred Hospital Branch */}
      {selectedPatient?.preferred_branch ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Preferred Hospital Branch</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Branch Name</Text>
            <Text style={styles.value}>{selectedPatient.preferred_branch.name}</Text>
          </View>
          {selectedPatient.preferred_branch.city ? (
            <View style={styles.row}>
              <Text style={styles.label}>City</Text>
              <Text style={styles.value}>{selectedPatient.preferred_branch.city}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Shortcuts */}
      {onNavigateTab ? (
        <>
          <TouchableOpacity
            style={styles.card}
            onPress={() => onNavigateTab('billing')}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={styles.cardTitle}>Hospital Invoices & Billing</Text>
                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  View bills, itemized receipts & payment history
                </Text>
              </View>
              <Text style={{ fontSize: 16, color: '#0284C7', fontWeight: '700' }}>→</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.card}
            onPress={() => onNavigateTab('documents')}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={styles.cardTitle}>My Documents</Text>
                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  Medical records, insurance files & uploaded documents
                </Text>
              </View>
              <Text style={{ fontSize: 16, color: '#0284C7', fontWeight: '700' }}>→</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.card}
            onPress={() => onNavigateTab('dental')}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={styles.cardTitle}>Dental Treatment Plans</Text>
                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  Dental quotations, proposed procedures & treatment options
                </Text>
              </View>
              <Text style={{ fontSize: 16, color: '#0284C7', fontWeight: '700' }}>→</Text>
            </View>
          </TouchableOpacity>
        </>
      ) : null}

      {/* Read-Only Notice */}
      <View style={styles.noticeBox}>
        <Text style={styles.noticeText}>
          ℹ️ To update your registered phone number or legal medical details, please contact hospital reception.
        </Text>
      </View>
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
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  signOutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  signOutText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },
  identityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarLargeText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  patientFullName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  mrnBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 6,
  },
  mrnBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0369A1',
    letterSpacing: 0.5,
  },
  relationshipSub: {
    fontSize: 12,
    color: '#64748B',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    alignItems: 'flex-start',
  },
  label: {
    fontSize: 13,
    color: '#64748B',
    flex: 1,
    marginRight: 8,
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1.5,
    textAlign: 'right',
  },
  addressValue: {
    lineHeight: 18,
  },
  capitalize: {
    textTransform: 'capitalize',
  },
  bloodGroupText: {
    color: '#DC2626',
    fontWeight: '700',
  },
  noticeBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 14,
    marginTop: 4,
    marginBottom: 12,
  },
  noticeText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    textAlign: 'center',
  },
});
