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
  prescriptionStatusBadge,
} from '../components/PrescriptionDetailsModal';

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

  // Clear data immediately when patient context changes to prevent stale leak
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
            colors={['#0284C7']}
            tintColor="#0284C7"
          />
        }
      >
        {/* Header Title */}
        <View style={styles.header}>
          <Text style={styles.title}>Prescriptions & Medicines</Text>
          <Text style={styles.subtitle}>
            Clinical prescriptions and pharmacy dispensing records for{' '}
            {selectedPatient?.full_name ?? 'selected patient'}
          </Text>
        </View>

        {/* Patient Switcher */}
        <PatientContextSelector />

        {/* Section Tabs (Prescriptions / Pharmacy Purchases) */}
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
            <ActivityIndicator size="large" color="#0284C7" />
            <Text style={styles.loadingText}>Loading medication records…</Text>
          </View>
        ) : null}

        {/* Error State */}
        {error && !isLoading ? (
          <View style={styles.centerContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Unable to Load</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => loadData()}>
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Prescriptions Section Content */}
        {!isLoading && !error && activeSection === 'prescriptions' ? (
          prescriptions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>💊</Text>
              <Text style={styles.emptyTitle}>No Prescriptions Available</Text>
              <Text style={styles.emptySubtitle}>
                Doctor-issued prescriptions will appear here after your clinical consultation.
              </Text>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {prescriptions.map((prescription) => {
                const status = prescriptionStatusBadge(prescription.status);
                const cleanDoctor = prescription.doctor_name.replace(/^Dr\.?\s+/i, '');

                return (
                  <TouchableOpacity
                    key={prescription.id}
                    style={styles.card}
                    onPress={() => setSelectedPrescription(prescription)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        <Text style={styles.doctorName}>Dr. {cleanDoctor}</Text>
                        <Text style={styles.dateText}>
                          📅 Issued on {formatDateTime(prescription.submitted_at)}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                        <Text style={[styles.statusText, { color: status.text }]}>
                          {status.label}
                        </Text>
                      </View>
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
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🧾</Text>
              <Text style={styles.emptyTitle}>No Pharmacy Purchases</Text>
              <Text style={styles.emptySubtitle}>
                Medicines dispensed and billed by the hospital pharmacy will appear here.
              </Text>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {purchasedMedicines.map((purchase) => (
                <View key={purchase.id} style={styles.purchaseCard}>
                  <View style={styles.purchaseHeader}>
                    <View style={styles.purchaseHeaderLeft}>
                      <Text style={styles.purchaseMedicineName}>{purchase.medicine_name}</Text>
                      <Text style={styles.purchaseInvoice}>
                        🧾 Invoice: {purchase.invoice_number} · 📅{' '}
                        {formatDateTime(purchase.purchased_at)}
                      </Text>
                    </View>
                    <Text style={styles.purchaseAmount}>
                      {formatCurrency(purchase.total_amount)}
                    </Text>
                  </View>

                  <View style={styles.purchaseFooter}>
                    <Text style={styles.purchaseQty}>
                      Quantity: <Text style={styles.purchaseQtyValue}>{purchase.quantity}</Text>
                      {purchase.branch ? ` · ${purchase.branch.name}` : ''}
                    </Text>
                    <View style={styles.purchaseBadge}>
                      <Text style={styles.purchaseBadgeText}>{purchase.payment_status}</Text>
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
    backgroundColor: '#F8FAFC',
  },
  container: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  header: {
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
    lineHeight: 18,
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
    fontSize: 13,
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
    lineHeight: 18,
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
    marginBottom: 12,
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
  dateText: {
    fontSize: 12,
    color: '#64748B',
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
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  medChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    maxWidth: '85%',
  },
  medChipIcon: {
    fontSize: 11,
    marginRight: 4,
  },
  medChipText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  moreChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    justifyContent: 'center',
  },
  moreChipText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  medicinesCountText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  viewDetailsText: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '600',
  },
  purchaseCard: {
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
  purchaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  purchaseHeaderLeft: {
    flex: 1,
    marginRight: 10,
  },
  purchaseMedicineName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  purchaseInvoice: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  purchaseAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  purchaseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  purchaseQty: {
    fontSize: 12,
    color: '#64748B',
  },
  purchaseQtyValue: {
    fontWeight: '700',
    color: '#1E293B',
  },
  purchaseBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  purchaseBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
    textTransform: 'uppercase',
  },
});
