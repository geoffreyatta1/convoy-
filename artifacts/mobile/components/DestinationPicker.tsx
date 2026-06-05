/**
 * DestinationPicker — Inline map overlay (no modal).
 *
 * Renders directly over the map so the user never leaves the map screen:
 *   • Search bar slides in at the top (below safe-area)
 *   • Results drop down below the bar
 *   • Compact route card appears at the bottom once a place is selected
 *   • One "Go" tap starts convoy navigation for everyone
 */

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useConvoy } from "@/context/ConvoyContext";
import { useColors } from "@/hooks/useColors";
import { announceNavStart } from "@/services/tts";
import {
  GeoResult,
  RouteResult,
  fetchRoute,
  formatDistance,
  formatETA,
  geocodeAddress,
} from "@/services/routing";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function DestinationPicker({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { myVehicle, startNavigation } = useConvoy();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<GeoResult | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [fetching, setFetching] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start(() => {
        setTimeout(() => inputRef.current?.focus(), 100);
      });
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
      setQuery("");
      setResults([]);
      setSelected(null);
      setRoute(null);
    }
  }, [visible, slideAnim]);

  if (!visible) return null;

  const handleQueryChange = (text: string) => {
    setQuery(text);
    setSelected(null);
    setRoute(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 3) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const res = await geocodeAddress(text);
      setResults(res);
      setSearching(false);
    }, 400);
  };

  const handleSelect = async (geo: GeoResult) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setSelected(geo);
    setResults([]);
    setFetching(true);
    const origin = myVehicle?.location ?? { latitude: 37.7749, longitude: -122.4194 };
    const result = await fetchRoute(
      origin.latitude,
      origin.longitude,
      geo.latitude,
      geo.longitude
    );
    setRoute(result);
    setFetching(false);
  };

  const handleStart = () => {
    if (!selected || !route) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startNavigation({
      destination: {
        latitude: selected.latitude,
        longitude: selected.longitude,
        name: selected.name,
      },
      route: route.route,
      steps: route.steps,
      currentStepIndex: 0,
      totalDistanceM: route.totalDistanceM,
      totalDurationS: route.totalDurationS,
      totalDurationInTrafficS: route.totalDurationInTrafficS,
    });
    if (route.steps.length > 0) {
      announceNavStart(route.steps[0].instruction);
    }
    onClose();
  };

  const clearQuery = () => {
    setQuery("");
    setResults([]);
    setSelected(null);
    setRoute(null);
    inputRef.current?.focus();
  };

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 0],
  });

  return (
    <>
      {/* ── Backdrop — tapping dismisses search */}
      <Pressable
        style={[StyleSheet.absoluteFill, styles.backdrop]}
        onPress={onClose}
      />

      {/* ── Search bar + results ── */}
      <Animated.View
        style={[
          styles.searchPanel,
          { top: insets.top + 8, transform: [{ translateY }] },
        ]}
        pointerEvents="box-none"
      >
        {/* Search bar row */}
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              ...Platform.select({
                ios: {
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.18,
                  shadowRadius: 10,
                },
                android: { elevation: 8 },
              }),
            },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity onPress={onClose} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search destination…"
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={handleQueryChange}
            returnKeyType="search"
            clearButtonMode="never"
          />
          {searching && (
            <ActivityIndicator size="small" color={colors.primary} style={styles.indicator} />
          )}
          {query.length > 0 && !searching && (
            <TouchableOpacity onPress={clearQuery} hitSlop={8} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
          {query.length === 0 && (
            <Ionicons name="search" size={18} color={colors.mutedForeground} style={styles.indicator} />
          )}
        </View>

        {/* Dropdown results */}
        {results.length > 0 && (
          <View
            style={[
              styles.resultsCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                ...Platform.select({
                  ios: {
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 12,
                  },
                  android: { elevation: 8 },
                }),
              },
            ]}
          >
            <FlatList
              data={results}
              keyExtractor={(_, i) => String(i)}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={results.length > 4}
              style={{ maxHeight: 280 }}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  onPress={() => handleSelect(item)}
                  style={[
                    styles.resultRow,
                    index < results.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <View style={[styles.resultIcon, { backgroundColor: colors.primary + "18" }]}>
                    <Ionicons name="location" size={16} color={colors.primary} />
                  </View>
                  <View style={styles.resultText}>
                    <Text
                      style={[styles.resultName, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    {item.displayName !== item.name && (
                      <Text
                        style={[styles.resultSub, { color: colors.mutedForeground }]}
                        numberOfLines={1}
                      >
                        {item.displayName}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </Animated.View>

      {/* ── Route card at bottom (once a destination is selected) */}
      {selected && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "position" : undefined}
          style={styles.routeCardOuter}
          pointerEvents="box-none"
        >
          <View
            style={[
              styles.routeCard,
              {
                bottom: insets.bottom + 90,
                backgroundColor: colors.card,
                borderColor: colors.border,
                ...Platform.select({
                  ios: {
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: -2 },
                    shadowOpacity: 0.14,
                    shadowRadius: 12,
                  },
                  android: { elevation: 10 },
                }),
              },
            ]}
          >
            {/* Destination row */}
            <View style={styles.destRow}>
              <View style={[styles.destIconWrap, { backgroundColor: colors.primary + "18" }]}>
                <MaterialCommunityIcons name="flag-checkered" size={16} color={colors.primary} />
              </View>
              <Text
                style={[styles.destName, { color: colors.foreground }]}
                numberOfLines={2}
              >
                {selected.name}
              </Text>
              <TouchableOpacity onPress={clearQuery} hitSlop={8}>
                <Ionicons name="close" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {fetching && (
              <View style={styles.fetchingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.fetchingText, { color: colors.mutedForeground }]}>
                  Calculating route…
                </Text>
              </View>
            )}

            {route && !fetching && (
              <>
                <View style={styles.statsRow}>
                  <View style={[styles.statChip, { backgroundColor: colors.primary + "15" }]}>
                    <MaterialCommunityIcons name="map-marker-distance" size={13} color={colors.primary} />
                    <Text style={[styles.statText, { color: colors.primary }]}>
                      {formatDistance(route.totalDistanceM)}
                    </Text>
                  </View>
                  <View style={[styles.statChip, { backgroundColor: colors.accent + "15" }]}>
                    <MaterialCommunityIcons name="clock-outline" size={13} color={colors.accent} />
                    <Text style={[styles.statText, { color: colors.accent }]}>
                      {formatETA(route.totalDurationS)}
                    </Text>
                  </View>
                  <View style={[styles.statChip, { backgroundColor: colors.muted }]}>
                    <MaterialCommunityIcons name="sign-direction" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.statText, { color: colors.mutedForeground }]}>
                      {route.steps.length} turns
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.goBtn, { backgroundColor: colors.primary }]}
                  onPress={handleStart}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons name="navigation" size={18} color="#fff" />
                  <Text style={styles.goBtnText}>Go — Start for All Cars</Text>
                </TouchableOpacity>
              </>
            )}

            {!route && !fetching && (
              <Text style={[styles.noRoute, { color: colors.destructive }]}>
                Could not calculate a route. Try a different address.
              </Text>
            )}
          </View>
        </KeyboardAvoidingView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    zIndex: 40,
    backgroundColor: "rgba(0,0,0,0.28)",
  },

  searchPanel: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 41,
    gap: 6,
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },

  backBtn: {
    padding: 2,
  },

  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },

  indicator: {
    marginLeft: 2,
  },

  clearBtn: {
    padding: 2,
  },

  resultsCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },

  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },

  resultIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  resultText: {
    flex: 1,
    gap: 2,
  },

  resultName: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },

  resultSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },

  routeCardOuter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 41,
    pointerEvents: "box-none",
  },

  routeCard: {
    position: "absolute",
    left: 12,
    right: 12,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },

  destRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  destIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },

  destName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },

  fetchingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  fetchingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },

  statsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },

  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },

  statText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },

  goBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 14,
  },

  goBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },

  noRoute: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
