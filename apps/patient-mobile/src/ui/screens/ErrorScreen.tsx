import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../AuthContext';

export function ErrorScreen() {
  const { state, retry, logout } = useAuth();
  const [isBusy, setIsBusy] = useState(false);

  const recovery = state.recovery;
  const message = state.message ?? 'An unexpected error occurred.';

  const handleAction = async () => {
    setIsBusy(true);
    try {
      if (recovery === 'restore' || recovery === 'storage') {
        await retry();
      } else {
        await logout();
      }
    } finally {
      setIsBusy(false);
    }
  };

  const getButtonText = () => {
    if (recovery === 'restore') return 'Retry Connection';
    if (recovery === 'storage') return 'Retry Storage Access';
    return 'Return to Sign In';
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>⚠️</Text>
        </View>
        <Text style={styles.title}>Attention Required</Text>
        <Text style={styles.message}>{message}</Text>

        <TouchableOpacity
          style={[styles.primaryButton, isBusy && styles.buttonDisabled]}
          onPress={handleAction}
          disabled={isBusy}
          activeOpacity={0.8}
        >
          {isBusy ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>{getButtonText()}</Text>
          )}
        </TouchableOpacity>

        {recovery === 'restore' ? (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={logout}
            disabled={isBusy}
          >
            <Text style={styles.secondaryButtonText}>Sign In with Phone Instead</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#0284C7',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 8,
  },
  secondaryButtonText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
});
