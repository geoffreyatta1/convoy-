import { Ionicons } from "@expo/vector-icons";
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
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "@/lib/supabase";
import { useColors } from "@/hooks/useColors";

export default function SignUpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing fields", "Please fill in all fields.");
      return;
    }
    if (password !== confirm) {
      Alert.alert("Password mismatch", "Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      Alert.alert("Sign up failed", error.message);
    } else {
      Alert.alert(
        "Check your email",
        "We sent you a confirmation link. Click it to activate your account, then sign in.",
        [{ text: "OK", onPress: () => router.replace("/(auth)/sign-in") }]
      );
    }
  };

  const s = StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
    },
    backBtn: {
      position: "absolute",
      top: insets.top + 8,
      left: 16,
      zIndex: 10,
      padding: 8,
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
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="chevron-back" size={28} color={colors.foreground} />
      </TouchableOpacity>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.logo}>Convoy</Text>
        <Text style={s.tagline}>Create your account</Text>

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
          placeholder="At least 6 characters"
          placeholderTextColor={colors.mutedForeground}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
        />

        <Text style={s.label}>Confirm Password</Text>
        <TextInput
          style={s.input}
          placeholder="Re-enter password"
          placeholderTextColor={colors.mutedForeground}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
        />

        <Pressable style={s.btn} onPress={handleSignUp} disabled={loading}>
          {loading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Create Account</Text>}
        </Pressable>

        <View style={s.footer}>
          <Text style={s.footerText}>Already have an account?</Text>
          <Pressable onPress={() => router.replace("/(auth)/sign-in")}>
            <Text style={s.footerLink}>Sign In</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
