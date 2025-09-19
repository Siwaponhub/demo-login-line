import { useState } from "react";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import { v4 as uuidv4 } from "uuid";
import Swal from "sweetalert2";
import BackHomeButtons from "./BackHomeButtons";

function CreateGroup() {
  const [groupName, setGroupName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const { user } = useAuth();

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
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    Swal.fire("📋 คัดลอกแล้ว", text, "success");
  };

  return (
    <div className="container mt-4">
      <h3>สร้างกลุ่มใหม่</h3>
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

      {inviteLink && (
        <div className="alert alert-info mt-3">
          <p className="mb-2">ลิงก์เชิญ:</p>
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

          <p className="mb-2">รหัสกลุ่ม:</p>
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
      <BackHomeButtons />
    </div>
  );
}

export default CreateGroup;
