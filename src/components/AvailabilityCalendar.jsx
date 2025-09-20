import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Calendar from "react-calendar";
import { db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import Swal from "sweetalert2";
import "react-calendar/dist/Calendar.css";
import BackHomeButtons from "./BackHomeButtons";
import "./calendar.css";

// ================= Helper =================
const getThaiDay = (date) => {
  const days = [
    "วันอาทิตย์",
    "วันจันทร์",
    "วันอังคาร",
    "วันพุธ",
    "วันพฤหัสบดี",
    "วันศุกร์",
    "วันเสาร์",
  ];
  return days[date.getDay()];
};

const getThaiMonth = (monthIndex) => {
  const months = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];
  return months[monthIndex];
};

// คืน string YYYY-MM-DD ตาม local timezone
const formatDateStr = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// คืนข้อความไทยสวยๆ เช่น "วันเสาร์ที่ 20 กันยายน 2568"
const formatThaiDate = (date) => {
  const day = date.getDate();
  const month = getThaiMonth(date.getMonth());
  const year = date.getFullYear() + 543;
  return `${getThaiDay(date)}ที่ ${day} ${month} ${year}`;
};

const isWeekend = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6; // อาทิตย์=0, เสาร์=6
};

// =========================================

function AvailabilityCalendar() {
  const { id } = useParams();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [filter, setFilter] = useState("weekend"); // ✅ default = เสาร์-อาทิตย์
  const [activeMonth, setActiveMonth] = useState(new Date());

  useEffect(() => {
    if (id) fetchGroup(id);
  }, [id]);

  const fetchGroup = async (gid) => {
    const ref = doc(db, "groups", gid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      setGroup({ id: snap.id, ...snap.data() });
    }
  };

  // เลือก/ยกเลิกวันไม่ว่าง
  const handleSelectDate = async (date) => {
    if (!user || !group) return;
    const dateStr = formatDateStr(date);
    const formattedDate = formatThaiDate(date);

    const availability = group.availability || {};
    const userDates = new Set(availability[user.userId] || []);

    if (userDates.has(dateStr)) {
      // ✅ ยกเลิกวันไม่ว่าง
      const result = await Swal.fire({
        icon: "question",
        title: "ยืนยัน?",
        text: `คุณต้องการยกเลิกวันที่ไม่ว่าง: ${formattedDate} ใช่หรือไม่?`,
        showCancelButton: true,
        confirmButtonText: "ใช่, ลบออก",
        cancelButtonText: "ยกเลิก",
      });
      if (!result.isConfirmed) return;
      userDates.delete(dateStr);
    } else {
      // ✅ เพิ่มวันไม่ว่าง
      const result = await Swal.fire({
        icon: "warning",
        title: "ยืนยัน?",
        text: `คุณต้องการบันทึกว่าไม่ว่างใน: ${formattedDate} ใช่หรือไม่?`,
        showCancelButton: true,
        confirmButtonText: "ใช่, บันทึก",
        cancelButtonText: "ยกเลิก",
      });
      if (!result.isConfirmed) return;
      userDates.add(dateStr);
    }

    const newAvailability = {
      ...availability,
      [user.userId]: Array.from(userDates),
    };

    await updateDoc(doc(db, "groups", group.id), {
      availability: newAvailability,
    });
    setGroup({ ...group, availability: newAvailability });
    Swal.fire("✅ สำเร็จ", "อัปเดตวันไม่ว่างเรียบร้อย", "success");
  };

  // คืนวันว่างตรงกันเฉพาะเดือนปัจจุบัน
  const getCommonAvailableDates = () => {
    if (!group?.availability) return [];

    const membersWithData = Object.keys(group.availability);
    if (membersWithData.length === 0) return [];

    const allUnavailable = {};
    for (const dates of Object.values(group.availability)) {
      dates.forEach((d) => {
        allUnavailable[d] = (allUnavailable[d] || 0) + 1;
      });
    }

    const year = activeMonth.getFullYear();
    const month = activeMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const result = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const dateStr = formatDateStr(d);

      if (filter === "weekend" && !isWeekend(d)) continue;
      if (filter === "weekday" && isWeekend(d)) continue;

      const unavailableCount = allUnavailable[dateStr] || 0;
      if (unavailableCount === 0) {
        result.push(dateStr);
      }
    }

    return result;
  };

  if (!group) return <p className="text-center mt-4">⏳ กำลังโหลด...</p>;

  const commonDates = getCommonAvailableDates();

  // ตารางคนไม่ว่าง เฉพาะเดือนที่เลือก
  const unavailableTable = [];
  for (const [uid, dates] of Object.entries(group.availability || {})) {
    const member = group.members.find((m) => m.userId === uid);
    if (!member) continue;
    dates.forEach((d) => {
      const dateObj = new Date(d);
      if (
        dateObj.getMonth() !== activeMonth.getMonth() ||
        dateObj.getFullYear() !== activeMonth.getFullYear()
      )
        return;

      if (filter === "weekend" && !isWeekend(dateObj)) return;
      if (filter === "weekday" && isWeekend(dateObj)) return;

      unavailableTable.push({
        formatted: formatThaiDate(dateObj),
        member: member.name,
        picture: member.picture,
      });
    });
  }

  return (
    <div className="container mt-4">
      <div className="card shadow rounded-4 p-3">
        <h3 className="mb-3 text-info">📅 ปฏิทินวันว่าง - {group.name}</h3>

        {/* Filter */}
        <div className="mb-3">
          <select
            className="form-select"
            style={{ maxWidth: "200px" }}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">ทั้งหมด</option>
            <option value="weekend">เฉพาะเสาร์-อาทิตย์</option>
            <option value="weekday">เฉพาะวันธรรมดา</option>
          </select>
        </div>

        <Calendar
          onClickDay={handleSelectDate}
          onActiveStartDateChange={({ activeStartDate }) =>
            setActiveMonth(activeStartDate)
          }
          tileClassName={({ date }) => {
            const dateStr = formatDateStr(date);
            const userUnavailable = group.availability?.[user?.userId] || [];

            if (userUnavailable.includes(dateStr)) {
              return "bg-danger bg-opacity-25"; // user ไม่ว่าง
            }
            if (commonDates.includes(dateStr)) {
              return "bg-success bg-opacity-25"; // วันว่างตรงกัน
            }
            return "";
          }}
          tileContent={({ date }) => {
            const dateStr = formatDateStr(date);
            const unavailableMembers = group.members.filter((m) =>
              group.availability?.[m.userId]?.includes(dateStr)
            );

            if (unavailableMembers.length === 0) return null;

            return (
              <div className="d-flex justify-content-center mt-1">
                {unavailableMembers.slice(0, 3).map((m) => (
                  <img
                    key={m.userId}
                    src={m.picture || "https://via.placeholder.com/20"}
                    alt={m.name}
                    title={m.name}
                    className="rounded-circle border"
                    style={{
                      width: "18px",
                      height: "18px",
                      objectFit: "cover",
                      marginRight: "-6px",
                      border: "1px solid #fff",
                    }}
                  />
                ))}
                {unavailableMembers.length > 3 && (
                  <span className="badge bg-secondary ms-1">
                    +{unavailableMembers.length - 3}
                  </span>
                )}
              </div>
            );
          }}
        />

        {/* ✅ ใครไม่ว่าง */}
        <h5 className="mt-4">❌ ใครไม่ว่าง</h5>
        {unavailableTable.length > 0 ? (
          <ul className="list-group">
            {unavailableTable.map((row, idx) => (
              <li
                key={idx}
                className="list-group-item d-flex align-items-center"
              >
                <img
                  src={row.picture || "https://via.placeholder.com/30"}
                  alt={row.member}
                  className="rounded-circle me-2"
                  style={{ width: "30px", height: "30px" }}
                />
                {row.member} {row.formatted}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">ยังไม่มีข้อมูลคนไม่ว่าง</p>
        )}

        {/* ✅ วันว่างตรงกัน */}
        <h5 className="mt-4">✅ วันว่างตรงกัน</h5>
        {commonDates.length > 0 ? (
          <ul className="list-group">
            {commonDates.map((d) => (
              <li key={d} className="list-group-item">
                {formatThaiDate(new Date(d))}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">ยังไม่มีวันว่างตรงกัน</p>
        )}
      </div>

      <BackHomeButtons />
    </div>
  );
}

export default AvailabilityCalendar;
