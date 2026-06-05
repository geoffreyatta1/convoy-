import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import RAnimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AiAssistantButton from "@/components/AiAssistantButton";
import ConvoyFormation from "@/components/ConvoyFormation";
import MiniMapView from "@/components/MiniMapView";
import ConvoyMap from "@/components/ConvoyMap";
import DestinationPicker from "@/components/DestinationPicker";
import HazardPicker from "@/components/HazardPicker";
import MergePill from "@/components/MergePill";
import NavPanel from "@/components/NavPanel";
import RegroupModal from "@/components/RegroupModal";
import { StopRequestModal } from "@/components/StopRequestModal";
import { StopProposalBanner } from "@/components/StopProposalBanner";
import { SuggestStopModal } from "@/components/SuggestStopModal";
import ShareConvoyModal from "@/components/ShareConvoyModal";
import TalkButton from "@/components/TalkButton";
import { RegroupPin, useConvoy, Vehicle } from "@/context/ConvoyContext";
import { HazardType } from "@/services/hazards";
import { useColors } from "@/hooks/useColors";
import {
  startBackgroundLocationUpdates,
  stopBackgroundLocationUpdates,
} from "@/services/background-location";
import { isCarPlayConnected } from "@/services/carplay";
import { playSound } from "@/services/sounds";
import {
  fetchRoute,
  fetchRouteViaStop,
  haversineMeters,
  NavStep,
  subsampleRoute,
} from "@/services/routing";
import {
  announceNavStep,
  announceNavArrival,
  announceNavRecalculate,
} from "@/services/tts";

const OFF_ROUTE_THRESHOLD_M = 80;
const OFF_ROUTE_CHECK_INTERVAL_MS = 5000;

/* ─── time/distance helpers ────────────────────────────────── */
function fmt2(n: number) { return n.toString().padStart(2, "0"); }
function fmtArrival(durS: number) {
  const d = new Date(Date.now() + durS * 1000);
  return `${fmt2(d.getHours())}:${fmt2(d.getMinutes())}`;
}
function fmtDuration(durS: number) {
  if (durS <= 0) return "0";
  const h = Math.floor(durS / 3600);
  const m = Math.floor((durS % 3600) / 60);
  return h > 0 ? `${h}:${fmt2(m)}` : `${m}`;
}
function fmtDistMi(m: number) {
  const mi = m / 1609.344;
  return mi < 10 ? mi.toFixed(1) : Math.round(mi).toString();
}

/* ─── tab-bar height constant ──────────────────────────────── */
const TAB_BAR_HEIGHT = Platform.OS === "web" ? 84 : 49;

