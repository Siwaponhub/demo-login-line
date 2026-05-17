import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import {
  STATUS, attachGeminiCheck, computeNetting, confirmPayout, deletePayment,
  deletePayout, deriveStatus, getOutstanding, getPayments, getPayouts,
  getOverpaid, getPaymentAllocations, getPayoutRemaining, isFinance,
  paymentTotalAmount, reviewPayment, sendPayout, submitPayment, totalVerifiedPaid,
} from "../services/financeService";
import { isGeminiEnabled, verifySlip } from "../services/geminiService";
import { resizeImageToDataURL } from "../utils/image";
import { getBills } from "../services/billService";
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

function FinanceTab({ group, gid }) {
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

  const me = memberRows.find((r) => r.userId === user?.userId);
  const myPendingPayments = payments.filter(
    (p) => p.userId === user?.userId && p.status === "pending"
  );
  const myAwaitingPayout = payouts.find(
    (p) => p.toUserId === user?.userId && p.status === "sent"
  );
  const paymentTargetRows = useMemo(
    () =>
      memberRows
        .map((row) => ({
          ...row,
          paidIn: totalVerifiedPaid(row.userId, payments),
          outstanding: getOutstanding(row, payments),
          overpaid: getOverpaid(row, payments),
        }))
        .filter((row) => row.outstanding > 0.01),
    [memberRows, payments]
  );
  const paymentDraft = useMemo(() => {
    if (!paymentModal) {
      return {
        amount: 0,
        allocations: [],
        selectedOutstanding: 0,
        remainingAfter: 0,
        overAfter: 0,
      };
    }
    const amount = roundMoney(paymentModal.amount);
    const selected = paymentTargetRows
      .filter((row) => paymentModal.selectedIds.includes(row.userId))
      .sort((a, b) => {
        if (a.userId === user?.userId) return -1;
        if (b.userId === user?.userId) return 1;
        return 0;
      });
    let remainingAmount = amount;
    const allocations = selected.map((row) => {
      const allocated = roundMoney(Math.min(row.outstanding, Math.max(0, remainingAmount)));
      remainingAmount = roundMoney(remainingAmount - allocated);
      return {
        userId: row.userId,
        userName: row.name,
        picture: row.picture,
        outstandingBefore: row.outstanding,
        amount: allocated,
        remainingAfter: Math.max(0, roundMoney(row.outstanding - allocated)),
        overAfter: 0,
      };
    });

    if (remainingAmount > 0.01 && user?.userId && selected.length > 0) {
      const selfRow = memberRows.find((row) => row.userId === user.userId);
      const existing = allocations.find((allocation) => allocation.userId === user.userId);
      if (existing) {
        existing.amount = roundMoney(existing.amount + remainingAmount);
        existing.remainingAfter = 0;
        existing.overAfter = roundMoney(existing.amount - existing.outstandingBefore);
      } else {
        allocations.push({
          userId: user.userId,
          userName: user.name || "คุณ",
          picture: selfRow?.picture || user.picture || "",
          outstandingBefore: 0,
          amount: remainingAmount,
          remainingAfter: 0,
          overAfter: remainingAmount,
          isExcess: true,
        });
      }
      remainingAmount = 0;
    }

    const selectedOutstanding = roundMoney(
      selected.reduce((sum, row) => sum + row.outstanding, 0)
    );
    return {
      amount,
      allocations: allocations.filter((allocation) => allocation.amount > 0),
      selectedOutstanding,
      remainingAfter: Math.max(0, roundMoney(selectedOutstanding - amount)),
      overAfter: Math.max(0, roundMoney(amount - selectedOutstanding)),
    };
  }, [memberRows, paymentModal, paymentTargetRows, user]);

  // ====== Member: แนบสลิปรวมจ่ายเงิน ======
  const handlePayIn = () => {
    if (!user || paymentTargetRows.length === 0) return;
    const ownTarget = paymentTargetRows.find((row) => row.userId === user.userId);
    const firstTarget = ownTarget || paymentTargetRows[0];
    setPaymentModal({
      amount: String(firstTarget.outstanding),
      slipDataUrl: "",
      selectedIds: [firstTarget.userId],
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

  const togglePaymentTarget = (targetId) => {
    setPaymentModal((current) => {
      if (!current) return current;
      const exists = current.selectedIds.includes(targetId);
      const selectedIds = exists
        ? current.selectedIds.filter((id) => id !== targetId)
        : [...current.selectedIds, targetId];
      const selectedOutstanding = paymentTargetRows
        .filter((row) => selectedIds.includes(row.userId))
        .reduce((sum, row) => sum + row.outstanding, 0);
      return {
        ...current,
        selectedIds,
        amount: selectedIds.length ? String(roundMoney(selectedOutstanding)) : current.amount,
      };
    });
  };

  const handleSubmitPayment = async (event) => {
    event.preventDefault();
    if (!paymentModal || fileSubmittingRef.current) return;
    if (!paymentModal.slipDataUrl) {
      Swal.fire("ยังไม่มีสลิป", "แนบรูปสลิปก่อนส่งให้ฝ่ายการเงินตรวจ", "info");
      return;
    }
    if (!paymentDraft.amount || paymentDraft.amount <= 0) {
      Swal.fire("กรอกยอดที่จ่าย", "ระบุจำนวนเงินที่โอนมากกว่า 0", "info");
      return;
    }
    if (paymentModal.selectedIds.length === 0) {
      Swal.fire("เลือกผู้รับยอด", "เลือกตัวเองหรือเพื่อนที่ต้องการจ่ายแทนอย่างน้อย 1 คน", "info");
      return;
    }
    if (paymentDraft.allocations.length === 0) {
      Swal.fire("เลือกผู้รับยอด", "เลือกตัวเองหรือเพื่อนที่ต้องการจ่ายแทนอย่างน้อย 1 คน", "info");
      return;
    }

    fileSubmittingRef.current = true;
    setSavingPayment(true);
    try {
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
    const remaining = getPayoutRemaining(row, payouts);
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
  const pendingQueue = payments.filter((p) => p.status === "pending");

  // คนคุมบัญชีของกลุ่ม (owner + finance role)
  const financeTeam = (group.members || []).filter(
    (m) => m.userId === group.ownerId || (group.financeUserIds || []).includes(m.userId)
  );

  return (
    <div className="finance-stack">
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
              {wallet.promptpay && (
                <p className="mb-1 small"><strong>PromptPay:</strong> {wallet.promptpay}</p>
              )}
              {wallet.bankAccount && (
                <p className="mb-0 small">
                  <strong>{wallet.bankName || "บัญชีธนาคาร"}:</strong> {wallet.bankAccount}
                </p>
              )}
            </div>
            {wallet.qrDataUrl && (
              <img src={wallet.qrDataUrl} alt="QR" className="wallet-qr" />
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
          <span className="stat-strip-label">รับเข้ากลาง</span>
          <strong className="stat-strip-value is-good">{money(totalPaidIn)}</strong>
        </div>
        <span className="stat-strip-divider" />
        <div className="stat-strip-item">
          <span className="stat-strip-label">โอนคืนแล้ว</span>
          <strong className="stat-strip-value is-good">{money(totalPaidOut)}</strong>
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
        const payoutRem = getPayoutRemaining(me, payouts);
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
                  {me.net >= 0 ? "รอรับคืน (คงเหลือ)" : overpaid > 0 ? "จ่ายเกิน" : "ค้างจ่าย (คงเหลือ)"}
                </small>
                <strong className={me.net >= 0 || overpaid > 0 ? "text-success" : "text-danger"}>
                  {money(me.net >= 0 ? payoutRem : overpaid > 0 ? overpaid : outstanding)}
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
              const payoutRem = getPayoutRemaining(r, payouts);
              const outstanding = getOutstanding(r, payments);
              const paidIn = totalVerifiedPaid(r.userId, payments);
              const overpaid = getOverpaid(r, payments);
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
                        + {money(payoutRem)} {payoutRem < r.net ? `/ ${money(r.net)}` : ""} (รอรับคืน)
                      </span>
                    )}
                    {r.net < -0.01 && (
                      <span className={`${overpaid > 0 ? "text-primary" : outstanding > 0 ? "text-danger" : "text-success"} fw-bold`}>
                        {overpaid > 0
                          ? `จ่ายเกิน ${money(overpaid)}`
                          : outstanding > 0
                            ? `เหลือ ${money(outstanding)} / ${money(Math.abs(r.net))} (ต้องจ่าย)`
                            : `จ่ายครบ ${money(Math.abs(r.net))}`}
                      </span>
                    )}
                    {Math.abs(r.net) < 0.01 && <span className="text-muted">สมดุล</span>}
                    {r.net > 0.01 && payoutRem > 0.01 && (
                      <button className="btn btn-sm btn-success" onClick={() => handleSendPayout(r)}>
                        โอนคืน + แนบสลิป
                      </button>
                    )}
                  </div>

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
        <div
          className="payout-modal"
          role="dialog"
          aria-modal="true"
          onClick={closePaymentModal}
        >
          <form className="payout-dialog payment-dialog" onSubmit={handleSubmitPayment} onClick={(e) => e.stopPropagation()}>
            <div className="payout-dialog-head">
              <div className="min-w-0">
                <h3>แนบสลิปรวม</h3>
                <p>เลือกคนที่จ่ายแทนได้หลายคนในสลิปเดียว</p>
              </div>
              <button
                type="button"
                className="payout-dialog-close"
                onClick={closePaymentModal}
                aria-label="ปิด"
                disabled={savingPayment}
              >
                ×
              </button>
            </div>

            <div className="payout-slip-panel">
              {paymentModal.slipDataUrl ? (
                <button
                  type="button"
                  className="payout-slip-preview"
                  onClick={() => openImage(paymentModal.slipDataUrl, `payment-${user?.userId}.jpg`)}
                  title="ดูสลิป"
                >
                  <img src={paymentModal.slipDataUrl} alt="สลิปโอนเข้ากลาง" />
                </button>
              ) : (
                <button type="button" className="payout-slip-empty" onClick={handlePickPaymentSlip}>
                  <span>แนบสลิปโอนเข้ากลาง</span>
                  <small>แตะเพื่อเลือกรูป</small>
                </button>
              )}
              <button
                type="button"
                className="btn btn-sm btn-light border"
                onClick={handlePickPaymentSlip}
                disabled={savingPayment}
              >
                {paymentModal.slipDataUrl ? "เปลี่ยนรูป" : "เลือกรูปสลิป"}
              </button>
            </div>

            <label className="payout-amount-field">
              <span>จำนวนเงินที่จ่ายจริงในสลิป</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                className="form-control"
                value={paymentModal.amount}
                onChange={(e) =>
                  setPaymentModal((current) =>
                    current ? { ...current, amount: e.target.value } : current
                  )
                }
                disabled={savingPayment}
              />
            </label>

            <div className="payment-target-panel">
              <div className="payment-target-head">
                <strong>จ่ายแทนใครบ้าง</strong>
                <small>ระบบจะกระจายยอดจากบนลงล่างตามยอดค้าง</small>
              </div>
              <div className="payment-target-list">
                {paymentTargetRows.map((target) => {
                  const checked = paymentModal.selectedIds.includes(target.userId);
                  return (
                    <label key={target.userId} className={`payment-target ${checked ? "is-on" : ""}`}>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={checked}
                        onChange={() => togglePaymentTarget(target.userId)}
                        disabled={savingPayment}
                      />
                      <img src={target.picture || "https://via.placeholder.com/30"} alt={target.name} className="avatar" />
                      <span className="payment-target-name">
                        <strong>{target.userId === user?.userId ? "คุณ" : target.name}</strong>
                        <small>ค้าง {money(target.outstanding)}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="payment-modal-summary">
              <div>
                <small>ยอดในสลิป</small>
                <strong>{money(paymentDraft.amount)}</strong>
              </div>
              <div>
                <small>ยังเหลือหลังสลิปนี้</small>
                <strong className={paymentDraft.remainingAfter > 0 ? "text-danger" : "text-success"}>
                  {money(paymentDraft.remainingAfter)}
                </strong>
              </div>
              <div>
                <small>จ่ายเกิน</small>
                <strong className={paymentDraft.overAfter > 0 ? "text-primary" : "text-muted"}>
                  {money(paymentDraft.overAfter)}
                </strong>
              </div>
            </div>

            {paymentDraft.allocations.length > 0 && (
              <div className="payment-allocation-list">
                {paymentDraft.allocations.map((allocation) => (
                  <div key={allocation.userId} className="payment-allocation-row">
                    <span>
                      {allocation.userId === user?.userId ? "คุณ" : allocation.userName}
                      {allocation.isExcess && <small> · ยอดเกินเข้าบัญชีผู้จ่าย</small>}
                    </span>
                    <strong>
                      {money(allocation.amount)}
                      {allocation.remainingAfter > 0 && ` · เหลือ ${money(allocation.remainingAfter)}`}
                      {allocation.overAfter > 0 && ` · เกิน ${money(allocation.overAfter)}`}
                    </strong>
                  </div>
                ))}
              </div>
            )}

            <div className="payout-dialog-actions">
              <button
                type="button"
                className="btn btn-light border"
                onClick={closePaymentModal}
                disabled={savingPayment}
              >
                ยกเลิก
              </button>
              <button type="submit" className="btn btn-success" disabled={savingPayment}>
                {savingPayment ? "กำลังส่ง..." : "ส่งให้ฝ่ายการเงินตรวจ"}
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
