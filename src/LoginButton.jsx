import { useEffect, useState } from "react";

function LoginButton() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("lineUser");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
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

  if (user) {
    return (
      <div style={{ textAlign: "center", marginTop: "50px" }}>
        <img
          src={user.picture}
          alt="profile"
          style={{ borderRadius: "50%", width: "100px" }}
        />
        <h2>สวัสดี {user.name}</h2>
        <p>{user.email}</p>
        <button onClick={handleLogout} style={{ marginTop: "20px" }}>
          Logout
        </button>
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <button
        onClick={handleLogin}
        style={{ padding: "10px 20px", fontSize: "18px" }}
      >
        Login with LINE
      </button>
    </div>
  );
}

export default LoginButton;
