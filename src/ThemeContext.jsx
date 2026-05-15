import { createContext, useContext, useEffect, useMemo, useState } from "react";

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

const ThemeContext = createContext({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  themes: THEMES,
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
    } catch {
      return DEFAULT_THEME;
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const value = useMemo(
    () => ({ theme, setTheme: setThemeState, themes: THEMES }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
