import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../AuthContext';
import { colors, radius, shadows, spacing, typography } from '../theme';

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
          activeOpacity={0.85}
        >
          {isBusy ? (
            <ActivityIndicator color={colors.text.inverse} size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>{getButtonText()}</Text>
          )}
        </TouchableOpacity>

        {recovery === 'restore' ? (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={logout}
            disabled={isBusy}
            activeOpacity={0.75}
          >
            <Text style={styles.secondaryButtonText}>Sign In with Mobile Instead</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: colors.border.default,
    ...shadows.card,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.status.warningBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.status.warningBorder,
  },
  iconText: {
    fontSize: typography.size.xxl,
  },
  title: {
    ...typography.presets.sectionTitle,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  message: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: typography.lineHeight.normal,
    marginBottom: spacing.xl,
  },
  primaryButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.md,
    height: 48,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.subtle,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: colors.text.inverse,
    ...typography.presets.button,
  },
  secondaryButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.brand.primary,
    ...typography.presets.bodySmallStrong,
  },
});
