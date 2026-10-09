import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Network from 'expo-network';

import { readPublicConfig } from './src/config/config';
import { MobileTransport } from './src/api/transport';
import { AuthApi } from './src/auth/auth-api';
import { createNativeStorage } from './src/storage/native-storage';
import { SessionStore } from './src/storage/session-store';
import { SessionManager } from './src/auth/session-manager';
import { AuthProvider, useAuth } from './src/ui/AuthContext';
import { PatientProvider } from './src/portal/PatientContext';
import { LoadingScreen } from './src/ui/screens/LoadingScreen';
import { LoginScreen } from './src/ui/screens/LoginScreen';
import { OtpScreen } from './src/ui/screens/OtpScreen';
import { RegisterScreen } from './src/ui/screens/RegisterScreen';
import { HomeScreen } from './src/ui/screens/HomeScreen';
import { AppointmentsScreen } from './src/ui/screens/AppointmentsScreen';
import { RecordsScreen } from './src/ui/screens/RecordsScreen';
import { PrescriptionsScreen } from './src/ui/screens/PrescriptionsScreen';
import { BillingScreen } from './src/ui/screens/BillingScreen';
import { DocumentsScreen } from './src/ui/screens/DocumentsScreen';
import { DentalScreen } from './src/ui/screens/DentalScreen';
import { ConsentsScreen } from './src/ui/screens/ConsentsScreen';
import { NotificationsScreen } from './src/ui/screens/NotificationsScreen';
import { ProfileScreen } from './src/ui/screens/ProfileScreen';
import { ErrorScreen } from './src/ui/screens/ErrorScreen';
import { BottomNavBar, type MainTab } from './src/ui/components/BottomNavBar';
import { SwipeTabContainer } from './src/ui/components/SwipeTabContainer';
import { colors } from './src/ui/theme';
import { AppearanceProvider, useAppearance } from './src/ui/appearance';
import { startPushNotifications } from './src/notifications/push-notifications';

export interface NavigationOptions {
  entityId?: string | null;
  patientId?: string | null;
  initialQuotationId?: string | null;
}

function AuthenticatedApp() {
  const { manager } = useAuth();
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [navOptions, setNavOptions] = useState<NavigationOptions | null>(null);
  const tabPosition = useRef(new Animated.Value(0)).current;

  const handleNavigateTab = useCallback((tab: MainTab, options?: NavigationOptions) => {
    setActiveTab(tab);
    setNavOptions(options ?? null);
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let active = true;
    void startPushNotifications(manager, (tab, entityId) => {
      handleNavigateTab(tab, entityId ? { entityId } : undefined);
    }).then((stop) => {
      if (active) cleanup = stop;
      else stop();
    }).catch(() => undefined);
    return () => {
      active = false;
      cleanup?.();
    };
  }, [handleNavigateTab, manager]);

  const renderScreen = (tab: MainTab) => {
    switch (tab) {
      case 'home':
        return <HomeScreen onNavigateTab={handleNavigateTab} />;
      case 'appointments':
        return (
          <AppointmentsScreen
            initialAppointmentId={activeTab === 'appointments' ? navOptions?.entityId : undefined}
          />
        );
      case 'records':
        return <RecordsScreen />;
      case 'prescriptions':
        return <PrescriptionsScreen />;
      case 'billing':
        return (
          <BillingScreen
            onNavigateBack={() => handleNavigateTab('home')}
            initialInvoiceId={activeTab === 'billing' ? navOptions?.entityId : undefined}
          />
        );
      case 'documents':
        return <DocumentsScreen onNavigateBack={() => handleNavigateTab('home')} />;
      case 'dental':
        return (
          <DentalScreen
            onNavigateBack={() => handleNavigateTab('home')}
            initialQuotationId={
              activeTab === 'dental'
                ? (navOptions?.initialQuotationId ?? navOptions?.entityId)
                : undefined
            }
          />
        );
      case 'consents':
        return (
          <ConsentsScreen
            onNavigateBack={() => handleNavigateTab('home')}
            initialConsentId={activeTab === 'consents' ? navOptions?.entityId : undefined}
          />
        );
      case 'notifications':
        return (
          <NotificationsScreen
            onNavigateBack={() => handleNavigateTab('home')}
            onNavigateTab={handleNavigateTab}
          />
        );
      case 'profile':
        return <ProfileScreen onNavigateTab={handleNavigateTab} />;
      default:
        return <HomeScreen onNavigateTab={handleNavigateTab} />;
    }
  };

  return (
    <PatientProvider>
      <View style={styles.authenticatedContainer}>
        <View style={styles.tabContent}>
          <SwipeTabContainer
            activeTab={activeTab}
            onTabChange={(tab) => handleNavigateTab(tab)}
            renderScreen={renderScreen}
            tabPosition={tabPosition}
          />
        </View>
        <BottomNavBar
          activeTab={activeTab}
          onTabChange={(tab) => handleNavigateTab(tab)}
          tabPosition={tabPosition}
        />
      </View>
    </PatientProvider>
  );
}

function NavigationRoot() {
  const { state } = useAuth();

  switch (state.status) {
    case 'initializing':
      return <LoadingScreen message="Restoring secure session..." />;
    case 'refreshing':
      return <LoadingScreen message="Refreshing session..." />;
    case 'loggingOut':
      return <LoadingScreen message="Signing out securely..." />;
    case 'unauthenticated':
    case 'requestingOtp':
      return <LoginScreen />;
    case 'otpVerification':
    case 'verifyingOtp':
    case 'resendingOtp':
      return <OtpScreen />;
    case 'registrationDetails':
    case 'registering':
      return <RegisterScreen />;
    case 'authenticated':
      return <AuthenticatedApp />;
    case 'error':
      return <ErrorScreen />;
    default:
      return <LoadingScreen />;
  }
}

function AppContent() {
  const { resolvedAppearance } = useAppearance();
  const sessionManager = useMemo(() => {
    const config = readPublicConfig();
    const transport = new MobileTransport(config);
    const authApi = new AuthApi(transport);
    const storage = createNativeStorage();
    const sessionStore = new SessionStore(storage, config.apiBaseUrl);

    const isConnected = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        return Boolean(state.isConnected && state.isInternetReachable !== false);
      } catch {
        return false;
      }
    };

    const platform: 'android' | 'ios' = Platform.OS === 'ios' ? 'ios' : 'android';
    const device = { platform, appVersion: '0.1.0' };

    return new SessionManager(authApi, sessionStore, transport, isConnected, device);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle={resolvedAppearance === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.neutral.background}
      />
      <SafeAreaView style={styles.safeArea}>
        <AuthProvider manager={sessionManager}>
          <NavigationRoot />
        </AuthProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <AppearanceProvider>
      <AppContent />
    </AppearanceProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  authenticatedContainer: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  tabContent: {
    flex: 1,
  },
});
