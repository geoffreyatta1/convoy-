
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import React, { useEffect, useRef } from "react";
import { Alert, Animated, DeviceEventEmitter, Easing, StyleSheet, Text, View } from "react-native";
import MapView, { Camera, Callout, Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";

import { useState } from "react";

import { useColors } from "@/hooks/useColors";
import { Vehicle, RegroupPin } from "@/context/ConvoyContext";
import { Hazard } from "@/services/hazards";

// Both iOS and Android use Google Maps (PROVIDER_GOOGLE).
// The iOS build requires googleMapsApiKey in app.config.js so the
// react-native-maps plugin includes the Google Maps iOS SDK pod (AirGoogleMaps).
const MAP_PROVIDER = PROVIDER_GOOGLE;

type MCIconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

const NORMAL_BUBBLE = 28;
const SYNC_BUBBLE = 48;
const STALE_FADE_MS = 10_000;

interface ConvoyMapProps {
  vehicles: Vehicle[];
  myVehicle: Vehicle | null;
  destination?: { name: string; latitude: number; longitude: number };
  route?: Array<{ latitude: number; longitude: number }>;
  mergeRoute?: Array<{ latitude: number; longitude: number }>;
  mergePoint?: { latitude: number; longitude: number };
  isNavigating?: boolean;
  gapWarnings?: Set<string>;
  hazards?: Hazard[];
  regroupPin?: RegroupPin | null;
  /** When true: camera zooms to overhead, markers expand */
  isInSyncZone?: boolean;
  /** Geographic centroid of all convoy vehicles (used for sync camera) */
  convoycentroid?: { latitude: number; longitude: number } | null;
  /** Called when a vehicle marker is tapped in sync zone */
  onVehiclePress?: (vehicle: Vehicle) => void;
  /** ID of the vehicle that is the PTT target (shows green ring) */
  activeSyncTargetId?: string | null;
  /** ID of the vehicle that is the PTT caller (also shows green ring) */
  activeSyncCallerId?: string | null;
  /** Show the device's own location as a blue dot (idle/no-session mode) */
  showsUserLocation?: boolean;
  /** Called when the map background is tapped (not a marker) */
  onMapPress?: () => void;
  /** Called when the driver taps "Navigate here" on the regroup pin action sheet. */
  onRegroupPinNavigate?: (pin: RegroupPin) => void;
  /** Called when the driver taps "Clear Pin" on the regroup pin action sheet. */
  onRegroupPinClear?: () => void;
}

// ─── Gap pulsing ring (lagging vehicle) ──────────────────────────────────────

function GapPulsingRing() {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.7, duration: 900, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0, duration: 900, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
          Animated.timing(opacity, { toValue: 0.8, duration: 0, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, [scale, opacity]);

  return (
    <Animated.View style={[styles.gapRing, { transform: [{ scale }], opacity }]} />
  );
}

// ─── Active PTT ring (green pulse on caller + target) ────────────────────────

function SyncActiveRing() {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.5, duration: 800, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
          Animated.timing(opacity, { toValue: 0.9, duration: 0, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, [scale, opacity]);

  return (
    <Animated.View style={[styles.syncActiveRing, { transform: [{ scale }], opacity }]} />
  );
}

// ─── Unified car marker: animates size between normal (28 pt) and sync (48 pt) ─

function SyncableCarMarker({
  vehicle,
  colors,
  isInSyncZone,
  isLagging,
  isActive,
}: {
  vehicle: Vehicle;
  colors: ReturnType<typeof useColors>;
  isInSyncZone: boolean;
  isLagging: boolean;
  isActive: boolean;
}) {
  const transAnim = useRef(new Animated.Value(isInSyncZone ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(transAnim, {
      toValue: isInSyncZone ? 1 : 0,
      duration: 380,
      useNativeDriver: false,
      easing: Easing.out(Easing.ease),
    }).start();
  }, [isInSyncZone, transAnim]);

  const isStale = !vehicle.isMe && Date.now() - vehicle.lastSeen > STALE_FADE_MS;

  const bubbleSize = transAnim.interpolate({ inputRange: [0, 1], outputRange: [NORMAL_BUBBLE, SYNC_BUBBLE] });
  const borderRadius = transAnim.interpolate({ inputRange: [0, 1], outputRange: [NORMAL_BUBBLE / 2, SYNC_BUBBLE / 2] });
  const normalOpacity = transAnim.interpolate({ inputRange: [0, 0.45], outputRange: [1, 0] });
  const syncOpacity = transAnim.interpolate({ inputRange: [0.55, 1], outputRange: [0, 1] });

  const bubbleBg = isStale && !isInSyncZone ? "#9ca3af" : vehicle.color;
  const bubbleBorderColor = isActive
    ? "#22c55e"
    : isLagging
    ? "#ef4444"
    : vehicle.isMe && !isInSyncZone
    ? colors.primary
    : bubbleBg;
  const bubbleBorderWidth = isActive ? 3 : isLagging ? 2 : vehicle.isMe && !isInSyncZone ? 3 : 0;

  const labelBg =
    isActive && isInSyncZone ? "#dcfce7" : isLagging && !isInSyncZone ? "#fef2f2" : colors.card;
  const labelColor =
    isActive && isInSyncZone
      ? "#15803d"
      : isLagging && !isInSyncZone
      ? "#ef4444"
      : isStale && !isInSyncZone
      ? colors.mutedForeground
      : colors.foreground;

  return (
    <View style={[styles.markerContainer, { opacity: isStale && !isInSyncZone ? 0.4 : 1 }]}>
      {/* Lagging ring (normal mode only) */}
      {isLagging && !isInSyncZone && <GapPulsingRing />}
      {/* Active PTT ring (sync mode only, appears on BOTH caller and target) */}
      {isActive && isInSyncZone && <SyncActiveRing />}

      <Animated.View
        style={[
          styles.bubbleBase,
          {
            width: bubbleSize,
            height: bubbleSize,
            borderRadius,
            backgroundColor: bubbleBg,
            borderWidth: bubbleBorderWidth,
            borderColor: bubbleBorderColor,
          },
        ]}
      >
        {/* Normal mode content: icon */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.bubbleInner, { opacity: normalOpacity }]}>
          {vehicle.isLeader ? (
            <MaterialCommunityIcons name="crown" size={12} color="#fff" />
          ) : (
            <MaterialCommunityIcons name="car" size={14} color="#fff" />
          )}
        </Animated.View>

        {/* Sync mode content: emoji */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.bubbleInner, { opacity: syncOpacity }]}>
          <Text style={styles.syncEmoji}>{vehicle.emoji ?? "🚗"}</Text>
        </Animated.View>
      </Animated.View>

      <View style={[styles.markerLabel, { backgroundColor: labelBg }]}>
        <Text
          style={[styles.markerText, { color: labelColor, fontWeight: isInSyncZone ? "700" : "600" }]}
          numberOfLines={1}
        >
          {vehicle.name}
          {!isInSyncZone && isStale ? " (offline)" : ""}
        </Text>
      </View>
    </View>
  );
}

// ─── Hazard markers ───────────────────────────────────────────────────────────

const HAZARD_CONFIG: Record<string, { icon: MCIconName; color: string; label: string }> = {
  police:       { icon: "police-badge",   color: "#3b82f6", label: "Police" },
  accident:     { icon: "car-off",        color: "#ef4444", label: "Accident" },
  construction: { icon: "road-variant",   color: "#f59e0b", label: "Construction" },
  debris:       { icon: "alert-rhombus",  color: "#8b5cf6", label: "Debris" },
  other:        { icon: "alert-circle",   color: "#6b7280", label: "Hazard" },
};

function timeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

function HazardMarker({ hazard, colors }: { hazard: Hazard; colors: ReturnType<typeof useColors> }) {
  const cfg = HAZARD_CONFIG[hazard.type] ?? HAZARD_CONFIG["other"]!;
  return (
    <>
      <View style={[styles.hazardBubble, { backgroundColor: cfg.color, borderColor: "#fff" }]}>
        <MaterialCommunityIcons name={cfg.icon} size={14} color="#fff" />
      </View>
      <Callout tooltip>
        <View style={[styles.callout, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.calloutTitle, { color: cfg.color }]}>{cfg.label}</Text>
          <Text style={[styles.calloutSub, { color: colors.foreground }]} numberOfLines={1}>{hazard.reportedBy}</Text>
          <Text style={[styles.calloutTime, { color: colors.mutedForeground }]}>{timeAgo(hazard.reportedAt)}</Text>
        </View>
      </Callout>
    </>
  );
}

function MergeMarker({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.mergeMarkerContainer}>
      <View style={[styles.mergeMarkerBubble, { backgroundColor: colors.warning }]}>
        <MaterialCommunityIcons name="call-merge" size={14} color="#fff" />
      </View>
      <View style={[styles.markerLabel, { backgroundColor: colors.card }]}>
        <Text style={[styles.markerText, { color: colors.foreground }]}>Join here</Text>
      </View>
    </View>
  );
}

