import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { arrayUnion, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import Swal from "sweetalert2";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import BackHomeButtons from "./BackHomeButtons";
import PageGuideButton from "./PageGuideButton";

const GUIDE_STEPS = [
  {
    element: '[data-guide="create-form"]',
    popover: {
      title: "✨ สร้างกลุ่มใหม่",
      description: "<p>กรอกชื่อกลุ่มแล้วกดสร้าง ระบบจะสร้างรหัส 8 หลักและลิงก์เชิญให้อัตโนมัติ</p><ul class='dv-list'><li>📝 ตั้งชื่อให้จำง่าย เช่น \"ทริปเชียงใหม่\"</li><li>🔑 ได้รับรหัสและลิงก์เชิญทันที</li></ul>",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "#groupName",
    popover: {
      title: "📝 ชื่อกลุ่ม",
      description: "<p>กรอกชื่อกลุ่มที่สื่อความหมาย ให้สมาชิกรู้ว่าเป็นกลุ่มอะไร</p><ul class='dv-list'><li>เช่น ทริปญี่ปุ่น, นัดกินข้าว, บ้านใหม่</li></ul>",
      side: "bottom",
    },
  },
  {
    element: '[data-guide="create-btn"]',
    popover: {
      title: "🚀 กดสร้างกลุ่ม",
      description: "<p>หลังกดสร้าง จะมีส่วน <strong>ส่งคำเชิญ</strong> ปรากฏด้านล่าง คัดลอกลิงก์หรือรหัสส่งให้เพื่อนได้เลย</p>",
      side: "top",
    },
  },
  {
    element: '[data-guide="join-form"]',
    popover: {
      title: "🎟️ เข้าร่วมกลุ่ม",
      description: "<p>ถ้าเพื่อนสร้างกลุ่มไว้แล้ว กรอกรหัส 8 หลักที่ได้รับมาแล้วกดเข้าร่วม</p><ul class='dv-list'><li>รหัสกลุ่มเป็นตัวอักษร 8 ตัว เช่น ab12cd34</li><li>หรือกดลิงก์เชิญที่เพื่อนส่งมาโดยตรง</li></ul>",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "#joinCode",
    popover: {
      title: "🔢 กรอกรหัสกลุ่ม",
      description: "<p>วางรหัส 8 หลักที่ได้รับจากเจ้าของกลุ่ม แล้วกดปุ่ม <strong>เข้าร่วมกลุ่ม</strong> ด้านล่าง</p>",
      side: "bottom",
    },
  },
];

function CreateOrJoinGroup() {
  const [groupName, setGroupName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!user || !groupName.trim()) {
      Swal.fire("กรอกชื่อกลุ่มก่อน", "", "info");
      return;
    }

    const gid = uuidv4().slice(0, 8);
    const groupData = {
      name: groupName.trim(),
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
    setInviteLink(`${window.location.origin}/creategroup?groupId=${gid}`);
    Swal.fire("สำเร็จ", "สร้างกลุ่มเรียบร้อย", "success");
  };

  const handleJoin = useCallback(async (gid) => {
    if (!gid?.trim()) {
      Swal.fire("กรอกรหัสกลุ่มก่อน", "", "info");
      return;
    }

    try {
      const cleanId = gid.trim();
      const ref = doc(db, "groups", cleanId);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        Swal.fire("ไม่พบกลุ่ม", "ตรวจสอบรหัสกลุ่มอีกครั้ง", "error");
        return;
      }

      const group = snap.data();
      const alreadyIn = group.members?.some((m) => m.userId === user.userId);

      if (alreadyIn) {
        Swal.fire("คุณอยู่ในกลุ่มนี้แล้ว", group.name, "info");
        navigate(`/group/${cleanId}`);
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

      Swal.fire("สำเร็จ", `เข้าร่วมกลุ่ม ${group.name} แล้ว`, "success");
      navigate(`/group/${cleanId}`);
    } catch (err) {
      console.error(err);
      Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถเข้าร่วมกลุ่มได้", "error");
    }
  }, [navigate, user]);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const gid = query.get("groupId");
    if (gid && user) {
      handleJoin(gid);
    }
  }, [handleJoin, location.search, user]);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    Swal.fire("คัดลอกแล้ว", "", "success");
  };

  return (
    <>
      <section className="page-header">
        <div>
          <h1 className="page-title">สร้างหรือเข้าร่วมกลุ่ม</h1>
          <p className="page-subtitle">
            สร้างกลุ่มเพื่อแชร์ลิงก์ให้เพื่อน หรือกรอกรหัสกลุ่มที่ได้รับมา
          </p>
        </div>
        <PageGuideButton steps={GUIDE_STEPS} />
      </section>

      <section className="section-grid">
        <div className="soft-card p-4" data-guide="create-form">
          <h2 className="h4 fw-bold">สร้างกลุ่มใหม่</h2>
          <p className="text-muted">ตั้งชื่อกลุ่มให้จำง่าย เช่น ทริปเชียงใหม่ หรือ นัดกินข้าว</p>
          <label className="form-label fw-bold" htmlFor="groupName">
            ชื่อกลุ่ม
          </label>
          <input
            id="groupName"
            type="text"
            className="form-control mb-3"
            placeholder="กรอกชื่อกลุ่ม"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
          <button className="btn btn-success w-100 py-3" onClick={handleCreate} data-guide="create-btn">
            สร้างกลุ่ม
          </button>
        </div>

        <div className="soft-card p-4" data-guide="join-form">
          <h2 className="h4 fw-bold">เข้าร่วมกลุ่ม</h2>
          <p className="text-muted">กรอกรหัส 8 ตัวอักษรจากเจ้าของกลุ่ม</p>
          <label className="form-label fw-bold" htmlFor="joinCode">
            รหัสกลุ่ม
          </label>
          <input
            id="joinCode"
            type="text"
            className="form-control mb-3"
            placeholder="เช่น ab12cd34"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          />
          <button className="btn btn-outline-success w-100 py-3" onClick={() => handleJoin(groupId)}>
            เข้าร่วมกลุ่ม
          </button>
        </div>
      </section>

      {inviteLink && (
        <section className="soft-card p-4 mt-3">
          <h2 className="h5 fw-bold">ส่งคำเชิญให้สมาชิก</h2>
          <div className="row g-3 mt-1">
            <div className="col-12 col-lg-8">
              <label className="form-label fw-bold">ลิงก์เชิญ</label>
              <input type="text" className="form-control" value={inviteLink} readOnly />
            </div>
            <div className="col-12 col-lg-4 d-flex align-items-end">
              <button className="btn btn-outline-success w-100 py-3" onClick={() => handleCopy(inviteLink)}>
                คัดลอกลิงก์
              </button>
            </div>
            <div className="col-12 col-lg-8">
              <label className="form-label fw-bold">รหัสกลุ่ม</label>
              <input type="text" className="form-control" value={groupId} readOnly />
            </div>
            <div className="col-12 col-lg-4 d-flex align-items-end">
              <button className="btn btn-outline-success w-100 py-3" onClick={() => handleCopy(groupId)}>
                คัดลอกรหัส
              </button>
            </div>
          </div>
        </section>
      )}

      <BackHomeButtons />
    </>
  );
}

export default CreateOrJoinGroup;
