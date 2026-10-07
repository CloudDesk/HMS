import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import { useConsentPreview } from '../../consents/useConsentPreview';
import { consentPreviewHtml } from '../../consents/consent-html';
import { friendlyError } from '../../api/errors';
import {
  formatConsentDate,
  getConsentStatusLabel,
  getConsentStatusVariant,
  type ConsentItem,
} from '../../consents/contracts';
import { formatFileSize } from '../../documents/contracts';
import { StatusBadge } from './StatusBadge';
import { colors, radius, shadows, spacing, typography } from '../theme';

interface ConsentSignatureModalProps {
  visible: boolean;
  onClose: () => void;
  consent: ConsentItem | null;
  onUploadSignature: (
    consentId: string,
    file: { uri: string; name?: string; type?: string }
  ) => Promise<void>;
}

export function ConsentSignatureModal({
  visible,
  onClose,
  consent,
  onUploadSignature,
}: ConsentSignatureModalProps) {
  const [selectedAsset, setSelectedAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { preview, retry, signatureLoaded, signatureFailed } = useConsentPreview(consent, visible);
  const [formRenderError, setFormRenderError] = useState(false);

  const handleClose = () => {
    if (isSubmitting) return;
    setSelectedAsset(null);
    setErrorMessage(null);
    onClose();
  };

  const handleTakePhoto = async () => {
    setErrorMessage(null);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera Access Required',
          'MyCare needs camera permission so you can photograph your written signature. Please enable camera access in settings.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0 && result.assets[0]) {
        setSelectedAsset(result.assets[0]);
      }
    } catch {
      setErrorMessage('Unable to open camera. Please try again.');
    }
  };

  const handlePickFromGallery = async () => {
    setErrorMessage(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Photo Library Access Required',
          'MyCare needs library permission so you can choose a signature image. Please enable photo access in settings.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0 && result.assets[0]) {
        setSelectedAsset(result.assets[0]);
      }
    } catch {
      setErrorMessage('Unable to access photos. Please try again.');
    }
  };

  const handleSubmit = async () => {
    if (!consent || !selectedAsset) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const ext = selectedAsset.uri.split('.').pop() || 'jpg';
      const fileName = `signature-${consent.id}.${ext}`;
      const mimeType = selectedAsset.mimeType || 'image/jpeg';

      await onUploadSignature(consent.id, {
        uri: selectedAsset.uri,
        name: fileName,
        type: mimeType,
      });

      setSelectedAsset(null);
      onClose();
    } catch (err: unknown) {
      setErrorMessage(friendlyError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!consent) return null;

  const statusVariant = getConsentStatusVariant(consent.status);
  const statusLabel = getConsentStatusLabel(consent.status);

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleClose}
          accessibilityLabel="Close consent modal backdrop"
        />
        <View style={styles.modalContent}>
          {/* Modal Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.modalTitle}>Medical Consent</Text>
              <Text style={styles.modalSubtitle}>Review & Sign Form</Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeBtn}
              disabled={isSubmitting}
              accessibilityLabel="Close modal"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            contentContainerStyle={styles.scrollContent}
          >
                {/* Status & Title Card */}
                <View style={styles.consentCard}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.consentFormTitle}>{consent.title}</Text>
                    <StatusBadge label={statusLabel} variant={statusVariant} size="sm" />
                  </View>

                  {consent.description ? (
                    <Text style={styles.consentDescription}>{consent.description}</Text>
                  ) : null}

                  <View style={styles.metaDivider} />

                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Document File:</Text>
                    <Text style={styles.metaValue}>{consent.form_file_name}</Text>
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>File Size:</Text>
                    <Text style={styles.metaValue}>{formatFileSize(consent.form_file_size_bytes)}</Text>
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Issued Date:</Text>
                    <Text style={styles.metaValue}>{formatConsentDate(consent.created_at)}</Text>
                  </View>

                  {consent.provider_name ? (
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Issuing Facility:</Text>
                      <Text style={styles.metaValue}>{consent.provider_name}</Text>
                    </View>
                  ) : null}

                  {consent.is_signed && consent.signature_uploaded_at ? (
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Signature Recorded:</Text>
                      <Text style={[styles.metaValue, { color: colors.status.success }]}>
                        {formatConsentDate(consent.signature_uploaded_at)}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.previewLabel}>Consent Form</Text>
                {!preview || preview.formLoading ? <ActivityIndicator accessibilityLabel="Loading consent form" /> : null}
                {preview?.html ? (
                  <View style={{ height: 360, marginBottom: spacing.md }}>
                    <WebView
                      key={preview.key}
                      source={{ html: consentPreviewHtml(preview.html), baseUrl: 'about:blank' }}
                      style={{ flex: 1 }}
                      javaScriptEnabled={false}
                      domStorageEnabled={false}
                      allowFileAccess={false}
                      cacheEnabled={false}
                      incognito
                      nestedScrollEnabled
                      originWhitelist={['*']}
                      onShouldStartLoadWithRequest={(request) =>
                        request.url === 'about:blank' || request.url.startsWith('data:')
                      }
                      onLoadStart={() => setFormRenderError(false)}
                      onError={() => setFormRenderError(true)}
                      accessibilityLabel="Consent form content"
                    />
                  </View>
                ) : null}
                {preview?.formError || formRenderError ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{preview?.formError ?? 'Unable to display the consent form.'}</Text>
                    <TouchableOpacity onPress={() => { setFormRenderError(false); retry(); }}>
                      <Text style={styles.cancelPreviewText}>Retry form preview</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {consent.signature_document_id ? (
                  <View style={styles.previewContainer}>
                    <Text style={styles.previewLabel}>Recorded Signature</Text>
                    {!preview || preview.signatureLoading ? <ActivityIndicator accessibilityLabel="Loading recorded signature" /> : null}
                    {preview?.signature && !preview.signatureError ? (
                      <View style={styles.previewImageWrapper}>
                        <Image key={preview.key} source={preview.signature} style={styles.previewImage}
                          accessibilityLabel="Recorded consent signature"
                          onLoad={signatureLoaded} onError={signatureFailed} />
                      </View>
                    ) : null}
                    {preview?.signatureError ? (
                      <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{preview.signatureError}</Text>
                        <TouchableOpacity onPress={retry}>
                          <Text style={styles.cancelPreviewText}>Retry signature preview</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {/* Important Patient Notice */}
                <View style={styles.guidanceBox}>
                  <Text style={styles.guidanceIcon}>🛡️</Text>
                  <Text style={styles.guidanceText}>
                    By uploading your signature image, you verify that you have read and agreed to the medical consent terms outlined in this hospital form.
                  </Text>
                </View>

                {/* Signature Preview Area */}
                {selectedAsset ? (
                  <View style={styles.previewContainer}>
                    <Text style={styles.previewLabel}>New Signature Preview:</Text>
                    <View style={styles.previewImageWrapper}>
                      <Image source={{ uri: selectedAsset.uri }} style={styles.previewImage} />
                    </View>
                    <TouchableOpacity
                      style={styles.cancelPreviewBtn}
                      onPress={() => setSelectedAsset(null)}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.cancelPreviewText}>Choose Different Image</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* Error Message */}
                {errorMessage ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                ) : null}

                {/* Signature Action Buttons */}
                {!selectedAsset ? (
                  <View style={styles.actionsContainer}>
                    <TouchableOpacity
                      style={styles.primaryActionBtn}
                      onPress={handleTakePhoto}
                      activeOpacity={0.8}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.actionBtnIcon}>📷</Text>
                      <Text style={styles.actionBtnText}>
                        {consent.is_signed ? 'Photograph New Signature' : 'Photograph Signature'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.secondaryActionBtn}
                      onPress={handlePickFromGallery}
                      activeOpacity={0.8}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.secondaryActionBtnIcon}>🖼️</Text>
                      <Text style={styles.secondaryActionBtnText}>
                        {consent.is_signed ? 'Choose from Photo Library' : 'Choose Signature from Gallery'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.saveBtn, isSubmitting && styles.saveBtnDisabled]}
                    onPress={handleSubmit}
                    activeOpacity={0.8}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color={colors.text.inverse} />
                    ) : (
                      <Text style={styles.saveBtnText}>
                        {consent.is_signed ? 'Update & Submit Signature' : 'Confirm & Submit Signature'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalContent: {
    width: '100%',
    maxHeight: '92%',
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xs,
    flexShrink: 1,
    overflow: 'hidden',
    ...shadows.card,
  },
  scrollArea: {
    flexShrink: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  modalTitle: {
    ...typography.presets.sectionTitle,
    color: colors.text.primary,
  },
  modalSubtitle: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.neutral.surfaceSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    fontWeight: typography.weight.bold,
  },
  scrollContent: {
    paddingBottom: spacing.xxl + 32,
  },
  consentCard: {
    backgroundColor: colors.neutral.surfaceSubtle,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.md,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  consentFormTitle: {
    ...typography.presets.cardTitle,
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing.sm,
  },
  consentDescription: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    lineHeight: typography.lineHeight.normal,
    marginTop: spacing.xs,
  },
  metaDivider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginVertical: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  metaLabel: {
    ...typography.presets.micro,
    color: colors.text.muted,
  },
  metaValue: {
    ...typography.presets.captionMedium,
    color: colors.text.primary,
  },
  guidanceBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  guidanceIcon: {
    fontSize: typography.size.subtitle,
    marginRight: spacing.sm,
    marginTop: 1,
  },
  guidanceText: {
    flex: 1,
    ...typography.presets.caption,
    color: '#1E40AF',
    lineHeight: typography.lineHeight.normal,
  },
  previewContainer: {
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  previewLabel: {
    ...typography.presets.captionStrong,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    alignSelf: 'flex-start',
  },
  previewImageWrapper: {
    width: '100%',
    height: 160,
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  cancelPreviewBtn: {
    marginTop: spacing.xs,
    padding: spacing.xs,
  },
  cancelPreviewText: {
    ...typography.presets.captionStrong,
    color: colors.brand.primary,
  },
  errorBox: {
    backgroundColor: colors.status.dangerBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.status.dangerBorder,
  },
  errorText: {
    ...typography.presets.captionMedium,
    color: colors.status.danger,
    textAlign: 'center',
  },
  actionsContainer: {
    gap: spacing.sm,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    ...shadows.subtle,
  },
  actionBtnIcon: {
    fontSize: typography.size.md,
    marginRight: spacing.xs,
  },
  actionBtnText: {
    ...typography.presets.button,
    color: colors.text.inverse,
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  secondaryActionBtnIcon: {
    fontSize: typography.size.md,
    marginRight: spacing.xs,
  },
  secondaryActionBtnText: {
    ...typography.presets.bodySmallMedium,
    color: colors.text.primary,
  },
  saveBtn: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    ...typography.presets.button,
    color: colors.text.inverse,
  },
});
