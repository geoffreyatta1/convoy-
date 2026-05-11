import { Redirect, Stack } from "expo-router";

import { useAuth } from "@/context/AuthContext";

export default function AuthLayout() {
  const { session, isLoading } = useAuth();

  if (!isLoading && session) {
    return <Redirect href="/(tabs)/convoys" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
