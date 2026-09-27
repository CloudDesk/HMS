import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  formatDocumentDate,
  formatFileSize,
  getDocumentTypeIcon,
  getDocumentTypeLabel,
  getReviewStatusBadge,
  type PortalDocument,
} from '../../documents/contracts';

interface DocumentDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  document: PortalDocument | null;
}

export function DocumentDetailsModal({
  visible,
  onClose,
  document,
}: DocumentDetailsModalProps) {
  if (!document) return null;

  const reviewBadge = getReviewStatusBadge(document.review_status);
  const typeIcon = getDocumentTypeIcon(document.document_type);
  const typeLabel = getDocumentTypeLabel(document.document_type);

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
              <Text style={styles.headerIcon}>{typeIcon}</Text>
              <Text style={styles.headerTitle}>Document Details</Text>
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
            {/* Title & Status Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryTopRow}>
                <View style={styles.titleWrap}>
                  <Text style={styles.documentCategory}>{typeLabel}</Text>
                  <Text style={styles.documentTitle}>{document.title}</Text>
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
                  <Text style={[styles.statusText, { color: reviewBadge.text }]}>
                    {reviewBadge.label}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaItem}>
                  📅 Added {formatDocumentDate(document.created_at)}
                </Text>
                <Text style={styles.metaItem}>
                  📁 {formatFileSize(document.file_size_bytes)}
                </Text>
              </View>
            </View>

            {/* Document Details Metadata */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Document Information</Text>
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>File Name</Text>
                  <Text style={styles.infoValue}>{document.file_name}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Document Format</Text>
                  <Text style={styles.infoValue}>{document.mime_type}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>File Size</Text>
                  <Text style={styles.infoValue}>
                    {formatFileSize(document.file_size_bytes)}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Source</Text>
                  <Text style={styles.infoValue}>
                    {document.source === 'HOSPITAL'
                      ? 'Hospital Issued'
                      : document.source === 'GUARDIAN'
                      ? 'Uploaded by Guardian'
                      : 'Uploaded by Patient'}
                  </Text>
                </View>

                {document.provider_name ? (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Provider / Facility</Text>
                    <Text style={styles.infoValue}>{document.provider_name}</Text>
                  </View>
                ) : null}

                {document.document_date ? (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Document Date</Text>
                    <Text style={styles.infoValue}>
                      {formatDocumentDate(document.document_date)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Description / Notes */}
            {document.description ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Description & Notes</Text>
                <View style={styles.descriptionCard}>
                  <Text style={styles.descriptionText}>{document.description}</Text>
                </View>
              </View>
            ) : null}

            {/* Security & Access Notice */}
            <View style={styles.securityBanner}>
              <Text style={styles.securityIcon}>🔒</Text>
              <View style={styles.securityContent}>
                <Text style={styles.securityTitle}>Secure Record Storage</Text>
                <Text style={styles.securityText}>
                  This medical document is protected under patient health confidentiality
                  rules and verified within your hospital health records.
                </Text>
              </View>
            </View>
          </ScrollView>

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
    maxHeight: '85%',
    minHeight: '40%',
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
  titleWrap: {
    flex: 1,
    marginRight: 8,
  },
  documentCategory: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '700',
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
    color: '#64748B',
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
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    maxWidth: '60%',
    textAlign: 'right',
  },
  descriptionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  descriptionText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  securityBanner: {
    flexDirection: 'row',
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 10,
    marginTop: 4,
  },
  securityIcon: {
    fontSize: 18,
  },
  securityContent: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 2,
  },
  securityText: {
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
