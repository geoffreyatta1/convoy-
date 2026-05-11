/**
 * StopProposalBanner — bottom banner shown when another convoy member
 * suggests stopping at a specific location.  Allows the driver to
 * accept (and reroute) or decline without leaving the map view.
 */
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { WsStopProposalMessage } from "@/services/convoy-ws";

interface Props {
  proposal: WsStopProposalMessage;
  onAccept: () => void | Promise<void>;
  onDecline: () => void;
  onReroute: () => void | Promise<void>;
}

export function StopProposalBanner({ proposal, onAccept, onDecline, onReroute }: Props) {
  return (
    <View style={styles.banner}>
      <View style={styles.iconBox}>
        <MaterialCommunityIcons name="map-marker-plus" size={22} color="#f59e0b" />
      </View>

      <View style={styles.body}>
        <Text style={styles.from} numberOfLines={1}>
          <Text style={styles.name}>{proposal.proposedBy}</Text> suggests a stop
        </Text>
        <Text style={styles.stopName} numberOfLines={1}>
          {proposal.name}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.declineBtn} onPress={onDecline}>
          <Text style={styles.declineTxt}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.rerouteBtn} onPress={onReroute}>
          <Text style={styles.rerouteTxt}>Reroute</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
          <Text style={styles.acceptTxt}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1c1c1e",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#f59e0b44",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(245,158,11,0.15)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  body: {
    flex: 1,
  },
  from: {
    color: "#a1a1aa",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 2,
  },
  name: {
    color: "#d4d4d8",
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  stopName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  actions: {
    flexDirection: "row",
    gap: 6,
    flexShrink: 0,
  },
  declineBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#3f3f46",
    alignItems: "center",
  },
  declineTxt: {
    color: "#e4e4e7",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  rerouteBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(245,158,11,0.15)",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.4)",
  },
  rerouteTxt: {
    color: "#f59e0b",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  acceptBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#f59e0b",
    alignItems: "center",
  },
  acceptTxt: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
});
