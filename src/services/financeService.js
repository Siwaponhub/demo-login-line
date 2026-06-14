// ระบบการเงินกลาง (Centralized Netting Engine + Payment Workflow)
// ใช้ pure JS สำหรับคำนวณ + Firestore สำหรับเก็บ records
import { db } from "../firebase";
import {
  addDoc, collection, deleteDoc, doc, getDocs, orderBy, query,
  serverTimestamp, updateDoc,
} from "firebase/firestore";

const paymentsRef = (gid) => collection(db, "groups", gid, "payments");
const payoutsRef = (gid) => collection(db, "groups", gid, "payouts");
const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

// ====== NETTING CALCULATION (FR-1) ======
// Input: bills[] + members[]
// Output: per-member { userId, name, paid, share, net, role }
//   net > 0  → ต้องได้รับคืน (Pay-out)
//   net < 0  → ต้องจ่ายเพิ่ม (Pay-in)
//   net == 0 → สมดุล
export function computeNetting(bills, members) {
  const map = new Map();
  members.forEach((m) => {
    map.set(m.userId, {
      userId: m.userId,
      name: m.name,
      picture: m.picture || "",
      paid: 0,    // ยอดที่คนนี้สำรองจ่ายไป (เป็น payer ของบิล)
      share: 0,   // ยอดส่วนที่คนนี้ต้องรับผิดชอบ
      net: 0,
    });
  });

  bills.forEach((b) => {
    const amount = Number(b.amount || 0);
    const payer = map.get(b.payerId);
    if (payer) payer.paid += amount;
    (b.participants || []).forEach((p) => {
      const row = map.get(p.userId);
      if (row) row.share += Number(p.share || 0);
    });
  });

  // round 2 decimal + compute net
  const rows = Array.from(map.values()).map((r) => {
    const paid = Math.round(r.paid * 100) / 100;
    const share = Math.round(r.share * 100) / 100;
    return { ...r, paid, share, net: Math.round((paid - share) * 100) / 100 };
  });

  // NFR-2.2: residual จากการ rounding กระจายเข้ารายการแรกให้ผลรวม = 0
  const residual = Math.round(rows.reduce((s, r) => s + r.net, 0) * 100) / 100;
  if (rows.length && Math.abs(residual) >= 0.01) {
    rows[0].net = Math.round((rows[0].net - residual) * 100) / 100;
  }
  return rows;
}

// ====== PAYMENT RECORDS (FR-2) ======
// member submits payment with slip
export async function submitPayment(gid, payload) {
  return addDoc(paymentsRef(gid), {
    status: "pending",  // pending → verified | rejected
    createdAt: serverTimestamp(),
    ...payload,
  });
}

