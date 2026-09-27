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
import { BillingApi } from '../../billing/billing-api';
import {
  formatCurrency,
  formatInvoiceDate,
  getInvoiceStatusLabel,
  getInvoiceStatusStyle,
  type PortalInvoiceDetails,
  type PortalInvoiceSummaryItem,
} from '../../billing/contracts';
import { PatientContextSelector } from '../components/PatientContextSelector';
import { InvoiceDetailsModal } from '../components/InvoiceDetailsModal';

type FilterTab = 'all' | 'outstanding' | 'paid';

interface BillingScreenProps {
  onNavigateBack?: () => void;
}

export function BillingScreen({ onNavigateBack }: BillingScreenProps) {
  const { manager } = useAuth();
  const { selectedPatient, selectedPatientId } = usePatient();

  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [invoices, setInvoices] = useState<PortalInvoiceSummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [selectedInvoiceSummary, setSelectedInvoiceSummary] =
    useState<PortalInvoiceSummaryItem | null>(null);
  const [invoiceDetails, setInvoiceDetails] = useState<PortalInvoiceDetails | null>(
    null
  );
  const [isModalLoading, setIsModalLoading] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const billingApi = useMemo(() => new BillingApi(manager), [manager]);

  const loadBillingData = useCallback(
    async (isRefresh = false) => {
      if (!selectedPatientId) return;

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const result = await billingApi.getBillingOverview(selectedPatientId);
        setInvoices(result.invoices);
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Unable to load hospital invoices. Please retry.';
        setError(msg);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [billingApi, selectedPatientId]
  );

  // Clear stale data and reload immediately on patient context change
  useEffect(() => {
    setInvoices([]);
    setSelectedInvoiceSummary(null);
    setInvoiceDetails(null);
    setModalError(null);
    if (selectedPatientId) {
      void loadBillingData(false);
    }
  }, [selectedPatientId, loadBillingData]);

  const handleOpenInvoice = useCallback(
    async (invoice: PortalInvoiceSummaryItem) => {
      if (!selectedPatientId) return;
      setSelectedInvoiceSummary(invoice);
      setInvoiceDetails(null);
      setModalError(null);
      setIsModalLoading(true);

      try {
        const details = await billingApi.getInvoiceDetails(
          selectedPatientId,
          invoice.id
        );
        setInvoiceDetails(details);
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Unable to load detailed invoice receipt.';
        setModalError(msg);
      } finally {
        setIsModalLoading(false);
      }
    },
    [billingApi, selectedPatientId]
  );

  const handleCloseModal = () => {
    setSelectedInvoiceSummary(null);
    setInvoiceDetails(null);
    setModalError(null);
  };

  const handleRetryModal = () => {
    if (selectedInvoiceSummary) {
      void handleOpenInvoice(selectedInvoiceSummary);
    }
  };

  // Financial aggregates calculated from authoritative invoice amounts
  const financialTotals = useMemo(() => {
    return invoices.reduce(
      (totals, inv) => ({
        billed: totals.billed + inv.total_amount,
        paid: totals.paid + inv.paid_amount,
        due: totals.due + inv.balance_amount,
      }),
      { billed: 0, paid: 0, due: 0 }
    );
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    if (activeFilter === 'outstanding') {
      return invoices.filter((inv) => inv.balance_amount > 0);
    }
    if (activeFilter === 'paid') {
      return invoices.filter(
        (inv) => inv.balance_amount <= 0 || inv.status === 'PAID'
      );
    }
    return invoices;
  }, [invoices, activeFilter]);

  const outstandingCount = useMemo(
    () => invoices.filter((inv) => inv.balance_amount > 0).length,
    [invoices]
  );
  const paidCount = useMemo(
    () =>
      invoices.filter((inv) => inv.balance_amount <= 0 || inv.status === 'PAID')
        .length,
    [invoices]
  );

  return (
    <View style={styles.screenContainer}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadBillingData(true)}
            colors={['#0284C7']}
            tintColor="#0284C7"
          />
        }
      >
        {/* Screen Header */}
        <View style={styles.header}>
          {onNavigateBack ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onNavigateBack}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
          ) : null}
          <View style={styles.headerTitleWrap}>
            <Text style={styles.screenTitle}>Billing & Invoices</Text>
            <Text style={styles.screenSubtitle}>
              Review hospital bills, payment records & outstanding amounts
            </Text>
          </View>
        </View>

        {/* Patient Context Selector */}
        <PatientContextSelector />

        {/* Financial Summary Aggregates */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardIcon}>🧾</Text>
            <Text style={styles.summaryCardLabel}>Total Billed</Text>
            <Text style={styles.summaryCardValue}>
              {formatCurrency(financialTotals.billed)}
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardIcon}>✅</Text>
            <Text style={styles.summaryCardLabel}>Total Paid</Text>
            <Text style={[styles.summaryCardValue, styles.paidValueColor]}>
              {formatCurrency(financialTotals.paid)}
            </Text>
          </View>

          <View
            style={[
              styles.summaryCard,
              financialTotals.due > 0
                ? styles.dueSummaryCard
                : styles.settledSummaryCard,
            ]}
          >
            <Text style={styles.summaryCardIcon}>
              {financialTotals.due > 0 ? '⚠️' : '🛡️'}
            </Text>
            <Text style={styles.summaryCardLabel}>
              {financialTotals.due > 0 ? 'Amount Due' : 'Account Status'}
            </Text>
            <Text
              style={[
                styles.summaryCardValue,
                financialTotals.due > 0
                  ? styles.dueValueColor
                  : styles.settledValueColor,
              ]}
            >
              {financialTotals.due > 0
                ? formatCurrency(financialTotals.due)
                : 'Paid in full'}
            </Text>
          </View>
        </View>

        {/* Filter Segment Tabs */}
        <View style={styles.filterTabs}>
          <TouchableOpacity
            style={[
              styles.filterTab,
              activeFilter === 'all' && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter('all')}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === 'all' && styles.filterTabTextActive,
              ]}
            >
              All Invoices ({invoices.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterTab,
              activeFilter === 'outstanding' && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter('outstanding')}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === 'outstanding' && styles.filterTabTextActive,
              ]}
            >
              Outstanding ({outstandingCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterTab,
              activeFilter === 'paid' && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter('paid')}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === 'paid' && styles.filterTabTextActive,
              ]}
            >
              Paid ({paidCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Invoices List */}
        {isLoading && !isRefreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0284C7" />
            <Text style={styles.loadingText}>Loading hospital invoices…</Text>
          </View>
        ) : error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Unable to Load Invoices</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => loadBillingData(false)}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : filteredInvoices.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🧾</Text>
            <Text style={styles.emptyTitle}>
              {activeFilter === 'outstanding'
                ? 'No Outstanding Invoices'
                : activeFilter === 'paid'
                ? 'No Paid Invoices'
                : 'No Invoices Issued'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter === 'outstanding'
                ? `All issued invoices for ${selectedPatient?.full_name ?? 'this patient'} have been settled.`
                : activeFilter === 'paid'
                ? 'Settled hospital invoices will appear here once paid.'
                : 'Hospital billing invoices will appear here once issued by the hospital.'}
            </Text>
          </View>
        ) : (
          <View style={styles.invoicesList}>
            {filteredInvoices.map((inv) => {
              const isPaid = inv.balance_amount <= 0 || inv.status === 'PAID';
              const progress =
                inv.total_amount > 0
                  ? Math.min(
                      100,
                      Math.round((inv.paid_amount / inv.total_amount) * 100)
                    )
                  : 100;
              const statusStyle = getInvoiceStatusStyle(inv.status);

              return (
                <View key={inv.id} style={styles.invoiceCard}>
                  {/* Card Head */}
                  <View style={styles.cardHead}>
                    <View style={styles.iconCircle}>
                      <Text style={styles.cardHeadIcon}>🧾</Text>
                    </View>
                    <View style={styles.cardHeadInfo}>
                      <Text style={styles.invoiceNumber}>{inv.invoice_number}</Text>
                      <Text style={styles.invoiceDate}>
                        Issued {formatInvoiceDate(inv.invoice_date)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: statusStyle.bg,
                          borderColor: statusStyle.border,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.statusBadgeText, { color: statusStyle.text }]}
                      >
                        {getInvoiceStatusLabel(inv.status)}
                      </Text>
                    </View>
                  </View>

                  {/* Amounts Grid */}
                  <View style={styles.amountsGrid}>
                    <View style={styles.amountItem}>
                      <Text style={styles.amountLabel}>Total Billed</Text>
                      <Text style={styles.amountValue}>
                        {formatCurrency(inv.total_amount)}
                      </Text>
                    </View>

                    <View style={styles.amountItem}>
                      <Text style={styles.amountLabel}>Paid</Text>
                      <Text style={[styles.amountValue, styles.amountPaidValue]}>
                        {formatCurrency(inv.paid_amount)}
                      </Text>
                    </View>

                    <View style={styles.amountItem}>
                      <Text style={styles.amountLabel}>
                        {isPaid ? 'Status' : 'Amount Due'}
                      </Text>
                      <Text
                        style={[
                          styles.amountValue,
                          isPaid ? styles.amountSettledValue : styles.amountDueValue,
                        ]}
                      >
                        {isPaid ? 'Paid in full' : formatCurrency(inv.balance_amount)}
                      </Text>
                    </View>
                  </View>

                  {/* Payment Progress Bar */}
                  <View style={styles.progressBarContainer}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${progress}%`,
                          backgroundColor: isPaid ? '#16A34A' : '#0284C7',
                        },
                      ]}
                    />
                  </View>

                  {/* Card Footer */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.footerNote}>
                      {isPaid
                        ? 'No payment currently required.'
                        : `${formatCurrency(inv.balance_amount)} outstanding.`}
                    </Text>
                    <TouchableOpacity
                      style={styles.viewDetailsButton}
                      onPress={() => void handleOpenInvoice(inv)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.viewDetailsText}>View Invoice →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Invoice Details Modal */}
      <InvoiceDetailsModal
        visible={Boolean(selectedInvoiceSummary)}
        onClose={handleCloseModal}
        invoice={invoiceDetails}
        isLoading={isModalLoading}
        error={modalError}
        onRetry={handleRetryModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerTitleWrap: {
    flex: 1,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  screenSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  dueSummaryCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  settledSummaryCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  summaryCardIcon: {
    fontSize: 16,
    marginBottom: 4,
  },
  summaryCardLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 2,
  },
  summaryCardValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  paidValueColor: {
    color: '#16A34A',
  },
  dueValueColor: {
    color: '#DC2626',
  },
  settledValueColor: {
    color: '#166534',
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  filterTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterTabTextActive: {
    color: '#0284C7',
    fontWeight: '700',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  errorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
    marginVertical: 12,
  },
  errorIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
  invoicesList: {
    gap: 12,
  },
  invoiceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardHeadIcon: {
    fontSize: 18,
  },
  cardHeadInfo: {
    flex: 1,
  },
  invoiceNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  invoiceDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  amountsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  amountItem: {
    flex: 1,
  },
  amountLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  amountValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  amountPaidValue: {
    color: '#0284C7',
  },
  amountDueValue: {
    color: '#DC2626',
  },
  amountSettledValue: {
    color: '#166534',
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  footerNote: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
    marginRight: 8,
  },
  viewDetailsButton: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  viewDetailsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
});
