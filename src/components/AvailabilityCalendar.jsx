import { useState } from "react";
import { saveAvailability } from "../services/userService";
import { Link } from "react-router-dom";
import BackHomeButtons from "./BackHomeButtons";

function AvailabilityCalendar() {
  const [dates, setDates] = useState([]);

  const handleAddDate = (e) => {
    if (e.target.value && !dates.includes(e.target.value)) {
      setDates([...dates, e.target.value]);
    }
  };

  const handleSave = async () => {
    await saveAvailability("lineUser123", dates);
    alert("บันทึกวันว่างเรียบร้อย");
  };

  return (
    <div className="container mt-4">
      <div className="card shadow rounded-4 p-3">
        <h3 className="mb-3 text-info">ปฏิทินวันว่าง</h3>
        <input
          type="date"
          className="form-control mb-3"
          onChange={handleAddDate}
        />

        <ul className="list-group mb-3">
          {dates.map((d, i) => (
            <li key={i} className="list-group-item">
              {d}
            </li>
          ))}
        </ul>

        <button onClick={handleSave} className="btn btn-info w-100">
          💾 บันทึกวันว่าง
        </button>
      </div>
      <BackHomeButtons />
    </div>
  );
}

export default AvailabilityCalendar;
