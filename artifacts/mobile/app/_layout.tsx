import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ConvoyProvider } from "@/context/ConvoyContext";
import { ProfileProvider } from "@/context/ProfileContext";
import { SubscriptionProvider, useSubscription } from "@/context/SubscriptionContext";
import { setAuthTokenGetter } from "@/services/agora";
import { defineBackgroundLocationTask } from "@/services/background-location";
import { initCarPlay } from "@/services/carplay";
import { initAndroidAuto } from "@/services/androidauto";
import { configureAudioSession } from "@/services/sounds";
import { useCarBridge } from "@/hooks/useCarBridge";

initCarPlay();
initAndroidAuto();
configureAudioSession();
defineBackgroundLocationTask();

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function CarBridge() {
  useCarBridge();
  return null;
}

/**
 * Registers the Supabase session token getter with the Agora service so that
 * joinChannel() can attach a Bearer token when requesting RTC tokens from the API.
 * Must live inside AuthProvider so useAuth() is available.
 */
function AgoraAuthWiring() {
  const { getAccessToken } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(getAccessToken);
  }, [getAccessToken]);
  return null;
}

/**
 * Fetches the real subscription tier from the API whenever the user signs in.
 * Must live inside both AuthProvider and SubscriptionProvider.
 */
function SubscriptionWiring() {
  const { user } = useAuth();
  const { refreshSubscription } = useSubscription();
  useEffect(() => {
    if (user?.id) {
      refreshSubscription(user.id);
    }
  }, [user?.id, refreshSubscription]);
  return null;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <AgoraAuthWiring />
                <ProfileProvider>
                  <SubscriptionProvider>
                    <SubscriptionWiring />
                    <ConvoyProvider>
                      <CarBridge />
                      <RootLayoutNav />
                    </ConvoyProvider>
                  </SubscriptionProvider>
                </ProfileProvider>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
