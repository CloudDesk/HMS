import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  showTitle?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const logoSource = require('../../../assets/logo.png');

export function BrandLogo({
  size = 'md',
  showSubtitle = false,
  showTitle = true,
}: BrandLogoProps) {
  const iconSize = size === 'sm' ? 40 : size === 'lg' ? 80 : 56;

  return (
    <View style={styles.container}>
      <Image
        source={logoSource}
        style={[
          styles.logoImage,
          { width: iconSize, height: iconSize },
          !showTitle && !showSubtitle && { marginBottom: 0 },
        ]}
        resizeMode="contain"
      />

      {showTitle || showSubtitle ? (
        <View style={styles.textContainer}>
          {showTitle ? (
            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.title,
                  size === 'sm' && styles.titleSm,
                  size === 'lg' && styles.titleLg,
                ]}
              >
                MyCare
              </Text>
            </View>
          ) : null}
          {showSubtitle ? (
            <Text style={styles.subtitle}>Your care, connected.</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    marginBottom: spacing.xs,
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
    marginTop: spacing.xxs,
    fontWeight: typography.weight.medium,
  },
});
