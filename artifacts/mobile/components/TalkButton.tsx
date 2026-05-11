/**
 * TalkButton — press and hold to broadcast to the whole convoy;
 * release to stop (walkie-talkie grip style for driving safety).
 *
 * VAD silence detection still auto-stops if the driver releases late.
 */
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSpring,
} from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";
import { useConvoy } from "@/context/ConvoyContext";
import { playSound } from "@/services/sounds";

export default function TalkButton() {
  const colors = useColors();
  const {
    isTalking,
    talkTarget,
    startTalking,
    stopTalking,
    setTalkTarget,
    isGroupBroadcastActive,
    isLeaderBroadcastActive,
    isLeader,
    speakingVehicleNames,
  } = useConvoy();

  const scale = useSharedValue(1);
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0);

  const startRing = useCallback(() => {
    ringScale.value = 1;
    ringOpacity.value = 0.7;
    ringScale.value = withRepeat(withTiming(2.0, { duration: 900 }), -1, false);
    ringOpacity.value = withRepeat(withTiming(0, { duration: 900 }), -1, false);
  }, [ringScale, ringOpacity]);

  const stopRing = useCallback(() => {
    ringScale.value = withTiming(1, { duration: 200 });
    ringOpacity.value = withTiming(0, { duration: 200 });
  }, [ringScale, ringOpacity]);

  const handlePressIn = useCallback(async () => {
    if (isTalking) return; // already transmitting
    // Idle — start group broadcast. Explicitly clear any stale private target so
    // startTalking() routes to group (all cars) regardless of prior state.
    setTalkTarget(null);
    const started = await startTalking();
    if (!started) return;
    playSound("ptt_start");
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withSpring(0.93);
    startRing();
  }, [isTalking, startTalking, setTalkTarget, startRing, scale]);

  const handlePressOut = useCallback(() => {
    if (!isTalking) return;
    playSound("ptt_end");
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    stopTalking();
    stopRing();
    scale.value = withSpring(1);
  }, [isTalking, stopTalking, stopRing, scale]);

  // Mirror external VAD stop (silence auto-stop resets isTalking)
  React.useEffect(() => {
    if (!isTalking) {
      stopRing();
      scale.value = withSpring(1);
    }
  }, [isTalking, stopRing, scale]);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const isGroupTalking = isTalking && !talkTarget;
  // Someone else is broadcasting on the group channel (not me)
  const groupOccupied = isGroupBroadcastActive && !isTalking;
  // Leader is actively broadcasting (priority signal)
  const leaderOnAir = isLeaderBroadcastActive && !isTalking;

  const activeBg = isGroupTalking
    ? colors.primary
    : groupOccupied
    ? colors.card
    : colors.card;
  const iconColor = isGroupTalking ? "#fff" : groupOccupied ? colors.primary : colors.foreground;
  const borderColor = isGroupTalking
    ? colors.primary
    : leaderOnAir
    ? "#f59e0b"
    : groupOccupied
    ? colors.primary
    : colors.border;

  const speakerLabel =
    speakingVehicleNames.length > 0 ? speakingVehicleNames[0].toUpperCase() : "GROUP";

  const label = isGroupTalking
    ? isLeader ? "PRIORITY TX" : "TALKING"
    : leaderOnAir ? "LEADER ON AIR"
    : groupOccupied ? `${speakerLabel} ON AIR`
    : "HOLD";

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity onPressIn={handlePressIn} onPressOut={handlePressOut} activeOpacity={0.8}>
        <Animated.View style={[styles.container, buttonStyle]}>
          <Animated.View
            style={[
              styles.ring,
              { borderColor: groupOccupied ? colors.primary : colors.primary },
              ringStyle,
            ]}
          />
          <View
            style={[
              styles.button,
              {
                backgroundColor: activeBg,
                borderColor,
                shadowColor: isGroupTalking || groupOccupied ? colors.primary : "transparent",
                opacity: groupOccupied && !leaderOnAir ? 0.6 : 1,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={leaderOnAir ? "crown" : groupOccupied ? "volume-high" : "radio-handheld"}
              size={26}
              color={leaderOnAir ? "#f59e0b" : iconColor}
            />
            {isLeader && !isGroupTalking && (
              <View style={styles.crownBadge}>
                <MaterialCommunityIcons name="crown" size={9} color="#f59e0b" />
              </View>
            )}
          </View>
        </Animated.View>
      </TouchableOpacity>
      <Text
        style={[
          styles.label,
          {
            color: isGroupTalking
              ? colors.primary
              : leaderOnAir
              ? "#f59e0b"
              : groupOccupied
              ? colors.primary
              : colors.mutedForeground,
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const BTN = 56;

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    gap: 4,
  },
  container: {
    alignItems: "center",
    justifyContent: "center",
    width: BTN + 16,
    height: BTN + 16,
  },
  ring: {
    position: "absolute",
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    borderWidth: 2,
  },
  button: {
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  crownBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#1c1c1e",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.4,
    fontFamily: "Inter_700Bold",
  },
});
