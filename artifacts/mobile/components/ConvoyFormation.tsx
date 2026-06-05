import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Vehicle } from "@/context/ConvoyContext";
import { useColors } from "@/hooks/useColors";
import { haversineMeters } from "@/services/routing";

interface ConvoyFormationProps {
  vehicles: Vehicle[];
  compact?: boolean;
  gapWarnings?: Set<string>;
  /** ID of the vehicle currently being talked to privately (highlights that card) */
  talkingToVehicleId?: string | null;
  /** Called when a non-me vehicle card is tapped (for private PTT) */
  onVehicleTap?: (vehicle: Vehicle) => void;
  /** True when the current user is the convoy leader */
  isLeader?: boolean;
  /** Called when the leader selects "Make Lead" from a vehicle's action sheet */
  onLeaderHandoff?: (vehicle: Vehicle) => void;
  /** True when the current user is actively joining the convoy route */
  isJoining?: boolean;
  /** Straight-line distance to the convoy merge point in metres (while joining) */
  distanceToMergeM?: number;
  /** ID of the current user's vehicle (to identify "my" card while joining) */
  myVehicleId?: string;
  /** Per-vehicle regroup pin ETA data (keyed by vehicleId) */
  vehicleRegroupEtas?: Map<string, { distanceM: number; etaS: number }>;
}

