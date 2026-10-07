import React from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  formatCurrency,
  formatInvoiceDate,
  getInvoiceStatusLabel,
  getInvoiceStatusStyle,
  type PortalInvoiceDetails,
} from '../../billing/contracts';
import { colors, radius, shadows, spacing, typography } from '../theme';

interface InvoiceDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  invoice: PortalInvoiceDetails | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function InvoiceDetailsModal({
  visible,
  onClose,
  invoice,
  isLoading,
  error,
  onRetry,
}: InvoiceDetailsModalProps) {
  const statusStyle = invoice
    ? getInvoiceStatusStyle(invoice.status)
    : { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };

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
              <Text style={styles.headerIcon}>🧾</Text>
              <Text style={styles.headerTitle}>Invoice Details</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#0284C7" />
              <Text style={styles.loadingText}>Loading invoice details…</Text>
            </View>
          ) : error ? (
            <View style={styles.centerContainer}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorTitle}>Failed to Load Invoice</Text>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : invoice ? (
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Summary Card */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryTopRow}>
                  <View style={styles.invoiceNumberBlock}>
                    <Text style={styles.branchName}>
                      {invoice.branch?.name ?? 'HMS Medical Center'}
                    </Text>
                    <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
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
                      {getInvoiceStatusLabel(invoice.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.summaryMetaRow}>
                  <Text style={styles.summaryMetaItem}>
                    📅 Issued {formatInvoiceDate(invoice.invoice_date)}
                  </Text>
                  {invoice.patient?.patient_number ? (
                    <Text style={styles.summaryMetaItem}>
                      🆔 MRN: {invoice.patient.patient_number}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Patient Information */}
              {invoice.patient ? (
                <View style={styles.patientCard}>
                  <Text style={styles.patientCardLabel}>Patient Information</Text>
                  <Text style={styles.patientName}>{invoice.patient.name}</Text>
                  <Text style={styles.patientContact}>
                    {invoice.patient.phone ?? invoice.patient.email ?? 'Contact on file'}
                  </Text>
                </View>
              ) : null}

              {/* Line Items Table */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Billed Items & Services ({invoice.items.length})
                </Text>
                <View style={styles.itemsCard}>
                  {invoice.items.length === 0 ? (
                    <Text style={styles.emptyItemsText}>
                      No specific line items recorded on this invoice.
                    </Text>
                  ) : (
                    invoice.items.map((item, index) => (
                      <View
                        key={item.id || index}
                        style={[
                          styles.itemRow,
                          index !== invoice.items.length - 1 && styles.itemRowBorder,
                        ]}
                      >
                        <View style={styles.itemInfo}>
                          <Text style={styles.itemName}>{item.service_name}</Text>
                          <View style={styles.itemBadgeRow}>
                            <View style={styles.serviceTypeBadge}>
                              <Text style={styles.serviceTypeText}>
                                {item.service_type.replace(/_/g, ' ')}
                              </Text>
                            </View>
                            <Text style={styles.itemQuantity}>
                              Qty: {item.quantity} × {formatCurrency(item.unit_price)}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.itemTotal}>
                          {formatCurrency(item.line_total)}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              </View>

              {/* Financial Breakdown (Receipt Card) */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Financial Breakdown</Text>
                <View style={styles.receiptCard}>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Subtotal</Text>
                    <Text style={styles.receiptValue}>
                      {formatCurrency(invoice.subtotal)}
                    </Text>
                  </View>

                  {invoice.discount_amount > 0 ? (
                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptLabel}>Discount</Text>
                      <Text style={[styles.receiptValue, styles.discountValue]}>
                        -{formatCurrency(invoice.discount_amount)}
                      </Text>
                    </View>
                  ) : null}

                  {invoice.tax_amount > 0 ? (
                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptLabel}>Taxes & Surcharges</Text>
                      <Text style={styles.receiptValue}>
                        +{formatCurrency(invoice.tax_amount)}
                      </Text>
                    </View>
                  ) : null}

                  <View style={[styles.receiptRow, styles.receiptTotalRow]}>
                    <Text style={styles.receiptTotalLabel}>Total Amount</Text>
                    <Text style={styles.receiptTotalValue}>
                      {formatCurrency(invoice.total_amount)}
                    </Text>
                  </View>

                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Amount Paid</Text>
                    <Text style={[styles.receiptValue, styles.paidValue]}>
                      {formatCurrency(invoice.paid_amount)}
                    </Text>
                  </View>

                  {(() => {
                    const isCancelled = invoice.status?.toUpperCase() === 'CANCELLED';
                    const displayBalance = isCancelled ? 0 : invoice.balance_amount;
                    const isDue = !isCancelled && displayBalance > 0;
                    return (
                      <View
                        style={[
                          styles.receiptRow,
                          styles.receiptBalanceRow,
                          isDue ? styles.receiptBalanceDue : styles.receiptBalancePaid,
                        ]}
                      >
                        <Text
                          style={[
                            styles.receiptBalanceLabel,
                            isDue ? styles.balanceDueText : styles.balanceSettledText,
                          ]}
                        >
                          {isCancelled
                            ? 'Invoice Status'
                            : isDue
                            ? 'Amount Due'
                            : 'Account Status'}
                        </Text>
                        <Text
                          style={[
                            styles.receiptBalanceValue,
                            isDue ? styles.balanceDueText : styles.balanceSettledText,
                          ]}
                        >
                          {isCancelled
                            ? 'Cancelled'
                            : isDue
                            ? formatCurrency(displayBalance)
                            : 'Paid in Full'}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
              </View>

              {/* Payment History */}
              {invoice.payments && invoice.payments.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    Payment History ({invoice.payments.length})
                  </Text>
                  <View style={styles.paymentsCard}>
                    {invoice.payments.map((pmt, pIdx) => (
                      <View
                        key={pmt.id || pIdx}
                        style={[
                          styles.paymentItem,
                          pIdx !== invoice.payments.length - 1 &&
                            styles.paymentItemBorder,
                        ]}
                      >
                        <View style={styles.paymentLeft}>
                          <Text style={styles.paymentNumber}>
                            {pmt.payment_number}
                          </Text>
                          <Text style={styles.paymentMeta}>
                            📅 {formatInvoiceDate(pmt.payment_date)} • 💳{' '}
                            {pmt.payment_method.replace(/_/g, ' ')}
                            {pmt.reference_number ? ` • Ref: ${pmt.reference_number}` : ''}
                          </Text>
                        </View>
                        <Text style={styles.paymentAmount}>
                          {formatCurrency(pmt.amount)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Status Notice / Advisory */}
              {invoice.balance_amount > 0 ? (
                <View style={styles.dueNoticeBanner}>
                  <Text style={styles.dueNoticeIcon}>⚠️</Text>
                  <View style={styles.dueNoticeContent}>
                    <Text style={styles.dueNoticeTitle}>Outstanding Balance</Text>
                    <Text style={styles.dueNoticeText}>
                      {formatCurrency(invoice.balance_amount)} remains outstanding.
                      Online payments are currently disabled. Please settle at any
                      hospital billing counter.
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.settledNoticeBanner}>
                  <Text style={styles.settledNoticeIcon}>✅</Text>
                  <View style={styles.settledNoticeContent}>
                    <Text style={styles.settledNoticeTitle}>Invoice Settled</Text>
                    <Text style={styles.settledNoticeText}>
                      This invoice is fully paid. No further payments are required.
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>
          ) : null}

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.closeFullButton} onPress={onClose}>
              <Text style={styles.closeFullButtonText}>Close</Text>
            </TouchableOpacity>
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
  centerContainer: {
    padding: spacing.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    ...typography.presets.body,
    color: colors.text.secondary,
  },
  errorIcon: {
    fontSize: typography.size.hero,
    marginBottom: spacing.sm,
  },
  errorTitle: {
    ...typography.presets.sectionTitle,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  errorText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.brand.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  retryButtonText: {
    ...typography.presets.buttonSmall,
    color: colors.text.inverse,
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
  invoiceNumberBlock: {
    flex: 1,
    marginRight: spacing.sm,
  },
  branchName: {
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.tight,
    color: colors.text.secondary,
    fontWeight: typography.weight.semibold,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  invoiceNumber: {
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
  summaryMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    paddingTop: spacing.sm + 2,
  },
  summaryMetaItem: {
    ...typography.presets.captionMedium,
    color: colors.text.secondary,
  },
  patientCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.lg,
  },
  patientCardLabel: {
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.tight,
    fontWeight: typography.weight.bold,
    color: colors.text.muted,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  patientName: {
    ...typography.presets.cardTitle,
    color: colors.text.primary,
  },
  patientContact: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.presets.bodyStrong,
    color: colors.text.primary,
    marginBottom: spacing.sm,
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
  serviceTypeBadge: {
    backgroundColor: colors.neutral.surfaceSubtle,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  serviceTypeText: {
    fontSize: typography.size.micro,
    lineHeight: typography.lineHeight.micro,
    fontWeight: typography.weight.bold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
  },
  itemQuantity: {
    ...typography.presets.caption,
    color: colors.text.secondary,
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
  paidValue: {
    color: colors.brand.primary,
  },
  receiptTotalRow: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.default,
    paddingVertical: spacing.sm + 2,
    marginVertical: spacing.xs,
  },
  receiptTotalLabel: {
    ...typography.presets.bodyStrong,
    color: colors.text.primary,
  },
  receiptTotalValue: {
    ...typography.presets.sectionTitle,
    color: colors.text.primary,
  },
  receiptBalanceRow: {
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.xs + 2,
  },
  receiptBalanceDue: {
    backgroundColor: colors.status.dangerBg,
  },
  receiptBalancePaid: {
    backgroundColor: colors.status.successBg,
  },
  receiptBalanceLabel: {
    ...typography.presets.bodySmallStrong,
  },
  receiptBalanceValue: {
    ...typography.presets.bodyStrong,
  },
  balanceDueText: {
    color: '#991B1B',
  },
  balanceSettledText: {
    color: '#166534',
  },
  paymentsCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  paymentItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  paymentLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  paymentNumber: {
    ...typography.presets.bodySmallStrong,
    color: colors.text.primary,
  },
  paymentMeta: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  paymentAmount: {
    ...typography.presets.bodyStrong,
    color: '#166534',
  },
  dueNoticeBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: spacing.sm + 2,
    marginTop: spacing.xs,
  },
  dueNoticeIcon: {
    fontSize: typography.size.title,
  },
  dueNoticeContent: {
    flex: 1,
  },
  dueNoticeTitle: {
    ...typography.presets.bodySmallStrong,
    color: '#92400E',
    marginBottom: 2,
  },
  dueNoticeText: {
    ...typography.presets.caption,
    color: '#78350F',
    lineHeight: typography.lineHeight.tight,
  },
  settledNoticeBanner: {
    flexDirection: 'row',
    backgroundColor: '#F0FDF4',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: spacing.sm + 2,
    marginTop: spacing.xs,
  },
  settledNoticeIcon: {
    fontSize: typography.size.title,
  },
  settledNoticeContent: {
    flex: 1,
  },
  settledNoticeTitle: {
    ...typography.presets.bodySmallStrong,
    color: '#166534',
    marginBottom: 2,
  },
  settledNoticeText: {
    ...typography.presets.caption,
    color: '#14532D',
    lineHeight: typography.lineHeight.tight,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
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
