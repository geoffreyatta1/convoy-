import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import { fetchSubscriptionStatus } from "@/services/stripe";

// ─── Tiers ────────────────────────────────────────────────────────────────────

export type SubscriptionTier = "free" | "convenience" | "roadtrip";

export interface TierConfig {
  name: string;
  maxMembers: number;
  price: string;
  description: string;
  icon: string;
  features: string[];
}

export const TIER_CONFIG: Record<SubscriptionTier, TierConfig> = {
  free: {
    name: "Free",
    maxMembers: 3,
    price: "£0",
    description: "Convoys up to 3 vehicles",
    icon: "car",
    features: [
      "Up to 3 vehicles per convoy",
      "Apple Maps navigation",
      "Gap warnings",
      "Hazard reporting",
    ],
  },
  convenience: {
    name: "Convenience",
    maxMembers: 9,
    price: "£3.99/mo",
    description: "Convoys up to 9 vehicles",
    icon: "car-multiple",
    features: [
      "Up to 9 vehicles per convoy",
      "Private PTT walkie-talkie",
      "AI voice assistant",
      "Navigation voice guidance",
      "Everything in Free",
    ],
  },
  roadtrip: {
    name: "Roadtrip",
    maxMembers: Infinity,
    price: "£6.99/mo",
    description: "Unlimited vehicles + priority support",
    icon: "map-marker-path",
    features: [
      "Unlimited vehicles",
      "Priority support",
      "Early feature access",
      "Everything in Convenience",
    ],
  },
};

const STORAGE_KEY = "@convoy_subscription";

// ─── Context ──────────────────────────────────────────────────────────────────

interface SubscriptionContextValue {
  tier: SubscriptionTier;
  config: TierConfig;
  isPaid: boolean;
  isLoading: boolean;
  canAddMember: (currentCount: number) => boolean;
  /** Refresh subscription status from the server (call after checkout returns). */
  refreshSubscription: (userId: string) => Promise<void>;
  /** Dev-only: force a tier for UI testing */
  setTier: (tier: SubscriptionTier) => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [tier, setTierState] = useState<SubscriptionTier>("free");
  const [isLoading, setIsLoading] = useState(false);
  const userIdRef = useRef<string | null>(null);

  // Load locally-cached tier on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored && stored in TIER_CONFIG) {
          setTierState(stored as SubscriptionTier);
        }
      })
      .catch(() => {});
  }, []);

  const refreshSubscription = useCallback(async (userId: string) => {
    userIdRef.current = userId;
    setIsLoading(true);
    try {
      const status = await fetchSubscriptionStatus(userId);
      if (status?.tier && status.tier in TIER_CONFIG) {
        const t = status.tier as SubscriptionTier;
        setTierState(t);
        await AsyncStorage.setItem(STORAGE_KEY, t).catch(() => {});
      }
    } catch {
      // Keep cached tier on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Re-check subscription when app comes back to foreground (after checkout)
  useEffect(() => {
    const handler = (state: AppStateStatus) => {
      if (state === "active" && userIdRef.current) {
        refreshSubscription(userIdRef.current);
      }
    };
    const sub = AppState.addEventListener("change", handler);
    return () => sub.remove();
  }, [refreshSubscription]);

  const setTier = useCallback(async (t: SubscriptionTier) => {
    setTierState(t);
    await AsyncStorage.setItem(STORAGE_KEY, t).catch(() => {});
  }, []);

  const config = TIER_CONFIG[tier];

  const canAddMember = useCallback(
    (currentCount: number) => currentCount < config.maxMembers,
    [config.maxMembers]
  );

  return (
    <SubscriptionContext.Provider
      value={{
        tier,
        config,
        isPaid: tier !== "free",
        isLoading,
        canAddMember,
        refreshSubscription,
        setTier,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used within SubscriptionProvider");
  return ctx;
}
