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
import type {
  ImagingReportRecord,
  LabResultRecord,
} from '../../records/contracts';
import { PatientContextSelector } from '../components/PatientContextSelector';
import {
  formatDateTime,
  LabResultDetailsModal,
} from '../components/LabResultDetailsModal';
import { ImagingReportDetailsModal } from '../components/ImagingReportDetailsModal';

export function RecordsScreen() {
  const { manager } = useAuth();
  const { selectedPatient, selectedPatientId } = usePatient();

  const [activeTab, setActiveTab] = useState<'lab' | 'imaging'>('lab');
  const [labResults, setLabResults] = useState<LabResultRecord[]>([]);
  const [imagingReports, setImagingReports] = useState<ImagingReportRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
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

  // Clear data immediately when patient context changes to prevent stale leak
  useEffect(() => {
    setLabResults([]);
    setImagingReports([]);
    setSelectedLabResult(null);
    setSelectedImagingReport(null);
    loadData();
  }, [selectedPatientId, loadData]);

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
          <Text style={styles.title}>Reports & Results</Text>
          <Text style={styles.subtitle}>
            Verified diagnostic laboratory test results and radiology imaging reports for{' '}
            {selectedPatient?.full_name ?? 'selected patient'}
          </Text>
        </View>

        {/* Patient Switcher */}
        <PatientContextSelector />

        {/* Section Tabs (Laboratory / Imaging) */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'lab' && styles.tabButtonActive]}
            onPress={() => setActiveTab('lab')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'lab' && styles.tabTextActive]}>
              Lab Tests ({labResults.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'imaging' && styles.tabButtonActive]}
            onPress={() => setActiveTab('imaging')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'imaging' && styles.tabTextActive]}>
              Imaging ({imagingReports.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Loading State */}
        {isLoading && !isRefreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#0284C7" />
            <Text style={styles.loadingText}>Loading verified records…</Text>
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

        {/* Laboratory Section Content */}
        {!isLoading && !error && activeTab === 'lab' ? (
          labResults.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🧪</Text>
              <Text style={styles.emptyTitle}>No Verified Lab Results</Text>
              <Text style={styles.emptySubtitle}>
                Verified laboratory results will appear here once released by the lab team.
              </Text>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {labResults.map((result) => {
                const title =
                  result.result_items.map((item) => item.serviceName).join(', ') ||
                  'Laboratory Test';

                return (
                  <TouchableOpacity
                    key={result.id}
                    style={styles.card}
                    onPress={() => setSelectedLabResult(result)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        <Text style={styles.recordTitle} numberOfLines={2}>
                          {title}
                        </Text>
                        <Text style={styles.dateText}>
                          📅 Verified on {formatDateTime(result.verified_at)}
                        </Text>
                      </View>
                      <View style={styles.verifiedBadge}>
                        <Text style={styles.verifiedBadgeText}>VERIFIED</Text>
                      </View>
                    </View>

                    {/* Parameter Items Summary */}
                    {result.result_items.length > 0 ? (
                      <View style={styles.paramsSummary}>
                        {result.result_items.slice(0, 3).map((item, idx) => (
                          <View key={`${item.serviceName}-${idx}`} style={styles.paramRow}>
                            <Text style={styles.paramName} numberOfLines={1}>
                              {item.serviceName}
                            </Text>
                            <Text style={styles.paramValue}>
                              {item.value}
                              {item.unit ? ` ${item.unit}` : ''}
                            </Text>
                          </View>
                        ))}
                        {result.result_items.length > 3 ? (
                          <Text style={styles.moreParamsText}>
                            +{result.result_items.length - 3} more parameters
                          </Text>
                        ) : null}
                      </View>
                    ) : null}

                    {result.remarks ? (
                      <Text style={styles.remarksSnippet} numberOfLines={1}>
                        💬 {result.remarks}
                      </Text>
                    ) : null}

                    <View style={styles.cardFooter}>
                      <Text style={styles.itemsCountText}>
                        {result.result_items.length}{' '}
                        {result.result_items.length === 1 ? 'parameter' : 'parameters'}
                      </Text>
                      <Text style={styles.viewDetailsText}>View Full Report →</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )
        ) : null}

        {/* Imaging Section Content */}
        {!isLoading && !error && activeTab === 'imaging' ? (
          imagingReports.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🩻</Text>
              <Text style={styles.emptyTitle}>No Verified Imaging Reports</Text>
              <Text style={styles.emptySubtitle}>
                Verified radiology imaging reports will appear here once released by the imaging team.
              </Text>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {imagingReports.map((report) => (
                <TouchableOpacity
                  key={report.id}
                  style={styles.card}
                  onPress={() => setSelectedImagingReport(report)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <Text style={styles.recordTitle}>Diagnostic Imaging Report</Text>
                      <Text style={styles.dateText}>
                        📅 Verified on {formatDateTime(report.verified_at)}
                      </Text>
                    </View>
                    <View style={styles.verifiedBadge}>
                      <Text style={styles.verifiedBadgeText}>VERIFIED</Text>
                    </View>
                  </View>

                  <View style={styles.impressionSnippet}>
                    <Text style={styles.impressionLabel}>Impression:</Text>
                    <Text style={styles.impressionSnippetText} numberOfLines={2}>
                      {report.impression}
                    </Text>
                  </View>

                  {report.recommendations ? (
                    <Text style={styles.recommendationSnippet} numberOfLines={1}>
                      💡 Recommendation: {report.recommendations}
                    </Text>
                  ) : null}

                  <View style={styles.cardFooter}>
                    <Text style={styles.itemsCountText}>Radiology Report</Text>
                    <Text style={styles.viewDetailsText}>View Full Report →</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )
        ) : null}
      </ScrollView>

      {/* Lab Result Details Modal */}
      <LabResultDetailsModal
        result={selectedLabResult}
        onClose={() => setSelectedLabResult(null)}
      />

      {/* Imaging Report Details Modal */}
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
  recordTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 20,
  },
  dateText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
    fontWeight: '500',
  },
  verifiedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  verifiedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  paramsSummary: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    marginBottom: 10,
    gap: 6,
  },
  paramRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paramName: {
    fontSize: 12,
    color: '#475569',
    flex: 1,
    marginRight: 8,
  },
  paramValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  moreParamsText: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '600',
    marginTop: 2,
  },
  remarksSnippet: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  impressionSnippet: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginBottom: 10,
  },
  impressionLabel: {
    fontSize: 11,
    color: '#0369A1',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  impressionSnippetText: {
    fontSize: 13,
    color: '#0369A1',
    fontWeight: '500',
    lineHeight: 18,
  },
  recommendationSnippet: {
    fontSize: 12,
    color: '#166534',
    marginBottom: 10,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  itemsCountText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  viewDetailsText: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '600',
  },
});
