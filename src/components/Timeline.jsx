import { useState } from "react";
import { addTimeline } from "../services/timelineService";
import { Link } from "react-router-dom";
import BackHomeButtons from "./BackHomeButtons";

function Timeline() {
  const [activity, setActivity] = useState("");
  const [date, setDate] = useState("");

  const handleAdd = async () => {
    await addTimeline("trip123", { date, activity, place: "Unknown" });
    alert("เพิ่มกิจกรรมแล้ว!");
  };

  return (
    <div className="container mt-4">
      <div className="card shadow rounded-4 p-3">
        <h3 className="mb-3 text-success">Timeline การท่องเที่ยว</h3>
        <input
          type="date"
          className="form-control mb-2"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <input
          type="text"
          className="form-control mb-3"
          placeholder="กิจกรรม"
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
        />
        <button onClick={handleAdd} className="btn btn-success w-100">
          ➕ เพิ่มกิจกรรม
        </button>
      </div>
      <BackHomeButtons />
    </div>
  );
}

export default Timeline;
