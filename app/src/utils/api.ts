// API sync helper for sending profile to backend / MongoDB
import { UserProfile } from './storage';

export const syncProfileWithBackend = async (
  backendUrl: string,
  profile: UserProfile
): Promise<{ success: boolean; message?: string }> => {
  try {
    const res = await fetch(`${backendUrl}/api/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    if (res.ok) {
      return { success: true };
    }
    const data = await res.json().catch(() => ({}));
    return { success: false, message: data.message || 'Server returned an error' };
  } catch (err: any) {
    // Local offline tolerance: if backend is unreachable, don't crash the user
    console.warn('Backend profile sync deferred (offline or server starting):', err?.message || err);
    return { success: false, message: 'Backend unreachable' };
  }
};
