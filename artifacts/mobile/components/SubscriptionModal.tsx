import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";

type MCIconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { SubscriptionTier, TIER_CONFIG, useSubscription } from "@/context/SubscriptionContext";
import { useColors } from "@/hooks/useColors";
import {
  fetchStripeProducts,
  openBillingPortal,
  startCheckout,
  StripeProduct,
} from "@/services/stripe";

// ─── Tier order & feature icons ──────────────────────────────────────────────

const TIER_ORDER: SubscriptionTier[] = ["free", "convenience", "roadtrip"];

const FEATURE_ICON: Record<string, MCIconName> = {
  "Up to 3 vehicles per convoy": "car",
  "Up to 9 vehicles per convoy": "car-multiple",
  "Unlimited vehicles": "infinity",
  "Apple Maps navigation": "map",
  "Gap warnings": "alert-circle",
  "Hazard reporting": "hazard-lights",
  "Private PTT walkie-talkie": "radio-handheld",
  "AI voice assistant": "microphone",
  "Navigation voice guidance": "volume-high",
  "Priority support": "headset",
  "Early feature access": "rocket-launch",
  "Everything in Free": "check-all",
  "Everything in Convenience": "check-all",
};

// ─── Plan card ────────────────────────────────────────────────────────────────

function PlanCard({
  tier,
  product,
  isActive,
  isLoading,
  onSelect,
}: {
  tier: SubscriptionTier;
  product: StripeProduct | null;
  isActive: boolean;
  isLoading: boolean;
  onSelect: (priceId: string | null) => void;
}) {
  const colors = useColors();
  const cfg = TIER_CONFIG[tier];
  const price = product?.prices[0] ?? null;
  const isFree = tier === "free";
  const isHighlighted = tier === "roadtrip";

  const borderColor = isActive
    ? colors.primary
    : isHighlighted
    ? colors.primary + "55"
    : colors.border;

  const bgColor = isActive
    ? colors.primary + "12"
    : colors.card;

  return (
    <View
      style={[
        ps.card,
        { backgroundColor: bgColor, borderColor },
        isHighlighted && !isActive && { borderColor: colors.primary + "55" },
      ]}
    >
      {isHighlighted && (
        <View style={[ps.popularBadge, { backgroundColor: colors.primary }]}>
          <Text style={ps.popularText}>BEST VALUE</Text>
        </View>
      )}

      {/* Header */}
      <View style={ps.cardHeader}>
        <View style={[ps.iconWrap, { backgroundColor: colors.primary + "20" }]}>
          <MaterialCommunityIcons name={cfg.icon as MCIconName} size={24} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[ps.planName, { color: colors.foreground }]}>{cfg.name}</Text>
          <Text style={[ps.planDesc, { color: colors.mutedForeground }]}>{cfg.description}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[ps.planPrice, { color: colors.primary }]}>{cfg.price}</Text>
          {!isFree && <Text style={[ps.planPer, { color: colors.mutedForeground }]}>per month</Text>}
        </View>
      </View>

      {/* Features */}
      <View style={ps.features}>
        {cfg.features.map((f) => (
          <View key={f} style={ps.featureRow}>
            <MaterialCommunityIcons
              name={FEATURE_ICON[f] ?? "check-circle"}
              size={15}
              color={colors.primary}
            />
            <Text style={[ps.featureText, { color: colors.foreground }]}>{f}</Text>
          </View>
        ))}
      </View>

      {/* CTA */}
      {isActive ? (
        <View style={[ps.ctaBtn, { backgroundColor: colors.primary + "20" }]}>
          <MaterialCommunityIcons name="check-circle" size={16} color={colors.primary} />
          <Text style={[ps.ctaText, { color: colors.primary }]}>Current plan</Text>
        </View>
      ) : isFree ? null : (
        <TouchableOpacity
          style={[ps.ctaBtn, { backgroundColor: colors.primary }, isLoading && { opacity: 0.7 }]}
          onPress={() => onSelect(price?.id ?? null)}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <MaterialCommunityIcons name="crown" size={16} color="#000" />
              <Text style={[ps.ctaText, { color: "#000" }]}>
                Subscribe · {cfg.price}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function SubscriptionModal({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { tier, isPaid, refreshSubscription } = useSubscription();

  const [products, setProducts] = useState<StripeProduct[]>([]);
  const [loadingTier, setLoadingTier] = useState<SubscriptionTier | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  // Find product by tier metadata
  const productForTier = useCallback(
    (t: SubscriptionTier) =>
      products.find((p) => p.metadata?.tier === t) ?? null,
    [products]
  );

  useEffect(() => {
    if (visible) {
      fetchStripeProducts().then(setProducts);
    }
  }, [visible]);

  const handleSubscribe = async (selectedTier: SubscriptionTier) => {
    if (!user?.id || !user.email) {
      Alert.alert(
        "Sign in required",
        "Please sign in to subscribe.",
      );
      return;
    }

    const product = productForTier(selectedTier);
    const priceId = product?.prices[0]?.id;
    if (!priceId) {
      Alert.alert("Unavailable", "This plan is temporarily unavailable. Please try again later.");
      return;
    }

    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setLoadingTier(selectedTier);
    try {
      const opened = await startCheckout({
        priceId,
        userId: user.id,
        email: user.email,
      });

      if (!opened) {
        Alert.alert("Error", "Could not open checkout. Please try again.");
      }
      // Subscription status will refresh automatically when app returns to foreground
    } finally {
      setLoadingTier(null);
    }
  };

  const handleManageBilling = async () => {
    if (!user?.id) return;
    setPortalLoading(true);
    try {
      const opened = await openBillingPortal({ userId: user.id });
      if (!opened) {
        Alert.alert("Error", "Could not open billing portal. Please try again.");
      }
    } finally {
      setPortalLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!user?.id) return;
    await refreshSubscription(user.id);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[ms.root, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View
          style={[
            ms.header,
            { borderBottomColor: colors.border, paddingTop: insets.top + 12 },
          ]}
        >
          <TouchableOpacity onPress={onClose} style={ms.closeBtn}>
            <Text style={[ms.closeBtnText, { color: colors.mutedForeground }]}>Close</Text>
          </TouchableOpacity>
          <Text style={[ms.headerTitle, { color: colors.foreground }]}>Choose Your Plan</Text>
          <TouchableOpacity onPress={handleRefresh} style={ms.closeBtn}>
            <Text style={[ms.closeBtnText, { color: colors.primary, textAlign: "right" }]}>Refresh</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[
            ms.scroll,
            { paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={[ms.hero, { backgroundColor: colors.primary + "10" }]}>
            <MaterialCommunityIcons name="car-multiple" size={40} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[ms.heroTitle, { color: colors.foreground }]}>
                Convoy Navigator
              </Text>
              <Text style={[ms.heroSub, { color: colors.mutedForeground }]}>
                Subscribe on the web — no App Store fees, your money goes directly to keeping the convoy moving.
              </Text>
            </View>
          </View>

          {/* Plan cards */}
          {TIER_ORDER.filter((t) => t !== "free").map((t) => (
            <PlanCard
              key={t}
              tier={t}
              product={productForTier(t)}
              isActive={tier === t}
              isLoading={loadingTier === t}
              onSelect={() => handleSubscribe(t)}
            />
          ))}

          {/* Free plan reference */}
          <PlanCard
            key="free"
            tier="free"
            product={null}
            isActive={tier === "free"}
            isLoading={false}
            onSelect={() => {}}
          />

          {/* Manage billing */}
          {isPaid && (
            <TouchableOpacity
              style={[ms.portalBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={handleManageBilling}
              disabled={portalLoading}
              activeOpacity={0.8}
            >
              {portalLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <MaterialCommunityIcons name="cog" size={18} color={colors.mutedForeground} />
                  <Text style={[ms.portalText, { color: colors.mutedForeground }]}>
                    Manage billing & cancel subscription
                  </Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={colors.mutedForeground} />
                </>
              )}
            </TouchableOpacity>
          )}

          <Text style={[ms.legalText, { color: colors.mutedForeground }]}>
            Subscriptions auto-renew monthly. Cancel any time via the billing portal. Payments are processed securely by Stripe. Payable in GBP.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const ps = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 18,
    gap: 14,
    overflow: "hidden",
  },
  popularBadge: {
    position: "absolute",
    top: 14,
    right: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  popularText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#000",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  planName: {
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  planDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  planPrice: {
    fontSize: 20,
    fontWeight: "800",
    fontFamily: "Inter_700Bold",
  },
  planPer: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  features: {
    gap: 8,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
});

const ms = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  closeBtn: { minWidth: 60 },
  closeBtnText: { fontSize: 16, fontFamily: "Inter_400Regular" },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 14,
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  portalBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  portalText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  legalText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
    textAlign: "center",
    paddingHorizontal: 8,
  },
});
