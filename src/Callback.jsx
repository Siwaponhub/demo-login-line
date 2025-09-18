import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { useAuth } from "./AuthContext";

function Callback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth(); // ใช้ context

  useEffect(() => {
    const fetchToken = async () => {
      const query = new URLSearchParams(location.search);
      const code = query.get("code");

      if (!code) return;

      try {
        // 1. แลก token
        const data = new URLSearchParams();
        data.append("grant_type", "authorization_code");
        data.append("code", code);
        data.append("redirect_uri", import.meta.env.VITE_LINE_REDIRECT_URI);
        data.append("client_id", import.meta.env.VITE_LINE_CHANNEL_ID);
        data.append("client_secret", import.meta.env.VITE_LINE_CHANNEL_SECRET);
        console.log("Token request params", {
          grant_type: "authorization_code",
          code,
          redirect_uri: import.meta.env.VITE_LINE_REDIRECT_URI,
          client_id: import.meta.env.VITE_LINE_CHANNEL_ID,
          client_secret: import.meta.env.VITE_LINE_CHANNEL_SECRET,
        });

        const res = await axios.post(
          "https://api.line.me/oauth2/v2.1/token",
          data,
          { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        const { id_token } = res.data;
        const decoded = jwtDecode(id_token);

        // 2. Map ข้อมูลผู้ใช้
        const userData = {
          userId: decoded.sub, // LINE user id
          name: decoded.name || "Unknown",
          email: decoded.email || "",
          picture: decoded.picture || "",
          lastLogin: serverTimestamp(),
        };

        console.log("LINE userData", userData);

        // 3. เก็บใน localStorage + context
        localStorage.setItem("lineUser", JSON.stringify(userData));
        login(userData);

        // 4. บันทึกลง Firestore
        await setDoc(doc(db, "users", userData.userId), userData, {
          merge: true,
        });

        // 5. redirect ไป dashboard
        navigate("/menu");
      } catch (error) {
        console.error("Error fetching token:", error);
      }
    };

    fetchToken();
  }, [location, navigate, login]);

  return (
    // <div className="d-flex flex-column align-items-center justify-content-center vh-100">
    //   <img
    //     src="https://upload.wikimedia.org/wikipedia/commons/4/41/LINE_logo.svg"
    //     alt="LINE Logo"
    //     style={{ width: "60px", marginBottom: "15px" }}
    //   />
    //   <div
    //     className="spinner-border text-success mb-3"
    //     style={{ width: "3rem", height: "3rem" }}
    //   ></div>
    //   <h5 className="text-success">กำลังล็อกอินด้วย LINE...</h5>
    // </div>
    <div className="d-flex flex-column align-items-center justify-content-center vh-100">
      <div
        className="spinner-border text-success mb-3"
        style={{ width: "3rem", height: "3rem" }}
        role="status"
      >
        <span className="visually-hidden">Loading...</span>
      </div>
      <h5 className="text-muted">กำลังล็อกอินด้วย LINE...</h5>
    </div>
  );
}

export default Callback;
