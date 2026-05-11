import { Linking } from "react-native";

const API_DOMAIN = process.env.EXPO_PUBLIC_DOMAIN ?? "";

function apiBase(): string {
  if (!API_DOMAIN) return "/api";
  return `https://${API_DOMAIN}/api`;
}

export interface StripePrice {
  id: string;
  unit_amount: number;
  currency: string;
  recurring?: { interval: string };
}

export interface StripeProduct {
  id: string;
  name: string;
  description: string | null;
  metadata: Record<string, string> | null;
  prices: StripePrice[];
}

/** Fetch all active Convoy subscription products from the API. */
export async function fetchStripeProducts(): Promise<StripeProduct[]> {
  try {
    const res = await fetch(`${apiBase()}/stripe/products`);
    if (!res.ok) return [];
    const data = (await res.json()) as { data: StripeProduct[] };
    return data.data ?? [];
  } catch {
    return [];
  }
}

/** Get the user's current subscription status from the API. */
export async function fetchSubscriptionStatus(
  userId: string
): Promise<{ tier: string } | null> {
  try {
    const res = await fetch(
      `${apiBase()}/stripe/subscription?userId=${encodeURIComponent(userId)}`
    );
    if (!res.ok) return null;
    return (await res.json()) as { tier: string };
  } catch {
    return null;
  }
}

/**
 * Create a Stripe Checkout session and open it in the device browser.
 * Returns true if the URL was successfully opened.
 */
export async function startCheckout(params: {
  priceId: string;
  userId: string;
  email: string;
}): Promise<boolean> {
  try {
    const baseUrl = API_DOMAIN
      ? `https://${API_DOMAIN}`
      : "https://convoy.app";

    const res = await fetch(`${apiBase()}/stripe/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        priceId: params.priceId,
        userId: params.userId,
        email: params.email,
        successUrl: `${baseUrl}/checkout/success`,
        cancelUrl: `${baseUrl}/checkout/cancel`,
      }),
    });

    if (!res.ok) return false;
    const data = (await res.json()) as { url?: string };
    if (!data.url) return false;

    await Linking.openURL(data.url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Open the Stripe Customer Portal so the user can manage/cancel their subscription.
 */
export async function openBillingPortal(params: {
  userId: string;
  returnUrl?: string;
}): Promise<boolean> {
  try {
    const baseUrl = API_DOMAIN
      ? `https://${API_DOMAIN}`
      : "https://convoy.app";

    const res = await fetch(`${apiBase()}/stripe/portal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: params.userId,
        returnUrl: params.returnUrl ?? baseUrl,
      }),
    });

    if (!res.ok) return false;
    const data = (await res.json()) as { url?: string };
    if (!data.url) return false;

    await Linking.openURL(data.url);
    return true;
  } catch {
    return false;
  }
}
