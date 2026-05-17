import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import { useAuth } from "../AuthContext";
import { CUSTOM_THEME_ID, DEFAULT_CUSTOM_THEME, useTheme } from "../ThemeContext";
import { getUserProfile, saveBankProfile } from "../services/userService";
import { resizeImageToDataURL } from "../utils/image";
import BackHomeButtons from "./BackHomeButtons";

const emptyBankProfile = {
  accountName: "",
  bankName: "",
  bankAccount: "",
  promptpay: "",
  qrDataUrl: "",
};

const customFields = [
  { key: "accent", label: "สีหลัก" },
  { key: "accentStrong", label: "สีปุ่มเข้ม" },
  { key: "accent2", label: "สีรอง" },
  { key: "bg", label: "พื้นหลัง 1" },
  { key: "bgAlt", label: "พื้นหลัง 2" },
  { key: "surface", label: "พื้นผิว" },
  { key: "surfaceMute", label: "พื้นผิวอ่อน" },
  { key: "text", label: "ตัวอักษร" },
  { key: "textMuted", label: "ตัวอักษรรอง" },
];

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function Profile() {
  const { user, updateUser } = useAuth();
  const {
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
    themes,
    syncing,
  } = useTheme();
  const [saving, setSaving] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [bankProfile, setBankProfile] = useState(() => user?.bankProfile || emptyBankProfile);
  const bgInputRef = useRef(null);
  const qrInputRef = useRef(null);

  const handleQrFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      Swal.fire("ไฟล์ใหญ่เกินไป", "ขนาดไม่ควรเกิน 5MB", "info");
      return;
    }
    try {
      const url = await resizeImageToDataURL(file, { maxSize: 512, quality: 0.85 });
      setBankProfile((current) => ({ ...current, qrDataUrl: url }));
    } catch (err) {
      console.error(err);
      Swal.fire("เกิดข้อผิดพลาด", "อัปโหลด QR ไม่สำเร็จ", "error");
    }
  };

  const removeQr = () => {
    setBankProfile((current) => ({ ...current, qrDataUrl: "" }));
  };

  useEffect(() => {
    if (!user?.userId) return;
    let cancelled = false;
    (async () => {
      try {
        const profile = await getUserProfile(user.userId);
        if (cancelled) return;
        if (profile?.bankProfile) {
          setBankProfile({ ...emptyBankProfile, ...profile.bankProfile });
          updateUser({ bankProfile: profile.bankProfile });
        }
      } catch (err) {
        console.error("load bank profile failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.userId, updateUser]);

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
  const activeCustomTheme = previewCustomTheme ?? customTheme;
  const activeBackgroundImage =
    previewBackgroundImage !== null ? previewBackgroundImage : backgroundImage;
  const themeDirty = preview !== null && preview !== theme;
  const customDirty = previewCustomTheme !== null && !sameJson(activeCustomTheme, customTheme);
  const backgroundDirty =
    previewBackgroundImage !== null && previewBackgroundImage !== backgroundImage;
  const dirty = themeDirty || customDirty || backgroundDirty;

  const handlePick = (id) => {
    // กดธีมที่เป็น current อยู่แล้ว → เคลียร์ preview
    if (id === theme) setPreview(null);
    else setPreview(id);
  };

  const updateCustom = (field, value) => {
    setPreview(CUSTOM_THEME_ID);
    setPreviewCustomTheme({
      ...activeCustomTheme,
      [field]: value,
    });
  };

  const resetCustom = () => {
    setPreview(CUSTOM_THEME_ID);
    setPreviewCustomTheme(DEFAULT_CUSTOM_THEME);
  };

  const handleBackgroundFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const url = await resizeImageToDataURL(file, { maxSize: 1200, quality: 0.72 });
      setPreviewBackgroundImage(url);
    } catch (err) {
      console.error(err);
      Swal.fire("เกิดข้อผิดพลาด", "อัปโหลดรูปพื้นหลังไม่สำเร็จ", "error");
    }
  };

  const handleSave = async () => {
    if (!dirty) return;
    try {
      setSaving(true);
      await saveTheme(selected, {
        customTheme: activeCustomTheme,
        backgroundImage: activeBackgroundImage,
      });
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

  const handleCancel = () => {
    setPreview(null);
    setPreviewCustomTheme(null);
    setPreviewBackgroundImage(null);
  };

  const updateBank = (field, value) => {
    setBankProfile((current) => ({ ...current, [field]: value }));
  };

  const handleSaveBank = async () => {
    try {
      setSavingBank(true);
      const saved = await saveBankProfile(user.userId, bankProfile);
      setBankProfile(saved);
      updateUser({ bankProfile: saved });
      Swal.fire({
        toast: true,
        position: "top",
        icon: "success",
        title: "บันทึกบัญชีธนาคารแล้ว",
        showConfirmButton: false,
        timer: 1400,
      });
    } catch (err) {
      console.error(err);
      Swal.fire("เกิดข้อผิดพลาด", "บันทึกบัญชีธนาคารไม่สำเร็จ", "error");
    } finally {
      setSavingBank(false);
    }
  };

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

      <section className="profile-bank-card">
        <header className="theme-picker-header">
          <div>
            <span className="theme-picker-eyebrow">บัญชีรับเงิน</span>
            <h2 className="theme-picker-title">บัญชีธนาคารของคุณ</h2>
            <p className="theme-picker-desc">
              ใช้แสดงให้สมาชิกในกลุ่มเห็นเมื่อต้องโอนคืนให้คุณ
            </p>
          </div>
        </header>

        <div className="profile-bank-grid">
          <label className="profile-bank-field">
            <span>ชื่อบัญชี</span>
            <input
              className="form-control"
              value={bankProfile.accountName}
              onChange={(e) => updateBank("accountName", e.target.value)}
              placeholder="เช่น Surasak S."
            />
          </label>
          <label className="profile-bank-field">
            <span>ธนาคาร</span>
            <input
              className="form-control"
              value={bankProfile.bankName}
              onChange={(e) => updateBank("bankName", e.target.value)}
              placeholder="เช่น SCB, KBANK"
            />
          </label>
          <label className="profile-bank-field">
            <span>เลขบัญชี</span>
            <input
              className="form-control"
              value={bankProfile.bankAccount}
              onChange={(e) => updateBank("bankAccount", e.target.value)}
              placeholder="123-4-56789-0"
            />
          </label>
          <label className="profile-bank-field">
            <span>PromptPay</span>
            <input
              className="form-control"
              value={bankProfile.promptpay}
              onChange={(e) => updateBank("promptpay", e.target.value)}
              placeholder="เบอร์โทร / เลขบัตร"
            />
          </label>
          <div className="profile-bank-field profile-bank-qr">
            <span>QR Code</span>
            <div className="profile-qr-row">
              {bankProfile.qrDataUrl ? (
                <img
                  src={bankProfile.qrDataUrl}
                  alt="QR สำหรับโอนเงิน"
                  className="profile-qr-preview"
                />
              ) : (
                <div className="profile-qr-placeholder" aria-hidden="true">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <path d="M14 14h3v3M21 14v3M14 18v3M17 21h4" />
                  </svg>
                  <small>ยังไม่มี QR</small>
                </div>
              )}
              <div className="profile-qr-actions">
                <button
                  type="button"
                  className="btn btn-outline-success"
                  onClick={() => qrInputRef.current?.click()}
                >
                  {bankProfile.qrDataUrl ? "เปลี่ยน QR" : "อัปโหลด QR"}
                </button>
                {bankProfile.qrDataUrl && (
                  <button
                    type="button"
                    className="btn btn-light border"
                    onClick={removeQr}
                  >
                    ลบ QR
                  </button>
                )}
                <small className="text-muted">
                  รับไฟล์ JPG / PNG / WebP (ย่อเหลือ 512×512 อัตโนมัติ)
                </small>
              </div>
              <input
                ref={qrInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleQrFile}
                data-image-viewer="off"
              />
            </div>
          </div>
        </div>

        <div className="profile-bank-actions">
          <button
            type="button"
            className="btn btn-success px-4"
            onClick={handleSaveBank}
            disabled={savingBank}
          >
            {savingBank ? "กำลังบันทึก..." : "บันทึกบัญชีธนาคาร"}
          </button>
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
          <button
            type="button"
            className={`theme-tile ${selected === CUSTOM_THEME_ID ? "is-active" : ""}`}
            onClick={() => handlePick(CUSTOM_THEME_ID)}
            aria-pressed={selected === CUSTOM_THEME_ID}
          >
            <span
              className="theme-tile-preview"
              style={{
                background: `linear-gradient(135deg, ${activeCustomTheme.accent} 0%, ${activeCustomTheme.accent2} 100%)`,
              }}
            >
              <span className="theme-tile-dot" style={{ background: activeCustomTheme.accent }} />
              <span className="theme-tile-dot" style={{ background: activeCustomTheme.accent2 }} />
              {selected === CUSTOM_THEME_ID && (
                <span className="theme-tile-check" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              )}
            </span>
            <span className="theme-tile-text">
              <strong>Custom Theme</strong>
              <small>กำหนดสีของแอปเอง</small>
              {theme === CUSTOM_THEME_ID && (
                <span className="theme-tile-current">ธีมปัจจุบัน</span>
              )}
            </span>
          </button>
        </div>

        <div className="custom-theme-panel">
          <div className="custom-theme-head">
            <div>
              <h3>ปรับธีมเอง</h3>
              <p>เปลี่ยนสีแล้วดูผลทันที ก่อนกดบันทึก</p>
            </div>
            <button type="button" className="btn btn-sm btn-light border" onClick={resetCustom}>
              รีเซ็ตสี
            </button>
          </div>

          <div className="custom-color-grid">
            {customFields.map((field) => (
              <label key={field.key} className="custom-color-field">
                <span>{field.label}</span>
                <input
                  type="color"
                  value={activeCustomTheme[field.key]}
                  onChange={(e) => updateCustom(field.key, e.target.value)}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="custom-bg-panel">
          <div className="custom-theme-head">
            <div>
              <h3>รูปพื้นหลัง</h3>
              <p>อัปโหลดรูปเอง ระบบจะย่อขนาดก่อนบันทึก</p>
            </div>
            <div className="custom-bg-actions">
              <button
                type="button"
                className="btn btn-sm btn-light border"
                onClick={() => bgInputRef.current?.click()}
              >
                {activeBackgroundImage ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
              </button>
              {activeBackgroundImage && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => setPreviewBackgroundImage("")}
                >
                  ลบรูป
                </button>
              )}
            </div>
          </div>

          {activeBackgroundImage ? (
            <button
              type="button"
              className="custom-bg-preview"
              onClick={() => bgInputRef.current?.click()}
              style={{ backgroundImage: `url("${activeBackgroundImage}")` }}
              title="เปลี่ยนรูปพื้นหลัง"
            />
          ) : (
            <button type="button" className="custom-bg-empty" onClick={() => bgInputRef.current?.click()}>
              เลือกรูปพื้นหลัง
            </button>
          )}
          <input ref={bgInputRef} type="file" accept="image/*" hidden onChange={handleBackgroundFile} />
        </div>

        {/* Save / Cancel bar — แสดงเมื่อมี preview ที่ต่างจาก current */}
        <div className={`theme-save-bar ${dirty ? "is-visible" : ""}`}>
          <span className="theme-save-bar-text">
            {dirty
              ? "คุณกำลังพรีวิวธีมหรือพื้นหลังใหม่อยู่ — บันทึกเพื่อใช้ถาวร"
              : "เลือกธีม / ปรับสี / เลือกรูปพื้นหลัง แล้วกดบันทึก"}
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
