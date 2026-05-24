import { useState } from "react";
import { Link } from "react-router-dom";
import { useTutorial } from "../TutorialContext";

const GUIDES = [
  {
    id: "groups",
    name: "กลุ่มของฉัน",
    desc: "ดูและจัดการกลุ่มทั้งหมดที่คุณเป็นสมาชิก",
    tone: "emerald",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    steps: [
      { title: "เปิดเมนู \"กลุ่มของฉัน\"", desc: "กดการ์ด \"กลุ่มของฉัน\" จากหน้าเมนูหลัก จะแสดงรายการกลุ่มทั้งหมดที่คุณเป็นสมาชิก" },
      { title: "เลือกกลุ่มที่ต้องการ", desc: "กดที่การ์ดกลุ่มเพื่อเข้าไปดูรายละเอียด สมาชิก และฟีเจอร์ต่างๆ ภายในกลุ่มนั้น" },
      { title: "ใช้แท็บภายในกลุ่ม", desc: "แต่ละกลุ่มมี 6 แท็บ: ภาพรวม, ปฏิทิน, Timeline, ค่าใช้จ่าย, การเงิน และตั้งค่า" },
      { title: "จัดการสมาชิกและกลุ่ม", desc: "ดูรายชื่อสมาชิก แชร์ลิงก์เชิญ หรือลบกลุ่มออกได้ในแท็บ \"ตั้งค่า\" (เฉพาะผู้สร้าง)" },
    ],
  },
  {
    id: "create",
    name: "สร้าง / เข้าร่วมกลุ่ม",
    desc: "สร้างกลุ่มใหม่หรือเข้าร่วมด้วยรหัสเชิญ",
    tone: "sunset",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ),
    steps: [
      { title: "กดเมนู \"สร้าง / เข้าร่วม\"", desc: "เลือกจากหน้าเมนูหลัก จะมีสองตัวเลือกให้เลือก: สร้างกลุ่มใหม่ หรือเข้าร่วมกลุ่มที่มีอยู่" },
      { title: "สร้างกลุ่มใหม่", desc: "ตั้งชื่อกลุ่มแล้วกดสร้าง ระบบจะสร้างรหัสกลุ่ม 8 หลักให้อัตโนมัติ พร้อมลิงก์เชิญ" },
      { title: "เข้าร่วมด้วยรหัสเชิญ", desc: "กรอกรหัสกลุ่ม 8 หลักที่ได้รับจากเพื่อน แล้วกดยืนยันเพื่อเข้าร่วมกลุ่ม" },
      { title: "แชร์ลิงก์เชิญ", desc: "ในหน้ากลุ่ม กดปุ่ม \"แชร์\" เพื่อส่งลิงก์เชิญผ่าน LINE หรือช่องทางอื่น เพื่อนคลิกลิงก์จะเข้าร่วมทันที" },
    ],
  },
  {
    id: "calendar",
    name: "ปฏิทินวันว่าง",
    desc: "เลือกวันว่างของตัวเองและหาวันที่ทุกคนตรงกัน",
    tone: "ocean",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
      </svg>
    ),
    steps: [
      { title: "เลือกกลุ่มที่ต้องการ", desc: "กดเมนู \"ปฏิทินวันว่าง\" แล้วเลือกกลุ่มที่ต้องการหาวันนัด ระบบจะแสดงปฏิทินของกลุ่มนั้น" },
      { title: "คลิกวันที่คุณว่าง", desc: "กดที่วันบนปฏิทินเพื่อเลือกวันที่ว่าง กดซ้ำเพื่อยกเลิก การเปลี่ยนแปลงบันทึกอัตโนมัติ" },
      { title: "ดูวันว่างของทุกคน", desc: "ปฏิทินแสดงสีตามจำนวนคนที่ว่าง สีเข้มขึ้น = ว่างมากคน ดูแถบด้านข้างเพื่อดูรายละเอียด" },
      { title: "เลือกวันนัดที่เหมาะสม", desc: "วันที่มีสีเข้มที่สุดคือวันที่ทุกคนว่างมากที่สุด เหมาะสำหรับนัดกิจกรรมกลุ่ม" },
    ],
  },
  {
    id: "timeline",
    name: "Timeline กิจกรรม",
    desc: "จัดตารางกิจกรรม วัน เวลา สถานที่",
    tone: "sunset",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    steps: [
      { title: "เข้าหน้า Timeline", desc: "เลือกจากเมนูหลัก หรือเข้าผ่านแท็บ \"Timeline\" ในหน้ากลุ่ม เพื่อดูกิจกรรมของกลุ่มนั้นโดยเฉพาะ" },
      { title: "เพิ่มกิจกรรมใหม่", desc: "กดปุ่ม \"+ เพิ่มกิจกรรม\" กรอกชื่อกิจกรรม วันที่ เวลาเริ่ม-สิ้นสุด และสถานที่" },
      { title: "ใส่ลิงก์แผนที่", desc: "วางลิงก์ Google Maps หรือ แผนที่อื่นๆ เพื่อให้ทุกคนกดเปิดแผนที่ได้เลย" },
      { title: "แก้ไขและลบกิจกรรม", desc: "กดที่กิจกรรมเพื่อดูรายละเอียด หรือกดปุ่มแก้ไข/ลบ เฉพาะผู้สร้างกิจกรรมเท่านั้นที่แก้ไขได้" },
    ],
  },
  {
    id: "bills",
    name: "ค่าใช้จ่าย",
    desc: "บันทึกบิลและสรุปยอดที่ต้องจ่ายคืน",
    tone: "ocean",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16l4-2 4 2 4-2 4 2V8z" />
        <line x1="9" y1="10" x2="15" y2="10" />
        <line x1="9" y1="14" x2="15" y2="14" />
      </svg>
    ),
    steps: [
      { title: "เปิดหน้าค่าใช้จ่าย", desc: "เข้าผ่านเมนูหลักหรือแท็บ \"ค่าใช้จ่าย\" ในกลุ่ม จะแสดงรายการบิลทั้งหมดของกลุ่มนั้น" },
      { title: "เพิ่มบิลใหม่", desc: "กด \"+ เพิ่มบิล\" ใส่ชื่อรายการ จำนวนเงิน ผู้จ่าย และเลือกสมาชิกที่ร่วมจ่ายด้วย" },
      { title: "แนบหลักฐาน (ไม่บังคับ)", desc: "ถ่ายรูปใบเสร็จหรือสลิปแนบไปพร้อมบิล เพื่อให้ทุกคนตรวจสอบได้ รองรับรูปภาพทุกรูปแบบ" },
      { title: "ดูสรุปยอดคงค้าง", desc: "ระบบคำนวณอัตโนมัติว่าใครต้องจ่ายใครคืนเท่าไร แสดงในแท็บ \"การเงิน\" ของกลุ่ม" },
    ],
  },
  {
    id: "finance",
    name: "ระบบการเงิน",
    desc: "ดูยอดคงค้างและจัดการการชำระเงิน",
    tone: "emerald",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
    steps: [
      { title: "เข้าแท็บ \"การเงิน\" ในกลุ่ม", desc: "ดูสรุปยอดที่ต้องรับและจ่ายทั้งหมด ระบบ Netting คำนวณให้โอนน้อยครั้งที่สุด" },
      { title: "ตั้งค่าบัญชีรับเงิน", desc: "ไปที่โปรไฟล์ เพิ่มเลขบัญชีธนาคารหรือ PromptPay เพื่อให้คนอื่นโอนเงินมาได้" },
      { title: "ชำระเงินและแนบสลิป", desc: "กดปุ่ม \"ชำระเงิน\" แนบรูปสลิปการโอน ระบบจะแจ้งเจ้าของบัญชีให้ตรวจสอบ" },
      { title: "ยืนยันการรับเงิน", desc: "เจ้าของบัญชีตรวจสลิปแล้วกดยืนยัน ยอดคงค้างจะอัปเดตอัตโนมัติ ติดตามสถานะได้ตลอดเวลา" },
    ],
  },
  {
    id: "profile",
    name: "โปรไฟล์และตั้งค่า",
    desc: "จัดการข้อมูลบัญชีและปรับแต่งธีม",
    tone: "violet",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    steps: [
      { title: "เข้าหน้าโปรไฟล์", desc: "กดรูปโปรไฟล์บน Topbar หรือเลือกเมนู \"โปรไฟล์\" ดูข้อมูลบัญชี LINE ของคุณ" },
      { title: "เพิ่มบัญชีรับเงิน", desc: "เพิ่มเลขบัญชีธนาคาร หรือ PromptPay (เบอร์โทร/เลขบัตร) เพื่อให้สมาชิกกลุ่มโอนเงินมาได้" },
      { title: "เปลี่ยนธีมสี", desc: "เลือกธีมสำเร็จรูป 6 แบบ หรือกำหนดสีเองใน \"ธีมกำหนดเอง\" ธีมบันทึกในบัญชีของคุณ" },
      { title: "ตั้งรูปพื้นหลัง", desc: "อัปโหลดรูปพื้นหลังแอปได้เลย ปรับให้เข้ากับธีมสีที่เลือก แอปจะดูเป็นส่วนตัวมากขึ้น" },
    ],
  },
];

