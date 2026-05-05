import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";
import Swal from "sweetalert2";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import BackHomeButtons from "./BackHomeButtons";

function Dashboard() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        setLoading(true);
        const querySnapshot = await getDocs(collection(db, "groups"));
        const groupData = querySnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        const userGroups = groupData.filter((g) =>
          g.members?.some((m) => m.userId === user?.userId)
        );
        setGroups(userGroups);
      } catch (err) {
        console.error("Error fetching groups:", err);
        Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถโหลดข้อมูลกลุ่มได้", "error");
      } finally {
        setLoading(false);
      }
    };

    if (user) fetchGroups();
  }, [user]);

  const handleDeleteGroup = async (groupId) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "ลบกลุ่มนี้?",
      text: "เมื่อลบแล้วจะไม่สามารถกู้คืนข้อมูลกลุ่มนี้ได้",
      showCancelButton: true,
      confirmButtonText: "ลบกลุ่ม",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#dc3545",
    });
    if (!result.isConfirmed) return;

    try {
      await deleteDoc(doc(db, "groups", groupId));
      setGroups(groups.filter((g) => g.id !== groupId));
      Swal.fire("สำเร็จ", "ลบกลุ่มเรียบร้อย", "success");
    } catch (err) {
      console.error(err);
      Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถลบกลุ่มได้", "error");
    }
  };

  return (
    <>
      <section className="page-header">
        <div>
          <h1 className="page-title">กลุ่มของฉัน</h1>
          <p className="page-subtitle">ดูรายละเอียด แชร์ลิงก์เชิญ หรือจัดการสมาชิกในกลุ่ม</p>
        </div>
        <Link to="/creategroup" className="btn btn-success px-4">
          สร้างกลุ่ม
        </Link>
      </section>

      {loading ? (
        <div className="soft-card empty-state">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 mb-0">กำลังโหลดข้อมูลกลุ่ม...</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="soft-card empty-state">
          <h2 className="h5 fw-bold">ยังไม่มีกลุ่ม</h2>
          <p>เริ่มจากสร้างกลุ่มใหม่หรือเข้าร่วมด้วยรหัสเชิญ</p>
          <Link to="/creategroup" className="btn btn-success">
            เริ่มต้นใช้งาน
          </Link>
        </div>
      ) : (
        <div className="section-grid">
          {groups.map((group) => (
            <article key={group.id} className="group-card">
              <div className="d-flex justify-content-between gap-3">
                <div>
                  <h2 className="h5 fw-bold mb-1">{group.name}</h2>
                  <p className="text-muted mb-0">{group.members?.length || 0} สมาชิก</p>
                </div>
                {user?.userId === group.ownerId && (
                  <span className="badge text-bg-success align-self-start">เจ้าของ</span>
                )}
              </div>

              <div className="avatar-row">
                {group.members?.slice(0, 6).map((member) => (
                  <img
                    key={member.userId}
                    src={member.picture || "https://via.placeholder.com/40"}
                    alt={member.name}
                    className="avatar"
                    title={member.name}
                  />
                ))}
                {group.members?.length > 6 && (
                  <span className="badge rounded-pill text-bg-light ms-3">
                    +{group.members.length - 6}
                  </span>
                )}
              </div>

              <div className="d-flex gap-2 mt-4">
                <Link to={`/group/${group.id}`} className="btn btn-outline-success flex-fill">
                  ดูรายละเอียด
                </Link>
                {user?.userId === group.ownerId && (
                  <button
                    className="btn btn-outline-danger"
                    onClick={() => handleDeleteGroup(group.id)}
                  >
                    ลบ
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <BackHomeButtons />
    </>
  );
}

export default Dashboard;
