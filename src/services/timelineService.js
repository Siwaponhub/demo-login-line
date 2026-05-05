import { db } from "../firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

const timelineCollection = (groupId) =>
  collection(db, "groups", groupId, "timeline");

export async function getTimelineItems(groupId) {
  const snapshot = await getDocs(timelineCollection(groupId));
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
}

export async function addTimelineItem(groupId, item) {
  return addDoc(timelineCollection(groupId), {
    ...item,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateTimelineItem(groupId, itemId, item) {
  return updateDoc(doc(db, "groups", groupId, "timeline", itemId), {
    ...item,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTimelineItem(groupId, itemId) {
  return deleteDoc(doc(db, "groups", groupId, "timeline", itemId));
}
