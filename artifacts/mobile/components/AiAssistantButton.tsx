import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Alert, StyleSheet, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useSubscription } from "@/context/SubscriptionContext";

interface Props {
  onHazardDetected: (hazardType: string) => void;
  /** When true the button renders flush (no own border/bg) to sit inside a card container. */
  inCard?: boolean;
  style?: object;
}

export default function AiAssistantButton({ inCard, style }: Props) {
  const colors = useColors();
  const { tier } = useSubscription();

  const handlePress = () => {
    if (tier === "free") {
      Alert.alert(
        "Convenience Tier Required",
        "The AI voice assistant is available on Convenience ($2.99/mo) and Roadtrip plans.",
        [{ text: "OK" }]
      );
      return;
    }
    Alert.alert(
      "Voice Commands",
      "Voice commands are available on the iOS and Android apps."
    );
  };

  if (inCard) {
    return (
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        style={[styles.pill, style]}
      >
        <MaterialCommunityIcons name="microphone" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        style={[styles.btn, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <MaterialCommunityIcons name="microphone" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center" },
  btn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
