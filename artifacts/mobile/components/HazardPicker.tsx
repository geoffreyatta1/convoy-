import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { HazardType } from "@/services/hazards";

type MCIconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

interface HazardOption {
  type: HazardType;
  label: string;
  icon: MCIconName;
  color: string;
}

const HAZARD_OPTIONS: HazardOption[] = [
  { type: "police",       label: "Police",       icon: "police-badge",       color: "#3b82f6" },
  { type: "accident",     label: "Accident",     icon: "car-off",             color: "#ef4444" },
  { type: "construction", label: "Construction", icon: "road-variant",        color: "#f59e0b" },
  { type: "debris",       label: "Debris",       icon: "alert-rhombus",       color: "#8b5cf6" },
  { type: "other",        label: "Other",        icon: "alert-circle",        color: "#6b7280" },
];

interface HazardPickerProps {
  visible: boolean;
  onClose: () => void;
  onReport: (type: HazardType) => Promise<void>;
}

export default function HazardPicker({ visible, onClose, onReport }: HazardPickerProps) {
  const colors = useColors();
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<HazardType | null>(null);

  const handleSelect = async (type: HazardType) => {
    if (loading) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelected(type);
    setLoading(true);
    try {
      await onReport(type);
    } finally {
      setLoading(false);
      setSelected(null);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <View style={[styles.sheet, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        <View style={styles.header}>
          <MaterialCommunityIcons name="shield-alert" size={20} color={colors.foreground} />
          <Text style={[styles.title, { color: colors.foreground }]}>Report a Hazard</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Visible to all drivers nearby
          </Text>
        </View>

        <View style={styles.grid}>
          {HAZARD_OPTIONS.map((opt) => {
            const isSelecting = loading && selected === opt.type;
            return (
              <TouchableOpacity
                key={opt.type}
                onPress={() => handleSelect(opt.type)}
                disabled={loading}
                style={[
                  styles.option,
                  {
                    backgroundColor: opt.color + "18",
                    borderColor: opt.color + "55",
                    opacity: loading && selected !== opt.type ? 0.5 : 1,
                  },
                ]}
                activeOpacity={0.7}
              >
                {isSelecting ? (
                  <ActivityIndicator size="large" color={opt.color} />
                ) : (
                  <MaterialCommunityIcons
                    name={opt.icon}
                    size={36}
                    color={opt.color}
                  />
                )}
                <Text style={[styles.optionLabel, { color: opt.color }]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity onPress={onClose} style={[styles.cancelBtn, { borderColor: colors.border }]}>
          <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 32,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  header: {
    alignItems: "center",
    gap: 4,
    marginBottom: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    marginTop: 4,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
    marginBottom: 16,
  },
  option: {
    width: "44%",
    aspectRatio: 1.6,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  cancelBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
