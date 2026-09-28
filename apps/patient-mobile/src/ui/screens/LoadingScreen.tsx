import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { BrandLogo } from '../components/BrandLogo';
import { colors, spacing, typography } from '../theme';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Loading your health records...' }: LoadingScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <BrandLogo size="lg" showSubtitle />
        <View style={styles.spinnerContainer}>
          <ActivityIndicator size="small" color={colors.brand.primary} />
          <Text style={styles.message}>{message}</Text>
        </View>
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
  content: {
    alignItems: 'center',
    maxWidth: 320,
  },
  spinnerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xxxl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.neutral.surface,
    borderRadius: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  message: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    marginLeft: spacing.md,
    fontWeight: typography.weight.medium,
  },
});