function RegroupPinMarker({ name, colors }: { name: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.regroupContainer}>
      <View style={[styles.regroupBubble, { backgroundColor: "#22c55e", borderColor: "#fff" }]}>
        <MaterialCommunityIcons name="flag-checkered" size={16} color="#fff" />
      </View>
      <View style={[styles.markerLabel, { backgroundColor: colors.card }]}>
        <Text style={[styles.markerText, { color: "#22c55e" }]} numberOfLines={1}>{name}</Text>
      </View>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ConvoyMap({
  vehicles,
  myVehicle,
  destination,
  route,
  mergeRoute,
  mergePoint,
  isNavigating,
  gapWarnings,
  hazards,
  regroupPin,
  isInSyncZone,
  convoycentroid,
  onVehiclePress,
  activeSyncTargetId,
  activeSyncCallerId,
  showsUserLocation = false,
  onMapPress,
  onRegroupPinNavigate,
  onRegroupPinClear,
}: ConvoyMapProps) {
  const colors = useColors();
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const isNavigatingRef = useRef(isNavigating);
  isNavigatingRef.current = isNavigating;

  const centerLat = myVehicle?.location.latitude ?? 37.7749;
  const centerLng = myVehicle?.location.longitude ?? -122.4194;

  // Fit all convoy vehicles when NOT navigating and NOT in sync zone
  useEffect(() => {
    // Filter out placeholder (0, 0) vehicles — they appear when a member joins
    // but hasn't sent their first GPS update yet; including them would zoom the
    // map out to the Atlantic Ocean.
    const validVehicles = vehicles.filter(
      (v) => !(v.location.latitude === 0 && v.location.longitude === 0)
    );
    if (mapReady && mapRef.current && validVehicles.length > 1 && !isNavigating && !isInSyncZone) {
      const coords = validVehicles.map((v) => ({
        latitude: v.location.latitude,
        longitude: v.location.longitude,
      }));
      if (destination) coords.push({ latitude: destination.latitude, longitude: destination.longitude });
      if (mergePoint) coords.push({ latitude: mergePoint.latitude, longitude: mergePoint.longitude });
      if (regroupPin) coords.push({ latitude: regroupPin.lat, longitude: regroupPin.lng });
      try {
        mapRef.current.fitToCoordinates(coords, {
          edgePadding: { top: 160, right: 40, bottom: 160, left: 40 },
          animated: true,
        });
      } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- vehicles.length used as proxy; destination/mergePoint/regroupPin added; full vehicles array would re-fit on every GPS tick
  }, [mapReady, vehicles.length, isNavigating, isInSyncZone, destination, mergePoint, regroupPin]);

  // Heading-up camera lock during navigation — suspended in sync zone
  useEffect(() => {
    if (!isNavigating || !mapReady || !mapRef.current || !myVehicle || isInSyncZone) return;
    const cam: Camera = {
      center: { latitude: myVehicle.location.latitude, longitude: myVehicle.location.longitude },
      heading: myVehicle.location.heading ?? 0,
      pitch: 30,
      zoom: 17,
      altitude: 500,
    };
    try { mapRef.current.animateCamera(cam, { duration: 600 }); } catch {}
  }, [
    myVehicle,
    myVehicle?.location.latitude,
    myVehicle?.location.longitude,
    myVehicle?.location.heading,
    isNavigating,
    mapReady,
    isInSyncZone,
  ]);

  // Sync-zone overhead camera: zoom 18, pitch 0, heading 0, centred on centroid
  useEffect(() => {
    if (!mapReady || !mapRef.current || !isInSyncZone || !convoycentroid) return;
    const cam: Camera = {
      center: { latitude: convoycentroid.latitude, longitude: convoycentroid.longitude },
      heading: 0,
      pitch: 0,
      zoom: 18,
      altitude: 50,
    };
    try { mapRef.current.animateCamera(cam, { duration: 1000 }); } catch {}
  }, [isInSyncZone, convoycentroid, convoycentroid?.latitude, convoycentroid?.longitude, mapReady]);

  // ── CarPlay gesture forwarding ─────────────────────────────────────────────
  // Subscribe to DeviceEventEmitter events emitted by the CarPlay service for
  // knob/touchpad pan direction and iOS 26 multitouch gestures. Each event is
  // translated to a camera transform so the in-car display can control the map.
  useEffect(() => {
    if (!mapReady) return;

    // Pan direction: step the map center by a fixed delta per knob click.
    // 0.002° ≈ 220 m at mid-latitudes — comfortable for navigation panning.
    const PAN_STEP_DEG = 0.002;
    const panSub = DeviceEventEmitter.addListener(
      "CARPLAY_PAN_DIRECTION",
      async ({ direction }: { direction: string }) => {
        if (!mapRef.current) return;
        try {
          const cam = await mapRef.current.getCamera();
          const lat =
            direction === "up"   ?  PAN_STEP_DEG :
            direction === "down" ? -PAN_STEP_DEG : 0;
          const lng =
            direction === "right" ?  PAN_STEP_DEG :
            direction === "left"  ? -PAN_STEP_DEG : 0;
          mapRef.current.animateCamera(
            { ...cam, center: { latitude: cam.center.latitude + lat, longitude: cam.center.longitude + lng } },
            { duration: 150 },
          );
        } catch {}
      },
    );

    // Pinch zoom (iOS 26): scale > 1 zooms in, scale < 1 zooms out.
    const pinchSub = DeviceEventEmitter.addListener(
      "CARPLAY_PINCH_ZOOM",
      async ({ scale }: { scale: number }) => {
        if (!mapRef.current) return;
        try {
          const cam = await mapRef.current.getCamera();
          const newZoom = Math.max(1, Math.min(20, (cam.zoom ?? 15) + Math.log2(scale) * 1.5));
          mapRef.current.animateCamera({ ...cam, zoom: newZoom }, { duration: 200 });
        } catch {}
      },
    );

    // Two-finger pitch (iOS 26): pitch angle clamped to 0–60°.
    const pitchSub = DeviceEventEmitter.addListener(
      "CARPLAY_PITCH",
      async ({ pitch }: { pitch: number }) => {
        if (!mapRef.current) return;
        try {
          const cam = await mapRef.current.getCamera();
          mapRef.current.animateCamera(
            { ...cam, pitch: Math.max(0, Math.min(60, pitch)) },
            { duration: 200 },
          );
        } catch {}
      },
    );

    // Two-finger rotate (iOS 26): heading in degrees 0–360.
    const rotateSub = DeviceEventEmitter.addListener(
      "CARPLAY_ROTATE",
      async ({ heading }: { heading: number }) => {
        if (!mapRef.current) return;
        try {
          const cam = await mapRef.current.getCamera();
          mapRef.current.animateCamera({ ...cam, heading }, { duration: 200 });
        } catch {}
      },
    );

    return () => {
      panSub.remove();
      pinchSub.remove();
      pitchSub.remove();
      rotateSub.remove();
    };
  }, [mapReady]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={MAP_PROVIDER}
        initialRegion={{
          latitude: centerLat,
          longitude: centerLng,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        onMapReady={() => setMapReady(true)}
        onPress={onMapPress}
        showsUserLocation={showsUserLocation}
        showsTraffic
        mapType="standard"
        rotateEnabled
        pitchEnabled
      >
        {/* Shared convoy route — white shadow for visibility, then solid line on top */}
        {route && route.length > 1 && (
          <Polyline
            coordinates={route}
            strokeColor="rgba(255,255,255,0.75)"
            strokeWidth={10}
          />
        )}
        {route && route.length > 1 && (
          <Polyline
            coordinates={route}
            strokeColor="#4285F4"
            strokeWidth={6}
          />
        )}

        {/* Follower merge route (dashed) */}
        {mergeRoute && mergeRoute.length > 1 && (
          <Polyline
            coordinates={mergeRoute}
            strokeColor={colors.warning}
            strokeWidth={4}
            lineDashPattern={[10, 6]}
          />
        )}

        {/* Gap connector lines */}
        {(() => {
          const leader = vehicles.find((v) => v.isLeader);
          if (!leader?.location || vehicles.length < 2) return null;
          return vehicles
            .filter((v) => !v.isLeader)
            .map((v) => {
              const isLagging = gapWarnings?.has(v.id) ?? false;
              const lineColor = isLagging ? (regroupPin ? "#f59e0b" : "#ef4444") : "#22c55e";
              return (
                <Polyline
                  key={`gap-${v.id}`}
                  coordinates={[
                    { latitude: leader.location.latitude, longitude: leader.location.longitude },
                    { latitude: v.location.latitude, longitude: v.location.longitude },
                  ]}
                  strokeColor={lineColor}
                  strokeWidth={isLagging ? 3 : 2}
                  lineDashPattern={[8, 5]}
                />
              );
            });
        })()}

        {/* Merge intercept marker */}
        {mergePoint && (
          <Marker coordinate={{ latitude: mergePoint.latitude, longitude: mergePoint.longitude }} anchor={{ x: 0.5, y: 1 }}>
            <MergeMarker colors={colors} />
          </Marker>
        )}

        {/* Destination pin */}
        {destination && (
          <Marker
            coordinate={{ latitude: destination.latitude, longitude: destination.longitude }}
            title={destination.name}
            pinColor="#ef4444"
          />
        )}

        {/* Regroup pin */}
        {regroupPin && (
          <Marker
            coordinate={{ latitude: regroupPin.lat, longitude: regroupPin.lng }}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={false}
            onPress={() => {
              if (!onRegroupPinNavigate && !onRegroupPinClear) return;
              Alert.alert(
                regroupPin.name,
                `Regroup point set by ${regroupPin.fromVehicleName}`,
                [
                  ...(onRegroupPinNavigate
                    ? [{ text: "Navigate Here", onPress: () => onRegroupPinNavigate(regroupPin) }]
                    : []),
                  ...(onRegroupPinClear
                    ? [{ text: "Clear Pin", style: "destructive" as const, onPress: onRegroupPinClear }]
                    : []),
                  { text: "Cancel", style: "cancel" as const },
                ],
              );
            }}
          >
            <RegroupPinMarker name={regroupPin.name} colors={colors} />
          </Marker>
        )}

        {/* Hazard markers */}
        {hazards?.map((hazard) => (
          <Marker
            key={hazard.id}
            coordinate={{ latitude: hazard.lat, longitude: hazard.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <HazardMarker hazard={hazard} colors={colors} />
          </Marker>
        ))}

        {/* Vehicle markers — unified animated component; tappable in sync zone.
            Skip (0, 0) placeholders added by onJoin before first GPS update. */}
        {vehicles
          .filter((v) => !(v.location.latitude === 0 && v.location.longitude === 0))
          .map((vehicle) => {
          const isActive =
            activeSyncTargetId === vehicle.id || activeSyncCallerId === vehicle.id;
          return (
            <Marker
              key={vehicle.id}
              coordinate={{
                latitude: vehicle.location.latitude,
                longitude: vehicle.location.longitude,
              }}
              anchor={{ x: 0.5, y: isInSyncZone ? 0.5 : 1 }}
              rotation={vehicle.isMe && isNavigating && !isInSyncZone ? (vehicle.location.heading ?? 0) : 0}
              tracksViewChanges={!!isInSyncZone}
              onPress={isInSyncZone && !vehicle.isMe ? () => onVehiclePress?.(vehicle) : undefined}
            >
              <SyncableCarMarker
                vehicle={vehicle}
                colors={colors}
                isInSyncZone={!!isInSyncZone}
                isLagging={gapWarnings?.has(vehicle.id) ?? false}
                isActive={isActive}
              />
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  // ── Shared marker ────────────────────────────────────────────
  markerContainer: {
    alignItems: "center",
    gap: 2,
  },

  // ── Animated bubble (shared by both normal + sync states) ───
  bubbleBase: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 5,
  },
  bubbleInner: {
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Normal-state gap pulsing ring ────────────────────────────
  gapRing: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#ef4444",
    backgroundColor: "transparent",
  },

  // ── Sync-state active PTT ring (caller + target) ─────────────
  syncActiveRing: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: "#22c55e",
    backgroundColor: "transparent",
  },

  // ── Sync emoji ───────────────────────────────────────────────
  syncEmoji: {
    fontSize: 22,
    lineHeight: 28,
  },

  // ── Label (shared) ────────────────────────────────────────────
  markerLabel: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: 96,
  },
  markerText: {
    fontSize: 10,
  },

  // ── Merge marker ─────────────────────────────────────────────
  mergeMarkerContainer: {
    alignItems: "center",
    gap: 2,
  },
  mergeMarkerBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 5,
    borderWidth: 2,
    borderColor: "#fff",
  },

  // ── Regroup pin ──────────────────────────────────────────────
  regroupContainer: {
    alignItems: "center",
    gap: 2,
  },
  regroupBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 5,
  },

  // ── Hazard marker ────────────────────────────────────────────
  hazardBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 5,
  },
  callout: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 120,
    gap: 2,
  },
  calloutTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  calloutSub: {
    fontSize: 12,
    fontWeight: "500",
  },
  calloutTime: {
    fontSize: 11,
  },
});
