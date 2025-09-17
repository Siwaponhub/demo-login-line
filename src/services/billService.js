import { db } from "../firebase";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";

export async function createBill(tripName, createdBy) {
  return await addDoc(collection(db, "bills"), {
    tripName,
    createdBy,
    members: [],
    payments: [],
    createdAt: new Date(),
  });
}

export async function addMemberToBill(billId, member) {
  const billRef = doc(db, "bills", billId);
  return await updateDoc(billRef, {
    members: arrayUnion(member),
  });
}
