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
  const { state, requestOtp, setAuthMode, clearError } = useAuth();
  const [phone, setPhone] = useState(state.phone ?? '');
  const [localError, setLocalError] = useState<string | null>(null);

  const isRegisterMode = state.authMode === 'register';
  const isSubmitting = state.status === 'requestingOtp';
  const displayError = state.message ?? localError;

  const handleModeChange = (mode: 'login' | 'register') => {
    setLocalError(null);
    clearError();
    setAuthMode(mode);
  };

  const handleSubmit = async () => {
    setLocalError(null);
    clearError();
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
    await requestOtp(cleaned, isRegisterMode ? 'register' : 'login');
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
            <Text style={styles.title}>
              {isRegisterMode ? 'New Patient Registration' : 'Welcome to MyCare'}
            </Text>
            <Text style={styles.subtitle}>
              {isRegisterMode
                ? 'Enter your mobile number to create your MyCare profile and link your health records.'
                : 'Access your appointments, records and care information.'}
            </Text>
          </View>

          {/* Mode Switcher Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, !isRegisterMode && styles.tabButtonActive]}
              onPress={() => handleModeChange('login')}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabButtonText, !isRegisterMode && styles.tabButtonTextActive]}>
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, isRegisterMode && styles.tabButtonActive]}
              onPress={() => handleModeChange('register')}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabButtonText, isRegisterMode && styles.tabButtonTextActive]}>
                New Patient
              </Text>
            </TouchableOpacity>
          </View>

          {state.errorDetails || displayError ? (
            <View style={styles.errorContainer}>
              <ErrorDiagnosticView
                error={state.errorDetails ?? displayError}
                onDismiss={() => {
                  if (localError) setLocalError(null);
                  clearError();
                }}
              />
            </View>
          ) : null}

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              {isRegisterMode ? 'Mobile Number for Registration' : 'Registered Mobile Number'}
            </Text>
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
                  if (state.message || state.errorDetails) clearError();
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
              <Text style={styles.buttonText}>
                {isRegisterMode ? 'Verify Mobile & Continue' : 'Continue to Sign In'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            {isRegisterMode ? (
              <TouchableOpacity
                style={styles.switchModeLink}
                onPress={() => handleModeChange('login')}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                <Text style={styles.switchModePrompt}>
                  Already have an account? <Text style={styles.linkHighlight}>Sign In</Text>
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.switchModeLink}
                onPress={() => handleModeChange('register')}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                <Text style={styles.switchModePrompt}>
                  New patient? <Text style={styles.linkHighlight}>Register here</Text>
                </Text>
              </TouchableOpacity>
            )}
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
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.presets.screenTitle,
    color: colors.text.primary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  subtitle: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: typography.lineHeight.relaxed,
    marginTop: spacing.xs,
    maxWidth: 290,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.surfaceSubtle,
    borderRadius: radius.md,
    padding: spacing.xxs,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  tabButtonActive: {
    backgroundColor: colors.neutral.surface,
    ...shadows.subtle,
  },
  tabButtonText: {
    ...typography.presets.bodySmallStrong,
    color: colors.text.secondary,
  },
  tabButtonTextActive: {
    color: colors.brand.primaryDark,
    fontWeight: typography.weight.bold,
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
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  switchModeLink: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  switchModePrompt: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  linkHighlight: {
    ...typography.presets.bodySmallStrong,
    color: colors.brand.primary,
    fontWeight: typography.weight.bold,
  },
});
