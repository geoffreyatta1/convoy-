import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import HazardPicker from "@/components/HazardPicker";
import { useColors } from "@/hooks/useColors";
import { useConvoy } from "@/context/ConvoyContext";
import { useProfile } from "@/context/ProfileContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { HazardType } from "@/services/hazards";
import { geocodeAddress, GeoResult } from "@/services/routing";
import { fetchNearbyDrivingRoads, DrivingRoad } from "@/services/best-driving-roads";

type ModalMode = "none" | "create" | "join";

export default function ConvoysScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, myVehicle, createConvoy, joinConvoy, leaveConvoy, setDestination, reportHazard } = useConvoy();
  const { config, canAddMember } = useSubscription();
  const { profile } = useProfile();

  const [modalMode, setModalMode] = useState<ModalMode>("none");

  // Create convoy state
  const [convoyName, setConvoyName] = useState("Family Road Trip");
  const [destQuery, setDestQuery] = useState("");
  const [destResults, setDestResults] = useState<GeoResult[]>([]);
  const [selectedDest, setSelectedDest] = useState<GeoResult | null>(null);
  const [nearbyRoads, setNearbyRoads] = useState<DrivingRoad[]>([]);
  const [destSearching, setDestSearching] = useState(false);
  const destDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Join convoy state
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [showHazardPicker, setShowHazardPicker] = useState(false);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  // Load nearby best driving roads when create modal opens
  const loadNearbyRoads = useCallback(async () => {
    setNearbyRoads([]);
    try {
      let lat = myVehicle?.location.latitude;
      let lng = myVehicle?.location.longitude;
      if (!lat || !lng) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        }
      }
      if (lat && lng) {
        const roads = await fetchNearbyDrivingRoads(lat, lng, 250);
        setNearbyRoads(roads);
      }
    } catch {}
  }, [myVehicle]);

  // Debounced destination search
  useEffect(() => {
    if (!destQuery.trim() || selectedDest) {
      setDestResults([]);
      return;
    }
    if (destDebounceRef.current) clearTimeout(destDebounceRef.current);
    destDebounceRef.current = setTimeout(async () => {
      setDestSearching(true);
      const results = await geocodeAddress(destQuery);
      setDestResults(results.slice(0, 5));
      setDestSearching(false);
    }, 400);
    return () => {
      if (destDebounceRef.current) clearTimeout(destDebounceRef.current);
    };
  }, [destQuery, selectedDest]);

  const handleSelectDest = (result: GeoResult) => {
    setSelectedDest(result);
    setDestQuery(result.name);
    setDestResults([]);
    if (convoyName === "Family Road Trip") {
      setConvoyName(result.name);
    }
    if (Platform.OS !== "web") Haptics.selectionAsync();
  };

  const handleSelectRoad = (road: DrivingRoad) => {
    const geo: GeoResult = {
      name: road.name,
      displayName: road.description ?? road.name,
      latitude: road.latitude,
      longitude: road.longitude,
    };
    handleSelectDest(geo);
  };

  const handleClearDest = () => {
    setSelectedDest(null);
    setDestQuery("");
    setDestResults([]);
  };

  const handleReportHazard = async (type: HazardType) => {
    let lat = myVehicle?.location.latitude;
    let lng = myVehicle?.location.longitude;
    if (!lat || !lng) {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        }
      } catch {}
    }
    if (!lat || !lng) {
      Alert.alert("Location unavailable", "Could not determine your location to report the hazard.");
      return;
    }
    await reportHazard(type, lat, lng);
  };

  const handleCreate = async () => {
    const name = convoyName.trim() || selectedDest?.name || "Family Road Trip";
    setLoading(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await createConvoy(name, profile.displayName);
    if (selectedDest) {
      setDestination(selectedDest.name, selectedDest.latitude, selectedDest.longitude);
    }
    setLoading(false);
    setModalMode("none");
    router.push("/(tabs)/map");
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) {
      Alert.alert("Missing info", "Enter the convoy code");
      return;
    }
    if (!canAddMember(1)) {
      Alert.alert(
        "Upgrade Required",
        `Your ${config.name} plan allows convoys of up to ${config.maxMembers} vehicles. Upgrade to add more.`,
        [{ text: "OK" }]
      );
      return;
    }
    setLoading(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const ok = await joinConvoy(joinCode.toUpperCase().trim(), profile.displayName);
    setLoading(false);
    if (!ok) {
      Alert.alert("Invalid code", "Check the convoy code and try again");
      return;
    }
    setModalMode("none");
    router.push("/(tabs)/map");
  };

  const handleEndConvoy = () => {
    Alert.alert("End Convoy?", "This will disconnect all members from the convoy.", [
      { text: "Cancel", style: "cancel" },
      {
        text: myVehicle?.isLeader ? "End Convoy" : "Leave Convoy",
        style: "destructive",
        onPress: async () => { await leaveConvoy(); },
      },
    ]);
  };

  const handleCopyCode = async () => {
    if (!session) return;
    if (Platform.OS !== "web") Haptics.selectionAsync();
    await Clipboard.setStringAsync(session.code);
    Alert.alert("Copied!", "Convoy code copied to clipboard");
  };

  const openCreate = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setConvoyName("Family Road Trip");
    setDestQuery("");
    setSelectedDest(null);
    setDestResults([]);
    setModalMode("create");
    loadNearbyRoads();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>Convoys</Text>

        {/* ── Active Convoy ─────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            Active Convoy
          </Text>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {session ? (
              <>
                <View style={styles.convoyHeader}>
                  <View style={styles.convoyHeaderLeft}>
                    <Text style={[styles.convoyTitle, { color: colors.foreground }]}>
                      {session.name}
                    </Text>
                    <View style={styles.activeRow}>
                      <View style={[styles.activeDot, { backgroundColor: "#22c55e" }]} />
                      <Text style={[styles.activeText, { color: "#22c55e" }]}>Active</Text>
                    </View>
                  </View>
                  <View style={[styles.memberBadge, { backgroundColor: colors.primary }]}>
                    <MaterialCommunityIcons name="account-multiple" size={14} color="#000" />
                    <Text style={[styles.memberCount, { color: "#000" }]}>
                      {session.vehicles.length}
                    </Text>
                  </View>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <View style={styles.codeRow}>
                  <Text style={[styles.codeLabel, { color: colors.mutedForeground }]}>
                    Code:{"  "}
                    <Text style={[styles.codeValue, { color: colors.foreground }]}>
                      {session.code}
                    </Text>
                  </Text>
                  <TouchableOpacity onPress={handleCopyCode} style={styles.copyBtn}>
                    <MaterialCommunityIcons name="content-copy" size={14} color={colors.mutedForeground} />
                    <Text style={[styles.copyText, { color: colors.mutedForeground }]}>Copy</Text>
                  </TouchableOpacity>
                </View>

                {session.destination && (
                  <View style={[styles.destRow, { backgroundColor: "#3d200880" }]}>
                    <MaterialCommunityIcons name="navigation" size={16} color={colors.primary} />
                    <Text style={[styles.destText, { color: colors.primary }]} numberOfLines={1}>
                      {session.destination.name}
                    </Text>
                  </View>
                )}

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.primary, flex: 1 }]}
                    onPress={() => {
                      if (Platform.OS !== "web") Haptics.selectionAsync();
                      router.push("/(tabs)/map");
                    }}
                  >
                    <Ionicons name="map" size={16} color="#000" />
                    <Text style={[styles.actionBtnText, { color: "#000" }]}>View Map</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: "#ef4444", flex: 1 }]}
                    onPress={handleEndConvoy}
                  >
                    <MaterialCommunityIcons name="close-circle" size={16} color="#fff" />
                    <Text style={styles.actionBtnText}>
                      {myVehicle?.isLeader ? "End Convoy" : "Leave Convoy"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.noConvoy}>
                <MaterialCommunityIcons name="car-off" size={36} color={colors.mutedForeground} />
                <Text style={[styles.noConvoyText, { color: colors.mutedForeground }]}>
                  No active convoy
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Quick Actions ──────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            Quick Actions
          </Text>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity style={styles.listRow} onPress={openCreate}>
              <View style={[styles.listIcon, { backgroundColor: colors.primary + "18" }]}>
                <MaterialCommunityIcons name="plus-circle" size={20} color={colors.primary} />
              </View>
              <View style={styles.listText}>
                <Text style={[styles.listTitle, { color: colors.primary }]}>Create New Convoy</Text>
                <Text style={[styles.listSub, { color: colors.mutedForeground }]}>Start a new convoy as admin</Text>
              </View>
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              style={styles.listRow}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.selectionAsync();
                setJoinCode("");
                setModalMode("join");
              }}
            >
              <View style={[styles.listIcon, { backgroundColor: colors.primary + "18" }]}>
                <MaterialCommunityIcons name="pound" size={20} color={colors.primary} />
              </View>
              <View style={styles.listText}>
                <Text style={[styles.listTitle, { color: colors.primary }]}>Join Convoy</Text>
                <Text style={[styles.listSub, { color: colors.mutedForeground }]}>Enter a 6-digit code</Text>
              </View>
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              style={styles.listRow}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.selectionAsync();
                setShowHazardPicker(true);
              }}
            >
              <View style={[styles.listIcon, { backgroundColor: "#ef444418" }]}>
                <MaterialCommunityIcons name="shield-alert" size={20} color="#ef4444" />
              </View>
              <View style={styles.listText}>
                <Text style={[styles.listTitle, { color: "#ef4444" }]}>Report Road Hazard</Text>
                <Text style={[styles.listSub, { color: colors.mutedForeground }]}>Shared with all drivers</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── History ───────────────────────────────────── */}
        <View style={[styles.section, { marginBottom: insets.bottom + 24 }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>History</Text>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity style={styles.listRow}>
              <View style={[styles.listIcon, { backgroundColor: colors.primary + "18" }]}>
                <MaterialCommunityIcons name="history" size={20} color={colors.primary} />
              </View>
              <View style={[styles.listText, { flex: 1 }]}>
                <Text style={[styles.listTitle, { color: colors.primary }]}>Convoy History</Text>
                <Text style={[styles.listSub, { color: colors.mutedForeground }]}>View past convoys</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <HazardPicker
        visible={showHazardPicker}
        onClose={() => setShowHazardPicker(false)}
        onReport={handleReportHazard}
      />

      {/* ── Create Modal ─────────────────────────────── */}
      <Modal
        visible={modalMode === "create"}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalMode("none")}
      >
        <KeyboardAvoidingView
          style={[styles.modalRoot, { backgroundColor: colors.background }]}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setModalMode("none")}>
              <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Start a Convoy</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            {/* Vehicle info banner */}
            <View style={[styles.profileBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="account-circle" size={20} color={colors.primary} />
              <Text style={[styles.profileBannerText, { color: colors.mutedForeground }]}>
                Joining as{" "}
                <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>
                  {profile.displayName}
                </Text>
                {" "}· Set in Settings → Profile
              </Text>
            </View>

            {/* Convoy Name */}
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>CONVOY NAME</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                value={convoyName}
                onChangeText={setConvoyName}
                placeholder="Family Road Trip"
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="next"
              />
            </View>

            {/* Destination Search */}
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>DESTINATION</Text>
              <View style={[styles.destInputWrap, { backgroundColor: colors.card, borderColor: selectedDest ? colors.primary : colors.border }]}>
                <MaterialCommunityIcons
                  name={selectedDest ? "map-marker-check" : "map-search"}
                  size={18}
                  color={selectedDest ? colors.primary : colors.mutedForeground}
                  style={{ marginLeft: 12 }}
                />
                <TextInput
                  style={[styles.destInput, { color: colors.foreground }]}
                  value={destQuery}
                  onChangeText={(t) => {
                    setDestQuery(t);
                    if (selectedDest) setSelectedDest(null);
                  }}
                  placeholder="Search for a destination…"
                  placeholderTextColor={colors.mutedForeground}
                  returnKeyType="search"
                />
                {destSearching && <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 12 }} />}
                {selectedDest && !destSearching && (
                  <TouchableOpacity onPress={handleClearDest} style={{ marginRight: 12 }}>
                    <MaterialCommunityIcons name="close-circle" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Search results */}
              {destResults.length > 0 && (
                <View style={[styles.resultsList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {destResults.map((r, i) => (
                    <React.Fragment key={`${r.latitude}-${r.longitude}-${i}`}>
                      {i > 0 && <View style={[styles.resultDivider, { backgroundColor: colors.border }]} />}
                      <TouchableOpacity style={styles.resultRow} onPress={() => handleSelectDest(r)}>
                        <MaterialCommunityIcons name="map-marker-outline" size={16} color={colors.mutedForeground} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.resultName, { color: colors.foreground }]} numberOfLines={1}>
                            {r.name}
                          </Text>
                          <Text style={[styles.resultSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                            {r.displayName}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </React.Fragment>
                  ))}
                </View>
              )}
            </View>

            {/* Nearby best driving roads suggestions */}
            {nearbyRoads.length > 0 && !selectedDest && (
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>SCENIC ROAD SUGGESTIONS</Text>
                <View style={[styles.roadsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {nearbyRoads.map((road, i) => (
                    <React.Fragment key={road.id}>
                      {i > 0 && <View style={[styles.resultDivider, { backgroundColor: colors.border }]} />}
                      <TouchableOpacity style={styles.roadRow} onPress={() => handleSelectRoad(road)}>
                        <View style={[styles.roadIcon, { backgroundColor: colors.primary + "18" }]}>
                          <MaterialCommunityIcons name="road" size={16} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.roadName, { color: colors.foreground }]}>{road.name}</Text>
                          <Text style={[styles.roadSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                            {road.region ?? road.country}
                            {road.distanceKm != null ? ` · ${road.distanceKm} km away` : ""}
                          </Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={16} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    </React.Fragment>
                  ))}
                </View>
              </View>
            )}

            <View style={[styles.tierInfo, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="information-outline" size={16} color={colors.primary} />
              <Text style={[styles.tierInfoText, { color: colors.mutedForeground }]}>
                Your plan allows up to{" "}
                <Text style={{ color: colors.primary, fontWeight: "700" }}>{config.maxMembers}</Text>{" "}
                vehicles per convoy
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
              onPress={handleCreate}
              disabled={loading}
            >
              <MaterialCommunityIcons name="rocket-launch" size={20} color="#000" />
              <Text style={[styles.primaryBtnText, { color: "#000" }]}>
                {loading ? "Creating…" : "Create Convoy"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Join Modal ───────────────────────────────── */}
      <Modal
        visible={modalMode === "join"}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalMode("none")}
      >
        <KeyboardAvoidingView
          style={[styles.modalRoot, { backgroundColor: colors.background }]}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setModalMode("none")}>
              <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Join a Convoy</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView contentContainerStyle={styles.modalBody}>
            {/* Vehicle info banner */}
            <View style={[styles.profileBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="account-circle" size={20} color={colors.primary} />
              <Text style={[styles.profileBannerText, { color: colors.mutedForeground }]}>
                Joining as{" "}
                <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>
                  {profile.displayName}
                </Text>
                {" "}· Set in Settings → Profile
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>CONVOY CODE</Text>
              <TextInput
                style={[styles.input, styles.codeInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                value={joinCode}
                onChangeText={(t) => setJoinCode(t.toUpperCase())}
                placeholder="ABC123"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="characters"
                maxLength={6}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
              onPress={handleJoin}
              disabled={loading}
            >
              <MaterialCommunityIcons name="car-arrow-right" size={20} color="#000" />
              <Text style={[styles.primaryBtnText, { color: "#000" }]}>
                {loading ? "Joining…" : "Join Convoy"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 16, gap: 8 },
  pageTitle: { fontSize: 34, fontWeight: "800", fontFamily: "Inter_700Bold", marginBottom: 8 },
  section: { gap: 8 },
  sectionLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5, fontFamily: "Inter_600SemiBold", marginLeft: 4 },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  convoyHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: 16 },
  convoyHeaderLeft: { gap: 4, flex: 1 },
  convoyTitle: { fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold" },
  activeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  activeDot: { width: 8, height: 8, borderRadius: 4 },
  activeText: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  memberBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  memberCount: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" },
  divider: { height: 1 },
  codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  codeLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  codeValue: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold", letterSpacing: 1 },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  copyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  destRow: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  destText: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold", flex: 1 },
  actionRow: { flexDirection: "row", gap: 10, padding: 16 },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12 },
  actionBtnText: { color: "#fff", fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" },
  noConvoy: { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 32 },
  noConvoyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  listRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  listIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  listText: { gap: 2 },
  listTitle: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  listSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  modalRoot: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, paddingTop: 56 },
  modalTitle: { fontSize: 17, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  modalCancel: { fontSize: 16, fontFamily: "Inter_400Regular", width: 60 },
  modalBody: { padding: 24, gap: 20 },
  profileBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  profileBannerText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
  field: { gap: 8 },
  fieldLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, fontFamily: "Inter_700Bold" },
  input: { height: 52, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, fontSize: 15, fontFamily: "Inter_400Regular" },
  codeInput: { fontSize: 24, fontWeight: "700", letterSpacing: 4, textAlign: "center", fontFamily: "Inter_700Bold" },
  destInputWrap: { height: 52, borderRadius: 12, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  destInput: { flex: 1, height: "100%", fontSize: 15, fontFamily: "Inter_400Regular" },
  resultsList: { borderRadius: 12, borderWidth: 1, overflow: "hidden", marginTop: -4 },
  resultDivider: { height: 1 },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  resultName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  resultSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  roadsCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  roadRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  roadIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  roadName: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  roadSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  tierInfo: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  tierInfoText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 56, borderRadius: 16 },
  primaryBtnText: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
});
