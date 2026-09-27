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

                  <View
                    style={[
                      styles.receiptRow,
                      styles.receiptBalanceRow,
                      invoice.balance_amount > 0
                        ? styles.receiptBalanceDue
                        : styles.receiptBalancePaid,
                    ]}
                  >
                    <Text
                      style={[
                        styles.receiptBalanceLabel,
                        invoice.balance_amount > 0
                          ? styles.balanceDueText
                          : styles.balanceSettledText,
                      ]}
                    >
                      {invoice.balance_amount > 0 ? 'Amount Due' : 'Account Status'}
                    </Text>
                    <Text
                      style={[
                        styles.receiptBalanceValue,
                        invoice.balance_amount > 0
                          ? styles.balanceDueText
                          : styles.balanceSettledText,
                      ]}
                    >
                      {invoice.balance_amount > 0
                        ? formatCurrency(invoice.balance_amount)
                        : 'Paid in Full'}
                    </Text>
                  </View>
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
  centerContainer: {
    padding: 40,
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
  errorText: {
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
  invoiceNumberBlock: {
    flex: 1,
    marginRight: 8,
  },
  branchName: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  invoiceNumber: {
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
  summaryMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
  },
  summaryMetaItem: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  patientCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  patientCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  patientName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  patientContact: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
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
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  itemBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serviceTypeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  serviceTypeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
  },
  itemQuantity: {
    fontSize: 11,
    color: '#64748B',
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
  paidValue: {
    color: '#0284C7',
  },
  receiptTotalRow: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 10,
    marginVertical: 4,
  },
  receiptTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  receiptTotalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  receiptBalanceRow: {
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
  },
  receiptBalanceDue: {
    backgroundColor: '#FEE2E2',
  },
  receiptBalancePaid: {
    backgroundColor: '#DCFCE7',
  },
  receiptBalanceLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  receiptBalanceValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  balanceDueText: {
    color: '#991B1B',
  },
  balanceSettledText: {
    color: '#166534',
  },
  paymentsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  paymentItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  paymentLeft: {
    flex: 1,
    marginRight: 12,
  },
  paymentNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  paymentMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  paymentAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#166534',
  },
  dueNoticeBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 10,
    marginTop: 4,
  },
  dueNoticeIcon: {
    fontSize: 18,
  },
  dueNoticeContent: {
    flex: 1,
  },
  dueNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  dueNoticeText: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 16,
  },
  settledNoticeBanner: {
    flexDirection: 'row',
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 10,
    marginTop: 4,
  },
  settledNoticeIcon: {
    fontSize: 18,
  },
  settledNoticeContent: {
    flex: 1,
  },
  settledNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 2,
  },
  settledNoticeText: {
    fontSize: 12,
    color: '#14532D',
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
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
