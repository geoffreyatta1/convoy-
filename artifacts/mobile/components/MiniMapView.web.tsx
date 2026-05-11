import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";

import { NavigationState, Vehicle } from "@/context/ConvoyContext";
import { useColors } from "@/hooks/useColors";
import ConvoyMap from "./ConvoyMap.web";

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

const NATURAL_W = 480;
const NATURAL_H = 420;
const MINI_W = 148;
const MINI_H = 120;
const SCALE = MINI_W / NATURAL_W;

export default function MiniMapView({ vehicles, navigation, gapWarnings }: MiniMapViewProps) {
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
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        {/* Scaled-down ConvoyMap.web.tsx clipped in fixed container, pointer-events disabled */}
        <View style={{ width: MINI_W, height: MINI_H, overflow: "hidden" }}>
          <View
            pointerEvents="none"
            style={[
              styles.scaledMap,
              {
                width: NATURAL_W,
                height: NATURAL_H,
                transformOrigin: "top left",
                transform: [{ scale: SCALE }],
              },
            ]}
          >
            <ConvoyMap
              vehicles={vehicles}
              myVehicle={null}
              isNavigating
              destination={navigation.destination}
              route={navigation.route}
              gapWarnings={gapWarnings}
            />
          </View>
        </View>

        {/* Distance/ETA pill */}
        <View style={[styles.pill, { borderTopColor: colors.border }]}>
          <MaterialCommunityIcons name="map-marker-distance" size={10} color={colors.primary} />
          <Text style={[styles.pillText, { color: colors.foreground }]}>
            {fmtMi(remDistM)} mi · {fmtMin(remDurS)}
          </Text>
        </View>

        <View style={[styles.expandHint, { backgroundColor: colors.border }]}>
          <MaterialCommunityIcons name="arrow-expand" size={9} color={colors.mutedForeground} />
        </View>
      </TouchableOpacity>

      {/* Expanded read-only route overview modal */}
      <Modal
        visible={expanded}
        transparent
        animationType="fade"
        onRequestClose={() => setExpanded(false)}
      >
        <TouchableWithoutFeedback onPress={() => setExpanded(false)}>
          <View style={styles.overlay}>
            <View
              onStartShouldSetResponder={() => true}
              style={[styles.expandedCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
            <View style={styles.expandedHeader}>
              <Text style={[styles.expandedTitle, { color: colors.foreground }]}>
                Route Overview
              </Text>
              <TouchableOpacity
                onPress={() => setExpanded(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="close" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <View style={{ width: 320, height: 260, overflow: "hidden" }} pointerEvents="none">
              <ConvoyMap
                vehicles={vehicles}
                myVehicle={null}
                isNavigating
                destination={navigation.destination}
                route={navigation.route}
                gapWarnings={gapWarnings}
              />
            </View>

            <View style={[styles.expandedPill, { borderTopColor: colors.border }]}>
              <MaterialCommunityIcons name="map-marker-distance" size={13} color={colors.primary} />
              <Text style={[styles.expandedDist, { color: colors.foreground }]}>
                {fmtMi(remDistM)} mi · {fmtMin(remDurS)} remaining
              </Text>
            </View>
            <View style={[styles.expandedDestRow, { borderTopColor: colors.border }]}>
              <MaterialCommunityIcons name="flag-checkered" size={12} color={colors.mutedForeground} />
              <Text style={[styles.expandedDest, { color: colors.mutedForeground }]} numberOfLines={1}>
                {navigation.destination.name}
              </Text>
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
    width: MINI_W,
  },
  scaledMap: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pillText: {
    fontSize: 10,
    fontWeight: "700",
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
    width: 340,
    overflow: "hidden",
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
  },
  expandedDestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  expandedDest: {
    fontSize: 12,
    flex: 1,
  },
});
