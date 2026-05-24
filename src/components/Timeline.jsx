import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import Swal from "sweetalert2";
import { db } from "../firebase";
import {
  addTimelineItem,
  deleteTimelineItem,
  getTimelineItems,
  updateTimelineItem,
} from "../services/timelineService";
import { useAuth } from "../AuthContext";
import BackHomeButtons from "./BackHomeButtons";
import PageGuideButton from "./PageGuideButton";

const GUIDE_STEPS = [
  {
    element: '[data-guide="tl-add-btn"]',
    popover: {
      title: "➕ เพิ่มกิจกรรม",
      description: "<p>กดปุ่มนี้เพื่อเปิดฟอร์มเพิ่มกิจกรรมใหม่ กรอกชื่อ วัน เวลา สถานที่ และลิงก์แผนที่</p><ul class='dv-list'><li>📅 เลือก Day ของทริป (วันที่ 1, 2, 3...)</li><li>⏰ ระบุเวลาเริ่มและสิ้นสุด</li><li>📍 ใส่ลิงก์ Google Maps ได้เลย</li></ul>",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: '[data-guide="tl-list"]',
    popover: {
      title: "📋 แผนกิจกรรมทั้งหมด",
      description: "<p>รายการกิจกรรมจัดเรียงตาม Day และเวลา กดแท็บวันเพื่อดูกิจกรรมในแต่ละวัน</p><ul class='dv-list'><li>🗂️ กดแท็บ Day เพื่อข้ามไปแต่ละวัน</li><li>✏️ กดแก้ไขหรือลบกิจกรรมแต่ละรายการ</li><li>🗺️ กดลิงก์แผนที่เพื่อเปิด Google Maps</li></ul>",
      side: "top",
      align: "start",
    },
  },
];

const emptyForm = {
  dayNumber: 1,
  title: "",
  date: "",
  startTime: "",
  endTime: "",
  place: "",
  mapLink: "",
  note: "",
};

const hours = Array.from({ length: 24 }, (_, index) =>
  String(index).padStart(2, "0")
);
const minutes = ["00", "15", "30", "45"];

const splitTime = (value) => {
  const [hour = "", minute = ""] = (value || "").split(":");
  return { hour, minute };
};

const formatDate = (dateValue) => {
  if (!dateValue) return "";
  return new Date(`${dateValue}T00:00:00`).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

function TimeSelect({ label, value, onChange }) {
  const { hour, minute } = splitTime(value);

  const updateTime = (nextHour, nextMinute) => {
    if (!nextHour && !nextMinute) {
      onChange("");
      return;
    }
    onChange(`${nextHour || "00"}:${nextMinute || "00"}`);
  };

  return (
    <div>
      <label className="form-label fw-bold">{label}</label>
      <div className="time-select-group">
        <select
          className="form-control"
          value={hour}
          onChange={(event) => updateTime(event.target.value, minute)}
        >
          <option value="">ชั่วโมง</option>
          {hours.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span>:</span>
        <select
          className="form-control"
          value={minute}
          onChange={(event) => updateTime(hour, event.target.value)}
        >
          <option value="">นาที</option>
          {minutes.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function Timeline() {
  const { id } = useParams();
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [group, setGroup] = useState(null);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [dayDateDrafts, setDayDateDrafts] = useState({});
  const [activeDayNumber, setActiveDayNumber] = useState(null);

  const isGroupRoute = Boolean(id);

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        const dayA = Number(a.dayNumber || 1);
        const dayB = Number(b.dayNumber || 1);
        if (dayA !== dayB) return dayA - dayB;
        return `${a.date || ""} ${a.startTime || a.time || ""}`.localeCompare(
          `${b.date || ""} ${b.startTime || b.time || ""}`
        );
      }),
    [items]
  );

  const groupedItems = useMemo(() => {
    const groupsByDay = new Map();
    sortedItems.forEach((item) => {
      const dayNumber = Number(item.dayNumber || 1);
      if (!groupsByDay.has(dayNumber)) groupsByDay.set(dayNumber, []);
      groupsByDay.get(dayNumber).push(item);
    });

    return Array.from(groupsByDay.entries()).map(([dayNumber, dayItems]) => ({
      dayNumber,
      date: dayItems.find((item) => item.date)?.date || "",
      items: dayItems,
    }));
  }, [sortedItems]);

  useEffect(() => {
    setDayDateDrafts((current) => {
      const next = { ...current };
      groupedItems.forEach((dayGroup) => {
        if (next[dayGroup.dayNumber] === undefined) {
          next[dayGroup.dayNumber] = dayGroup.date || "";
        }
      });
      return next;
    });
  }, [groupedItems]);

  useEffect(() => {
    if (groupedItems.length === 0) {
      setActiveDayNumber(null);
      return;
    }

    const stillExists = groupedItems.some(
      (dayGroup) => dayGroup.dayNumber === activeDayNumber
    );
    if (!stillExists) setActiveDayNumber(groupedItems[0].dayNumber);
  }, [activeDayNumber, groupedItems]);

  const activeDayGroup = useMemo(
    () =>
      groupedItems.find((dayGroup) => dayGroup.dayNumber === activeDayNumber) ||
      groupedItems[0],
    [activeDayNumber, groupedItems]
  );

  const fetchGroups = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, "groups"));
      const allGroups = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setGroups(
        allGroups.filter(
          (g) =>
            g.ownerId === user.userId ||
            g.members?.some((member) => member.userId === user.userId)
        )
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchGroupTimeline = useCallback(async (groupId) => {
    try {
      setLoading(true);
      const groupSnap = await getDoc(doc(db, "groups", groupId));
      if (!groupSnap.exists()) {
        setGroup(null);
        setItems([]);
        return;
      }
      setGroup({ id: groupSnap.id, ...groupSnap.data() });
      setItems(await getTimelineItems(groupId));
    } catch (err) {
      console.error(err);
      Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถโหลด timeline ได้", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isGroupRoute) {
      fetchGroupTimeline(id);
    } else {
      fetchGroups();
    }
  }, [fetchGroupTimeline, fetchGroups, id, isGroupRoute]);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    setForm({
      ...emptyForm,
      dayNumber: activeDayNumber || groupedItems.at(-1)?.dayNumber || 1,
    });
    setEditingId(null);
    setShowForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.title.trim() || !form.date || !form.startTime) {
      Swal.fire("ข้อมูลไม่ครบ", "กรอกชื่อกิจกรรม วัน และเวลาเริ่มต้น", "info");
      return;
    }

    if (form.endTime && form.endTime < form.startTime) {
      Swal.fire("เวลาไม่ถูกต้อง", "เวลาสิ้นสุดต้องไม่เร็วกว่าเวลาเริ่มต้น", "info");
      return;
    }

    const payload = {
      dayNumber: Number(form.dayNumber || 1),
      title: form.title.trim(),
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      place: form.place.trim(),
      mapLink: form.mapLink.trim(),
      note: form.note.trim(),
      updatedBy: user.userId,
    };

    try {
      if (editingId) {
        await updateTimelineItem(id, editingId, payload);
        Swal.fire("สำเร็จ", "แก้ไขกิจกรรมแล้ว", "success");
      } else {
        await addTimelineItem(id, {
          ...payload,
          createdBy: user.userId,
        });
        Swal.fire("สำเร็จ", "เพิ่มกิจกรรมแล้ว", "success");
      }

      resetForm();
      setActiveDayNumber(payload.dayNumber);
      setItems(await getTimelineItems(id));
    } catch (err) {
      console.error(err);
      Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถบันทึกกิจกรรมได้", "error");
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setForm({
      dayNumber: Number(item.dayNumber || 1),
      title: item.title || "",
      date: item.date || "",
      startTime: item.startTime || item.time || "",
      endTime: item.endTime || "",
      place: item.place || "",
      mapLink: item.mapLink || "",
      note: item.note || "",
    });
    setActiveDayNumber(Number(item.dayNumber || 1));
    setShowForm(true);
  };

  const handleDelete = async (itemId) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "ลบกิจกรรมนี้?",
      text: "ข้อมูลกิจกรรมจะถูกลบออกจาก timeline",
      showCancelButton: true,
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#dc3545",
    });
    if (!result.isConfirmed) return;

    await deleteTimelineItem(id, itemId);
    setItems(items.filter((item) => item.id !== itemId));
    Swal.fire("สำเร็จ", "ลบกิจกรรมแล้ว", "success");
  };

  const handleDayDateChange = (dayNumber, value) => {
    setDayDateDrafts((current) => ({
      ...current,
      [dayNumber]: value,
    }));
  };

  const handleSaveDayDate = async (dayGroup) => {
    const nextDate = dayDateDrafts[dayGroup.dayNumber] || "";
    if (!nextDate) {
      Swal.fire("เลือกวันที่ก่อน", "กรุณาเลือกวันที่ของ Day นี้", "info");
      return;
    }

    try {
      await Promise.all(
        dayGroup.items.map((item) =>
          updateTimelineItem(id, item.id, {
            date: nextDate,
            updatedBy: user.userId,
          })
        )
      );
      setItems((current) =>
        current.map((item) =>
          Number(item.dayNumber || 1) === dayGroup.dayNumber
            ? { ...item, date: nextDate }
            : item
        )
      );
      Swal.fire("สำเร็จ", `อัปเดตวันที่ของ Day ${dayGroup.dayNumber} แล้ว`, "success");
    } catch (err) {
      console.error(err);
      Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถอัปเดตวันที่ของ Day นี้ได้", "error");
    }
  };

  if (!isGroupRoute) {
    return (
      <>
        <section className="page-header">
          <div>
            <h1 className="page-title">Timeline กิจกรรม</h1>
            <p className="page-subtitle">เลือกกลุ่มเพื่อเพิ่มหรือจัดการแผนกิจกรรมของทริป</p>
          </div>
        </section>

        {loading ? (
          <div className="soft-card empty-state">กำลังโหลดข้อมูลกลุ่ม...</div>
        ) : groups.length === 0 ? (
          <div className="soft-card empty-state">ยังไม่มีกลุ่มที่เข้าร่วม</div>
        ) : (
          <div className="section-grid">
            {groups.map((g) => (
              <Link key={g.id} to={`/group/${g.id}?tab=timeline`} className="menu-card">
                <span className="tile-icon warn">T</span>
                <span>
                  <h2>{g.name}</h2>
                  <p>จัดการ timeline กิจกรรม</p>
                </span>
              </Link>
            ))}
          </div>
        )}

        <BackHomeButtons />
      </>
    );
  }

  if (loading) {
    return <div className="soft-card empty-state">กำลังโหลด timeline...</div>;
  }

  if (!group) {
    return <div className="soft-card empty-state">ไม่พบกลุ่มนี้</div>;
  }

  return (
    <>
      <section className="page-header">
        <div>
          <h1 className="page-title">Timeline กิจกรรม</h1>
          <p className="page-subtitle">{group.name}</p>
        </div>
        <div className="d-flex gap-2 align-items-center flex-wrap">
          <PageGuideButton steps={GUIDE_STEPS} />
          <button className="btn btn-success px-4 py-3" onClick={openCreateForm} data-guide="tl-add-btn">
            เพิ่มกิจกรรม
          </button>
        </div>
      </section>

      {showForm && (
        <form className="soft-card p-4 mb-4" onSubmit={handleSubmit}>
          <div className="d-flex justify-content-between align-items-start gap-3">
            <div>
              <h2 className="h4 fw-bold mb-1">
                {editingId ? "แก้ไขกิจกรรม" : "เพิ่มกิจกรรม"}
              </h2>
              <p className="text-muted mb-0">
                เลือก Day ของทริป เวลาแบบ 24 ชั่วโมง สถานที่ และลิงก์แผนที่
              </p>
            </div>
            <button className="btn btn-light border" type="button" onClick={resetForm}>
              ปิด
            </button>
          </div>

          <div className="row g-3 mt-1">
            <div className="col-12 col-lg-3">
              <label className="form-label fw-bold">Day</label>
              <input
                type="number"
                min="1"
                className="form-control"
                value={form.dayNumber}
                onChange={(event) => updateForm("dayNumber", event.target.value)}
              />
            </div>
            <div className="col-12 col-lg-9">
              <label className="form-label fw-bold">ชื่อกิจกรรม</label>
              <input
                className="form-control"
                value={form.title}
                onChange={(event) => updateForm("title", event.target.value)}
                placeholder="เช่น เดินทางไปสนามบิน"
              />
            </div>
          </div>

          <div className="row g-3 mt-1">
            <div className="col-12 col-lg-4">
              <label className="form-label fw-bold">วันที่</label>
              <input
                type="date"
                className="form-control"
                value={form.date}
                onChange={(event) => updateForm("date", event.target.value)}
              />
            </div>
            <div className="col-12 col-md-6 col-lg-4">
              <TimeSelect
                label="เวลาเริ่มต้น"
                value={form.startTime}
                onChange={(value) => updateForm("startTime", value)}
              />
            </div>
            <div className="col-12 col-md-6 col-lg-4">
              <TimeSelect
                label="เวลาสิ้นสุด"
                value={form.endTime}
                onChange={(value) => updateForm("endTime", value)}
              />
            </div>
          </div>

          <label className="form-label fw-bold mt-3">สถานที่</label>
          <input
            className="form-control"
            value={form.place}
            onChange={(event) => updateForm("place", event.target.value)}
            placeholder="ชื่อสถานที่"
          />

          <label className="form-label fw-bold mt-3">Google Map Link</label>
          <input
            type="url"
            className="form-control"
            value={form.mapLink}
            onChange={(event) => updateForm("mapLink", event.target.value)}
            placeholder="https://maps.google.com/..."
          />

          <label className="form-label fw-bold mt-3">หมายเหตุ</label>
          <textarea
            className="form-control"
            rows="3"
            value={form.note}
            onChange={(event) => updateForm("note", event.target.value)}
            placeholder="รายละเอียดเพิ่มเติม"
          />

          <div className="d-flex gap-2 mt-4">
            <button className="btn btn-success flex-fill py-3" type="submit">
              {editingId ? "บันทึกการแก้ไข" : "เพิ่มกิจกรรม"}
            </button>
            {editingId && (
              <button className="btn btn-light border py-3" type="button" onClick={resetForm}>
                ยกเลิก
              </button>
            )}
          </div>
        </form>
      )}

      <section className="soft-card p-4" data-guide="tl-list">
        <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
          <h2 className="h4 fw-bold mb-0">แผนกิจกรรม</h2>
          <span className="badge text-bg-light">{sortedItems.length} กิจกรรม</span>
        </div>

        {sortedItems.length === 0 ? (
          <div className="empty-state">
            <h3 className="h5 fw-bold">ยังไม่มีกิจกรรม</h3>
            <p>กดเพิ่มกิจกรรมเพื่อเริ่มวางแผน timeline ของกลุ่มนี้</p>
          </div>
        ) : (
          <>
            <div className="timeline-day-switcher" aria-label="เลือก Day">
              {groupedItems.map((dayGroup) => (
                <button
                  key={dayGroup.dayNumber}
                  type="button"
                  className={`timeline-day-tab ${
                    activeDayGroup?.dayNumber === dayGroup.dayNumber ? "active" : ""
                  }`}
                  onClick={() => setActiveDayNumber(dayGroup.dayNumber)}
                >
                  <span>Day {dayGroup.dayNumber}</span>
                  {dayGroup.date && <small>{formatDate(dayGroup.date)}</small>}
                </button>
              ))}
            </div>

            {activeDayGroup && (
              <section className="timeline-day timeline-day-active">
                <div className="timeline-day-header">
                  <div>
                    <span>Day {activeDayGroup.dayNumber}</span>
                    {activeDayGroup.date && <small>{formatDate(activeDayGroup.date)}</small>}
                  </div>
                  <div className="day-date-editor">
                    <input
                      type="date"
                      className="form-control"
                      value={
                        dayDateDrafts[activeDayGroup.dayNumber] ??
                        activeDayGroup.date ??
                        ""
                      }
                      onChange={(event) =>
                        handleDayDateChange(activeDayGroup.dayNumber, event.target.value)
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-success"
                      onClick={() => handleSaveDayDate(activeDayGroup)}
                    >
                      บันทึกวันที่
                    </button>
                  </div>
                </div>

                <div className="timeline-list">
                  {activeDayGroup.items.map((item) => {
                    const startTime = item.startTime || item.time || "";
                    const timeRange = item.endTime
                      ? `${startTime} - ${item.endTime}`
                      : startTime;

                    return (
                      <article key={item.id} className="timeline-item">
                        <div className="timeline-time">
                          <strong>{timeRange || "-"}</strong>
                          <span>{formatDate(item.date)}</span>
                        </div>

                        <div className="timeline-content">
                          <h3>{item.title}</h3>
                          {item.place && <p className="mb-1">สถานที่: {item.place}</p>}
                          {item.note && <p className="text-muted small mb-2">{item.note}</p>}
                          <div className="d-flex flex-wrap gap-2 mt-3">
                            {item.mapLink && (
                              <a
                                href={item.mapLink}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-sm btn-outline-success"
                              >
                                เปิด Google Map
                              </a>
                            )}
                            <button
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => handleEdit(item)}
                            >
                              แก้ไข
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDelete(item.id)}
                            >
                              ลบ
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </section>

      <BackHomeButtons />
    </>
  );
}

export default Timeline;
