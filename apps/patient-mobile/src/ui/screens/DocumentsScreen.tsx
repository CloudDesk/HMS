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
  type PortalDocument,
  type PortalDocumentType,
} from '../../documents/contracts';
import { PatientContextSelector } from '../components/PatientContextSelector';
import { DocumentDetailsModal } from '../components/DocumentDetailsModal';
import { UploadDocumentModal } from '../components/UploadDocumentModal';
import { AppHeader } from '../components/AppHeader';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge, type StatusVariant } from '../components/StatusBadge';
import { colors, radius, shadows, spacing, typography } from '../theme';

type DocumentFilterTab = 'ALL' | PortalDocumentType;

interface DocumentsScreenProps {
  onNavigateBack?: () => void;
}

const getReviewBadgeVariant = (status?: string): StatusVariant => {
  switch (status?.toUpperCase()) {
    case 'APPROVED':
    case 'VERIFIED':
      return 'success';
    case 'PENDING':
    case 'UNDER_REVIEW':
      return 'warning';
    case 'REJECTED':
      return 'danger';
    default:
      return 'neutral';
  }
};

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
  // Upload document modal state
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);

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

  useEffect(() => {
    setDocuments([]);
    setSelectedDoc(null);
    if (selectedPatientId) {
      void loadDocuments(false);
    }
  }, [selectedPatientId, loadDocuments]);

  const handleUploadSuccess = useCallback(() => {
    setIsUploadOpen(false);
    void loadDocuments(true);
  }, [loadDocuments]);

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
      <AppHeader
        title="Documents & Files"
        subtitle={`Clinical and administrative records for ${selectedPatient?.full_name ?? 'selected profile'}`}
        onBack={onNavigateBack}
      />

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadDocuments(true)}
            colors={[colors.brand.primary]}
            tintColor={colors.brand.primary}
          />
        }
      >
        {/* Patient Switcher */}
        <PatientContextSelector />

        {/* Action Bar with Upload Button */}
        <View style={styles.actionBar}>
          <View style={styles.actionBarTextGroup}>
            <Text style={styles.actionBarTitle}>Medical Documents</Text>
            <Text style={styles.actionBarSubtitle}>
              Upload and review records for this patient
            </Text>
          </View>
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => setIsUploadOpen(true)}
            activeOpacity={0.8}
            testID="open-upload-modal-button"
          >
            <Text style={styles.uploadBtnText}>+ Upload</Text>
          </TouchableOpacity>
        </View>

        {/* Category Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'ALL' && styles.filterChipActive]}
            onPress={() => setActiveFilter('ALL')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === 'ALL' && styles.filterChipTextActive,
              ]}
            >
              All ({documents.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'CLINICAL' && styles.filterChipActive]}
            onPress={() => setActiveFilter('CLINICAL')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === 'CLINICAL' && styles.filterChipTextActive,
              ]}
            >
              Clinical ({clinicalCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'INSURANCE' && styles.filterChipActive]}
            onPress={() => setActiveFilter('INSURANCE')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === 'INSURANCE' && styles.filterChipTextActive,
              ]}
            >
              Insurance ({insuranceCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'OTHER' && styles.filterChipActive]}
            onPress={() => setActiveFilter('OTHER')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === 'OTHER' && styles.filterChipTextActive,
              ]}
            >
              Other ({otherCount})
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Loading State */}
        {isLoading && !isRefreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color={colors.brand.primary} />
            <Text style={styles.loadingText}>Loading documents...</Text>
          </View>
        ) : null}

        {/* Error State */}
        {error && !isLoading ? (
          <EmptyState
            icon="⚠️"
            title="Unable to Load Documents"
            description={error}
            actionLabel="Try Again"
            onAction={() => loadDocuments()}
          />
        ) : null}

        {/* Empty State */}
        {!isLoading && !error && filteredDocuments.length === 0 ? (
          <EmptyState
            icon="📁"
            title="No Documents Found"
            description={
              activeFilter === 'ALL'
                ? 'No uploaded or hospital-issued documents available for this patient profile.'
                : `No ${getDocumentTypeLabel(activeFilter as PortalDocumentType)} documents found.`
            }
            actionLabel="+ Upload Document"
            onAction={() => setIsUploadOpen(true)}
          />
        ) : null}

        {/* Documents List */}
        {!isLoading && !error && filteredDocuments.length > 0 ? (
          <View style={styles.listContainer}>
            {filteredDocuments.map((doc) => (
              <TouchableOpacity
                key={doc.id}
                style={styles.card}
                onPress={() => setSelectedDoc(doc)}
                activeOpacity={0.75}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.docIconCircle}>
                    <Text style={styles.docIconEmoji}>
                      {getDocumentTypeIcon(doc.document_type)}
                    </Text>
                  </View>
                  <View style={styles.docTitleBlock}>
                    <Text style={styles.docName} numberOfLines={1}>
                      {doc.title || doc.file_name}
                    </Text>
                    <Text style={styles.docMeta}>
                      {getDocumentTypeLabel(doc.document_type)} • {formatFileSize(doc.file_size_bytes)}
                    </Text>
                  </View>
                  {doc.review_status ? (
                    <StatusBadge
                      label={doc.review_status}
                      variant={getReviewBadgeVariant(doc.review_status)}
                      size="sm"
                    />
                  ) : null}
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.cardFooter}>
                  <Text style={styles.docDate}>📅 {formatDocumentDate(doc.created_at)}</Text>
                  <Text style={styles.viewDocText}>View Details →</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {/* Document Details Modal */}
      <DocumentDetailsModal
        document={selectedDoc}
        visible={Boolean(selectedDoc)}
        onClose={() => setSelectedDoc(null)}
      />

      {/* Upload Document Modal */}
      <UploadDocumentModal
        visible={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={handleUploadSuccess}
        documentsApi={api}
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
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    backgroundColor: colors.neutral.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    ...shadows.card,
  },
  actionBarTextGroup: {
    flex: 1,
    marginRight: spacing.sm,
  },
  actionBarTitle: {
    ...typography.presets.cardTitle,
    color: colors.text.primary,
  },
  actionBarSubtitle: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  uploadBtn: {
    backgroundColor: colors.brand.primary,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
  uploadBtnText: {
    ...typography.presets.buttonSmall,
    color: colors.text.inverse,
    fontWeight: typography.weight.bold,
  },
  filterScroll: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
    paddingVertical: spacing.xxs,
  },
  filterChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  filterChipActive: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
    ...shadows.subtle,
  },
  filterChipText: {
    ...typography.presets.captionMedium,
    color: colors.text.secondary,
  },
  filterChipTextActive: {
    color: colors.text.inverse,
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
    alignItems: 'center',
  },
  docIconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brand.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  docIconEmoji: {
    fontSize: typography.size.xl,
  },
  docTitleBlock: {
    flex: 1,
    marginRight: spacing.sm,
  },
  docName: {
    ...typography.presets.cardTitle,
    color: colors.text.primary,
  },
  docMeta: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.md,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  docDate: {
    ...typography.presets.captionMedium,
    color: colors.text.muted,
  },
  viewDocText: {
    ...typography.presets.captionStrong,
    color: colors.brand.primary,
  },
});
