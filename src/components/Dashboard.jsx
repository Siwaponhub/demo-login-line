import { useEffect, useState } from "react";
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import Swal from "sweetalert2";
import BackHomeButtons from "./BackHomeButtons";
import { Link } from "react-router-dom";

function Dashboard() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true); // ✅ state สำหรับสถานะโหลด

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        setLoading(true);
        const querySnapshot = await getDocs(collection(db, "groups"));
        const groupData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        const userGroups = groupData.filter((g) =>
          g.members?.some((m) => m.userId === user?.userId)
        );
        setGroups(userGroups);
      } catch (err) {
        console.error("Error fetching groups:", err);
        Swal.fire("❌ ผิดพลาด", "ไม่สามารถโหลดข้อมูลกลุ่มได้", "error");
      } finally {
        setLoading(false);
      }
    };

    if (user) fetchGroups();
  }, [user]);

  const handleDeleteGroup = async (groupId) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "ลบกลุ่ม?",
      text: "คุณแน่ใจหรือไม่ว่าต้องการลบกลุ่มนี้?",
      showCancelButton: true,
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#dc3545",
    });
    if (!result.isConfirmed) return;

    try {
      await deleteDoc(doc(db, "groups", groupId));
      Swal.fire("✅ สำเร็จ", "ลบกลุ่มเรียบร้อย", "success");
      setGroups(groups.filter((g) => g.id !== groupId));
    } catch (err) {
      console.error(err);
      Swal.fire("❌ ผิดพลาด", "ไม่สามารถลบกลุ่มได้", "error");
    }
  };

  return (
    <div className="container mt-4">
      <h3 className="mb-4 fw-bold text-primary">👥 กลุ่มของฉัน</h3>

      {loading ? (
        // ✅ แสดง Loading ระหว่างโหลด
        <div className="text-center my-5">
          <div
            className="spinner-border text-primary"
            style={{ width: "3rem", height: "3rem" }}
            role="status"
          >
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 text-muted">กำลังโหลดข้อมูล...</p>
        </div>
      ) : groups.length === 0 ? (
        // ✅ แสดงข้อความถ้าไม่มีจริง ๆ
        <div className="alert alert-secondary text-center">
          คุณยังไม่ได้เข้าร่วมกลุ่มใด
        </div>
      ) : (
        // ✅ แสดงรายการกลุ่ม
        <div className="row g-3">
          {groups.map((group) => (
            <div key={group.id} className="col-12 col-md-6">
              <div className="card shadow rounded-4 h-100">
                <div className="card-body d-flex flex-column">
                  {/* Header */}
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="card-title fw-bold mb-0">{group.name}</h5>
                    <div className="d-flex gap-2">
                      <Link
                        to={`/group/${group.id}`}
                        className="btn btn-sm btn-outline-primary"
                      >
                        🔍 ดูรายละเอียด
                      </Link>
                      {user?.userId === group.ownerId && (
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDeleteGroup(group.id)}
                        >
                          🗑️ ลบ
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="d-flex align-items-center flex-wrap gap-2">
                    {group.members?.slice(0, 5).map((member) => (
                      <img
                        key={member.userId}
                        src={member.picture || "https://via.placeholder.com/40"}
                        alt={member.name}
                        className="rounded-circle shadow-sm"
                        style={{
                          width: "40px",
                          height: "40px",
                          objectFit: "cover",
                          border: "2px solid #fff",
                        }}
                        title={member.name}
                      />
                    ))}
                    {group.members?.length > 5 && (
                      <span className="text-muted small">
                        +{group.members.length - 5} เพิ่มเติม
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <BackHomeButtons />
    </div>
  );
}

export default Dashboard;
