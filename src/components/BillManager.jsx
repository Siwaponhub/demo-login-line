import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { createBill } from "../services/billService";
import BackHomeButtons from "./BackHomeButtons";
import { showSuccess, showConfirm, showWarning } from "../utils/alertService";
import { useAuth } from "../AuthContext";

function BillManager() {
  const [tripName, setTripName] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    const fetchUsers = async () => {
      const snapshot = await getDocs(collection(db, "users"));
      const usersData = snapshot.docs.map((doc) => ({
        userId: doc.id,
        ...doc.data(),
      }));
      setUsers(usersData);
    };
    fetchUsers();
  }, []);

  const toggleUser = (u) => {
    if (selectedUsers.some((sel) => sel.userId === u.userId)) {
      setSelectedUsers(selectedUsers.filter((sel) => sel.userId !== u.userId));
    } else {
      setSelectedUsers([...selectedUsers, { ...u, share: 0 }]);
    }
  };

  const updateShare = (id, value) => {
    setSelectedUsers(
      selectedUsers.map((sel) =>
        sel.userId === id ? { ...sel, share: Number(value) || 0 } : sel
      )
    );
  };

  const splitEqually = () => {
    if (totalAmount && selectedUsers.length > 0) {
      const perPerson = Math.floor(totalAmount / selectedUsers.length);
      setSelectedUsers(
        selectedUsers.map((sel) => ({ ...sel, share: perPerson }))
      );
    }
  };

  const handleCreate = async () => {
    if (!tripName || !totalAmount) {
      showWarning("ข้อมูลไม่ครบ", "กรุณากรอกชื่อบิลและยอดรวม");
      return;
    }

    const sumShares = selectedUsers.reduce((sum, u) => sum + u.share, 0);
    if (sumShares !== Number(totalAmount)) {
      const result = await showConfirm(
        "ยอดไม่ตรงกัน",
        `ยอดรวมรายคน (${sumShares}) ไม่เท่ากับยอดบิล (${totalAmount}) ต้องการบันทึกต่อหรือไม่?`
      );
      if (!result.isConfirmed) return;
    }

    await createBill(tripName, user.userId, Number(totalAmount), selectedUsers);
    showSuccess("✅ สร้างบิลสำเร็จ", `บิล "${tripName}" ถูกบันทึกเรียบร้อย`);
    setTripName("");
    setTotalAmount("");
    setSelectedUsers([]);
  };

  return (
    <div className="container mt-4">
      <div className="card shadow-lg rounded-4 p-4">
        <h3 className="mb-4 fw-bold text-primary">💰 สร้างบิลหารค่าใช้จ่าย</h3>

        {/* ชื่อบิล */}
        <div className="mb-3">
          <label className="form-label fw-bold">📌 ชื่อบิล</label>
          <input
            type="text"
            className="form-control form-control-lg"
            value={tripName}
            onChange={(e) => setTripName(e.target.value)}
            placeholder="เช่น ทริปเชียงใหม่"
          />
        </div>

        {/* ยอดรวม */}
        <div className="mb-3">
          <label className="form-label fw-bold">💵 ยอดรวมบิล (บาท)</label>
          <input
            type="number"
            className="form-control form-control-lg"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            placeholder="กรอกยอดรวม"
          />
        </div>

        {/* เลือกเพื่อน */}
        <div className="mb-3">
          <h5 className="fw-bold">👥 เลือกผู้เข้าร่วม</h5>
          <div className="list-group shadow-sm rounded-3">
            {users.map((u) => (
              <label
                key={u.userId}
                className="list-group-item d-flex align-items-center"
                style={{ cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={selectedUsers.some((sel) => sel.userId === u.userId)}
                  onChange={() => toggleUser(u)}
                  className="form-check-input me-2"
                />
                <img
                  src={u.picture || "https://via.placeholder.com/40"}
                  alt={u.name}
                  className="rounded-circle me-3 shadow-sm"
                  style={{ width: "40px", height: "40px" }}
                />
                <span className="fw-semibold">{u.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* ยอดรายคน */}
        {selectedUsers.length > 0 && (
          <div className="mb-3">
            <h5 className="fw-bold">🧾 กำหนดยอดรายคน</h5>
            {selectedUsers.map((sel) => (
              <div
                key={sel.userId}
                className="input-group mb-2 shadow-sm rounded"
              >
                <span className="input-group-text bg-light">
                  <img
                    src={sel.picture || "https://via.placeholder.com/30"}
                    alt={sel.name}
                    className="rounded-circle me-2"
                    style={{ width: "30px", height: "30px" }}
                  />
                  {/* {sel.name} */}
                </span>
                <input
                  type="number"
                  className="form-control"
                  value={sel.share}
                  onChange={(e) => updateShare(sel.userId, e.target.value)}
                  placeholder="0"
                />
                <span className="input-group-text">฿</span>
              </div>
            ))}

            <button
              type="button"
              onClick={splitEqually}
              className="btn btn-outline-info w-100 mt-2"
            >
              🔄 หารเท่ากันอัตโนมัติ
            </button>
          </div>
        )}

        {/* ปุ่มสร้างบิล */}
        <button onClick={handleCreate} className="btn btn-success btn-lg w-100">
          ✅ สร้างบิล
        </button>
      </div>

      <BackHomeButtons />
    </div>
  );
}

export default BillManager;
