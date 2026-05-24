import { useEffect, useRef } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useTutorial } from "../TutorialContext";

const featureRow = (items) =>
  `<ul class="dv-list">${items.map((t) => `<li>${t}</li>`).join("")}</ul>`;

const STEPS = [
  {
    popover: {
      title: "🎉 ยินดีต้อนรับ!",
      description:
        `<p>LINE Group Planner ช่วยกลุ่มเพื่อนวางแผนกิจกรรม แบ่งค่าใช้จ่าย และหาวันว่างตรงกัน</p>` +
        featureRow(["👥 จัดการกลุ่มเพื่อน", "📅 หาวันว่างที่ตรงกัน", "💸 แบ่งค่าใช้จ่ายอย่างยุติธรรม"]),
    },
  },
  {
    element: '[data-guide="dashboard"]',
    popover: {
      title: "👥 กลุ่มของฉัน",
      description:
        `<p>ดูกลุ่มทั้งหมดที่คุณเป็นสมาชิก <strong>กดที่การ์ดกลุ่ม</strong> เพื่อเข้าไปดูสมาชิกและฟีเจอร์ต่างๆ ภายในกลุ่มนั้น</p>` +
        featureRow(["📋 ดูรายการกลุ่มทั้งหมด", "👤 ดูสมาชิกในกลุ่ม", "🔗 แชร์ลิงก์เชิญเพื่อน"]),
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-guide="calendar"]',
    popover: {
      title: "📅 ปฏิทินวันว่าง",
      description:
        `<p>ทุกคนเลือกวันที่ว่างของตัวเอง ระบบแสดงวันที่ทุกคนว่างตรงกันโดยอัตโนมัติ</p>` +
        featureRow(["🗓️ คลิกเลือกวันที่ว่างของคุณ", "🟢 สีเข้ม = ว่างมากคน", "🎯 หาวันนัดที่ดีที่สุด"]),
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-guide="timeline"]',
    popover: {
      title: "⏰ Timeline กิจกรรม",
      description:
        `<p>จัดตารางกิจกรรมพร้อมวัน เวลา สถานที่ และลิงก์แผนที่ ทุกคนในกลุ่มเห็นเหมือนกัน</p>` +
        featureRow(["📍 ระบุสถานที่พร้อมลิงก์แผนที่", "⏰ กำหนดวันและเวลา", "📝 เพิ่มหมายเหตุได้"]),
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-guide="bills"]',
    popover: {
      title: "🧾 ค่าใช้จ่าย",
      description:
        `<p>บันทึกบิลและระบุผู้ร่วมจ่าย ระบบคำนวณว่าใครต้องโอนให้ใครเท่าไรโดยอัตโนมัติ</p>` +
        featureRow(["🧾 บันทึกบิลพร้อมหลักฐาน", "🤝 ระบบ Netting คำนวณเอง", "✅ ยืนยันการจ่ายด้วยสลิป"]),
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-guide="creategroup"]',
    popover: {
      title: "➕ สร้าง / เข้าร่วมกลุ่ม",
      description:
        `<p>สร้างกลุ่มใหม่หรือกรอกรหัส 8 หลักเพื่อเข้าร่วมกลุ่มของเพื่อน</p>` +
        featureRow(["✨ สร้างกลุ่มและรับรหัสเชิญทันที", "🎟️ เข้าร่วมด้วยรหัส 8 หลัก", "📱 แชร์ลิงก์ผ่าน LINE ได้เลย"]),
      side: "top",
      align: "start",
    },
  },
  {
    element: '[data-guide="profile"]',
    popover: {
      title: "👤 โปรไฟล์",
      description:
        `<p>ตั้งค่าบัญชีรับเงิน ปรับธีมสี และตั้งรูปพื้นหลังให้แอปเป็นส่วนตัวของคุณ</p>` +
        featureRow(["🏦 เพิ่มบัญชีธนาคาร / พร้อมเพย์", "🎨 เปลี่ยนธีมสี 6 แบบ", "🖼️ ตั้งรูปพื้นหลังแอป"]),
      side: "top",
      align: "start",
    },
  },
  {
    popover: {
      title: "🚀 พร้อมใช้งานแล้ว!",
      description:
        `<p>เริ่มต้นด้วยการสร้างกลุ่มแรกและเชิญเพื่อนเข้ามาร่วมได้เลย</p>` +
        featureRow(["🚀 กด \"สร้าง / เข้าร่วม\" เพื่อเริ่ม", "📖 ดูคู่มือละเอียดได้ที่ปุ่มด้านล่าง", "🎉 ขอให้สนุกกับการใช้งาน!"]),
    },
  },
];

function GuideTutorial() {
  const { showWelcome, completeWelcome } = useTutorial();
  const driverRef = useRef(null);

  useEffect(() => {
    if (!showWelcome) {
      driverRef.current?.destroy();
      return;
    }

    const dObj = driver({
      showProgress: true,
      allowClose: true,
      overlayOpacity: 0.72,
      smoothScroll: true,
      overlayColor: "#000",
      nextBtnText: "ถัดไป →",
      prevBtnText: "← ย้อนกลับ",
      doneBtnText: "เริ่มใช้งาน 🚀",
      progressText: "{{current}} / {{total}}",
      popoverClass: "dv-popover",
      onDestroyStarted: () => {
        completeWelcome();
        dObj.destroy();
      },
      steps: STEPS,
    });

    driverRef.current = dObj;
    dObj.drive();

    return () => { dObj.destroy(); };
  }, [showWelcome, completeWelcome]);

  return null;
}

export default GuideTutorial;
