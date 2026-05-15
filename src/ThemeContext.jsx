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
  { id: "liquid-glass", name: "Liquid Glass", desc: "กระจกใส เบลอแบบ iOS", swatch: ["#f8fbff", "#7dd3fc"] },
];

export const CUSTOM_THEME_ID = "custom";
export const DEFAULT_CUSTOM_THEME = {
  accent: "#06c755",
  accentStrong: "#04a346",
  accent2: "#2374ab",
  bg: "#f4f7fb",
  bgAlt: "#eef3f8",
  surface: "#ffffff",
  surfaceMute: "#f7f9fc",
  text: "#172033",
  textMuted: "#6c788a",
};

const CACHE_KEY = "app.theme";
const SETTINGS_CACHE_KEY = "app.theme.settings";
const DEFAULT_THEME = "emerald";
const CUSTOM_VAR_NAMES = [
  "--accent",
  "--accent-strong",
  "--accent-2",
  "--accent-soft",
  "--accent-shadow",
  "--hero-from",
  "--hero-to",
  "--hero-blob-a",
  "--hero-blob-b",
  "--bg",
  "--bg-radial",
  "--bg-grad-a",
  "--bg-grad-b",
  "--surface",
  "--surface-soft",
  "--surface-mute",
  "--border",
  "--border-strong",
  "--text",
  "--text-muted",
  "--text-faint",
  "--shadow-sm",
  "--shadow-md",
  "--shadow-lg",
  "--shadow-hero",
  "--topbar-bg",
  "--topbar-border",
];

const isValidTheme = (id) => id === CUSTOM_THEME_ID || THEMES.some((t) => t.id === id);
const isHex = (value) => /^#[0-9a-f]{6}$/i.test(value || "");
const normalizeColor = (value, fallback) => (isHex(value) ? value : fallback);
const hexToRgb = (hex) => {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
};
const rgba = (hex, alpha) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

function sanitizeCustomTheme(theme = {}) {
  return {
    accent: normalizeColor(theme.accent, DEFAULT_CUSTOM_THEME.accent),
    accentStrong: normalizeColor(theme.accentStrong, DEFAULT_CUSTOM_THEME.accentStrong),
    accent2: normalizeColor(theme.accent2, DEFAULT_CUSTOM_THEME.accent2),
    bg: normalizeColor(theme.bg, DEFAULT_CUSTOM_THEME.bg),
    bgAlt: normalizeColor(theme.bgAlt, DEFAULT_CUSTOM_THEME.bgAlt),
    surface: normalizeColor(theme.surface, DEFAULT_CUSTOM_THEME.surface),
    surfaceMute: normalizeColor(theme.surfaceMute, DEFAULT_CUSTOM_THEME.surfaceMute),
    text: normalizeColor(theme.text, DEFAULT_CUSTOM_THEME.text),
    textMuted: normalizeColor(theme.textMuted, DEFAULT_CUSTOM_THEME.textMuted),
  };
}

function customThemeVars(theme) {
  const t = sanitizeCustomTheme(theme);
  return {
    "--accent": t.accent,
    "--accent-strong": t.accentStrong,
    "--accent-2": t.accent2,
    "--accent-soft": rgba(t.accent, 0.14),
    "--accent-shadow": rgba(t.accent, 0.32),
    "--hero-from": t.accent,
    "--hero-to": t.accent2,
    "--hero-blob-a": t.accent,
    "--hero-blob-b": t.accent2,
    "--bg": t.bg,
    "--bg-radial": rgba(t.accent, 0.12),
    "--bg-grad-a": t.bg,
    "--bg-grad-b": t.bgAlt,
    "--surface": t.surface,
    "--surface-soft": rgba(t.surface, 0.92),
    "--surface-mute": t.surfaceMute,
    "--border": rgba(t.text, 0.16),
    "--border-strong": rgba(t.text, 0.22),
    "--text": t.text,
    "--text-muted": t.textMuted,
    "--text-faint": rgba(t.text, 0.54),
    "--shadow-sm": `0 8px 24px ${rgba(t.text, 0.06)}`,
    "--shadow-md": `0 18px 40px ${rgba(t.text, 0.08)}`,
    "--shadow-lg": `0 24px 50px ${rgba(t.text, 0.14)}`,
    "--shadow-hero": `0 24px 60px ${rgba(t.accent, 0.28)}`,
    "--topbar-bg": rgba(t.surface, 0.9),
    "--topbar-border": rgba(t.text, 0.12),
  };
}

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
const readSettingsCache = () => {
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      customTheme: sanitizeCustomTheme(parsed.customTheme),
      backgroundImage: parsed.backgroundImage || "",
    };
  } catch {
    return {};
  }
};
const writeCache = ({ theme, customTheme, backgroundImage }) => {
  try {
    localStorage.setItem(CACHE_KEY, theme);
    localStorage.setItem(
      SETTINGS_CACHE_KEY,
      JSON.stringify({ customTheme: sanitizeCustomTheme(customTheme), backgroundImage: backgroundImage || "" })
    );
  } catch {
    /* ignore */
  }
};

