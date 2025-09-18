import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";

export async function createBill(tripName, ownerId, totalAmount, members) {
  return await addDoc(collection(db, "bills"), {
    tripName,
    ownerId,
    totalAmount,
    members,
    createdAt: new Date(),
  });
}
