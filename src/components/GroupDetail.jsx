import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import Swal from "sweetalert2";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { isFinance } from "../services/financeService";
import { getUserProfile } from "../services/userService";
import { resizeImageToDataURL } from "../utils/image";
import GroupAvatar from "./GroupAvatar";
import BackHomeButtons from "./BackHomeButtons";
import AvailabilityCalendar from "./AvailabilityCalendar";
import Timeline from "./Timeline";
import BillManager from "./BillManager";
import FinanceTab from "./FinanceTab";

const BASE_TABS = [
  {
    id: "overview",
    label: "ภาพรวม",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: "calendar",
    label: "ปฏิทิน",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    id: "timeline",
    label: "Timeline",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    id: "bills",
    label: "ค่าใช้จ่าย",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16l4-2 4 2 4-2 4 2V8z" />
        <line x1="9" y1="10" x2="15" y2="10" />
        <line x1="9" y1="14" x2="15" y2="14" />
      </svg>
    ),
  },
  {
    id: "finance",
    label: "การเงิน",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
];

const SETTINGS_TAB = {
  id: "settings",
  label: "ตั้งค่า",
  icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

function CopyChip({ label, value, fullText }) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullText ?? value);
      Swal.fire({
        toast: true,
        position: "top",
        icon: "success",
        title: "คัดลอกแล้ว",
        showConfirmButton: false,
        timer: 1400,
      });
    } catch {
      Swal.fire("คัดลอกไม่สำเร็จ", "", "error");
    }
  };

  return (
    <button type="button" className="copy-chip" onClick={handleCopy} title="คัดลอก">
      <span className="copy-chip-label">{label}</span>
      <span className="copy-chip-value">{value}</span>
      <span className="copy-chip-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </span>
    </button>
  );
}

