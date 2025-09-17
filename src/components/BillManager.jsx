import { useState } from "react";
import { createBill, addMemberToBill } from "../services/billService";

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
    <div className="p-3">
      <h3>จัดการบิลทริป</h3>
      <input
        type="text"
        className="form-control mb-2"
        value={tripName}
        onChange={(e) => setTripName(e.target.value)}
        placeholder="ชื่อทริป"
      />
      <button onClick={handleCreate} className="btn btn-primary me-2">
        สร้างบิล
      </button>
      <button onClick={handleAddMember} className="btn btn-secondary">
        เพิ่มเพื่อน
      </button>
    </div>
  );
}

export default BillManager;
