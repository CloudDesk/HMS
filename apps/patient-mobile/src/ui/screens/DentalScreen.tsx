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
  formatToothDescription,
  getDentalStatusLabel,
  getStageBadgeVariant,
  getStageStatusLabel,
  type DentalQuotation,
  type PatientDentalStage,
} from '../../dental/contracts';
import { formatInvoiceDate } from '../../billing/contracts';
import { PatientContextSelector } from '../components/PatientContextSelector';
import { DentalQuotationDetailsModal } from '../components/DentalQuotationDetailsModal';
import { AppHeader } from '../components/AppHeader';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge, type StatusVariant } from '../components/StatusBadge';
import { colors, radius, shadows, spacing, typography } from '../theme';

type DentalMainView = 'STAGES' | 'QUOTATIONS';
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

  const [mainView, setMainView] = useState<DentalMainView>('STAGES');
  const [activeFilter, setActiveFilter] = useState<DentalFilterTab>('ALL');

  const [quotations, setQuotations] = useState<DentalQuotation[]>([]);
  const [stages, setStages] = useState<PatientDentalStage[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Selected quotation for modal
  const [selectedQuote, setSelectedQuote] = useState<DentalQuotation | null>(null);

  const api = useMemo(() => new DentalApi(manager), [manager]);

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
        const [quotesRes, stagesRes] = await Promise.all([
          api.listQuotations(selectedPatientId).catch(() => []),
          api.listPatientStages(selectedPatientId).catch(() => []),
        ]);
        setQuotations(quotesRes);
        setStages(stagesRes);
        if (stagesRes.length === 0 && quotesRes.length > 0) {
          setMainView('QUOTATIONS');
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Unable to load dental records. Please retry.';
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
    setStages([]);
    setSelectedQuote(null);
    if (selectedPatientId) {
      void loadData(false);
    }
  }, [selectedPatientId, loadData]);

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
    // Reload stages after accepting quotation
    void loadData(true);
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
        ['DRAFT', 'PRESENTED', 'SENT'].includes(q.status)
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
        subtitle={`Care stages & estimates for ${selectedPatient?.full_name ?? 'selected profile'}`}
        onBack={onNavigateBack}
      />

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
        {/* Patient Switcher */}
        <PatientContextSelector />

        {/* Main View Segment: Treatment Stages vs Quotations */}
        <View style={styles.mainSegmentContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, mainView === 'STAGES' && styles.segmentBtnActive]}
            onPress={() => setMainView('STAGES')}
            activeOpacity={0.7}
          >
            <Text style={[styles.segmentText, mainView === 'STAGES' && styles.segmentTextActive]}>
              🦷 Treatment Stages ({stages.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, mainView === 'QUOTATIONS' && styles.segmentBtnActive]}
            onPress={() => setMainView('QUOTATIONS')}
            activeOpacity={0.7}
          >
            <Text style={[styles.segmentText, mainView === 'QUOTATIONS' && styles.segmentTextActive]}>
              🧾 Quotations ({quotations.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Loading State */}
        {isLoading && !isRefreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color={colors.brand.primary} />
            <Text style={styles.loadingText}>Loading dental records...</Text>
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

        {/* STAGES VIEW */}
        {!isLoading && !error && mainView === 'STAGES' ? (
          stages.length === 0 ? (
            <EmptyState
              icon="🦷"
              title="No Treatment Stages Available"
              description="When your dentist starts a multi-stage procedure or you accept a treatment quotation, the clinical stages will be tracked here step by step."
            />
          ) : (
            <View style={styles.stagesContainer}>
              {stages.map((stage, idx) => {
                const badgeVariant = getStageBadgeVariant(stage);
                const statusText = getStageStatusLabel(stage);

                return (
                  <View key={stage.id} style={styles.stageCard}>
                    {/* Stage Number & Title Header */}
                    <View style={styles.stageHeader}>
                      <View style={styles.stageStepCircle}>
                        <Text style={styles.stageStepText}>{stage.sequence || idx + 1}</Text>
                      </View>
                      <View style={styles.stageHeaderInfo}>
                        <Text style={styles.stageTitle}>{stage.stage_name}</Text>
                        <View style={styles.stageMetaRow}>
                          <View style={styles.toothBadge}>
                            <Text style={styles.toothBadgeText}>
                              {formatToothDescription(stage.tooth_number)}
                            </Text>
                          </View>
                          {stage.assigned_doctor_name ? (
                            <Text style={styles.doctorText}>
                              👨‍⚕️ Dr. {stage.assigned_doctor_name}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </View>

                    {/* Status Badge & Indicator */}
                    <View style={styles.statusRow}>
                      <StatusBadge label={statusText} variant={badgeVariant} />
                      {stage.episode_number ? (
                        <Text style={styles.episodeText}>Episode #{stage.episode_number}</Text>
                      ) : null}
                    </View>

                    {/* Prerequisite Waiting Notice */}
                    {stage.is_blocked_by_prerequisite ? (
                      <View style={styles.prereqBox}>
                        <Text style={styles.prereqIcon}>⏳</Text>
                        <Text style={styles.prereqText}>
                          Waiting for prerequisite stage to be completed before this stage can begin.
                        </Text>
                      </View>
                    ) : null}

                    {/* Prosthetic Lab Status Banner */}
                    {stage.lab_order_status ? (
                      <View
                        style={[
                          styles.labBox,
                          stage.lab_order_status === 'READY'
                            ? styles.labBoxReady
                            : styles.labBoxPending,
                        ]}
                      >
                        <Text style={styles.labIcon}>
                          {stage.lab_order_status === 'READY' ? '✅' : '🔬'}
                        </Text>
                        <View style={styles.labInfo}>
                          <Text style={styles.labTitle}>
                            {stage.lab_order_status === 'READY'
                              ? 'Dental Lab: Ready for Fitting'
                              : 'Dental Lab: In Fabrication'}
                          </Text>
                          {stage.lab_order_number ? (
                            <Text style={styles.labSub}>Lab Order #{stage.lab_order_number}</Text>
                          ) : null}
                        </View>
                      </View>
                    ) : null}

                    {/* Linked Appointment Info */}
                    {stage.appointment_date ? (
                      <View style={styles.appointmentBox}>
                        <Text style={styles.appointmentIcon}>📅</Text>
                        <View style={styles.appointmentInfo}>
                          <Text style={styles.appointmentTitle}>
                            Scheduled Session: {stage.appointment_date}
                            {stage.appointment_start_time ? ` at ${stage.appointment_start_time}` : ''}
                          </Text>
                          {stage.appointment_status ? (
                            <Text style={styles.appointmentStatus}>
                              Status: {stage.appointment_status}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    ) : null}

                    {/* Clinical Notes / Patient Instructions */}
                    {stage.notes ? (
                      <View style={styles.notesBox}>
                        <Text style={styles.notesTitle}>Patient Instructions:</Text>
                        <Text style={styles.notesText}>{stage.notes}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )
        ) : null}

        {/* QUOTATIONS VIEW */}
        {!isLoading && !error && mainView === 'QUOTATIONS' ? (
          <>
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
                  Pending (
                  {quotations.filter((q) => ['DRAFT', 'PRESENTED', 'SENT'].includes(q.status)).length}
                  )
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

            {filteredQuotations.length === 0 ? (
              <EmptyState
                icon="🧾"
                title="No Quotations Found"
                description="Proposed dental care plans and cost estimates will appear here after your dental consultation."
              />
            ) : (
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
                          {formatDentalCurrency(quote.total, quote.currency)}
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
            )}
          </>
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
  mainSegmentContainer: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.surfaceSubtle,
    borderRadius: radius.lg,
    padding: 3,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  segmentBtnActive: {
    backgroundColor: colors.neutral.surface,
    ...shadows.subtle,
  },
  segmentText: {
    ...typography.presets.bodySmallMedium,
    color: colors.text.secondary,
  },
  segmentTextActive: {
    color: colors.brand.primaryDark,
    fontWeight: typography.weight.bold,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.surfaceSubtle,
    borderRadius: radius.md,
    padding: spacing.xxs,
    marginBottom: spacing.lg,
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
  stagesContainer: {
    gap: spacing.lg,
  },
  stageCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    ...shadows.card,
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  stageStepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  stageStepText: {
    ...typography.presets.bodyStrong,
    color: colors.brand.primaryDark,
  },
  stageHeaderInfo: {
    flex: 1,
  },
  stageTitle: {
    ...typography.presets.cardTitle,
    color: colors.text.primary,
  },
  stageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: spacing.sm,
  },
  toothBadge: {
    backgroundColor: colors.neutral.surfaceSubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  toothBadgeText: {
    ...typography.presets.micro,
    color: colors.text.secondary,
    fontWeight: typography.weight.semibold,
  },
  doctorText: {
    ...typography.presets.caption,
    color: colors.text.muted,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  episodeText: {
    ...typography.presets.micro,
    color: colors.text.muted,
  },
  prereqBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  prereqIcon: {
    fontSize: typography.size.base,
    marginRight: spacing.xs,
  },
  prereqText: {
    flex: 1,
    ...typography.presets.caption,
    color: '#92400E',
  },
  labBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    borderWidth: 1,
  },
  labBoxPending: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  labBoxReady: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  labIcon: {
    fontSize: typography.size.base,
    marginRight: spacing.sm,
  },
  labInfo: {
    flex: 1,
  },
  labTitle: {
    ...typography.presets.captionStrong,
    color: colors.text.primary,
  },
  labSub: {
    ...typography.presets.micro,
    color: colors.text.muted,
  },
  appointmentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  appointmentIcon: {
    fontSize: typography.size.base,
    marginRight: spacing.sm,
  },
  appointmentInfo: {
    flex: 1,
  },
  appointmentTitle: {
    ...typography.presets.captionStrong,
    color: colors.text.primary,
  },
  appointmentStatus: {
    ...typography.presets.micro,
    color: colors.text.muted,
    marginTop: 1,
  },
  notesBox: {
    backgroundColor: colors.neutral.surfaceSubtle,
    padding: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  notesTitle: {
    ...typography.presets.captionStrong,
    color: colors.text.primary,
    marginBottom: 2,
  },
  notesText: {
    ...typography.presets.caption,
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