// ============================================================
// Finance settings: บัญชีกลางให้เจ้าของ/ฝ่ายการเงินแก้ได้, Role ให้เจ้าของเท่านั้น
// ============================================================
function FinanceSettings({ group, gid, onUpdate, canManageRoles = false }) {
  const [bankName, setBankName] = useState(group.wallet?.bankName || "");
  const [bankAccount, setBankAccount] = useState(group.wallet?.bankAccount || "");
  const [accountName, setAccountName] = useState(group.wallet?.accountName || "");
  const [promptpay, setPromptpay] = useState(group.wallet?.promptpay || "");
  const [qrDataUrl, setQrDataUrl] = useState(group.wallet?.qrDataUrl || "");
  const [walletOwnerId, setWalletOwnerId] = useState(
    group.wallet?.walletOwnerId || ""
  );
  const [savingWallet, setSavingWallet] = useState(false);
  const [savingRoles, setSavingRoles] = useState(false);
  const [profileSourceId, setProfileSourceId] = useState(
    group.wallet?.walletOwnerId || ""
  );
  const [loadingProfileSource, setLoadingProfileSource] = useState(false);
  const qrInputRef = useRef(null);
  const financeIds = group.financeUserIds || [];

  const handleQr = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = await resizeImageToDataURL(file, { maxSize: 512, quality: 0.85 });
    setQrDataUrl(url);
  };

  const handleProfileSource = async (userId) => {
    setProfileSourceId(userId);
    if (!userId) return;
    setLoadingProfileSource(true);
    try {
      const member = group.members?.find((m) => m.userId === userId);
      const profile = await getUserProfile(userId);
      const bankProfile = profile?.bankProfile;
      if (!bankProfile?.bankAccount && !bankProfile?.promptpay) {
        Swal.fire(
          "ยังไม่มีบัญชีในโปรไฟล์",
          `${member?.name || "สมาชิกคนนี้"} ยังไม่ได้บันทึกบัญชีธนาคารในโปรไฟล์`,
          "info"
        );
        return;
      }
      setAccountName(bankProfile.accountName || member?.name || "");
      setBankName(bankProfile.bankName || "");
      setBankAccount(bankProfile.bankAccount || "");
      setPromptpay(bankProfile.promptpay || "");
      // copy QR + link wallet owner → FinanceTab จะ fetch QR สดได้
      if (bankProfile.qrDataUrl) setQrDataUrl(bankProfile.qrDataUrl);
      setWalletOwnerId(userId);
      Swal.fire({
        toast: true,
        position: "top",
        icon: "success",
        title: `ดึงบัญชี + QR ของ ${member?.name || "สมาชิก"} แล้ว`,
        showConfirmButton: false,
        timer: 1400,
      });
    } catch (err) {
      console.error(err);
      Swal.fire("เกิดข้อผิดพลาด", "ดึงบัญชีจากโปรไฟล์ไม่สำเร็จ", "error");
    } finally {
      setLoadingProfileSource(false);
    }
  };

  const saveWallet = async () => {
    setSavingWallet(true);
    try {
      const wallet = {
        bankName, bankAccount, accountName, promptpay, qrDataUrl,
        walletOwnerId: walletOwnerId || "",
      };
      await updateDoc(doc(db, "groups", gid), { wallet });
      onUpdate({ wallet });
      Swal.fire({ toast: true, position: "top", icon: "success", title: "บันทึกบัญชีกลางแล้ว", showConfirmButton: false, timer: 1400 });
    } catch (err) {
      console.error(err);
      Swal.fire("เกิดข้อผิดพลาด", "บันทึกไม่สำเร็จ", "error");
    } finally { setSavingWallet(false); }
  };

  const toggleFinance = async (userId) => {
    setSavingRoles(true);
    try {
      const next = financeIds.includes(userId)
        ? financeIds.filter((x) => x !== userId)
        : [...financeIds, userId];
      await updateDoc(doc(db, "groups", gid), { financeUserIds: next });
      onUpdate({ financeUserIds: next });
    } finally { setSavingRoles(false); }
  };

  return (
    <>
      {/* บัญชีกลาง */}
      <section className="settings-card">
        <header className="settings-card-header">
          <span className="settings-eyebrow">บัญชีกลาง</span>
          <h2 className="settings-title">บัญชีรับโอนของทริป</h2>
          <p className="settings-desc">สมาชิกจะเห็นเลขบัญชีนี้เมื่อกดปุ่มชำระเงินในแท็บการเงิน</p>
        </header>

        <div className="wallet-profile-source">
          <div>
            <label className="form-label fw-bold small">ดึงจากโปรไฟล์สมาชิก</label>
            <select
              className="form-control"
              value={profileSourceId}
              onChange={(e) => handleProfileSource(e.target.value)}
              disabled={loadingProfileSource}
            >
              <option value="">เลือกสมาชิกในกลุ่ม</option>
              {group.members?.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
          <small>
            เลือกสมาชิกเพื่อเติมข้อมูลบัญชีที่เจ้าตัวบันทึกไว้ในหน้าโปรไฟล์
            {loadingProfileSource && " · กำลังโหลด..."}
          </small>
        </div>

        <div className="row g-2">
          <div className="col-12 col-md-6">
            <label className="form-label fw-bold small">ชื่อบัญชี</label>
            <input className="form-control" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="เช่น ทริปกลาง" />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label fw-bold small">PromptPay</label>
            <input className="form-control" value={promptpay} onChange={(e) => setPromptpay(e.target.value)} placeholder="เบอร์โทร / เลขบัตร" />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label fw-bold small">ธนาคาร</label>
            <input className="form-control" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="เช่น SCB, KBANK" />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label fw-bold small">เลขบัญชี</label>
            <input className="form-control" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="123-4-56789-0" />
          </div>
          <div className="col-12">
            <label className="form-label fw-bold small">QR Code (ถ้ามี)</label>
            <div className="d-flex align-items-center gap-3 flex-wrap">
              {qrDataUrl && <img src={qrDataUrl} alt="QR" className="wallet-qr-preview" />}
              <button type="button" className="btn btn-outline-success" onClick={() => qrInputRef.current?.click()}>
                {qrDataUrl ? "เปลี่ยน QR" : "อัปโหลด QR"}
              </button>
              {qrDataUrl && (
                <button
                  type="button"
                  className="btn btn-light border"
                  onClick={() => { setQrDataUrl(""); setWalletOwnerId(""); }}
                >
                  ลบ QR
                </button>
              )}
              <input ref={qrInputRef} type="file" accept="image/*" hidden onChange={handleQr} />
            </div>
          </div>
        </div>
        <button type="button" className="btn btn-success px-4 mt-3" onClick={saveWallet} disabled={savingWallet}>
          {savingWallet ? "กำลังบันทึก..." : "บันทึกบัญชีกลาง"}
        </button>
      </section>

      {canManageRoles && (
        <section className="settings-card">
          <header className="settings-card-header">
            <span className="settings-eyebrow">สิทธิ์ฝ่ายการเงิน</span>
            <h2 className="settings-title">เลือกผู้ดูแลการเงิน</h2>
            <p className="settings-desc">
              เฉพาะคนที่เลือกไว้เท่านั้นที่กดอนุมัติสลิป / โอนคืน / ดูคิวรอตรวจได้
            </p>
          </header>
          <div className="role-list">
            {group.members?.map((m) => {
              const checked = financeIds.includes(m.userId);
              return (
                <label key={m.userId} className={`member-pick ${checked ? "is-on" : ""}`}>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={checked}
                    disabled={savingRoles}
                    onChange={() => toggleFinance(m.userId)}
                  />
                  <img src={m.picture || "https://via.placeholder.com/30"} alt={m.name} className="avatar" />
                  <span className="member-pick-name">{m.name}</span>
                  {m.userId === group.ownerId && <span className="badge text-bg-success ms-auto">เจ้าของ</span>}
                </label>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

function GroupDetail() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [memberProfile, setMemberProfile] = useState(null);
  const [loadingMemberId, setLoadingMemberId] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchGroup = async () => {
      const ref = doc(db, "groups", id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setGroup(data);
        setNameDraft(data.name || "");
      }
    };
    fetchGroup();
  }, [id]);

  const isOwner = user?.userId === group?.ownerId;
  const canManageFinanceSettings = isFinance(group, user?.userId);

  const tabs = useMemo(
    () => (canManageFinanceSettings ? [...BASE_TABS, SETTINGS_TAB] : BASE_TABS),
    [canManageFinanceSettings]
  );

  const initialTab = tabs.some((t) => t.id === searchParams.get("tab"))
    ? searchParams.get("tab")
    : "overview";
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (requestedTab && requestedTab !== activeTab && tabs.some((t) => t.id === requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [activeTab, searchParams, tabs]);

  // If user loses finance settings access, kick them off the settings tab.
  useEffect(() => {
    if (activeTab === "settings" && !canManageFinanceSettings) {
      setActiveTab("overview");
    }
  }, [activeTab, canManageFinanceSettings]);

  useEffect(() => {
    if (!memberProfile) return;
    const onKey = (event) => event.key === "Escape" && setMemberProfile(null);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [memberProfile]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    const next = new URLSearchParams(searchParams);
    if (tabId === "overview") next.delete("tab");
    else next.set("tab", tabId);
    setSearchParams(next, { replace: true });
  };

  const handleRemoveMember = async (memberId) => {
    if (!group) return;
    const result = await Swal.fire({
      icon: "warning",
      title: "ลบสมาชิก?",
      text: "สมาชิกคนนี้จะไม่เห็นข้อมูลกลุ่มอีกต่อไป",
      showCancelButton: true,
      confirmButtonText: "ลบสมาชิก",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#dc3545",
    });
    if (!result.isConfirmed) return;

    const updated = group.members.filter((m) => m.userId !== memberId);
    await updateDoc(doc(db, "groups", id), { members: updated });
    setGroup({ ...group, members: updated });
    Swal.fire("สำเร็จ", "ลบสมาชิกเรียบร้อย", "success");
  };

  const handleOpenMemberProfile = async (member) => {
    setLoadingMemberId(member.userId);
    try {
      const profile = await getUserProfile(member.userId);
      setMemberProfile({
        ...member,
        ...(profile || {}),
        bankProfile: profile?.bankProfile || member.bankProfile || null,
      });
    } catch (err) {
      console.error(err);
      Swal.fire("เกิดข้อผิดพลาด", "โหลดโปรไฟล์สมาชิกไม่สำเร็จ", "error");
    } finally {
      setLoadingMemberId("");
    }
  };

  const handleChoosePhoto = () => {
    if (!isOwner) return;
    fileInputRef.current?.click();
  };

  const handlePhotoFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !isOwner) return;

    if (file.size > 5 * 1024 * 1024) {
      Swal.fire("ไฟล์ใหญ่เกินไป", "ขนาดไม่ควรเกิน 5MB", "info");
      return;
    }

    try {
      setUploadingPhoto(true);
      const dataUrl = await resizeImageToDataURL(file, { maxSize: 256, quality: 0.85 });
      await updateDoc(doc(db, "groups", id), { photoURL: dataUrl });
      setGroup((g) => ({ ...g, photoURL: dataUrl }));
      Swal.fire({
        toast: true,
        position: "top",
        icon: "success",
        title: "อัปเดตรูปกลุ่มแล้ว",
        showConfirmButton: false,
        timer: 1400,
      });
    } catch (err) {
      console.error(err);
      Swal.fire("เกิดข้อผิดพลาด", "อัปโหลดรูปไม่สำเร็จ", "error");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!isOwner || !group?.photoURL) return;
    const result = await Swal.fire({
      icon: "question",
      title: "ลบรูปกลุ่ม?",
      text: "จะกลับไปใช้พยัญชนะแรกของชื่อกลุ่มแทน",
      showCancelButton: true,
      confirmButtonText: "ลบรูป",
      cancelButtonText: "ยกเลิก",
    });
    if (!result.isConfirmed) return;

    await updateDoc(doc(db, "groups", id), { photoURL: "" });
    setGroup((g) => ({ ...g, photoURL: "" }));
  };

  const handleSaveName = async () => {
    if (!isOwner) return;
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      Swal.fire("ชื่อกลุ่มว่างไม่ได้", "", "info");
      return;
    }
    if (trimmed === group.name) return;

    try {
      setSavingName(true);
      await updateDoc(doc(db, "groups", id), { name: trimmed });
      setGroup((g) => ({ ...g, name: trimmed }));
      Swal.fire({
        toast: true,
        position: "top",
        icon: "success",
        title: "บันทึกชื่อกลุ่มแล้ว",
        showConfirmButton: false,
        timer: 1400,
      });
    } catch (err) {
      console.error(err);
      Swal.fire("เกิดข้อผิดพลาด", "บันทึกชื่อกลุ่มไม่สำเร็จ", "error");
    } finally {
      setSavingName(false);
    }
  };

  if (!group) {
    return (
      <div className="soft-card empty-state">
        <div className="spinner-border text-success" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3 mb-0">กำลังโหลดข้อมูลกลุ่ม...</p>
      </div>
    );
  }

  const inviteLink = `${window.location.origin}/creategroup?groupId=${id}`;
  const compactLink = inviteLink.replace(/^https?:\/\//, "");
  const compactId = id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
  const nameChanged = nameDraft.trim() !== group.name;

  return (
    <>
      {/* HERO */}
      <section className="group-hero">
        <div className="group-hero-bg" aria-hidden="true">
          <span className="blob blob-a" />
          <span className="blob blob-b" />
        </div>

        <div className="group-hero-content">
          <div className="group-avatar-wrap">
            <GroupAvatar
              name={group.name}
              photoURL={group.photoURL}
              size={96}
              className="group-avatar-lg"
            />
          </div>

          <div className="group-hero-meta">
            <div className="group-hero-badges">
              {isOwner && <span className="hero-badge owner">เจ้าของกลุ่ม</span>}
              {(group.financeUserIds || []).includes(user?.userId) && !isOwner && (
                <span className="hero-badge owner">💰 ฝ่ายการเงิน</span>
              )}
              <span className="hero-badge muted">
                {group.members?.length || 0} สมาชิก
              </span>
              {(group.financeUserIds || []).length > 0 && (
                <span className="hero-badge muted">
                  💰 {group.financeUserIds.length} ผู้คุมบัญชี
                </span>
              )}
            </div>
            <h1 className="group-hero-title">{group.name}</h1>
          </div>
        </div>
      </section>

      {/* COMPACT INVITE */}
      <section className="invite-strip">
        <span className="invite-strip-eyebrow">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
          เชิญเพื่อน
        </span>
        <div className="invite-strip-chips">
          <CopyChip label="ลิงก์เชิญ" value={compactLink} fullText={inviteLink} />
          <CopyChip label="รหัสกลุ่ม" value={compactId} fullText={id} />
        </div>
      </section>

      {/* TABS */}
      <nav className="group-tabs" role="tablist" aria-label="หมวดหมู่กลุ่ม">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`group-tab ${activeTab === tab.id ? "is-active" : ""}`}
            onClick={() => handleTabChange(tab.id)}
          >
            <span className="group-tab-icon">{tab.icon}</span>
            <span className="group-tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* TAB CONTENT */}
      <div className="group-tab-panel">
        {activeTab === "overview" && (
          <section className="soft-card p-4">
            <h2 className="h5 fw-bold mb-3">สมาชิกในกลุ่ม</h2>
            <div className="list-group list-group-flush">
              {group.members?.map((member) => (
                <div
                  key={member.userId}
                  className="list-group-item px-0 d-flex align-items-center justify-content-between gap-3"
                >
                  <div className="d-flex align-items-center gap-3 min-w-0">
                    <img
                      src={member.picture || "https://via.placeholder.com/40"}
                      alt={member.name}
                      className="avatar"
                    />
                    <div className="min-w-0">
                      <h3 className="h6 fw-bold mb-0">{member.name}</h3>
                      <small className="text-muted">{member.email || "ไม่มีอีเมล"}</small>
                    </div>
                  </div>

                  <div className="member-row-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-light border"
                      onClick={() => handleOpenMemberProfile(member)}
                      disabled={loadingMemberId === member.userId}
                    >
                      {loadingMemberId === member.userId ? "กำลังโหลด..." : "ดูโปรไฟล์"}
                    </button>
                    {member.userId === group.ownerId && (
                      <span className="badge text-bg-success" title="เจ้าของกลุ่ม">เจ้าของ</span>
                    )}
                    {(group.financeUserIds || []).includes(member.userId) && (
                      <span className="badge text-bg-primary" title="คุมบัญชีของกลุ่ม">
                        💰 ฝ่ายการเงิน
                      </span>
                    )}
                    {member.userId !== group.ownerId && isOwner && (
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleRemoveMember(member.userId)}
                      >
                        ลบ
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "calendar" && (
          <div className="embedded-route">
            <AvailabilityCalendar />
          </div>
        )}

        {activeTab === "timeline" && (
          <div className="embedded-route">
            <Timeline />
          </div>
        )}

        {activeTab === "bills" && (
          <div className="embedded-route">
            <BillManager />
          </div>
        )}

        {activeTab === "finance" && (
          <FinanceTab group={group} gid={id} />
        )}

        {activeTab === "settings" && canManageFinanceSettings && (
          <div className="settings-stack">
            {/* บัญชีกลาง + Finance role */}
            <FinanceSettings
              group={group}
              gid={id}
              onUpdate={(patch) => setGroup((g) => ({ ...g, ...patch }))}
              canManageRoles={isOwner}
            />

            {isOwner && (
              <>
                {/* รูปกลุ่ม */}
                <section className="settings-card">
                  <header className="settings-card-header">
                    <span className="settings-eyebrow">รูปกลุ่ม</span>
                    <h2 className="settings-title">เปลี่ยนรูปประจำกลุ่ม</h2>
                    <p className="settings-desc">
                      ค่าเริ่มต้นใช้พยัญชนะตัวแรกของชื่อกลุ่ม สามารถอัปโหลดรูปแทนได้ ขนาดไม่เกิน 5MB
                    </p>
                  </header>

                  <div className="settings-photo-row">
                    <GroupAvatar
                      name={group.name}
                      photoURL={group.photoURL}
                      size={96}
                      className="group-avatar-lg"
                    />
                    <div className="settings-photo-actions">
                      <button
                        type="button"
                        className="btn btn-success px-4"
                        onClick={handleChoosePhoto}
                        disabled={uploadingPhoto}
                      >
                        {uploadingPhoto ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status" />
                            กำลังอัปโหลด...
                          </>
                        ) : group.photoURL ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
                      </button>
                      {group.photoURL && (
                        <button
                          type="button"
                          className="btn btn-outline-danger"
                          onClick={handleRemovePhoto}
                          disabled={uploadingPhoto}
                        >
                          ลบรูป
                        </button>
                      )}
                      <small className="text-muted">
                        รองรับไฟล์ JPG / PNG / WebP — ระบบจะย่อขนาดเป็น 256×256 อัตโนมัติ
                      </small>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={handlePhotoFile}
                    />
                  </div>
                </section>

                {/* ชื่อกลุ่ม */}
                <section className="settings-card">
                  <header className="settings-card-header">
                    <span className="settings-eyebrow">ชื่อกลุ่ม</span>
                    <h2 className="settings-title">แก้ไขชื่อกลุ่ม</h2>
                    <p className="settings-desc">
                      สมาชิกทุกคนจะเห็นชื่อใหม่ทันทีหลังบันทึก
                    </p>
                  </header>

                  <div className="settings-name-row">
                    <input
                      type="text"
                      className="form-control"
                      value={nameDraft}
                      maxLength={60}
                      onChange={(e) => setNameDraft(e.target.value)}
                      placeholder="เช่น ทริปเชียงใหม่ 2026"
                    />
                    <button
                      type="button"
                      className="btn btn-success px-4"
                      onClick={handleSaveName}
                      disabled={!nameChanged || savingName}
                    >
                      {savingName ? "กำลังบันทึก..." : "บันทึกชื่อ"}
                    </button>
                  </div>
                </section>
              </>
            )}
          </div>
        )}
      </div>

      {memberProfile && (
        <div
          className="member-profile-modal"
          role="dialog"
          aria-modal="true"
          onClick={() => setMemberProfile(null)}
        >
          <div className="member-profile-dialog" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="member-profile-close"
              onClick={() => setMemberProfile(null)}
              aria-label="ปิด"
            >
              ×
            </button>
            <div className="member-profile-head">
              <img
                src={memberProfile.picture || "https://via.placeholder.com/96"}
                alt={memberProfile.name}
                className="member-profile-avatar"
              />
              <div className="min-w-0">
                <h2>{memberProfile.name}</h2>
                <p>{memberProfile.email || "ไม่มีอีเมล"}</p>
                <div className="d-flex gap-2 flex-wrap mt-1">
                  {memberProfile.userId === group.ownerId && (
                    <span className="badge text-bg-success">เจ้าของกลุ่ม</span>
                  )}
                  {(group.financeUserIds || []).includes(memberProfile.userId) && (
                    <span className="badge text-bg-primary">💰 ฝ่ายการเงิน</span>
                  )}
                </div>
              </div>
            </div>

            <section className="member-profile-section">
              <h3>บัญชีรับเงิน</h3>
              {memberProfile.bankProfile?.bankAccount ||
              memberProfile.bankProfile?.promptpay ||
              memberProfile.bankProfile?.qrDataUrl ? (
                <div className="member-bank-layout">
                  <div className="member-bank-list">
                    {memberProfile.bankProfile.accountName && (
                      <div className="member-bank-row">
                        <span>ชื่อบัญชี</span>
                        <strong>{memberProfile.bankProfile.accountName}</strong>
                      </div>
                    )}
                    {memberProfile.bankProfile.bankName && (
                      <div className="member-bank-row">
                        <span>ธนาคาร</span>
                        <strong>{memberProfile.bankProfile.bankName}</strong>
                      </div>
                    )}
                    {memberProfile.bankProfile.bankAccount && (
                      <CopyChip
                        label="เลขบัญชี"
                        value={memberProfile.bankProfile.bankAccount}
                        fullText={memberProfile.bankProfile.bankAccount}
                      />
                    )}
                    {memberProfile.bankProfile.promptpay && (
                      <CopyChip
                        label="PromptPay"
                        value={memberProfile.bankProfile.promptpay}
                        fullText={memberProfile.bankProfile.promptpay}
                      />
                    )}
                    {!memberProfile.bankProfile.bankAccount &&
                      !memberProfile.bankProfile.promptpay && (
                        <p className="member-profile-empty mb-0">
                          มีเฉพาะ QR — แตะเพื่อขยายและบันทึกรูป
                        </p>
                      )}
                  </div>

                  {memberProfile.bankProfile.qrDataUrl && (
                    <figure className="member-bank-qr">
                      <img
                        src={memberProfile.bankProfile.qrDataUrl}
                        alt={`qr-${memberProfile.name || "member"}.jpg`}
                        title="แตะเพื่อดูใหญ่และบันทึก"
                      />
                      <figcaption>QR สำหรับโอน</figcaption>
                    </figure>
                  )}
                </div>
              ) : (
                <p className="member-profile-empty">ยังไม่ได้บันทึกบัญชีธนาคาร</p>
              )}
            </section>
          </div>
        </div>
      )}

      <BackHomeButtons />
    </>
  );
}

export default GroupDetail;
