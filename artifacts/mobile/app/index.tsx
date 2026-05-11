import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { useConvoy } from "@/context/ConvoyContext";

export default function IndexScreen() {
  const { session: authSession, isLoading } = useAuth();
  const { session: convoySession } = useConvoy();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!authSession) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (convoySession) {
    return <Redirect href="/(tabs)/map" />;
  }

  return <Redirect href="/(tabs)/convoys" />;
}
