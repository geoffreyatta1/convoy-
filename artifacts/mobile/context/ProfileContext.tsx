import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "@convoy_profile_v1";

export type VehicleType = "car" | "suv" | "truck" | "motorcycle" | "van";

export interface UserProfile {
  displayName: string;
  vehicleType: VehicleType;
}

const DEFAULT_PROFILE: UserProfile = {
  displayName: "My Vehicle",
  vehicleType: "car",
};

interface ProfileContextValue {
  profile: UserProfile;
  updateProfile: (partial: Partial<UserProfile>) => Promise<void>;
  isLoaded: boolean;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<UserProfile>;
          setProfile({ ...DEFAULT_PROFILE, ...parsed });
        }
      })
      .catch(() => {})
      .finally(() => setIsLoaded(true));
  }, []);

  const updateProfile = useCallback(async (partial: Partial<UserProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...partial };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return (
    <ProfileContext.Provider value={{ profile, updateProfile, isLoaded }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
