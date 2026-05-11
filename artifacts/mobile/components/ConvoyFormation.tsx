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
}

function VehicleCard({
  vehicle,
  position,
  colors,
  isLagging,
  isTalkingTo,
  onTap,
}: {
  vehicle: Vehicle;
  position: number;
  colors: ReturnType<typeof useColors>;
  isLagging?: boolean;
  isTalkingTo?: boolean;
  onTap?: () => void;
}) {
  const pulse = useSharedValue(1);

  React.useEffect(() => {
    if (vehicle.isMe || isTalkingTo) {
      pulse.value = withRepeat(withTiming(1.06, { duration: 900 }), -1, true);
    } else {
      pulse.value = withTiming(1, { duration: 200 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- pulse is a stable Reanimated shared value
  }, [vehicle.isMe, isTalkingTo]);

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

  const cardBorder = isTalkingTo
    ? colors.primary
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
        {isLagging && !isTalkingTo && (
          <View style={styles.gapBadge}>
            <Text style={styles.gapBadgeText}>Behind</Text>
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
}: ConvoyFormationProps) {
  const colors = useColors();
  const sorted = [...vehicles].sort((a, _b) => (a.isLeader ? -1 : 1));

  const handleCardTap = (vehicle: Vehicle) => {
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