export default function MapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const {
    session,
    myVehicle,
    isLeader,
    mergeState,
    leaveConvoy,
    updateMyLocation,
    advanceNavStep,
    computeMerge,
    updateMergeProgress,
    startNavigation,
    gapWarnings,
    hazards,
    reportHazard,
    isTalking,
    talkTarget,
    setTalkTarget,
    startTalking,
    stopTalking,
    hasIncomingPrivate,
    incomingPrivateSenderId,
    replyToPrivate,
    isPrivateChannelWarm,
    privateWarmPartnerName,
    speakingVehicleNames,
    isGroupBroadcastActive,
    isLeaderBroadcastActive,
    isLeaderVacant,
    transferLeadership,
    claimLeadership,
    voiceTokenWarning,
    dismissVoiceTokenWarning,
    voiceConnectStatus,
    bgPttWarning,
    dismissBgPttWarning,
    pendingStopRequest,
    respondToStopRequest,
    regroupPin,
    clearRegroupPin,
    vehicleRegroupEtas,
    isInSyncZone,
    convoycentroid,
    clearSyncPTT,
    pendingStopProposal,
    sendStopProposal,
    respondToStopProposal,
    dismissStopProposal,
  } = useConvoy();


  const [showFormation, setShowFormation] = useState(true);
  const [carConnected, setCarConnected] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showDestPicker, setShowDestPicker] = useState(false);
  const [showRegroup, setShowRegroup] = useState(false);
  const [showHazardPicker, setShowHazardPicker] = useState(false);
  const [navPanelHeight, setNavPanelHeight] = useState(0);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [gapBannerDismissed, setGapBannerDismissed] = useState(false);
  const [syncBannerDismissed, setSyncBannerDismissed] = useState(false);
  const [showSuggestStop, setShowSuggestStop] = useState(false);
  const syncBorderAnim = useRef(new Animated.Value(0)).current;

  // ── Banner auto-hide (NavPanel + ETA stats) ──────────────────────────────
  // Banners fade out 4 s after nav starts or after a tap, reappear on any tap.
  const bannersAnim = useRef(new Animated.Value(1)).current;
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [bannersHidden, setBannersHidden] = useState(false);
  const prevIsNavigatingRef = useRef(false);

  const locationRef = useRef<Location.LocationSubscription | null>(null);
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simStepRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const offRouteTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recalcLockRef = useRef(false);
  const miniMapAnim = useRef(new Animated.Value(0)).current;
  const syncBorderLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const prevIsInSyncZoneRef = useRef(false);

  const nav = session?.navigation;
  const isNavigating = !!nav;
  const lastNavRef = useRef<typeof nav>(null);
  // Track the most-recent non-null nav so the mini-map stays mounted during slide-out
  if (nav) lastNavRef.current = nav;

  // ── Live refs — updated every render so long-lived callbacks (watchPosition,
  // setInterval) always read the current value instead of a stale closure copy.
  const navRef = useRef(nav);
  navRef.current = nav;
  // Tracks which NavStep objects have already been pre-announced (200 m warning).
  // Using a WeakMap keyed on the step object avoids mutating shared state and
  // naturally resets when the route is recalculated (new step objects replace old ones).
  const announcedNavStepsRef = useRef(new WeakMap<NavStep, boolean>());
  const isLeaderRef = useRef(isLeader);
  isLeaderRef.current = isLeader;
  const myVehicleRef = useRef(myVehicle);
  myVehicleRef.current = myVehicle;

  const showBannersTemporarily = useCallback(() => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    setBannersHidden(false);
    Animated.timing(bannersAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    bannerTimerRef.current = setTimeout(() => {
      Animated.timing(bannersAnim, { toValue: 0, duration: 500, useNativeDriver: true }).start(
        ({ finished }) => { if (finished) setBannersHidden(true); }
      );
    }, 4000);
  }, [bannersAnim]);

  /* ── Auto-hide banners when navigation starts ────────────── */
  useEffect(() => {
    if (isNavigating && !prevIsNavigatingRef.current) {
      showBannersTemporarily();
    }
    if (!isNavigating) {
      if (bannerTimerRef.current) { clearTimeout(bannerTimerRef.current); bannerTimerRef.current = null; }
      setBannersHidden(false);
      bannersAnim.setValue(1);
    }
    prevIsNavigatingRef.current = isNavigating;
  }, [isNavigating, showBannersTemporarily, bannersAnim]);

  /* ── CarPlay polling ─────────────────────────────────────── */
  useEffect(() => {
    const timer = setInterval(() => setCarConnected(isCarPlayConnected()), 2000);
    return () => clearInterval(timer);
  }, []);

  /* ── Auto-reset gap banner when all gaps close ───────────── */
  useEffect(() => {
    if (gapWarnings.size === 0) setGapBannerDismissed(false);
  }, [gapWarnings.size]);

  /* ── Auto-dismiss gap banner after 4 s ───────────────────── */
  useEffect(() => {
    if (gapWarnings.size === 0) return;
    const t = setTimeout(() => setGapBannerDismissed(true), 4000);
    return () => clearTimeout(t);
  }, [gapWarnings.size]);

  /* ── Gap warning banner: slide-down in / slide-up+fade out on UI thread ── */
  const gapBannerVisible = gapWarnings.size > 0 && !gapBannerDismissed;
  const _gapBannerOpacity = useSharedValue(0);
  const _gapBannerTranslateY = useSharedValue(-44);
  useEffect(() => {
    if (gapBannerVisible) {
      _gapBannerOpacity.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) });
      _gapBannerTranslateY.value = withTiming(0, { duration: 250, easing: Easing.out(Easing.cubic) });
    } else {
      _gapBannerOpacity.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) });
      _gapBannerTranslateY.value = withTiming(-44, { duration: 200, easing: Easing.in(Easing.cubic) });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gapBannerVisible]);
  const gapBannerAnimStyle = useAnimatedStyle(() => ({
    opacity: _gapBannerOpacity.value,
    transform: [{ translateY: _gapBannerTranslateY.value }],
  }));

  /* ── Formation badge: fade+scale in/out on UI thread ────── */
  const formationVisible =
    !!(session && gapWarnings.size === 0 && session.vehicles.length >= 2 && !mergeState);
  const _formationOpacity = useSharedValue(0);
  const _formationScale = useSharedValue(0.85);
  useEffect(() => {
    if (formationVisible) {
      _formationOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
      _formationScale.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.back(1.2)) });
    } else {
      _formationOpacity.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) });
      _formationScale.value = withTiming(0.85, { duration: 200, easing: Easing.in(Easing.cubic) });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formationVisible]);
  const formationAnimStyle = useAnimatedStyle(() => ({
    opacity: _formationOpacity.value,
    transform: [{ scale: _formationScale.value }],
  }));

  /* ── Car-count badge bump animation ──────────────────────── */
  // Tracks previous count so we know whether to play a join (scale-pop up)
  // or leave (scale-shrink) animation when session.vehicles.length changes.
  const _prevVehicleCount = useRef(session?.vehicles.length ?? 0);
  const _carCountScale = useSharedValue(1);
  const _carCountShake = useSharedValue(0);
  useEffect(() => {
    const current = session?.vehicles.length ?? 0;
    const prev = _prevVehicleCount.current;
    _prevVehicleCount.current = current;
    if (current === prev) return;
    if (current > prev) {
      // Join: scale-pop up → back (draws eye to the new count)
      _carCountScale.value = withSequence(
        withTiming(1.3, { duration: 130, easing: Easing.out(Easing.cubic) }),
        withTiming(1.0, { duration: 170, easing: Easing.out(Easing.back(2)) }),
      );
    } else {
      // Leave: rapid horizontal shake signals the vehicle departure
      _carCountShake.value = withSequence(
        withTiming(-4, { duration: 55 }),
        withTiming( 4, { duration: 55 }),
        withTiming(-3, { duration: 50 }),
        withTiming( 3, { duration: 50 }),
        withTiming( 0, { duration: 65 }),
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.vehicles.length]);
  const carCountAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: _carCountScale.value },
      { translateX: _carCountShake.value },
    ],
  }));

  /* ── Auto-dismiss sync banner after 4 s ─────────────────── */
  useEffect(() => {
    if (!isInSyncZone) return;
    const t = setTimeout(() => setSyncBannerDismissed(true), 4000);
    return () => clearTimeout(t);
  }, [isInSyncZone]);

  /* ── Mini-map slide-in / slide-out ───────────────────────── */
  useEffect(() => {
    Animated.timing(miniMapAnim, {
      toValue: isNavigating ? 1 : 0,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [isNavigating, miniMapAnim]);

  /* ── Sync zone: pulsing green border ─────────────────────── */
  useEffect(() => {
    const wasInSync = prevIsInSyncZoneRef.current;
    prevIsInSyncZoneRef.current = isInSyncZone;

    if (isInSyncZone) {
      setSyncBannerDismissed(false);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(syncBorderAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(syncBorderAnim, { toValue: 0.25, duration: 1200, useNativeDriver: true }),
        ])
      );
      syncBorderLoopRef.current = loop;
      loop.start();
    } else if (wasInSync) {
      // Only tear down on an actual exit transition (true → false), not on initial mount.
      syncBorderLoopRef.current?.stop();
      syncBorderLoopRef.current = null;
      Animated.timing(syncBorderAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start();
      clearSyncPTT();
    }

    return () => {
      syncBorderLoopRef.current?.stop();
      syncBorderLoopRef.current = null;
    };
  }, [isInSyncZone, clearSyncPTT, syncBorderAnim]);


  /* ── Session guard ───────────────────────────────────────── */
  useEffect(() => {
    if (session?.id == null) return;
    startLocationTracking();
    return () => {
      locationRef.current?.remove();
      stopBackgroundLocationUpdates();
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
      if (simStepRef.current) clearInterval(simStepRef.current);
      if (offRouteTimerRef.current) clearInterval(offRouteTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- startLocationTracking is not memoized in context; session?.id is the correct trigger
  }, [session?.id]);

  /* ── Simulation auto-advance (web / no GPS) ──────────────── */
  useEffect(() => {
    if (simStepRef.current) clearInterval(simStepRef.current);
    if (!nav || !isLeader || Platform.OS !== "web") return;
    simStepRef.current = setInterval(() => {
      const current = navRef.current;           // always-current ref, not stale closure
      if (!current) return;
      const next = current.currentStepIndex + 1;
      if (next < current.steps.length) advanceNavStep(next);
      else if (simStepRef.current) clearInterval(simStepRef.current);
    }, 12000);
    return () => { if (simStepRef.current) clearInterval(simStepRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- nav accessed via navRef (always-current ref); avoids re-creating interval on every step change
  }, [isNavigating, isLeader, advanceNavStep]);

  /* ── Follower merge compute ───────────────────────────────── */
  useEffect(() => {
    if (!isNavigating || isLeader) return;
    const loc = myVehicle?.location;
    if (loc) computeMerge(loc.latitude, loc.longitude);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- myVehicle.location intentionally omitted; re-runs on nav-start/stop, not every GPS tick
  }, [isNavigating, isLeader, computeMerge]);

  /* ── Off-route detection (leader only, native only) ─────── */
  useEffect(() => {
    if (offRouteTimerRef.current) clearInterval(offRouteTimerRef.current);
    if (!isNavigating || !isLeader || Platform.OS === "web") return;

    offRouteTimerRef.current = setInterval(() => {
      checkOffRoute();
    }, OFF_ROUTE_CHECK_INTERVAL_MS);

    return () => {
      if (offRouteTimerRef.current) clearInterval(offRouteTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- checkOffRoute uses navRef/myVehicleRef (always-current refs); stable interval is intentional
  }, [isNavigating, isLeader]);

  const checkOffRoute = async () => {
    if (recalcLockRef.current) return;
    const currentNav = navRef.current;            // always-current ref
    const loc = myVehicleRef.current?.location;   // always-current ref
    if (!currentNav || !loc || !currentNav.route.length) return;

    let minDist = Infinity;
    for (const pt of currentNav.route) {
      const d = haversineMeters(loc.latitude, loc.longitude, pt.latitude, pt.longitude);
      if (d < minDist) minDist = d;
    }

    if (minDist > OFF_ROUTE_THRESHOLD_M) {
      recalcLockRef.current = true;
      setIsRecalculating(true);
      announceNavRecalculate();
      try {
        const result = await fetchRoute(
          loc.latitude,
          loc.longitude,
          currentNav.destination.latitude,
          currentNav.destination.longitude
        );
        if (result) {
          startNavigation({
            destination: currentNav.destination,
            route: result.route,
            steps: result.steps,
            currentStepIndex: 0,
            totalDistanceM: result.totalDistanceM,
            totalDurationS: result.totalDurationS,
            totalDurationInTrafficS: result.totalDurationInTrafficS,
          });
          if (result.steps.length > 0) {
            announceNavStep(result.steps[0].instruction, result.steps[0].distanceM);
          }
        }
      } finally {
        setIsRecalculating(false);
        recalcLockRef.current = false;
      }
    }
  };

  /* ── Location tracking ───────────────────────────────────── */
  const startLocationTracking = async () => {
    if (Platform.OS === "web") { startSimulation(37.7749, -122.4194); return; }
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== "granted") { startSimulation(37.7749, -122.4194); return; }
    // Request background ("Always") permission, then start a TaskManager-backed
    // background location task so convoy members stay visible even when this
    // driver backgrounds the app.
    await Location.requestBackgroundPermissionsAsync();
    await startBackgroundLocationUpdates();
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      updateMyLocation({
        latitude: loc.coords.latitude, longitude: loc.coords.longitude,
        heading: loc.coords.heading ?? 0, speed: (loc.coords.speed ?? 0) * 2.237,
      });
      // watchPositionAsync drives foreground UI updates (map, auto-advance, merge).
      // The TaskManager background task independently forwards location via WS
      // when the app is backgrounded, ensuring the driver's position never goes stale.
      locationRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 5, timeInterval: 3000 },
        (l) => {
          const pos = {
            latitude: l.coords.latitude, longitude: l.coords.longitude,
            heading: l.coords.heading ?? 0, speed: (l.coords.speed ?? 0) * 2.237,
          };
          updateMyLocation(pos);
          autoAdvanceStep(pos.latitude, pos.longitude);
          if (!isLeaderRef.current) updateMergeProgress(pos.latitude, pos.longitude);
        }
      );
    } catch { startSimulation(37.7749, -122.4194); }
  };

  const autoAdvanceStep = (lat: number, lng: number) => {
    const current = navRef.current;          // always-current ref
    if (!current || !isLeaderRef.current) return;
    const nextIdx = current.currentStepIndex + 1;
    if (nextIdx >= current.steps.length) return;
    const nextStep = current.steps[nextIdx];
    const distToNext = haversineMeters(lat, lng, nextStep.location.latitude, nextStep.location.longitude);
    if (distToNext < 30) {
      advanceNavStep(nextIdx);
      // Announce the step after next (upcoming maneuver) or arrival
      const afterIdx = nextIdx + 1;
      if (afterIdx < current.steps.length) {
        const afterStep = current.steps[afterIdx];
        announceNavStep(afterStep.instruction, afterStep.distanceM);
      } else {
        announceNavArrival(current.destination.name);
      }
    } else if (distToNext < 200) {
      // Pre-announce the approaching step when 200 m away
      const approaching = current.steps[current.currentStepIndex];
      if (approaching && !announcedNavStepsRef.current.has(approaching)) {
        announcedNavStepsRef.current.set(approaching, true);
        announceNavStep(nextStep.instruction, distToNext);
      }
    }
  };

  const startSimulation = (lat: number, lng: number) => {
    let heading = 45; let speed = 30;
    simIntervalRef.current = setInterval(() => {
      heading = (heading + (Math.random() - 0.5) * 5) % 360;
      speed = Math.max(0, Math.min(65, speed + (Math.random() - 0.5) * 3));
      const radians = (heading * Math.PI) / 180;
      const delta = 0.00005;
      lat += Math.cos(radians) * delta;
      lng += Math.sin(radians) * delta;
      updateMyLocation({ latitude: lat, longitude: lng, heading, speed });
      if (!isLeaderRef.current) updateMergeProgress(lat, lng);
    }, 3000);
  };

  const handleLeave = () => {
    Alert.alert("Leave Convoy?", "You'll be disconnected from the convoy.", [
      { text: "Cancel", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: async () => {
        await leaveConvoy();
        router.replace("/(tabs)/convoys");
      }},
    ]);
  };

  const handleVoiceHazard = async (hazardType: string) => {
    const loc = myVehicle?.location;
    if (loc && session) {
      await reportHazard(hazardType as HazardType, loc.latitude, loc.longitude);
    }
  };

  const handleRegroupPinNavigate = useCallback(async (pin: RegroupPin) => {
    const loc = myVehicle?.location;
    if (!loc) return;
    const result = await fetchRoute(loc.latitude, loc.longitude, pin.lat, pin.lng);
    if (!result) return;
    startNavigation({
      steps: result.steps,
      route: result.route,
      destination: { name: pin.name, latitude: pin.lat, longitude: pin.lng },
      totalDistanceM: result.totalDistanceM,
      totalDurationS: result.totalDurationS,
      totalDurationInTrafficS: result.totalDurationS,
      currentStepIndex: 0,
      navSource: "regroup",
    });
  }, [myVehicle, startNavigation]);

  const handleVehicleTap = async (vehicle: Vehicle) => {
    if (Platform.OS === "web") return;
    if (vehicle.isMe) return;

    // Toggle private PTT with this vehicle
    if (isTalking && talkTarget?.id === vehicle.id) {
      // Already talking to them — stop
      playSound("ptt_end");
      stopTalking();
      setTalkTarget(null);
    } else {
      // Stop any current transmission first
      if (isTalking) {
        stopTalking();
      }
      setTalkTarget(vehicle);
      const started = await startTalking();
      if (started) playSound("ptt_start");
    }
  };

  /* ── Idle map (no active convoy) ────────────────────────── */
  if (!session) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {/* Full-screen map showing user location */}
        <View style={styles.mapArea}>
          <ConvoyMap
            vehicles={[]}
            myVehicle={null}
            showsUserLocation
          />
        </View>

        {/* Dark gradient card at bottom */}
        <View
          style={[
            idleStyles.card,
            {
              bottom: TAB_BAR_HEIGHT + insets.bottom + 12,
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={idleStyles.iconRow}>
            <View style={[idleStyles.iconBadge, { backgroundColor: colors.primary + "22" }]}>
              <MaterialCommunityIcons name="car-multiple" size={28} color={colors.primary} />
            </View>
          </View>
          <Text style={[idleStyles.title, { color: colors.foreground }]}>
            No active convoy
          </Text>
          <Text style={[idleStyles.sub, { color: colors.mutedForeground }]}>
            Create or join a convoy to start navigating together
          </Text>
          <TouchableOpacity
            style={[idleStyles.btn, { backgroundColor: colors.primary }]}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync();
              router.push("/(tabs)/convoys");
            }}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="plus-circle-outline" size={18} color="#fff" />
            <Text style={idleStyles.btnText}>Go to Convoys</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  /* ── Layout measurements ─────────────────────────────────── */
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = TAB_BAR_HEIGHT + insets.bottom + 8;

  // When navigating, floating elements drop below the nav card.
  // navPanelHeight now measures only the card content (not the topPad wrapper
  // padding), so we always add topPad explicitly to avoid double-counting.
  const floatTop = isNavigating
    ? topPad + navPanelHeight + 12
    : topPad + 12;

  // Stats for the navigating bottom sheet
  const stepsLeft = nav ? nav.steps.slice(nav.currentStepIndex) : [];
  const remDistM = stepsLeft.reduce((s, st) => s + st.distanceM, 0);
  // Scale remaining step-duration by the traffic factor so the ETA and
  // "min" display reflects real-world traffic, not free-flow times.
  const rawRemDurS = stepsLeft.reduce((s, st) => s + st.durationS, 0);
  const trafficFactor =
    nav && nav.totalDurationS > 0
      ? nav.totalDurationInTrafficS / nav.totalDurationS
      : 1;
  const remDurS = Math.round(rawRemDurS * trafficFactor);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>

      {/* ── Full-screen map ─────────────────────────────── */}
      <View style={styles.mapArea}>
        <ConvoyMap
          vehicles={session.vehicles}
          myVehicle={myVehicle}
          destination={session.destination}
          route={nav?.route ? subsampleRoute(nav.route) : undefined}
          mergeRoute={
            mergeState && !mergeState.onConvoyRoute && mergeState.personalRoute.length > 0
              ? subsampleRoute(mergeState.personalRoute) : undefined
          }
          mergePoint={
            mergeState && !mergeState.onConvoyRoute ? mergeState.mergePoint : undefined
          }
          isNavigating={isNavigating}
          gapWarnings={gapWarnings}
          hazards={hazards}
          regroupPin={regroupPin}
          isInSyncZone={isInSyncZone}
          convoycentroid={convoycentroid}
          onVehiclePress={handleVehicleTap}
          activeSyncTargetId={isTalking ? talkTarget?.id : null}
          activeSyncCallerId={isTalking && myVehicle ? myVehicle.id : null}
          onMapPress={isNavigating ? showBannersTemporarily : undefined}
          onRegroupPinNavigate={handleRegroupPinNavigate}
          onRegroupPinClear={clearRegroupPin}
        />

        {/* ── Sync zone: pulsing green edge glow (map-scoped) ── */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.syncGlow,
            { opacity: syncBorderAnim },
          ]}
        />
      </View>

      {/* ── NavPanel turn card (navigating) ─────────────── */}
      {isNavigating && (
        <Animated.View
          style={[styles.navPanelWrapper, { paddingTop: topPad, opacity: bannersAnim }]}
          pointerEvents={bannersHidden ? "none" : "box-none"}
        >
          {/* Measure only the card height (not the topPad), so floatTop can
              add topPad explicitly and avoid double-counting it. */}
          <View onLayout={(e) => setNavPanelHeight(e.nativeEvent.layout.height)}>
            <NavPanel
              isRecalculating={isRecalculating}
              onSuggestStop={session?.navigation ? () => setShowSuggestStop(true) : undefined}
            />
          </View>
        </Animated.View>
      )}

      {/* ── Floating convoy info pill ───────────────────── */}
      <View
        style={[
          styles.convoyPill,
          {
            top: floatTop,
            backgroundColor: colors.card,
            borderColor: colors.border,
            ...Platform.select({
              ios: { shadowColor: colors.foreground, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
              android: { elevation: 4 },
            }),
          },
        ]}
      >
        <MaterialCommunityIcons name="link-variant" size={11} color={colors.mutedForeground} />
        <Text style={[styles.pillCode, { color: colors.mutedForeground }]}>{session.code}</Text>
        <View style={[styles.pillDivider, { backgroundColor: colors.border }]} />
        <Text style={[styles.pillName, { color: colors.foreground }]} numberOfLines={1}>
          {session.name}
        </Text>
        {carConnected && (
          <View style={[styles.carPlayBadge, { backgroundColor: colors.success + "22" }]}>
            <MaterialCommunityIcons name="car-connected" size={11} color={colors.success} />
            <Text style={[styles.carPlayText, { color: colors.success }]}>CarPlay</Text>
          </View>
        )}
        <RAnimated.View style={[styles.carCountBadge, { backgroundColor: colors.primary + "22" }, carCountAnimStyle]}>
          <MaterialCommunityIcons name="car" size={12} color={colors.primary} />
          <Text style={[styles.carCountText, { color: colors.primary }]}>
            {session.vehicles.length}
          </Text>
        </RAnimated.View>
        {/* Always mounted so the exit animation can play; opacity driven by Reanimated */}
        <RAnimated.View
          style={[styles.formationBadge, { backgroundColor: "#22c55e22" }, formationAnimStyle]}
          pointerEvents="none"
        >
          <View style={[styles.formationDot, { backgroundColor: "#22c55e" }]} />
          <Text style={[styles.formationText, { color: "#22c55e" }]}>In formation</Text>
        </RAnimated.View>
      </View>

      {/* ── Right sidebar floating buttons ──────────────── */}
      <View style={[styles.rightSidebar, { top: floatTop }]}>
        {/* All buttons grouped in a single card so they align perfectly */}
        <View style={[styles.sideCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* 2D map mode indicator */}
          <View style={styles.sidePill}>
            <Text style={[styles.sideBtnLabel, { color: colors.foreground }]}>2D</Text>
          </View>

          <View style={[styles.sideDivider, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync();
              setShowShare(true);
            }}
            style={styles.sidePill}
          >
            <MaterialCommunityIcons name="share-variant" size={18} color={colors.foreground} />
          </TouchableOpacity>

          <View style={[styles.sideDivider, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync();
              setShowHazardPicker(true);
            }}
            style={styles.sidePill}
          >
            <MaterialCommunityIcons name="shield-alert" size={18} color={colors.foreground} />
          </TouchableOpacity>

          <View style={[styles.sideDivider, { backgroundColor: colors.border }]} />

          {/* AI voice assistant mic */}
          <AiAssistantButton onHazardDetected={handleVoiceHazard} inCard />

          <View style={[styles.sideDivider, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync();
              setShowRegroup(true);
            }}
            style={[
              styles.sidePill,
              gapWarnings.size > 0 && { backgroundColor: colors.warning + "22" },
            ]}
          >
            <MaterialCommunityIcons
              name="gas-station"
              size={18}
              color={gapWarnings.size > 0 ? colors.warning : colors.foreground}
            />
          </TouchableOpacity>

          <View style={[styles.sideDivider, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            onPress={handleLeave}
            style={[styles.sidePill, { backgroundColor: colors.destructive + "22" }]}
          >
            <Ionicons name="exit" size={18} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Gap warning banner — always mounted so exit animation plays ── */}
      <RAnimated.View
        style={[styles.gapBanner, { top: floatTop + 52 }, gapBannerAnimStyle]}
        pointerEvents={gapBannerVisible ? "auto" : "none"}
      >
        <MaterialCommunityIcons name="alert" size={16} color="#fff" />
        <Text style={styles.gapBannerText} numberOfLines={1}>
          {Array.from(gapWarnings)
            .map((id) => session.vehicles.find((v) => v.id === id)?.name ?? "A vehicle")
            .join(", ")}{" "}
          {gapWarnings.size === 1 ? "is" : "are"} falling behind
        </Text>
        <TouchableOpacity
          onPress={() => { setGapBannerDismissed(true); setShowRegroup(true); }}
          style={styles.gapBannerRegroup}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <MaterialCommunityIcons name="gas-station" size={13} color="#fff" />
          <Text style={styles.gapBannerRegroupText}>Regroup</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setGapBannerDismissed(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="close" size={16} color="#fff" />
        </TouchableOpacity>
      </RAnimated.View>

      {/* ── Voice token renewal warning banner ───────────── */}
      {voiceTokenWarning && (
        <View
          style={[
            styles.gapBanner,
            {
              top:
                floatTop +
                52 +
                (gapWarnings.size > 0 && !gapBannerDismissed ? 44 : 0),
              backgroundColor: "#b45309",
            },
          ]}
        >
          <MaterialCommunityIcons name="microphone-off" size={16} color="#fff" />
          <Text style={styles.gapBannerText} numberOfLines={2}>
            Voice connection at risk — tap to dismiss
          </Text>
          <TouchableOpacity
            onPress={dismissVoiceTokenWarning}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="close" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Voice reconnect status banner ────────────────── */}
      {voiceConnectStatus !== "ok" && (
        <View
          style={[
            styles.gapBanner,
            {
              top:
                floatTop +
                52 +
                (gapWarnings.size > 0 && !gapBannerDismissed ? 44 : 0) +
                (voiceTokenWarning ? 44 : 0),
              backgroundColor:
                voiceConnectStatus === "restored"
                  ? "#166534"
                  : voiceConnectStatus === "failed"
                  ? "#991b1b"
                  : "#92400e",
            },
          ]}
        >
          <MaterialCommunityIcons
            name={
              voiceConnectStatus === "restored"
                ? "wifi-check"
                : voiceConnectStatus === "failed"
                ? "wifi-off"
                : "wifi-sync"
            }
            size={16}
            color="#fff"
          />
          <Text style={styles.gapBannerText}>
            {voiceConnectStatus === "restored"
              ? "Voice restored"
              : voiceConnectStatus === "failed"
              ? "Voice reconnect failed — rejoin to restore"
              : "Reconnecting voice…"}
          </Text>
        </View>
      )}

      {/* ── Backgrounded PTT warning banner ──────────────── */}
      {bgPttWarning && (
        <View
          style={[
            styles.gapBanner,
            {
              top:
                floatTop +
                52 +
                (gapWarnings.size > 0 && !gapBannerDismissed ? 44 : 0) +
                (voiceTokenWarning ? 44 : 0) +
                (voiceConnectStatus !== "ok" ? 44 : 0),
              backgroundColor: "#92400e",
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/convoy")}
            style={styles.gapBannerBody}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="microphone-off" size={16} color="#fff" />
            <Text style={styles.gapBannerText}>
              Transmission missed — tap to talk
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={dismissBgPttWarning}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="close" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Convoy in sync banner ────────────────────────── */}
      {isInSyncZone && !syncBannerDismissed && (
        <View
          style={[
            styles.syncBanner,
            {
              top:
                floatTop +
                52 +
                (gapWarnings.size > 0 && !gapBannerDismissed ? 44 : 0) +
                (voiceTokenWarning ? 44 : 0) +
                (voiceConnectStatus !== "ok" ? 44 : 0) +
                (bgPttWarning ? 44 : 0),
            },
          ]}
        >
          <MaterialCommunityIcons name="car-multiple" size={14} color="#22c55e" />
          <Text style={styles.syncBannerText}>
            {Platform.OS === "web"
              ? "Convoy in sync"
              : "Convoy in sync · tap a car to speak"}
          </Text>
          <TouchableOpacity
            onPress={() => setSyncBannerDismissed(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="close" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── MergePill (follower joining convoy or navigating to regroup pin) ── */}
      {!isLeader && (
        (mergeState && !mergeState.onConvoyRoute) ||
        nav?.navSource === "regroup"
      ) && (
        <MergePill />
      )}

      {/* ── Leader vacant banner — tap to claim the lead ─── */}
      {isLeaderVacant && (
        <TouchableOpacity
          style={[styles.privatePill, { backgroundColor: "#7c3aed", bottom: bottomPad + 234 }]}
          onPress={() => {
            if (Platform.OS !== "web") Haptics.selectionAsync();
            claimLeadership();
          }}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="crown-outline" size={13} color="#fff" />
          <Text style={styles.privatePillText}>Leader left · Tap to take the lead</Text>
          <MaterialCommunityIcons name="chevron-right" size={13} color="#fff" />
        </TouchableOpacity>
      )}

      {/* ── Group broadcast priority banner ───────────────── */}
      {isGroupBroadcastActive && (isTalking || hasIncomingPrivate || isPrivateChannelWarm) && (
        <View
          style={[
            styles.privatePill,
            { backgroundColor: isLeaderBroadcastActive ? "#92400e" : "#b45309", bottom: bottomPad + 198 },
          ]}
        >
          <MaterialCommunityIcons
            name={isLeaderBroadcastActive ? "crown" : "volume-high"}
            size={13}
            color="#fff"
          />
          <Text style={styles.privatePillText}>
            {isLeaderBroadcastActive
              ? `${speakingVehicleNames[0] ?? "Leader"} · priority broadcast`
              : speakingVehicleNames.length > 0
              ? `${speakingVehicleNames[0]} · group broadcast`
              : "Group broadcast · private paused"}
          </Text>
        </View>
      )}

      {/* ── Private / incoming PTT status pill ───────────── */}
      {(isTalking && talkTarget) && (
        <View style={[styles.privatePill, { backgroundColor: colors.primary, bottom: bottomPad + 160 }]}>
          <MaterialCommunityIcons name="radio-handheld" size={13} color="#fff" />
          <Text style={styles.privatePillText}>Talking to {talkTarget.name}</Text>
        </View>
      )}
      {(hasIncomingPrivate || isPrivateChannelWarm) && !isTalking && (
        <View style={[styles.privatePill, { backgroundColor: colors.accent, bottom: bottomPad + 160 }]}>
          {/* Only attribute "is talking" to the private channel partner, not any
              group speaker that happens to be in speakingVehicleNames. */}
          {(() => {
            const partnerName = privateWarmPartnerName;
            const partnerSpeaking =
              !!partnerName && speakingVehicleNames.includes(partnerName);
            return (
              <>
                <MaterialCommunityIcons
                  name={partnerSpeaking ? "radio-handheld" : "phone-in-talk-outline"}
                  size={13}
                  color="#fff"
                />
                <Text style={[styles.privatePillText, { flex: 1 }]}>
                  {partnerSpeaking
                    ? `${partnerName} is talking to you`
                    : partnerName
                    ? `${partnerName} · channel open`
                    : "Private channel open"}
                </Text>
              </>
            );
          })()}
          {/* Only show Reply when incomingPrivateSenderId is set (i.e. we are the
              current receiver and know who sent the message). The sender-warm
              state has no incomingPrivateSenderId; the sender re-initiates via
              the PTT button or vehicle card. After a role-swap (receiver replies
              and becomes the new sender) incomingPrivateSenderId is cleared by
              startTalking, so the button also hides correctly. */}
          {!!incomingPrivateSenderId && (
            <TouchableOpacity
              style={styles.privatePillReply}
              onPress={() => {
                replyToPrivate();
              }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <MaterialCommunityIcons name="microphone" size={13} color={colors.accent} />
              <Text style={styles.privatePillReplyText}>Reply</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Floating group PTT button ─────────────────────── */}
      {session && (
        <View style={[styles.pttFloat, { bottom: bottomPad + 72 }]}>
          <TalkButton />
        </View>
      )}

      {/* ── Bottom sheet ─────────────────────────────────── */}
      <Animated.View
        style={[
          styles.bottomSheet,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: bottomPad,
            opacity: bannersAnim,
          },
        ]}
        pointerEvents={isNavigating && bannersHidden ? "none" : "auto"}
      >
        <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

        {isNavigating ? (
          /* Navigating: show distance / ETA stats */
          <View style={styles.statsSection}>
            <View style={styles.statsRow}>
              <View style={styles.statCell}>
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  {fmtDistMi(remDistM)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>mi</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statCell}>
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  {fmtDuration(remDurS)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>min</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statCell}>
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  {fmtArrival(remDurS)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>ETA</Text>
              </View>
            </View>

            <View style={styles.shareEtaRow}>
              <MaterialCommunityIcons name="account-group" size={14} color={colors.mutedForeground} />
              <Text style={[styles.shareEtaText, { color: colors.mutedForeground }]}>
                Shared with convoy
              </Text>
            </View>
          </View>
        ) : (
          /* Idle: convoy info + formation toggle + navigate button */
          <View style={styles.idleSection}>
            {/* Destination row */}
            {session.destination && (
              <View style={styles.infoRow}>
                <View style={[styles.infoIconBox, { backgroundColor: colors.accent + "18" }]}>
                  <MaterialCommunityIcons name="map-marker" size={18} color={colors.accent} />
                </View>
                <View style={styles.infoText}>
                  <Text style={[styles.infoTitle, { color: colors.foreground }]} numberOfLines={1}>
                    {session.destination.name}
                  </Text>
                  <Text style={[styles.infoSub, { color: colors.mutedForeground }]}>Destination set</Text>
                </View>
              </View>
            )}

            {/* Vehicles row */}
            <View style={styles.infoRow}>
              <View style={[styles.infoIconBox, { backgroundColor: colors.primary + "18" }]}>
                <MaterialCommunityIcons name="car-multiple" size={18} color={colors.primary} />
              </View>
              <View style={styles.infoText}>
                <Text style={[styles.infoTitle, { color: colors.foreground }]}>
                  {session.vehicles.length} vehicle{session.vehicles.length !== 1 ? "s" : ""}
                </Text>
                <Text style={[styles.infoSub, { color: colors.mutedForeground }]}>In convoy</Text>
              </View>
              <TouchableOpacity
                style={[styles.formToggle, { backgroundColor: colors.secondary }]}
                onPress={() => setShowFormation((p) => !p)}
              >
                <MaterialCommunityIcons
                  name={showFormation ? "chevron-down" : "chevron-up"}
                  size={18}
                  color={colors.foreground}
                />
              </TouchableOpacity>
            </View>

            {showFormation && (
              <ConvoyFormation
                vehicles={session.vehicles}
                gapWarnings={gapWarnings}
                talkingToVehicleId={talkTarget?.id}
                onVehicleTap={handleVehicleTap}
                isLeader={isLeader}
                onLeaderHandoff={isLeader ? transferLeadership : undefined}
                isJoining={!!(mergeState && !mergeState.onConvoyRoute)}
                distanceToMergeM={mergeState && !mergeState.onConvoyRoute ? mergeState.distanceToMergeM : undefined}
                myVehicleId={myVehicle?.id}
                vehicleRegroupEtas={vehicleRegroupEtas}
              />
            )}

            {/* Green Navigate button (leader only) */}
            {isLeader && (
              <TouchableOpacity
                style={[styles.navigateBtn, { backgroundColor: colors.success }]}
                onPress={() => {
                  if (Platform.OS !== "web") Haptics.selectionAsync();
                  setShowDestPicker(true);
                }}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="navigation" size={18} color="#fff" />
                <Text style={styles.navigateBtnText}>Navigate</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </Animated.View>

      {/* ── Route overview mini-map (bottom-left, navigation only) */}
      {/* lastNavRef keeps content mounted through the slide-out so the animation plays */}
      <Animated.View
        pointerEvents={isNavigating ? "box-none" : "none"}
        style={[
          styles.miniMapAnchor,
          { bottom: bottomPad + 8 },
          {
            opacity: miniMapAnim,
            transform: [
              {
                translateX: miniMapAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-180, 0],
                }),
              },
            ],
          },
        ]}
      >
        {lastNavRef.current && (
          <MiniMapView
            vehicles={session?.vehicles ?? []}
            navigation={lastNavRef.current}
            gapWarnings={gapWarnings}
            mergeState={mergeState}
          />
        )}
      </Animated.View>

      <ShareConvoyModal visible={showShare} onClose={() => setShowShare(false)} />
      <DestinationPicker visible={showDestPicker} onClose={() => setShowDestPicker(false)} />
      <RegroupModal visible={showRegroup} onClose={() => setShowRegroup(false)} />
      {pendingStopRequest && (
        <StopRequestModal
          request={pendingStopRequest}
          onAccept={async () => {
            const req = pendingStopRequest;
            respondToStopRequest(req.requestId, true);
            const loc = myVehicle?.location;
            if (!loc) return;
            const result = await fetchRoute(
              loc.latitude,
              loc.longitude,
              req.station.latitude,
              req.station.longitude
            );
            if (!result) return;
            startNavigation({
              destination: {
                latitude: req.station.latitude,
                longitude: req.station.longitude,
                name: req.station.name,
              },
              route: result.route,
              steps: result.steps,
              currentStepIndex: 0,
              totalDistanceM: result.totalDistanceM,
              totalDurationS: result.totalDurationS,
              totalDurationInTrafficS: result.totalDurationInTrafficS,
            });
            if (result.steps.length > 0) {
              announceNavStep(result.steps[0].instruction, result.steps[0].distanceM);
            }
          }}
          onDecline={() => {
            respondToStopRequest(pendingStopRequest.requestId, false);
          }}
        />
      )}
      <HazardPicker
        visible={showHazardPicker}
        onClose={() => setShowHazardPicker(false)}
        onReport={async (type: HazardType) => {
          const loc = myVehicle?.location;
          if (loc) {
            await reportHazard(type, loc.latitude, loc.longitude);
          }
        }}
      />

      {/* ── Stop Proposal Banner ─────────────────────────── */}
      {pendingStopProposal && (
        <View
          style={[
            styles.proposalBannerWrapper,
            { bottom: insets.bottom + TAB_BAR_HEIGHT + navPanelHeight + 8 },
          ]}
        >
          <StopProposalBanner
            proposal={pendingStopProposal}
            onAccept={async () => {
              const p = pendingStopProposal;
              await respondToStopProposal(p.proposalId, true);
            }}
            onDecline={() => {
              respondToStopProposal(pendingStopProposal.proposalId, false);
            }}
            onReroute={async () => {
              // Local-only personal reroute — no vote broadcast.
              // Dismiss the banner without sending a proposal response.
              const p = pendingStopProposal;
              dismissStopProposal();
              const loc = myVehicle?.location;
              if (!loc) return;
              const nav = session?.navigation;
              if (nav) {
                // Already navigating: insert the stop as a waypoint so the
                // original destination is preserved after the stop.
                const result = await fetchRouteViaStop(
                  loc.latitude, loc.longitude,
                  p.location.latitude, p.location.longitude,
                  nav.destination.latitude, nav.destination.longitude
                );
                if (!result) return;
                startNavigation({
                  destination: nav.destination,
                  route: result.route,
                  steps: result.steps,
                  currentStepIndex: 0,
                  totalDistanceM: result.totalDistanceM,
                  totalDurationS: result.totalDurationS,
                  totalDurationInTrafficS: result.totalDurationInTrafficS,
                });
                if (result.steps.length > 0) {
                  announceNavStep(result.steps[0].instruction, result.steps[0].distanceM);
                }
              } else {
                // Not yet navigating: route directly to the stop.
                const result = await fetchRoute(
                  loc.latitude, loc.longitude,
                  p.location.latitude, p.location.longitude
                );
                if (!result) return;
                startNavigation({
                  destination: { name: p.name, latitude: p.location.latitude, longitude: p.location.longitude },
                  route: result.route,
                  steps: result.steps,
                  currentStepIndex: 0,
                  totalDistanceM: result.totalDistanceM,
                  totalDurationS: result.totalDurationS,
                  totalDurationInTrafficS: result.totalDurationInTrafficS,
                });
                if (result.steps.length > 0) {
                  announceNavStep(result.steps[0].instruction, result.steps[0].distanceM);
                }
              }
            }}
          />
        </View>
      )}

      {/* ── Suggest Stop Modal ───────────────────────────── */}
      <SuggestStopModal
        visible={showSuggestStop}
        onClose={() => setShowSuggestStop(false)}
        onSelect={(name, location) => {
          sendStopProposal(name, location);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  /* map */
  mapArea: { ...StyleSheet.absoluteFillObject },

  /* sync zone edge glow */
  syncGlow: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 4,
    borderColor: "#22c55e",
    borderRadius: 0,
    zIndex: 5,
  },

  proposalBannerWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
  },

  /* sync banner */
  syncBanner: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "#14532d",
    borderWidth: 1,
    borderColor: "#22c55e44",
    zIndex: 100,
    ...Platform.select({
      ios: { shadowColor: "#22c55e", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  syncBannerText: {
    flex: 1,
    color: "#86efac",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },

  /* floating PTT button */
  pttFloat: {
    position: "absolute",
    right: 16,
    zIndex: 100,
  },

  /* route overview mini-map anchor */
  miniMapAnchor: {
    position: "absolute",
    left: 12,
    zIndex: 60,
  },

  /* private PTT status pill */
  privatePill: {
    position: "absolute",
    left: 16,
    right: 90,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    zIndex: 100,
  },
  privatePillText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  privatePillReply: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  privatePillReplyText: {
    color: "#000",
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },

  /* nav panel */
  navPanelWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 100,
  },

  /* convoy pill */
  convoyPill: {
    position: "absolute",
    left: 12,
    right: 62,          // keep right gap for sidebar
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 100,
  },
  pillCode: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },
  pillDivider: { width: 1, height: 12 },
  pillName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  carPlayBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  carPlayText: { fontSize: 10, fontWeight: "700", fontFamily: "Inter_700Bold" },
  carCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  carCountText: { fontSize: 12, fontWeight: "700", fontFamily: "Inter_700Bold" },

  formationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  formationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  formationText: {
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },

  /* gap warning banner */
  gapBanner: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ef4444",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    zIndex: 100,
    ...Platform.select({
      ios: { shadowColor: "#ef4444", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 8 },
      android: { elevation: 5 },
    }),
  },
  gapBannerBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  gapBannerText: {
    flex: 1,
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  gapBannerRegroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  gapBannerRegroupText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },

  /* right sidebar */
  rightSidebar: {
    position: "absolute",
    right: 12,
    zIndex: 100,
  },
  sideCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  sidePill: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  sideDivider: {
    height: StyleSheet.hairlineWidth,
  },
  sideBtnLabel: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },

  /* bottom sheet */
  bottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    gap: 0,
    zIndex: 100,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },

  /* navigating stats */
  statsSection: { paddingHorizontal: 20, paddingBottom: 4, gap: 10 },
  statsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  statCell: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { fontSize: 30, fontWeight: "700", fontFamily: "Inter_700Bold", letterSpacing: -1 },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statDivider: { width: 1, height: 36 },
  shareEtaRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 4 },
  shareEtaText: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },

  /* idle section */
  idleSection: { paddingHorizontal: 16, paddingBottom: 4, gap: 12 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  infoIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  infoText: { flex: 1 },
  infoTitle: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  infoSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  formToggle: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },

  /* green navigate button */
  navigateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 4,
    ...Platform.select({
      ios: { shadowColor: "#22c55e", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  navigateBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
});

const idleStyles = StyleSheet.create({
  card: {
    position: "absolute",
    left: 16,
    right: 16,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: "center",
    gap: 10,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  iconRow: {
    marginBottom: 4,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  sub: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 4,
  },
  btnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
});
