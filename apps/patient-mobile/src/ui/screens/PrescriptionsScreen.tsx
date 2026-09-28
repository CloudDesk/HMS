import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../AuthContext';
import { usePatient } from '../../portal/PatientContext';
import { PrescriptionsApi } from '../../prescriptions/prescriptions-api';
import type {
  PrescriptionRecord,
  PurchasedMedicine,
} from '../../prescriptions/contracts';
import { PatientContextSelector } from '../components/PatientContextSelector';
import {
  formatDateTime,
  PrescriptionDetailsModal,
} from '../components/PrescriptionDetailsModal';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge, type StatusVariant } from '../components/StatusBadge';
import { colors, radius, shadows, spacing, typography } from '../theme';

const getPrescriptionStatusVariant = (status: string): StatusVariant => {
  switch (status.toUpperCase()) {
    case 'DISPENSED':
    case 'COMPLETED':
      return 'success';
    case 'PARTIALLY_DISPENSED':
    case 'ACTIVE':
    case 'SUBMITTED':
      return 'info';
    case 'CANCELLED':
    case 'EXPIRED':
      return 'danger';
    default:
      return 'neutral';
  }
};

export function PrescriptionsScreen() {
  const { manager } = useAuth();
  const { selectedPatient, selectedPatientId } = usePatient();

  const [activeSection, setActiveSection] = useState<'prescriptions' | 'purchases'>('prescriptions');
  const [prescriptions, setPrescriptions] = useState<PrescriptionRecord[]>([]);
  const [purchasedMedicines, setPurchasedMedicines] = useState<PurchasedMedicine[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedPrescription, setSelectedPrescription] = useState<PrescriptionRecord | null>(null);

  const api = useMemo(() => new PrescriptionsApi(manager), [manager]);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (!selectedPatientId) return;

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const result = await api.getPrescriptions(selectedPatientId);
        setPrescriptions(result.prescriptions);
        setPurchasedMedicines(result.purchased_medicines);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Unable to load prescriptions. Please retry.';
        setError(msg);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [api, selectedPatientId]
  );

  useEffect(() => {
    setPrescriptions([]);
    setPurchasedMedicines([]);
    setSelectedPrescription(null);
    loadData();
  }, [selectedPatientId, loadData]);

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <View style={styles.screenContainer}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadData(true)}
            colors={[colors.brand.primary]}
            tintColor={colors.brand.primary}
          />
        }
      >
        {/* Header Title */}
        <View style={styles.header}>
          <Text style={styles.title}>Medicines & Prescriptions</Text>
          <Text style={styles.subtitle}>
            Clinical prescriptions and dispensed pharmacy records for{' '}
            {selectedPatient?.full_name ?? 'selected profile'}
          </Text>
        </View>

        {/* Patient Switcher */}
        <PatientContextSelector />

        {/* Section Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeSection === 'prescriptions' && styles.tabButtonActive]}
            onPress={() => setActiveSection('prescriptions')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                activeSection === 'prescriptions' && styles.tabTextActive,
              ]}
            >
              Prescriptions ({prescriptions.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeSection === 'purchases' && styles.tabButtonActive]}
            onPress={() => setActiveSection('purchases')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                activeSection === 'purchases' && styles.tabTextActive,
              ]}
            >
              Pharmacy Purchases ({purchasedMedicines.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Loading State */}
        {isLoading && !isRefreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color={colors.brand.primary} />
            <Text style={styles.loadingText}>Loading medication records...</Text>
          </View>
        ) : null}

        {/* Error State */}
        {error && !isLoading ? (
          <EmptyState
            icon="⚠️"
            title="Unable to Load Records"
            description={error}
            actionLabel="Try Again"
            onAction={() => loadData()}
          />
        ) : null}

        {/* Prescriptions Section Content */}
        {!isLoading && !error && activeSection === 'prescriptions' ? (
          prescriptions.length === 0 ? (
            <EmptyState
              icon="💊"
              title="No Prescriptions Available"
              description="Doctor-issued prescriptions will appear here following your consultation."
            />
          ) : (
            <View style={styles.listContainer}>
              {prescriptions.map((prescription) => {
                const cleanDoctor = prescription.doctor_name.replace(/^Dr\.?\s+/i, '');

                return (
                  <TouchableOpacity
                    key={prescription.id}
                    style={styles.card}
                    onPress={() => setSelectedPrescription(prescription)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        <Text style={styles.doctorName}>Dr. {cleanDoctor}</Text>
                        <Text style={styles.dateText}>
                          Issued on {formatDateTime(prescription.submitted_at)}
                        </Text>
                      </View>
                      <StatusBadge
                        label={prescription.status.replace(/_/g, ' ')}
                        variant={getPrescriptionStatusVariant(prescription.status)}
                      />
                    </View>

                    {/* Prescribed Medicine Chips */}
                    {prescription.items.length > 0 ? (
                      <View style={styles.chipsContainer}>
                        {prescription.items.slice(0, 3).map((item, idx) => (
                          <View key={item.id || String(idx)} style={styles.medChip}>
                            <Text style={styles.medChipIcon}>💊</Text>
                            <Text style={styles.medChipText} numberOfLines={1}>
                              {item.medicine_name} {item.strength || ''}
                            </Text>
                          </View>
                        ))}
                        {prescription.items.length > 3 ? (
                          <View style={styles.moreChip}>
                            <Text style={styles.moreChipText}>
                              +{prescription.items.length - 3} more
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}

                    <View style={styles.cardFooter}>
                      <Text style={styles.medicinesCountText}>
                        {prescription.items.length}{' '}
                        {prescription.items.length === 1 ? 'medicine' : 'medicines'}
                      </Text>
                      <Text style={styles.viewDetailsText}>View Prescription →</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )
        ) : null}

        {/* Pharmacy Purchases Section Content */}
        {!isLoading && !error && activeSection === 'purchases' ? (
          purchasedMedicines.length === 0 ? (
            <EmptyState
              icon="🧾"
              title="No Pharmacy Purchases"
              description="Medicines dispensed and billed by the hospital pharmacy will appear here."
            />
          ) : (
            <View style={styles.listContainer}>
              {purchasedMedicines.map((purchase) => (
                <View key={purchase.id} style={styles.purchaseCard}>
                  <View style={styles.purchaseHeader}>
                    <View style={styles.purchaseHeaderLeft}>
                      <Text style={styles.purchaseMedicineName}>{purchase.medicine_name}</Text>
                      <Text style={styles.purchaseInvoice}>
                        Invoice: #{purchase.invoice_number} • {formatDateTime(purchase.purchased_at)}
                      </Text>
                    </View>
                    <Text style={styles.purchaseAmount}>
                      {formatCurrency(purchase.total_amount)}
                    </Text>
                  </View>

                  <View style={styles.cardDivider} />

                  <View style={styles.purchaseDetails}>
                    <View style={styles.purchaseDetailItem}>
                      <Text style={styles.purchaseDetailLabel}>Quantity</Text>
                      <Text style={styles.purchaseDetailValue}>
                        {purchase.quantity} {purchase.quantity === 1 ? 'unit' : 'units'}
                      </Text>
                    </View>
                    <View style={styles.purchaseDetailItem}>
                      <Text style={styles.purchaseDetailLabel}>Unit Price</Text>
                      <Text style={styles.purchaseDetailValue}>
                        {formatCurrency(purchase.unit_price)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )
        ) : null}
      </ScrollView>

      {/* Prescription Details Modal */}
      <PrescriptionDetailsModal
        prescription={selectedPrescription}
        onClose={() => setSelectedPrescription(null)}
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
    marginBottom: spacing.lg,
    paddingTop: spacing.xs,
  },
  title: {
    ...typography.presets.screenTitle,
    color: colors.text.primary,
    letterSpacing: typography.letterSpacing.tight,
  },
  subtitle: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
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
    ...typography.presets.bodySmallMedium,
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
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
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
    ...typography.presets.cardTitle,
    color: colors.text.primary,
  },
  dateText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  medChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.surfaceSubtle,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border.default,
    maxWidth: '85%',
  },
  medChipIcon: {
    fontSize: typography.size.caption,
    marginRight: spacing.xs,
  },
  medChipText: {
    ...typography.presets.captionMedium,
    color: colors.text.primary,
  },
  moreChip: {
    backgroundColor: colors.brand.primarySubtle,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.brand.primaryLight,
  },
  moreChipText: {
    ...typography.presets.captionStrong,
    color: colors.brand.primaryDark,
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
  medicinesCountText: {
    ...typography.presets.captionMedium,
    color: colors.text.muted,
  },
  viewDetailsText: {
    ...typography.presets.captionStrong,
    color: colors.brand.primary,
  },
  purchaseCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    ...shadows.card,
  },
  purchaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  purchaseHeaderLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  purchaseMedicineName: {
    ...typography.presets.cardTitle,
    color: colors.text.primary,
  },
  purchaseInvoice: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  purchaseAmount: {
    ...typography.presets.cardTitle,
    color: colors.brand.primaryDark,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.md,
  },
  purchaseDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  purchaseDetailItem: {
    flex: 1,
  },
  purchaseDetailLabel: {
    ...typography.presets.micro,
    color: colors.text.muted,
    marginBottom: spacing.xxs,
  },
  purchaseDetailValue: {
    ...typography.presets.bodySmallStrong,
    color: colors.text.primary,
  },
});
