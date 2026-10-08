const PROFILES_KEY = 'dinoLearn_profiles';
const ACTIVE_KEY = 'dinoLearn_activeProfile';
const DEFAULT_PROFILE = 'Player 1';

export function getProfiles(): string[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [DEFAULT_PROFILE];
}

export function getActiveProfile(): string {
  try {
    const saved = localStorage.getItem(ACTIVE_KEY);
    if (saved) {
      const profiles = getProfiles();
      if (profiles.includes(saved)) return saved;
    }
  } catch {}
  return getProfiles()[0];
}

export function setActiveProfile(name: string) {
  try {
    localStorage.setItem(ACTIVE_KEY, name);
  } catch {}
}

export function addProfile(name: string): boolean {
  const profiles = getProfiles();
  const trimmed = name.trim();
  if (!trimmed || profiles.includes(trimmed)) return false;
  profiles.push(trimmed);
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  } catch {}
  return true;
}

export function removeProfile(name: string) {
  let profiles = getProfiles();
  profiles = profiles.filter((p) => p !== name);
  if (profiles.length === 0) profiles = [DEFAULT_PROFILE];
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
    // clean up profile data
    const prefix = `dinoLearn_${name}_`;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) keysToRemove.push(key);
    }
    for (const key of keysToRemove) localStorage.removeItem(key);
  } catch {}
  if (getActiveProfile() === name) {
    setActiveProfile(profiles[0]);
  }
}

export function profileKey(key: string): string {
  return `dinoLearn_${getActiveProfile()}_${key}`;
}
