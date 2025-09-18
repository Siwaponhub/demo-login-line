import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import BackHomeButtons from "./BackHomeButtons";

function Dashboard() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const usersData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setUsers(usersData);
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };

    fetchUsers();
  }, []);

  return (
    <div className="container mt-4">
      <h3 className="mb-4 fw-bold">👥 รายชื่อผู้ใช้งาน</h3>

      {users.length === 0 ? (
        <p className="text-muted">ยังไม่มีผู้ใช้งานในระบบ</p>
      ) : (
        <div className="list-group shadow-sm rounded-3">
          {users.map((user) => (
            <div
              key={user.id}
              className="list-group-item list-group-item-action d-flex align-items-center"
            >
              <img
                src={user.picture || "https://via.placeholder.com/50"}
                alt={user.name}
                className="rounded-circle me-3 shadow-sm"
                style={{ width: "50px", height: "50px", objectFit: "cover" }}
              />
              <div>
                <h6 className="mb-0 fw-bold">{user.name}</h6>
                <small className="text-muted">
                  {user.email || "ไม่มีอีเมล"}
                </small>
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
