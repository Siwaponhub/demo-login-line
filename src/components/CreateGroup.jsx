import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, setDoc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import { v4 as uuidv4 } from "uuid";
import Swal from "sweetalert2";
import BackHomeButtons from "./BackHomeButtons";

function CreateOrJoinGroup() {
  const [groupName, setGroupName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const gid = query.get("groupId");
    if (gid && user) {
      handleJoin(gid);
    }
  }, [location, user]);

  const handleCreate = async () => {
    if (!user || !groupName) return;

    const gid = uuidv4().slice(0, 8);
    const groupData = {
      name: groupName,
      ownerId: user.userId,
      members: [
        {
          userId: user.userId,
          name: user.name,
          email: user.email,
          picture: user.picture,
        },
      ],
      createdAt: new Date(),
    };

    await setDoc(doc(db, "groups", gid), groupData);

    setGroupId(gid);
    setInviteLink(`${window.location.origin}/join?groupId=${gid}`);
    Swal.fire("✅ สร้างกลุ่มเรียบร้อย", "", "success");
  };

  const handleJoin = async (gid) => {
    try {
      const ref = doc(db, "groups", gid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        Swal.fire("❌ ไม่พบกลุ่ม", "", "error");
        return;
      }

      const group = snap.data();
      const alreadyIn = group.members?.some((m) => m.userId === user.userId);

      if (alreadyIn) {
        Swal.fire("ℹ️ คุณอยู่ในกลุ่มนี้แล้ว", group.name, "info");
        navigate(`/group/${gid}`);
        return;
      }

      await updateDoc(ref, {
        members: arrayUnion({
          userId: user.userId,
          name: user.name,
          email: user.email,
          picture: user.picture,
        }),
      });

      Swal.fire("✅ เข้าร่วมกลุ่มเรียบร้อย", group.name, "success");
      navigate(`/group/${gid}`);
    } catch (err) {
      console.error(err);
      Swal.fire("⚠️ มีข้อผิดพลาด", "ไม่สามารถเข้าร่วมกลุ่มได้", "error");
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    Swal.fire("📋 คัดลอกแล้ว", text, "success");
  };

  return (
    <div className="container mt-4">
      <h3>สร้างหรือเข้าร่วมกลุ่ม</h3>

      {/* ✅ สร้างกลุ่ม */}
      <div className="card p-3 shadow-sm rounded-4 mb-4">
        <h5 className="mb-3 text-success">🆕 สร้างกลุ่มใหม่</h5>
        <input
          type="text"
          className="form-control mb-3"
          placeholder="ชื่อกลุ่ม"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
        />
        <button className="btn btn-success" onClick={handleCreate}>
          ✅ สร้างกลุ่ม
        </button>
      </div>

      {inviteLink && (
        <div className="alert alert-info mt-3">
          <p className="mb-2 fw-bold">🔗 ลิงก์เชิญ:</p>
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
              คัดลอก
            </button>
          </div>

          <p className="mb-2 fw-bold">📌 รหัสกลุ่ม:</p>
          <div className="d-flex gap-2">
            <input
              type="text"
              className="form-control"
              value={groupId}
              readOnly
            />
            <button
              className="btn btn-outline-primary"
              onClick={() => handleCopy(groupId)}
            >
              คัดลอก
            </button>
          </div>
        </div>
      )}

      {/* ✅ เข้าร่วมกลุ่ม */}
      <div className="card p-3 shadow-sm rounded-4 mt-4">
        <h5 className="mb-3 text-primary">👥 เข้าร่วมกลุ่ม</h5>
        <input
          type="text"
          className="form-control mb-2"
          placeholder="กรอกรหัสกลุ่ม"
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
        />
        <button className="btn btn-primary" onClick={() => handleJoin(groupId)}>
          🚪 เข้าร่วม
        </button>
      </div>

      <BackHomeButtons />
    </div>
  );
}

export default CreateOrJoinGroup;
