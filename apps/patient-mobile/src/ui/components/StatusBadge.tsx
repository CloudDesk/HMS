import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

export type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatusBadgeProps {
  label: string;
  variant?: StatusVariant;
  size?: 'sm' | 'md';
}

export function StatusBadge({ label, variant = 'neutral', size = 'md' }: StatusBadgeProps) {
  const getStyleForVariant = () => {
    switch (variant) {
      case 'success':
        return {
          bg: colors.status.successBg,
          text: colors.status.success,
          border: colors.status.successBorder,
        };
      case 'warning':
        return {
          bg: colors.status.warningBg,
          text: colors.status.warning,
          border: colors.status.warningBorder,
        };
      case 'danger':
        return {
          bg: colors.status.dangerBg,
          text: colors.status.danger,
          border: colors.status.dangerBorder,
        };
      case 'info':
        return {
          bg: colors.status.infoBg,
          text: colors.status.info,
          border: colors.status.infoBorder,
        };
      case 'neutral':
      default:
        return {
          bg: colors.neutral.surfaceSubtle,
          text: colors.text.secondary,
          border: colors.border.default,
        };
    }
  };

  const current = getStyleForVariant();

  return (
    <View
      style={[
        styles.badge,
        size === 'sm' && styles.badgeSm,
        {
          backgroundColor: current.bg,
          borderColor: current.border,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          size === 'sm' && styles.textSm,
          { color: current.text },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSm: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: spacing.xxs,
  },
  text: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  textSm: {
    fontSize: 10,
  },
});
