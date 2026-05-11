import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import { getConvoyWsClient } from "./convoy-ws";

// ─── Constants ────────────────────────────────────────────────────────────────

export const BACKGROUND_LOCATION_TASK = "convoy-background-location";

const STORAGE_KEY = "@convoy_session";

// ─── Task Definition ──────────────────────────────────────────────────────────

/**
 * Must be called at module level (not inside a component) so that
 * TaskManager can register the handler before the first location event fires.
 * Call this once near the entry point of the app.
 * Safe to call multiple times — skips registration if already defined.
 */
export function defineBackgroundLocationTask() {
  if (Platform.OS === "web") return;
  if (TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) return;
  TaskManager.defineTask(
    BACKGROUND_LOCATION_TASK,
    async ({
      data,
      error,
    }: TaskManager.TaskManagerTaskBody<{ locations: Location.LocationObject[] }>) => {
      if (error) return;
      const locations = data?.locations;
      if (!locations?.length) return;

      const loc = locations[locations.length - 1];
      if (!loc) return;

      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!stored) return;
        const session = JSON.parse(stored) as {
          code: string;
          vehicles: Array<{
            id: string;
            name: string;
            emoji: string;
            color: string;
            isLeader: boolean;
            isMe: boolean;
          }>;
          isActive: boolean;
        };
        if (!session.isActive) return;

        const me = session.vehicles.find((v) => v.isMe);
        if (!me) return;

        getConvoyWsClient().sendLocation(
          me.id,
          me.name,
          me.emoji,
          me.color,
          me.isLeader,
          loc.coords.latitude,
          loc.coords.longitude,
          loc.coords.heading ?? undefined,
          loc.coords.speed != null ? loc.coords.speed * 2.237 : undefined,
        );
      } catch {
        // Silently ignore — task handler errors must not crash the process
      }
    },
  );
}

// ─── Lifecycle helpers ─────────────────────────────────────────────────────────

/**
 * Start receiving location updates in the background.
 * Requires foreground AND background location permissions to already be granted.
 * Safe to call even when the task is already running.
 */
export async function startBackgroundLocationUpdates(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    );
    if (alreadyRunning) return;
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 5,
      timeInterval: 3000,
      // Android requires a foreground service with a notification to sustain
      // background location updates beyond a short burst.
      ...(Platform.OS === "android" && {
        foregroundService: {
          notificationTitle: "Convoy active",
          notificationBody: "Sharing your location with convoy members.",
          notificationColor: "#06b6d4",
        },
      }),
      // On iOS, pausesUpdatesAutomatically must be false or iOS may cut updates
      // when it decides the user has stopped moving.
      pausesUpdatesAutomatically: false,
    });
  } catch {
    // If permissions aren't sufficient the start will throw; allow graceful
    // fallback to foreground-only tracking (watchPositionAsync).
  }
}

/**
 * Stop background location updates.
 * Safe to call even when the task is not running.
 */
export async function stopBackgroundLocationUpdates(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const running = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    );
    if (running) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch {
    // Ignore — worst case the task keeps running until the OS cleans it up
  }
}
