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

      // ✅ save เข้า Firestore โดยใช้ email เป็น id (ถ้ามี)
      if (parsedUser?.email) {
        saveUser(parsedUser);
      }
    }
  }, []);

  const handleLogin = () => {
    const client_id = import.meta.env.VITE_LINE_CHANNEL_ID;
    const redirect_uri = import.meta.env.VITE_LINE_REDIRECT_URI;
    const state = crypto.randomUUID();
    const scope = "openid profile email";

    const loginUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${client_id}&redirect_uri=${redirect_uri}&state=${state}&scope=${scope}`;
    window.location.href = loginUrl;
  };

  const handleLogout = () => {
    localStorage.removeItem("lineUser");
    setUser(null);
  };

  // save user to Firestore
  const saveUser = async (userData) => {
    try {
      await setDoc(doc(db, "users", userData.email), userData, { merge: true });
      console.log("User saved:", userData.email);
    } catch (err) {
      console.error("Error saving user:", err);
    }
  };

  if (user) {
    return (
      <div className="text-center mt-5">
        <img
          src={user.picture}
          alt="profile"
          className="rounded-circle mb-3"
          style={{ width: "100px" }}
        />
        <h2 className="fw-bold">สวัสดี {user.name}</h2>
        <p className="text-muted">{user.email}</p>
        <button onClick={handleLogout} className="btn btn-outline-danger mt-3">
          Logout
        </button>
      </div>
    );
  }

  return (
    <div className="text-center mt-5">
      <button onClick={handleLogin} className="btn btn-success btn-lg">
        Login with LINE
      </button>
    </div>
  );
}

export default LoginButton;
