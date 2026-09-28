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
  type DentalQuotation,
} from '../../dental/contracts';
import { formatInvoiceDate } from '../../billing/contracts';
import { PatientContextSelector } from '../components/PatientContextSelector';
import { DentalQuotationDetailsModal } from '../components/DentalQuotationDetailsModal';
import { AppHeader } from '../components/AppHeader';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge, type StatusVariant } from '../components/StatusBadge';
import { colors, radius, shadows, spacing, typography } from '../theme';

type DentalFilterTab = 'ALL' | 'PENDING' | 'ACCEPTED';

interface DentalScreenProps {
  onNavigateBack?: () => void;
}

const getDentalBadgeVariant = (status: string): StatusVariant => {
  switch (status.toUpperCase()) {
    case 'ACCEPTED':
      return 'success';
    case 'PRESENTED':
    case 'PENDING':
    case 'DRAFT':
      return 'warning';
    case 'REJECTED':
    case 'EXPIRED':
      return 'danger';
    default:
      return 'neutral';
  }
};

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
    const updated = await api.rejectQuotation(quotationId, {
      reason,
    });
    setQuotations((prev) =>
      prev.map((q) => (q.id === quotationId ? updated : q))
    );
    setSelectedQuote(updated);
  };

  const filteredQuotations = useMemo(() => {
    if (activeFilter === 'ALL') return quotations;
    if (activeFilter === 'PENDING') {
      return quotations.filter((q) =>
        ['DRAFT', 'PRESENTED'].includes(q.status)
      );
    }
    if (activeFilter === 'ACCEPTED') {
      return quotations.filter((q) => q.status === 'ACCEPTED');
    }
    return quotations;
  }, [quotations, activeFilter]);

  return (
    <View style={styles.screenContainer}>
      <AppHeader
        title="Dental Treatment Plans"
        subtitle={`Proposed dental procedures & cost estimates for ${selectedPatient?.full_name ?? 'selected profile'}`}
        onBack={onNavigateBack}
      />

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadQuotations(true)}
            colors={[colors.brand.primary]}
            tintColor={colors.brand.primary}
          />
        }
      >
        {/* Patient Switcher */}
        <PatientContextSelector />

        {/* Filter Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeFilter === 'ALL' && styles.tabButtonActive]}
            onPress={() => setActiveFilter('ALL')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeFilter === 'ALL' && styles.tabTextActive]}>
              All ({quotations.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeFilter === 'PENDING' && styles.tabButtonActive]}
            onPress={() => setActiveFilter('PENDING')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeFilter === 'PENDING' && styles.tabTextActive]}>
              Pending ({quotations.filter((q) => ['DRAFT', 'PRESENTED'].includes(q.status)).length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeFilter === 'ACCEPTED' && styles.tabButtonActive]}
            onPress={() => setActiveFilter('ACCEPTED')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeFilter === 'ACCEPTED' && styles.tabTextActive]}>
              Accepted ({quotations.filter((q) => q.status === 'ACCEPTED').length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Loading State */}
        {isLoading && !isRefreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color={colors.brand.primary} />
            <Text style={styles.loadingText}>Loading dental plans...</Text>
          </View>
        ) : null}

        {/* Error State */}
        {error && !isLoading ? (
          <EmptyState
            icon="⚠️"
            title="Unable to Load Dental Plans"
            description={error}
            actionLabel="Try Again"
            onAction={() => loadQuotations()}
          />
        ) : null}

        {/* Empty State */}
        {!isLoading && !error && filteredQuotations.length === 0 ? (
          <EmptyState
            icon="🦷"
            title="No Dental Plans Found"
            description="Proposed dental care plans and cost estimates will appear here after your dental consultation."
          />
        ) : null}

        {/* Quotations List */}
        {!isLoading && !error && filteredQuotations.length > 0 ? (
          <View style={styles.listContainer}>
            {filteredQuotations.map((quote) => (
              <TouchableOpacity
                key={quote.id}
                style={styles.card}
                onPress={() => setSelectedQuote(quote)}
                activeOpacity={0.75}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Text style={styles.quoteTitle}>
                      {quote.selected_option_name || `Dental Plan #${quote.quotation_number}`}
                    </Text>
                    <Text style={styles.quoteNum}>Quotation #{quote.quotation_number}</Text>
                  </View>
                  <StatusBadge
                    label={getDentalStatusLabel(quote.status)}
                    variant={getDentalBadgeVariant(quote.status)}
                  />
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.detailsRow}>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>Doctor</Text>
                    <Text style={styles.detailValue}>Dr. {quote.doctor_name}</Text>
                  </View>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>Estimated Cost</Text>
                    <Text style={[styles.detailValue, styles.costValue]}>
                      {formatDentalCurrency(quote.total)}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.dateText}>
                    📅 Created {formatInvoiceDate(quote.created_at)}
                  </Text>
                  <Text style={styles.viewPlanText}>View Options →</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {/* Quotation Details Modal */}
      <DentalQuotationDetailsModal
        quotation={selectedQuote}
        visible={Boolean(selectedQuote)}
        onClose={() => setSelectedQuote(null)}
        onAccept={handleAcceptQuotation}
        onReject={handleRejectQuotation}
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
  quoteTitle: {
    ...typography.presets.cardTitle,
    color: colors.text.primary,
  },
  quoteNum: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.md,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailCol: {
    flex: 1,
  },
  detailLabel: {
    ...typography.presets.micro,
    color: colors.text.muted,
    marginBottom: spacing.xxs,
  },
  detailValue: {
    ...typography.presets.bodySmallStrong,
    color: colors.text.primary,
  },
  costValue: {
    color: colors.brand.primaryDark,
    fontWeight: typography.weight.bold,
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
  dateText: {
    ...typography.presets.captionMedium,
    color: colors.text.muted,
  },
  viewPlanText: {
    ...typography.presets.captionStrong,
    color: colors.brand.primary,
  },
});
