import { useState } from "react";
import { addTimeline } from "../services/timelineService";

function Timeline() {
  const [activity, setActivity] = useState("");
  const [date, setDate] = useState("");

  const handleAdd = async () => {
    await addTimeline("trip123", { date, activity, place: "Unknown" });
    alert("เพิ่มกิจกรรมแล้ว!");
  };

  return (
    <div className="p-3">
      <h3>Timeline การท่องเที่ยว</h3>
      <input
        type="date"
        className="form-control mb-2"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <input
        type="text"
        className="form-control mb-2"
        placeholder="กิจกรรม"
        value={activity}
        onChange={(e) => setActivity(e.target.value)}
      />
      <button onClick={handleAdd} className="btn btn-success">
        เพิ่มกิจกรรม
      </button>
    </div>
  );
}

export default Timeline;
