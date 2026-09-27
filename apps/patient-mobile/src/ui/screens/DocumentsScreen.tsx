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
import { DocumentsApi } from '../../documents/documents-api';
import {
  formatDocumentDate,
  formatFileSize,
  getDocumentTypeIcon,
  getDocumentTypeLabel,
  getReviewStatusBadge,
  type PortalDocument,
  type PortalDocumentType,
} from '../../documents/contracts';
import { PatientContextSelector } from '../components/PatientContextSelector';
import { DocumentDetailsModal } from '../components/DocumentDetailsModal';

type DocumentFilterTab = 'ALL' | PortalDocumentType;

interface DocumentsScreenProps {
  onNavigateBack?: () => void;
}

export function DocumentsScreen({ onNavigateBack }: DocumentsScreenProps) {
  const { manager } = useAuth();
  const { selectedPatient, selectedPatientId } = usePatient();

  const [activeFilter, setActiveFilter] = useState<DocumentFilterTab>('ALL');
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Selected document for details modal
  const [selectedDoc, setSelectedDoc] = useState<PortalDocument | null>(null);

  const api = useMemo(() => new DocumentsApi(manager), [manager]);

  const loadDocuments = useCallback(
    async (isRefresh = false) => {
      if (!selectedPatientId) return;

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const response = await api.listDocuments(selectedPatientId);
        setDocuments(response.data);
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Unable to load documents. Please retry.';
        setError(msg);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [api, selectedPatientId]
  );

  // Clear stale documents immediately on patient context change
  useEffect(() => {
    setDocuments([]);
    setSelectedDoc(null);
    if (selectedPatientId) {
      void loadDocuments(false);
    }
  }, [selectedPatientId, loadDocuments]);

  const clinicalCount = useMemo(
    () => documents.filter((d) => d.document_type === 'CLINICAL').length,
    [documents]
  );
  const insuranceCount = useMemo(
    () => documents.filter((d) => d.document_type === 'INSURANCE').length,
    [documents]
  );
  const otherCount = useMemo(
    () => documents.filter((d) => d.document_type === 'OTHER').length,
    [documents]
  );

  const filteredDocuments = useMemo(() => {
    if (activeFilter === 'ALL') return documents;
    return documents.filter((d) => d.document_type === activeFilter);
  }, [documents, activeFilter]);

  return (
    <View style={styles.screenContainer}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadDocuments(true)}
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
            <Text style={styles.screenTitle}>My Documents</Text>
            <Text style={styles.screenSubtitle}>
              Access medical records, insurance forms & health files
            </Text>
          </View>
        </View>

        {/* Patient Context Selector */}
        <PatientContextSelector />

        {/* Category Tabs */}
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
              All ({documents.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterTab,
              activeFilter === 'CLINICAL' && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter('CLINICAL')}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === 'CLINICAL' && styles.filterTabTextActive,
              ]}
            >
              Clinical ({clinicalCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterTab,
              activeFilter === 'INSURANCE' && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter('INSURANCE')}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === 'INSURANCE' && styles.filterTabTextActive,
              ]}
            >
              Insurance ({insuranceCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterTab,
              activeFilter === 'OTHER' && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter('OTHER')}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === 'OTHER' && styles.filterTabTextActive,
              ]}
            >
              Other ({otherCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Documents List */}
        {isLoading && !isRefreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0284C7" />
            <Text style={styles.loadingText}>Loading documents…</Text>
          </View>
        ) : error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Unable to Load Documents</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => loadDocuments(false)}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : filteredDocuments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📁</Text>
            <Text style={styles.emptyTitle}>
              {activeFilter === 'CLINICAL'
                ? 'No Clinical Records'
                : activeFilter === 'INSURANCE'
                ? 'No Insurance Documents'
                : activeFilter === 'OTHER'
                ? 'No Other Files'
                : 'No Documents on File'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter === 'ALL'
                ? `Hospital documents and uploaded health files for ${
                    selectedPatient?.full_name ?? 'this patient'
                  } will appear here.`
                : `No ${activeFilter.toLowerCase()} documents found for this patient.`}
            </Text>
          </View>
        ) : (
          <View style={styles.docsList}>
            {filteredDocuments.map((doc) => {
              const reviewBadge = getReviewStatusBadge(doc.review_status);
              const typeIcon = getDocumentTypeIcon(doc.document_type);
              const typeLabel = getDocumentTypeLabel(doc.document_type);

              return (
                <View key={doc.id} style={styles.docCard}>
                  <View style={styles.docCardHead}>
                    <View style={styles.iconCircle}>
                      <Text style={styles.docIcon}>{typeIcon}</Text>
                    </View>
                    <View style={styles.docHeadInfo}>
                      <Text style={styles.docCategory}>{typeLabel}</Text>
                      <Text style={styles.docTitle}>{doc.title}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: reviewBadge.bg,
                          borderColor: reviewBadge.border,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.statusBadgeText, { color: reviewBadge.text }]}
                      >
                        {reviewBadge.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>
                      📄 {doc.file_name} • {formatFileSize(doc.file_size_bytes)}
                    </Text>
                    <Text style={styles.metaText}>
                      📅 {formatDocumentDate(doc.created_at)}
                    </Text>
                  </View>

                  {doc.provider_name ? (
                    <Text style={styles.providerText}>
                      🏥 Facility: {doc.provider_name}
                    </Text>
                  ) : null}

                  <View style={styles.docCardFooter}>
                    <Text style={styles.sourceText}>
                      Source:{' '}
                      {doc.source === 'HOSPITAL'
                        ? 'Hospital Record'
                        : doc.source === 'GUARDIAN'
                        ? 'Guardian'
                        : 'Patient'}
                    </Text>
                    <TouchableOpacity
                      style={styles.viewDetailsButton}
                      onPress={() => setSelectedDoc(doc)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.viewDetailsText}>View Details →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Details Modal */}
      <DocumentDetailsModal
        visible={Boolean(selectedDoc)}
        onClose={() => setSelectedDoc(null)}
        document={selectedDoc}
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
  docsList: {
    gap: 12,
  },
  docCard: {
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
  docCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
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
  docIcon: {
    fontSize: 18,
  },
  docHeadInfo: {
    flex: 1,
  },
  docCategory: {
    fontSize: 10,
    color: '#0284C7',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  docTitle: {
    fontSize: 14,
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
  metaRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 8,
    gap: 4,
    marginBottom: 8,
  },
  metaText: {
    fontSize: 11,
    color: '#64748B',
  },
  providerText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
    marginBottom: 8,
  },
  docCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  sourceText: {
    fontSize: 11,
    color: '#94A3B8',
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
