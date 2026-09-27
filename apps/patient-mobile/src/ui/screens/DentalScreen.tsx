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
import { DentalApi } from '../../dental/dental-api';
import {
  formatDentalCurrency,
  getDentalStatusLabel,
  getDentalStatusStyle,
  type DentalQuotation,
} from '../../dental/contracts';
import { formatInvoiceDate } from '../../billing/contracts';
import { PatientContextSelector } from '../components/PatientContextSelector';
import { DentalQuotationDetailsModal } from '../components/DentalQuotationDetailsModal';

type DentalFilterTab = 'ALL' | 'PENDING' | 'ACCEPTED';

interface DentalScreenProps {
  onNavigateBack?: () => void;
}

export function DentalScreen({ onNavigateBack }: DentalScreenProps) {
  const { manager } = useAuth();
  const { selectedPatient, selectedPatientId } = usePatient();

  const [activeFilter, setActiveFilter] = useState<DentalFilterTab>('ALL');
  const [quotations, setQuotations] = useState<DentalQuotation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Selected quotation for modal
  const [selectedQuote, setSelectedQuote] = useState<DentalQuotation | null>(null);

  const api = useMemo(() => new DentalApi(manager), [manager]);

  const loadQuotations = useCallback(
    async (isRefresh = false) => {
      if (!selectedPatientId) return;

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const result = await api.listQuotations(selectedPatientId);
        setQuotations(result);
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Unable to load dental treatment quotations. Please retry.';
        setError(msg);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [api, selectedPatientId]
  );

  // Clear stale quotations immediately on patient context change
  useEffect(() => {
    setQuotations([]);
    setSelectedQuote(null);
    if (selectedPatientId) {
      void loadQuotations(false);
    }
  }, [selectedPatientId, loadQuotations]);

  const handleAcceptQuotation = async (
    quotationId: string,
    optionId: string,
    notes?: string
  ) => {
    const updated = await api.acceptQuotation(quotationId, {
      selected_option_id: optionId,
      notes,
    });
    setQuotations((prev) =>
      prev.map((q) => (q.id === quotationId ? updated : q))
    );
    setSelectedQuote(updated);
  };

  const handleRejectQuotation = async (
    quotationId: string,
    reason?: string
  ) => {
    const updated = await api.rejectQuotation(quotationId, { reason });
    setQuotations((prev) =>
      prev.map((q) => (q.id === quotationId ? updated : q))
    );
    setSelectedQuote(updated);
  };

  const handlePostponeQuotation = async (
    quotationId: string,
    reason?: string
  ) => {
    const updated = await api.postponeQuotation(quotationId, { reason });
    setQuotations((prev) =>
      prev.map((q) => (q.id === quotationId ? updated : q))
    );
    setSelectedQuote(updated);
  };

  const pendingCount = useMemo(
    () =>
      quotations.filter((q) => q.status === 'SENT' || q.status === 'POSTPONED')
        .length,
    [quotations]
  );
  const acceptedCount = useMemo(
    () => quotations.filter((q) => q.status === 'ACCEPTED').length,
    [quotations]
  );

  const filteredQuotations = useMemo(() => {
    if (activeFilter === 'PENDING') {
      return quotations.filter(
        (q) => q.status === 'SENT' || q.status === 'POSTPONED'
      );
    }
    if (activeFilter === 'ACCEPTED') {
      return quotations.filter((q) => q.status === 'ACCEPTED');
    }
    return quotations;
  }, [quotations, activeFilter]);

  return (
    <View style={styles.screenContainer}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadQuotations(true)}
            colors={['#0284C7']}
            tintColor="#0284C7"
          />
        }
      >
        {/* Header */}
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
            <Text style={styles.screenTitle}>Dental Treatment Plans</Text>
            <Text style={styles.screenSubtitle}>
              Review proposed dental procedures, estimates & treatment options
            </Text>
          </View>
        </View>

        {/* Patient Context Selector */}
        <PatientContextSelector />

        {/* Filter Tabs */}
        <View style={styles.filterTabs}>
          <TouchableOpacity
            style={[
              styles.filterTab,
              activeFilter === 'ALL' && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter('ALL')}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === 'ALL' && styles.filterTabTextActive,
              ]}
            >
              All ({quotations.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterTab,
              activeFilter === 'PENDING' && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter('PENDING')}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === 'PENDING' && styles.filterTabTextActive,
              ]}
            >
              Pending Decision ({pendingCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterTab,
              activeFilter === 'ACCEPTED' && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter('ACCEPTED')}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === 'ACCEPTED' && styles.filterTabTextActive,
              ]}
            >
              Accepted ({acceptedCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quotations List */}
        {isLoading && !isRefreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0284C7" />
            <Text style={styles.loadingText}>
              Loading dental treatment quotations…
            </Text>
          </View>
        ) : error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Unable to Load Quotations</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => loadQuotations(false)}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : filteredQuotations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🦷</Text>
            <Text style={styles.emptyTitle}>
              {activeFilter === 'PENDING'
                ? 'No Pending Decisions'
                : activeFilter === 'ACCEPTED'
                ? 'No Accepted Plans'
                : 'No Treatment Quotations'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter === 'ALL'
                ? `When your dental care team prepares and sends a formal treatment plan for ${
                    selectedPatient?.full_name ?? 'this patient'
                  }, it will appear here for review.`
                : activeFilter === 'PENDING'
                ? 'All current dental quotations have been responded to.'
                : 'Accepted dental treatment plans will appear here.'}
            </Text>
          </View>
        ) : (
          <View style={styles.quotesList}>
            {filteredQuotations.map((quote) => {
              const statusStyle = getDentalStatusStyle(quote.status);
              const optionsCount = quote.options?.length ?? 0;
              const itemsCount =
                quote.options?.[0]?.items?.length ?? quote.items.length;

              const minTotal =
                quote.options && quote.options.length > 0
                  ? Math.min(...quote.options.map((o) => o.total))
                  : quote.total;
              const maxTotal =
                quote.options && quote.options.length > 0
                  ? Math.max(...quote.options.map((o) => o.total))
                  : quote.total;

              const priceText =
                minTotal === maxTotal
                  ? formatDentalCurrency(minTotal, quote.currency)
                  : `${formatDentalCurrency(
                      minTotal,
                      quote.currency
                    )} - ${formatDentalCurrency(maxTotal, quote.currency)}`;

              return (
                <View key={quote.id} style={styles.quoteCard}>
                  <View style={styles.quoteHead}>
                    <View style={styles.iconCircle}>
                      <Text style={styles.quoteIcon}>🦷</Text>
                    </View>
                    <View style={styles.quoteHeadInfo}>
                      <Text style={styles.quoteDoctor}>
                        {quote.doctor_name
                          ? `Dr. ${quote.doctor_name.replace(/^dr\.?\s+/i, '')}`
                          : 'Dentist'}
                      </Text>
                      <Text style={styles.quoteNumber}>
                        {quote.quotation_number}
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
                        style={[
                          styles.statusBadgeText,
                          { color: statusStyle.text },
                        ]}
                      >
                        {getDentalStatusLabel(quote.status)}
                      </Text>
                    </View>
                  </View>

                  {/* Financial & Items Summary */}
                  <View style={styles.amountsCard}>
                    <View style={styles.amountBlock}>
                      <Text style={styles.amountLabel}>Estimated Total</Text>
                      <Text style={styles.amountValue}>{priceText}</Text>
                    </View>
                    <View style={styles.badgeGroup}>
                      {optionsCount > 1 ? (
                        <View style={styles.detailBadge}>
                          <Text style={styles.detailBadgeText}>
                            {optionsCount} Options
                          </Text>
                        </View>
                      ) : null}
                      <View style={styles.detailBadge}>
                        <Text style={styles.detailBadgeText}>
                          {itemsCount} {itemsCount === 1 ? 'Procedure' : 'Procedures'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>
                      📅 Issued {formatInvoiceDate(quote.created_at)}
                    </Text>
                    {quote.valid_until ? (
                      <Text style={styles.metaText}>
                        ⏳ Valid until {formatInvoiceDate(quote.valid_until)}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.quoteFooter}>
                    <Text style={styles.footerNote}>
                      {quote.status === 'SENT' || quote.status === 'POSTPONED'
                        ? 'Requires your decision'
                        : quote.status === 'ACCEPTED'
                        ? 'Treatment plan accepted'
                        : 'Plan completed / closed'}
                    </Text>
                    <TouchableOpacity
                      style={styles.viewPlanButton}
                      onPress={() => setSelectedQuote(quote)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.viewPlanText}>View Treatment Plan →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Quotation Details Modal */}
      <DentalQuotationDetailsModal
        visible={Boolean(selectedQuote)}
        onClose={() => setSelectedQuote(null)}
        quotation={selectedQuote}
        onAccept={handleAcceptQuotation}
        onReject={handleRejectQuotation}
        onPostpone={handlePostponeQuotation}
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
    fontSize: 11,
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
  quotesList: {
    gap: 12,
  },
  quoteCard: {
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
  quoteHead: {
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
  quoteIcon: {
    fontSize: 18,
  },
  quoteHeadInfo: {
    flex: 1,
  },
  quoteDoctor: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '700',
  },
  quoteNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  amountsCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  amountBlock: {
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
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  badgeGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  detailBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  detailBadgeText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 10,
  },
  metaText: {
    fontSize: 11,
    color: '#64748B',
  },
  quoteFooter: {
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
  viewPlanButton: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  viewPlanText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
});
