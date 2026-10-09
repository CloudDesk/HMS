import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { AppointmentDatePicker } from './AppointmentDatePicker';
import { friendlyError } from '../../api/errors';
import { useAuth } from '../AuthContext';
import { usePatient } from '../../portal/PatientContext';
import { DocumentsApi } from '../../documents/documents-api';
import {
  formatFileSize,
  MAX_DOCUMENT_FILE_SIZE_BYTES,
  SUPPORTED_DOCUMENT_EXTENSIONS,
  SUPPORTED_DOCUMENT_MIME_TYPES,
  validateDocumentFile,
  type PortalDocument,
  type PortalDocumentType,
  type SelectedDocumentFile,
  type UploadDocumentInput,
} from '../../documents/contracts';
import { colors, radius, shadows, spacing, typography } from '../theme';

export {
  MAX_DOCUMENT_FILE_SIZE_BYTES,
  SUPPORTED_DOCUMENT_EXTENSIONS,
  SUPPORTED_DOCUMENT_MIME_TYPES,
  validateDocumentFile,
  type SelectedDocumentFile,
};

export interface UploadDocumentModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (uploadedDocument: PortalDocument) => void;
  documentsApi?: DocumentsApi;
  onPickFile?: () => Promise<{
    uri: string;
    name?: string;
    type?: string;
    size?: number;
  } | null>;
}

