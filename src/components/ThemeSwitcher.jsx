import { useEffect, useRef, useState } from "react";
import { useTheme } from "../ThemeContext";

function ThemeSwitcher() {
  const { theme, setTheme, themes } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = themes.find((t) => t.id === theme) ?? themes[0];

  return (
    <div className="theme-switcher" ref={ref}>
      <button
        type="button"
        className="theme-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title="เปลี่ยนธีม"
      >
        <span className="theme-trigger-swatch">
          <span style={{ background: active.swatch[0] }} />
          <span style={{ background: active.swatch[1] }} />
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="theme-popover" role="menu">
          <div className="theme-popover-title">เลือกธีม</div>
          <div className="theme-popover-list">
            {themes.map((t) => {
              const isActive = t.id === theme;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  className={`theme-option ${isActive ? "is-active" : ""}`}
                  onClick={() => {
                    setTheme(t.id);
                    setOpen(false);
                  }}
                >
                  <span className="theme-option-swatch">
                    <span style={{ background: t.swatch[0] }} />
                    <span style={{ background: t.swatch[1] }} />
                  </span>
                  <span className="theme-option-text">
                    <strong>{t.name}</strong>
                    <small>{t.desc}</small>
                  </span>
                  {isActive && (
                    <svg
                      className="theme-option-check"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ThemeSwitcher;
