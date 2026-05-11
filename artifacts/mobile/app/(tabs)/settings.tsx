import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";

type MCIconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];
import SubscriptionModal from "@/components/SubscriptionModal";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useConvoy } from "@/context/ConvoyContext";
import { useProfile, VehicleType } from "@/context/ProfileContext";
import {
  SubscriptionTier,
  TIER_CONFIG,
  useSubscription,
} from "@/context/SubscriptionContext";

function SectionLabel({ label }: { label: string }) {
  const colors = useColors();
  return (
    <Text style={[ss.sectionLabel, { color: colors.mutedForeground }]}>{label}</Text>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[ss.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

function Divider() {
  const colors = useColors();
  return <View style={[ss.divider, { backgroundColor: colors.border }]} />;
}

function ToggleRow({
  icon,
  label,
  value,
  onToggle,
  sub,
}: {
  icon: MCIconName;
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  sub?: string;
}) {
  const colors = useColors();
  return (
    <View style={ss.toggleRow}>
      <View style={[ss.rowIcon, { backgroundColor: colors.primary + "18" }]}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={ss.rowBody}>
        <Text style={[ss.rowLabel, { color: colors.foreground }]}>{label}</Text>
        {sub && <Text style={[ss.rowSub, { color: colors.mutedForeground }]}>{sub}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor="#fff"
      />
    </View>
  );
}

function NavRow({
  icon,
  label,
  badge,
  sub,
  onPress,
}: {
  icon: MCIconName;
  label: string;
  badge?: React.ReactNode;
  sub?: string;
  onPress?: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity style={ss.toggleRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[ss.rowIcon, { backgroundColor: colors.primary + "18" }]}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={[ss.rowBody, { flex: 1 }]}>
        <Text style={[ss.rowLabel, { color: colors.foreground }]}>{label}</Text>
        {sub ? <Text style={[ss.rowSub, { color: colors.mutedForeground }]}>{sub}</Text> : null}
      </View>
      {badge ?? <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />}
    </TouchableOpacity>
  );
}

const GAP_OPTIONS: { label: string; value: number }[] = [
  { label: "200 m", value: 200 },
  { label: "500 m", value: 500 },
  { label: "1 km", value: 1000 },
  { label: "2 km", value: 2000 },
];

function SegmentedRow({
  icon,
  label,
  sub,
  options,
  value,
  onChange,
}: {
  icon: MCIconName;
  label: string;
  sub?: string;
  options: { label: string; value: number }[];
  value: number;
  onChange: (v: number) => void;
}) {
  const colors = useColors();
  return (
    <View style={ss.segRow}>
      <View style={ss.segTop}>
        <View style={[ss.rowIcon, { backgroundColor: colors.primary + "18" }]}>
          <MaterialCommunityIcons name={icon} size={18} color={colors.primary} />
        </View>
        <View style={ss.rowBody}>
          <Text style={[ss.rowLabel, { color: colors.foreground }]}>{label}</Text>
          {sub && <Text style={[ss.rowSub, { color: colors.mutedForeground }]}>{sub}</Text>}
        </View>
      </View>
      <View style={[ss.segControl, { borderColor: colors.border }]}>
        {options.map((opt, i) => {
          const active = opt.value === value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                ss.segOption,
                active && { backgroundColor: colors.primary },
                i > 0 && { borderLeftWidth: 1, borderLeftColor: colors.border },
              ]}
              onPress={() => onChange(opt.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  ss.segLabel,
                  { color: active ? "#fff" : colors.mutedForeground },
                  active && { fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function SoonBadge() {
  const colors = useColors();
  return (
    <View style={[ss.soonBadge, { backgroundColor: colors.primary + "22" }]}>
      <Text style={[ss.soonText, { color: colors.primary }]}>SOON</Text>
    </View>
  );
}

function PremiumBadge() {
  return (
    <View style={ss.premiumBadge}>
      <MaterialCommunityIcons name="crown" size={13} color="#f59e0b" />
      <Text style={ss.premiumText}>Premium</Text>
    </View>
  );
}

const TIER_ORDER: SubscriptionTier[] = ["free", "convenience", "roadtrip"];
const TIER_ICONS: Record<SubscriptionTier, MCIconName> = {
  free: "car",
  convenience: "car-multiple",
  roadtrip: "map-marker-path",
};

export const VEHICLE_OPTIONS: { type: VehicleType; label: string; icon: MCIconName }[] = [
  { type: "car", label: "Car", icon: "car" },
  { type: "suv", label: "SUV", icon: "car-estate" },
  { type: "truck", label: "Truck", icon: "truck" },
  { type: "motorcycle", label: "Motorcycle", icon: "motorbike" },
  { type: "van", label: "Van", icon: "bus" },
];

function EditProfileModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, updateProfile } = useProfile();

  const [draftName, setDraftName] = useState(profile.displayName);
  const [draftVehicle, setDraftVehicle] = useState<VehicleType>(profile.vehicleType);

  const handleOpen = () => {
    setDraftName(profile.displayName);
    setDraftVehicle(profile.vehicleType);
  };

  const handleSave = async () => {
    const name = draftName.trim().slice(0, 20) || "My Vehicle";
    await updateProfile({ displayName: name, vehicleType: draftVehicle });
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onShow={handleOpen}
    >
      <View style={[ss.editRoot, { backgroundColor: colors.background }]}>
        <View
          style={[
            ss.editHeader,
            { borderBottomColor: colors.border, paddingTop: insets.top + 12 },
          ]}
        >
          <TouchableOpacity onPress={onClose} style={ss.editHeaderBtn}>
            <Text style={[ss.editHeaderBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[ss.editHeaderTitle, { color: colors.foreground }]}>Edit Profile</Text>
          <TouchableOpacity onPress={handleSave} style={[ss.editHeaderBtn, { alignItems: "flex-end" }]}>
            <Text style={[ss.editHeaderBtnText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={ss.editBody}>
          <View style={ss.avatarSection}>
            <View style={[ss.avatarCircle, { backgroundColor: "#3d2008" }]}>
              <MaterialCommunityIcons name="account" size={52} color={colors.primary} />
            </View>
            <TouchableOpacity
              onPress={() => Alert.alert("Change Photo", "Photo upload coming soon.")}
            >
              <Text style={[ss.changePhotoText, { color: colors.primary }]}>Change Photo</Text>
            </TouchableOpacity>
          </View>

          <View style={ss.editSection}>
            <Text style={[ss.editLabel, { color: colors.mutedForeground }]}>Display Name</Text>
            <TextInput
              style={[
                ss.editInput,
                { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
              ]}
              value={draftName}
              onChangeText={(t) => setDraftName(t.slice(0, 20))}
              placeholder="Your name"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="done"
              maxLength={20}
            />
            <Text style={[ss.editHint, { color: colors.mutedForeground }]}>
              Visible to other convoy members. Max 20 characters.
            </Text>
          </View>

          <View style={ss.editSection}>
            <Text style={[ss.editLabel, { color: colors.mutedForeground }]}>Map Vehicle</Text>
            <View style={[ss.vehicleGrid, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {VEHICLE_OPTIONS.map((v) => {
                const active = draftVehicle === v.type;
                return (
                  <TouchableOpacity
                    key={v.type}
                    style={ss.vehicleItem}
                    onPress={() => {
                      if (Platform.OS !== "web") Haptics.selectionAsync();
                      setDraftVehicle(v.type);
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        ss.vehicleIconWrap,
                        active && { backgroundColor: colors.primary },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={v.icon}
                        size={28}
                        color={active ? "#000" : colors.foreground}
                      />
                    </View>
                    <Text
                      style={[
                        ss.vehicleLabel,
                        { color: active ? colors.primary : colors.mutedForeground },
                        active && { fontFamily: "Inter_600SemiBold" },
                      ]}
                    >
                      {v.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[ss.editHint, { color: colors.mutedForeground }]}>
              This icon represents you on the convoy map for other members.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { leaveConvoy, gapThresholdM, setGapThresholdM } = useConvoy();
  const { tier, setTier } = useSubscription();
  const { profile } = useProfile();

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [avoidMotorways, setAvoidMotorways] = useState(false);
  const [avoidFerries, setAvoidFerries] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [shareLocation, setShareLocation] = useState(true);
  const [bluetooth, setBluetooth] = useState(true);

  const toggle = (fn: (v: boolean) => void) => (v: boolean) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    fn(v);
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await leaveConvoy();
          await signOut();
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This action cannot be undone. All convoy data will be permanently deleted.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => {} },
      ]
    );
  };

  const vehicleLabel =
    VEHICLE_OPTIONS.find((v) => v.type === profile.vehicleType)?.label ?? "Car";

  return (
    <>
      <ScrollView
        style={[ss.root, { backgroundColor: colors.background }]}
        contentContainerStyle={[
          ss.scroll,
          { paddingTop: topPad + 8, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[ss.pageTitle, { color: colors.foreground }]}>Settings</Text>

        {/* ── Profile ────────────────────────────────── */}
        <SectionLabel label="Profile" />
        <SectionCard>
          <TouchableOpacity
            style={ss.profileRow}
            onPress={() => setShowEditProfile(true)}
            activeOpacity={0.7}
          >
            <View style={[ss.profileAvatar, { backgroundColor: "#3d2008" }]}>
              <MaterialCommunityIcons name="account" size={22} color={colors.primary} />
            </View>
            <View style={[ss.rowBody, { flex: 1 }]}>
              <Text style={[ss.rowLabel, { color: colors.foreground }]}>
                {profile.displayName}
              </Text>
              <Text style={[ss.rowSub, { color: colors.mutedForeground }]}>
                {vehicleLabel} · Tap to edit
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </SectionCard>

        {/* ── Navigation ────────────────────────────── */}
        <SectionLabel label="Navigation" />
        <SectionCard>
          <ToggleRow icon="currency-usd-off" label="Avoid Toll Roads" value={avoidTolls} onToggle={toggle(setAvoidTolls)} />
          <Divider />
          <ToggleRow icon="road-variant" label="Avoid Motorways" value={avoidMotorways} onToggle={toggle(setAvoidMotorways)} />
          <Divider />
          <ToggleRow icon="ferry" label="Avoid Ferries" value={avoidFerries} onToggle={toggle(setAvoidFerries)} />
          <Divider />
          <NavRow icon="account-voice" label="Navigation Voice" badge={<PremiumBadge />} onPress={() => Alert.alert("Navigation Voice", "Upgrade to a paid plan to enable voice guidance.")} />
          <Divider />
          <NavRow icon="microphone" label="AI Voice Assistant" badge={<PremiumBadge />} onPress={() => Alert.alert("AI Voice Assistant", "Upgrade to Convenience or Roadtrip to use the AI voice assistant.")} />
        </SectionCard>

        <Text style={[ss.noteText, { color: colors.mutedForeground }]}>
          Route avoidance preferences apply when calculating convoy directions.
        </Text>

        {/* ── Preferences ───────────────────────────── */}
        <SectionLabel label="Preferences" />
        <SectionCard>
          <ToggleRow icon="bell" label="Notifications" value={notifications} onToggle={toggle(setNotifications)} />
          <Divider />
          <ToggleRow icon="navigation" label="Share Location" value={shareLocation} onToggle={toggle(setShareLocation)} />
          <Divider />
          <ToggleRow icon="bluetooth" label="Bluetooth" value={bluetooth} onToggle={toggle(setBluetooth)} />
          <Divider />
          <SegmentedRow
            icon="car-arrow-right"
            label="Gap Alert Distance"
            sub="Warn when a car falls this far behind"
            options={GAP_OPTIONS}
            value={gapThresholdM}
            onChange={(v) => {
              if (Platform.OS !== "web") Haptics.selectionAsync();
              setGapThresholdM(v);
            }}
          />
        </SectionCard>

        <Text style={[ss.noteText, { color: colors.mutedForeground }]}>
          Location sharing is required for convoy functionality. Bluetooth enables CarPlay integration.
        </Text>

        {/* ── Privacy & Safety ──────────────────────── */}
        <SectionLabel label="Privacy & Safety" />
        <SectionCard>
          <NavRow icon="hand-back-left" label="Privacy" />
          <Divider />
          <NavRow icon="chart-bar" label="Data Usage" />
        </SectionCard>

        {/* ── Coming Soon ───────────────────────────── */}
        <SectionLabel label="Coming Soon" />
        <SectionCard>
          <NavRow icon="palette" label="Custom Convoy Icons" badge={<SoonBadge />} />
          <Divider />
          <NavRow icon="car-connected" label="Android Auto Support" badge={<SoonBadge />} />
        </SectionCard>

        <Text style={[ss.noteText, { color: colors.mutedForeground }]}>
          These features are actively in development. Upgrade to get early access as they launch.
        </Text>

        {/* ── Information ───────────────────────────── */}
        <SectionLabel label="Information" />
        <SectionCard>
          <NavRow icon="information" label="About Convoy" />
          <Divider />
          <NavRow icon="help-circle" label="Help & Support" />
        </SectionCard>

        {/* ── Subscription ──────────────────────────── */}
        <SectionLabel label="Subscription" />
        <SectionCard>
          <TouchableOpacity
            style={ss.toggleRow}
            onPress={() => setShowSubscription(true)}
            activeOpacity={0.7}
          >
            <View style={[ss.rowIcon, { backgroundColor: colors.primary + "18" }]}>
              <MaterialCommunityIcons
                name={tier === "free" ? "crown-outline" : "crown"}
                size={18}
                color={colors.primary}
              />
            </View>
            <View style={[ss.rowBody, { flex: 1 }]}>
              <Text style={[ss.rowLabel, { color: colors.foreground }]}>
                {TIER_CONFIG[tier].name} Plan
              </Text>
              <Text style={[ss.rowSub, { color: colors.mutedForeground }]}>
                {tier === "free"
                  ? "Upgrade for more vehicles & features"
                  : `${TIER_CONFIG[tier].price} · Manage subscription`}
              </Text>
            </View>
            {tier !== "free" && (
              <View style={[ss.premiumBadge, { marginRight: 4 }]}>
                <MaterialCommunityIcons name="crown" size={13} color="#f59e0b" />
                <Text style={ss.premiumText}>Active</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </SectionCard>

        {tier === "free" && (
          <TouchableOpacity
            style={[
              ss.upgradeBanner,
              { backgroundColor: colors.primary, shadowColor: colors.primary },
            ]}
            onPress={() => setShowSubscription(true)}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="crown" size={20} color="#000" />
            <View style={{ flex: 1 }}>
              <Text style={ss.upgradeBannerTitle}>Unlock the full convoy</Text>
              <Text style={ss.upgradeBannerSub}>
                From £3.99/mo · Walkie-talkie, 9+ vehicles, AI assistant
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#000" />
          </TouchableOpacity>
        )}

        {/* ── Developer Tools ── */}
        <View style={ss.devHeader}>
          <MaterialCommunityIcons name="tools" size={16} color={colors.primary} />
          <Text style={[ss.devTitle, { color: colors.primary }]}>Developer Tools</Text>
        </View>

        <SectionCard>
          {TIER_ORDER.map((t, i) => {
            const cfg = TIER_CONFIG[t];
            const isActive = tier === t;
            return (
              <React.Fragment key={t}>
                {i > 0 && <Divider />}
                <TouchableOpacity
                  style={ss.tierRow}
                  onPress={async () => {
                    if (Platform.OS !== "web") Haptics.selectionAsync();
                    await setTier(t);
                  }}
                >
                  <View style={[ss.rowIcon, { backgroundColor: colors.primary + "18" }]}>
                    <MaterialCommunityIcons name={TIER_ICONS[t]} size={18} color={isActive ? colors.primary : colors.mutedForeground} />
                  </View>
                  <View style={ss.tierInfo}>
                    <Text style={[ss.tierName, { color: isActive ? colors.primary : colors.foreground }]}>{cfg.name}</Text>
                    <Text style={[ss.tierSub, { color: colors.mutedForeground }]}>{cfg.description} · {cfg.price}</Text>
                  </View>
                  {isActive && <MaterialCommunityIcons name="check" size={18} color={colors.primary} />}
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </SectionCard>

        <Text style={[ss.noteText, { color: colors.mutedForeground }]}>
          Force a subscription tier for UI testing. Visible in debug builds only.
        </Text>

        {/* ── Account ───────────────────────────────── */}
        <SectionLabel label="Account" />
        <SectionCard>
          {user?.email ? (
            <>
              <View style={ss.toggleRow}>
                <View style={[ss.rowIcon, { backgroundColor: "#22c55e18" }]}>
                  <MaterialCommunityIcons name="check-circle" size={18} color="#22c55e" />
                </View>
                <View style={ss.rowBody}>
                  <Text style={[ss.rowLabel, { color: colors.foreground }]}>Signed in</Text>
                  <Text style={[ss.rowSub, { color: colors.mutedForeground }]}>{user.email}</Text>
                </View>
              </View>
              <Divider />
            </>
          ) : null}
          <TouchableOpacity style={ss.toggleRow} onPress={handleSignOut}>
            <View style={[ss.rowIcon, { backgroundColor: colors.primary + "18" }]}>
              <MaterialCommunityIcons name="logout" size={18} color={colors.primary} />
            </View>
            <Text style={[ss.rowLabel, { color: colors.primary }]}>Sign Out</Text>
          </TouchableOpacity>
          <Divider />
          <TouchableOpacity style={ss.toggleRow} onPress={handleDeleteAccount}>
            <View style={[ss.rowIcon, { backgroundColor: "#ef444418" }]}>
              <MaterialCommunityIcons name="delete" size={18} color="#ef4444" />
            </View>
            <Text style={[ss.rowLabel, { color: "#ef4444" }]}>Delete Account</Text>
          </TouchableOpacity>
        </SectionCard>

        <View style={{ height: 8 }} />
      </ScrollView>

      <EditProfileModal visible={showEditProfile} onClose={() => setShowEditProfile(false)} />
      <SubscriptionModal visible={showSubscription} onClose={() => setShowSubscription(false)} />
    </>
  );
}

const ss = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 16, gap: 10 },
  pageTitle: { fontSize: 34, fontWeight: "800", fontFamily: "Inter_700Bold", marginBottom: 4 },
  sectionLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5, fontFamily: "Inter_600SemiBold", marginLeft: 4, marginTop: 6 },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  divider: { height: 1 },
  noteText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, paddingHorizontal: 4 },
  toggleRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  rowIcon: { width: 36, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  rowBody: { gap: 1 },
  rowLabel: { fontSize: 15, fontFamily: "Inter_400Regular" },
  rowSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  soonBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  soonText: { fontSize: 10, fontWeight: "700", fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  premiumBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  premiumText: { fontSize: 13, fontWeight: "600", color: "#f59e0b", fontFamily: "Inter_600SemiBold" },
  segRow: { padding: 14, gap: 10 },
  segTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  segControl: { flexDirection: "row", borderWidth: 1, borderRadius: 9, overflow: "hidden" },
  segOption: { flex: 1, paddingVertical: 8, alignItems: "center", justifyContent: "center" },
  segLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  upgradeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  upgradeBannerTitle: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#000" },
  upgradeBannerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#00000099", marginTop: 2 },
  devHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 4, marginTop: 6 },
  devTitle: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" },
  tierRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  tierInfo: { flex: 1, gap: 2 },
  tierName: { fontSize: 15, fontFamily: "Inter_400Regular" },
  tierSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  profileRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  profileAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  editRoot: { flex: 1 },
  editHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  editHeaderTitle: { fontSize: 17, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  editHeaderBtn: { minWidth: 60 },
  editHeaderBtnText: { fontSize: 16, fontFamily: "Inter_400Regular" },
  editBody: { paddingHorizontal: 24, paddingVertical: 32, gap: 32 },
  avatarSection: { alignItems: "center", gap: 12 },
  avatarCircle: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center" },
  changePhotoText: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  editSection: { gap: 10 },
  editLabel: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  editInput: { height: 52, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, fontSize: 16, fontFamily: "Inter_400Regular" },
  editHint: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  vehicleGrid: { borderRadius: 14, borderWidth: 1, padding: 16, flexDirection: "row", flexWrap: "wrap", gap: 4 },
  vehicleItem: { width: "19%", alignItems: "center", gap: 6, paddingVertical: 4 },
  vehicleIconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  vehicleLabel: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
});
