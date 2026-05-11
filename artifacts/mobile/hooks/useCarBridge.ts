/**
 * useCarBridge — syncs ConvoyContext state to CarPlay and Android Auto.
 *
 * This hook runs inside the ConvoyProvider and pushes UI updates to the
 * car display whenever the convoy state changes. It also wires the
 * talk callbacks so the driver can use the in-car controls.
 *
 * CarPlay compliance (Feb 2026 Developer Guide):
 *  - registerNavigationCancelledCallback wires mapTemplateDidCancelNavigation
 *    so the app clears convoy navigation when the car's own nav takes over.
 */

import { useMemo, useEffect } from "react";

import { useConvoy } from "@/context/ConvoyContext";
import {
  registerCarPlayCallbacks,
  registerNavigationCancelledCallback,
  updateCarPlayUI,
  clearCarPlayUI,
} from "@/services/carplay";
import {
  registerAndroidAutoCallbacks,
  updateAndroidAutoUI,
} from "@/services/androidauto";
import { haversineMeters } from "@/services/routing";

export function useCarBridge() {
  const {
    session,
    isTalking,
    startTalking,
    stopTalking,
    gapWarnings,
    clearNavigation,
  } = useConvoy();

  // Register talk callbacks once
  useEffect(() => {
    registerCarPlayCallbacks(startTalking, stopTalking);
    registerAndroidAutoCallbacks(startTalking, stopTalking);
  }, [startTalking, stopTalking]);

  // Wire the navigation-cancelled callback so the car's built-in nav taking
  // over immediately clears the convoy navigation state on the app side.
  useEffect(() => {
    registerNavigationCancelledCallback(clearNavigation);
  }, [clearNavigation]);

  // Compute gap-warning vehicle list (id + name + distance to leader)
  const gapWarningVehicles = useMemo(() => {
    if (!session || gapWarnings.size === 0) return [];
    const leader = session.vehicles.find((v) => v.isLeader);
    if (!leader) return [];
    return session.vehicles
      .filter((v) => gapWarnings.has(v.id))
      .map((v) => ({
        id: v.id,
        name: v.name,
        distanceM: haversineMeters(
          v.location.latitude,
          v.location.longitude,
          leader.location.latitude,
          leader.location.longitude,
        ),
      }));
  }, [session, gapWarnings]);

  // When the convoy session ends while CarPlay is connected, show the idle screen
  useEffect(() => {
    if (session) return;
    clearCarPlayUI();
  }, [session]);

  // Push state updates to the car displays whenever convoy state changes
  useEffect(() => {
    if (!session) return;

    const nav = session.navigation;
    const currentStepIndex = nav?.currentStepIndex ?? 0;
    const currentStep =
      nav && currentStepIndex < nav.steps.length
        ? nav.steps[currentStepIndex]
        : undefined;

    // All remaining steps from currentStepIndex onward — used to build the
    // full upcoming-maneuver queue in CPNavigationSession.
    const upcomingSteps =
      nav && nav.steps.length > currentStepIndex
        ? nav.steps.slice(currentStepIndex).map((s: { instruction: string; distanceM: number; icon: string }) => ({
            instruction: s.instruction,
            distanceM: s.distanceM,
            icon: s.icon,
          }))
        : undefined;

    const state = {
      convoyName: session.name,
      code: session.code,
      vehicles: session.vehicles.map((v) => ({
        id: v.id,
        name: v.name,
        isLeader: v.isLeader,
        isMe: v.isMe,
        speed: v.location.speed,
        color: v.color,
      })),
      isTalking,
      destination: session.destination?.name,
      currentStep: currentStep
        ? {
            instruction: currentStep.instruction,
            distanceM: currentStep.distanceM,
            icon: currentStep.icon,
          }
        : undefined,
      currentStepIndex,
      upcomingSteps,
      gapWarningVehicles,
    };

    updateCarPlayUI(state);
    updateAndroidAutoUI(state);
  }, [session, isTalking, gapWarningVehicles]);
}
