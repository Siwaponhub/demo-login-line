import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import {
  STATUS, attachGeminiCheck, buildSettledBills, closeFinance, computeNetting, confirmPayout,
  deletePayment, deletePayout, deriveStatus, getOutstanding, getPayments,
  getPayouts, getOverpaid, getPaymentAllocations, getPayoutRemaining, isFinance,
  paymentTotalAmount, reopenFinance, reviewPayment, sendPayout, submitPayment,
  totalVerifiedPaid,
} from "../services/financeService";
import { isGeminiEnabled, verifySlip } from "../services/geminiService";
import { resizeImageToDataURL } from "../utils/image";
import { getBills } from "../services/billService";
import { getUserProfile } from "../services/userService";
import { useAuth } from "../AuthContext";
import { useImageViewer } from "../ImageViewerContext";

const money = (n) =>
  Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

const toast = (icon, title) =>
  Swal.fire({ toast: true, position: "top", icon, title, showConfirmButton: false, timer: 1400 });

// อัปโหลดสลิป → resize → ส่งกลับเป็น dataURL
async function pickAndCompressSlip() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        const url = await resizeImageToDataURL(file, { maxSize: 1024, quality: 0.8 });
        resolve(url);
      } catch (e) {
        console.error(e);
        resolve(null);
      }
    };
    input.click();
  });
}

function StatusPill({ status }) {
  return <span className={`pay-status pay-status-${status.tone}`}>{status.label}</span>;
}

