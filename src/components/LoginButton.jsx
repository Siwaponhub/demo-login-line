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

  const handleLogin = (groupId = null) => {
    const client_id = import.meta.env.VITE_LINE_CHANNEL_ID;
    const redirect_uri = import.meta.env.VITE_LINE_REDIRECT_URI;
    const pendingGroupId = localStorage.getItem("pendingGroupId");
    const state = pendingGroupId
      ? `group_${pendingGroupId}`
      : crypto.randomUUID();
    const scope = "openid profile email";
    // console.log("state", state);

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
      // console.log("User saved:", userData.email);
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
          className="rounded-circle mb-3 shadow"
          style={{ width: "100px" }}
        />
        <h2 className="fw-bold">สวัสดี {user.name}</h2>
        <p className="text-muted">{user.email}</p>
        <button
          onClick={handleLogout}
          className="btn btn-outline-danger mt-3 px-4"
        >
          🚪 Logout
        </button>
      </div>
    );
  }

  return (
    <div className="text-center mt-5">
      <button
        onClick={() => handleLogin()}
        className="btn d-flex align-items-center justify-content-center mx-auto shadow"
        style={{
          backgroundColor: "#06C755",
          color: "white",
          fontWeight: "bold",
          fontSize: "18px",
          borderRadius: "50px",
          padding: "12px 24px",
          minWidth: "260px",
        }}
      >
        {/* โลโก้ LINE (SVG inline) */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 36 36"
          className="me-2"
        >
          <path
            fill="#FFFFFF"
            d="M18 3C9.163 3 2 9.507 2 17c0 3.613 1.555 6.9 4.125 9.438-.35 2.188-1.25 4.525-2.563 6.563 2.975-.55 5.425-1.613 7.25-2.838A17.37 17.37 0 0 0 18 31c8.837 0 16-6.507 16-14s-7.163-14-16-14z"
          />
        </svg>
        Login with LINE
      </button>
    </div>
  );
}

export default LoginButton;
