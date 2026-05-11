import { BlurView } from "expo-blur";
import { Redirect, Tabs } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useConvoy } from "@/context/ConvoyContext";

/**
 * Global PTT-while-backgrounded toast that floats above all tabs.
 * Shown whenever bgPttWarning is true, regardless of which tab is active.
 * The individual Map and Convoy screens also render the banner for visual
 * consistency within their own stacking context; this overlay catches the
 * Settings and Convoys tabs where no per-screen banner exists.
 */
function BgPttOverlay() {
  const { bgPttWarning, dismissBgPttWarning } = useConvoy();
  const insets = useSafeAreaInsets();
  if (!bgPttWarning) return null;
  return (
    <View
      pointerEvents="box-none"
      style={[styles.overlayContainer, { top: insets.top + 8 }]}
    >
      <View style={styles.overlayBanner}>
        <MaterialCommunityIcons name="microphone-off" size={16} color="#fff" />
        <Text style={styles.overlayText} numberOfLines={2}>
          Transmission missed — open the app to talk
        </Text>
        <TouchableOpacity
          onPress={dismissBgPttWarning}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons name="close" size={16} color="#fde68a" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { session, isLoading } = useAuth();
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme !== "light";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  if (!isLoading && !session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
          headerShown: false,
          tabBarStyle: {
            position: "absolute",
            backgroundColor: isIOS ? "transparent" : colors.card,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            elevation: 0,
            ...(isWeb ? { height: 84 } : {}),
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "600",
          },
          tabBarBackground: () =>
            isIOS ? (
              <BlurView
                intensity={100}
                tint={isDark ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
            ) : isWeb ? (
              <View
                style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]}
              />
            ) : null,
        }}
      >
        <Tabs.Screen
          name="convoy"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="map"
          options={{
            title: "Map",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="map" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="convoys"
          options={{
            title: "Convoys",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
      {/* Global overlay: visible on ALL tabs so the warning is never missed */}
      <BgPttOverlay />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlayContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
    pointerEvents: "box-none",
  },
  overlayBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#92400e",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  overlayText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#fff",
  },
});
