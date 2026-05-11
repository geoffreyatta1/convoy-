import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";

import { NavigationState, Vehicle } from "@/context/ConvoyContext";
import { useColors } from "@/hooks/useColors";

interface MiniMapViewProps {
  vehicles: Vehicle[];
  navigation: NavigationState;
  gapWarnings?: Set<string>;
}

function fmtMi(m: number): string {
  const mi = m / 1609.344;
  return mi < 10 ? mi.toFixed(1) : Math.round(mi).toString();
}

function fmtMin(s: number): string {
  if (s <= 0) return "0 min";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

function MiniDot({ vehicle }: { vehicle: Vehicle }) {
  const size = vehicle.isLeader ? 14 : 10;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: vehicle.color,
        borderWidth: 1.5,
        borderColor: "#fff",
      }}
    />
  );
}

function MapContent({
  vehicles,
  navigation,
  mapWidth,
  mapHeight,
  polylineWidth,
}: MiniMapViewProps & {
  mapWidth: number;
  mapHeight: number;
  polylineWidth: number;
}) {
  const colors = useColors();
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);

  // Stable string signature that changes when any vehicle moves more than ~10 m
  // (4 decimal places ≈ 11 m resolution) or when the destination changes.
  const vehicleSig = vehicles
    .map((v) => `${v.id}:${v.location.latitude.toFixed(4)},${v.location.longitude.toFixed(4)}`)
    .join("|");
  const destSig = `${navigation.destination.latitude.toFixed(4)},${navigation.destination.longitude.toFixed(4)}`;
  // Route geometry signature — samples first, middle, and last point so re-fits
  // occur when the route is recalculated even if point count stays the same.
  const route = navigation.route;
  const routeSig = route.length === 0
    ? ""
    : `${route[0].latitude.toFixed(4)},${route[0].longitude.toFixed(4)}|${
        route[Math.floor(route.length / 2)].latitude.toFixed(4)
      },${route[Math.floor(route.length / 2)].longitude.toFixed(4)}|${
        route[route.length - 1].latitude.toFixed(4)
      },${route[route.length - 1].longitude.toFixed(4)}`;

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const coords: Array<{ latitude: number; longitude: number }> = [];
    vehicles.forEach((v) =>
      coords.push({ latitude: v.location.latitude, longitude: v.location.longitude })
    );
    if (route.length > 1) {
      // Pass every route point for accurate bounding — fitToCoordinates only
      // needs min/max lat/lng so O(n) is fine even for large routes.
      for (let i = 0; i < route.length; i++) coords.push(route[i]);
    }
    coords.push({
      latitude: navigation.destination.latitude,
      longitude: navigation.destination.longitude,
    });
    if (coords.length < 2) return;
    try {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 12, right: 12, bottom: 12, left: 12 },
        animated: false,
      });
    } catch (e) {
      if (__DEV__) console.warn("[MiniMapView] fitToCoordinates failed:", e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- uses signature strings as proxies for vehicles/route/dest; avoids re-fitting on sub-metre location jitter
  }, [mapReady, vehicleSig, destSig, routeSig]);

  return (
    <View style={{ width: mapWidth, height: mapHeight, borderRadius: 12, overflow: "hidden" }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_DEFAULT}
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        onMapReady={() => setMapReady(true)}
        showsUserLocation={false}
        showsTraffic={false}
        mapType="standard"
        pointerEvents="none"
      >
        {navigation.route.length > 1 && (
          <Polyline
            coordinates={navigation.route}
            strokeColor={colors.primary}
            strokeWidth={polylineWidth}
          />
        )}
        {vehicles.map((v) => (
          <Marker
            key={v.id}
            coordinate={{ latitude: v.location.latitude, longitude: v.location.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <MiniDot vehicle={v} />
          </Marker>
        ))}
        <Marker
          coordinate={{
            latitude: navigation.destination.latitude,
            longitude: navigation.destination.longitude,
          }}
          anchor={{ x: 0.5, y: 1 }}
          pinColor="#ef4444"
          tracksViewChanges={false}
        />
      </MapView>
    </View>
  );
}

export default function MiniMapView(props: MiniMapViewProps) {
  const { navigation } = props;
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);

  const stepsLeft = navigation.steps.slice(navigation.currentStepIndex);
  const remDistM = stepsLeft.reduce((s, st) => s + st.distanceM, 0);
  const remDurS = stepsLeft.reduce((s, st) => s + st.durationS, 0);

  return (
    <>
      <TouchableOpacity
        onPress={() => setExpanded(true)}
        activeOpacity={0.85}
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <MapContent {...props} mapWidth={140} mapHeight={120} polylineWidth={2} />
        <View style={[styles.pill, { borderTopColor: colors.border }]}>
          <MaterialCommunityIcons
            name="map-marker-distance"
            size={10}
            color={colors.primary}
          />
          <Text style={[styles.pillDist, { color: colors.foreground }]}>
            {fmtMi(remDistM)} mi · {fmtMin(remDurS)}
          </Text>
        </View>
        <View style={[styles.expandHint, { backgroundColor: colors.border }]}>
          <MaterialCommunityIcons name="arrow-expand" size={9} color={colors.mutedForeground} />
        </View>
      </TouchableOpacity>

      <Modal
        visible={expanded}
        transparent
        animationType="fade"
        onRequestClose={() => setExpanded(false)}
      >
        {/* TouchableWithoutFeedback closes on outside tap; inner View captures
            its own events via onStartShouldSetResponder to prevent propagation */}
        <TouchableWithoutFeedback onPress={() => setExpanded(false)}>
          <View style={styles.overlay}>
            <View
              onStartShouldSetResponder={() => true}
              style={[
                styles.expandedCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
            <View style={styles.expandedHeader}>
              <Text style={[styles.expandedTitle, { color: colors.foreground }]}>
                Route Overview
              </Text>
              <TouchableOpacity
                onPress={() => setExpanded(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={18}
                  color={colors.mutedForeground}
                />
              </TouchableOpacity>
            </View>

            <MapContent {...props} mapWidth={300} mapHeight={240} polylineWidth={3} />

            <View style={[styles.expandedPill, { borderTopColor: colors.border }]}>
              <MaterialCommunityIcons
                name="map-marker-distance"
                size={13}
                color={colors.primary}
              />
              <Text style={[styles.expandedDist, { color: colors.foreground }]}>
                {fmtMi(remDistM)} mi · {fmtMin(remDurS)} remaining
              </Text>
            </View>
            <View style={[styles.expandedDestRow, { borderTopColor: colors.border }]}>
              <MaterialCommunityIcons name="flag-checkered" size={12} color={colors.mutedForeground} />
              <Text
                style={[styles.expandedDest, { color: colors.mutedForeground }]}
                numberOfLines={1}
              >
                {navigation.destination.name}
              </Text>
            </View>

            <View style={[styles.vehicleRow, { borderTopColor: colors.border }]}>
              {props.vehicles.map((v) => (
                <View key={v.id} style={styles.vehicleDotRow}>
                  <View
                    style={[
                      styles.vehicleDot,
                      {
                        backgroundColor: v.color,
                        width: v.isLeader ? 12 : 8,
                        height: v.isLeader ? 12 : 8,
                        borderRadius: v.isLeader ? 6 : 4,
                      },
                    ]}
                  />
                  <Text
                    style={[styles.vehicleLabel, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {v.name}
                    {v.isLeader ? " ★" : ""}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pillDist: {
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    flexShrink: 1,
  },
  expandHint: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.7,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  expandedCard: {
    borderRadius: 20,
    borderWidth: 1,
    width: 320,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: { elevation: 10 },
    }),
  },
  expandedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  expandedTitle: {
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  expandedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  expandedDist: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  expandedDestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
  },
  expandedDest: {
    fontSize: 12,
    flex: 1,
  },
  vehicleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  vehicleDotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  vehicleDot: {
    borderWidth: 1.5,
    borderColor: "#ffffff44",
  },
  vehicleLabel: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
