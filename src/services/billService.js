import { db } from "../firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

const billsCollection = (groupId) => collection(db, "groups", groupId, "bills");

export async function getBills(groupId) {
  const q = query(billsCollection(groupId), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
}

export async function createBill(groupId, bill) {
  return addDoc(billsCollection(groupId), {
    ...bill,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateBill(groupId, billId, bill) {
  return updateDoc(doc(db, "groups", groupId, "bills", billId), {
    ...bill,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteBill(groupId, billId) {
  return deleteDoc(doc(db, "groups", groupId, "bills", billId));
}
