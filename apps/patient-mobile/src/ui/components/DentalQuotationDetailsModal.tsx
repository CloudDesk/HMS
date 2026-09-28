import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  formatDentalCurrency,
  formatToothDescription,
  getDentalStatusLabel,
  getDentalStatusStyle,
  type DentalQuotation,
  type DentalQuotationOption,
} from '../../dental/contracts';
import { formatInvoiceDate } from '../../billing/contracts';
import { colors, radius, shadows, spacing, typography } from '../theme';

interface DentalQuotationDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  quotation: DentalQuotation | null;
  onAccept?: (quotationId: string, optionId: string, notes?: string) => Promise<void>;
  onReject?: (quotationId: string, reason?: string) => Promise<void>;
  onPostpone?: (quotationId: string, reason?: string) => Promise<void>;
}

export function DentalQuotationDetailsModal({
  visible,
  onClose,
  quotation,
  onAccept,
  onReject,
  onPostpone,
}: DentalQuotationDetailsModalProps) {
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [decisionMode, setDecisionMode] = useState<'view' | 'reject' | 'postpone'>('view');
  const [decisionReason, setDecisionReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!quotation) return null;

  const statusStyle = getDentalStatusStyle(quotation.status);
  const isPendingDecision =
    quotation.status === 'SENT' || quotation.status === 'POSTPONED';

  const options: DentalQuotationOption[] = quotation.options ?? [];
  const currentOptionId =
    selectedOptionId ||
    quotation.selected_option_id ||
    (options.length > 0 && options[0]?.id ? options[0].id : '') ||
    '';

  const activeOption = options.find((o) => o.id === currentOptionId) ?? options[0];
  const displayItems = activeOption ? activeOption.items : quotation.items;
  const displaySubtotal = activeOption ? activeOption.subtotal : quotation.subtotal;
  const displayDiscount = activeOption
    ? activeOption.discount_amount
    : quotation.discount_amount;
  const displayTax = activeOption ? activeOption.tax_amount : quotation.tax_amount;
  const displayTotal = activeOption ? activeOption.total : quotation.total;

  const handleAccept = () => {
    if (!onAccept) return;
    const chosenOptionId = activeOption?.id ?? currentOptionId ?? '';
    Alert.alert(
      'Accept Treatment Quotation',
      `Are you sure you want to accept Treatment Quotation ${quotation.quotation_number}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept Plan',
          style: 'default',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              await onAccept(quotation.id, chosenOptionId);
              Alert.alert('Success', 'Treatment quotation accepted successfully.');
              onClose();
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Failed to accept quotation.';
              Alert.alert('Error', msg);
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleConfirmDecision = async () => {
    if (decisionMode === 'reject' && onReject) {
      setIsSubmitting(true);
      try {
        await onReject(quotation.id, decisionReason.trim() || undefined);
        Alert.alert('Quotation Declined', 'You have declined this quotation.');
        setDecisionMode('view');
        setDecisionReason('');
        onClose();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to decline quotation.';
        Alert.alert('Error', msg);
      } finally {
        setIsSubmitting(false);
      }
    } else if (decisionMode === 'postpone' && onPostpone) {
      setIsSubmitting(true);
      try {
        await onPostpone(quotation.id, decisionReason.trim() || undefined);
        Alert.alert('Decision Postponed', 'Your response has been saved.');
        setDecisionMode('view');
        setDecisionReason('');
        onClose();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to postpone quotation.';
        Alert.alert('Error', msg);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleGroup}>
              <Text style={styles.headerIcon}>🦷</Text>
              <Text style={styles.headerTitle}>Dental Treatment Plan</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Summary Top Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryTopRow}>
                <View style={styles.quoteNumberBlock}>
                  <Text style={styles.doctorName}>
                    {quotation.doctor_name ? `Dr. ${quotation.doctor_name.replace(/^dr\.?\s+/i, '')}` : 'Dentist'}
                  </Text>
                  <Text style={styles.quotationNumber}>
                    {quotation.quotation_number}
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
                  <Text style={[styles.statusText, { color: statusStyle.text }]}>
                    {getDentalStatusLabel(quotation.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaItem}>
                  📅 Issued {formatInvoiceDate(quotation.created_at)}
                </Text>
                {quotation.valid_until ? (
                  <Text style={styles.metaItem}>
                    ⏳ Valid Until {formatInvoiceDate(quotation.valid_until)}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Treatment Options Switcher (if options exist) */}
            {options.length > 1 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Treatment Plan Options</Text>
                <View style={styles.optionsList}>
                  {options.map((opt, idx) => {
                    const isOptSelected = opt.id === currentOptionId || (!currentOptionId && idx === 0);
                    return (
                      <TouchableOpacity
                        key={opt.id || idx}
                        style={[
                          styles.optionCard,
                          isOptSelected && styles.optionCardSelected,
                        ]}
                        onPress={() => setSelectedOptionId(opt.id || '')}
                        activeOpacity={0.7}
                      >
                        <View style={styles.optionHeader}>
                          <Text style={styles.optionName}>{opt.name}</Text>
                          <Text style={styles.optionTotal}>
                            {formatDentalCurrency(opt.total, quotation.currency)}
                          </Text>
                        </View>
                        {opt.description ? (
                          <Text style={styles.optionDescription}>
                            {opt.description}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* Itemized Dental Procedures List */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Proposed Procedures ({displayItems.length})
              </Text>
              <View style={styles.itemsCard}>
                {displayItems.length === 0 ? (
                  <Text style={styles.emptyItemsText}>
                    No itemized procedures recorded.
                  </Text>
                ) : (
                  displayItems.map((item, index) => (
                    <View
                      key={item.id || index}
                      style={[
                        styles.itemRow,
                        index !== displayItems.length - 1 && styles.itemRowBorder,
                      ]}
                    >
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.procedure_name}</Text>
                        <View style={styles.itemBadgeRow}>
                          <View style={styles.toothBadge}>
                            <Text style={styles.toothBadgeText}>
                              {formatToothDescription(item.tooth_number)}
                            </Text>
                          </View>
                          <Text style={styles.itemQty}>
                            Qty: {item.quantity} ×{' '}
                            {formatDentalCurrency(item.unit_price, quotation.currency)}
                          </Text>
                        </View>
                        {item.notes ? (
                          <Text style={styles.itemNotes}>Note: {item.notes}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.itemTotal}>
                        {formatDentalCurrency(item.line_total, quotation.currency)}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </View>

            {/* Financial Breakdown Receipt */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Treatment Financials</Text>
              <View style={styles.receiptCard}>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Subtotal</Text>
                  <Text style={styles.receiptValue}>
                    {formatDentalCurrency(displaySubtotal, quotation.currency)}
                  </Text>
                </View>

                {displayDiscount > 0 ? (
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Discount</Text>
                    <Text style={[styles.receiptValue, styles.discountValue]}>
                      -{formatDentalCurrency(displayDiscount, quotation.currency)}
                    </Text>
                  </View>
                ) : null}

                {displayTax > 0 ? (
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Estimated Taxes</Text>
                    <Text style={styles.receiptValue}>
                      +{formatDentalCurrency(displayTax, quotation.currency)}
                    </Text>
                  </View>
                ) : null}

                <View style={[styles.receiptRow, styles.receiptTotalRow]}>
                  <Text style={styles.receiptTotalLabel}>Estimated Total</Text>
                  <Text style={styles.receiptTotalValue}>
                    {formatDentalCurrency(displayTotal, quotation.currency)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Decision Reason Form if rejecting / postponing */}
            {decisionMode !== 'view' ? (
              <View style={styles.decisionForm}>
                <Text style={styles.decisionFormTitle}>
                  {decisionMode === 'reject'
                    ? 'Decline Quotation Reason'
                    : 'Postpone Decision Reason'}
                </Text>
                <TextInput
                  style={styles.decisionInput}
                  placeholder="Enter notes or reason (optional)…"
                  placeholderTextColor="#94A3B8"
                  value={decisionReason}
                  onChangeText={setDecisionReason}
                  multiline={true}
                  numberOfLines={3}
                />
                <View style={styles.decisionActionRow}>
                  <TouchableOpacity
                    style={styles.decisionCancelBtn}
                    onPress={() => setDecisionMode('view')}
                  >
                    <Text style={styles.decisionCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.decisionConfirmBtn,
                      decisionMode === 'reject'
                        ? styles.rejectConfirmBtn
                        : styles.postponeConfirmBtn,
                    ]}
                    onPress={handleConfirmDecision}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.decisionConfirmText}>
                        {decisionMode === 'reject'
                          ? 'Confirm Decline'
                          : 'Confirm Postpone'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {/* Status Notices */}
            {quotation.status === 'ACCEPTED' ? (
              <View style={styles.acceptedBanner}>
                <Text style={styles.bannerIcon}>✅</Text>
                <View style={styles.bannerContent}>
                  <Text style={styles.bannerTitle}>Quotation Accepted</Text>
                  <Text style={styles.bannerText}>
                    You accepted this dental treatment plan on{' '}
                    {formatInvoiceDate(quotation.accepted_at ?? quotation.created_at)}.
                    Your dental care team will schedule your treatment sessions.
                  </Text>
                </View>
              </View>
            ) : quotation.status === 'REJECTED' ? (
              <View style={styles.rejectedBanner}>
                <Text style={styles.bannerIcon}>ℹ️</Text>
                <View style={styles.bannerContent}>
                  <Text style={styles.bannerTitle}>Quotation Declined</Text>
                  <Text style={styles.bannerText}>
                    This quotation was declined. If you would like a revised treatment
                    plan, please discuss with your dentist.
                  </Text>
                </View>
              </View>
            ) : quotation.status === 'POSTPONED' ? (
              <View style={styles.postponedBanner}>
                <Text style={styles.bannerIcon}>⏳</Text>
                <View style={styles.bannerContent}>
                  <Text style={styles.bannerTitle}>Decision Postponed</Text>
                  <Text style={styles.bannerText}>
                    Decision has been postponed. You can review and respond whenever you
                    are ready before the expiration date.
                  </Text>
                </View>
              </View>
            ) : null}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            {isPendingDecision && decisionMode === 'view' ? (
              <View style={styles.actionsGrid}>
                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={handleAccept}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.acceptButtonText}>Accept Quotation</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.secondaryActionsRow}>
                  <TouchableOpacity
                    style={styles.postponeButton}
                    onPress={() => setDecisionMode('postpone')}
                  >
                    <Text style={styles.postponeButtonText}>Postpone</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={() => setDecisionMode('reject')}
                  >
                    <Text style={styles.rejectButtonText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.closeFullButton} onPress={onClose}>
                <Text style={styles.closeFullButtonText}>Close</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.neutral.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '90%',
    minHeight: '50%',
    paddingBottom: spacing.xxl,
    ...shadows.modal,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIcon: {
    fontSize: typography.size.xl,
  },
  headerTitle: {
    ...typography.presets.sectionTitle,
    color: colors.text.primary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.neutral.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    ...typography.presets.bodySmallStrong,
    color: colors.text.secondary,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: spacing.xl,
    paddingBottom: spacing.lg,
  },
  summaryCard: {
    backgroundColor: colors.neutral.background,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.lg,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  quoteNumberBlock: {
    flex: 1,
    marginRight: spacing.sm,
  },
  doctorName: {
    ...typography.presets.captionStrong,
    color: colors.brand.primary,
    marginBottom: 2,
  },
  quotationNumber: {
    ...typography.presets.sectionTitle,
    color: colors.text.primary,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  statusText: {
    ...typography.presets.captionStrong,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    paddingTop: spacing.sm + 2,
  },
  metaItem: {
    ...typography.presets.captionMedium,
    color: colors.text.secondary,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.presets.bodyStrong,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  optionsList: {
    gap: spacing.sm,
  },
  optionCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border.default,
  },
  optionCardSelected: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.primarySubtle,
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionName: {
    ...typography.presets.bodyStrong,
    color: colors.text.primary,
  },
  optionTotal: {
    ...typography.presets.bodyStrong,
    color: colors.brand.primary,
  },
  optionDescription: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  itemsCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  emptyItemsText: {
    padding: spacing.lg,
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  itemInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  itemName: {
    ...typography.presets.bodySmallStrong,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  itemBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  toothBadge: {
    backgroundColor: colors.brand.primaryLight,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  toothBadgeText: {
    fontSize: typography.size.micro,
    lineHeight: typography.lineHeight.micro,
    fontWeight: typography.weight.bold,
    color: colors.brand.primaryDark,
  },
  itemQty: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  itemNotes: {
    ...typography.presets.caption,
    color: colors.text.muted,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  itemTotal: {
    ...typography.presets.bodyStrong,
    color: colors.text.primary,
  },
  receiptCard: {
    backgroundColor: colors.neutral.background,
    borderRadius: radius.md,
    padding: spacing.md + 2,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs + 2,
  },
  receiptLabel: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  receiptValue: {
    ...typography.presets.bodySmallStrong,
    color: colors.text.primary,
  },
  discountValue: {
    color: colors.status.success,
  },
  receiptTotalRow: {
    borderTopWidth: 1,
    borderColor: colors.border.default,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.xs + 2,
  },
  receiptTotalLabel: {
    ...typography.presets.bodyStrong,
    color: colors.text.primary,
  },
  receiptTotalValue: {
    ...typography.presets.sectionTitle,
    color: colors.brand.primary,
  },
  decisionForm: {
    backgroundColor: '#FFFBEB',
    borderRadius: radius.md,
    padding: spacing.md + 2,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: spacing.lg,
  },
  decisionFormTitle: {
    ...typography.presets.bodySmallStrong,
    color: '#92400E',
    marginBottom: spacing.sm,
  },
  decisionInput: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.sm + 2,
    ...typography.presets.bodySmall,
    color: colors.text.primary,
    textAlignVertical: 'top',
    marginBottom: spacing.sm + 2,
  },
  decisionActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  decisionCancelBtn: {
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.xs + 2,
    backgroundColor: colors.neutral.surfaceSubtle,
  },
  decisionCancelText: {
    ...typography.presets.captionStrong,
    color: colors.text.secondary,
  },
  decisionConfirmBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.xs + 2,
  },
  rejectConfirmBtn: {
    backgroundColor: colors.status.danger,
  },
  postponeConfirmBtn: {
    backgroundColor: colors.status.warning,
  },
  decisionConfirmText: {
    ...typography.presets.captionStrong,
    color: colors.text.inverse,
  },
  acceptedBanner: {
    flexDirection: 'row',
    backgroundColor: '#F0FDF4',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: spacing.sm + 2,
    marginTop: spacing.xs,
  },
  rejectedBanner: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: spacing.sm + 2,
    marginTop: spacing.xs,
  },
  postponedBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: spacing.sm + 2,
    marginTop: spacing.xs,
  },
  bannerIcon: {
    fontSize: typography.size.title,
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    ...typography.presets.bodySmallStrong,
    color: colors.text.primary,
    marginBottom: 2,
  },
  bannerText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    lineHeight: typography.lineHeight.tight,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  actionsGrid: {
    gap: spacing.sm,
  },
  acceptButton: {
    backgroundColor: colors.status.success,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  acceptButtonText: {
    ...typography.presets.button,
    color: colors.text.inverse,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  postponeButton: {
    flex: 1,
    backgroundColor: '#FEF3C7',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  postponeButtonText: {
    ...typography.presets.buttonSmall,
    color: '#92400E',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  rejectButtonText: {
    ...typography.presets.buttonSmall,
    color: '#991B1B',
  },
  closeFullButton: {
    backgroundColor: colors.neutral.surfaceSubtle,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  closeFullButtonText: {
    ...typography.presets.button,
    color: colors.text.secondary,
  },
});
