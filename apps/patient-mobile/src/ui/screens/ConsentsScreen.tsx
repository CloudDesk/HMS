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
import { ConsentsApi } from '../../consents/consents-api';
import {
  formatConsentDate,
  getConsentStatusLabel,
  getConsentStatusVariant,
  type ConsentItem,
} from '../../consents/contracts';
import { formatFileSize } from '../../documents/contracts';
import { AppHeader } from '../components/AppHeader';
import { EmptyState } from '../components/EmptyState';
import { PatientContextSelector } from '../components/PatientContextSelector';
import { StatusBadge } from '../components/StatusBadge';
import { ConsentSignatureModal } from '../components/ConsentSignatureModal';
import { colors, radius, shadows, spacing, typography } from '../theme';

type ConsentFilterTab = 'ALL' | 'PENDING' | 'SIGNED';

interface ConsentsScreenProps {
  onNavigateBack?: () => void;
  initialConsentId?: string | null;
}

export function ConsentsScreen({ onNavigateBack, initialConsentId }: ConsentsScreenProps) {
  const { manager } = useAuth();
  const { context, selectedPatient, selectedPatientId } = usePatient();

  const [activeFilter, setActiveFilter] = useState<ConsentFilterTab>('ALL');
  const [consents, setConsents] = useState<ConsentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Selected consent for signature modal
  const [selectedConsent, setSelectedConsent] = useState<ConsentItem | null>(null);

  const api = useMemo(() => new ConsentsApi(manager), [manager]);

  const loadConsents = useCallback(
    async (isRefresh = false) => {
      if (!selectedPatientId) {
        setConsents([]);
        setIsLoading(false);
        return;
      }

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const result = await api.listConsents(selectedPatientId);
        setConsents(result);
        if (initialConsentId) {
          const target = result.find((c) => c.id === initialConsentId);
          if (target) {
            setSelectedConsent(target);
          }
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Unable to load consent documents. Please check your connection and retry.';
        setError(msg);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [api, selectedPatientId, initialConsentId]
  );

  // Patient context isolation: clear state immediately upon switching patient
  useEffect(() => {
    setConsents([]);
    setSelectedConsent(null);
    void loadConsents(false);
  }, [loadConsents]);

  useEffect(() => {
    if (initialConsentId && consents.length > 0) {
      const target = consents.find((c) => c.id === initialConsentId);
      if (target) {
        setSelectedConsent(target);
      }
    }
  }, [initialConsentId, consents]);

  const handleUploadSignature = async (
    consentId: string,
    file: { uri: string; name?: string; type?: string }
  ) => {
    if (!selectedPatientId) return;
    await api.uploadConsentSignature(selectedPatientId, consentId, file);
    await loadConsents(true);
  };

  const filteredConsents = useMemo(() => {
    if (activeFilter === 'PENDING') {
      return consents.filter((c) => !c.is_signed);
    }
    if (activeFilter === 'SIGNED') {
      return consents.filter((c) => c.is_signed);
    }
    return consents;
  }, [consents, activeFilter]);

  const pendingCount = consents.filter((c) => !c.is_signed).length;
  const signedCount = consents.filter((c) => c.is_signed).length;

  const isDependent = selectedPatient && selectedPatient.relationship !== 'SELF';
  const guardianProfile = context?.account.guardian_profile;

  return (
    <View style={styles.screenContainer}>
      <AppHeader
        title="Consent Management"
        subtitle="Medical consent forms, legal signatures & authorizations"
        onBack={onNavigateBack}
      />

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadConsents(true)}
            colors={[colors.brand.primary]}
            tintColor={colors.brand.primary}
          />
        }
      >
        {/* Patient Switcher (Context Isolation) */}
        <PatientContextSelector />

        {/* Guardian Legal Consent Banner (When managing a dependent) */}
        {isDependent ? (
          <View style={styles.guardianConsentBanner}>
            <Text style={styles.guardianIcon}>🛡️</Text>
            <View style={styles.guardianInfo}>
              <Text style={styles.guardianTitle}>Legal Guardian Authorization</Text>
              <Text style={styles.guardianSubtitle}>
                {guardianProfile?.legal_consent_accepted
                  ? 'Confirmed & recorded on file. You are authorized to review and sign medical consents for this dependent.'
                  : 'Guardian authorization is active for this dependent profile.'}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Filter Navigation Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeFilter === 'ALL' && styles.tabButtonActive]}
            onPress={() => setActiveFilter('ALL')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeFilter === 'ALL' && styles.tabTextActive]}>
              All ({consents.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeFilter === 'PENDING' && styles.tabButtonActive]}
            onPress={() => setActiveFilter('PENDING')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeFilter === 'PENDING' && styles.tabTextActive]}>
              Action Required ({pendingCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeFilter === 'SIGNED' && styles.tabButtonActive]}
            onPress={() => setActiveFilter('SIGNED')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeFilter === 'SIGNED' && styles.tabTextActive]}>
              Signed ({signedCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Loading State */}
        {isLoading && !isRefreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color={colors.brand.primary} />
            <Text style={styles.loadingText}>Loading consent forms...</Text>
          </View>
        ) : null}

        {/* Error State */}
        {error && !isLoading ? (
          <EmptyState
            icon="⚠️"
            title="Unable to Load Consents"
            description={error}
            actionLabel="Try Again"
            onAction={() => loadConsents(false)}
          />
        ) : null}

        {/* Empty State */}
        {!isLoading && !error && filteredConsents.length === 0 ? (
          <EmptyState
            icon="✍️"
            title={
              activeFilter === 'PENDING'
                ? 'No Pending Signatures'
                : 'No Consent Forms on File'
            }
            description={
              activeFilter === 'PENDING'
                ? 'You have no medical consent forms currently requiring a signature.'
                : 'Hospital treatment and admission consent forms will appear here when issued by your care team.'
            }
          />
        ) : null}

        {/* Consent Forms List */}
        {!isLoading && !error && filteredConsents.length > 0 ? (
          <View style={styles.listContainer}>
            {filteredConsents.map((item) => {
              const statusLabel = getConsentStatusLabel(item.status);
              const statusVariant = getConsentStatusVariant(item.status);

              return (
                <View key={item.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <Text style={styles.cardTitle}>{item.title}</Text>
                      <Text style={styles.cardMeta}>
                        Issued: {formatConsentDate(item.created_at)} · {formatFileSize(item.form_file_size_bytes)}
                      </Text>
                    </View>
                    <StatusBadge label={statusLabel} variant={statusVariant} size="sm" />
                  </View>

                  {item.description ? (
                    <Text style={styles.cardDescription} numberOfLines={3}>
                      {item.description}
                    </Text>
                  ) : null}

                  {/* Signature Status Box */}
                  <View
                    style={[
                      styles.signatureStatusBox,
                      item.is_signed ? styles.signatureBoxSigned : styles.signatureBoxPending,
                    ]}
                  >
                    <Text style={styles.signatureIcon}>{item.is_signed ? '✅' : '⏳'}</Text>
                    <View style={styles.signatureInfo}>
                      <Text style={styles.signatureTitle}>
                        {item.is_signed
                          ? 'Signature Attached & Recorded'
                          : 'Signature Not Yet Uploaded'}
                      </Text>
                      <Text style={styles.signatureSub}>
                        {item.is_signed && item.signature_uploaded_at
                          ? `Recorded on ${formatConsentDate(item.signature_uploaded_at)}`
                          : 'Please upload a clear picture of your signature for this consent form.'}
                      </Text>
                    </View>
                  </View>

                  {/* Action Button */}
                  <TouchableOpacity
                    style={[
                      styles.signActionBtn,
                      item.is_signed ? styles.signActionBtnSecondary : styles.signActionBtnPrimary,
                    ]}
                    onPress={() => setSelectedConsent(item)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.actionBtnIcon}>✍️</Text>
                    <Text
                      style={[
                        styles.signActionText,
                        item.is_signed ? styles.signActionTextSecondary : styles.signActionTextPrimary,
                      ]}
                    >
                      {item.is_signed ? 'Review & Update Signature' : 'Review & Sign Consent Form'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      {/* Consent Details & Signature Modal */}
      <ConsentSignatureModal
        key={`${selectedPatientId}:${selectedConsent?.id ?? 'closed'}`}
        visible={Boolean(selectedConsent)}
        onClose={() => setSelectedConsent(null)}
        consent={selectedConsent}
        onUploadSignature={handleUploadSignature}
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
  guardianConsentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.status.successBg,
    borderWidth: 1,
    borderColor: colors.status.successBorder,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  guardianIcon: {
    fontSize: typography.size.title,
    marginRight: spacing.md,
  },
  guardianInfo: {
    flex: 1,
  },
  guardianTitle: {
    ...typography.presets.bodySmallStrong,
    color: colors.status.success,
  },
  guardianSubtitle: {
    ...typography.presets.micro,
    color: colors.status.success,
    marginTop: 2,
    lineHeight: typography.lineHeight.compact,
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
    ...typography.presets.captionMedium,
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
    marginBottom: spacing.xs,
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  cardTitle: {
    ...typography.presets.cardTitle,
    color: colors.text.primary,
  },
  cardMeta: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  cardDescription: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    lineHeight: typography.lineHeight.normal,
    marginTop: spacing.xs,
  },
  signatureStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.md,
    borderWidth: 1,
  },
  signatureBoxPending: {
    backgroundColor: colors.status.warningBg,
    borderColor: colors.status.warningBorder,
  },
  signatureBoxSigned: {
    backgroundColor: colors.status.successBg,
    borderColor: colors.status.successBorder,
  },
  signatureIcon: {
    fontSize: typography.size.base,
    marginRight: spacing.sm,
  },
  signatureInfo: {
    flex: 1,
  },
  signatureTitle: {
    ...typography.presets.captionStrong,
    color: colors.text.primary,
  },
  signatureSub: {
    ...typography.presets.micro,
    color: colors.text.secondary,
    marginTop: 1,
  },
  signActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  signActionBtnPrimary: {
    backgroundColor: colors.brand.primary,
    ...shadows.subtle,
  },
  signActionBtnSecondary: {
    backgroundColor: colors.neutral.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  actionBtnIcon: {
    fontSize: typography.size.base,
    marginRight: spacing.xs,
  },
  signActionText: {
    ...typography.presets.captionStrong,
  },
  signActionTextPrimary: {
    color: colors.text.inverse,
  },
  signActionTextSecondary: {
    color: colors.brand.primaryDark,
  },
});
