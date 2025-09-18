// // src/firebase.js
// import { initializeApp } from "firebase/app";
// import { getFirestore } from "firebase/firestore";
// import { getAuth } from "firebase/auth";
// // import { getAnalytics } from "firebase/analytics"; // ถ้ายังไม่ใช้ analytics ตัดออกไปได้

// // Your web app's Firebase configuration
// const firebaseConfig = {
//   apiKey: "AIzaSyCdcH8_lkIhlSjX7-bWTu8XlvwR6ZK-YJs",
//   authDomain: "travel-budget-app-15ea0.firebaseapp.com",
//   projectId: "travel-budget-app-15ea0",
//   storageBucket: "travel-budget-app-15ea0.appspot.com", // 👈 แก้ ".app" เป็น ".appspot.com"
//   messagingSenderId: "60298033088",
//   appId: "1:60298033088:web:71b8c6e91e08700269ba25",
//   measurementId: "G-DSMPQ7ST3M",
// };

// // Initialize Firebase
// const app = initializeApp(firebaseConfig);

// // ✅ export db และ auth ออกไปให้ component/service ใช้
// export const db = getFirestore(app);
// export const auth = getAuth(app);
// // export const analytics = getAnalytics(app); // เปิดใช้งานถ้าจำเป็น
// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// ✅ อ่านค่าจาก .env
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// ✅ export ให้ใช้ที่อื่น
export const db = getFirestore(app);
export const auth = getAuth(app);
