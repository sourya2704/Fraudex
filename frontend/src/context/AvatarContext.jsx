/**
 * AvatarContext
 *
 * Stores the user's profile picture as a base64 data-URL in localStorage.
 * No backend endpoint needed — works client-side.
 * Key is namespaced per user ID so different users get different avatars.
 */

import { createContext, useCallback, useContext, useState } from "react";
import { useAuth } from "./AuthContext";

const AvatarContext = createContext(null);

function avatarKey(userId) {
  return `fraudex-avatar-${userId || "guest"}`;
}

export function AvatarProvider({ children }) {
  const { user } = useAuth();
  const key = avatarKey(user?.id);

  const [avatar, setAvatarState] = useState(() => {
    try { return localStorage.getItem(key) || null; }
    catch { return null; }
  });

  const setAvatar = useCallback((dataUrl) => {
    try { localStorage.setItem(key, dataUrl); }
    catch { /* storage full — ignore */ }
    setAvatarState(dataUrl);
  }, [key]);

  const clearAvatar = useCallback(() => {
    try { localStorage.removeItem(key); }
    catch {}
    setAvatarState(null);
  }, [key]);

  return (
    <AvatarContext.Provider value={{ avatar, setAvatar, clearAvatar }}>
      {children}
    </AvatarContext.Provider>
  );
}

export function useAvatar() {
  const ctx = useContext(AvatarContext);
  if (!ctx) throw new Error("useAvatar must be used inside <AvatarProvider>");
  return ctx;
}
