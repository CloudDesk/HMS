import React, { memo, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import { colors, radius, shadows, spacing, typography } from '../theme';
import { MAIN_SWIPE_TABS } from './SwipeTabContainer';

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
  tabPosition: Animated.Value;
}

const tabs: { key: MainTab; label: string; icon: string }[] = [
  { key: 'home', label: 'Home', icon: '🏠' },
  { key: 'appointments', label: 'Visits', icon: '📅' },
  { key: 'records', label: 'Records', icon: '📋' },
  { key: 'prescriptions', label: 'Medicines', icon: '💊' },
  { key: 'profile', label: 'Profile', icon: '👤' },
];

export const BottomNavBar = memo(function BottomNavBar({
  activeTab,
  onTabChange,
  tabPosition,
}: BottomNavBarProps) {
  const [contentWidth, setContentWidth] = useState(0);
  const isMainTab = MAIN_SWIPE_TABS.includes(activeTab);
  const tabWidth = contentWidth / MAIN_SWIPE_TABS.length;
  const indicatorTranslateX = Animated.multiply(tabPosition, tabWidth);

  const handleLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width > 0 && width !== contentWidth) setContentWidth(width);
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabRow} onLayout={handleLayout}>
        {contentWidth > 0 && isMainTab ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.activeIndicator,
              { width: tabWidth, transform: [{ translateX: indicatorTranslateX }] },
            ]}
          />
        ) : null}
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.key;
          const emphasis = tabPosition.interpolate({
            inputRange: [index - 1, index, index + 1],
            outputRange: [0.68, 1, 0.68],
            extrapolate: 'clamp',
          });
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => onTabChange(tab.key)}
              activeOpacity={0.7}
            >
              <Animated.View style={[styles.tabContent, { opacity: emphasis }]}>
                <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>{tab.icon}</Text>
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
              </Animated.View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    ...shadows.subtle,
  },
  tabRow: {
    width: '100%',
    flexDirection: 'row',
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.md,
    backgroundColor: colors.brand.primarySubtle,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    minWidth: 58,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
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
