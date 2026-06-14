import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useTutorial } from "../TutorialContext";
import { checkIsAdmin } from "../services/adminService";

function Menu() {
  const { user, logout } = useAuth();
  const { replayWelcome } = useTutorial();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (user?.userId) checkIsAdmin(user.userId).then(setIsAdmin);
  }, [user?.userId]);

  const menuItems = [
    {
      name: "กลุ่มของฉัน",
      path: "/dashboard",
      tone: "emerald",
      guideId: "dashboard",
      desc: "ดูสมาชิกและจัดการกลุ่มทั้งหมด",
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
      name: "ปฏิทินวันว่าง",
      path: "/calendar",
      tone: "ocean",
      guideId: "calendar",
      desc: "เลือกกลุ่มเพื่อหาวันที่ว่างตรงกัน",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
        </svg>
      ),
    },
    {
      name: "Timeline",
      path: "/timeline",
      tone: "sunset",
      guideId: "timeline",
      desc: "จัดตารางกิจกรรม วัน เวลา และสถานที่",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      name: "ค่าใช้จ่าย",
      path: "/bills",
      tone: "ocean",
      guideId: "bills",
      desc: "บันทึกบิลและสรุปยอดที่ต้องจ่ายคืน",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16l4-2 4 2 4-2 4 2V8z" />
          <line x1="9" y1="10" x2="15" y2="10" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
      ),
    },
    {
      name: "สร้าง / เข้าร่วม",
      path: "/creategroup",
      tone: "sunset",
      guideId: "creategroup",
      desc: "สร้างกลุ่มใหม่หรือกรอกรหัสเชิญ",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      ),
    },
    {
      name: "โปรไฟล์",
      path: "/profile",
      tone: "violet",
      guideId: "profile",
      desc: "ตรวจสอบข้อมูลบัญชี LINE",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ];

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "อรุณสวัสดิ์";
    if (h < 17) return "สวัสดียามบ่าย";
    if (h < 20) return "สวัสดียามเย็น";
    return "ราตรีสวัสดิ์";
  })();

  return (
    <>
      <section className="menu-hero">
        <div className="menu-hero-bg" aria-hidden="true">
          <span className="blob blob-a" />
          <span className="blob blob-b" />
        </div>

        <div className="menu-hero-content">
          <div className="menu-hero-text">
            <span className="hero-eyebrow">{greeting} 👋</span>
            <h1 className="hero-title">{user?.name}</h1>
            <p className="hero-subtitle">
              เลือกงานที่อยากทำต่อได้ทันที — ทุกอย่างถูกจัดวางตามลำดับการใช้งานหลัก
            </p>
          </div>

          <div className="menu-hero-actions">
            {user?.picture && (
              <Link to="/profile">
                <img className="hero-avatar" src={user.picture} alt={user?.name} />
              </Link>
            )}
            <button
              className="btn-ghost-danger"
              onClick={logout}
              type="button"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              ออกจากระบบ
            </button>
          </div>
        </div>
      </section>

      <section className="menu-section-label">
        <span>เมนูทั้งหมด</span>
        <small>{menuItems.length} รายการ</small>
      </section>

      <section className="menu-grid-modern">
        {menuItems.map((item) => (
          <Link to={item.path} className={`menu-card-modern tone-${item.tone}`} key={item.path} data-guide={item.guideId}>
            <span className="menu-card-icon" aria-hidden="true">
              {item.icon}
            </span>
            <div className="menu-card-body">
              <h2>{item.name}</h2>
              <p>{item.desc}</p>
            </div>
            <span className="menu-card-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </span>
          </Link>
        ))}
      </section>

      <div className="menu-guide-bar">
        {isAdmin && (
          <Link to="/admin" className="menu-guide-link" style={{ color: "#dc3545" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            แผงควบคุม Admin
          </Link>
        )}
        <Link to="/guide" className="menu-guide-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          คู่มือการใช้งาน
        </Link>
        <button className="menu-guide-replay" onClick={replayWelcome} type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 .49-3.5" />
          </svg>
          เล่น Tutorial อีกครั้ง
        </button>
      </div>
    </>
  );
}

export default Menu;
