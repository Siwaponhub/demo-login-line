/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useAuth } from "./AuthContext";

export const THEMES = [
  { id: "emerald", name: "LINE Emerald", desc: "เขียวสดใส โทนหลักของ LINE", swatch: ["#06c755", "#2374ab"] },
  { id: "ocean", name: "Ocean Breeze", desc: "ฟ้าเย็นสบายตา เน้นมืออาชีพ", swatch: ["#2374ab", "#1098ad"] },
  { id: "sunset", name: "Sunset Glow", desc: "ส้มอุ่นอบอุ่น เพิ่มพลังบวก", swatch: ["#f59f00", "#e8590c"] },
  { id: "violet", name: "Violet Dream", desc: "ม่วงทันสมัย ดูสร้างสรรค์", swatch: ["#845ef7", "#5f3dc4"] },
  { id: "midnight", name: "Midnight", desc: "โหมดมืดสบายตายามค่ำคืน", swatch: ["#0f1726", "#22d3ee"] },
];

const CACHE_KEY = "app.theme";
const DEFAULT_THEME = "emerald";
const isValidTheme = (id) => THEMES.some((t) => t.id === id);

// localStorage ใช้แค่เป็น "cache" เพื่อไม่ให้หน้ากระพริบตอน reload
// แหล่งความจริงของธีมคือ DB เท่านั้น
const readCache = () => {
  try {
    const v = localStorage.getItem(CACHE_KEY);
    return isValidTheme(v) ? v : null;
  } catch {
    return null;
  }
};
const writeCache = (id) => {
  try {
    localStorage.setItem(CACHE_KEY, id);
  } catch {
    /* ignore */
  }
};

const ThemeContext = createContext({
  theme: DEFAULT_THEME,
  preview: null,
  setPreview: () => {},
  saveTheme: async () => {},
  themes: THEMES,
  syncing: false,
});

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  // theme = ค่าที่ commit แล้ว (มาจาก DB หรือ default)
  const [theme, setThemeState] = useState(() => readCache() || DEFAULT_THEME);
  // preview = ค่าที่ผู้ใช้กำลังเลือกอยู่แต่ยังไม่บันทึก (null = ไม่มี preview)
  const [preview, setPreview] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // ธีมที่แสดงผลจริง: ถ้ามี preview ก็ใช้ preview ก่อน
  const effective = preview && isValidTheme(preview) ? preview : theme;

  // Reflect to <html data-theme>
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", effective);
  }, [effective]);

  // เช็ค DB ก่อนเสมอเมื่อ user เปลี่ยน — ถ้ามีค่าธีมก็ใช้จาก DB
  useEffect(() => {
    let cancelled = false;
    const uid = user?.userId;
    if (!uid) return;

    (async () => {
      try {
        setSyncing(true);
        const snap = await getDoc(doc(db, "users", uid));
        if (cancelled) return;

        const remote = snap.exists() ? snap.data()?.theme : null;

        if (remote && isValidTheme(remote)) {
          setThemeState(remote);
          writeCache(remote);
        }
        // ถ้า DB ไม่มี → ไม่ทำอะไร, ไม่ migrate ขึ้น (รอ user กดบันทึก)
        // ทิ้ง preview ใดๆ ที่อาจค้างอยู่
        setPreview(null);
      } catch (err) {
        console.error("theme sync failed", err);
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.userId]);

  // บันทึกธีม → เขียน DB + commit ค่าใหม่ + เคลียร์ preview
  const saveTheme = useCallback(
    async (idArg) => {
      const id = idArg ?? preview ?? theme;
      if (!isValidTheme(id)) return false;

      if (user?.userId) {
        await setDoc(doc(db, "users", user.userId), { theme: id }, { merge: true });
      }
      setThemeState(id);
      writeCache(id);
      setPreview(null);
      return true;
    },
    [preview, theme, user?.userId]
  );

  const value = useMemo(
    () => ({
      theme,
      preview,
      setPreview,
      saveTheme,
      themes: THEMES,
      syncing,
    }),
    [theme, preview, saveTheme, syncing]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
