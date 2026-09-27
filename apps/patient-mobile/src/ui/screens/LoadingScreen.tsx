import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Loading HMS Patient Portal...' }: LoadingScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoText}>HMS</Text>
        </View>
        <Text style={styles.title}>Patient Portal</Text>
        <ActivityIndicator size="large" color="#0284C7" style={styles.spinner} />
        <Text style={styles.message}>{message}</Text>
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
  content: {
    alignItems: 'center',
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 24,
  },
  spinner: {
    marginBottom: 16,
  },
  message: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
});
