import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadows, spacing, typography } from '../theme';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}

export function BrandLogo({ size = 'md', showSubtitle = false }: BrandLogoProps) {
  const iconSize = size === 'sm' ? 36 : size === 'lg' ? 64 : 48;
  const badgeRadius = size === 'sm' ? radius.sm : size === 'lg' ? radius.lg : radius.md;
  const crossSize = size === 'sm' ? 18 : size === 'lg' ? 32 : 24;
  const crossBar = size === 'sm' ? 4 : size === 'lg' ? 8 : 6;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.emblemContainer,
          {
            width: iconSize,
            height: iconSize,
            borderRadius: badgeRadius,
          },
        ]}
      >
        {/* Horizontal bar of medical cross */}
        <View
          style={[
            styles.crossBar,
            {
              width: crossSize,
              height: crossBar,
              borderRadius: crossBar / 2,
            },
          ]}
        />
        {/* Vertical bar of medical cross */}
        <View
          style={[
            styles.crossBar,
            styles.crossBarVertical,
            {
              width: crossBar,
              height: crossSize,
              borderRadius: crossBar / 2,
            },
          ]}
        />
      </View>

      <View style={styles.textContainer}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, size === 'sm' && styles.titleSm, size === 'lg' && styles.titleLg]}>
            MyCare
          </Text>
        </View>
        {showSubtitle ? (
          <Text style={styles.subtitle}>Your care, connected.</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemContainer: {
    backgroundColor: colors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.card,
  },
  crossBar: {
    backgroundColor: '#FFFFFF',
    position: 'absolute',
  },
  crossBarVertical: {
    position: 'absolute',
  },
  textContainer: {
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  titleSm: {
    fontSize: typography.size.md,
  },
  titleLg: {
    fontSize: typography.size.xxl,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    fontWeight: typography.weight.medium,
  },
});
