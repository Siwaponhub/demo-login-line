import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
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

  // ค่าธีมล่าสุดที่ "ตรงกับ DB" (ไม่ต้องเขียนกลับ) — สำหรับ user นี้
  const inSyncWithDbRef = useRef({ userId: null, theme: null });

  // Reflect theme → <html data-theme> + localStorage cache
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    writeLocal(theme);
  }, [theme]);

  // === STEP 1: หลัง login → เช็ค DB ก่อนเสมอ ถ้ามีค่าธีมใช้จาก DB ===
  useEffect(() => {
    let cancelled = false;
    const uid = user?.userId;
    if (!uid) {
      inSyncWithDbRef.current = { userId: null, theme: null };
      return;
    }

    (async () => {
      try {
        setSyncing(true);
        const snap = await getDoc(doc(db, "users", uid));
        if (cancelled) return;

        const remote = snap.exists() ? snap.data()?.theme : null;

        if (remote && isValidTheme(remote)) {
          // DB มีค่า → ใช้จาก DB
          inSyncWithDbRef.current = { userId: uid, theme: remote };
          setThemeState(remote);
        } else {
          // DB ไม่มี → อัปโหลดค่า local ปัจจุบันขึ้นไป (migrate ครั้งเดียว)
          await setDoc(doc(db, "users", uid), { theme }, { merge: true });
          inSyncWithDbRef.current = { userId: uid, theme };
        }
      } catch (err) {
        console.error("theme sync failed", err);
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // เช็ค DB ใหม่ทุกครั้งที่ user เปลี่ยน (login/logout/สลับบัญชี)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

  // === STEP 2: เมื่อ user เปลี่ยนธีม → เขียนกลับ DB (ข้าม no-op write) ===
  useEffect(() => {
    const uid = user?.userId;
    if (!uid) return;

    const synced = inSyncWithDbRef.current;
    // ยังโหลด DB ไม่เสร็จ → ยังไม่เขียน (กัน race overwrite)
    if (synced.userId !== uid) return;
    // ค่าใน DB ตรงกับค่าปัจจุบันอยู่แล้ว → ไม่ต้องเขียน
    if (synced.theme === theme) return;

    (async () => {
      try {
        await setDoc(doc(db, "users", uid), { theme }, { merge: true });
        inSyncWithDbRef.current = { userId: uid, theme };
      } catch (err) {
        console.error("theme persist failed", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, user?.userId]);

  const setTheme = (next) => {
    if (isValidTheme(next)) setThemeState(next);
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
