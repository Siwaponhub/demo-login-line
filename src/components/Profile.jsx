import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useTheme } from "../ThemeContext";
import BackHomeButtons from "./BackHomeButtons";

function Profile() {
  const { user } = useAuth();
  const { theme, setTheme, themes } = useTheme();

  if (!user) {
    return (
      <div className="soft-card login-card text-center">
        <h1 className="page-title">ยังไม่ได้เข้าสู่ระบบ</h1>
        <Link to="/" className="btn btn-success mt-3">
          เข้าสู่ระบบด้วย LINE
        </Link>
      </div>
    );
  }

  return (
    <>
      <section className="page-header">
        <div>
          <h1 className="page-title">โปรไฟล์</h1>
          <p className="page-subtitle">ข้อมูลบัญชีและการตั้งค่าหน้าตาแอป</p>
        </div>
      </section>

      <section className="profile-card">
        <div className="profile-card-bg" aria-hidden="true">
          <span className="blob blob-a" />
          <span className="blob blob-b" />
        </div>
        <div className="profile-card-content">
          <img
            src={user.picture}
            alt={user.name}
            className="profile-avatar"
          />
          <div className="profile-meta">
            <h2 className="profile-name">{user.name}</h2>
            <p className="profile-email">{user.email || "ไม่มีอีเมล"}</p>
          </div>
        </div>
      </section>

      <section className="theme-picker-card">
        <header className="theme-picker-header">
          <div>
            <span className="theme-picker-eyebrow">การตั้งค่า</span>
            <h2 className="theme-picker-title">ธีมของแอป</h2>
            <p className="theme-picker-desc">
              เลือกโทนสีที่ชอบ — ใช้กับทุกหน้าและจะถูกจดจำไว้ในเครื่องนี้
            </p>
          </div>
        </header>

        <div className="theme-picker-grid">
          {themes.map((t) => {
            const isActive = t.id === theme;
            return (
              <button
                key={t.id}
                type="button"
                className={`theme-tile ${isActive ? "is-active" : ""}`}
                onClick={() => setTheme(t.id)}
                aria-pressed={isActive}
              >
                <span
                  className="theme-tile-preview"
                  style={{
                    background: `linear-gradient(135deg, ${t.swatch[0]} 0%, ${t.swatch[1]} 100%)`,
                  }}
                >
                  <span className="theme-tile-dot" style={{ background: t.swatch[0] }} />
                  <span className="theme-tile-dot" style={{ background: t.swatch[1] }} />
                  {isActive && (
                    <span className="theme-tile-check" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  )}
                </span>
                <span className="theme-tile-text">
                  <strong>{t.name}</strong>
                  <small>{t.desc}</small>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <BackHomeButtons />
    </>
  );
}

export default Profile;
