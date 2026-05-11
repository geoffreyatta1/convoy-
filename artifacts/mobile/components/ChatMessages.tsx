import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useEffect } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ConvoyMessage } from "@/context/ConvoyContext";
import { useColors } from "@/hooks/useColors";

interface ChatMessagesProps {
  messages: ConvoyMessage[];
  myVehicleId?: string;
}

function MessageItem({
  msg,
  isMe,
  colors,
}: {
  msg: ConvoyMessage;
  isMe: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  if (msg.type === "system") {
    return (
      <View style={styles.systemRow}>
        <Text style={[styles.systemText, { color: colors.mutedForeground }]}>
          {msg.content}
        </Text>
      </View>
    );
  }

  const time = new Date(msg.timestamp);
  const timeStr = `${time.getHours()}:${time.getMinutes().toString().padStart(2, "0")}`;

  return (
    <View style={[styles.msgRow, isMe ? styles.msgRowRight : styles.msgRowLeft]}>
      {!isMe && (
        <View style={[styles.avatar, { backgroundColor: colors.border }]}>
          <Text style={[styles.avatarText, { color: colors.foreground }]}>
            {msg.vehicleName[0]}
          </Text>
        </View>
      )}
      <View style={styles.msgContent}>
        {!isMe && (
          <Text style={[styles.senderName, { color: colors.mutedForeground }]}>
            {msg.vehicleName}
          </Text>
        )}
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: isMe ? colors.primary : colors.card,
              borderColor: isMe ? colors.primary : colors.border,
            },
          ]}
        >
          {msg.type === "audio" && (
            <Ionicons
              name="mic"
              size={12}
              color={isMe ? "#fff" : colors.accent}
              style={styles.audioIcon}
            />
          )}
          <Text
            style={[
              styles.bubbleText,
              { color: isMe ? "#fff" : colors.foreground },
            ]}
          >
            {msg.content}
          </Text>
        </View>
        <Text style={[styles.timeText, { color: colors.mutedForeground }]}>
          {timeStr}
        </Text>
      </View>
    </View>
  );
}

export default function ChatMessages({ messages, myVehicleId }: ChatMessagesProps) {
  const colors = useColors();
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  return (
    <FlatList
      ref={flatListRef}
      data={messages}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <MessageItem
          msg={item}
          isMe={item.vehicleId === myVehicleId}
          colors={colors}
        />
      )}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      scrollEnabled={!!messages.length}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 12,
    gap: 8,
  },
  systemRow: {
    alignItems: "center",
    paddingVertical: 4,
  },
  systemText: {
    fontSize: 11,
    fontStyle: "italic",
  },
  msgRow: {
    flexDirection: "row",
    gap: 8,
    maxWidth: "85%",
  },
  msgRowLeft: {
    alignSelf: "flex-start",
  },
  msgRowRight: {
    alignSelf: "flex-end",
    flexDirection: "row-reverse",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: "600",
  },
  msgContent: {
    gap: 2,
  },
  senderName: {
    fontSize: 10,
    fontWeight: "600",
    marginLeft: 4,
  },
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  audioIcon: {
    marginRight: 2,
  },
  bubbleText: {
    fontSize: 13,
    lineHeight: 18,
  },
  timeText: {
    fontSize: 10,
    marginLeft: 4,
  },
});
