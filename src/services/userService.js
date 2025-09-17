import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";

export async function saveUser(user) {
  await setDoc(doc(db, "users", user.id), user);
}

export async function saveAvailability(userId, availableDates) {
  await setDoc(doc(db, "availability", userId), { availableDates });
}