function VehicleCard({
  vehicle,
  position,
  colors,
  isLagging,
  isTalkingTo,
  isJoining,
  distanceToMergeM,
  regroupEta,
  onTap,
}: {
  vehicle: Vehicle;
  position: number;
  colors: ReturnType<typeof useColors>;
  isLagging?: boolean;
  isTalkingTo?: boolean;
  isJoining?: boolean;
  distanceToMergeM?: number;
  regroupEta?: { distanceM: number; etaS: number };
  onTap?: () => void;
}) {
  const pulse = useSharedValue(1);

  React.useEffect(() => {
    if (isTalkingTo || isJoining) {
      pulse.value = withRepeat(withTiming(1.06, { duration: 900 }), -1, true);
    } else {
      pulse.value = withTiming(1, { duration: 200 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- pulse is a stable Reanimated shared value
  }, [isTalkingTo, isJoining]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const cardBg = isTalkingTo
    ? colors.primary + "22"
    : isLagging
    ? "#fef2f2"
    : vehicle.isMe
    ? colors.primary + "22"
    : colors.card;

  const joiningNear = isJoining && (distanceToMergeM ?? Infinity) < 200;
  const joiningColor = joiningNear ? "#22c55e" : "#f59e0b";

  const cardBorder = isTalkingTo
    ? colors.primary
    : isJoining
    ? joiningColor
    : isLagging
    ? "#ef4444"
    : vehicle.isMe
    ? colors.primary
    : vehicle.color;

  const inner = (
    <Animated.View style={[styles.vehicleWrapper, animStyle]}>
      <View
        style={[
          styles.vehicleCard,
          {
            backgroundColor: cardBg,
            borderColor: cardBorder,
            borderWidth: isLagging || vehicle.isMe || isTalkingTo ? 2 : 1,
          },
        ]}
      >
        <View style={[styles.positionBadge, { backgroundColor: isLagging ? "#ef4444" : vehicle.color }]}>
          <Text style={styles.positionText}>#{position}</Text>
        </View>

        {isTalkingTo ? (
          <MaterialCommunityIcons name="radio-handheld" size={22} color={colors.primary} style={styles.vehicleIcon} />
        ) : (
          <MaterialCommunityIcons
            name={vehicle.isLeader ? "crown" : "car"}
            size={22}
            color={isLagging ? "#ef4444" : vehicle.color}
            style={styles.vehicleIcon}
          />
        )}

        <Text
          style={[styles.vehicleName, { color: isLagging ? "#ef4444" : isTalkingTo ? colors.primary : colors.foreground }]}
          numberOfLines={1}
        >
          {vehicle.name}
        </Text>

        {vehicle.isLeader && (
          <View style={[styles.leaderBadge, { backgroundColor: colors.warning + "33" }]}>
            <Text style={[styles.leaderText, { color: colors.warning }]}>Lead</Text>
          </View>
        )}
        {vehicle.isMe && (
          <View style={[styles.meBadge, { backgroundColor: colors.primary + "33" }]}>
            <Text style={[styles.meText, { color: colors.primary }]}>You</Text>
          </View>
        )}
        {isTalkingTo && (
          <View style={[styles.talkingBadge, { backgroundColor: colors.primary + "33" }]}>
            <Text style={[styles.talkingText, { color: colors.primary }]}>Talking</Text>
          </View>
        )}
        {isLagging && !isTalkingTo && !isJoining && (
          <View style={styles.gapBadge}>
            <Text style={styles.gapBadgeText}>Behind</Text>
          </View>
        )}
        {regroupEta && !isJoining && (
          <View style={[styles.regroupEtaBadge, { backgroundColor: "#f59e0b22" }]}>
            <Text style={[styles.regroupEtaText, { color: "#f59e0b" }]}>
              {regroupEta.etaS < 60
                ? "<1 min"
                : `${Math.ceil(regroupEta.etaS / 60)} min`}
            </Text>
          </View>
        )}
        {isJoining && (
          <View style={[styles.joiningBadge, { backgroundColor: joiningColor + "22" }]}>
            <Text style={[styles.joiningText, { color: joiningColor }]}>
              {joiningNear
                ? "Joining!"
                : distanceToMergeM != null
                ? distanceToMergeM < 1000
                  ? `${Math.round(distanceToMergeM)} m`
                  : `${(distanceToMergeM / 1000).toFixed(1)} km`
                : "Joining…"}
            </Text>
          </View>
        )}
        <Text style={[styles.speedLabel, { color: colors.mutedForeground }]}>
          {vehicle.location.speed != null && vehicle.location.speed > 0
            ? `${Math.round(vehicle.location.speed)} mph`
            : "0 mph"}
        </Text>

        {/* Tap-to-talk hint for non-me vehicles */}
        {!vehicle.isMe && onTap && !isTalkingTo && (
          <View style={[styles.tapHint, { backgroundColor: colors.primary + "15" }]}>
            <MaterialCommunityIcons name="microphone" size={9} color={colors.primary} />
          </View>
        )}
      </View>
    </Animated.View>
  );

  if (!vehicle.isMe && onTap) {
    return (
      <TouchableOpacity
        onPress={() => {
          if (Platform.OS !== "web") Haptics.selectionAsync();
          onTap();
        }}
        activeOpacity={0.75}
      >
        {inner}
      </TouchableOpacity>
    );
  }

  return inner;
}

export default function ConvoyFormation({
  vehicles,
  compact: _compact,
  gapWarnings,
  talkingToVehicleId,
  onVehicleTap,
  isLeader,
  onLeaderHandoff,
  isJoining,
  distanceToMergeM,
  myVehicleId,
  vehicleRegroupEtas,
}: ConvoyFormationProps) {
  const colors = useColors();
  const sorted = [...vehicles].sort((a, _b) => (a.isLeader ? -1 : 1));

  const handleCardTap = (vehicle: Vehicle) => {
    // If the tapped vehicle is lagging, show distance callout first
    const isLagging = gapWarnings?.has(vehicle.id) ?? false;
    if (isLagging) {
      const leader = vehicles.find((v) => v.isLeader);
      const distM = leader
        ? haversineMeters(
            vehicle.location.latitude, vehicle.location.longitude,
            leader.location.latitude, leader.location.longitude,
          )
        : null;
      const distLabel =
        distM != null
          ? distM < 1000
            ? `${Math.round(distM)} m behind the leader`
            : `${(distM / 1000).toFixed(1)} km behind the leader`
          : "falling behind the leader";

      if (isLeader && onLeaderHandoff) {
        Alert.alert(vehicle.name, distLabel, [
          { text: "Talk Privately", onPress: () => onVehicleTap?.(vehicle) },
          {
            text: "Make Lead",
            onPress: () =>
              Alert.alert(
                "Transfer Leadership",
                `Hand off to ${vehicle.name}? You will become a regular member.`,
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Transfer", style: "destructive", onPress: () => onLeaderHandoff(vehicle) },
                ],
              ),
          },
          { text: "Cancel", style: "cancel" },
        ]);
      } else {
        Alert.alert(vehicle.name, distLabel, [
          onVehicleTap
            ? { text: "Talk Privately", onPress: () => onVehicleTap(vehicle) }
            : { text: "OK" },
          { text: "Dismiss", style: "cancel" },
        ]);
      }
      return;
    }

    if (isLeader && onLeaderHandoff) {
      // Leader gets an action sheet: talk privately OR hand off leadership
      Alert.alert(
        vehicle.name,
        "What would you like to do?",
        [
          {
            text: "Talk Privately",
            onPress: () => onVehicleTap?.(vehicle),
          },
          {
            text: "Make Lead",
            onPress: () => {
              Alert.alert(
                "Transfer Leadership",
                `Hand off convoy lead to ${vehicle.name}? You will become a regular member.`,
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Transfer",
                    style: "destructive",
                    onPress: () => onLeaderHandoff(vehicle),
                  },
                ]
              );
            },
          },
          { text: "Cancel", style: "cancel" },
        ]
      );
    } else {
      onVehicleTap?.(vehicle);
    }
  };

  const hintLabel = isLeader
    ? "· HOLD A CAR TO ACT"
    : onVehicleTap
    ? "· TAP A CAR TO TALK"
    : "";

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.mutedForeground }]}>
        CONVOY FORMATION {hintLabel}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {sorted.map((v, i) => (
          <View key={v.id} style={styles.cardRow}>
            <VehicleCard
              vehicle={v}
              position={i + 1}
              colors={colors}
              isLagging={gapWarnings?.has(v.id) ?? false}
              isTalkingTo={!!(talkingToVehicleId && talkingToVehicleId === v.id)}
              isJoining={isJoining && (v.isMe || v.id === myVehicleId)}
              distanceToMergeM={isJoining && (v.isMe || v.id === myVehicleId) ? distanceToMergeM : undefined}
              regroupEta={vehicleRegroupEtas?.get(v.id)}
              onTap={(onVehicleTap || (isLeader && onLeaderHandoff)) && !v.isMe
                ? () => handleCardTap(v)
                : undefined}
            />
            {i < sorted.length - 1 && (
              <View style={styles.arrowWrapper}>
                <MaterialCommunityIcons
                  name="arrow-right"
                  size={18}
                  color={colors.border}
                />
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  title: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    paddingHorizontal: 16,
    fontFamily: "Inter_700Bold",
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 4,
    alignItems: "center",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  vehicleWrapper: {
    alignItems: "center",
    gap: 2,
  },
  vehicleCard: {
    width: 90,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: "center",
    gap: 4,
    position: "relative",
  },
  positionBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  positionText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },
  vehicleIcon: {
    marginBottom: 2,
  },
  vehicleName: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    fontFamily: "Inter_600SemiBold",
  },
  leaderBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  leaderText: {
    fontSize: 9,
    fontWeight: "700",
  },
  meBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  meText: {
    fontSize: 9,
    fontWeight: "700",
  },
  talkingBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  talkingText: {
    fontSize: 9,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  speedLabel: {
    fontSize: 10,
    fontWeight: "500",
  },
  gapBadge: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  gapBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#ef4444",
  },
  joiningBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  joiningText: {
    fontSize: 9,
    fontWeight: "700",
  },
  regroupEtaBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  regroupEtaText: {
    fontSize: 9,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  tapHint: {
    position: "absolute",
    bottom: 4,
    left: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  connectorWrapper: {
    alignItems: "center",
    gap: 0,
  },
  connectorLine: {
    width: 1,
    height: 8,
  },
  arrowWrapper: {
    paddingHorizontal: 2,
  },
});
