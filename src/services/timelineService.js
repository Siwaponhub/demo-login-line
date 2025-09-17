import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";

export async function addTimeline(tripId, item) {
  return await addDoc(collection(db, `trips/${tripId}/timeline`), item);
}