const ThemeContext = createContext({
  theme: DEFAULT_THEME,
  preview: null,
  setPreview: () => {},
  customTheme: DEFAULT_CUSTOM_THEME,
  previewCustomTheme: null,
  setPreviewCustomTheme: () => {},
  backgroundImage: "",
  previewBackgroundImage: null,
  setPreviewBackgroundImage: () => {},
  saveTheme: async () => {},
  themes: THEMES,
  syncing: false,
});

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const cachedSettings = readSettingsCache();
  // theme = ค่าที่ commit แล้ว (มาจาก DB หรือ default)
  const [theme, setThemeState] = useState(() => readCache() || DEFAULT_THEME);
  const [customTheme, setCustomThemeState] = useState(() =>
    sanitizeCustomTheme(cachedSettings.customTheme)
  );
  const [backgroundImage, setBackgroundImageState] = useState(() => cachedSettings.backgroundImage || "");
  // preview = ค่าที่ผู้ใช้กำลังเลือกอยู่แต่ยังไม่บันทึก (null = ไม่มี preview)
  const [preview, setPreview] = useState(null);
  const [previewCustomTheme, setPreviewCustomTheme] = useState(null);
  const [previewBackgroundImage, setPreviewBackgroundImage] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // ธีมที่แสดงผลจริง: ถ้ามี preview ก็ใช้ preview ก่อน
  const effective = preview && isValidTheme(preview) ? preview : theme;
  const effectiveCustomTheme = previewCustomTheme
    ? sanitizeCustomTheme(previewCustomTheme)
    : customTheme;
  const effectiveBackgroundImage =
    previewBackgroundImage !== null ? previewBackgroundImage : backgroundImage;

  // Reflect to <html data-theme>
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", effective);
    if (effective === CUSTOM_THEME_ID) {
      Object.entries(customThemeVars(effectiveCustomTheme)).forEach(([name, value]) => {
        document.documentElement.style.setProperty(name, value);
      });
    } else {
      CUSTOM_VAR_NAMES.forEach((name) => document.documentElement.style.removeProperty(name));
    }
    document.documentElement.style.setProperty(
      "--app-bg-image",
      effectiveBackgroundImage ? `url("${effectiveBackgroundImage}")` : "none"
    );
    document.documentElement.style.setProperty(
      "--app-bg-image-opacity",
      effectiveBackgroundImage ? "0.28" : "0"
    );
  }, [effective, effectiveCustomTheme, effectiveBackgroundImage]);

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

        const data = snap.exists() ? snap.data() : {};
        const remote = data?.theme;
        const remoteCustomTheme = sanitizeCustomTheme(data?.customTheme);
        const remoteBackgroundImage = data?.backgroundImage || "";

        if (remote && isValidTheme(remote)) {
          setThemeState(remote);
          setCustomThemeState(remoteCustomTheme);
          setBackgroundImageState(remoteBackgroundImage);
          writeCache({
            theme: remote,
            customTheme: remoteCustomTheme,
            backgroundImage: remoteBackgroundImage,
          });
        }
        // ถ้า DB ไม่มี → ไม่ทำอะไร, ไม่ migrate ขึ้น (รอ user กดบันทึก)
        // ทิ้ง preview ใดๆ ที่อาจค้างอยู่
        setPreview(null);
        setPreviewCustomTheme(null);
        setPreviewBackgroundImage(null);
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
    async (idArg, options = {}) => {
      const id = idArg ?? preview ?? theme;
      if (!isValidTheme(id)) return false;
      const nextCustomTheme = sanitizeCustomTheme(
        options.customTheme ?? previewCustomTheme ?? customTheme
      );
      const nextBackgroundImage =
        options.backgroundImage !== undefined
          ? options.backgroundImage
          : previewBackgroundImage !== null
            ? previewBackgroundImage
            : backgroundImage;

      if (user?.userId) {
        await setDoc(
          doc(db, "users", user.userId),
          {
            theme: id,
            customTheme: nextCustomTheme,
            backgroundImage: nextBackgroundImage || "",
          },
          { merge: true }
        );
      }
      setThemeState(id);
      setCustomThemeState(nextCustomTheme);
      setBackgroundImageState(nextBackgroundImage || "");
      writeCache({
        theme: id,
        customTheme: nextCustomTheme,
        backgroundImage: nextBackgroundImage || "",
      });
      setPreview(null);
      setPreviewCustomTheme(null);
      setPreviewBackgroundImage(null);
      return true;
    },
    [
      backgroundImage,
      customTheme,
      preview,
      previewBackgroundImage,
      previewCustomTheme,
      theme,
      user?.userId,
    ]
  );

  const value = useMemo(
    () => ({
      theme,
      preview,
      setPreview,
      customTheme,
      previewCustomTheme,
      setPreviewCustomTheme,
      backgroundImage,
      previewBackgroundImage,
      setPreviewBackgroundImage,
      saveTheme,
      themes: THEMES,
      syncing,
    }),
    [
      backgroundImage,
      customTheme,
      preview,
      previewBackgroundImage,
      previewCustomTheme,
      saveTheme,
      syncing,
      theme,
    ]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