const TONE_MAP = {
  emerald: { from: "#06c755", to: "#04a346", soft: "rgba(6,199,85,0.12)", shadow: "rgba(6,199,85,0.32)" },
  ocean:   { from: "#2374ab", to: "#1e5b86", soft: "rgba(35,116,171,0.12)", shadow: "rgba(35,116,171,0.32)" },
  sunset:  { from: "#f59f00", to: "#e8590c", soft: "rgba(245,159,0,0.14)", shadow: "rgba(245,159,0,0.32)" },
  violet:  { from: "#845ef7", to: "#5f3dc4", soft: "rgba(132,94,247,0.14)", shadow: "rgba(132,94,247,0.32)" },
};

function GuideSheet({ guide, onClose }) {
  const tone = TONE_MAP[guide.tone];
  return (
    <>
      <div className="guide-sheet-overlay" onClick={onClose} />
      <div
        className="guide-sheet"
        style={{ "--tone-from": tone.from, "--tone-to": tone.to, "--tone-shadow": tone.shadow }}
        role="dialog"
        aria-modal="true"
      >
        <div className="guide-sheet-handle" />
        <div className="guide-sheet-header">
          <span
            className="menu-card-icon"
            style={{ "--tone-from": tone.from, "--tone-to": tone.to, "--tone-shadow": tone.shadow, width: 46, height: 46 }}
          >
            {guide.icon}
          </span>
          <div className="guide-sheet-header-text">
            <h2>{guide.name}</h2>
            <p>{guide.desc}</p>
          </div>
          <button className="guide-sheet-close" onClick={onClose} type="button" aria-label="ปิด">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="guide-steps-list">
          {guide.steps.map((s, i) => (
            <div className="guide-step-item" key={i}>
              <div
                className="guide-step-num"
                style={{ "--tone-from": tone.from, "--tone-to": tone.to, "--tone-shadow": tone.shadow }}
              >
                {i + 1}
              </div>
              <div className="guide-step-content">
                <h4>{s.title}</h4>
                <p>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function GuideMenu() {
  const { replayWelcome } = useTutorial();
  const [openGuideId, setOpenGuideId] = useState(null);

  const activeGuide = GUIDES.find((g) => g.id === openGuideId);

  return (
    <>
      <div className="page-header">
        <div>
          <Link to="/menu" className="btn-back-inline">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            กลับเมนูหลัก
          </Link>
          <h1 className="page-title" style={{ marginTop: 10 }}>คู่มือการใช้งาน</h1>
          <p className="page-subtitle">เรียนรู้การใช้งานแต่ละฟีเจอร์ทีละขั้นตอน</p>
        </div>
      </div>

      <div className="guide-grid">
        {GUIDES.map((guide) => {
          const tone = TONE_MAP[guide.tone];
          return (
            <div
              key={guide.id}
              className="guide-card"
              style={{ "--tone-from": tone.from, "--tone-to": tone.to, "--tone-soft": tone.soft, "--tone-shadow": tone.shadow }}
              onClick={() => setOpenGuideId(guide.id)}
            >
              <div className="guide-card-top">
                <span className="menu-card-icon" style={{ width: 46, height: 46, fontSize: "0.85rem" }}>
                  {guide.icon}
                </span>
              </div>
              <div className="guide-card-body">
                <h3>{guide.name}</h3>
                <p>{guide.desc}</p>
              </div>
              <div className="guide-card-footer">
                <span className="guide-step-count">{guide.steps.length} ขั้นตอน</span>
                <span className="guide-open-btn">
                  ดูคู่มือ
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="guide-reset-section">
        <div>
          <p style={{ fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>เล่น Tutorial แรกเข้าอีกครั้ง</p>
          <p>ดูภาพรวมฟีเจอร์ทั้งหมดได้ใหม่ทุกเมื่อ</p>
        </div>
        <button className="btn-guide-reset" onClick={replayWelcome} type="button">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 .49-3.5" />
          </svg>
          เล่นซ้ำ Tutorial
        </button>
      </div>

      {activeGuide && (
        <GuideSheet guide={activeGuide} onClose={() => setOpenGuideId(null)} />
      )}
    </>
  );
}

export default GuideMenu;
