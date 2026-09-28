import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../AuthContext';
import { BrandLogo } from '../components/BrandLogo';
import { ErrorDiagnosticView } from '../components/ErrorDiagnosticView';
import { colors, radius, shadows, spacing, typography } from '../theme';

export function LoginScreen() {
  const { state, requestOtp } = useAuth();
  const [phone, setPhone] = useState(state.phone ?? '');
  const [localError, setLocalError] = useState<string | null>(null);

  const isSubmitting = state.status === 'requestingOtp';
  const displayError = state.message ?? localError;

  const handleSubmit = async () => {
    setLocalError(null);
    const cleaned = phone.trim();
    if (!cleaned) {
      setLocalError('Please enter your mobile number.');
      return;
    }
    const digitsOnly = cleaned.replace(/\D/g, '');
    if (digitsOnly.length < 7) {
      setLocalError('Enter a valid mobile number (at least 7 digits).');
      return;
    }
    await requestOtp(cleaned);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardView}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.header}>
            <BrandLogo size="lg" />
            <Text style={styles.subtitle}>
              Access your appointments, records and care information.
            </Text>
          </View>

          {state.errorDetails || displayError ? (
            <View style={styles.errorContainer}>
              <ErrorDiagnosticView
                error={state.errorDetails ?? displayError}
                onDismiss={localError ? () => setLocalError(null) : undefined}
              />
            </View>
          ) : null}

          <View style={styles.formGroup}>
            <Text style={styles.label}>Registered Mobile Number</Text>
            <View style={styles.inputRow}>
              <View style={styles.countryCodeBadge}>
                <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="9876543210"
                placeholderTextColor={colors.text.muted}
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  if (localError) setLocalError(null);
                }}
                editable={!isSubmitting}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.text.inverse} size="small" />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <View style={styles.footerBadge}>
              <Text style={styles.footerNotice}>
                Existing accounts only. New patient registration and guardian linking must be completed through Patient Web or hospital reception.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border.default,
    ...shadows.card,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  subtitle: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: typography.lineHeight.relaxed,
    marginTop: spacing.sm,
    maxWidth: 280,
  },
  errorContainer: {
    marginBottom: spacing.lg,
  },
  formGroup: {
    marginBottom: spacing.xl,
  },
  label: {
    ...typography.presets.bodySmallStrong,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countryCodeBadge: {
    backgroundColor: colors.neutral.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  countryCodeText: {
    ...typography.presets.bodyMedium,
    color: colors.text.primary,
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.size.base,
    color: colors.text.primary,
    fontWeight: typography.weight.medium,
  },
  button: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: colors.text.inverse,
    ...typography.presets.button,
    letterSpacing: typography.letterSpacing.wide,
  },
  footer: {
    marginTop: spacing.xxl,
  },
  footerBadge: {
    backgroundColor: colors.neutral.surfaceSubtle,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  footerNotice: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: typography.lineHeight.normal,
  },
});
