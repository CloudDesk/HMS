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
import { ErrorDiagnosticView } from '../components/ErrorDiagnosticView';

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
      setLocalError('Please enter your phone number.');
      return;
    }
    const digitsOnly = cleaned.replace(/\D/g, '');
    if (digitsOnly.length < 7) {
      setLocalError('Enter a valid phone number (at least 7 digits).');
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
            <View style={styles.logoBadge}>
              <Text style={styles.logoText}>HMS</Text>
            </View>
            <Text style={styles.title}>Patient Sign In</Text>
            <Text style={styles.subtitle}>
              Access your medical records, appointments, and care history.
            </Text>
          </View>

          {state.errorDetails || displayError ? (
            <ErrorDiagnosticView
              error={state.errorDetails ?? displayError}
              onDismiss={localError ? () => setLocalError(null) : undefined}
            />
          ) : null}

          <View style={styles.formGroup}>
            <Text style={styles.label}>Registered Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="+91 9876543210"
              placeholderTextColor="#94A3B8"
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
            <Text style={styles.hint}>Include your country code (e.g. +91)</Text>
          </View>

          <TouchableOpacity
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.buttonText}>Request OTP</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerNotice}>
              Existing accounts only. New patient registration and guardian linking must be completed via Patient Web or hospital reception.
            </Text>
          </View>
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
    marginBottom: 24,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
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
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0F172A',
  },
  hint: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  button: {
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
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerNotice: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
  },
});
