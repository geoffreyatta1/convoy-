import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useAuth } from "@/context/AuthContext";
import { useConvoy } from "@/context/ConvoyContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { useColors } from "@/hooks/useColors";
import { haversineMeters, findNearbyStops } from "@/services/routing";
import {
  sendAiCommand,
  type AiCommandResponse,
  type ConvoyStateInput,
} from "@/services/ai-assistant";

interface Props {
  onHazardDetected: (hazardType: string) => void;
  style?: object;
}

type ButtonState = "idle" | "recording" | "processing";

export default function AiAssistantButton({ onHazardDetected, style }: Props) {
  const colors = useColors();
  const { getAccessToken } = useAuth();
  const { session, myVehicle, gapWarnings, sendConvoyStopRequest, broadcastRegroupPin } = useConvoy();
  const { tier } = useSubscription();

  const [buttonState, setButtonState] = useState<ButtonState>("idle");
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const startPulse = useCallback(() => {
    pulseLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    pulseLoopRef.current.start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    pulseLoopRef.current?.stop();
    Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  }, [pulseAnim]);

  const buildConvoyState = useCallback((): ConvoyStateInput => {
    if (!session) return { vehicles: [], gapWarnings: [] };

    const leader = session.vehicles.find((v) => v.isLeader);
    const vehicles = session.vehicles.map((v) => {
      let distanceToLeaderM: number | undefined;
      if (!v.isLeader && leader?.location && v.location) {
        distanceToLeaderM = haversineMeters(
          v.location.latitude,
          v.location.longitude,
          leader.location.latitude,
          leader.location.longitude
        );
      }
      return { id: v.id, name: v.name, distanceToLeaderM };
    });

    const nav = session.navigation;
    return {
      vehicles,
      gapWarnings: Array.from(gapWarnings),
      navigation: nav
        ? {
            remainingDistanceM: nav.steps
              .slice(nav.currentStepIndex)
              .reduce((s, st) => s + st.distanceM, 0),
            remainingDurationS: nav.steps
              .slice(nav.currentStepIndex)
              .reduce((s, st) => s + st.durationS, 0),
            destinationName: nav.destination.name,
          }
        : null,
    };
  }, [session, gapWarnings]);

  /** Compute convoy centroid from all vehicles with known locations */
  const getConvoyCentroid = useCallback((): { lat: number; lng: number } | null => {
    if (!session) return null;
    const located = session.vehicles.filter((v) => v.location);
    if (!located.length) return null;
    const lat = located.reduce((s, v) => s + v.location!.latitude, 0) / located.length;
    const lng = located.reduce((s, v) => s + v.location!.longitude, 0) / located.length;
    return { lat, lng };
  }, [session]);

  const executeAction = useCallback(
    async (response: AiCommandResponse) => {
      const { action, confirmationMessage } = response;

      if (action.type === "report_hazard") {
        onHazardDetected(action.hazardType);
      }

      if (action.type === "stop_request") {
        const stopType = action.stopType;
        const centroid = getConvoyCentroid();
        const searchOrigin = centroid ?? (myVehicle?.location
          ? { lat: myVehicle.location.latitude, lng: myVehicle.location.longitude }
          : null);

        const stopLabel =
          stopType === "fuel" ? "fuel"
          : stopType === "food" ? "food"
          : stopType === "bathroom" ? "a bathroom break"
          : stopType === "rest" ? "a rest stop"
          : "a stop";

        if (!searchOrigin) {
          Speech.speak(`Looking for ${stopLabel}, but your location is unknown.`, {
            language: "en-US",
            rate: 1.1,
          });
          return;
        }

        Speech.speak(`Finding the best spot for ${stopLabel}…`, {
          language: "en-US",
          rate: 1.1,
        });

        try {
          const stops = await findNearbyStops(
            stopType,
            searchOrigin.lat,
            searchOrigin.lng
          );

          if (!stops.length) {
            Speech.speak(`No nearby stops found for ${stopLabel}.`, {
              language: "en-US",
              rate: 1.1,
            });
            return;
          }

          const best = stops[0];
          sendConvoyStopRequest(stopType, {
            id: best.id,
            name: best.name,
            brand: best.brand,
            latitude: best.latitude,
            longitude: best.longitude,
            distanceM: best.distanceM,
          });

          // Drop a shared regroup pin so everyone sees the proposed stop on the map
          if (myVehicle) {
            broadcastRegroupPin({
              fromVehicleName: myVehicle.name,
              lat: best.latitude,
              lng: best.longitude,
              name: best.name,
            });
          }

          const distKm = (best.distanceM / 1000).toFixed(1);
          Speech.speak(
            `Requesting a ${stopLabel} at ${best.name}, ${distKm} kilometres away. All drivers have been notified.`,
            { language: "en-US", rate: 1.05 }
          );
          return;
        } catch {
          Speech.speak(`Couldn't find a stop. Try again.`, { language: "en-US" });
          return;
        }
      }

      if (confirmationMessage) {
        Speech.speak(confirmationMessage, {
          language: "en-US",
          rate: 1.1,
          pitch: 1.0,
        });
      }
    },
    [onHazardDetected, getConvoyCentroid, myVehicle, sendConvoyStopRequest, broadcastRegroupPin]
  );

  const startRecording = useCallback(async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setButtonState("recording");
      setLastTranscript(null);
      startPulse();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      setButtonState("idle");
    }
  }, [startPulse]);

  const stopRecordingAndProcess = useCallback(async () => {
    if (!recordingRef.current) return;
    stopPulse();
    setButtonState("processing");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error("No recording URI");

      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64",
      });

      const convoyState = buildConvoyState();
      const accessToken = await getAccessToken();

      const response = await sendAiCommand(
        audioBase64,
        "audio/m4a",
        convoyState,
        accessToken
      );

      setLastTranscript(response.transcript || null);
      await executeAction(response);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Speech.speak("Sorry, something went wrong", { language: "en-US" });
    } finally {
      setButtonState("idle");
      // Clear transcript after 4 s
      setTimeout(() => setLastTranscript(null), 4000);
    }
  }, [stopPulse, buildConvoyState, getAccessToken, executeAction]);

  const handlePressIn = useCallback(() => {
    if (tier === "free") {
      Alert.alert(
        "Convenience Tier Required",
        "The AI voice assistant is available on Convenience ($2.99/mo) and Roadtrip plans.",
        [{ text: "OK" }]
      );
      return;
    }
    if (buttonState === "idle") startRecording();
  }, [tier, buttonState, startRecording]);

  const handlePressOut = useCallback(() => {
    if (buttonState === "recording") stopRecordingAndProcess();
  }, [buttonState, stopRecordingAndProcess]);

  const isRecording = buttonState === "recording";
  const isProcessing = buttonState === "processing";

  const btnBg = isRecording
    ? colors.destructive
    : isProcessing
    ? colors.mutedForeground
    : colors.card;

  const btnBorder = isRecording ? colors.destructive : colors.border;

  return (
    <View style={[styles.wrapper, style]}>
      {lastTranscript && (
        <View style={[styles.transcript, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.transcriptText, { color: colors.mutedForeground }]} numberOfLines={2}>
            "{lastTranscript}"
          </Text>
        </View>
      )}
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <TouchableOpacity
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={isProcessing}
          activeOpacity={0.8}
          style={[styles.btn, { backgroundColor: btnBg, borderColor: btnBorder }]}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color={colors.foreground} />
          ) : (
            <MaterialCommunityIcons
              name={isRecording ? "microphone" : "microphone-outline"}
              size={18}
              color={isRecording ? "#fff" : colors.foreground}
            />
          )}
        </TouchableOpacity>
      </Animated.View>
      {isRecording && (
        <Text style={[styles.hint, { color: colors.destructive }]}>Hold & speak</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    gap: 4,
  },
  btn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  transcript: {
    position: "absolute",
    right: 50,
    top: 0,
    maxWidth: 200,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  transcriptText: {
    fontSize: 11,
    fontStyle: "italic",
  },
  hint: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
