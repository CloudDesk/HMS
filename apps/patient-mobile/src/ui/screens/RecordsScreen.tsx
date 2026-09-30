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
import { RecordsApi } from '../../records/records-api';
import {
  imagingReportRecordSchema,
  labResultRecordSchema,
  type ImagingReportRecord,
  type LabResultRecord,
} from '../../records/contracts';
import { PatientContextSelector } from '../components/PatientContextSelector';
import {
  formatDateTime,
  LabResultDetailsModal,
} from '../components/LabResultDetailsModal';
import { ImagingReportDetailsModal } from '../components/ImagingReportDetailsModal';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { colors, radius, shadows, spacing, typography } from '../theme';

export function RecordsScreen() {
  const { manager } = useAuth();
  const { selectedPatient, selectedPatientId, overview } = usePatient();

  const [activeTab, setActiveTab] = useState<'lab' | 'imaging'>('lab');
  const [labResults, setLabResults] = useState<LabResultRecord[]>(() => {
    if (overview && selectedPatientId && overview.patient?.id === selectedPatientId && Array.isArray(overview.laboratory_results)) {
      const parsed = labResultRecordSchema.array().safeParse(overview.laboratory_results);
      return parsed.success ? parsed.data : [];
    }
    return [];
  });
  const [imagingReports, setImagingReports] = useState<ImagingReportRecord[]>(() => {
    if (overview && selectedPatientId && overview.patient?.id === selectedPatientId && Array.isArray(overview.imaging_reports)) {
      const parsed = imagingReportRecordSchema.array().safeParse(overview.imaging_reports);
      return parsed.success ? parsed.data : [];
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    return !(overview && selectedPatientId && overview.patient?.id === selectedPatientId);
  });
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedLabResult, setSelectedLabResult] = useState<LabResultRecord | null>(null);
  const [selectedImagingReport, setSelectedImagingReport] = useState<ImagingReportRecord | null>(null);

  const api = useMemo(() => new RecordsApi(manager), [manager]);

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
        const result = await api.getRecords(selectedPatientId);
        setLabResults(result.laboratory_results);
        setImagingReports(result.imaging_reports);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Unable to load diagnostic records. Please retry.';
        setError(msg);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [api, selectedPatientId]
  );

  useEffect(() => {
    setSelectedLabResult(null);
    setSelectedImagingReport(null);
    if (overview && selectedPatientId && overview.patient?.id === selectedPatientId) {
      const parsedLab = labResultRecordSchema.array().safeParse(overview.laboratory_results);
      const parsedImaging = imagingReportRecordSchema.array().safeParse(overview.imaging_reports);
      if (parsedLab.success && parsedImaging.success) {
        setLabResults(parsedLab.data);
        setImagingReports(parsedImaging.data);
        setIsLoading(false);
        setError(null);
        return;
      }
    }
    setLabResults([]);
    setImagingReports([]);
    loadData();
  }, [selectedPatientId, overview, loadData]);

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
          <Text style={styles.title}>Medical Records</Text>
          <Text style={styles.subtitle}>
            Diagnostic lab test results and radiology scans for{' '}
            {selectedPatient?.full_name ?? 'selected profile'}
          </Text>
        </View>

        {/* Patient Switcher */}
        <PatientContextSelector />

        {/* Section Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'lab' && styles.tabButtonActive]}
            onPress={() => setActiveTab('lab')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'lab' && styles.tabTextActive]}>
              Lab Results ({labResults.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'imaging' && styles.tabButtonActive]}
            onPress={() => setActiveTab('imaging')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'imaging' && styles.tabTextActive]}>
              Imaging Scans ({imagingReports.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Loading State */}
        {isLoading && !isRefreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color={colors.brand.primary} />
            <Text style={styles.loadingText}>Loading medical records...</Text>
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

        {/* Lab Results Tab Content */}
        {!isLoading && !error && activeTab === 'lab' ? (
          labResults.length === 0 ? (
            <EmptyState
              icon="🧪"
              title="No Lab Results Available"
              description="Verified laboratory reports will be listed here once released by the lab."
            />
          ) : (
            <View style={styles.listContainer}>
              {labResults.map((result) => {
                const serviceNames = result.result_items.map((i) => i.serviceName).join(', ') || 'Diagnostic Panel';

                return (
                  <TouchableOpacity
                    key={result.id}
                    style={styles.card}
                    onPress={() => setSelectedLabResult(result)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        <Text style={styles.testName} numberOfLines={1}>{serviceNames}</Text>
                        <Text style={styles.reportNum}>Verified on {formatDateTime(result.verified_at)}</Text>
                      </View>
                      <StatusBadge label="VERIFIED" variant="success" size="sm" />
                    </View>

                    <View style={styles.cardDivider} />

                    <View style={styles.cardDetails}>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailIcon}>🔬</Text>
                        <Text style={styles.detailText}>
                          {result.result_items.length} parameter{result.result_items.length === 1 ? '' : 's'} analysed
                        </Text>
                      </View>
                      {result.remarks ? (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailIcon}>📝</Text>
                          <Text style={styles.detailText} numberOfLines={1}>
                            {result.remarks}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.cardFooter}>
                      <Text style={styles.sampleId}>Entered: {formatDateTime(result.entered_at)}</Text>
                      <Text style={styles.viewDetailsText}>View Full Report →</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )
        ) : null}

        {/* Imaging Reports Tab Content */}
        {!isLoading && !error && activeTab === 'imaging' ? (
          imagingReports.length === 0 ? (
            <EmptyState
              icon="🩻"
              title="No Imaging Reports"
              description="Radiology scans (X-Ray, MRI, CT) will appear here once finalized by the radiologist."
            />
          ) : (
            <View style={styles.listContainer}>
              {imagingReports.map((report) => (
                <TouchableOpacity
                  key={report.id}
                  style={styles.card}
                  onPress={() => setSelectedImagingReport(report)}
                  activeOpacity={0.75}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <Text style={styles.testName}>Diagnostic Imaging Scan</Text>
                      <Text style={styles.reportNum}>Verified on {formatDateTime(report.verified_at)}</Text>
                    </View>
                    <StatusBadge label="VERIFIED" variant="success" size="sm" />
                  </View>

                  <View style={styles.cardDivider} />

                  <View style={styles.cardDetails}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailIcon}>📋</Text>
                      <Text style={styles.detailText} numberOfLines={2}>
                        Impression: {report.impression || 'Review report for findings'}
                      </Text>
                    </View>
                    {report.recommendations ? (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailIcon}>💡</Text>
                        <Text style={styles.detailText} numberOfLines={1}>
                          Recommendations: {report.recommendations}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.cardFooter}>
                    <Text style={styles.sampleId}>Entered: {formatDateTime(report.entered_at)}</Text>
                    <Text style={styles.viewDetailsText}>View Findings →</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )
        ) : null}
      </ScrollView>

      {/* Detail Modals */}
      <LabResultDetailsModal
        result={selectedLabResult}
        onClose={() => setSelectedLabResult(null)}
      />

      <ImagingReportDetailsModal
        report={selectedImagingReport}
        onClose={() => setSelectedImagingReport(null)}
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
  testName: {
    ...typography.presets.cardTitle,
    color: colors.text.primary,
  },
  reportNum: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.md,
  },
  cardDetails: {
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIcon: {
    fontSize: typography.size.base,
    marginRight: spacing.sm,
    width: 20,
  },
  detailText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    flex: 1,
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
  sampleId: {
    ...typography.presets.micro,
    color: colors.text.muted,
  },
  viewDetailsText: {
    ...typography.presets.captionStrong,
    color: colors.brand.primary,
  },
});
