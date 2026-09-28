import React, { useEffect, useRef, useState } from 'react';
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

export function OtpScreen() {
  const { state, verifyOtp, requestOtp, backToPhone } = useAuth();
  const [otp, setOtp] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const inputRef = useRef<TextInput>(null);

  const phone = state.phone ?? '';
  const isSubmitting = state.status === 'requestingOtp';
  const displayError = state.message ?? localError;

  // Calculate resend cooldown countdown
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

  const handleVerify = async () => {
    setLocalError(null);
    const cleaned = otp.trim();
    if (cleaned.length !== 4 || !/^\d{4}$/.test(cleaned)) {
      setLocalError('Please enter the 4-digit verification code.');
      return;
    }
    await verifyOtp(cleaned);
  };

  const handleResend = async () => {
    if (secondsRemaining > 0 || isSubmitting || !phone) return;
    setLocalError(null);
    setOtp('');
    await requestOtp(phone);
  };

  const digits = [otp[0] ?? '', otp[1] ?? '', otp[2] ?? '', otp[3] ?? ''];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardView}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.header}>
            <BrandLogo size="md" />
            <Text style={styles.title}>Verify your MyCare account</Text>
            <Text style={styles.subtitle}>
              Enter the 4-digit verification code sent to{'\n'}
              <Text style={styles.phoneHighlight}>{phone || 'your mobile number'}</Text>
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

          {/* OTP Digit Boxes */}
          <TouchableOpacity
            style={styles.otpBoxesContainer}
            activeOpacity={1}
            onPress={() => inputRef.current?.focus()}
          >
            {digits.map((digit, index) => {
              const isFilled = Boolean(digit);
              const isCurrent = otp.length === index;
              return (
                <View
                  key={index}
                  style={[
                    styles.otpBox,
                    isFilled && styles.otpBoxFilled,
                    isCurrent && styles.otpBoxActive,
                  ]}
                >
                  <Text style={styles.otpDigitText}>{digit}</Text>
                </View>
              );
            })}
          </TouchableOpacity>

          {/* Hidden text input for native keyboard handling */}
          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            keyboardType="number-pad"
            maxLength={4}
            autoFocus
            value={otp}
            onChangeText={(text) => {
              const numeric = text.replace(/\D/g, '');
              setOtp(numeric);
              if (localError) setLocalError(null);
            }}
            editable={!isSubmitting}
          />

          <TouchableOpacity
            style={[styles.primaryButton, (isSubmitting || otp.length < 4) && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={isSubmitting || otp.length < 4}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.text.inverse} size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Verify & Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.resendSection}>
            <Text style={styles.resendPrompt}>Didn't receive the code?</Text>
            {secondsRemaining > 0 ? (
              <Text style={styles.cooldownText}>
                Resend code in <Text style={styles.timerHighlight}>{secondsRemaining}s</Text>
              </Text>
            ) : (
              <TouchableOpacity onPress={handleResend} disabled={isSubmitting} activeOpacity={0.7}>
                <Text style={styles.linkText}>Resend Code</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.backButton}
            onPress={backToPhone}
            disabled={isSubmitting}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonText}>← Change Mobile Number</Text>
          </TouchableOpacity>
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
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: typography.lineHeight.normal,
  },
  phoneHighlight: {
    fontWeight: typography.weight.bold,
    color: colors.brand.primaryDark,
  },
  errorContainer: {
    marginBottom: spacing.lg,
  },
  otpBoxesContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.xxl,
    marginTop: spacing.sm,
  },
  otpBox: {
    width: 52,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    backgroundColor: colors.neutral.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxFilled: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.neutral.surface,
  },
  otpBoxActive: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.primarySubtle,
  },
  otpDigitText: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  primaryButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.text.inverse,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.2,
  },
  resendSection: {
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  resendPrompt: {
    fontSize: typography.size.xs + 1,
    color: colors.text.muted,
    marginBottom: spacing.xs,
  },
  cooldownText: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    fontWeight: typography.weight.medium,
  },
  timerHighlight: {
    fontWeight: typography.weight.bold,
    color: colors.brand.primaryDark,
  },
  linkText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.brand.primary,
  },
  backButton: {
    marginTop: spacing.lg,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  backButtonText: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    fontWeight: typography.weight.medium,
  },
});
