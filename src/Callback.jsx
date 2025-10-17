import { useEffect, useRef } from "react";
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
  collection,
  getDocs,
} from "firebase/firestore";
import { db } from "./firebase";
import { useAuth } from "./AuthContext";
import Swal from "sweetalert2";

function Callback() {
  const effectRan = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    if (effectRan.current) return;
    effectRan.current = true;
    const fetchToken = async () => {
      const query = new URLSearchParams(location.search);
      const code = query.get("code");
      const state = query.get("state");
      // console.log("state", state);

      let groupId = null;

      if (state && state.startsWith("group_")) {
        groupId = state.replace("group_", "");
        // console.log("👉 groupId จาก LINE state:", groupId);
      }

      if (!code) return;

      try {
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

        const { id_token, access_token } = res.data;
        const decoded = jwtDecode(id_token);

        const profileRes = await axios.get("https://api.line.me/v2/profile", {
          headers: { Authorization: `Bearer ${access_token}` },
        });

        const profile = profileRes.data;

        const userData = {
          userId: decoded.sub,
          name: profile.displayName || decoded.name || "Unknown",
          picture: profile.pictureUrl || decoded.picture || "",
          email: decoded.email || "",
          lastLogin: serverTimestamp(),
        };

        localStorage.setItem("lineUser", JSON.stringify(userData));
        login(userData);

        await setDoc(
          doc(db, "users", userData.userId),
          { ...userData, lastLogin: serverTimestamp() },
          { merge: true }
        );

        const groupsSnap = await getDocs(collection(db, "groups"));
        for (const g of groupsSnap.docs) {
          const groupRef = doc(db, "groups", g.id);
          const groupData = g.data();

          const isMember = groupData.members?.some(
            (m) => m.userId === userData.userId
          );

          if (isMember) {
            const updatedMembers = groupData.members.map((m) =>
              m.userId === userData.userId
                ? {
                    ...m,
                    name: userData.name,
                    picture: userData.picture,
                    email: userData.email,
                  }
                : m
            );

            await updateDoc(groupRef, { members: updatedMembers });
          }
        }

        if (groupId) {
          const ref = doc(db, "groups", groupId);
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

              await Swal.fire({
                icon: "success",
                title: "เข้าร่วมกลุ่มเรียบร้อย",
                text: `คุณได้เข้าร่วมกลุ่ม: ${group.name}`,
              });
            } else {
              await Swal.fire({
                icon: "info",
                title: "คุณอยู่ในกลุ่มนี้แล้ว",
                text: group.name,
              });
            }

            navigate(`/group/${groupId}`);
            return;
          } else {
            await Swal.fire("❌ ไม่พบกลุ่ม", "", "error");
          }
        }

        navigate("/menu");
      } catch (error) {
        console.error("❌ LINE token error:", error.response?.data || error);
      }
    };

    fetchToken();
  }, [location, navigate, login]);

  return (
    <div className="d-flex flex-column align-items-center justify-content-center vh-100">
      <div
        className="spinner-border text-success mb-3"
        style={{ width: "3rem", height: "3rem" }}
      ></div>
      <h5 className="text-muted">กำลังล็อกอินด้วย LINE...</h5>
    </div>
  );
}

export default Callback;
