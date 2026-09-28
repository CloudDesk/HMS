import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type { PortalPatientDetail } from '../../portal/contracts';
import { calculateAge } from '../../portal/formatters';
import { Avatar } from './Avatar';
import { StatusBadge } from './StatusBadge';
import { colors, radius, shadows, spacing, typography } from '../theme';

interface PatientCardProps {
  patient: PortalPatientDetail;
  relationship?: string;
}

export function PatientCard({ patient, relationship }: PatientCardProps) {
  const age = calculateAge(patient.date_of_birth);
  const fullName = `${patient.first_name} ${patient.middle_name ? `${patient.middle_name} ` : ''}${patient.last_name}`;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Avatar
          name={fullName}
          photoUrl={patient.profile_photo_url}
          size={48}
          style={styles.avatarMargin}
        />
        <View style={styles.mainInfo}>
          <Text style={styles.name} numberOfLines={1}>
            {fullName}
          </Text>
          <View style={styles.mrnRow}>
            <Text style={styles.mrnLabel}>MRN</Text>
            <Text style={styles.mrnValue}>{patient.patient_number}</Text>
          </View>
        </View>
        {relationship ? (
          <View style={styles.relationshipBadge}>
            <Text style={styles.relationshipText}>{relationship}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.divider} />

      <View style={styles.chipsRow}>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>Age / Gender</Text>
          <Text style={styles.chipValue}>
            {age} {age === 1 ? 'yr' : 'yrs'} • {patient.gender}
          </Text>
        </View>

        {patient.blood_group ? (
          <View style={styles.chip}>
            <Text style={styles.chipLabel}>Blood Group</Text>
            <Text style={[styles.chipValue, styles.bloodGroup]}>
              {patient.blood_group}
            </Text>
          </View>
        ) : null}

        <View style={styles.chipStatus}>
          <Text style={styles.chipLabel}>Status</Text>
          <StatusBadge
            label={patient.status}
            variant={patient.status.toUpperCase() === 'ACTIVE' ? 'success' : 'neutral'}
            size="sm"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.xl,
    ...shadows.card,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarMargin: {
    marginRight: spacing.md,
  },
  mainInfo: {
    flex: 1,
  },
  name: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  mrnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xxs,
  },
  mrnLabel: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    fontWeight: typography.weight.semibold,
    marginRight: spacing.xs,
    textTransform: 'uppercase',
  },
  mrnValue: {
    fontSize: typography.size.xs + 1,
    color: colors.brand.primaryDark,
    fontWeight: typography.weight.bold,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  relationshipBadge: {
    backgroundColor: colors.neutral.surfaceSubtle,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  relationshipText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.md,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chip: {
    flex: 1,
  },
  chipStatus: {
    alignItems: 'flex-end',
  },
  chipLabel: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    marginBottom: spacing.xxs,
    fontWeight: typography.weight.medium,
  },
  chipValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
  bloodGroup: {
    color: colors.status.danger,
    fontWeight: typography.weight.bold,
  },
});
