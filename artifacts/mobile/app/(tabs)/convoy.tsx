/**
 * Talk screen — Walkie-talkie style PTT for the convoy.
 *
 * • Press and HOLD the big button to transmit to all vehicles.
 * • An audible click-beep plays on press and release (just like a real radio).
 * • Incoming transmissions from other cars trigger an audible alert + animation.
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useConvoy } from "@/context/ConvoyContext";
import { playSound } from "@/services/sounds";
import { isAgoraAvailable } from "@/services/agora";

/** Tracks whether the PTT background notice has been shown this app session. */
let pttNoticeShownThisSession = false;

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m} ${ampm}`;
}

function TransmissionRow({
  vehicleName,
  content,
  timestamp,
  isMe,
  vehicleColor,
}: {
  vehicleName: string;
  content: string;
  timestamp: number;
  isMe: boolean;
  vehicleColor: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.txRow, isMe && styles.txRowMe]}>
      <View style={[styles.txDot, { backgroundColor: vehicleColor }]} />
      <View style={styles.txBody}>
        <View style={styles.txMeta}>
          <Text style={[styles.txName, { color: colors.foreground }]}>
            {isMe ? "You" : vehicleName}
          </Text>
          <Text style={[styles.txTime, { color: colors.mutedForeground }]}>
            {formatTime(timestamp)}
          </Text>
        </View>
        <View style={[styles.txBubble, { backgroundColor: isMe ? colors.primary + "22" : colors.card }]}>
          <MaterialCommunityIcons name="microphone" size={12} color={colors.mutedForeground} style={styles.micIcon} />
          <Text style={[styles.txContent, { color: colors.foreground }]}>
            {content}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function ConvoyTalkScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { session, myVehicle, isTalking, startTalking, stopTalking, remoteSpeakerUids, speakingVehicleNames, bgPttWarning, dismissBgPttWarning } = useConvoy();

  const [receiving, setReceiving] = useState(false);
  const prevRemoteSpeakersRef = useRef(0);
  const [showPttNotice, setShowPttNotice] = useState(false);
  const hasSession = !!session;

  useEffect(() => {
    if (hasSession && !pttNoticeShownThisSession) {
      pttNoticeShownThisSession = true;
      setShowPttNotice(true);
      const t = setTimeout(() => setShowPttNotice(false), 4000);
      return () => clearTimeout(t);
    }
  }, [hasSession]);

  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const pulseRing = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;
  const receiveRing = useRef(new Animated.Value(1)).current;
  const receiveOpacity = useRef(new Animated.Value(0)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const prevAudioCountRef = useRef(0);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const triggerIncoming = useCallback(() => {
    playSound("incoming");
    setReceiving(true);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(receiveRing, { toValue: 2.5, duration: 350, useNativeDriver: true }),
        Animated.timing(receiveOpacity, { toValue: 0.7, duration: 100, useNativeDriver: true }),
      ]),
      Animated.timing(receiveOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start(() => { receiveRing.setValue(1); setReceiving(false); });
  }, [receiveRing, receiveOpacity]);

  const startPulse = useCallback(() => {
    pulseRing.setValue(1);
    pulseOpacity.setValue(0.6);
    pulseLoopRef.current = Animated.loop(
      Animated.parallel([
        Animated.timing(pulseRing, { toValue: 2.2, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseOpacity, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    pulseLoopRef.current.start();
  }, [pulseRing, pulseOpacity]);

  const stopPulse = useCallback(() => {
    pulseLoopRef.current?.stop();
    pulseRing.setValue(1);
    pulseOpacity.setValue(0);
  }, [pulseRing, pulseOpacity]);

  useEffect(() => {
    if (!session) return;
    const audioFromOthers = session.messages.filter(
      (m) => m.type === "audio" && m.vehicleId !== myVehicle?.id
    );
    if (audioFromOthers.length > prevAudioCountRef.current) {
      prevAudioCountRef.current = audioFromOthers.length;
      if (!isAgoraAvailable()) {
        triggerIncoming();
      }
    }
  }, [session, myVehicle?.id, triggerIncoming]);

  useEffect(() => {
    if (!isAgoraAvailable()) return;
    const count = remoteSpeakerUids.size;
    if (count > prevRemoteSpeakersRef.current) {
      triggerIncoming();
    }
    prevRemoteSpeakersRef.current = count;
  }, [remoteSpeakerUids, triggerIncoming]);

  const handleToggle = useCallback(async () => {
    if (isTalking) {
      playSound("ptt_end");
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      stopTalking();
      stopPulse();
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      const started = await startTalking();
      if (!started) return;
      playSound("ptt_start");
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      startPulse();
      Animated.parallel([
        Animated.spring(scale, { toValue: 0.94, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [isTalking, startTalking, stopTalking, glow, scale, startPulse, stopPulse]);

  if (!session) {
    return (
      <View style={[styles.noSession, { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="radio-handheld" size={56} color={colors.mutedForeground} />
        <Text style={[styles.noSessionTitle, { color: colors.foreground }]}>
          No Active Convoy
        </Text>
        <Text style={[styles.noSessionText, { color: colors.mutedForeground }]}>
          Start or join a convoy to use Talk
        </Text>
      </View>
    );
  }

  const audioMessages = session.messages.filter((m) => m.type === "audio").slice(-20);
  const btnColor = isTalking ? colors.accent : colors.primary;

  const glowStyle = {
    shadowColor: btnColor,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: glow,
    shadowRadius: glow.interpolate({ inputRange: [0, 1], outputRange: [8, 40] }) as unknown as number,
    elevation: glow.interpolate({ inputRange: [0, 1], outputRange: [4, 24] }) as unknown as number,
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <MaterialCommunityIcons name="radio-handheld" size={20} color={colors.primary} />
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Convoy Talk
          </Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {session.vehicles.length} cars · {session.name}
          </Text>
        </View>
        {(receiving || remoteSpeakerUids.size > 0) && (
          <View style={[styles.badge, { backgroundColor: colors.accent + "20" }]}>
            <MaterialCommunityIcons name="signal" size={13} color={colors.accent} />
            <Text style={[styles.badgeText, { color: colors.accent }]}>
              {speakingVehicleNames.length > 0
                ? speakingVehicleNames.join(", ")
                : "Receiving"}
            </Text>
          </View>
        )}
        {isTalking && (
          <View style={[styles.badge, { backgroundColor: colors.primary + "20" }]}>
            <MaterialCommunityIcons name="microphone" size={13} color={colors.primary} />
            <Text style={[styles.badgeText, { color: colors.primary }]}>Transmitting</Text>
          </View>
        )}
      </View>

      {showPttNotice && (
        <View style={[styles.pttNotice, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <MaterialCommunityIcons name="information-outline" size={16} color={colors.primary} style={styles.pttNoticeIcon} />
          <Text style={[styles.pttNoticeText, { color: colors.foreground }]}>
            You can{" "}
            <Text style={{ fontFamily: "Inter_600SemiBold" }}>receive</Text>
            {" "}audio in the background, but{" "}
            <Text style={{ fontFamily: "Inter_600SemiBold" }}>transmitting</Text>
            {" "}requires the app to be open.
          </Text>
          <TouchableOpacity onPress={() => setShowPttNotice(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="close" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}

      {bgPttWarning && (
        <View style={[styles.pttNotice, { backgroundColor: "#92400e", borderBottomColor: "#78350f" }]}>
          <MaterialCommunityIcons name="microphone-off" size={16} color="#fff" style={styles.pttNoticeIcon} />
          <Text style={[styles.pttNoticeText, { color: "#fff" }]}>
            Transmission missed — the app must be open to talk.
          </Text>
          <TouchableOpacity onPress={dismissBgPttWarning} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="close" size={16} color="#fde68a" />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.log}
        contentContainerStyle={[styles.logContent, { paddingBottom: 16 }]}
        showsVerticalScrollIndicator={false}
        ref={(ref) => { if (ref) setTimeout(() => ref.scrollToEnd({ animated: false }), 50); }}
      >
        {audioMessages.length === 0 ? (
          <View style={styles.emptyLog}>
            <MaterialCommunityIcons name="microphone-off" size={40} color={colors.mutedForeground + "50"} />
            <Text style={[styles.emptyLogText, { color: colors.mutedForeground }]}>No transmissions yet</Text>
            <Text style={[styles.emptyLogSub, { color: colors.mutedForeground + "80" }]}>
              Tap the button below to talk to your convoy
            </Text>
          </View>
        ) : (
          audioMessages.map((msg) => {
            const vehicle = session.vehicles.find((v) => v.id === msg.vehicleId);
            return (
              <TransmissionRow
                key={msg.id}
                vehicleName={msg.vehicleName}
                content={msg.content}
                timestamp={msg.timestamp}
                isMe={msg.vehicleId === myVehicle?.id}
                vehicleColor={vehicle?.color ?? colors.primary}
              />
            );
          })
        )}
      </ScrollView>

      <View
        style={[
          styles.pttArea,
          { paddingBottom: bottomPad + 24, borderTopColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <Text style={[styles.pttHint, { color: colors.mutedForeground }]}>
          {isTalking
            ? isAgoraAvailable() ? "TRANSMITTING LIVE AUDIO…" : "TRANSMITTING TO ALL CARS…"
            : remoteSpeakerUids.size > 0
            ? "RECEIVING AUDIO…"
            : "TAP TO TALK"}
        </Text>

        <View style={styles.pttContainer}>
          <Animated.View
            style={[styles.ring, { borderColor: colors.accent, transform: [{ scale: receiveRing }], opacity: receiveOpacity }]}
          />
          <Animated.View
            style={[styles.ring, { borderColor: colors.primary, transform: [{ scale: pulseRing }], opacity: pulseOpacity }]}
          />
          <TouchableOpacity onPress={handleToggle} activeOpacity={0.85}>
            <Animated.View
              style={[styles.pttBtn, { backgroundColor: btnColor, transform: [{ scale }] }, glowStyle]}
            >
              <MaterialCommunityIcons
                name={isTalking ? "microphone" : "microphone-outline"}
                size={52}
                color="#fff"
              />
            </Animated.View>
          </TouchableOpacity>
        </View>

        <View style={styles.vehicleRow}>
          {session.vehicles.map((v) => (
            <View key={v.id} style={styles.vehicleChip}>
              <View style={[styles.vehicleDot, { backgroundColor: v.color }]} />
              <Text style={[styles.vehicleChipText, { color: colors.mutedForeground }]} numberOfLines={1}>
                {v.name}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const BTN_SIZE = 152;
const RING_SIZE = BTN_SIZE + 24;

const styles = StyleSheet.create({
  root: { flex: 1 },
  noSession: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  noSessionTitle: { fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold" },
  noSessionText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 32 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 10 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: "700", fontFamily: "Inter_700Bold" },
  log: { flex: 1 },
  logContent: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },
  emptyLog: { alignItems: "center", justifyContent: "center", paddingTop: 48, gap: 10 },
  emptyLogText: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  emptyLogSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  txRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  txRowMe: { flexDirection: "row-reverse" },
  txDot: { width: 8, height: 8, borderRadius: 4, marginTop: 18 },
  txBody: { flex: 1, gap: 4 },
  txMeta: { flexDirection: "row", gap: 6, alignItems: "baseline" },
  txName: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  txTime: { fontSize: 10, fontFamily: "Inter_400Regular" },
  txBubble: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, alignSelf: "flex-start", maxWidth: "90%" },
  micIcon: { flexShrink: 0 },
  txContent: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  pttArea: { alignItems: "center", paddingTop: 20, gap: 16, borderTopWidth: 1 },
  pttHint: { fontSize: 11, fontWeight: "700", letterSpacing: 1.5, fontFamily: "Inter_700Bold" },
  pttContainer: { width: RING_SIZE + 60, height: RING_SIZE + 60, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2, borderWidth: 3 },
  pttBtn: { width: BTN_SIZE, height: BTN_SIZE, borderRadius: BTN_SIZE / 2, alignItems: "center", justifyContent: "center" },
  vehicleRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  vehicleChip: { flexDirection: "row", alignItems: "center", gap: 5 },
  vehicleDot: { width: 7, height: 7, borderRadius: 3.5 },
  vehicleChipText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  pttNotice: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  pttNoticeIcon: { flexShrink: 0 },
  pttNoticeText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
});
