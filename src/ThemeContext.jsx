import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useAuth } from "./AuthContext";

export const THEMES = [
  {
    id: "emerald",
    name: "LINE Emerald",
    desc: "เขียวสดใส โทนหลักของ LINE",
    swatch: ["#06c755", "#2374ab"],
  },
  {
    id: "ocean",
    name: "Ocean Breeze",
    desc: "ฟ้าเย็นสบายตา เน้นมืออาชีพ",
    swatch: ["#2374ab", "#1098ad"],
  },
  {
    id: "sunset",
    name: "Sunset Glow",
    desc: "ส้มอุ่นอบอุ่น เพิ่มพลังบวก",
    swatch: ["#f59f00", "#e8590c"],
  },
  {
    id: "violet",
    name: "Violet Dream",
    desc: "ม่วงทันสมัย ดูสร้างสรรค์",
    swatch: ["#845ef7", "#5f3dc4"],
  },
  {
    id: "midnight",
    name: "Midnight",
    desc: "โหมดมืดสบายตายามค่ำคืน",
    swatch: ["#0f1726", "#22d3ee"],
  },
];

const STORAGE_KEY = "app.theme";
const DEFAULT_THEME = "emerald";

const isValidTheme = (id) => THEMES.some((t) => t.id === id);

const readLocal = () => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isValidTheme(v) ? v : null;
  } catch {
    return null;
  }
};

const writeLocal = (id) => {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
};

const ThemeContext = createContext({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  themes: THEMES,
  syncing: false,
});

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState(() => readLocal() || DEFAULT_THEME);
  const [syncing, setSyncing] = useState(false);
  // tracks whether the next theme change should be persisted to Firestore
  // (suppress when the change came FROM Firestore on login)
  const remoteHydratedFor = useRef(null);

  // Reflect theme onto <html> + localStorage cache
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    writeLocal(theme);
  }, [theme]);

  // When the logged-in user changes, pull their saved theme from Firestore.
  // Falls back to whatever is currently set if there's no remote preference yet.
  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      if (!user?.userId) {
        remoteHydratedFor.current = null;
        return;
      }
      try {
        setSyncing(true);
        const snap = await getDoc(doc(db, "users", user.userId));
        if (cancelled) return;
        const remote = snap.exists() ? snap.data()?.theme : null;
        if (remote && isValidTheme(remote)) {
          remoteHydratedFor.current = user.userId;
          setThemeState(remote);
        } else {
          // No remote pref yet — push the current local choice up so the
          // user keeps using it on other devices.
          remoteHydratedFor.current = user.userId;
          await setDoc(
            doc(db, "users", user.userId),
            { theme },
            { merge: true }
          );
        }
      } catch (err) {
        console.error("theme sync failed", err);
      } finally {
        if (!cancelled) setSyncing(false);
      }
    };
    sync();
    return () => {
      cancelled = true;
    };
    // We intentionally only re-run when the user identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

  // Persist the user's choice up to Firestore whenever theme changes after hydration.
  useEffect(() => {
    if (!user?.userId) return;
    // Skip the first change that comes from remote hydration.
    if (remoteHydratedFor.current !== user.userId) return;
    const persist = async () => {
      try {
        await setDoc(
          doc(db, "users", user.userId),
          { theme },
          { merge: true }
        );
      } catch (err) {
        console.error("theme persist failed", err);
      }
    };
    persist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, user?.userId]);

  const setTheme = (next) => {
    if (!isValidTheme(next)) return;
    setThemeState(next);
  };

  const value = useMemo(
    () => ({ theme, setTheme, themes: THEMES, syncing }),
    [theme, syncing]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
