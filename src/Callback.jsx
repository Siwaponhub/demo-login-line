import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { jwtDecode } from "jwt-decode";

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
          const profile = jwtDecode(id_token);
          console.log("profile", profile);

          // ✅ เก็บข้อมูลผู้ใช้ลง localStorage
          localStorage.setItem("lineUser", JSON.stringify(profile));

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
