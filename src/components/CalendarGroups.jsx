import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import BackHomeButtons from "./BackHomeButtons";

function CalendarGroups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        setLoading(true);
        const querySnapshot = await getDocs(collection(db, "groups"));
        const allGroups = querySnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        const userGroups = allGroups.filter(
          (g) =>
            g.ownerId === user?.userId ||
            g.members?.some((m) => m.userId === user?.userId)
        );

        setGroups(userGroups);
      } catch (err) {
        console.error("Error fetching groups:", err);
      } finally {
        setLoading(false);
      }
    };

    if (user) fetchGroups();
  }, [user]);

  return (
    <>
      <section className="page-header">
        <div>
          <h1 className="page-title">เลือกกลุ่มสำหรับปฏิทิน</h1>
          <p className="page-subtitle">เปิดปฏิทินของแต่ละกลุ่มเพื่อบันทึกวันที่ไม่ว่าง</p>
        </div>
      </section>

      {loading ? (
        <div className="soft-card empty-state">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 mb-0">กำลังโหลดข้อมูลกลุ่ม...</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="soft-card empty-state">ยังไม่มีกลุ่มที่เข้าร่วม</div>
      ) : (
        <div className="section-grid">
          {groups.map((group) => (
            <Link key={group.id} to={`/calendar/${group.id}`} className="menu-card">
              <span className="tile-icon alt">C</span>
              <span>
                <h2>{group.name}</h2>
                <p>{group.members?.length || 0} สมาชิก</p>
              </span>
            </Link>
          ))}
        </div>
      )}

      <BackHomeButtons />
    </>
  );
}

export default CalendarGroups;
