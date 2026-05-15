import { useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import {
  STATUS, attachGeminiCheck, computeNetting, confirmPayout, deletePayment,
  deletePayout, deriveStatus, getOutstanding, getPayments, getPayouts,
  getPayoutRemaining, isFinance, reviewPayment, sendPayout, submitPayment,
} from "../services/financeService";
import { isGeminiEnabled, verifySlip } from "../services/geminiService";
import { resizeImageToDataURL } from "../utils/image";
import { getBills } from "../services/billService";
import { useAuth } from "../AuthContext";
import { useImageViewer } from "../ImageViewerContext";

const money = (n) =>
  Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

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
  const [payoutModal, setPayoutModal] = useState(null);
  const [savingPayout, setSavingPayout] = useState(false);
  const fileSubmittingRef = useRef(false);

  const finance = isFinance(group, user?.userId);
  const wallet = group?.wallet || {};

  const reload = async () => {
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
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [gid]);

  useEffect(() => {
    if (!payoutModal) return;
    const onKey = (event) => {
      if (event.key === "Escape" && !savingPayout) setPayoutModal(null);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [payoutModal, savingPayout]);

  const netting = useMemo(
    () => computeNetting(bills, group?.members || []),
    [bills, group]
  );

  const memberRows = useMemo(
    () => netting.map((row) => ({ ...row, status: deriveStatus(row, payments, payouts) })),
    [netting, payments, payouts]
  );

  const me = memberRows.find((r) => r.userId === user?.userId);
  const myPendingPayment = payments.find(
    (p) => p.userId === user?.userId && p.status === "pending"
  );
  const myAwaitingPayout = payouts.find(
    (p) => p.toUserId === user?.userId && p.status === "sent"
  );

  // ====== Member: แนบสลิปจ่ายเงิน (ใช้ยอดคงเหลือ) ======
  const handlePayIn = async () => {
    if (!me || me.net >= 0 || fileSubmittingRef.current) return;
    const outstanding = getOutstanding(me, payments);
    if (outstanding <= 0) return;
    fileSubmittingRef.current = true;
    try {
      const slip = await pickAndCompressSlip();
      if (!slip) return;
      await submitPayment(gid, {
        userId: user.userId,
        userName: user.name,
        amount: outstanding,
        slipDataUrl: slip,
      });
      toast("success", "ส่งสลิปแล้ว รอตรวจสอบ");
      reload();
    } finally {
      fileSubmittingRef.current = false;
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
      html: `<small class="text-muted">ยอดที่สมาชิกอ้าง: <strong>${money(payment.amount)}</strong></small>`,
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
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalPaidOut = payouts.filter((p) => p.status === "confirmed")
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendingQueue = payments.filter((p) => p.status === "pending");

  return (
    <div className="finance-stack">
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
              <div>
                <small>
                  {me.net >= 0 ? "รอรับคืน (คงเหลือ)" : "ค้างจ่าย (คงเหลือ)"}
                </small>
                <strong className={me.net >= 0 ? "text-success" : "text-danger"}>
                  {money(me.net >= 0 ? payoutRem : outstanding)}
                </strong>
              </div>
            </div>

            {me.net < 0 && outstanding > 0 && !myPendingPayment && (
              <button className="btn btn-success w-100 mt-3" onClick={handlePayIn}>
                ชำระเงิน + แนบสลิป ({money(outstanding)})
              </button>
            )}
            {myPendingPayment && (
              <p className="text-muted mt-3 mb-0 small">
                ส่งสลิปแล้ว ({money(myPendingPayment.amount)}) — รอฝ่ายการเงินตรวจ
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
              // บิลที่คนนี้เป็น payer → "ค่าอะไรบ้างที่ค้างคืน"
              const billsAsPayer = bills.filter((b) => b.payerId === r.userId);
              return (
                <div key={r.userId} className={`pay-row status-${r.status.tone}`}>
                  <div className="pay-row-head">
                    <div className="pay-row-name">
                      <img src={r.picture || "https://via.placeholder.com/30"} alt={r.name} className="avatar" />
                      <div className="min-w-0">
                        <strong>{r.name}</strong>
                        <small>จ่าย {money(r.paid)} · หาร {money(r.share)}</small>
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
                      <span className="text-danger fw-bold">
                        - {money(outstanding)} {outstanding < Math.abs(r.net) ? `/ ${money(Math.abs(r.net))}` : ""} (ต้องจ่าย)
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
              {pendingQueue.map((p) => (
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
                        <small className="d-block text-muted">ยอดที่อ้าง {money(p.amount)}</small>
                      </div>
                      <StatusPill status={STATUS.PENDING_VERIFICATION} />
                    </div>

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
              ))}
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
              return (
                <div key={`pay-${p.id}`} className="history-row">
                  <span className="history-label">เข้า</span>
                  <span className="history-name">
                    {p.userName}
                    {showActual && (
                      <small className="d-block text-muted">
                        อ้าง {money(claimed)} · จริง {money(actual)}
                      </small>
                    )}
                  </span>
                  <span className="history-amount text-success">+ {money(p.actualAmount ?? p.amount)}</span>
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
