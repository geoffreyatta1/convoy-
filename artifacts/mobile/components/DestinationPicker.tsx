/**
 * DestinationPicker — Address search + route fetch modal.
 *
 * Leader types an address → Google Places Text Search geocodes it →
 * Google Directions API fetches the encoded polyline + turn steps →
 * startNavigation() broadcasts the full route + steps to all convoy members.
 */

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

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
  const { myVehicle, startNavigation } = useConvoy();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<GeoResult | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [fetching, setFetching] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      setQuery("");
      setResults([]);
      setSelected(null);
      setRoute(null);
    }
  }, [visible]);

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
    }, 500);
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
    });
    if (route.steps.length > 0) {
      announceNavStart(route.steps[0].instruction);
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Set Destination</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="search" size={18} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Search for a place or address…"
              placeholderTextColor={colors.mutedForeground}
              value={query}
              onChangeText={handleQueryChange}
              autoFocus
              returnKeyType="search"
            />
            {searching && <ActivityIndicator size="small" color={colors.primary} />}
            {query.length > 0 && !searching && (
              <TouchableOpacity onPress={() => { setQuery(""); setResults([]); }}>
                <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {results.length > 0 && (
          <FlatList
            data={results}
            keyExtractor={(_, i) => String(i)}
            style={styles.resultList}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleSelect(item)}
                style={[styles.resultItem, { borderBottomColor: colors.border }]}
              >
                <Ionicons name="location" size={18} color={colors.primary} style={styles.resultIcon} />
                <View style={styles.resultText}>
                  <Text style={[styles.resultName, { color: colors.foreground }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.resultSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {item.displayName}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}

        {selected && (
          <View style={[styles.routeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.destRow}>
              <MaterialCommunityIcons name="flag-checkered" size={20} color={colors.primary} />
              <Text style={[styles.destName, { color: colors.foreground }]} numberOfLines={2}>
                {selected.name}
              </Text>
            </View>

            {fetching && (
              <View style={styles.fetchingRow}>
                <ActivityIndicator color={colors.primary} />
                <Text style={[styles.fetchingText, { color: colors.mutedForeground }]}>
                  Calculating route…
                </Text>
              </View>
            )}

            {route && !fetching && (
              <>
                <View style={styles.routeStats}>
                  <View style={[styles.statChip, { backgroundColor: colors.primary + "18" }]}>
                    <MaterialCommunityIcons name="map-marker-distance" size={14} color={colors.primary} />
                    <Text style={[styles.statText, { color: colors.primary }]}>
                      {formatDistance(route.totalDistanceM)}
                    </Text>
                  </View>
                  <View style={[styles.statChip, { backgroundColor: colors.accent + "18" }]}>
                    <MaterialCommunityIcons name="clock-outline" size={14} color={colors.accent} />
                    <Text style={[styles.statText, { color: colors.accent }]}>
                      {formatETA(route.totalDurationS)}
                    </Text>
                  </View>
                  <View style={[styles.statChip, { backgroundColor: colors.card }]}>
                    <MaterialCommunityIcons name="sign-direction" size={14} color={colors.mutedForeground} />
                    <Text style={[styles.statText, { color: colors.mutedForeground }]}>
                      {route.steps.length} turns
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.startBtn, { backgroundColor: colors.primary }]}
                  onPress={handleStart}
                >
                  <MaterialCommunityIcons name="navigation" size={18} color="#fff" />
                  <Text style={styles.startBtnText}>Start Navigation for All Cars</Text>
                </TouchableOpacity>
              </>
            )}

            {!route && !fetching && (
              <Text style={[styles.noRoute, { color: colors.destructive }]}>
                Could not calculate a route. Try a different address.
              </Text>
            )}
          </View>
        )}

        {!selected && results.length === 0 && query.length === 0 && (
          <View style={styles.emptyHint}>
            <MaterialCommunityIcons name="map-search" size={48} color={colors.mutedForeground + "60"} />
            <Text style={[styles.hintTitle, { color: colors.mutedForeground }]}>
              Where is the convoy heading?
            </Text>
            <Text style={[styles.hintSub, { color: colors.mutedForeground + "99" }]}>
              Search for a destination and the route will sync to everyone in the convoy.
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  closeBtn: {
    padding: 4,
  },
  searchRow: {
    padding: 16,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  resultList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  resultIcon: {
    marginTop: 2,
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
  routeCard: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  destRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  destName: {
    flex: 1,
    fontSize: 16,
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
  routeStats: {
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
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 14,
  },
  startBtnText: {
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
  emptyHint: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  hintTitle: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  hintSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
});
