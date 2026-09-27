import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type MainTab =
  | 'home'
  | 'appointments'
  | 'records'
  | 'prescriptions'
  | 'billing'
  | 'documents'
  | 'dental'
  | 'notifications'
  | 'profile';

interface BottomNavBarProps {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
}

export function BottomNavBar({ activeTab, onTabChange }: BottomNavBarProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'home' && styles.tabActive]}
        onPress={() => onTabChange('home')}
        activeOpacity={0.7}
      >
        <Text style={[styles.tabIcon, activeTab === 'home' && styles.tabIconActive]}>
          🏠
        </Text>
        <Text style={[styles.tabLabel, activeTab === 'home' && styles.tabLabelActive]}>
          Home
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeTab === 'appointments' && styles.tabActive]}
        onPress={() => onTabChange('appointments')}
        activeOpacity={0.7}
      >
        <Text style={[styles.tabIcon, activeTab === 'appointments' && styles.tabIconActive]}>
          📅
        </Text>
        <Text
          style={[styles.tabLabel, activeTab === 'appointments' && styles.tabLabelActive]}
        >
          Visits
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeTab === 'records' && styles.tabActive]}
        onPress={() => onTabChange('records')}
        activeOpacity={0.7}
      >
        <Text style={[styles.tabIcon, activeTab === 'records' && styles.tabIconActive]}>
          📋
        </Text>
        <Text
          style={[styles.tabLabel, activeTab === 'records' && styles.tabLabelActive]}
        >
          Records
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeTab === 'prescriptions' && styles.tabActive]}
        onPress={() => onTabChange('prescriptions')}
        activeOpacity={0.7}
      >
        <Text
          style={[styles.tabIcon, activeTab === 'prescriptions' && styles.tabIconActive]}
        >
          💊
        </Text>
        <Text
          style={[
            styles.tabLabel,
            activeTab === 'prescriptions' && styles.tabLabelActive,
          ]}
        >
          Medicines
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeTab === 'profile' && styles.tabActive]}
        onPress={() => onTabChange('profile')}
        activeOpacity={0.7}
      >
        <Text style={[styles.tabIcon, activeTab === 'profile' && styles.tabIconActive]}>
          👤
        </Text>
        <Text
          style={[styles.tabLabel, activeTab === 'profile' && styles.tabLabelActive]}
        >
          Profile
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 4,
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 4,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 8,
    minWidth: 54,
  },
  tabActive: {
    backgroundColor: '#F0F9FF',
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 2,
    opacity: 0.6,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  tabLabelActive: {
    color: '#0284C7',
    fontWeight: '700',
  },
});
