import { db } from "../firebase";
import {
  collection, deleteDoc, doc, getDoc, getDocs,
  orderBy, query, setDoc, updateDoc, serverTimestamp,
} from "firebase/firestore";

export async function checkIsAdmin(userId) {
  if (!userId) return false;
  const snap = await getDoc(doc(db, "users", userId));
  return snap.exists() && snap.data()?.isAdmin === true;
}

export async function getAllGroups() {
  const snap = await getDocs(query(collection(db, "groups"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getAllUsers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getGroupBills(groupId) {
  const snap = await getDocs(
    query(collection(db, "groups", groupId, "bills"), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, groupId, ...d.data() }));
}

export async function getGroupPayments(groupId) {
  const snap = await getDocs(
    query(collection(db, "groups", groupId, "payments"), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, groupId, ...d.data() }));
}

export async function deleteGroup(groupId) {
  return deleteDoc(doc(db, "groups", groupId));
}

export async function setGroupFinanceUsers(groupId, financeUserIds) {
  return updateDoc(doc(db, "groups", groupId), { financeUserIds });
}

export async function setGroupOwner(groupId, ownerId) {
  return updateDoc(doc(db, "groups", groupId), { ownerId });
}

export async function setUserAdmin(userId, isAdmin) {
  return setDoc(doc(db, "users", userId), { isAdmin, updatedAt: serverTimestamp() }, { merge: true });
}

export async function updateGroupName(groupId, name) {
  return updateDoc(doc(db, "groups", groupId), { name, updatedAt: serverTimestamp() });
}
