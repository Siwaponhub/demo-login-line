// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
// import { getAnalytics } from "firebase/analytics"; // ถ้ายังไม่ใช้ analytics ตัดออกไปได้

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCdcH8_lkIhlSjX7-bWTu8XlvwR6ZK-YJs",
  authDomain: "travel-budget-app-15ea0.firebaseapp.com",
  projectId: "travel-budget-app-15ea0",
  storageBucket: "travel-budget-app-15ea0.appspot.com", // 👈 แก้ ".app" เป็น ".appspot.com"
  messagingSenderId: "60298033088",
  appId: "1:60298033088:web:71b8c6e91e08700269ba25",
  measurementId: "G-DSMPQ7ST3M",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// ✅ export db และ auth ออกไปให้ component/service ใช้
export const db = getFirestore(app);
export const auth = getAuth(app);
// export const analytics = getAnalytics(app); // เปิดใช้งานถ้าจำเป็น
