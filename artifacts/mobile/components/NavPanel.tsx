/**
 * NavPanel — Waze/Google Maps-style navigation banner.
 *
 * Two phases:
 *
 * MERGE PHASE  (follower, not yet on convoy route)
 *   Amber banner — large icon, live distance to next merge step, footer showing
 *   distance to merge point and final destination.
 *
 * CONVOY PHASE  (leader, or follower who has joined the route)
 *   Navy banner — large turn icon, live countdown distance, speed badge,
 *   ETA footer, "Recalculating…" overlay, arrival card.
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef } from "react";

type MCIconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useConvoy } from "@/context/ConvoyContext";
import { useColors } from "@/hooks/useColors";
import { formatDistance, formatETA, haversineMeters } from "@/services/routing";
import { announceNavArrival, announceNavStep } from "@/services/tts";

interface NavPanelProps {
  isRecalculating?: boolean;
  onSuggestStop?: () => void;
}

export default function NavPanel({ isRecalculating = false, onSuggestStop }: NavPanelProps) {
  const colors = useColors();
  const {
    session,
    isLeader,
    myVehicle,
    mergeState,
    advanceNavStep,
    advanceMergeStep,
    clearNavigation,
  } = useConvoy();
  const nav = session?.navigation;

  // Announce arrival once when the arrival card is shown
  const hasAnnouncedArrivalRef = useRef(false);

  // Announce each convoy step change for followers (leader's TTS is handled by
  // autoAdvanceStep in map.tsx to avoid double-announcement).
  const prevStepIdxRef = useRef<number | null>(null);
  useEffect(() => {
    if (!nav || !nav.steps.length) { prevStepIdxRef.current = null; return; }
    const idx = nav.currentStepIndex;
    if (prevStepIdxRef.current === null) {
      prevStepIdxRef.current = idx;
      return;
    }
    if (!isLeader && idx !== prevStepIdxRef.current) {
      const step = nav.steps[idx];
      if (step) announceNavStep(step.instruction, step.distanceM);
    }
    prevStepIdxRef.current = idx;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- nav accessed via nav?.currentStepIndex primitive; adding full nav object would re-run on every location tick
  }, [nav?.currentStepIndex, isLeader]);

  const step0 = nav?.steps[nav.currentStepIndex] ?? nav?.steps[nav.steps.length - 1];
  const isArrived =
    nav != null &&
    nav.currentStepIndex >= nav.steps.length - 1 &&
    myVehicle &&
    step0?.location
      ? haversineMeters(
          myVehicle.location.latitude,
          myVehicle.location.longitude,
          step0.location.latitude,
          step0.location.longitude
        ) < 30
      : false;

  useEffect(() => {
    if (isArrived && !hasAnnouncedArrivalRef.current && nav) {
      hasAnnouncedArrivalRef.current = true;
      announceNavArrival(nav.destination.name);
    }
    if (!isArrived) hasAnnouncedArrivalRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- nav?.destination.name captures the value we depend on; adding nav would re-run on every nav update
  }, [isArrived, nav?.destination.name]);

  if (!nav || !nav.steps.length) return null;

  // ── MERGE PHASE: follower driving to intercept the convoy ──────────────────
  if (!isLeader && mergeState && !mergeState.onConvoyRoute) {
    const { personalSteps, personalStepIndex, distanceToMergeM } = mergeState;
    const mergeStep = personalSteps[personalStepIndex] ?? personalSteps[personalSteps.length - 1];
    const isLastMergeStep = personalStepIndex >= personalSteps.length - 1;

    const liveDistToMergeStep =
      myVehicle && mergeStep?.location
        ? haversineMeters(
            myVehicle.location.latitude,
            myVehicle.location.longitude,
            mergeStep.location.latitude,
            mergeStep.location.longitude
          )
        : mergeStep?.distanceM ?? 0;

    const mergeIcon = (mergeStep?.icon || "call-merge") as MCIconName;

    const handleMergeNext = () => {
      if (Platform.OS !== "web") Haptics.selectionAsync();
      if (!isLastMergeStep) advanceMergeStep(personalStepIndex + 1);
    };

    return (
      <View style={[styles.panel, { backgroundColor: colors.warning }]}>
        <View style={styles.badgeRow}>
          <MaterialCommunityIcons name="call-merge" size={13} color="#fff" />
          <Text style={styles.badgeText}>JOINING CONVOY</Text>
        </View>

        <View style={styles.main}>
          <View style={[styles.iconBox, { backgroundColor: "rgba(0,0,0,0.18)" }]}>
            <MaterialCommunityIcons name={mergeIcon} size={36} color="#fff" />
          </View>

          <View style={styles.textArea}>
            <Text style={styles.distanceText}>
              {formatDistance(Math.max(0, liveDistToMergeStep))}
            </Text>
            <Text style={styles.instruction} numberOfLines={2}>
              {mergeStep?.instruction ?? "Head to merge point"}
            </Text>
          </View>

          <View style={styles.actions}>
            {!isLastMergeStep && (
              <TouchableOpacity
                onPress={handleMergeNext}
                style={[styles.nextBtn, { backgroundColor: "rgba(0,0,0,0.18)" }]}
              >
                <Text style={styles.nextBtnText}>Next</Text>
                <MaterialCommunityIcons name="chevron-right" size={16} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={clearNavigation} style={styles.stopBtn}>
              <MaterialCommunityIcons name="close" size={18} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.footer, { borderTopColor: "rgba(0,0,0,0.12)" }]}>
          <MaterialCommunityIcons name="map-marker-distance" size={12} color="rgba(255,255,255,0.9)" />
          <Text style={styles.footerDest} numberOfLines={1}>
            Join convoy in{" "}
            <Text style={{ fontWeight: "700" }}>{formatDistance(distanceToMergeM)}</Text>
            {" · then → "}
            {nav.destination.name}
          </Text>
        </View>
      </View>
    );
  }

  // ── CONVOY PHASE: shared navigation ───────────────────────────────────────
  const step = nav.steps[nav.currentStepIndex] ?? nav.steps[nav.steps.length - 1];
  const isLast = nav.currentStepIndex >= nav.steps.length - 1;

  const distRemaining = nav.steps
    .slice(nav.currentStepIndex)
    .reduce((acc, s) => acc + s.distanceM, 0);
  const etaRemaining = nav.steps
    .slice(nav.currentStepIndex)
    .reduce((acc, s) => acc + s.durationS, 0);

  const speed =
    myVehicle?.location.speed != null ? Math.round(myVehicle.location.speed) : null;

  const liveDistToStep =
    myVehicle && step.location
      ? haversineMeters(
          myVehicle.location.latitude,
          myVehicle.location.longitude,
          step.location.latitude,
          step.location.longitude
        )
      : step.distanceM;

  const handleNext = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    if (isLast) {
      clearNavigation();
    } else {
      advanceNavStep(nav.currentStepIndex + 1);
    }
  };

  const handleStop = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    clearNavigation();
  };

  // Arrival card
  if (isLast && liveDistToStep < 30) {
    return (
      <View style={[styles.arrivalPanel, { backgroundColor: "#16a34a" }]}>
        <View style={styles.arrivalMain}>
          <View style={[styles.arrivalIconBox, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
            <MaterialCommunityIcons name="flag-checkered" size={40} color="#fff" />
          </View>
          <View style={styles.arrivalText}>
            <Text style={styles.arrivalTitle}>You've arrived!</Text>
            <Text style={styles.arrivalSub} numberOfLines={1}>
              {nav.destination.name}
            </Text>
          </View>
          {isLeader && (
            <TouchableOpacity onPress={handleStop} style={styles.arrivalDismiss}>
              <Text style={styles.arrivalDismissText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  const iconName = (step.icon || "arrow-up") as MCIconName;
  const panelBg = isRecalculating ? "#92400e" : "#1e3a5f";

  return (
    <View style={[styles.panel, { backgroundColor: panelBg }]}>
      {/* Badge shown when a follower has just joined the route */}
      {!isLeader && mergeState?.onConvoyRoute && (
        <View style={styles.badgeRow}>
          <MaterialCommunityIcons name="check-circle" size={12} color="#fff" />
          <Text style={styles.badgeText}>ON CONVOY ROUTE</Text>
        </View>
      )}

      {isRecalculating ? (
        <View style={styles.recalcRow}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.recalcText}>Recalculating…</Text>
        </View>
      ) : (
        <View style={styles.main}>
          <View style={[styles.iconBox, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
            <MaterialCommunityIcons name={iconName} size={36} color="#fff" />
          </View>

          <View style={styles.textArea}>
            <Text style={styles.distanceText}>
              {formatDistance(Math.max(0, liveDistToStep))}
            </Text>
            <Text style={styles.instruction} numberOfLines={2}>
              {step.instruction}
            </Text>
          </View>

          <View style={styles.actions}>
            {isLeader && (
              <TouchableOpacity
                onPress={handleNext}
                style={[styles.nextBtn, { backgroundColor: "rgba(255,255,255,0.2)" }]}
              >
                <Text style={styles.nextBtnText}>
                  {isLast ? "Done" : "Next"}
                </Text>
                <MaterialCommunityIcons
                  name={isLast ? "check" : "chevron-right"}
                  size={16}
                  color="#fff"
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleStop} style={styles.stopBtn}>
              <MaterialCommunityIcons name="close" size={18} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={[styles.footer, { borderTopColor: "rgba(255,255,255,0.15)" }]}>
        <MaterialCommunityIcons name="flag-checkered" size={12} color="rgba(255,255,255,0.7)" />
        <Text style={styles.footerDest} numberOfLines={1}>
          {nav.destination.name}
        </Text>
        <Text style={styles.footerEta}>
          {formatDistance(distRemaining)} · {formatETA(etaRemaining)}
        </Text>
        {speed !== null && (
          <View style={styles.speedBadge}>
            <Text style={styles.speedText}>{speed}</Text>
            <Text style={styles.speedUnit}>mph</Text>
          </View>
        )}
        {onSuggestStop && (
          <TouchableOpacity onPress={onSuggestStop} style={styles.suggestStopBtn}>
            <MaterialCommunityIcons name="map-marker-plus" size={14} color="#f59e0b" />
            <Text style={styles.suggestStopText}>Stop</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
    overflow: "hidden",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    opacity: 0.85,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    fontFamily: "Inter_700Bold",
  },
  recalcRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  recalcText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  main: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 14,
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  textArea: {
    flex: 1,
    gap: 2,
  },
  distanceText: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
    fontFamily: "Inter_700Bold",
    lineHeight: 30,
  },
  instruction: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    lineHeight: 19,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  nextBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  stopBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
  },
  footerDest: {
    flex: 1,
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  footerEta: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  speedBadge: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 4,
  },
  speedText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    fontFamily: "Inter_700Bold",
  },
  speedUnit: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  suggestStopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(245,158,11,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 4,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.4)",
  },
  suggestStopText: {
    color: "#f59e0b",
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  arrivalPanel: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
    overflow: "hidden",
  },
  arrivalMain: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 14,
  },
  arrivalIconBox: {
    width: 68,
    height: 68,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  arrivalText: {
    flex: 1,
    gap: 4,
  },
  arrivalTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    fontFamily: "Inter_700Bold",
  },
  arrivalSub: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  arrivalDismiss: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  arrivalDismissText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
});
