import { useEffect, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

function LoginButton() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("lineUser");
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);

      if (parsedUser?.email) {
        saveUser(parsedUser);
      }
    }
  }, []);

  const handleLogin = () => {
    const client_id = import.meta.env.VITE_LINE_CHANNEL_ID;
    const redirect_uri = import.meta.env.VITE_LINE_REDIRECT_URI;
    const pendingGroupId = localStorage.getItem("pendingGroupId");
    const state = pendingGroupId ? `group_${pendingGroupId}` : crypto.randomUUID();
    const scope = "openid profile email";
    const loginUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${client_id}&redirect_uri=${redirect_uri}&state=${state}&scope=${scope}`;
    window.location.href = loginUrl;
  };

  const handleLogout = () => {
    localStorage.removeItem("lineUser");
    setUser(null);
  };

  const saveUser = async (userData) => {
    try {
      await setDoc(doc(db, "users", userData.email), userData, { merge: true });
    } catch (err) {
      console.error("Error saving user:", err);
    }
  };

  if (user) {
    return (
      <section className="login-panel">
        <div className="soft-card login-card">
          <img src={user.picture} alt={user.name} className="avatar mb-3" />
          <h1 className="page-title">สวัสดี {user.name}</h1>
          <p className="page-subtitle mx-auto">{user.email}</p>
          <button onClick={handleLogout} className="btn btn-outline-danger mt-3 px-4">
            ออกจากระบบ
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="login-panel">
      <div className="soft-card login-card">
        <span className="brand-mark mx-auto mb-3">L</span>
        <h1 className="page-title">LINE Group Planner</h1>
        <p className="page-subtitle mx-auto">
          จัดกลุ่ม นัดวันว่าง และแชร์ลิงก์เชิญสมาชิกผ่านบัญชี LINE
        </p>
        <button onClick={handleLogin} className="line-button mt-4">
          เข้าสู่ระบบด้วย LINE
        </button>
      </div>
    </section>
  );
}

export default LoginButton;
