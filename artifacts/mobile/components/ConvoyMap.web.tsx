import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { Vehicle } from "@/context/ConvoyContext";
import { Hazard } from "@/services/hazards";

interface ConvoyMapProps {
  vehicles: Vehicle[];
  myVehicle: Vehicle | null;
  destination?: { name: string; latitude: number; longitude: number };
  route?: Array<{ latitude: number; longitude: number }>;
  mergeRoute?: Array<{ latitude: number; longitude: number }>;
  mergePoint?: { latitude: number; longitude: number };
  isNavigating?: boolean;
  gapWarnings?: Set<string>;
  hazards?: Hazard[];
  onMapPress?: () => void;
}

export default function ConvoyMap({ vehicles }: ConvoyMapProps) {
  const colors = useColors();

  return (
    <View style={[styles.webMap, { backgroundColor: colors.card }]}>
      <MaterialCommunityIcons name="map-search" size={56} color={colors.primary} />
      <Text style={[styles.webMapTitle, { color: colors.foreground }]}>
        Live Convoy Map
      </Text>
      <Text style={[styles.webMapText, { color: colors.mutedForeground }]}>
        Scan the QR code to view live maps on your phone
      </Text>
      <View style={styles.webVehicleList}>
        {vehicles.map((v) => (
          <View
            key={v.id}
            style={[styles.webVehicleRow, { backgroundColor: colors.background, borderColor: colors.border }]}
          >
            <View style={[styles.webVehicleDot, { backgroundColor: v.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.webVehicleName, { color: colors.foreground }]}>
                {v.name}
                {v.isLeader ? " (Leader)" : ""}
                {v.isMe ? " (You)" : ""}
              </Text>
              <Text style={[styles.webVehicleSpeed, { color: colors.mutedForeground }]}>
                {v.location.speed != null ? `${Math.round(v.location.speed)} mph` : "0 mph"}
              </Text>
            </View>
            {v.isLeader && (
              <MaterialCommunityIcons name="crown" size={16} color={colors.warning} />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webMap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  webMapTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  webMapText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  webVehicleList: {
    gap: 8,
    marginTop: 16,
    width: "90%",
  },
  webVehicleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  webVehicleDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  webVehicleName: {
    fontSize: 14,
    fontWeight: "600",
  },
  webVehicleSpeed: {
    fontSize: 11,
    marginTop: 2,
  },
});
