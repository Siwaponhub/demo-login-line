import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Calendar from "react-calendar";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import Swal from "sweetalert2";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import "react-calendar/dist/Calendar.css";
import BackHomeButtons from "./BackHomeButtons";
import "./calendar.css";

const thaiDays = [
  "วันอาทิตย์",
  "วันจันทร์",
  "วันอังคาร",
  "วันพุธ",
  "วันพฤหัสบดี",
  "วันศุกร์",
  "วันเสาร์",
];

const thaiMonths = [
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

const formatDateStr = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatThaiDate = (date) => {
  const day = date.getDate();
  const month = thaiMonths[date.getMonth()];
  const year = date.getFullYear() + 543;
  return `${thaiDays[date.getDay()]}ที่ ${day} ${month} ${year}`;
};

const isWeekend = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

function AvailabilityCalendar() {
  const { id } = useParams();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [filter, setFilter] = useState("weekend");
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

  const handleSelectDate = async (date) => {
    if (!user || !group) return;

    const dateStr = formatDateStr(date);
    const formattedDate = formatThaiDate(date);
    const availability = group.availability || {};
    const userDates = new Set(availability[user.userId] || []);
    const willRemove = userDates.has(dateStr);

    const result = await Swal.fire({
      icon: willRemove ? "question" : "warning",
      title: willRemove ? "ยกเลิกวันที่ไม่ว่าง?" : "บันทึกว่าไม่ว่าง?",
      text: formattedDate,
      showCancelButton: true,
      confirmButtonText: willRemove ? "ยกเลิกวันไม่ว่าง" : "บันทึก",
      cancelButtonText: "ปิด",
      confirmButtonColor: willRemove ? "#198754" : "#dc3545",
    });
    if (!result.isConfirmed) return;

    if (willRemove) {
      userDates.delete(dateStr);
    } else {
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
    Swal.fire("สำเร็จ", "อัปเดตปฏิทินเรียบร้อย", "success");
  };

  const getCommonAvailableDates = () => {
    if (!group?.availability) return [];

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
      if (!allUnavailable[dateStr]) result.push(dateStr);
    }

    return result;
  };

  if (!group) {
    return (
      <div className="soft-card empty-state">
        <div className="spinner-border text-success" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3 mb-0">กำลังโหลดปฏิทิน...</p>
      </div>
    );
  }

  const commonDates = getCommonAvailableDates();
  const unavailableTable = [];

  for (const [uid, dates] of Object.entries(group.availability || {})) {
    const member = group.members.find((m) => m.userId === uid);
    if (!member) continue;

    dates.forEach((d) => {
      const dateObj = new Date(d);
      if (
        dateObj.getMonth() !== activeMonth.getMonth() ||
        dateObj.getFullYear() !== activeMonth.getFullYear()
      ) {
        return;
      }

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
    <>
      <section className="page-header">
        <div>
          <h1 className="page-title">ปฏิทินวันว่าง</h1>
          <p className="page-subtitle">
            {group.name} กดวันที่เพื่อบันทึกว่าไม่ว่าง วันที่สีเขียวคือทุกคนยังว่าง
          </p>
        </div>
      </section>

      <section className="calendar-layout">
        <div className="soft-card p-3 p-md-4">
          <Calendar
            onClickDay={handleSelectDate}
            onActiveStartDateChange={({ activeStartDate }) =>
              setActiveMonth(activeStartDate)
            }
            tileClassName={({ date }) => {
              const dateStr = formatDateStr(date);
              const userUnavailable = group.availability?.[user?.userId] || [];

              if (userUnavailable.includes(dateStr)) return "is-unavailable";
              if (commonDates.includes(dateStr)) return "is-common";
              return "";
            }}
            tileContent={({ date }) => {
              const dateStr = formatDateStr(date);
              const unavailableMembers = group.members.filter((m) =>
                group.availability?.[m.userId]?.includes(dateStr)
              );

              if (unavailableMembers.length === 0) return null;

              return (
                <div className="calendar-avatars">
                  {unavailableMembers.slice(0, 3).map((m) => (
                    <img
                      key={m.userId}
                      src={m.picture || "https://via.placeholder.com/20"}
                      alt={m.name}
                      title={m.name}
                    />
                  ))}
                  {unavailableMembers.length > 3 && (
                    <span>+{unavailableMembers.length - 3}</span>
                  )}
                </div>
              );
            }}
          />

          <div className="btn-group w-100 mt-3" role="group" aria-label="filter">
            <button
              className={`btn btn-outline-success ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              ทั้งหมด
            </button>
            <button
              className={`btn btn-outline-success ${filter === "weekend" ? "active" : ""}`}
              onClick={() => setFilter("weekend")}
            >
              เสาร์-อาทิตย์
            </button>
            <button
              className={`btn btn-outline-success ${filter === "weekday" ? "active" : ""}`}
              onClick={() => setFilter("weekday")}
            >
              วันธรรมดา
            </button>
          </div>
        </div>

        <aside className="d-grid gap-3">
          <div className="soft-card p-4">
            <h2 className="h5 fw-bold">วันที่ว่างตรงกัน</h2>
            {commonDates.length > 0 ? (
              <div className="list-group list-group-flush">
                {commonDates.map((d) => (
                  <div key={d} className="list-group-item px-0">
                    {formatThaiDate(new Date(d))}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted mb-0">ยังไม่มีวันที่ว่างตรงกัน</p>
            )}
          </div>

          <div className="soft-card p-4">
            <h2 className="h5 fw-bold">คนที่ไม่ว่าง</h2>
            {unavailableTable.length > 0 ? (
              <div className="list-group list-group-flush">
                {unavailableTable.map((row, idx) => (
                  <div key={`${row.member}-${idx}`} className="list-group-item px-0 d-flex gap-2">
                    <img
                      src={row.picture || "https://via.placeholder.com/30"}
                      alt={row.member}
                      className="avatar"
                    />
                    <span>
                      <strong>{row.member}</strong>
                      <small className="d-block text-muted">{row.formatted}</small>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted mb-0">ยังไม่มีข้อมูลคนไม่ว่าง</p>
            )}
          </div>
        </aside>
      </section>

      <BackHomeButtons />
    </>
  );
}

export default AvailabilityCalendar;
