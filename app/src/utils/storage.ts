import { Platform } from 'react-native';

// Cross-platform resilient storage utility for user profile data
export interface UserProfile {
  name: string;
  birthDate: string; // YYYY-MM-DD
  age: number;
  avatarCharacterId: number;
  avatarUrl: string;
  completed: boolean;
  createdAt: string;
  syncedToMongo?: boolean;
  coins: number; // Starting: 1000
  xp: number; // Starting: 0
  level: number; // Starting: 1
  wins: number; // Starting: 0
  losses: number; // Starting: 0
}

export const getDetectiveRank = (level: number = 1): { title: string; badge: string; color: string } => {
  if (level >= 10) return { title: 'Legendary Sherlock', badge: '👑', color: '#F59E0B' };
  if (level >= 7) return { title: 'Chief Inspector', badge: '🎖️', color: '#EC4899' };
  if (level >= 5) return { title: 'Mastermind', badge: '🔮', color: '#8B5CF6' };
  if (level >= 3) return { title: 'Senior Sleuth', badge: '🥇', color: '#38BDF8' };
  if (level >= 2) return { title: 'Junior Detective', badge: '🥈', color: '#34D399' };
  return { title: 'Rookie Sleuth', badge: '🥉', color: '#94A3B8' };
};

const PROFILE_STORAGE_KEY = '@guess_who_user_profile_v1';

// In-memory fallback if localStorage / native storage is unavailable
let memoryProfileCache: UserProfile | null = null;

export const loadUserProfile = async (): Promise<UserProfile | null> => {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window?.localStorage) {
      const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Ensure defaults for coins & level
        parsed.coins = parsed.coins !== undefined ? parsed.coins : 1000;
        parsed.xp = parsed.xp !== undefined ? parsed.xp : 0;
        parsed.level = parsed.level !== undefined ? parsed.level : 1;
        parsed.wins = parsed.wins !== undefined ? parsed.wins : 0;
        parsed.losses = parsed.losses !== undefined ? parsed.losses : 0;
        memoryProfileCache = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed reading profile from localStorage:', err);
  }
  if (memoryProfileCache) {
    memoryProfileCache.coins = memoryProfileCache.coins !== undefined ? memoryProfileCache.coins : 1000;
    memoryProfileCache.xp = memoryProfileCache.xp !== undefined ? memoryProfileCache.xp : 0;
    memoryProfileCache.level = memoryProfileCache.level !== undefined ? memoryProfileCache.level : 1;
    memoryProfileCache.wins = memoryProfileCache.wins !== undefined ? memoryProfileCache.wins : 0;
    memoryProfileCache.losses = memoryProfileCache.losses !== undefined ? memoryProfileCache.losses : 0;
  }
  return memoryProfileCache;
};

export const saveUserProfile = async (profile: UserProfile): Promise<boolean> => {
  try {
    memoryProfileCache = profile;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window?.localStorage) {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    }
    return true;
  } catch (err) {
    console.warn('Failed writing profile to storage:', err);
    return false;
  }
};

export const clearUserProfile = async (): Promise<void> => {
  try {
    memoryProfileCache = null;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window?.localStorage) {
      window.localStorage.removeItem(PROFILE_STORAGE_KEY);
    }
  } catch (err) {
    console.warn('Failed clearing profile storage:', err);
  }
};