function FinanceTab({ group, gid, onGroupUpdate = () => {} }) {
  const { user } = useAuth();
  const { openImage } = useImageViewer();
  const [bills, setBills] = useState([]);
  const [payments, setPayments] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [paymentModal, setPaymentModal] = useState(null);
  const [savingPayment, setSavingPayment] = useState(false);
  const [payoutModal, setPayoutModal] = useState(null);
  const [savingPayout, setSavingPayout] = useState(false);
  const fileSubmittingRef = useRef(false);

  const finance = isFinance(group, user?.userId);
  const wallet = group?.wallet || {};
  const walletOwnerId = wallet.walletOwnerId || "";
  const walletOwner = (group?.members || []).find((m) => m.userId === walletOwnerId);
  // QR สดของเจ้าของบัญชี (ถ้ามี linked walletOwnerId) — fallback เป็น wallet.qrDataUrl
  const [ownerQrUrl, setOwnerQrUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!walletOwnerId) {
      setOwnerQrUrl("");
      return;
    }
    (async () => {
      try {
        const profile = await getUserProfile(walletOwnerId);
        if (cancelled) return;
        setOwnerQrUrl(profile?.bankProfile?.qrDataUrl || "");
      } catch (err) {
        console.error("fetch wallet owner profile failed", err);
      }
    })();
    return () => { cancelled = true; };
  }, [walletOwnerId]);

  const displayQrUrl = ownerQrUrl || wallet.qrDataUrl || "";

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [b, ps, po] = await Promise.all([
        getBills(gid),
        getPayments(gid),
        getPayouts(gid),
      ]);
      setBills(b);
      setPayments(ps);
      setPayouts(po);
    } finally {
      setLoading(false);
    }
  }, [gid]);
  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!paymentModal && !payoutModal) return;
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      if (paymentModal && !savingPayment) setPaymentModal(null);
      if (payoutModal && !savingPayout) setPayoutModal(null);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [paymentModal, payoutModal, savingPayment, savingPayout]);

  const netting = useMemo(
    () => computeNetting(bills, group?.members || []),
    [bills, group]
  );

  const memberRows = useMemo(
    () => netting.map((row) => ({ ...row, status: deriveStatus(row, payments, payouts) })),
    [netting, payments, payouts]
  );

  const allMembersSettled = useMemo(
    () => memberRows.length > 0 && memberRows.every((r) => r.status.id === STATUS.COMPLETED.id),
    [memberRows]
  );

  const handleCloseFinance = async () => {
    const result = await Swal.fire({
      icon: "question",
      title: "ปิดบิลกลุ่มนี้?",
      text: "สมาชิกทุกคนจะเห็นสถานะ 'ปิดบิลแล้ว' ยังสามารถเปิดใหม่ได้ภายหลัง",
      showCancelButton: true,
      confirmButtonText: "ปิดบิล",
      confirmButtonColor: "#06c755",
      cancelButtonText: "ยกเลิก",
    });
    if (!result.isConfirmed) return;
    try {
      await closeFinance(gid, user);
      onGroupUpdate({
        financeClosed: true,
        financeClosedBy: user.userId,
        financeClosedByName: user.name,
      });
      toast("success", "ปิดบิลเรียบร้อยแล้ว");
    } catch (err) {
      console.error(err);
      Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถปิดบิลได้", "error");
    }
  };

  const handleReopenFinance = async () => {
    const result = await Swal.fire({
      icon: "warning",
      title: "เปิดบิลใหม่?",
      text: "สถานะ 'ปิดบิลแล้ว' จะถูกยกเลิก",
      showCancelButton: true,
      confirmButtonText: "เปิดใหม่",
      cancelButtonText: "ยกเลิก",
    });
    if (!result.isConfirmed) return;
    try {
      await reopenFinance(gid);
      onGroupUpdate({ financeClosed: false });
      toast("success", "เปิดบิลใหม่แล้ว");
    } catch (err) {
      console.error(err);
      Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถเปิดบิลใหม่ได้", "error");
    }
  };

  const me = memberRows.find((r) => r.userId === user?.userId);
  const myPendingPayments = payments.filter(
    (p) => p.userId === user?.userId && p.status === "pending"
  );
  const myAwaitingPayout = payouts.find(
    (p) => p.toUserId === user?.userId && p.status === "sent"
  );
  // คำนวณ bills ที่ settle ถูกต้องจาก verified payments เท่านั้น (ไม่ใช้ netting)
  // ทำให้ไม่ขึ้นกับ Firestore ที่อาจมีข้อมูล centralSettledPaid เก่าค้างอยู่
  const settledBills = useMemo(
    () => buildSettledBills(bills, payments),
    [bills, payments]
  );

  const perBillOutstanding = useMemo(() => {
    const map = new Map();
    (group?.members || []).forEach((m) => {
      let total = 0;
      settledBills.forEach((bill) => {
        const p = (bill.participants || []).find((pt) => pt.userId === m.userId);
        if (!p || bill.payerId === m.userId || Number(p.share || 0) <= 0) return;
        total += Math.max(0, roundMoney(Number(p.share || 0) - Number(p.paid || 0)));
      });
      map.set(m.userId, roundMoney(total));
    });
    return map;
  }, [settledBills, group]);

  const perBillPayables = useMemo(() => {
    const map = new Map();
    settledBills.forEach((bill) => {
      const payer = (group?.members || []).find((m) => m.userId === bill.payerId);
      const payerName = payer?.name || bill.payerName || "ผู้สำรองจ่าย";
      (bill.participants || []).forEach((p) => {
        if (p.userId === bill.payerId || Number(p.share || 0) <= 0) return;
        const remaining = Math.max(0, roundMoney(Number(p.share || 0) - Number(p.paid || 0)));
        if (remaining <= 0.01) return;
        const rows = map.get(p.userId) || [];
        const existing = rows.find((row) => row.payerId === bill.payerId);
        if (existing) {
          existing.amount = roundMoney(existing.amount + remaining);
        } else {
          rows.push({ payerId: bill.payerId, payerName, amount: remaining });
        }
        map.set(p.userId, rows);
      });
    });
    return map;
  }, [settledBills, group]);

  const paymentTargetRows = useMemo(
    () =>
      memberRows
        .map((row) => ({
          ...row,
          paidIn: totalVerifiedPaid(row.userId, payments),
          outstanding: perBillOutstanding.get(row.userId) || 0,
          overpaid: getOverpaid(row, payments),
        }))
        .filter((row) => row.outstanding > 0.01),
    [memberRows, payments, perBillOutstanding]
  );

  // บิลที่แต่ละคนยังค้างจ่าย → { personId: [{billId, title, share, paid, remaining}] }
  const personBills = useMemo(() => {
    const result = {};
    paymentTargetRows.forEach((person) => {
      result[person.userId] = settledBills
        .filter((bill) => {
          const p = (bill.participants || []).find((pt) => pt.userId === person.userId);
          return p && bill.payerId !== person.userId && Number(p.share || 0) > 0;
        })
        .map((bill) => {
          const p = bill.participants.find((pt) => pt.userId === person.userId);
          const share = roundMoney(Number(p.share || 0));
          const paid = roundMoney(Number(p.paid || 0));
          const remaining = Math.max(0, roundMoney(share - paid));
          return { billId: bill.id, title: bill.title, share, paid, remaining };
        })
        .filter((b) => b.remaining > 0.01);
    });
    return result;
  }, [paymentTargetRows, bills]);

  const togglePersonExpanded = (personId) => {
    setPaymentModal((current) => {
      if (!current) return current;
      const prev = current.expandedPersonIds || [];
      const exists = prev.includes(personId);
      return {
        ...current,
        expandedPersonIds: exists
          ? prev.filter((id) => id !== personId)
          : [...prev, personId],
      };
    });
  };

  const togglePersonBill = (personId, billId) => {
    setPaymentModal((current) => {
      if (!current) return current;
      const prev = (current.selectedBills || {})[personId] || [];
      const exists = prev.includes(billId);
      const next = exists ? prev.filter((id) => id !== billId) : [...prev, billId];
      return {
        ...current,
        selectedBills: { ...(current.selectedBills || {}), [personId]: next },
      };
    });
  };

  const togglePersonAllBills = (personId) => {
    setPaymentModal((current) => {
      if (!current) return current;
      const billList = personBills[personId] || [];
      const selected = (current.selectedBills || {})[personId] || [];
      const allSelected = billList.length > 0 && billList.every((b) => selected.includes(b.billId));
      return {
        ...current,
        selectedBills: {
          ...(current.selectedBills || {}),
          [personId]: allSelected ? [] : billList.map((b) => b.billId),
        },
      };
    });
  };

  const paymentDraft = useMemo(() => {
    if (!paymentModal) return { amount: 0, allocations: [] };
    const selectedBills = paymentModal.selectedBills || {};
    const allocations = [];
    Object.entries(selectedBills).forEach(([personId, billIds]) => {
      if (!billIds?.length) return;
      const person = paymentTargetRows.find((r) => r.userId === personId);
      if (!person) return;
      const billList = (personBills[personId] || []).filter((b) => billIds.includes(b.billId));
      const amount = roundMoney(billList.reduce((s, b) => s + b.remaining, 0));
      if (amount <= 0) return;
      allocations.push({
        userId: personId,
        userName: person.name,
        picture: person.picture,
        outstandingBefore: person.outstanding,
        amount,
        bills: billList,
      });
    });
    const totalAmount = roundMoney(allocations.reduce((s, a) => s + a.amount, 0));
    return { amount: totalAmount, allocations };
  }, [paymentModal, paymentTargetRows, personBills]);

  // ====== Member: แนบสลิปรวมจ่ายเงิน ======
  const handlePayIn = () => {
    if (!user || paymentTargetRows.length === 0) return;
    // auto-expand ตัวเองถ้ามีอยู่ในลิสต์
    const selfInList = paymentTargetRows.find((r) => r.userId === user.userId);
    setPaymentModal({
      slipDataUrl: "",
      selectedBills: {},
      expandedPersonIds: selfInList ? [selfInList.userId] : [paymentTargetRows[0].userId],
    });
  };

  const closePaymentModal = () => {
    if (savingPayment) return;
    setPaymentModal(null);
  };

  const handlePickPaymentSlip = async () => {
    const slip = await pickAndCompressSlip();
    if (!slip) return;
    setPaymentModal((current) =>
      current ? { ...current, slipDataUrl: slip } : current
    );
  };

  const handleSubmitPayment = async (event) => {
    event.preventDefault();
    if (!paymentModal || fileSubmittingRef.current) return;
    if (!paymentModal.slipDataUrl) {
      Swal.fire("ยังไม่มีสลิป", "แนบรูปสลิปก่อนส่งให้ฝ่ายการเงินตรวจ", "info");
      return;
    }
    const hasAnyBill = Object.values(paymentModal.selectedBills || {}).some((ids) => ids?.length > 0);
    if (!hasAnyBill) {
      Swal.fire("เลือกบิล", "เลือกบิลที่ต้องการจ่ายอย่างน้อย 1 รายการ", "info");
      return;
    }
    if (paymentDraft.amount <= 0) {
      Swal.fire("ยอดเป็น 0", "ยอดรวมบิลที่เลือกต้องมากกว่า 0", "info");
      return;
    }

    fileSubmittingRef.current = true;
    setSavingPayment(true);
    try {
      const forBills = [];
      Object.entries(paymentModal.selectedBills || {}).forEach(([personId, billIds]) => {
        if (!billIds?.length) return;
        const person = paymentTargetRows.find((r) => r.userId === personId);
        (personBills[personId] || [])
          .filter((b) => billIds.includes(b.billId))
          .forEach((b) => forBills.push({
            billId: b.billId,
            title: b.title,
            personId,
            personName: person?.name || "",
            amount: b.remaining,
          }));
      });
      await submitPayment(gid, {
        userId: user.userId,
        userName: user.name,
        amount: paymentDraft.amount,
        slipDataUrl: paymentModal.slipDataUrl,
        allocations: paymentDraft.allocations.map((allocation) => ({
          userId: allocation.userId,
          userName: allocation.userName,
          amount: allocation.amount,
          outstandingBefore: allocation.outstandingBefore,
        })),
        forBills,
      });
      setPaymentModal(null);
      toast("success", `ส่งสลิปรวมแล้ว (${money(paymentDraft.amount)})`);
      reload();
    } finally {
      fileSubmittingRef.current = false;
      setSavingPayment(false);
    }
  };

  // ====== Member: ยืนยันรับเงิน ======
  const handleConfirmReceipt = async (payoutId) => {
    setBusyId(payoutId);
    try {
      await confirmPayout(gid, payoutId);
      toast("success", "ยืนยันรับเงินแล้ว");
      reload();
    } finally { setBusyId(null); }
  };

  // ====== Finance: AI ตรวจสลิป ======
  const handleAiCheck = async (payment) => {
    if (!isGeminiEnabled()) {
      Swal.fire("AI ไม่พร้อม", "ตั้ง VITE_GEMINI_API_KEY ใน .env ก่อน", "info");
      return;
    }
    setBusyId(payment.id);
    try {
      const result = await verifySlip(payment.slipDataUrl, {
        amount: payment.amount,
        account: wallet.promptpay || wallet.bankAccount || "",
      });
      await attachGeminiCheck(gid, payment.id, result);
      reload();
    } catch (err) {
      console.error(err);
      Swal.fire("AI ตรวจไม่สำเร็จ", err.message || "ลองใหม่", "error");
    } finally { setBusyId(null); }
  };

  // ====== Finance: อนุมัติ/ปฏิเสธ payment (กรอกยอดจริง) ======
  const handleApprove = async (payment) => {
    const suggested = payment.geminiCheck?.foundAmount ?? payment.amount;
    const { value } = await Swal.fire({
      title: "ยอดที่ได้รับจริง",
      html: `<small class="text-muted">ยอดสลิปรวมที่สมาชิกส่ง: <strong>${money(payment.amount)}</strong></small>`,
      input: "number",
      inputValue: suggested,
      inputAttributes: { min: 0, step: 0.01 },
      showCancelButton: true,
      confirmButtonText: "อนุมัติ",
      confirmButtonColor: "#06c755",
      inputValidator: (v) =>
        !v || Number(v) <= 0 ? "กรอกยอดที่ได้รับมา" : undefined,
    });
    if (value === undefined) return;

    setBusyId(payment.id);
    try {
      await reviewPayment(
        gid,
        payment.id,
        { status: "verified", actualAmount: Number(value) },
        user
      );
      const diff = Number(value) - Number(payment.amount);
      const msg = Math.abs(diff) < 0.01
        ? "อนุมัติเต็มจำนวนแล้ว"
        : diff > 0
          ? `อนุมัติ (เกิน ${money(diff)})`
          : `อนุมัติ (ขาด ${money(-diff)})`;
      toast("success", msg);
      reload();
    } finally { setBusyId(null); }
  };
  const handleReject = async (payment) => {
    const { value: reason } = await Swal.fire({
      title: "เหตุผลการปฏิเสธ", input: "text", inputPlaceholder: "เช่น ยอดไม่ตรง",
      showCancelButton: true, confirmButtonText: "ปฏิเสธ", confirmButtonColor: "#dc3545",
    });
    if (reason === undefined) return;
    setBusyId(payment.id);
    try {
      await reviewPayment(gid, payment.id, { status: "rejected", reason }, user);
      toast("success", "ปฏิเสธแล้ว");
      reload();
    } finally { setBusyId(null); }
  };

  // ====== Finance: โอนคืนสมาชิก (modal แนบสลิป + ระบุยอด) ======
  const handleSendPayout = async (row) => {
    if (fileSubmittingRef.current) return;
    const remaining = getPayoutRemaining(row, payouts, payments);
    if (remaining <= 0) return;
    setPayoutModal({
      row,
      remaining,
      amount: String(remaining),
      slipDataUrl: "",
    });
  };

  const handlePickPayoutSlip = async () => {
    const slip = await pickAndCompressSlip();
    if (!slip) return;
    setPayoutModal((current) =>
      current ? { ...current, slipDataUrl: slip } : current
    );
  };

  const closePayoutModal = () => {
    if (savingPayout) return;
    setPayoutModal(null);
  };

  const handleSubmitPayout = async (event) => {
    event.preventDefault();
    if (!payoutModal || fileSubmittingRef.current) return;
    const payoutAmount = Math.round(Number(payoutModal.amount) * 100) / 100;
    if (!payoutAmount || payoutAmount <= 0) {
      Swal.fire("กรอกยอดที่โอนคืน", "ระบุจำนวนเงินมากกว่า 0", "info");
      return;
    }
    if (payoutAmount > payoutModal.remaining + 0.01) {
      Swal.fire("ยอดเกินคงเหลือ", `ยอดต้องไม่เกิน ${money(payoutModal.remaining)}`, "info");
      return;
    }
    if (!payoutModal.slipDataUrl) {
      Swal.fire("ยังไม่มีสลิป", "แนบรูปสลิปก่อนบันทึก", "info");
      return;
    }
    fileSubmittingRef.current = true;
    setSavingPayout(true);
    try {
      await sendPayout(gid, {
        toUserId: payoutModal.row.userId,
        toUserName: payoutModal.row.name,
        amount: payoutAmount,
        slipDataUrl: payoutModal.slipDataUrl,
        createdBy: user.userId, createdByName: user.name,
      });
      setPayoutModal(null);
      toast("success", `ส่งสลิปคืนแล้ว (${money(payoutAmount)})`);
      reload();
    } finally {
      fileSubmittingRef.current = false;
      setSavingPayout(false);
    }
  };

  // ====== Finance: ลบ records ======
  const handleDeletePayment = async (id) => {
    const r = await Swal.fire({
      icon: "warning", title: "ลบรายการชำระ?", showCancelButton: true,
      confirmButtonText: "ลบ", confirmButtonColor: "#dc3545",
    });
    if (!r.isConfirmed) return;
    await deletePayment(gid, id);
    reload();
  };
  const handleDeletePayout = async (id) => {
    const r = await Swal.fire({
      icon: "warning", title: "ลบรายการโอนคืน?", showCancelButton: true,
      confirmButtonText: "ลบ", confirmButtonColor: "#dc3545",
    });
    if (!r.isConfirmed) return;
    await deletePayout(gid, id);
    reload();
  };

  if (loading) return <div className="soft-card empty-state">กำลังโหลด...</div>;

  const totalPaidIn = payments.filter((p) => p.status === "verified")
    .reduce((s, p) => s + paymentTotalAmount(p), 0);
  const totalPaidOut = payouts.filter((p) => p.status === "confirmed")
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const centralBalance = roundMoney(totalPaidIn - totalPaidOut);
  const pendingQueue = payments.filter((p) => p.status === "pending");

  // คนคุมบัญชีของกลุ่ม (owner + finance role)
  const financeTeam = (group.members || []).filter(
    (m) => m.userId === group.ownerId || (group.financeUserIds || []).includes(m.userId)
  );

  return (
    <div className="finance-stack">
      {/* ===== ปิดบิลแล้ว banner ===== */}
      {group.financeClosed && (
        <section className="finance-closed-banner">
          <div className="finance-closed-banner-body">
            <span className="finance-closed-icon">✓</span>
            <div>
              <strong>ปิดบิลแล้ว</strong>
              <p className="mb-0 small">
                ปิดโดย {group.financeClosedByName || "ผู้คุมบัญชี"} · ทุกรายการชำระและโอนคืนครบแล้ว
              </p>
            </div>
          </div>
          {finance && (
            <button
              type="button"
              className="btn btn-sm btn-light border"
              onClick={handleReopenFinance}
            >
              เปิดใหม่
            </button>
          )}
        </section>
      )}

      {/* ===== ปุ่มปิดบิล (finance only, เมื่อทุกคน COMPLETED และยังไม่ปิด) ===== */}
      {finance && !group.financeClosed && allMembersSettled && (
        <section className="finance-settle-prompt soft-card p-3">
          <div className="d-flex justify-content-between align-items-center gap-3">
            <div>
              <strong>ทุกรายการเสร็จสิ้นแล้ว</strong>
              <p className="text-muted small mb-0">
                สมาชิกทุกคนชำระและรับเงินคืนครบ — กดปิดบิลเพื่อแจ้งทุกคน
              </p>
            </div>
            <button
              type="button"
              className="btn btn-success flex-shrink-0"
              onClick={handleCloseFinance}
            >
              ปิดบิล
            </button>
          </div>
        </section>
      )}

      {/* ===== ทีมคุมบัญชี ===== */}
      {financeTeam.length > 0 && (
        <section className="finance-team">
          <span className="finance-team-label">ผู้คุมบัญชี</span>
          <div className="finance-team-list">
            {financeTeam.map((m) => {
              const isOwner = m.userId === group.ownerId;
              return (
                <span
                  key={m.userId}
                  className={`finance-team-chip ${isOwner ? "is-owner" : ""}`}
                  title={isOwner ? "เจ้าของกลุ่ม" : "ฝ่ายการเงิน"}
                >
                  <img
                    src={m.picture || "https://via.placeholder.com/30"}
                    alt={m.name}
                  />
                  <span className="finance-team-name">{m.name}</span>
                  <small>{isOwner ? "เจ้าของ" : "การเงิน"}</small>
                </span>
              );
            })}
          </div>
        </section>
      )}

      {/* ===== Wallet info ===== */}
      {(wallet.promptpay || wallet.bankAccount) ? (
        <section className="soft-card p-3 p-md-4 wallet-card">
          <div className="wallet-info">
            <div>
              <span className="settings-eyebrow">บัญชีกลาง</span>
              <h3 className="h6 fw-bold mb-1 mt-2">{wallet.accountName || "ทริปกลาง"}</h3>
              {walletOwner && (
                <p className="wallet-owner-chip mb-2">
                  <img src={walletOwner.picture || "https://via.placeholder.com/24"} alt={walletOwner.name} />
                  <span>โอนเข้าบัญชีของ <strong>{walletOwner.name}</strong></span>
                </p>
              )}
              {wallet.promptpay && (
                <p className="mb-1 small"><strong>PromptPay:</strong> {wallet.promptpay}</p>
              )}
              {wallet.bankAccount && (
                <p className="mb-0 small">
                  <strong>{wallet.bankName || "บัญชีธนาคาร"}:</strong> {wallet.bankAccount}
                </p>
              )}
            </div>
            {displayQrUrl && (
              <figure className="wallet-qr-figure">
                <img
                  src={displayQrUrl}
                  alt={`qr-${walletOwner?.name || wallet.accountName || "central"}.jpg`}
                  className="wallet-qr"
                />
                {walletOwner && (
                  <figcaption>QR ของ {walletOwner.name}</figcaption>
                )}
              </figure>
            )}
          </div>
        </section>
      ) : (
        <div className="soft-card empty-state">
          ยังไม่มีบัญชีกลาง — ให้เจ้าของกลุ่มตั้งค่าที่แท็บ "ตั้งค่า → บัญชีกลาง"
        </div>
      )}

      {/* ===== Stat strip รวม ===== */}
      <section className="stat-strip">
        <div className="stat-strip-item">
          <span className="stat-strip-label">คงเหลือ</span>
          <strong className={`stat-strip-value ${centralBalance >= 0 ? "is-good" : "is-warn"}`}>
            {money(centralBalance)}
          </strong>
        </div>
        <span className="stat-strip-divider" />
        <div className="stat-strip-item">
          <span className="stat-strip-label">โอนคืน</span>
          <strong className="stat-strip-value is-good">{money(totalPaidOut)}</strong>
        </div>
        <span className="stat-strip-divider" />
        <div className="stat-strip-item">
          <span className="stat-strip-label">เข้ากลาง</span>
          <strong className="stat-strip-value is-good">{money(totalPaidIn)}</strong>
        </div>
        <span className="stat-strip-divider" />
        <div className="stat-strip-item">
          <span className="stat-strip-label">รอตรวจ</span>
          <strong className={`stat-strip-value ${pendingQueue.length ? "is-warn" : "is-good"}`}>
            {pendingQueue.length}
          </strong>
        </div>
      </section>

      {/* ===== Member Dashboard (FR-1.3) — เห็นเฉพาะของตัวเอง ===== */}
      {me && (() => {
        const outstanding = getOutstanding(me, payments);
        const paidIn = totalVerifiedPaid(me.userId, payments);
        const overpaid = getOverpaid(me, payments);
        const payoutRem = getPayoutRemaining(me, payouts, payments);
        return (
          <section className="soft-card p-3 p-md-4 me-dashboard">
            <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
              <h2 className="h5 fw-bold mb-0">สรุปของคุณ</h2>
              <StatusPill status={me.status} />
            </div>
            <div className="me-stats">
              <div><small>สำรองจ่ายไป</small><strong>{money(me.paid)}</strong></div>
              <div><small>ส่วนที่ต้องหาร</small><strong>{money(me.share)}</strong></div>
              <div><small>จ่ายเข้ากลางแล้ว</small><strong>{money(paidIn)}</strong></div>
              <div>
                <small>
                  {payoutRem > 0 ? "รอรับคืน (คงเหลือ)" : outstanding > 0 ? "ค้างจ่าย (คงเหลือ)" : "จ่ายครบแล้ว"}
                </small>
                <strong className={payoutRem > 0 ? "text-success" : outstanding > 0 ? "text-danger" : "text-muted"}>
                  {money(payoutRem > 0 ? payoutRem : outstanding)}
                </strong>
              </div>
            </div>

            {paymentTargetRows.length > 0 && (
              <button className="btn btn-success w-100 mt-3" onClick={handlePayIn}>
                แนบสลิปรวม + ระบุยอด
              </button>
            )}
            {myPendingPayments.length > 0 && (
              <p className="text-muted mt-3 mb-0 small">
                คุณส่งสลิปรอตรวจ {myPendingPayments.length} รายการ · ระบบจะนับยอดหลังฝ่ายการเงินอนุมัติ
              </p>
            )}
            {myAwaitingPayout && (
              <button
                className="btn btn-success w-100 mt-3"
                onClick={() => handleConfirmReceipt(myAwaitingPayout.id)}
                disabled={busyId === myAwaitingPayout.id}
              >
                ✓ ได้รับเงินแล้ว ({money(myAwaitingPayout.amount)})
              </button>
            )}
          </section>
        );
      })()}

      {/* ===== Netting table — เฉพาะ Finance / Owner เห็น ===== */}
      {finance && (
        <section className="soft-card p-3 p-md-4">
          <h2 className="h5 fw-bold mb-3">ยอดสุทธิทั้งกลุ่ม (Netting)</h2>
          <div className="netting-list">
            {memberRows.map((r) => {
              const payoutRem = getPayoutRemaining(r, payouts, payments);
              const outstanding = getOutstanding(r, payments);
              const billOutstanding = perBillOutstanding.get(r.userId) || 0;
              const payableRows = perBillPayables.get(r.userId) || [];
              const payableText = payableRows
                .map((row) => `ต้องจ่ายให้ ${row.payerName} ${money(row.amount)}`)
                .join(" · ");
              const paidIn = totalVerifiedPaid(r.userId, payments);
              const overpaid = getOverpaid(r, payments);
              const refundTotal = roundMoney(Math.max(0, r.net + paidIn));
              const refundPaid = Math.max(0, roundMoney(refundTotal - payoutRem));
              const offsetApplied = Math.min(roundMoney(r.paid), roundMoney(r.share));
              const netAfterOffsetLabel = r.net > 0.01
                ? `รับคืนสุทธิ ${money(r.net)}`
                : r.net < -0.01
                  ? `ต้องจ่ายสุทธิ ${money(Math.abs(r.net))}`
                  : "สมดุล";
              // บิลที่คนนี้เป็น payer → "ค่าอะไรบ้างที่ค้างคืน"
              const billsAsPayer = bills.filter((b) => b.payerId === r.userId);
              return (
                <div key={r.userId} className={`pay-row status-${r.status.tone}`}>
                  <div className="pay-row-head">
                    <div className="pay-row-name">
                      <img src={r.picture || "https://via.placeholder.com/30"} alt={r.name} className="avatar" />
                      <div className="min-w-0">
                        <strong>{r.name}</strong>
                        <small>สำรอง {money(r.paid)} · หาร {money(r.share)} · จ่ายกลาง {money(paidIn)}</small>
                      </div>
                    </div>
                    <StatusPill status={r.status} />
                  </div>

                  <div className="netting-net">
                    {r.net > 0.01 && (
                      <span className="text-success fw-bold">
                        {payoutRem <= 0.01
                          ? `รับคืนครบ ${money(refundPaid)} / ${money(refundTotal)}`
                          : `รอรับคืน ${money(payoutRem)}`}
                      </span>
                    )}
                    {r.net < -0.01 && (
                      <span className={`${overpaid > 0 ? "text-success" : outstanding > 0 ? "text-danger" : "text-success"} fw-bold`}>
                        {overpaid > 0
                          ? payoutRem <= 0.01
                            ? `รับคืนครบ ${money(refundPaid)} / ${money(refundTotal)}`
                            : `รอรับคืน ${money(payoutRem)}`
                          : outstanding > 0
                            ? `ค้างจ่าย ${money(outstanding)}`
                            : `จ่ายครบ ${money(paidIn)} / ${money(Math.abs(r.net))}`}
                      </span>
                    )}
                    {Math.abs(r.net) < 0.01 && <span className="text-muted">สมดุล</span>}
                    {payoutRem > 0.01 && (
                      <button className="btn btn-sm btn-success" onClick={() => handleSendPayout(r)}>
                        โอนคืน + แนบสลิป
                      </button>
                    )}
                  </div>

                  {billOutstanding > 0.01 && (
                    <small className="d-block text-danger fw-semibold mt-1">
                      ค้างจ่ายรายบิล {money(billOutstanding)}
                      {payableText && ` · ${payableText}`}
                    </small>
                  )}

                  <small className="d-block text-muted mt-1">
                    {refundTotal > 0.01
                      ? `โอนคืนแล้ว ${money(refundPaid)} / ${money(refundTotal)}`
                      : r.net < -0.01
                        ? `จ่ายเข้ากลางแล้ว ${money(paidIn)} / ${money(Math.abs(r.net))}`
                        : `จ่ายเข้ากลางแล้ว ${money(paidIn)}`}
                  </small>

                  {offsetApplied > 0.01 && (
                    <small className="d-block text-muted mt-1">
                      ยอดหารทั้งหมด {money(r.share)} · หักกลบจากยอดสำรอง {money(offsetApplied)} · {netAfterOffsetLabel}
                    </small>
                  )}

                  {/* รายการบิลที่คนนี้สำรองจ่าย → "ค่าอะไรบ้าง" */}
                  {billsAsPayer.length > 0 && r.net > 0.01 && (
                    <details className="netting-bills">
                      <summary>ดูบิลที่สำรองจ่าย ({billsAsPayer.length} รายการ)</summary>
                      <ul>
                        {billsAsPayer.map((b) => (
                          <li key={b.id}>
                            <span>{b.title}</span>
                            <strong>{money(b.amount)}</strong>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ===== Approval queue (Finance only — FR-3.2) ===== */}
      {finance && (
        <section className="soft-card p-3 p-md-4">
          <h2 className="h5 fw-bold mb-3">
            คิวรอตรวจสลิป
            <span className="badge text-bg-light ms-2">{pendingQueue.length}</span>
          </h2>
          {pendingQueue.length === 0 ? (
            <p className="text-muted mb-0 small">ไม่มีรายการรอตรวจ</p>
          ) : (
            <div className="queue-list">
              {pendingQueue.map((p) => {
                const allocations = getPaymentAllocations(p);
                return (
                  <article key={p.id} className="slip-card">
                    <img
                      src={p.slipDataUrl}
                      alt="slip"
                      className="slip-thumb"
                      onClick={() => openImage(p.slipDataUrl, `slip-${p.id}.jpg`)}
                      role="button"
                      tabIndex={0}
                    />
                    <div className="slip-info">
                      <div className="d-flex justify-content-between gap-2">
                        <div>
                          <strong>{p.userName}</strong>
                          <small className="d-block text-muted">สลิปรวม {money(p.amount)}</small>
                        </div>
                        <StatusPill status={STATUS.PENDING_VERIFICATION} />
                      </div>

                      {allocations.length > 0 && (
                        <div className="payment-allocation-list">
                          {allocations.map((allocation) => (
                            <div key={allocation.userId} className="payment-allocation-row">
                              <span>{allocation.userName}</span>
                              <strong>{money(allocation.amount)}</strong>
                            </div>
                          ))}
                        </div>
                      )}

                      {p.geminiCheck && (
                        <div className={`gemini-result ${p.geminiCheck.suspicious ? "is-warn" : "is-good"}`}>
                          <strong>AI:</strong> ยอด {p.geminiCheck.foundAmount ?? "?"} · บช. {p.geminiCheck.foundAccount || "?"}<br />
                          ตรงยอด: {p.geminiCheck.matchAmount ? "✓" : "✗"} · ตรงบช.: {p.geminiCheck.matchAccount ? "✓" : "✗"}
                          {p.geminiCheck.suspicious && " · ⚠ น่าสงสัย"}
                          <em className="d-block small mt-1">{p.geminiCheck.reason}</em>
                        </div>
                      )}

                      <div className="d-flex gap-2 flex-wrap mt-2">
                        {isGeminiEnabled() && !p.geminiCheck && (
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => handleAiCheck(p)}
                          disabled={busyId === p.id}
                        >
                          {busyId === p.id ? "AI กำลังตรวจ..." : "🤖 AI ตรวจสลิป"}
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleApprove(p)}
                        disabled={busyId === p.id}
                      >
                        อนุมัติ
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleReject(p)}
                        disabled={busyId === p.id}
                      >
                        ปฏิเสธ
                      </button>
                      <button
                        className="btn btn-sm btn-light border ms-auto"
                        onClick={() => handleDeletePayment(p.id)}
                      >
                        ลบ
                      </button>
                    </div>
                  </div>
                </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ===== History (ทั้งหมด) ===== */}
      <section className="soft-card p-3 p-md-4">
        <h2 className="h5 fw-bold mb-3">ประวัติธุรกรรม</h2>
        {payments.length === 0 && payouts.length === 0 ? (
          <p className="text-muted mb-0 small">ยังไม่มีธุรกรรม</p>
        ) : (
          <div className="history-list">
            {payments.map((p) => {
              const actual = Number(p.actualAmount);
              const claimed = Number(p.amount);
              const showActual = p.status === "verified" && !Number.isNaN(actual) && Math.abs(actual - claimed) > 0.01;
              const allocations = getPaymentAllocations(p);
              return (
                <div key={`pay-${p.id}`} className="history-row">
                  <span className="history-label">เข้า</span>
                  <span className="history-name">
                    {p.userName}
                    {allocations.length > 0 && (
                      <small className="d-block text-muted">
                        จ่ายให้ {allocations.map((allocation) => `${allocation.userName} ${money(allocation.amount)}`).join(" · ")}
                      </small>
                    )}
                    {showActual && (
                      <small className="d-block text-muted">
                        อ้าง {money(claimed)} · จริง {money(actual)}
                      </small>
                    )}
                  </span>
                  <span className="history-amount text-success">+ {money(paymentTotalAmount(p))}</span>
                  <span className={`pay-status pay-status-${p.status === "verified" ? "paid" : p.status === "rejected" ? "unpaid" : "partial"}`}>
                    {p.status === "verified" ? "อนุมัติ" : p.status === "rejected" ? "ปฏิเสธ" : "รอตรวจ"}
                  </span>
                  <div className="history-actions">
                    {p.slipDataUrl && (
                      <button
                        className="btn btn-sm btn-light border"
                        onClick={() => openImage(p.slipDataUrl, `slip-${p.id}.jpg`)}
                        title="ดูสลิป"
                      >
                        ดูสลิป
                      </button>
                    )}
                    {finance && (
                      <button className="btn btn-sm btn-light border" onClick={() => handleDeletePayment(p.id)}>×</button>
                    )}
                  </div>
                </div>
              );
            })}
            {payouts.map((p) => (
              <div key={`pout-${p.id}`} className="history-row">
                <span className="history-label out">ออก</span>
                <span className="history-name">→ {p.toUserName}</span>
                <span className="history-amount text-danger">- {money(p.amount)}</span>
                <span className={`pay-status pay-status-${p.status === "confirmed" ? "paid" : "over"}`}>
                  {p.status === "confirmed" ? "ปิดแล้ว" : "รอยืนยัน"}
                </span>
                <div className="history-actions">
                  {p.slipDataUrl && (
                    <button
                      className="btn btn-sm btn-light border"
                      onClick={() => openImage(p.slipDataUrl, `slip-${p.id}.jpg`)}
                      title="ดูสลิป"
                    >
                      ดูสลิป
                    </button>
                  )}
                  {finance && (
                    <button className="btn btn-sm btn-light border" onClick={() => handleDeletePayout(p.id)}>×</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {paymentModal && (
        <div className="payout-modal" role="dialog" aria-modal="true" onClick={closePaymentModal}>
          <form className="payout-dialog payment-dialog" onSubmit={handleSubmitPayment} onClick={(e) => e.stopPropagation()}>
            <div className="payout-dialog-head">
              <div className="min-w-0">
                <h3>แนบสลิปจ่ายบิล</h3>
                <p>เลือกบุคคล → เลือกบิลที่ต้องการจ่าย → แนบสลิป</p>
              </div>
              <button type="button" className="payout-dialog-close" onClick={closePaymentModal} aria-label="ปิด" disabled={savingPayment}>×</button>
            </div>

            {/* ===== slip ===== */}
            <div className="payout-slip-panel">
              {paymentModal.slipDataUrl ? (
                <button type="button" className="payout-slip-preview" onClick={() => openImage(paymentModal.slipDataUrl, `payment-${user?.userId}.jpg`)} title="ดูสลิป">
                  <img src={paymentModal.slipDataUrl} alt="สลิปโอนเข้ากลาง" />
                </button>
              ) : (
                <button type="button" className="payout-slip-empty" onClick={handlePickPaymentSlip}>
                  <span>แนบสลิปโอนเข้ากลาง</span>
                  <small>แตะเพื่อเลือกรูป</small>
                </button>
              )}
              <button type="button" className="btn btn-sm btn-light border" onClick={handlePickPaymentSlip} disabled={savingPayment}>
                {paymentModal.slipDataUrl ? "เปลี่ยนรูป" : "เลือกรูปสลิป"}
              </button>
            </div>

            {/* ===== person → bill accordion ===== */}
            <div className="payment-person-bill-list">
              {paymentTargetRows.map((person) => {
                const billList = personBills[person.userId] || [];
                const selectedBillIds = (paymentModal.selectedBills || {})[person.userId] || [];
                const personTotal = roundMoney(
                  billList.filter((b) => selectedBillIds.includes(b.billId)).reduce((s, b) => s + b.remaining, 0)
                );
                const isExpanded = (paymentModal.expandedPersonIds || []).includes(person.userId);
                const allSelected = billList.length > 0 && billList.every((b) => selectedBillIds.includes(b.billId));

                return (
                  <div key={person.userId} className="payment-person-block">
                    <button
                      type="button"
                      className={`payment-person-header ${isExpanded ? "is-expanded" : ""} ${selectedBillIds.length > 0 ? "has-selection" : ""}`}
                      onClick={() => togglePersonExpanded(person.userId)}
                      disabled={savingPayment}
                    >
                      <img src={person.picture || "https://via.placeholder.com/30"} alt={person.name} className="avatar" />
                      <div className="payment-person-info">
                        <strong>{person.userId === user?.userId ? `${person.name} (คุณ)` : person.name}</strong>
                        <small>
                          ค้างรวม {money(person.outstanding)}
                          {selectedBillIds.length > 0 && ` · เลือก ${money(personTotal)}`}
                        </small>
                      </div>
                      {selectedBillIds.length > 0 && (
                        <span className="payment-person-badge">{selectedBillIds.length}</span>
                      )}
                      <span className={`payment-person-chevron ${isExpanded ? "is-up" : ""}`}>›</span>
                    </button>

                    {isExpanded && (
                      <div className="payment-bill-list">
                        {billList.length === 0 ? (
                          <p className="payment-bill-empty">ไม่พบบิลที่ค้างอยู่ — ลอง Sync ก่อน</p>
                        ) : (
                          <>
                            <label className="payment-bill-row payment-bill-select-all">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={allSelected}
                                onChange={() => togglePersonAllBills(person.userId)}
                                disabled={savingPayment}
                              />
                              <span>เลือกทั้งหมด ({billList.length} บิล)</span>
                              <strong>{money(roundMoney(billList.reduce((s, b) => s + b.remaining, 0)))}</strong>
                            </label>
                            {billList.map((bill) => {
                              const checked = selectedBillIds.includes(bill.billId);
                              return (
                                <label key={bill.billId} className={`payment-bill-row ${checked ? "is-on" : ""}`}>
                                  <input
                                    type="checkbox"
                                    className="form-check-input"
                                    checked={checked}
                                    onChange={() => togglePersonBill(person.userId, bill.billId)}
                                    disabled={savingPayment}
                                  />
                                  <span className="payment-bill-title">{bill.title}</span>
                                  <strong className="payment-bill-amount">
                                    {money(bill.remaining)}
                                    {bill.paid > 0 && <small> / {money(bill.share)}</small>}
                                  </strong>
                                </label>
                              );
                            })}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ===== summary ===== */}
            {paymentDraft.allocations.length > 0 && (
              <div className="payment-modal-summary">
                {paymentDraft.allocations.map((allocation) => (
                  <div key={allocation.userId}>
                    <small>{allocation.userId === user?.userId ? "คุณ" : allocation.userName}</small>
                    <strong>{money(allocation.amount)}</strong>
                  </div>
                ))}
                <div className="payment-summary-total">
                  <small>ยอดรวมในสลิป</small>
                  <strong className="text-success">{money(paymentDraft.amount)}</strong>
                </div>
              </div>
            )}

            <div className="payout-dialog-actions">
              <button type="button" className="btn btn-light border" onClick={closePaymentModal} disabled={savingPayment}>ยกเลิก</button>
              <button type="submit" className="btn btn-success" disabled={savingPayment || paymentDraft.amount <= 0}>
                {savingPayment ? "กำลังส่ง..." : `ส่งสลิป${paymentDraft.amount > 0 ? ` (${money(paymentDraft.amount)})` : ""}`}
              </button>
            </div>
          </form>
        </div>
      )}

      {payoutModal && (
        <div
          className="payout-modal"
          role="dialog"
          aria-modal="true"
          onClick={closePayoutModal}
        >
          <form className="payout-dialog" onSubmit={handleSubmitPayout} onClick={(e) => e.stopPropagation()}>
            <div className="payout-dialog-head">
              <div className="min-w-0">
                <h3>โอนคืนให้ {payoutModal.row.name}</h3>
                <p>คงเหลือ {money(payoutModal.remaining)}</p>
              </div>
              <button
                type="button"
                className="payout-dialog-close"
                onClick={closePayoutModal}
                aria-label="ปิด"
                disabled={savingPayout}
              >
                ×
              </button>
            </div>

            <div className="payout-slip-panel">
              {payoutModal.slipDataUrl ? (
                <button
                  type="button"
                  className="payout-slip-preview"
                  onClick={() => openImage(payoutModal.slipDataUrl, `payout-${payoutModal.row.userId}.jpg`)}
                  title="ดูสลิป"
                >
                  <img src={payoutModal.slipDataUrl} alt="สลิปโอนเงินคืน" />
                </button>
              ) : (
                <button type="button" className="payout-slip-empty" onClick={handlePickPayoutSlip}>
                  <span>แนบสลิปโอนเงินคืน</span>
                  <small>แตะเพื่อเลือกรูป</small>
                </button>
              )}
              <button
                type="button"
                className="btn btn-sm btn-light border"
                onClick={handlePickPayoutSlip}
                disabled={savingPayout}
              >
                {payoutModal.slipDataUrl ? "เปลี่ยนรูป" : "เลือกรูปสลิป"}
              </button>
            </div>

            <label className="payout-amount-field">
              <span>จำนวนเงินที่จ่ายคืน</span>
              <input
                type="number"
                min="0.01"
                max={payoutModal.remaining}
                step="0.01"
                className="form-control"
                value={payoutModal.amount}
                onChange={(e) =>
                  setPayoutModal((current) =>
                    current ? { ...current, amount: e.target.value } : current
                  )
                }
                disabled={savingPayout}
              />
            </label>

            <div className="payout-dialog-actions">
              <button
                type="button"
                className="btn btn-light border"
                onClick={closePayoutModal}
                disabled={savingPayout}
              >
                ยกเลิก
              </button>
              <button type="submit" className="btn btn-success" disabled={savingPayout}>
                {savingPayout ? "กำลังบันทึก..." : "บันทึกการโอนคืน"}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}

export default FinanceTab;
