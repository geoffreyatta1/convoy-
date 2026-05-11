import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "@/lib/supabase";
import { useColors } from "@/hooks/useColors";

export default function SignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      Alert.alert("Sign in failed", error.message);
    }
    // Auth state change in AuthContext triggers redirect automatically
  };

  const s = StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
    },
    scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 28 },
    logo: { fontSize: 36, fontWeight: "800", color: colors.primary, textAlign: "center", marginBottom: 6 },
    tagline: { fontSize: 15, color: colors.mutedForeground, textAlign: "center", marginBottom: 40 },
    label: { fontSize: 12, fontWeight: "600", color: colors.mutedForeground, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
    input: {
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.foreground,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 20,
    },
    btn: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 4,
    },
    btnText: { color: "#000", fontSize: 17, fontWeight: "700" },
    footer: { flexDirection: "row", justifyContent: "center", marginTop: 28, gap: 6 },
    footerText: { color: colors.mutedForeground, fontSize: 14 },
    footerLink: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  });

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.logo}>Convoy</Text>
        <Text style={s.tagline}>Family road trips, together</Text>

        <Text style={s.label}>Email</Text>
        <TextInput
          style={s.input}
          placeholder="you@example.com"
          placeholderTextColor={colors.mutedForeground}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <Text style={s.label}>Password</Text>
        <TextInput
          style={s.input}
          placeholder="••••••••"
          placeholderTextColor={colors.mutedForeground}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
        />

        <Pressable style={s.btn} onPress={handleSignIn} disabled={loading}>
          {loading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Sign In</Text>}
        </Pressable>

        <View style={s.footer}>
          <Text style={s.footerText}>Don't have an account?</Text>
          <Pressable onPress={() => router.push("/(auth)/sign-up")}>
            <Text style={s.footerLink}>Sign Up</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
