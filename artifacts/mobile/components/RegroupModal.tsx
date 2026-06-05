/**
 * RegroupModal — Find nearby petrol / service stations as convoy regroup points.
 *
 * - Searches the area around the convoy centroid using the free Overpass API.
 * - Leader: can navigate the whole convoy to a selected station.
 * - Non-leader: can suggest a station via the convoy chat.
 */

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useConvoy } from "@/context/ConvoyContext";
import { useColors } from "@/hooks/useColors";
import {
  FuelStation,
  fetchRoute,
  findNearbyFuelStations,
  formatDistance,
} from "@/services/routing";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function RegroupModal({ visible, onClose }: Props) {
  const colors = useColors();
  const {
    session,
    myVehicle,
    isLeader,
    startNavigation,
    regroupPin,
    broadcastRegroupPin,
    clearRegroupPin,
  } = useConvoy();

  const [loading, setLoading] = useState(false);
  const [stations, setStations] = useState<FuelStation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState<number | null>(null);

  const centroid = useCallback(() => {
    const vehicles = session?.vehicles ?? [];
    if (!vehicles.length) return myVehicle?.location ?? { latitude: 37.7749, longitude: -122.4194 };
    const lat = vehicles.reduce((s, v) => s + v.location.latitude, 0) / vehicles.length;
    const lng = vehicles.reduce((s, v) => s + v.location.longitude, 0) / vehicles.length;
    return { latitude: lat, longitude: lng };
  }, [session?.vehicles, myVehicle]);

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStations([]);
    const centre = centroid();
    const results = await findNearbyFuelStations(centre.latitude, centre.longitude, 10_000, 8);
    if (results.length === 0) {
      const wider = await findNearbyFuelStations(centre.latitude, centre.longitude, 25_000, 8);
      if (wider.length === 0) {
        setError("No petrol stations found nearby. Try moving closer to a road network.");
      } else {
        setStations(wider);
      }
    } else {
      setStations(results);
    }
    setLoading(false);
  }, [centroid]);

  useEffect(() => {
    if (visible) search();
    else {
      setStations([]);
      setError(null);
      setNavigating(null);
    }
  }, [visible, search]);

  const handleNavigate = async (station: FuelStation) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const origin = myVehicle?.location;
    if (!origin) return;
    setNavigating(station.id);
    const route = await fetchRoute(origin.latitude, origin.longitude, station.latitude, station.longitude);
    setNavigating(null);
    if (!route) {
      setError("Could not calculate a route to that station.");
      return;
    }
    // Pin the regroup point on everyone's map, then start navigation
    if (myVehicle) {
      broadcastRegroupPin({
        fromVehicleName: myVehicle.name,
        lat: station.latitude,
        lng: station.longitude,
        name: station.name,
      });
    }
    startNavigation({
      destination: { latitude: station.latitude, longitude: station.longitude, name: station.name },
      route: route.route,
      steps: route.steps,
      currentStepIndex: 0,
      totalDistanceM: route.totalDistanceM,
      totalDurationS: route.totalDurationS,
      totalDurationInTrafficS: route.totalDurationInTrafficS,
    });
    onClose();
  };

  const handlePin = (station: FuelStation) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    if (!myVehicle) return;
    broadcastRegroupPin({
      fromVehicleName: myVehicle.name,
      lat: station.latitude,
      lng: station.longitude,
      name: station.name,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.root, { backgroundColor: colors.background }]}>

        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerLeft}>
            <MaterialCommunityIcons name="gas-station" size={22} color={colors.primary} />
            <Text style={[styles.title, { color: colors.foreground }]}>Regroup Point</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <View style={[styles.subtitleRow]}>
          <MaterialCommunityIcons name="map-marker-radius" size={14} color={colors.mutedForeground} />
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Petrol & service stations near the convoy
          </Text>
          <TouchableOpacity onPress={search} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="refresh" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Active regroup pin banner */}
        {regroupPin && (
          <View style={[styles.activePinBanner, { backgroundColor: "#22c55e18", borderColor: "#22c55e40" }]}>
            <MaterialCommunityIcons name="flag-checkered" size={16} color="#22c55e" />
            <Text style={[styles.activePinText, { color: "#22c55e" }]} numberOfLines={1}>
              Active pin: {regroupPin.name}
            </Text>
            {isLeader && (
              <TouchableOpacity
                onPress={() => { clearRegroupPin(); onClose(); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="close-circle" size={18} color="#22c55e" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {loading && (
          <View style={styles.centred}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              Searching nearby stations…
            </Text>
          </View>
        )}

        {!loading && error && (
          <View style={styles.centred}>
            <MaterialCommunityIcons name="gas-station-off" size={48} color={colors.mutedForeground + "60"} />
            <Text style={[styles.errorText, { color: colors.mutedForeground }]}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: colors.primary }]}
              onPress={search}
            >
              <Text style={styles.retryBtnText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && stations.length > 0 && (
          <FlatList
            data={stations}
            keyExtractor={(s) => String(s.id)}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => (
              <View style={[styles.separator, { backgroundColor: colors.border }]} />
            )}
            renderItem={({ item }) => {
              const isLoading = navigating === item.id;
              const distFromMe = myVehicle
                ? Math.round(
                    Math.sqrt(
                      Math.pow((item.latitude - myVehicle.location.latitude) * 111_320, 2) +
                      Math.pow((item.longitude - myVehicle.location.longitude) * 111_320 *
                        Math.cos((myVehicle.location.latitude * Math.PI) / 180), 2)
                    )
                  )
                : null;

              return (
                <View style={[styles.stationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.stationHeader}>
                    <View style={[styles.stationIcon, { backgroundColor: colors.primary + "18" }]}>
                      <MaterialCommunityIcons name="gas-station" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.stationInfo}>
                      <Text style={[styles.stationName, { color: colors.foreground }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.brand && item.brand !== item.name && (
                        <Text style={[styles.stationBrand, { color: colors.mutedForeground }]} numberOfLines={1}>
                          {item.brand}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.distRow}>
                    <View style={[styles.distChip, { backgroundColor: colors.secondary }]}>
                      <MaterialCommunityIcons name="account-group" size={12} color={colors.mutedForeground} />
                      <Text style={[styles.distText, { color: colors.mutedForeground }]}>
                        {formatDistance(item.distanceM)} from convoy
                      </Text>
                    </View>
                    {distFromMe !== null && (
                      <View style={[styles.distChip, { backgroundColor: colors.primary + "12" }]}>
                        <MaterialCommunityIcons name="account" size={12} color={colors.primary} />
                        <Text style={[styles.distText, { color: colors.primary }]}>
                          {formatDistance(distFromMe)} from you
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.actionRow}>
                    {isLeader ? (
                      <TouchableOpacity
                        style={[styles.primaryBtn, { backgroundColor: colors.success, opacity: isLoading ? 0.7 : 1 }]}
                        onPress={() => handleNavigate(item)}
                        disabled={isLoading || navigating !== null}
                        activeOpacity={0.85}
                      >
                        {isLoading ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <MaterialCommunityIcons name="navigation" size={16} color="#fff" />
                        )}
                        <Text style={styles.primaryBtnText}>
                          {isLoading ? "Calculating…" : "Navigate Convoy Here"}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.primaryBtn, { backgroundColor: "#22c55e" }]}
                        onPress={() => handlePin(item)}
                        activeOpacity={0.85}
                      >
                        <MaterialCommunityIcons name="flag-checkered" size={16} color="#fff" />
                        <Text style={styles.primaryBtnText}>Pin as Regroup Point</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>
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
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  closeBtn: {
    padding: 4,
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  subtitle: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  centred: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  errorText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  retryBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  list: {
    padding: 16,
    gap: 12,
  },
  separator: {
    height: 0,
  },
  stationCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginBottom: 10,
  },
  stationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stationIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stationInfo: {
    flex: 1,
    gap: 2,
  },
  stationName: {
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  stationBrand: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  distRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  distChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  distText: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  actionRow: {
    marginTop: 2,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  activePinBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  activePinText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