export function UploadDocumentModal({
  visible,
  onClose,
  onSuccess,
  documentsApi,
  onPickFile,
}: UploadDocumentModalProps) {
  const { manager } = useAuth();
  const { selectedPatient, selectedPatientId } = usePatient();

  const api = useMemo(
    () => documentsApi ?? new DocumentsApi(manager),
    [documentsApi, manager]
  );

  // Form State
  const [category, setCategory] = useState<PortalDocumentType>('CLINICAL');
  const [title, setTitle] = useState('');
  const [providerName, setProviderName] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<SelectedDocumentFile | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setCategory('CLINICAL');
    setTitle('');
    setProviderName('');
    setDocumentDate('');
    setDescription('');
    setSelectedFile(null);
    setErrorMessage(null);
    setIsSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  }, [isSubmitting, resetForm, onClose]);

  const handleFileResult = useCallback(
    (fileData: { uri: string; name?: string; type?: string; size?: number }) => {
      const validation = validateDocumentFile(fileData);
      if (!validation.valid || !validation.file) {
        setErrorMessage(validation.error || 'Invalid document file.');
        return;
      }
      setSelectedFile(validation.file);
      setErrorMessage(null);
    },
    []
  );

  const handleCustomPick = async () => {
    if (!onPickFile) return;
    setErrorMessage(null);
    try {
      const result = await onPickFile();
      if (!result) return; // User cancelled
      handleFileResult(result);
    } catch {
      setErrorMessage('Failed to select file. Please try again.');
    }
  };

  const handleTakePhoto = async () => {
    setErrorMessage(null);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera Access Required',
          'MyCare needs camera access so you can photograph physical medical documents. Please enable camera permission in device settings.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0 && result.assets[0]) {
        const asset = result.assets[0];
        handleFileResult({
          uri: asset.uri,
          name: asset.fileName || `document-photo-${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
          size: asset.fileSize,
        });
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
          'Media Library Access Required',
          'MyCare needs photo and document library access so you can select records to upload. Please enable permission in device settings.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0 && result.assets[0]) {
        const asset = result.assets[0];
        handleFileResult({
          uri: asset.uri,
          name: asset.fileName || `document-file-${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
          size: asset.fileSize,
        });
      }
    } catch {
      setErrorMessage('Unable to access media library. Please try again.');
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (!selectedPatientId || !selectedPatient) {
      setErrorMessage('Please select a patient profile before uploading documents.');
      return;
    }

    if (!selectedFile) {
      setErrorMessage('Please select a document file to upload.');
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage('Please enter a title for this document.');
      return;
    }

    if (!['CLINICAL', 'INSURANCE', 'OTHER'].includes(category)) {
      setErrorMessage('Please select a valid document category.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const input: UploadDocumentInput = {
        patientId: selectedPatientId,
        documentType: category,
        title: trimmedTitle,
        file: {
          uri: selectedFile.uri,
          name: selectedFile.name,
          type: selectedFile.type,
        },
        providerName: providerName.trim() || undefined,
        documentDate: documentDate.trim() || undefined,
        description: description.trim() || undefined,
      };

      const uploaded = await api.uploadDocument(input);
      resetForm();
      onSuccess?.(uploaded);
      onClose();
    } catch (err: unknown) {
      setErrorMessage(friendlyError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories: { type: PortalDocumentType; label: string; icon: string }[] = [
    { type: 'CLINICAL', label: 'Clinical Record', icon: '🩺' },
    { type: 'INSURANCE', label: 'Insurance', icon: '🛡️' },
    { type: 'OTHER', label: 'Other Document', icon: '📄' },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerTitleGroup}>
                  <Text style={styles.modalTitle}>Upload Document</Text>
                  <Text style={styles.modalSubtitle} numberOfLines={1}>
                    Uploading for: {selectedPatient?.full_name ?? 'Selected Patient'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleClose}
                  disabled={isSubmitting}
                  style={styles.closeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  testID="close-modal-button"
                >
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Error Message Box */}
              {errorMessage ? (
                <View style={styles.errorBox} testID="upload-error-box">
                  <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
                </View>
              ) : null}

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
              >
                {/* 1. File Selection Section */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Document File <Text style={styles.requiredAsterisk}>*</Text>
                  </Text>

                  {selectedFile ? (
                    <View style={styles.selectedFileCard} testID="selected-file-card">
                      <View style={styles.fileIconBox}>
                        <Text style={styles.fileIconText}>
                          {selectedFile.type.includes('pdf') ? '📄' : '🖼️'}
                        </Text>
                      </View>
                      <View style={styles.fileDetailsBox}>
                        <Text style={styles.fileNameText} numberOfLines={1}>
                          {selectedFile.name}
                        </Text>
                        <Text style={styles.fileMetaText}>
                          {selectedFile.type.toUpperCase()}{' '}
                          {selectedFile.size ? `• ${formatFileSize(selectedFile.size)}` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setSelectedFile(null)}
                        disabled={isSubmitting}
                        style={styles.removeFileBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        testID="remove-file-button"
                      >
                        <Text style={styles.removeFileBtnText}>Change</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.filePickerActions}>
                      {onPickFile ? (
                        <TouchableOpacity
                          style={styles.pickerActionBtn}
                          onPress={handleCustomPick}
                          disabled={isSubmitting}
                          activeOpacity={0.75}
                          testID="pick-file-button"
                        >
                          <Text style={styles.pickerActionIcon}>📁</Text>
                          <Text style={styles.pickerActionTitle}>Choose Document / File</Text>
                          <Text style={styles.pickerActionSubtitle}>PDF, PNG, JPG up to 10 MB</Text>
                        </TouchableOpacity>
                      ) : null}

                      <View style={styles.dualPickerRow}>
                        <TouchableOpacity
                          style={styles.halfPickerBtn}
                          onPress={handlePickFromGallery}
                          disabled={isSubmitting}
                          activeOpacity={0.75}
                          testID="pick-gallery-button"
                        >
                          <Text style={styles.pickerActionIcon}>🖼️</Text>
                          <Text style={styles.halfPickerTitle}>Gallery / Files</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.halfPickerBtn}
                          onPress={handleTakePhoto}
                          disabled={isSubmitting}
                          activeOpacity={0.75}
                          testID="pick-camera-button"
                        >
                          <Text style={styles.pickerActionIcon}>📷</Text>
                          <Text style={styles.halfPickerTitle}>Take Photo</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                {/* 2. Category Selection */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Document Category <Text style={styles.requiredAsterisk}>*</Text>
                  </Text>
                  <View style={styles.categoryChipsRow}>
                    {categories.map((cat) => {
                      const isSelected = category === cat.type;
                      return (
                        <TouchableOpacity
                          key={cat.type}
                          style={[
                            styles.categoryChip,
                            isSelected && styles.categoryChipSelected,
                          ]}
                          onPress={() => setCategory(cat.type)}
                          disabled={isSubmitting}
                          activeOpacity={0.75}
                          testID={`category-chip-${cat.type.toLowerCase()}`}
                        >
                          <Text style={styles.categoryChipIcon}>{cat.icon}</Text>
                          <Text
                            style={[
                              styles.categoryChipText,
                              isSelected && styles.categoryChipTextSelected,
                            ]}
                          >
                            {cat.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* 3. Document Title */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Document Title <Text style={styles.requiredAsterisk}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="e.g. Previous Blood Test, MRI Scan, Insurance Card"
                    placeholderTextColor={colors.text.muted}
                    editable={!isSubmitting}
                    testID="document-title-input"
                  />
                </View>

                {/* 4. Provider / Facility Name */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Provider or Facility (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={providerName}
                    onChangeText={setProviderName}
                    placeholder="e.g. City General Hospital, ABC Diagnostics"
                    placeholderTextColor={colors.text.muted}
                    editable={!isSubmitting}
                    testID="provider-name-input"
                  />
                </View>

                {/* 5. Document Date */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Document Date (Optional)</Text>
                  <AppointmentDatePicker
                    value={documentDate}
                    onChange={setDocumentDate}
                    minDate=""
                    showQuickOptions={false}
                    allowClear
                    label="Choose date"
                    disabled={isSubmitting}
                  />
                </View>

                {/* 6. Description / Notes */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Description or Notes (Optional)</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Add any relevant notes or clinical context..."
                    placeholderTextColor={colors.text.muted}
                    multiline
                    numberOfLines={3}
                    editable={!isSubmitting}
                    testID="description-input"
                  />
                </View>

                {/* Guidance Banner */}
                <View style={styles.guidanceBox}>
                  <Text style={styles.guidanceIcon}>🔒</Text>
                  <Text style={styles.guidanceText}>
                    Documents uploaded by patients are marked for clinical verification and stored securely in your patient health record.
                  </Text>
                </View>

                {/* Submit & Cancel Buttons */}
                <View style={styles.actionButtonsContainer}>
                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      (!selectedFile || !title.trim() || isSubmitting) && styles.buttonDisabled,
                    ]}
                    onPress={handleSubmit}
                    disabled={isSubmitting || !selectedFile || !title.trim()}
                    activeOpacity={0.8}
                    testID="submit-upload-button"
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color={colors.text.inverse} testID="upload-activity-indicator" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Upload Document</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={handleClose}
                    disabled={isSubmitting}
                    activeOpacity={0.7}
                    testID="cancel-upload-button"
                  >
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    ...shadows.modal,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  headerTitleGroup: {
    flex: 1,
    marginRight: spacing.sm,
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
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.neutral.surfaceSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    ...typography.presets.bodySmallStrong,
    color: colors.text.secondary,
  },
  errorBox: {
    backgroundColor: colors.status.dangerBg,
    borderColor: colors.status.dangerBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.presets.caption,
    color: colors.status.danger,
    lineHeight: typography.lineHeight.normal,
  },
  scrollContent: {
    paddingBottom: spacing.sm,
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    ...typography.presets.captionStrong,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  requiredAsterisk: {
    color: colors.status.danger,
    fontWeight: typography.weight.bold,
  },
  textInput: {
    backgroundColor: colors.neutral.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    ...typography.presets.bodySmall,
    color: colors.text.primary,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  categoryChipsRow: {
    flexDirection: 'row',
    gap: spacing.xs + 2,
    flexWrap: 'wrap',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.neutral.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: spacing.xs,
  },
  categoryChipSelected: {
    backgroundColor: colors.brand.primarySubtle,
    borderColor: colors.brand.primary,
  },
  categoryChipIcon: {
    fontSize: typography.size.sm,
  },
  categoryChipText: {
    ...typography.presets.captionMedium,
    color: colors.text.secondary,
  },
  categoryChipTextSelected: {
    color: colors.brand.primary,
    fontWeight: typography.weight.bold,
  },
  filePickerActions: {
    gap: spacing.sm,
  },
  pickerActionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.neutral.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
  },
  pickerActionIcon: {
    fontSize: typography.size.xl,
    marginBottom: 2,
  },
  pickerActionTitle: {
    ...typography.presets.bodySmallStrong,
    color: colors.brand.primary,
  },
  pickerActionSubtitle: {
    ...typography.presets.micro,
    color: colors.text.muted,
    marginTop: 2,
  },
  dualPickerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  halfPickerBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
  },
  halfPickerTitle: {
    ...typography.presets.captionStrong,
    color: colors.text.primary,
    marginTop: 2,
  },
  selectedFileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brand.primarySubtle,
    borderWidth: 1,
    borderColor: colors.brand.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  fileIconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.neutral.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  fileIconText: {
    fontSize: typography.size.lg,
  },
  fileDetailsBox: {
    flex: 1,
    marginRight: spacing.sm,
  },
  fileNameText: {
    ...typography.presets.bodySmallStrong,
    color: colors.text.primary,
  },
  fileMetaText: {
    ...typography.presets.micro,
    color: colors.text.secondary,
    marginTop: 1,
  },
  removeFileBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  removeFileBtnText: {
    ...typography.presets.captionStrong,
    color: colors.brand.primary,
  },
  guidanceBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.status.successBg,
    borderWidth: 1,
    borderColor: colors.status.successBorder,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.lg,
    gap: spacing.xs + 2,
  },
  guidanceIcon: {
    fontSize: typography.size.sm,
    marginTop: 1,
  },
  guidanceText: {
    flex: 1,
    ...typography.presets.micro,
    color: colors.status.success,
    lineHeight: typography.lineHeight.tight,
  },
  actionButtonsContainer: {
    gap: spacing.sm,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: colors.brand.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
  primaryButtonText: {
    ...typography.presets.button,
    color: colors.text.inverse,
  },
  secondaryButton: {
    width: '100%',
    backgroundColor: colors.neutral.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    ...typography.presets.buttonSmall,
    color: colors.text.primary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
