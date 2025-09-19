import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import BackHomeButtons from "./BackHomeButtons";
import Swal from "sweetalert2";

function JoinGroup() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [groupId, setGroupId] = useState("");

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const gid = query.get("groupId");

    if (gid) {
      setGroupId(gid);

      if (!user) {
        // ✅ ยังไม่ login → เก็บ groupId ไว้ใน localStorage
        localStorage.setItem("pendingGroupId", gid);
        navigate("/"); // กลับไปหน้า login
      } else {
        handleJoin(gid);
      }
    }
  }, [location, user]);

  const handleJoin = async (gid) => {
    if (!user) return;

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
        Swal.fire("ℹ️ คุณอยู่ในกลุ่มนี้แล้ว", "", "info");
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

      Swal.fire("✅ เข้าร่วมกลุ่มเรียบร้อย", "", "success");
      navigate(`/group/${gid}`); // ไปหน้ารายละเอียดกลุ่ม
    } catch (err) {
      console.error(err);
      Swal.fire("⚠️ มีข้อผิดพลาด", "", "error");
    }
  };

  return (
    <div className="container mt-4">
      <h3>เข้าร่วมกลุ่ม</h3>
      <input
        type="text"
        className="form-control mb-2"
        placeholder="กรอกรหัสกลุ่ม"
        value={groupId}
        onChange={(e) => setGroupId(e.target.value)}
      />
      <button
        className="btn btn-primary mb-3"
        onClick={() => handleJoin(groupId)}
      >
        เข้าร่วม
      </button>
      <BackHomeButtons />
    </div>
  );
}

export default JoinGroup;
