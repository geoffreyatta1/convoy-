import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { WsStopRequestMessage } from "@/services/convoy-ws";

const STOP_TYPE_LABELS: Record<WsStopRequestMessage["stopType"], string> = {
  fuel: "⛽ Fuel Stop",
  food: "🍔 Food Stop",
  rest: "😴 Rest Stop",
  bathroom: "🚻 Bathroom Break",
  general: "🛑 Stop Requested",
};

interface Props {
  request: WsStopRequestMessage;
  onAccept: () => void | Promise<void>;
  onDecline: () => void;
}

export function StopRequestModal({ request, onAccept, onDecline }: Props) {
  const label = STOP_TYPE_LABELS[request.stopType] ?? "🛑 Stop Requested";
  const { station } = request;

  return (
    <Modal transparent animationType="slide" visible>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{label}</Text>
          <Text style={styles.from}>
            {request.fromVehicleName} wants to stop
          </Text>

          <View style={styles.stationBox}>
            <Text style={styles.stationName}>{station.name}</Text>
            {station.brand ? (
              <Text style={styles.stationBrand}>{station.brand}</Text>
            ) : null}
            {station.distanceM != null ? (
              <Text style={styles.stationDist}>
                {station.distanceM < 1000
                  ? `${Math.round(station.distanceM)} m away`
                  : `${(station.distanceM / 1000).toFixed(1)} km away`}
              </Text>
            ) : null}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.declineBtn} onPress={onDecline}>
              <Text style={styles.declineTxt}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={onAccept}
            >
              <Text style={styles.acceptTxt}>Accept & Navigate</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 36,
  },
  card: {
    backgroundColor: "#1c1c1e",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#f59e0b33",
  },
  title: {
    color: "#f59e0b",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  from: {
    color: "#a1a1aa",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  stationBox: {
    backgroundColor: "#27272a",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  stationName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  stationBrand: {
    color: "#a1a1aa",
    fontSize: 13,
    marginBottom: 2,
  },
  stationDist: {
    color: "#71717a",
    fontSize: 12,
    marginBottom: 8,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  declineBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    backgroundColor: "#3f3f46",
    alignItems: "center",
  },
  declineTxt: {
    color: "#e4e4e7",
    fontWeight: "600",
    fontSize: 15,
  },
  acceptBtn: {
    flex: 2,
    borderRadius: 12,
    paddingVertical: 14,
    backgroundColor: "#f59e0b",
    alignItems: "center",
  },
  acceptTxt: {
    color: "#000000",
    fontWeight: "700",
    fontSize: 15,
  },
});
