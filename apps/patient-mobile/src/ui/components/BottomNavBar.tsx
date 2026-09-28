import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, shadows, spacing, typography } from '../theme';

export type MainTab =
  | 'home'
  | 'appointments'
  | 'records'
  | 'prescriptions'
  | 'billing'
  | 'documents'
  | 'dental'
  | 'consents'
  | 'notifications'
  | 'profile';

interface BottomNavBarProps {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
}

export function BottomNavBar({ activeTab, onTabChange }: BottomNavBarProps) {
  const tabs: { key: MainTab; label: string; icon: string }[] = [
    { key: 'home', label: 'Home', icon: '🏠' },
    { key: 'appointments', label: 'Visits', icon: '📅' },
    { key: 'records', label: 'Records', icon: '📋' },
    { key: 'prescriptions', label: 'Medicines', icon: '💊' },
    { key: 'profile', label: 'Profile', icon: '👤' },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onTabChange(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>
              {tab.icon}
            </Text>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    justifyContent: 'space-around',
    alignItems: 'center',
    ...shadows.subtle,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    minWidth: 58,
  },
  tabActive: {
    backgroundColor: colors.brand.primarySubtle,
  },
  tabIcon: {
    fontSize: typography.size.title,
    marginBottom: 2,
    opacity: 0.65,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    ...typography.presets.captionMedium,
    color: colors.text.secondary,
  },
  tabLabelActive: {
    color: colors.brand.primaryDark,
    fontWeight: typography.weight.bold,
  },
});
