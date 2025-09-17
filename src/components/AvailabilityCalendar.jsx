import { useState } from "react";
import { saveAvailability } from "../services/userService";

function AvailabilityCalendar() {
  const [dates, setDates] = useState([]);

  const handleAddDate = (e) => {
    setDates([...dates, e.target.value]);
  };

  const handleSave = async () => {
    await saveAvailability("lineUser123", dates);
    alert("บันทึกวันว่างเรียบร้อย");
  };

  return (
    <div className="p-3">
      <h3>ปฏิทินวันว่าง</h3>
      <input
        type="date"
        className="form-control mb-2"
        onChange={handleAddDate}
      />
      <ul>
        {dates.map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ul>
      <button onClick={handleSave} className="btn btn-info">
        บันทึกวันว่าง
      </button>
    </div>
  );
}

export default AvailabilityCalendar;
