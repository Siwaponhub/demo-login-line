import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import BackHomeButtons from "./BackHomeButtons";

function Profile() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="soft-card login-card text-center">
        <h1 className="page-title">ยังไม่ได้เข้าสู่ระบบ</h1>
        <Link to="/" className="btn btn-success mt-3">
          เข้าสู่ระบบด้วย LINE
        </Link>
      </div>
    );
  }

  return (
    <>
      <section className="page-header">
        <div>
          <h1 className="page-title">โปรไฟล์</h1>
          <p className="page-subtitle">ข้อมูลบัญชีที่ใช้สำหรับเข้าร่วมกลุ่ม</p>
        </div>
      </section>

      <section className="soft-card p-4 text-center">
        <img
          src={user.picture}
          alt={user.name}
          className="rounded-circle shadow-sm mb-3"
          style={{ width: "118px", height: "118px", objectFit: "cover" }}
        />
        <h2 className="h3 fw-bold mb-1">{user.name}</h2>
        <p className="text-muted mb-0">{user.email || "ไม่มีอีเมล"}</p>
      </section>

      <BackHomeButtons />
    </>
  );
}

export default Profile;
