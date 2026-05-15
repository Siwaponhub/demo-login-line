import { useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import { useAuth } from "../AuthContext";
import { useTheme } from "../ThemeContext";
import BackHomeButtons from "./BackHomeButtons";

function Profile() {
  const { user } = useAuth();
  const { theme, preview, setPreview, saveTheme, themes, syncing } = useTheme();
  const [saving, setSaving] = useState(false);

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

  // ธีมที่เลือกอยู่ตอนนี้ (preview มีน้ำหนักก่อน)
  const selected = preview ?? theme;
  const dirty = preview !== null && preview !== theme;

  const handlePick = (id) => {
    // กดธีมที่เป็น current อยู่แล้ว → เคลียร์ preview
    if (id === theme) setPreview(null);
    else setPreview(id);
  };

  const handleSave = async () => {
    if (!dirty) return;
    try {
      setSaving(true);
      await saveTheme(preview);
      Swal.fire({
        toast: true,
        position: "top",
        icon: "success",
        title: "บันทึกธีมแล้ว",
        showConfirmButton: false,
        timer: 1400,
      });
    } catch (err) {
      console.error(err);
      Swal.fire("เกิดข้อผิดพลาด", "บันทึกธีมไม่สำเร็จ", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => setPreview(null);

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
          <img src={user.picture} alt={user.name} className="profile-avatar" />
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
            <h2 className="theme-picker-title">
              ธีมของแอป
              {syncing && (
                <span className="theme-sync-pill" title="กำลังโหลดจากบัญชี">
                  <span className="spinner-border spinner-border-sm" role="status" />
                  ซิงค์
                </span>
              )}
              {dirty && !syncing && (
                <span className="theme-sync-pill is-warn" title="ยังไม่ได้บันทึก">
                  ยังไม่บันทึก
                </span>
              )}
            </h2>
            <p className="theme-picker-desc">
              เลือกโทนสี — ลองดูสดๆ ได้ทันที กดปุ่ม <strong>บันทึกธีม</strong> เมื่อพอใจ
              ระบบจะเก็บไว้กับบัญชี LINE ของคุณ
            </p>
          </div>
        </header>

        <div className="theme-picker-grid">
          {themes.map((t) => {
            const isSelected = t.id === selected;
            const isCurrent = t.id === theme;
            return (
              <button
                key={t.id}
                type="button"
                className={`theme-tile ${isSelected ? "is-active" : ""}`}
                onClick={() => handlePick(t.id)}
                aria-pressed={isSelected}
              >
                <span
                  className="theme-tile-preview"
                  style={{
                    background: `linear-gradient(135deg, ${t.swatch[0]} 0%, ${t.swatch[1]} 100%)`,
                  }}
                >
                  <span className="theme-tile-dot" style={{ background: t.swatch[0] }} />
                  <span className="theme-tile-dot" style={{ background: t.swatch[1] }} />
                  {isSelected && (
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
                  {isCurrent && (
                    <span className="theme-tile-current">ธีมปัจจุบัน</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Save / Cancel bar — แสดงเมื่อมี preview ที่ต่างจาก current */}
        <div className={`theme-save-bar ${dirty ? "is-visible" : ""}`}>
          <span className="theme-save-bar-text">
            {dirty
              ? "คุณกำลังพรีวิวธีมใหม่อยู่ — บันทึกเพื่อใช้ถาวร"
              : "เลือกธีมที่ต้องการแล้วกดบันทึก"}
          </span>
          <div className="theme-save-bar-actions">
            <button
              type="button"
              className="btn btn-light border"
              onClick={handleCancel}
              disabled={!dirty || saving}
            >
              ยกเลิก
            </button>
            <button
              type="button"
              className="btn btn-success px-4"
              onClick={handleSave}
              disabled={!dirty || saving}
            >
              {saving ? "กำลังบันทึก..." : "บันทึกธีม"}
            </button>
          </div>
        </div>
      </section>

      <BackHomeButtons />
    </>
  );
}

export default Profile;
