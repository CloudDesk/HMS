import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, radius, shadows, spacing, typography } from '../theme';
import { Avatar } from './Avatar';

interface ProfilePhotoModalProps {
  visible: boolean;
  onClose: () => void;
  patientName: string;
  currentPhotoUrl?: string | null;
  onUploadPhoto: (file: { uri: string; name?: string; type?: string }) => Promise<void>;
  onDeletePhoto?: () => Promise<void>;
}

export function ProfilePhotoModal({
  visible,
  onClose,
  patientName,
  currentPhotoUrl,
  onUploadPhoto,
  onDeletePhoto,
}: ProfilePhotoModalProps) {
  const [selectedAsset, setSelectedAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
          'MyCare needs camera permission so you can take a profile photo. Please enable camera access in your device settings.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
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
          'MyCare needs photo library permission so you can choose a profile photo. Please enable library access in your device settings.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0 && result.assets[0]) {
        setSelectedAsset(result.assets[0]);
      }
    } catch {
      setErrorMessage('Unable to open photo library. Please try again.');
    }
  };

  const handleSavePhoto = async () => {
    if (!selectedAsset) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const fileName = selectedAsset.fileName || `photo-${Date.now()}.jpg`;
      const mimeType = selectedAsset.mimeType || 'image/jpeg';
      await onUploadPhoto({
        uri: selectedAsset.uri,
        name: fileName,
        type: mimeType,
      });
      setSelectedAsset(null);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save profile photo. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePhoto = () => {
    if (!onDeletePhoto) return;
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove your profile photo? Your initials will be displayed instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setIsSubmitting(true);
            setErrorMessage(null);
            try {
              await onDeletePhoto();
              onClose();
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Failed to remove photo.';
              setErrorMessage(msg);
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

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
                <Text style={styles.title}>
                  {selectedAsset ? 'Preview Photo' : 'Profile Photo'}
                </Text>
                <TouchableOpacity
                  onPress={handleClose}
                  disabled={isSubmitting}
                  style={styles.closeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
              </View>

              {errorMessage ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
                </View>
              ) : null}

              {/* Preview Mode */}
              {selectedAsset ? (
                <View style={styles.previewContainer}>
                  <View style={styles.previewAvatarWrapper}>
                    <Image
                      source={{ uri: selectedAsset.uri }}
                      style={styles.previewImage}
                      resizeMode="cover"
                    />
                  </View>
                  <Text style={styles.previewSubtitle}>
                    Position your face in the circle for best results.
                  </Text>

                  <TouchableOpacity
                    style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
                    onPress={handleSavePhoto}
                    disabled={isSubmitting}
                    activeOpacity={0.8}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Save Profile Photo</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => setSelectedAsset(null)}
                    disabled={isSubmitting}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.secondaryButtonText}>Choose Another</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* Options Mode */
                <View style={styles.optionsContainer}>
                  <View style={styles.currentAvatarWrapper}>
                    <Avatar
                      name={patientName}
                      photoUrl={currentPhotoUrl}
                      size={96}
                    />
                  </View>
                  <Text style={styles.patientNameText} numberOfLines={1}>
                    {patientName}
                  </Text>

                  {/* Actions */}
                  <TouchableOpacity
                    style={styles.optionButton}
                    onPress={handleTakePhoto}
                    disabled={isSubmitting}
                    activeOpacity={0.75}
                  >
                    <View style={styles.optionIconBox}>
                      <Text style={styles.optionIcon}>📷</Text>
                    </View>
                    <View style={styles.optionTextBox}>
                      <Text style={styles.optionTitle}>Take Photo</Text>
                      <Text style={styles.optionSubtitle}>Use device camera</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.optionButton}
                    onPress={handlePickFromGallery}
                    disabled={isSubmitting}
                    activeOpacity={0.75}
                  >
                    <View style={styles.optionIconBox}>
                      <Text style={styles.optionIcon}>🖼️</Text>
                    </View>
                    <View style={styles.optionTextBox}>
                      <Text style={styles.optionTitle}>Choose from Gallery</Text>
                      <Text style={styles.optionSubtitle}>Select from your photo library</Text>
                    </View>
                  </TouchableOpacity>

                  {currentPhotoUrl && onDeletePhoto ? (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={handleDeletePhoto}
                      disabled={isSubmitting}
                      activeOpacity={0.75}
                    >
                      <View style={styles.deleteIconBox}>
                        <Text style={styles.deleteIcon}>🗑️</Text>
                      </View>
                      <View style={styles.optionTextBox}>
                        <Text style={styles.deleteTitle}>Remove Current Photo</Text>
                        <Text style={styles.deleteSubtitle}>Restore initials avatar</Text>
                      </View>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
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
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
    letterSpacing: -0.2,
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
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    fontWeight: typography.weight.bold,
  },
  errorBox: {
    backgroundColor: colors.status.dangerBg,
    borderColor: colors.status.dangerBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: typography.size.xs,
    color: colors.status.danger,
    lineHeight: typography.lineHeight.normal,
  },
  optionsContainer: {
    alignItems: 'center',
  },
  currentAvatarWrapper: {
    marginVertical: spacing.md,
  },
  patientNameText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  optionButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.neutral.surfaceSubtle,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.sm,
  },
  optionIconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brand.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  optionIcon: {
    fontSize: 20,
  },
  optionTextBox: {
    flex: 1,
  },
  optionTitle: {
    fontSize: typography.size.sm + 1,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
  },
  optionSubtitle: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  deleteButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.status.dangerBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.status.dangerBorder,
    marginTop: spacing.xs,
  },
  deleteIconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: '#FFE5E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  deleteIcon: {
    fontSize: 18,
  },
  deleteTitle: {
    fontSize: typography.size.sm + 1,
    fontWeight: typography.weight.bold,
    color: colors.status.danger,
  },
  deleteSubtitle: {
    fontSize: typography.size.xs,
    color: colors.status.danger,
    marginTop: 2,
    opacity: 0.85,
  },
  previewContainer: {
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
  previewAvatarWrapper: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 3,
    borderColor: colors.brand.primary,
    overflow: 'hidden',
    marginBottom: spacing.md,
    backgroundColor: colors.neutral.surfaceSubtle,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewSubtitle: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: colors.brand.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    ...shadows.subtle,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: typography.size.sm + 1,
    fontWeight: typography.weight.bold,
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
    color: colors.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