export async function getPayments(gid) {
  const snap = await getDocs(query(paymentsRef(gid), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// finance approves/rejects (FR-3) — รองรับ actualAmount (จ่ายมาบางส่วนได้)
export async function reviewPayment(gid, paymentId, decision, reviewer) {
  const update = {
    status: decision.status,         // "verified" | "rejected"
    rejectReason: decision.reason || "",
    reviewedBy: reviewer.userId,
    reviewedByName: reviewer.name,
    reviewedAt: serverTimestamp(),
  };
  if (decision.actualAmount !== undefined) {
    update.actualAmount = Number(decision.actualAmount) || 0;
  }
  return updateDoc(doc(db, "groups", gid, "payments", paymentId), update);
}

export async function attachGeminiCheck(gid, paymentId, check) {
  return updateDoc(doc(db, "groups", gid, "payments", paymentId), {
    geminiCheck: { ...check, checkedAt: new Date().toISOString() },
  });
}

export async function deletePayment(gid, paymentId) {
  return deleteDoc(doc(db, "groups", gid, "payments", paymentId));
}

export function paymentTotalAmount(payment) {
  const value = payment.actualAmount !== undefined ? payment.actualAmount : payment.amount;
  return roundMoney(value);
}

export function getPaymentAllocations(payment) {
  const rawAllocations = Array.isArray(payment.allocations) && payment.allocations.length > 0
    ? payment.allocations
    : [{
        userId: payment.userId,
        userName: payment.userName,
        amount: payment.amount,
      }];
  const cleaned = rawAllocations
    .map((allocation) => ({
      userId: allocation.userId,
      userName: allocation.userName || allocation.name || "สมาชิก",
      amount: roundMoney(allocation.amount),
    }))
    .filter((allocation) => allocation.userId && allocation.amount > 0);
  const claimedTotal = roundMoney(cleaned.reduce((sum, allocation) => sum + allocation.amount, 0));
  const actualTotal = paymentTotalAmount(payment);

  if (!cleaned.length || payment.actualAmount === undefined || claimedTotal <= 0) {
    return cleaned;
  }

  let allocatedTotal = 0;
  const scaled = cleaned.map((allocation, index) => {
    const amount = index === cleaned.length - 1
      ? roundMoney(actualTotal - allocatedTotal)
      : roundMoney((allocation.amount / claimedTotal) * actualTotal);
    allocatedTotal = roundMoney(allocatedTotal + amount);
    return { ...allocation, amount: Math.max(0, amount) };
  });
  return scaled.filter((allocation) => allocation.amount > 0);
}

export function paymentIncludesUser(payment, userId) {
  return getPaymentAllocations(payment).some((allocation) => allocation.userId === userId);
}

// ====== PAYOUT RECORDS (FR-3.3, FR-4) ======
export async function sendPayout(gid, payload) {
  return addDoc(payoutsRef(gid), {
    status: "sent",  // sent → confirmed
    createdAt: serverTimestamp(),
    ...payload,
  });
}

export async function getPayouts(gid) {
  const snap = await getDocs(query(payoutsRef(gid), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function confirmPayout(gid, payoutId) {
  return updateDoc(doc(db, "groups", gid, "payouts", payoutId), {
    status: "confirmed",
    confirmedAt: serverTimestamp(),
  });
}

export async function deletePayout(gid, payoutId) {
  return deleteDoc(doc(db, "groups", gid, "payouts", payoutId));
}

// ====== STATUS DERIVATION (FR-5) ======
// แปลง netting + payments + payouts → สถานะของแต่ละสมาชิก (1 ใน 7)
export const STATUS = {
  PENDING_PAYMENT: { id: "pending_payment", label: "รอชำระ", tone: "unpaid" },
  PENDING_VERIFICATION: { id: "pending_verification", label: "รอตรวจสลิป", tone: "partial" },
  PAID: { id: "paid", label: "ชำระแล้ว", tone: "paid" },
  OVERPAID: { id: "overpaid", label: "จ่ายเกิน", tone: "over" },
  PENDING_PAYOUT: { id: "pending_payout", label: "รอโอนคืน", tone: "unpaid" },
  PAYOUT_SENT: { id: "payout_sent", label: "โอนคืนแล้ว", tone: "over" },
  AWAITING_CONFIRMATION: { id: "awaiting_confirmation", label: "รอยืนยันรับเงิน", tone: "partial" },
  COMPLETED: { id: "completed", label: "ปิดรายการ", tone: "paid" },
};

// ยอดที่ verified แล้วของคนนี้ (รวม actualAmount แทน amount ถ้ามี)
export function totalVerifiedPaid(userId, payments) {
  return roundMoney(payments
    .filter((p) => p.status === "verified")
    .reduce(
      (sum, payment) =>
        sum + getPaymentAllocations(payment)
          .filter((allocation) => allocation.userId === userId)
          .reduce((allocationSum, allocation) => allocationSum + allocation.amount, 0),
      0
    ));
}

// ยอดที่ค้างจ่ายของ user (net ติดลบ - ที่จ่ายไปแล้ว) — ไม่ติดลบ
export function getOutstanding(memberRow, payments) {
  if (memberRow.net >= -0.01) return 0;
  const owed = Math.abs(memberRow.net);
  const paid = totalVerifiedPaid(memberRow.userId, payments);
  return Math.max(0, Math.round((owed - paid) * 100) / 100);
}

export function getOverpaid(memberRow, payments) {
  const owed = memberRow.net < -0.01 ? Math.abs(memberRow.net) : 0;
  const paid = totalVerifiedPaid(memberRow.userId, payments);
  return Math.max(0, Math.round((paid - owed) * 100) / 100);
}

// ยอดที่รอรับคืน (net เป็นบวก + เงินที่จ่ายเข้ากองกลางไปแล้ว - ที่ถูกโอนคืนไปแล้ว)
export function getPayoutRemaining(memberRow, payouts, payments = []) {
  if (memberRow.net <= 0.01 && !payments.length) return 0;
  const paidIn = totalVerifiedPaid(memberRow.userId, payments);
  const credit = roundMoney(Math.max(0, memberRow.net + paidIn));
  if (credit <= 0.01) return 0;
  const sent = payouts
    .filter((p) => p.toUserId === memberRow.userId)
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  return Math.max(0, Math.round((credit - sent) * 100) / 100);
}

export function deriveStatus(memberRow, payments, payouts) {
  const { userId, net } = memberRow;
  const myPays = payments.filter((p) => paymentIncludesUser(p, userId));
  const myPouts = payouts.filter((p) => p.toUserId === userId);

  if (net < -0.01) {
    // ต้องจ่ายเพิ่ม — ใช้ยอด actualAmount สะสม
    const owed = Math.abs(net);
    const paidSum = totalVerifiedPaid(userId, payments);
    if (paidSum > owed + 0.01) return STATUS.OVERPAID;
    if (paidSum >= owed - 0.01) return STATUS.PAID;

    const pending = myPays.find((p) => p.status === "pending");
    if (pending) return STATUS.PENDING_VERIFICATION;
    // มี verified บางส่วนแล้ว แต่ยังไม่ครบ → ยังถือว่ารอชำระต่อ
    return STATUS.PENDING_PAYMENT;
  }

  // net >= 0 → รวมเงินที่จ่ายเข้ากองกลางไปแล้วด้วย
  const paidIn = totalVerifiedPaid(userId, payments);
  const totalCredit = roundMoney(Math.max(0, net) + paidIn);
  if (totalCredit < 0.01) return STATUS.COMPLETED;

  // ต้องรับคืน
  const totalPayout = myPouts.reduce((s, p) => s + Number(p.amount || 0), 0);
  const sentTotal = myPouts
    .filter((p) => p.status === "sent")
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  if (totalPayout >= totalCredit - 0.01) {
    return sentTotal > 0 ? STATUS.AWAITING_CONFIRMATION : STATUS.COMPLETED;
  }
  if (totalPayout > 0.01) {
    return sentTotal > 0 ? STATUS.AWAITING_CONFIRMATION : STATUS.PENDING_PAYOUT;
  }
  return STATUS.PENDING_PAYOUT;
}

// เจ้าของกลุ่ม + คนที่มี role "finance" → สามารถจัดการเรื่องเงินทั้งหมดได้
// (อนุมัติ/ปฏิเสธ สลิป, โอนคืน, ลบ records, CRUD บิล)
export const isFinance = (group, userId) =>
  !!userId &&
  (group?.ownerId === userId ||
    (Array.isArray(group?.financeUserIds) && group.financeUserIds.includes(userId)));

// ====== FINANCE CLOSE / REOPEN (FR-6) ======
export async function closeFinance(gid, actor) {
  return updateDoc(doc(db, "groups", gid), {
    financeClosed: true,
    financeClosedAt: serverTimestamp(),
    financeClosedBy: actor.userId,
    financeClosedByName: actor.name,
  });
}

export async function reopenFinance(gid) {
  return updateDoc(doc(db, "groups", gid), {
    financeClosed: false,
    financeClosedAt: null,
    financeClosedBy: null,
    financeClosedByName: null,
  });
}
