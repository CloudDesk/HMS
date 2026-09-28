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
  type PortalInvoiceDetails,
  type PortalInvoiceSummaryItem,
} from '../../billing/contracts';
import { PatientContextSelector } from '../components/PatientContextSelector';
import { InvoiceDetailsModal } from '../components/InvoiceDetailsModal';
import { AppHeader } from '../components/AppHeader';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge, type StatusVariant } from '../components/StatusBadge';
import { colors, radius, shadows, spacing, typography } from '../theme';

type FilterTab = 'all' | 'outstanding' | 'paid';

interface BillingScreenProps {
  onNavigateBack?: () => void;
}

const getInvoiceBadgeVariant = (status: string): StatusVariant => {
  switch (status.toUpperCase()) {
    case 'PAID':
      return 'success';
    case 'PARTIALLY_PAID':
      return 'warning';
    case 'UNPAID':
    case 'OVERDUE':
      return 'danger';
    default:
      return 'neutral';
  }
};

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
            : 'Unable to load itemized invoice details.';
        setModalError(msg);
      } finally {
        setIsModalLoading(false);
      }
    },
    [billingApi, selectedPatientId]
  );

  // Calculate totals
  const totalBilled = invoices.reduce((acc, inv) => acc + (inv.total_amount || 0), 0);
  const totalPaid = invoices.reduce((acc, inv) => acc + (inv.paid_amount || 0), 0);
  const totalOutstanding = invoices.reduce((acc, inv) => acc + (inv.balance_amount || 0), 0);

  const filteredInvoices = invoices.filter((inv) => {
    if (activeFilter === 'outstanding') {
      return inv.balance_amount > 0;
    }
    if (activeFilter === 'paid') {
      return inv.balance_amount === 0 || inv.status === 'PAID';
    }
    return true;
  });

  return (
    <View style={styles.screenContainer}>
      <AppHeader
        title="Billing & Invoices"
        subtitle={`Financial statements for ${selectedPatient?.full_name ?? 'selected profile'}`}
        onBack={onNavigateBack}
      />

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadBillingData(true)}
            colors={[colors.brand.primary]}
            tintColor={colors.brand.primary}
          />
        }
      >
        {/* Patient Switcher */}
        <PatientContextSelector />

        {/* Financial Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Account Balance Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryColLabel}>Total Billed</Text>
              <Text style={styles.summaryColValue}>{formatCurrency(totalBilled)}</Text>
            </View>
            <View style={styles.summaryColDivider} />
            <View style={styles.summaryCol}>
              <Text style={styles.summaryColLabel}>Paid</Text>
              <Text style={[styles.summaryColValue, { color: colors.status.success }]}>
                {formatCurrency(totalPaid)}
              </Text>
            </View>
            <View style={styles.summaryColDivider} />
            <View style={styles.summaryCol}>
              <Text style={styles.summaryColLabel}>Outstanding</Text>
              <Text
                style={[
                  styles.summaryColValue,
                  totalOutstanding > 0 ? { color: colors.status.danger } : undefined,
                ]}
              >
                {formatCurrency(totalOutstanding)}
              </Text>
            </View>
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeFilter === 'all' && styles.tabButtonActive]}
            onPress={() => setActiveFilter('all')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeFilter === 'all' && styles.tabTextActive]}>
              All ({invoices.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeFilter === 'outstanding' && styles.tabButtonActive]}
            onPress={() => setActiveFilter('outstanding')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                activeFilter === 'outstanding' && styles.tabTextActive,
              ]}
            >
              Outstanding ({invoices.filter((i) => i.balance_amount > 0).length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeFilter === 'paid' && styles.tabButtonActive]}
            onPress={() => setActiveFilter('paid')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeFilter === 'paid' && styles.tabTextActive]}>
              Settled ({invoices.filter((i) => i.balance_amount === 0 || i.status === 'PAID').length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Loading State */}
        {isLoading && !isRefreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color={colors.brand.primary} />
            <Text style={styles.loadingText}>Loading hospital invoices...</Text>
          </View>
        ) : null}

        {/* Error State */}
        {error && !isLoading ? (
          <EmptyState
            icon="⚠️"
            title="Unable to Load Invoices"
            description={error}
            actionLabel="Try Again"
            onAction={() => loadBillingData()}
          />
        ) : null}

        {/* Invoices List */}
        {!isLoading && !error && filteredInvoices.length === 0 ? (
          <EmptyState
            icon="🧾"
            title="No Invoices Found"
            description={
              activeFilter === 'outstanding'
                ? 'Great news! You have no outstanding bills pending payment.'
                : 'No invoice records available for this patient profile.'
            }
          />
        ) : null}

        {!isLoading && !error && filteredInvoices.length > 0 ? (
          <View style={styles.listContainer}>
            {filteredInvoices.map((inv) => (
              <TouchableOpacity
                key={inv.id}
                style={styles.card}
                onPress={() => void handleOpenInvoice(inv)}
                activeOpacity={0.75}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Text style={styles.invoiceNumber}>Invoice #{inv.invoice_number}</Text>
                    <Text style={styles.invoiceDate}>
                      📅 {formatInvoiceDate(inv.invoice_date)}
                    </Text>
                  </View>
                  <StatusBadge
                    label={getInvoiceStatusLabel(inv.status)}
                    variant={getInvoiceBadgeVariant(inv.status)}
                  />
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.amountGrid}>
                  <View style={styles.amountCol}>
                    <Text style={styles.amountLabel}>Total Bill</Text>
                    <Text style={styles.amountValue}>{formatCurrency(inv.total_amount)}</Text>
                  </View>
                  <View style={styles.amountCol}>
                    <Text style={styles.amountLabel}>Paid</Text>
                    <Text style={[styles.amountValue, { color: colors.status.success }]}>
                      {formatCurrency(inv.paid_amount)}
                    </Text>
                  </View>
                  <View style={styles.amountCol}>
                    <Text style={styles.amountLabel}>Balance</Text>
                    <Text
                      style={[
                        styles.amountValue,
                        inv.balance_amount > 0 ? { color: colors.status.danger } : undefined,
                      ]}
                    >
                      {formatCurrency(inv.balance_amount)}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.itemsCount}>
                    {inv.balance_amount > 0 ? 'Payment Due' : 'Fully Paid'}
                  </Text>
                  <Text style={styles.viewDetailsText}>View Statement →</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {/* Invoice Details Modal */}
      <InvoiceDetailsModal
        invoice={invoiceDetails}
        isLoading={isModalLoading}
        error={modalError}
        visible={Boolean(selectedInvoiceSummary)}
        onClose={() => {
          setSelectedInvoiceSummary(null);
          setInvoiceDetails(null);
          setModalError(null);
        }}
        onRetry={() => {
          if (selectedInvoiceSummary) {
            void handleOpenInvoice(selectedInvoiceSummary);
          }
        }}
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
  summaryCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.xl,
    ...shadows.card,
  },
  summaryTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  summaryGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  summaryColDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border.subtle,
  },
  summaryColLabel: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    marginBottom: spacing.xxs,
  },
  summaryColValue: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
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
    fontSize: typography.size.xs + 1,
    fontWeight: typography.weight.medium,
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
    fontSize: typography.size.sm,
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
  invoiceNumber: {
    fontSize: typography.size.md + 1,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
  },
  invoiceDate: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.md,
  },
  amountGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.neutral.surfaceSubtle,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  amountCol: {
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 10,
    color: colors.text.muted,
    textTransform: 'uppercase',
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xxs,
  },
  amountValue: {
    fontSize: typography.size.sm + 1,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
  },
  itemsCount: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
  },
  viewDetailsText: {
    fontSize: typography.size.xs + 1,
    color: colors.brand.primary,
    fontWeight: typography.weight.semibold,
  },
});
