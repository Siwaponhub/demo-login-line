import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { Link } from "react-router-dom";

function CalendarGroups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    const fetchGroups = async () => {
      const querySnapshot = await getDocs(collection(db, "groups"));
      const allGroups = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // เอาเฉพาะกลุ่มที่ user เป็นสมาชิกหรือเป็นเจ้าของ
      const userGroups = allGroups.filter(
        (g) =>
          g.ownerId === user?.userId ||
          g.members?.some((m) => m.userId === user?.userId)
      );

      setGroups(userGroups);
    };

    if (user) fetchGroups();
  }, [user]);

  return (
    <div className="container mt-4">
      <h3 className="fw-bold text-info mb-3">📌 เลือกกลุ่มสำหรับดูปฏิทิน</h3>

      {groups.length === 0 ? (
        <div className="alert alert-secondary">คุณยังไม่มีกลุ่มที่เข้าร่วม</div>
      ) : (
        <div className="list-group shadow-sm rounded-4">
          {groups.map((g) => (
            <Link
              key={g.id}
              to={`/calendar/${g.id}`}
              className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
            >
              <span className="fw-bold">{g.name}</span>
              <span className="badge bg-primary">ดูปฏิทิน</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default CalendarGroups;
