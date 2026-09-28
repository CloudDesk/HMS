import React, { useState } from 'react';
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
import { calculateAge, formatDateOfBirth, relationshipLabel } from '../../portal/formatters';
import { Avatar } from '../components/Avatar';
import { PatientContextSelector } from '../components/PatientContextSelector';
import { ProfilePhotoModal } from '../components/ProfilePhotoModal';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { colors, radius, shadows, spacing, typography } from '../theme';
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
    uploadPhoto,
    deletePhoto,
  } = usePatient();

  const [photoModalOpen, setPhotoModalOpen] = useState(false);

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
        <Text style={styles.loadingText}>Loading profile details...</Text>
      </View>
    );
  }

  if (error && !overview) {
    return (
      <View style={styles.errorContainer}>
        <EmptyState
          icon="⚠️"
          title="Unable to Load Profile"
          description={error}
          actionLabel="Try Again"
          onAction={refresh}
        />
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
  const patientFullName = patient
    ? `${patient.first_name} ${patient.middle_name ? `${patient.middle_name} ` : ''}${patient.last_name}`
    : '—';

  return (
    <>
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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Profile</Text>
          <Text style={styles.headerSubtitle}>
            Patient identity & hospital records
          </Text>
        </View>

        {/* Patient Switcher */}
        <PatientContextSelector />

        {/* Profile Overview Card */}
        {patient ? (
          <View style={styles.heroCard}>
            <View style={styles.avatarSection}>
              <Avatar
                name={patientFullName}
                photoUrl={patient.profile_photo_url}
                size={80}
                showEditBadge
                onPress={() => setPhotoModalOpen(true)}
              />
              <TouchableOpacity
                style={styles.changePhotoBtn}
                onPress={() => setPhotoModalOpen(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.changePhotoText}>
                  {patient.profile_photo_url ? 'Change Photo' : 'Add Photo'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.heroName}>{patientFullName}</Text>
            <Text style={styles.heroMrn}>MRN: {patient.patient_number}</Text>
            <View style={styles.heroBadgeRow}>
              <StatusBadge
                label={patient.status}
                variant={patient.status.toUpperCase() === 'ACTIVE' ? 'success' : 'neutral'}
                size="sm"
              />
              {selectedPatient?.relationship ? (
                <View style={styles.relBadge}>
                  <Text style={styles.relBadgeText}>
                    {relationshipLabel(selectedPatient.relationship)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

      {/* Personal Information */}
      {patient ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Information</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Full Legal Name</Text>
            <Text style={styles.value}>
              {patient.first_name} {patient.middle_name ? `${patient.middle_name} ` : ''}
              {patient.last_name}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Date of Birth</Text>
            <Text style={styles.value}>{formatDateOfBirth(patient.date_of_birth)}</Text>
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>More Services</Text>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => onNavigateTab('billing')}
            activeOpacity={0.75}
          >
            <View style={styles.actionCardLeft}>
              <Text style={styles.actionCardTitle}>Hospital Invoices & Billing</Text>
              <Text style={styles.actionCardSubtitle}>
                View statements, receipts & outstanding balance
              </Text>
            </View>
            <Text style={styles.actionCardArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => onNavigateTab('documents')}
            activeOpacity={0.75}
          >
            <View style={styles.actionCardLeft}>
              <Text style={styles.actionCardTitle}>My Documents</Text>
              <Text style={styles.actionCardSubtitle}>
                Medical records, insurance files & uploads
              </Text>
            </View>
            <Text style={styles.actionCardArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => onNavigateTab('dental')}
            activeOpacity={0.75}
          >
            <View style={styles.actionCardLeft}>
              <Text style={styles.actionCardTitle}>Dental Treatment Plans</Text>
              <Text style={styles.actionCardSubtitle}>
                Dental quotations & proposed care options
              </Text>
            </View>
            <Text style={styles.actionCardArrow}>→</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Read-Only Notice */}
      <View style={styles.noticeBox}>
        <Text style={styles.noticeText}>
          To update your registered mobile number or medical records, please contact hospital reception.
        </Text>
      </View>

      {/* Sign Out Button */}
      <TouchableOpacity
        style={styles.signOutButton}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>

    {patient ? (
      <ProfilePhotoModal
        visible={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        patientName={patientFullName}
        currentPhotoUrl={patient.profile_photo_url}
        onUploadPhoto={async (file) => {
          await uploadPhoto(patient.id, file);
        }}
        onDeletePhoto={
          patient.profile_photo_url
            ? async () => {
                await deletePhoto(patient.id);
              }
            : undefined
        }
      />
    ) : null}
  </>
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
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    fontWeight: typography.weight.medium,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.neutral.background,
  },
  header: {
    marginBottom: spacing.lg,
    paddingTop: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: typography.size.xs + 1,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  heroCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.xl,
    ...shadows.card,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  changePhotoBtn: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.brand.primaryLight,
  },
  changePhotoText: {
    fontSize: typography.size.xs,
    color: colors.brand.primaryDark,
    fontWeight: typography.weight.semibold,
  },
  heroName: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xxs,
  },
  heroMrn: {
    fontSize: typography.size.xs + 1,
    color: colors.text.secondary,
    fontFamily: 'monospace',
    marginBottom: spacing.md,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  relBadge: {
    backgroundColor: colors.neutral.surfaceSubtle,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  relBadgeText: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.lg,
    ...shadows.subtle,
  },
  cardTitle: {
    fontSize: typography.size.sm + 1,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
    letterSpacing: -0.2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  label: {
    fontSize: typography.size.xs + 1,
    color: colors.text.secondary,
    fontWeight: typography.weight.medium,
    flex: 1,
  },
  value: {
    fontSize: typography.size.sm,
    color: colors.text.primary,
    fontWeight: typography.weight.semibold,
    flex: 1.2,
    textAlign: 'right',
  },
  addressValue: {
    fontSize: typography.size.xs + 1,
    lineHeight: typography.lineHeight.normal,
  },
  capitalize: {
    textTransform: 'capitalize',
  },
  bloodGroupText: {
    color: colors.status.danger,
    fontWeight: typography.weight.bold,
  },
  section: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.md,
    ...shadows.subtle,
  },
  actionCardLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  actionCardTitle: {
    fontSize: typography.size.sm + 1,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xxs,
  },
  actionCardSubtitle: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
  },
  actionCardArrow: {
    fontSize: typography.size.lg,
    color: colors.brand.primary,
    fontWeight: typography.weight.bold,
  },
  noticeBox: {
    backgroundColor: colors.neutral.surfaceSubtle,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  noticeText: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: typography.lineHeight.normal,
  },
  signOutButton: {
    backgroundColor: colors.status.dangerBg,
    borderWidth: 1,
    borderColor: colors.status.dangerBorder,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  signOutText: {
    color: colors.status.danger,
    fontSize: typography.size.sm + 1,
    fontWeight: typography.weight.bold,
  },
});
