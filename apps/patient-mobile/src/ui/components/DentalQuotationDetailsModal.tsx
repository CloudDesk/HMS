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
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '50%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    fontSize: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '600',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 20,
    paddingBottom: 16,
  },
  summaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  quoteNumberBlock: {
    flex: 1,
    marginRight: 8,
  },
  doctorName: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '700',
    marginBottom: 2,
  },
  quotationNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
  },
  metaItem: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  optionsList: {
    gap: 8,
  },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  optionCardSelected: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF',
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  optionTotal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0284C7',
  },
  optionDescription: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  itemsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  emptyItemsText: {
    padding: 16,
    fontSize: 13,
    color: '#64748B',
    fontStyle: 'italic',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  itemBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toothBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  toothBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0369A1',
  },
  itemQty: {
    fontSize: 11,
    color: '#64748B',
  },
  itemNotes: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
    fontStyle: 'italic',
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  receiptCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  receiptLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  receiptValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  discountValue: {
    color: '#16A34A',
  },
  receiptTotalRow: {
    borderTopWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 10,
    marginTop: 6,
  },
  receiptTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  receiptTotalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0284C7',
  },
  decisionForm: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 16,
  },
  decisionFormTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 8,
  },
  decisionInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 10,
    fontSize: 13,
    color: '#0F172A',
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  decisionActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  decisionCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  decisionCancelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  decisionConfirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  rejectConfirmBtn: {
    backgroundColor: '#DC2626',
  },
  postponeConfirmBtn: {
    backgroundColor: '#D97706',
  },
  decisionConfirmText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  acceptedBanner: {
    flexDirection: 'row',
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 10,
    marginTop: 4,
  },
  rejectedBanner: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 10,
    marginTop: 4,
  },
  postponedBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 10,
    marginTop: 4,
  },
  bannerIcon: {
    fontSize: 18,
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  bannerText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  actionsGrid: {
    gap: 8,
  },
  acceptButton: {
    backgroundColor: '#16A34A',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  postponeButton: {
    flex: 1,
    backgroundColor: '#FEF3C7',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  postponeButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  rejectButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
  },
  closeFullButton: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeFullButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
});
