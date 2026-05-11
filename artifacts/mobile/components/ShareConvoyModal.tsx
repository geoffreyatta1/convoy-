/**
 * ShareConvoyModal — Share the convoy code + deep link via the native share sheet.
 *
 * Tapping "Share Invite" opens the OS share sheet so family members can tap
 * the link and join directly without typing the code manually.
 *
 * Deep link format: convoy://join/<CODE>
 * (requires the "convoy" URL scheme declared in app.json → scheme)
 */

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useConvoy } from "@/context/ConvoyContext";
import { useColors } from "@/hooks/useColors";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function ShareConvoyModal({ visible, onClose }: Props) {
  const colors = useColors();
  const { session } = useConvoy();
  const [copied, setCopied] = useState(false);

  if (!session) return null;

  const deepLink = `convoy://join/${session.code}`;

  const handleCopy = async () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    await Clipboard.setStringAsync(session.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share(
        {
          title: `Join "${session.name}" convoy`,
          message:
            `You're invited to join the "${session.name}" convoy on Convoy!\n\n` +
            `🚗 Convoy code: ${session.code}\n\n` +
            `Open the Convoy app and enter the code above, or tap the link below to join:\n` +
            `${deepLink}`,
          url: deepLink,
        },
        {
          subject: `Join "${session.name}" convoy`,
        }
      );
    } catch {}
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Invite to Convoy</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <View style={[styles.codeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.codeLabel, { color: colors.mutedForeground }]}>
              CONVOY CODE
            </Text>
            <Text style={[styles.codeText, { color: colors.foreground }]}>
              {session.code}
            </Text>
            <Text style={[styles.codeSub, { color: colors.mutedForeground }]}>
              {session.name}
            </Text>

            <TouchableOpacity
              onPress={handleCopy}
              style={[
                styles.copyBtn,
                {
                  backgroundColor: copied ? colors.success + "20" : colors.primary + "15",
                  borderColor: copied ? colors.success : colors.primary + "40",
                },
              ]}
            >
              <Ionicons
                name={copied ? "checkmark-circle" : "copy-outline"}
                size={16}
                color={copied ? colors.success : colors.primary}
              />
              <Text style={[styles.copyBtnText, { color: copied ? colors.success : colors.primary }]}>
                {copied ? "Copied!" : "Copy Code"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dividerRow}>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>
              or share via
            </Text>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </View>

          <TouchableOpacity
            style={[styles.shareBtn, { backgroundColor: colors.primary }]}
            onPress={handleShare}
          >
            <MaterialCommunityIcons name="share-variant" size={20} color="#fff" />
            <Text style={styles.shareBtnText}>Share Invite Link</Text>
          </TouchableOpacity>

          <View style={styles.infoBox}>
            <MaterialCommunityIcons name="information-outline" size={16} color={colors.mutedForeground} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              Family members tap the link to open Convoy and join automatically. Turn-by-turn
              navigation syncs to everyone once a destination is set.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    flex: 1,
    padding: 20,
    gap: 20,
  },
  codeCard: {
    alignItems: "center",
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    fontFamily: "Inter_700Bold",
  },
  codeText: {
    fontSize: 44,
    fontWeight: "800",
    letterSpacing: 6,
    fontFamily: "Inter_700Bold",
  },
  codeSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  copyBtnText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 54,
    borderRadius: 16,
  },
  shareBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
});
