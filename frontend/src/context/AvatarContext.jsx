/**
 * AvatarContext
 *
 * The profile picture is stored on the backend (/users/me/avatar), so it
 * survives refreshes and follows the user across browsers. localStorage keeps
 * a per-user copy only so the photo shows instantly while the API answers.
 *
 * The photo is (re)loaded whenever the logged-in user changes. Reading it only
 * once on mount was the old bug: at that moment the user was still unknown,
 * so the "guest" slot was read and the photo appeared to revert on refresh.
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import apiClient, { apiError } from "../api/client";
import { useAuth } from "./AuthContext";

const AvatarContext = createContext(null);

const cacheKey = (userId) => `fraudex-avatar-${userId}`;

function readCache(userId) {
  try { return localStorage.getItem(cacheKey(userId)); } catch { return null; }
}

function writeCache(userId, dataUrl) {
  try {
    if (dataUrl) localStorage.setItem(cacheKey(userId), dataUrl);
    else localStorage.removeItem(cacheKey(userId));
  } catch { /* storage unavailable — the server copy is the source of truth */ }
}

export function AvatarProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [avatar, setAvatarState] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) { setAvatarState(null); return; }
    let cancelled = false;
    const cached = readCache(userId);
    setAvatarState(cached);

    apiClient.get("/users/me/avatar")
      .then(async ({ data }) => {
        if (cancelled) return;
        if (data.avatar) {
          setAvatarState(data.avatar);
          writeCache(userId, data.avatar);
        } else if (cached) {
          // Photo saved by the old browser-only version: move it to the server.
          await apiClient.put("/users/me/avatar", { avatar: cached }).catch(() => {});
        } else {
          setAvatarState(null);
        }
      })
      .catch(() => { /* offline: keep showing the cached photo */ });

    return () => { cancelled = true; };
  }, [userId]);

  /** Save a data URL; resolves to an error message, or null on success. */
  const setAvatar = useCallback(async (dataUrl) => {
    if (!userId) return "Not logged in.";
    const previous = avatar;
    setAvatarState(dataUrl);
    setSaving(true);
    try {
      await apiClient.put("/users/me/avatar", { avatar: dataUrl });
      writeCache(userId, dataUrl);
      return null;
    } catch (e) {
      setAvatarState(previous);
      return apiError(e, "Could not save the photo.");
    } finally {
      setSaving(false);
    }
  }, [userId, avatar]);

  const clearAvatar = useCallback(async () => {
    if (!userId) return "Not logged in.";
    const previous = avatar;
    setAvatarState(null);
    try {
      await apiClient.delete("/users/me/avatar");
      writeCache(userId, null);
      return null;
    } catch (e) {
      setAvatarState(previous);
      return apiError(e, "Could not remove the photo.");
    }
  }, [userId, avatar]);

  return (
    <AvatarContext.Provider value={{ avatar, setAvatar, clearAvatar, saving }}>
      {children}
    </AvatarContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAvatar() {
  const ctx = useContext(AvatarContext);
  if (!ctx) throw new Error("useAvatar must be used inside <AvatarProvider>");
  return ctx;
}
