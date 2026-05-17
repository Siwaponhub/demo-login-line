import { db } from "../firebase";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

export async function saveUser(user) {
  const id = user.userId || user.id || user.email;
  if (!id) throw new Error("Missing user id");
  await setDoc(doc(db, "users", id), user, { merge: true });
}

export async function getUserProfile(userId) {
  if (!userId) return null;
  const snap = await getDoc(doc(db, "users", userId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function saveBankProfile(userId, bankProfile) {
  if (!userId) throw new Error("Missing user id");
  const cleanBankProfile = {
    accountName: bankProfile.accountName?.trim() || "",
    bankName: bankProfile.bankName?.trim() || "",
    bankAccount: bankProfile.bankAccount?.trim() || "",
    promptpay: bankProfile.promptpay?.trim() || "",
    qrDataUrl: bankProfile.qrDataUrl || "",
  };

  await setDoc(
    doc(db, "users", userId),
    {
      bankProfile: cleanBankProfile,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return cleanBankProfile;
}

export async function saveAvailability(userId, availableDates) {
  await setDoc(doc(db, "availability", userId), { availableDates });
}
