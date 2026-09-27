import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { PortalPatientDetail } from '../../portal/contracts';
import { calculateAge } from '../../portal/formatters';

interface PatientCardProps {
  patient: PortalPatientDetail;
  relationship?: string;
}

export function PatientCard({ patient, relationship }: PatientCardProps) {
  const initials = `${patient.first_name[0] ?? ''}${patient.last_name[0] ?? ''}`.toUpperCase();
  const age = calculateAge(patient.date_of_birth);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.mainInfo}>
          <Text style={styles.name}>
            {patient.first_name} {patient.middle_name ? `${patient.middle_name} ` : ''}
            {patient.last_name}
          </Text>
          <View style={styles.mrnRow}>
            <Text style={styles.mrnLabel}>MRN:</Text>
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
            {age} {age === 1 ? 'yr' : 'yrs'}, {patient.gender}
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

        <View style={styles.chip}>
          <Text style={styles.chipLabel}>Status</Text>
          <Text style={[styles.chipValue, styles.statusActive]}>
            {patient.status.toUpperCase()}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0369A1',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#0369A1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  mainInfo: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  mrnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mrnLabel: {
    fontSize: 12,
    color: '#BAE6FD',
    marginRight: 4,
    fontWeight: '500',
  },
  mrnValue: {
    fontSize: 12,
    color: '#F0F9FF',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  relationshipBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  relationshipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginVertical: 14,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipLabel: {
    fontSize: 10,
    color: '#BAE6FD',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  chipValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bloodGroup: {
    color: '#FEF08A',
  },
  statusActive: {
    color: '#86EFAC',
  },
});
