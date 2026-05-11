/**
 * SuggestStopModal — lets any convoy member search for a stop location
 * and broadcast it as a stop proposal to all other members.
 */
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { geocodeAddress, GeoResult } from "@/services/routing";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (name: string, location: { latitude: number; longitude: number }) => void;
}

export function SuggestStopModal({ visible, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await geocodeAddress(query.trim());
      setResults(res.slice(0, 6));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item: GeoResult) => {
    onSelect(item.name, { latitude: item.latitude, longitude: item.longitude });
    setQuery("");
    setResults([]);
    setSearched(false);
    onClose();
  };

  const handleClose = () => {
    setQuery("");
    setResults([]);
    setSearched(false);
    onClose();
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Suggest a Stop</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="close" size={22} color="#a1a1aa" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Search for a location and share it with your convoy.
          </Text>

          <View style={styles.searchRow}>
            <TextInput
              style={styles.input}
              placeholder="Search for a place…"
              placeholderTextColor="#71717a"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoFocus
            />
            <TouchableOpacity
              onPress={handleSearch}
              style={styles.searchBtn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <MaterialCommunityIcons name="magnify" size={20} color="#000" />
              )}
            </TouchableOpacity>
          </View>

          {searched && !loading && results.length === 0 && (
            <Text style={styles.empty}>No results found. Try a different search.</Text>
          )}

          <FlatList
            data={results}
            keyExtractor={(_, i) => String(i)}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.resultRow}
                onPress={() => handleSelect(item)}
              >
                <MaterialCommunityIcons name="map-marker" size={18} color="#f59e0b" style={styles.resultIcon} />
                <View style={styles.resultText}>
                  <Text style={styles.resultName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.resultDetail} numberOfLines={1}>
                    {item.displayName}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color="#52525b" />
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#1c1c1e",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  title: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    color: "#a1a1aa",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 16,
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    backgroundColor: "#27272a",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#ffffff",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  searchBtn: {
    backgroundColor: "#f59e0b",
    borderRadius: 12,
    width: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    color: "#71717a",
    fontSize: 14,
    textAlign: "center",
    marginVertical: 20,
    fontFamily: "Inter_400Regular",
  },
  list: {
    flexGrow: 0,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  resultIcon: {
    marginRight: 10,
    flexShrink: 0,
  },
  resultText: {
    flex: 1,
  },
  resultName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  resultDetail: {
    color: "#71717a",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  separator: {
    height: 1,
    backgroundColor: "#27272a",
  },
});
