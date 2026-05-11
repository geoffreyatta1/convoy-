/**
 * MergePill — minimal floating status strip shown during the merge phase.
 *
 * "In sync in  4 min · 1.2 mi"
 *
 * Slides in from below when the follower is navigating to the merge point,
 * briefly flashes "In sync with convoy!" on arrival, then disappears.
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";

import { useConvoy } from "@/context/ConvoyContext";
import { useColors } from "@/hooks/useColors";
import { formatDistance, formatETA } from "@/services/routing";

const AVG_SPEED_MPS = 11.2; // ~25 mph average for city/suburb driving

export default function MergePill() {
  const colors = useColors();
  const { mergeState, session } = useConvoy();
  const [showSynced, setShowSynced] = useState(false);
  const slideY = useRef(new Animated.Value(40)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const prevOnRoute = useRef(false);

  const nav = session?.navigation;

  // Detect the moment the follower joins the convoy route
  useEffect(() => {
    if (!mergeState) {
      prevOnRoute.current = false;
      return;
    }
    if (mergeState.onConvoyRoute && !prevOnRoute.current) {
      setShowSynced(true);
      const t = setTimeout(() => setShowSynced(false), 2800);
      prevOnRoute.current = true;
      return () => clearTimeout(t);
    }
    if (!mergeState.onConvoyRoute) {
      prevOnRoute.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mergeState?.onConvoyRoute is the primitive we track; adding full mergeState would fire on distance changes too
  }, [mergeState?.onConvoyRoute]);

  const isVisible = !!(mergeState && (!mergeState.onConvoyRoute || showSynced));

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideY, {
        toValue: isVisible ? 0 : 40,
        useNativeDriver: true,
        tension: 90,
        friction: 14,
      }),
      Animated.timing(opacity, {
        toValue: isVisible ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isVisible, opacity, slideY]);

  if (!nav || !mergeState) return null;

  const isSynced = showSynced && mergeState.onConvoyRoute;
  const etaS = mergeState.distanceToMergeM / AVG_SPEED_MPS;

  return (
    <Animated.View
      style={[
        styles.pill,
        {
          backgroundColor: isSynced ? colors.success : colors.card,
          borderColor: isSynced ? colors.success : colors.warning,
          opacity,
          transform: [{ translateY: slideY }],
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.18,
              shadowRadius: 6,
            },
            android: { elevation: 4 },
          }),
        },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: isSynced ? "rgba(255,255,255,0.2)" : colors.warning + "22" },
        ]}
      >
        <MaterialCommunityIcons
          name={isSynced ? "check-decagram" : "call-merge"}
          size={16}
          color={isSynced ? "#fff" : colors.warning}
        />
      </View>

      {isSynced ? (
        <Text style={[styles.syncedLabel, { color: "#fff" }]}>
          In sync with convoy!
        </Text>
      ) : (
        <View style={styles.textRow}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            In sync in{" "}
          </Text>
          <Text style={[styles.value, { color: colors.warning }]}>
            {formatETA(etaS)}
          </Text>
          <Text style={[styles.sep, { color: colors.mutedForeground }]}> · </Text>
          <Text style={[styles.value, { color: colors.warning }]}>
            {formatDistance(mergeState.distanceToMergeM)}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    marginBottom: 10,
    maxWidth: 320,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  textRow: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  value: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  sep: {
    fontSize: 13,
  },
  syncedLabel: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    flexShrink: 1,
  },
});
