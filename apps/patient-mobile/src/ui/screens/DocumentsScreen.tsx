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
    fontSize: typography.size.xs + 1,
    fontWeight: typography.weight.semibold,
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
    fontSize: 20,
  },
  docTitleBlock: {
    flex: 1,
    marginRight: spacing.sm,
  },
  docName: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
  },
  docMeta: {
    fontSize: typography.size.xs,
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
    fontSize: typography.size.xs,
    color: colors.text.muted,
  },
  viewDocText: {
    fontSize: typography.size.xs + 1,
    color: colors.brand.primary,
    fontWeight: typography.weight.semibold,
  },
});
