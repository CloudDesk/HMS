import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
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
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const isRegisterMode = state.authMode === 'register';
  const isSubmitting = state.status === 'requestingOtp';
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const displayError = state.message ?? localError;

  // Calculate cooldown countdown for rate limiting / resend
  useEffect(() => {
    const calculateRemaining = () => {
      if (!state.resendAt) return 0;
      const remainingMs = state.resendAt - Date.now();
      return Math.max(0, Math.ceil(remainingMs / 1000));
    };

    setSecondsRemaining(calculateRemaining());
    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setSecondsRemaining(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [state.resendAt]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleInputFocus = useCallback(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 120);
  }, []);

  const handleModeChange = (mode: 'login' | 'register') => {
    Keyboard.dismiss();
    setLocalError(null);
    clearError();
    setAuthMode(mode);
  };

  const handleSubmit = async () => {
    if (isSubmitting || secondsRemaining > 0) return;
    Keyboard.dismiss();
    setLocalError(null);
    clearError();
    const cleaned = phone.trim();
    if (!cleaned) {
      setLocalError('Please enter your mobile number.');
      return;
    }
    const digitsOnly = cleaned.replace(/\D/g, '');
    if (digitsOnly.length !== 10) {
      setLocalError('Enter a valid 10-digit mobile number.');
      return;
    }
    await requestOtp(digitsOnly, isRegisterMode ? 'register' : 'login');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardView}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContainer,
            keyboardHeight > 0 && {
              paddingBottom: keyboardHeight + spacing.xl,
              justifyContent: 'flex-start',
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.header}>
              <BrandLogo size="lg" showTitle={false} />
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
                  ref={inputRef}
                  style={[styles.input, displayError ? styles.inputError : undefined]}
                  placeholder="9876543210"
                  placeholderTextColor={colors.text.muted}
                  keyboardType="number-pad"
                  maxLength={10}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={phone}
                  onFocus={handleInputFocus}
                  onChangeText={(text) => {
                    const digitsOnly = text.replace(/\D/g, '').slice(0, 10);
                    setPhone(digitsOnly);
                    if (localError) setLocalError(null);
                    if (state.message || state.errorDetails) clearError();
                  }}
                  editable={!isSubmitting}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, (isSubmitting || secondsRemaining > 0) && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting || secondsRemaining > 0}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.text.inverse} size="small" />
              ) : secondsRemaining > 0 ? (
                <Text style={styles.buttonText}>
                  Please wait {secondsRemaining}s
                </Text>
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
      </TouchableWithoutFeedback>
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
  inputError: {
    borderColor: colors.status.danger,
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
