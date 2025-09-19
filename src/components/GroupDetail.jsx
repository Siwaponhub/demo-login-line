import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import Swal from "sweetalert2";
import BackHomeButtons from "./BackHomeButtons";

function GroupDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);

  useEffect(() => {
    const fetchGroup = async () => {
      const ref = doc(db, "groups", id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setGroup({ id: snap.id, ...snap.data() });
      }
    };
    fetchGroup();
  }, [id]);

  const handleRemoveMember = async (memberId) => {
    if (!group) return;
    const updated = group.members.filter((m) => m.userId !== memberId);

    await updateDoc(doc(db, "groups", id), { members: updated });
    setGroup({ ...group, members: updated });
    Swal.fire("✅ สำเร็จ", "ลบสมาชิกเรียบร้อย", "success");
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    Swal.fire("📋 คัดลอกแล้ว", text, "success");
  };

  if (!group) return <p className="text-center mt-4">⏳ กำลังโหลด...</p>;

  const inviteLink = `${window.location.origin}/join?groupId=${id}`;

  return (
    <div className="container mt-4">
      <h3 className="fw-bold mb-3">รายละเอียดกลุ่ม: {group.name}</h3>

      <div className="card shadow-sm rounded-4 p-3 mb-3">
        <p className="mb-2 fw-bold">🔗 ลิงก์เชิญ</p>
        <div className="d-flex gap-2 mb-3">
          <input
            type="text"
            className="form-control"
            value={inviteLink}
            readOnly
          />
          <button
            className="btn btn-outline-primary"
            onClick={() => handleCopy(inviteLink)}
          >
            📋 คัดลอก
          </button>
        </div>

        <p className="mb-2 fw-bold">🆔 รหัสกลุ่ม</p>
        <div className="d-flex gap-2">
          <input type="text" className="form-control" value={id} readOnly />
          <button
            className="btn btn-outline-primary"
            onClick={() => handleCopy(id)}
          >
            📋 คัดลอก
          </button>
        </div>
      </div>

      <h5 className="fw-bold mt-4 mb-2">👥 สมาชิกในกลุ่ม</h5>
      <div className="list-group shadow-sm rounded-3">
        {group.members?.map((member) => (
          <div
            key={member.userId}
            className="list-group-item d-flex align-items-center justify-content-between"
          >
            <div className="d-flex align-items-center">
              <img
                src={member.picture || "https://via.placeholder.com/40"}
                alt={member.name}
                className="rounded-circle me-3"
                style={{ width: "40px", height: "40px", objectFit: "cover" }}
              />
              <div>
                <h6 className="mb-0 fw-bold">{member.name}</h6>
                <small className="text-muted">
                  {member.email || "ไม่มีอีเมล"}
                </small>
              </div>
            </div>

            {user?.userId === group.ownerId &&
              member.userId !== group.ownerId && (
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => handleRemoveMember(member.userId)}
                >
                  ❌ ลบ
                </button>
              )}
          </div>
        ))}
      </div>

      <BackHomeButtons />
    </div>
  );
}

export default GroupDetail;
