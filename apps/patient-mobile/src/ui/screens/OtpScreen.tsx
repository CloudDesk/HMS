import React, { useEffect, useState } from 'react';
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
import { ErrorDiagnosticView } from '../components/ErrorDiagnosticView';

export function OtpScreen() {
  const { state, verifyOtp, requestOtp, backToPhone } = useAuth();
  const [otp, setOtp] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardView}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>✉️</Text>
            </View>
            <Text style={styles.title}>Verification Code</Text>
            <Text style={styles.subtitle}>
              Enter the 4-digit code sent to{'\n'}
              <Text style={styles.phoneHighlight}>{phone || 'your phone'}</Text>
            </Text>
          </View>

          {state.errorDetails || displayError ? (
            <ErrorDiagnosticView
              error={state.errorDetails ?? displayError}
              onDismiss={localError ? () => setLocalError(null) : undefined}
            />
          ) : null}

          <View style={styles.formGroup}>
            <Text style={styles.label}>4-Digit Code</Text>
            <TextInput
              style={styles.otpInput}
              placeholder="1234"
              placeholderTextColor="#94A3B8"
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
            <Text style={styles.hint}>Development testing code: 1234</Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Verify & Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.actionRow}>
            {secondsRemaining > 0 ? (
              <Text style={styles.cooldownText}>
                Resend code in <Text style={styles.timerHighlight}>{secondsRemaining}s</Text>
              </Text>
            ) : (
              <TouchableOpacity onPress={handleResend} disabled={isSubmitting}>
                <Text style={styles.linkText}>Resend Code</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.backButton}
            onPress={backToPhone}
            disabled={isSubmitting}
          >
            <Text style={styles.backButtonText}>← Change Phone Number</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconText: {
    fontSize: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  phoneHighlight: {
    fontWeight: '600',
    color: '#0F172A',
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    lineHeight: 18,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
    textAlign: 'center',
  },
  otpInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: 8,
  },
  hint: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 6,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#0284C7',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  actionRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  cooldownText: {
    fontSize: 13,
    color: '#64748B',
  },
  timerHighlight: {
    fontWeight: '600',
    color: '#0284C7',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0284C7',
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 13,
    color: '#64748B',
  },
});
