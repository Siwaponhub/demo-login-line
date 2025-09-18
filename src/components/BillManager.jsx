import { useState } from "react";
import { createBill, addMemberToBill } from "../services/billService";
import { Link } from "react-router-dom";
import BackHomeButtons from "./BackHomeButtons";

function BillManager() {
  const [tripName, setTripName] = useState("");
  const [billId, setBillId] = useState(null);

  const handleCreate = async () => {
    const docRef = await createBill(tripName, "lineUser123");
    setBillId(docRef.id);
  };

  const handleAddMember = async () => {
    if (billId) {
      await addMemberToBill(billId, {
        userId: "lineUser456",
        name: "เพื่อน A",
      });
      alert("เพิ่มเพื่อนแล้ว!");
    }
  };

  return (
    <div className="container mt-4">
      <div className="card shadow rounded-4 p-3">
        <h3 className="mb-3 text-primary">จัดการบิลทริป</h3>
        <input
          type="text"
          className="form-control mb-3"
          value={tripName}
          onChange={(e) => setTripName(e.target.value)}
          placeholder="ชื่อทริป"
        />
        <div className="d-flex gap-2">
          <button onClick={handleCreate} className="btn btn-success flex-fill">
            สร้างบิล
          </button>
          <button
            onClick={handleAddMember}
            className="btn btn-outline-primary flex-fill"
          >
            เพิ่มเพื่อน
          </button>
        </div>
      </div>

      <BackHomeButtons />
    </div>
  );
}

export default BillManager;
