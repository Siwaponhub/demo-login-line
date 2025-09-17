import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

function Callback() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchToken = async () => {
      const query = new URLSearchParams(location.search);
      const code = query.get("code");

      if (code) {
        try {
          const data = new URLSearchParams();
          data.append("grant_type", "authorization_code");
          data.append("code", code);
          data.append("redirect_uri", import.meta.env.VITE_LINE_REDIRECT_URI);
          data.append("client_id", import.meta.env.VITE_LINE_CHANNEL_ID);
          data.append(
            "client_secret",
            import.meta.env.VITE_LINE_CHANNEL_SECRET
          );

          const res = await axios.post(
            "https://api.line.me/oauth2/v2.1/token",
            data,
            {
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
            }
          );

          const { id_token } = res.data;
          const decoded = jwtDecode(id_token);

          // ✅ Map field ให้ตรงกับ LoginButton.jsx
          const userData = {
            userId: decoded.sub, // ใช้เป็น primary key
            name: decoded.name,
            email: decoded.email || "",
            picture: decoded.picture || "",
          };

          console.log("LINE userData", userData);

          // เก็บใน localStorage
          localStorage.setItem("lineUser", JSON.stringify(userData));

          // ✅ บันทึกลง Firestore
          await setDoc(doc(db, "users", userData.userId), userData, {
            merge: true,
          });

          // กลับไปหน้าแรก
          navigate("/");
        } catch (error) {
          console.error("Error fetching token:", error);
        }
      }
    };

    fetchToken();
  }, [location, navigate]);

  return <div>กำลังล็อกอินด้วย LINE...</div>;
}

export default Callback;
