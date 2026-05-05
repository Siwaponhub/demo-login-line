import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import Swal from "sweetalert2";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
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

    const result = await Swal.fire({
      icon: "warning",
      title: "ลบสมาชิก?",
      text: "สมาชิกคนนี้จะไม่เห็นข้อมูลกลุ่มอีกต่อไป",
      showCancelButton: true,
      confirmButtonText: "ลบสมาชิก",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#dc3545",
    });
    if (!result.isConfirmed) return;

    const updated = group.members.filter((m) => m.userId !== memberId);
    await updateDoc(doc(db, "groups", id), { members: updated });
    setGroup({ ...group, members: updated });
    Swal.fire("สำเร็จ", "ลบสมาชิกเรียบร้อย", "success");
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    Swal.fire("คัดลอกแล้ว", "", "success");
  };

  if (!group) {
    return (
      <div className="soft-card empty-state">
        <div className="spinner-border text-success" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3 mb-0">กำลังโหลดข้อมูลกลุ่ม...</p>
      </div>
    );
  }

  const inviteLink = `${window.location.origin}/creategroup?groupId=${id}`;
  const isOwner = user?.userId === group.ownerId;

  return (
    <>
      <section className="page-header">
        <div>
          <h1 className="page-title">{group.name}</h1>
          <p className="page-subtitle">
            {group.members?.length || 0} สมาชิก {isOwner ? "คุณเป็นเจ้าของกลุ่ม" : ""}
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Link to={`/calendar/${id}`} className="btn btn-success px-4">
            เปิดปฏิทิน
          </Link>
          <Link to={`/group/${id}/timeline`} className="btn btn-outline-success px-4">
            Timeline
          </Link>
          <Link to={`/group/${id}/bills`} className="btn btn-outline-success px-4">
            ค่าใช้จ่าย
          </Link>
        </div>
      </section>

      <section className="soft-card p-4 mb-3">
        <h2 className="h5 fw-bold mb-3">คำเชิญ</h2>
        <div className="row g-3">
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
            <input type="text" className="form-control" value={id} readOnly />
          </div>
          <div className="col-12 col-lg-4 d-flex align-items-end">
            <button className="btn btn-outline-success w-100 py-3" onClick={() => handleCopy(id)}>
              คัดลอกรหัส
            </button>
          </div>
        </div>
      </section>

      <section className="soft-card p-4">
        <h2 className="h5 fw-bold mb-3">สมาชิกในกลุ่ม</h2>
        <div className="list-group list-group-flush">
          {group.members?.map((member) => (
            <div
              key={member.userId}
              className="list-group-item px-0 d-flex align-items-center justify-content-between gap-3"
            >
              <div className="d-flex align-items-center gap-3 min-w-0">
                <img
                  src={member.picture || "https://via.placeholder.com/40"}
                  alt={member.name}
                  className="avatar"
                />
                <div className="min-w-0">
                  <h3 className="h6 fw-bold mb-0">{member.name}</h3>
                  <small className="text-muted">{member.email || "ไม่มีอีเมล"}</small>
                </div>
              </div>

              {isOwner && member.userId !== group.ownerId && (
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => handleRemoveMember(member.userId)}
                >
                  ลบ
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <BackHomeButtons />
    </>
  );
}

export default GroupDetail;
