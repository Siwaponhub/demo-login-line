import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import {
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "./firebase";
import { useAuth } from "./AuthContext";

function Callback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const fetchToken = async () => {
      const query = new URLSearchParams(location.search);
      const code = query.get("code");

      if (!code) return;

      try {
        // 1. แลก token จาก LINE
        const data = new URLSearchParams();
        data.append("grant_type", "authorization_code");
        data.append("code", code);
        data.append("redirect_uri", import.meta.env.VITE_LINE_REDIRECT_URI);
        data.append("client_id", import.meta.env.VITE_LINE_CHANNEL_ID);
        data.append("client_secret", import.meta.env.VITE_LINE_CHANNEL_SECRET);

        const res = await axios.post(
          "https://api.line.me/oauth2/v2.1/token",
          data,
          { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        const { id_token } = res.data;
        const decoded = jwtDecode(id_token);

        // 2. ข้อมูล user
        const userData = {
          userId: decoded.sub,
          name: decoded.name || "Unknown",
          picture: decoded.picture || "",
          email: decoded.email || "",
          lastLogin: serverTimestamp(),
        };

        // 3. เก็บ user ใน localStorage + context
        localStorage.setItem("lineUser", JSON.stringify(userData));
        login(userData);

        // 4. บันทึก user ลง Firestore
        await setDoc(
          doc(db, "users", userData.userId),
          {
            ...userData,
            lastLogin: serverTimestamp(),
          },
          { merge: true }
        );

        // 5. เช็คว่ามี group pending อยู่ไหม
        const pendingGroupId = localStorage.getItem("pendingGroupId");
        if (pendingGroupId) {
          const ref = doc(db, "groups", pendingGroupId);
          const snap = await getDoc(ref);

          if (snap.exists()) {
            const group = snap.data();
            const alreadyIn = group.members?.some(
              (m) => m.userId === userData.userId
            );

            if (!alreadyIn) {
              await updateDoc(ref, {
                members: arrayUnion({
                  userId: userData.userId,
                  name: userData.name,
                  email: userData.email,
                  picture: userData.picture,
                }),
              });
            }

            localStorage.removeItem("pendingGroupId");
            navigate(`/group/${pendingGroupId}`); // ✅ ไปหน้า group โดยตรง
            return;
          }
        }

        // ถ้าไม่มี group → ไปหน้า menu
        navigate("/menu");
      } catch (error) {
        if (error.response) {
          console.error("❌ LINE token error:", error.response.data);
        } else {
          console.error("❌ LINE token error:", error);
        }
      }
    };

    fetchToken();
  }, [location, navigate, login]);

  return (
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
