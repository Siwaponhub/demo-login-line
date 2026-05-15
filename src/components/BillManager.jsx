import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import Swal from "sweetalert2";
import { db } from "../firebase";
import { createBill, deleteBill, getBills, updateBill } from "../services/billService";
import { isFinance } from "../services/financeService";
import { resizeImageToDataURL } from "../utils/image";
import { useAuth } from "../AuthContext";
import { useImageViewer } from "../ImageViewerContext";
import BackHomeButtons from "./BackHomeButtons";

const emptyBill = {
  title: "",
  amount: "",
  payerId: "",
  slipDataUrl: "",
  participants: [],
};

const money = (amount) =>
  Number(amount || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

// Status helper for participant payment state
function paymentStatus(share, paid) {
  const s = Number(share || 0);
  const p = Number(paid || 0);
  if (p <= 0) return { id: "unpaid", label: "ยังไม่จ่าย", remaining: s };
  if (Math.abs(p - s) < 0.01) return { id: "paid", label: "จ่ายครบ", remaining: 0 };
  if (p < s) return { id: "partial", label: `ค้าง ${money(s - p)}`, remaining: s - p };
  return { id: "over", label: `เกิน ${money(p - s)}`, remaining: s - p };
}

function paidValueFor(bill, participant, drafts = {}) {
  if (participant.userId === bill.payerId) {
    return Number(participant.share || 0);
  }
  if (Object.prototype.hasOwnProperty.call(drafts, participant.userId)) {
    return Number(drafts[participant.userId]) || 0;
  }
  return Number(participant.paid) || 0;
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function makePaymentLogId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatLogTime(value) {
  if (!value) return "";
  const date = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function paymentLogText(log) {
  if (log.type === "bill_created") {
    return `${log.fromName} ออกเงินค่า ${log.billTitle} ให้กลุ่ม`;
  }
  if (log.type === "payment_adjustment") {
    return `${log.createdByName || "ผู้ดูแล"} ปรับยอดของ ${log.fromName} ใน ${log.billTitle}`;
  }
  if (log.type === "slip_added") {
    return `${log.fromName} แนบสลิปค่า ${log.billTitle}`;
  }
  if (log.type === "slip_updated") {
    return `${log.fromName} เปลี่ยนสลิปค่า ${log.billTitle}`;
  }
  if (log.type === "slip_removed") {
    return `${log.fromName} ลบสลิปค่า ${log.billTitle}`;
  }
  return `${log.fromName} จ่ายค่า ${log.billTitle} ให้ ${log.toName}`;
}

function createBillOpenLog(payload, actor) {
  return {
    id: makePaymentLogId(),
    type: "bill_created",
    amount: roundMoney(payload.amount),
    billTitle: payload.title,
    fromUserId: payload.payerId,
    fromName: payload.payerName || "ผู้จ่าย",
    toUserId: "group",
    toName: "กลุ่ม",
    createdAt: new Date().toISOString(),
    createdBy: actor.userId,
    createdByName: actor.name,
  };
}

async function pickAndCompressSlip() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        const url = await resizeImageToDataURL(file, { maxSize: 900, quality: 0.76 });
        resolve(url);
      } catch (err) {
        console.error(err);
        resolve(null);
      }
    };
    input.click();
  });
}

function BillManager() {
  const { id } = useParams();
  const { user } = useAuth();
  const { openImage } = useImageViewer();
  const [groups, setGroups] = useState([]);
  const [group, setGroup] = useState(null);
  const [bills, setBills] = useState([]);
  const [form, setForm] = useState(emptyBill);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeBillId, setActiveBillId] = useState(null);
  const [paidDrafts, setPaidDrafts] = useState({}); // billId -> { userId: paidValue }
  const [slipDrafts, setSlipDrafts] = useState({}); // billId -> { userId: slipDataUrl }
  const [savingPayments, setSavingPayments] = useState(false);

  const isGroupRoute = Boolean(id);
  const members = useMemo(() => group?.members || [], [group]);

  const totalTripAmount = useMemo(
    () => bills.reduce((sum, bill) => sum + Number(bill.amount || 0), 0),
    [bills]
  );

  useEffect(() => {
    if (bills.length === 0) {
      setActiveBillId(null);
      return;
    }
    if (!bills.some((bill) => bill.id === activeBillId)) {
      setActiveBillId(bills[0].id);
    }
  }, [activeBillId, bills]);

  const activeBill = useMemo(
    () => bills.find((bill) => bill.id === activeBillId) || bills[0],
    [activeBillId, bills]
  );

  const fetchGroups = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, "groups"));
      const allGroups = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setGroups(
        allGroups.filter(
          (g) =>
            g.ownerId === user.userId ||
            g.members?.some((member) => member.userId === user.userId)
        )
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchGroupBills = useCallback(async (groupId) => {
    try {
      setLoading(true);
      const groupSnap = await getDoc(doc(db, "groups", groupId));
      if (!groupSnap.exists()) {
        setGroup(null);
        setBills([]);
        return;
      }
      const groupData = { id: groupSnap.id, ...groupSnap.data() };
      const nextBills = await getBills(groupId);
      setGroup(groupData);
      setBills(nextBills);
      setForm((current) => ({
        ...current,
        payerId: current.payerId || user?.userId || groupData.members?.[0]?.userId || "",
      }));
      setActiveBillId((current) => current || nextBills[0]?.id || null);
    } catch (err) {
      console.error(err);
      Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถโหลดบิลได้", "error");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isGroupRoute) {
      fetchGroupBills(id);
    } else {
      fetchGroups();
    }
  }, [fetchGroupBills, fetchGroups, id, isGroupRoute]);

  const selectedTotal = useMemo(
    () => form.participants.reduce((sum, participant) => sum + Number(participant.share || 0), 0),
    [form.participants]
  );

  // Net summary: sum (share - paid) per debtor->payer pair
  const summaryByPerson = useMemo(() => {
    const map = new Map();
    bills.forEach((bill) => {
      const payer = members.find((m) => m.userId === bill.payerId);
      const payerName = payer?.name || bill.payerName || "ผู้จ่าย";
      bill.participants?.forEach((p) => {
        if (p.userId === bill.payerId) return;
        const remaining = Number(p.share || 0) - Number(p.paid || 0);
        if (Math.abs(remaining) < 0.01) return;
        const key = `${p.name}->${payerName}`;
        const current = map.get(key) || {
          debtorName: p.name,
          payerName,
          amount: 0,
        };
        current.amount += remaining;
        map.set(key, current);
      });
    });
    return Array.from(map.values()).filter((row) => Math.abs(row.amount) >= 0.01);
  }, [bills, members]);

  const totalRemaining = useMemo(
    () => summaryByPerson.reduce((sum, row) => sum + Math.max(0, row.amount), 0),
    [summaryByPerson]
  );

  const allPaymentLogs = useMemo(
    () =>
      bills
        .flatMap((bill) =>
          (bill.paymentLogs || []).map((log) => ({
            ...log,
            billId: bill.id,
            billTitle: log.billTitle || bill.title,
          }))
        )
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    [bills]
  );

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm({
      ...emptyBill,
      payerId: user?.userId || members[0]?.userId || "",
    });
    setEditingId(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    setForm({
      ...emptyBill,
      payerId: user?.userId || members[0]?.userId || "",
    });
    setEditingId(null);
    setShowForm(true);
  };

  const toggleParticipant = (member) => {
    setForm((current) => {
      const exists = current.participants.some((p) => p.userId === member.userId);
      return {
        ...current,
        participants: exists
          ? current.participants.filter((p) => p.userId !== member.userId)
          : [
              ...current.participants,
              {
                userId: member.userId,
                name: member.name,
                email: member.email || "",
                picture: member.picture || "",
                share: 0,
                paid: 0,
              },
            ],
      };
    });
  };

  const selectAllMembers = () => {
    setForm((current) => ({
      ...current,
      participants: members.map((m) => {
        const existing = current.participants.find((p) => p.userId === m.userId);
        return {
          userId: m.userId,
          name: m.name,
          email: m.email || "",
          picture: m.picture || "",
          share: existing?.share || 0,
          paid: existing?.paid || 0,
          slipDataUrl: existing?.slipDataUrl || "",
        };
      }),
    }));
  };

  const clearParticipants = () => {
    setForm((current) => ({ ...current, participants: [] }));
  };

  const updateShare = (userId, value) => {
    setForm((current) => ({
      ...current,
      participants: current.participants.map((p) =>
        p.userId === userId ? { ...p, share: Number(value) || 0 } : p
      ),
    }));
  };

  const splitEqually = () => {
    const amount = Number(form.amount || 0);
    if (amount <= 0 || form.participants.length === 0) {
      Swal.fire("ยังหารไม่ได้", "กรอกยอดรวมและเลือกสมาชิกก่อน", "info");
      return;
    }
    const perPerson = Number((amount / form.participants.length).toFixed(2));
    const roundedTotal = perPerson * form.participants.length;
    const diff = Number((amount - roundedTotal).toFixed(2));
    setForm((current) => ({
      ...current,
      participants: current.participants.map((p, i) => ({
        ...p,
        share: Number((perPerson + (i === 0 ? diff : 0)).toFixed(2)),
      })),
    }));
  };

  const attachBillSlip = async () => {
    const slipDataUrl = await pickAndCompressSlip();
    if (!slipDataUrl) return;
    updateForm("slipDataUrl", slipDataUrl);
  };

  const removeBillSlip = () => {
    updateForm("slipDataUrl", "");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const amount = Number(form.amount || 0);
    if (!form.title.trim() || amount <= 0 || !form.payerId || form.participants.length === 0) {
      Swal.fire("ข้อมูลไม่ครบ", "กรอกชื่อบิล ยอดรวม ผู้จ่าย และสมาชิกที่ร่วมบิล", "info");
      return;
    }

    const shareTotal = Number(selectedTotal.toFixed(2));
    if (shareTotal !== Number(amount.toFixed(2))) {
      const result = await Swal.fire({
        icon: "warning",
        title: "ยอดรวมรายคนไม่ตรงกับยอดบิล",
        text: `ยอดรายคนรวม ${money(shareTotal)} แต่ยอดบิลคือ ${money(amount)}`,
        showCancelButton: true,
        confirmButtonText: "บันทึกต่อ",
        cancelButtonText: "กลับไปแก้",
      });
      if (!result.isConfirmed) return;
    }

    const payer = members.find((m) => m.userId === form.payerId);
    const participantsWithPaid = form.participants.map((p) => ({
      ...p,
      paid: p.userId === form.payerId ? Number(p.share || 0) : Number(p.paid) || 0,
    }));

    const payload = {
      title: form.title.trim(),
      amount,
      payerId: form.payerId,
      payerName: payer?.name || "",
      slipDataUrl: form.slipDataUrl || "",
      participants: participantsWithPaid,
      updatedBy: user.userId,
    };

    try {
      if (editingId) {
        await updateBill(id, editingId, payload);
        Swal.fire({
          toast: true, position: "top", icon: "success",
          title: "แก้ไขบิลแล้ว", showConfirmButton: false, timer: 1400,
        });
      } else {
        await createBill(id, {
          ...payload,
          createdBy: user.userId,
          paymentLogs: [createBillOpenLog(payload, user)],
        });
        Swal.fire({
          toast: true, position: "top", icon: "success",
          title: "สร้างบิลแล้ว", showConfirmButton: false, timer: 1400,
        });
      }
      resetForm();
      const nextBills = await getBills(id);
      setBills(nextBills);
      setActiveBillId(editingId || nextBills[0]?.id || null);
    } catch (err) {
      console.error(err);
      Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถบันทึกบิลได้", "error");
    }
  };

  const handleEdit = (bill) => {
    setEditingId(bill.id);
    setActiveBillId(bill.id);
    setForm({
      title: bill.title || "",
      amount: bill.amount || "",
      payerId: bill.payerId || user?.userId || "",
      slipDataUrl: bill.slipDataUrl || "",
      participants: (bill.participants || []).map((p) => ({
        ...p,
        paid: Number(p.paid) || 0,
      })),
    });
    setShowForm(true);
  };

  const handleDelete = async (billId) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "ลบบิลนี้?",
      text: "ข้อมูลยอดค่าใช้จ่ายของบิลนี้จะถูกลบ",
      showCancelButton: true,
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#dc3545",
    });
    if (!result.isConfirmed) return;
    await deleteBill(id, billId);
    const nextBills = bills.filter((bill) => bill.id !== billId);
    setBills(nextBills);
    if (activeBillId === billId) setActiveBillId(nextBills[0]?.id || null);
    Swal.fire({
      toast: true, position: "top", icon: "success",
      title: "ลบบิลแล้ว", showConfirmButton: false, timer: 1400,
    });
  };

  // === Payment editing ===

  const draftFor = (bill, userId) => {
    const p = bill.participants?.find((x) => x.userId === userId);
    if (userId === bill.payerId) {
      return Number(p?.share || 0);
    }
    const drafts = paidDrafts[bill.id];
    if (drafts && Object.prototype.hasOwnProperty.call(drafts, userId)) {
      return drafts[userId];
    }
    return Number(p?.paid || 0);
  };

  const setDraft = (billId, userId, value) => {
    setPaidDrafts((prev) => ({
      ...prev,
      [billId]: { ...(prev[billId] || {}), [userId]: value },
    }));
  };

  const slipFor = (bill, userId) => {
    const drafts = slipDrafts[bill.id];
    if (drafts && Object.prototype.hasOwnProperty.call(drafts, userId)) {
      return drafts[userId] || "";
    }
    const p = bill.participants?.find((x) => x.userId === userId);
    return p?.slipDataUrl || "";
  };

  const setSlipDraft = (billId, userId, slipDataUrl) => {
    setSlipDrafts((prev) => ({
      ...prev,
      [billId]: { ...(prev[billId] || {}), [userId]: slipDataUrl },
    }));
  };

  const attachSlip = async (bill, p) => {
    const slipDataUrl = await pickAndCompressSlip();
    if (!slipDataUrl) return;
    setSlipDraft(bill.id, p.userId, slipDataUrl);
  };

  const removeSlip = (bill, p) => {
    setSlipDraft(bill.id, p.userId, "");
  };

  const markPaidFull = (bill, p) => {
    setDraft(bill.id, p.userId, Number(p.share || 0));
  };

  const markPaidZero = (bill, p) => {
    setDraft(bill.id, p.userId, 0);
  };

  const hasUnsavedPayments = (bill) => {
    const drafts = paidDrafts[bill.id];
    const slipDraft = slipDrafts[bill.id];
    const hasPaidChange = drafts && Object.entries(drafts).some(([uid, v]) => {
      const p = bill.participants?.find((x) => x.userId === uid);
      return Number(p?.paid || 0) !== Number(v || 0);
    });
    const hasSlipChange = slipDraft && Object.entries(slipDraft).some(([uid, v]) => {
      const p = bill.participants?.find((x) => x.userId === uid);
      return (p?.slipDataUrl || "") !== (v || "");
    });
    return Boolean(hasPaidChange || hasSlipChange);
  };

  const savePayments = async (bill) => {
    const drafts = paidDrafts[bill.id] || {};
    const slipDraft = slipDrafts[bill.id] || {};
    const updatedParticipants = (bill.participants || []).map((p) => ({
      ...p,
      paid: paidValueFor(bill, p, drafts),
      slipDataUrl: Object.prototype.hasOwnProperty.call(slipDraft, p.userId)
        ? slipDraft[p.userId] || ""
        : p.slipDataUrl || "",
    }));
    const payer = members.find((m) => m.userId === bill.payerId);
    const payerName = payer?.name || bill.payerName || "ผู้จ่าย";
    const nowIso = new Date().toISOString();
    const newLogs = updatedParticipants.flatMap((nextP) => {
      if (nextP.userId === bill.payerId) return [];
      const prevP = bill.participants?.find((p) => p.userId === nextP.userId) || {};
      const prevPaid = roundMoney(prevP.paid);
      const nextPaid = roundMoney(nextP.paid);
      const delta = roundMoney(nextPaid - prevPaid);
      const prevSlip = prevP.slipDataUrl || "";
      const nextSlip = nextP.slipDataUrl || "";
      const base = {
        billTitle: bill.title,
        fromUserId: nextP.userId,
        fromName: nextP.name,
        toUserId: bill.payerId,
        toName: payerName,
        share: roundMoney(nextP.share),
        paid: nextPaid,
        createdAt: nowIso,
        createdBy: user.userId,
        createdByName: user.name,
      };
      const logs = [];

      if (Math.abs(delta) >= 0.01) {
        logs.push({
          ...base,
          id: makePaymentLogId(),
          type: delta > 0 ? "payment" : "payment_adjustment",
          amount: Math.abs(delta),
          previousPaid: prevPaid,
        });
      }

      if (prevSlip !== nextSlip) {
        logs.push({
          ...base,
          id: makePaymentLogId(),
          type: !nextSlip ? "slip_removed" : prevSlip ? "slip_updated" : "slip_added",
          amount: nextPaid,
        });
      }

      return logs;
    });
    const nextPaymentLogs = [...(bill.paymentLogs || []), ...newLogs];
    try {
      setSavingPayments(true);
      await updateBill(id, bill.id, {
        ...bill,
        participants: updatedParticipants,
        paymentLogs: nextPaymentLogs,
        updatedBy: user.userId,
      });
      setBills((prev) =>
        prev.map((b) =>
          b.id === bill.id
            ? { ...b, participants: updatedParticipants, paymentLogs: nextPaymentLogs }
            : b
        )
      );
      setPaidDrafts((prev) => {
        const next = { ...prev };
        delete next[bill.id];
        return next;
      });
      setSlipDrafts((prev) => {
        const next = { ...prev };
        delete next[bill.id];
        return next;
      });
      Swal.fire({
        toast: true, position: "top", icon: "success",
        title: "บันทึกการชำระแล้ว", showConfirmButton: false, timer: 1400,
      });
    } catch (err) {
      console.error(err);
      Swal.fire("เกิดข้อผิดพลาด", "บันทึกการชำระไม่สำเร็จ", "error");
    } finally {
      setSavingPayments(false);
    }
  };

  const discardPayments = (billId) => {
    setPaidDrafts((prev) => {
      const next = { ...prev };
      delete next[billId];
      return next;
    });
    setSlipDrafts((prev) => {
      const next = { ...prev };
      delete next[billId];
      return next;
    });
  };

  // === Render group picker (no group route) ===

  if (!isGroupRoute) {
    return (
      <>
        <section className="page-header">
          <div>
            <h1 className="page-title">ค่าใช้จ่ายทริป</h1>
            <p className="page-subtitle">เลือกกลุ่มเพื่อสร้างบิลและดูสรุปยอดที่ต้องจ่ายคืน</p>
          </div>
        </section>

        {loading ? (
          <div className="soft-card empty-state">กำลังโหลดข้อมูลกลุ่ม...</div>
        ) : groups.length === 0 ? (
          <div className="soft-card empty-state">ยังไม่มีกลุ่มที่เข้าร่วม</div>
        ) : (
          <div className="section-grid">
            {groups.map((g) => (
              <Link key={g.id} to={`/group/${g.id}?tab=bills`} className="menu-card">
                <span className="tile-icon alt">฿</span>
                <span>
                  <h2>{g.name}</h2>
                  <p>จัดการบิลและสรุปยอด</p>
                </span>
              </Link>
            ))}
          </div>
        )}
        <BackHomeButtons />
      </>
    );
  }

  if (loading) return <div className="soft-card empty-state">กำลังโหลดค่าใช้จ่าย...</div>;
  if (!group) return <div className="soft-card empty-state">ไม่พบกลุ่มนี้</div>;

  // เฉพาะเจ้าของกลุ่ม + ฝ่ายการเงิน → จัดการบิล/payment ได้
  const canManage = isFinance(group, user?.userId);

  // active bill payment summary
  const activeBillSummary = (() => {
    if (!activeBill) return null;
    const drafts = paidDrafts[activeBill.id] || {};
    const totalShare = (activeBill.participants || []).reduce(
      (sum, p) => sum + Number(p.share || 0),
      0
    );
    const totalPaid = (activeBill.participants || []).reduce((sum, p) => {
      return sum + paidValueFor(activeBill, p, drafts);
    }, 0);
    return { totalShare, totalPaid, remaining: totalShare - totalPaid };
  })();

  return (
    <>
      <section className="page-header page-header-tight">
        <div>
          <h1 className="page-title">ค่าใช้จ่าย</h1>
          <p className="page-subtitle">
            {group.name}
            {!canManage && (
              <span className="badge text-bg-light ms-2">โหมดดูอย่างเดียว</span>
            )}
          </p>
        </div>
        {canManage && (
          <button className="btn btn-success px-4" onClick={openCreateForm}>
            + เพิ่มบิล
          </button>
        )}
      </section>

      {/* Compact stat strip — ทุกอย่างในแถวเดียว ไม่มีหน่วย */}
      <section className="stat-strip">
        <div className="stat-strip-item">
          <span className="stat-strip-label">ยอดรวม</span>
          <strong className="stat-strip-value">{money(totalTripAmount)}</strong>
        </div>
        <span className="stat-strip-divider" aria-hidden="true" />
        <div className="stat-strip-item">
          <span className="stat-strip-label">บิล</span>
          <strong className="stat-strip-value">{bills.length}</strong>
        </div>
        <span className="stat-strip-divider" aria-hidden="true" />
        <div className="stat-strip-item">
          <span className="stat-strip-label">รอจ่าย</span>
          <strong className={`stat-strip-value ${totalRemaining > 0 ? "is-warn" : "is-good"}`}>
            {money(totalRemaining)}
          </strong>
        </div>
      </section>

      {showForm && canManage && (
        <form className="soft-card p-3 p-md-4 mt-3" onSubmit={handleSubmit}>
          <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
            <div className="min-w-0">
              <h2 className="h5 fw-bold mb-1">{editingId ? "แก้ไขบิล" : "เพิ่มบิล"}</h2>
              <p className="text-muted mb-0 small">เลือกคนออกเงินและสมาชิกที่ร่วมบิลนี้</p>
            </div>
            <button className="btn btn-light border btn-sm" type="button" onClick={resetForm}>
              ปิด
            </button>
          </div>

          <label className="form-label fw-bold">ชื่อบิล</label>
          <input
            className="form-control"
            value={form.title}
            onChange={(e) => updateForm("title", e.target.value)}
            placeholder="เช่น ค่าที่พัก คืนแรก"
          />

          <div className="row g-2 g-md-3 mt-1">
            <div className="col-12 col-sm-6">
              <label className="form-label fw-bold">ยอดรวม</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-control"
                value={form.amount}
                onChange={(e) => updateForm("amount", e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="col-12 col-sm-6">
              <label className="form-label fw-bold">คนออกเงิน</label>
              <select
                className="form-control"
                value={form.payerId}
                onChange={(e) => updateForm("payerId", e.target.value)}
              >
                <option value="">เลือกผู้จ่าย</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bill-slip-field mt-3">
            <div className="bill-slip-text">
              <strong>สลิป/ใบเสร็จของบิล</strong>
              <small>แนบหลักฐานตอนเปิดบิลได้</small>
            </div>
            {form.slipDataUrl ? (
              <button
                type="button"
                className="bill-slip-preview"
                onClick={() => openImage(form.slipDataUrl, `${form.title || "bill"}-slip.jpg`)}
                title="ดูสลิปบิล"
              >
                <img src={form.slipDataUrl} alt="สลิปบิล" />
                <span>ดูสลิป</span>
              </button>
            ) : (
              <span className="bill-slip-empty">ยังไม่มีสลิป</span>
            )}
            <div className="bill-slip-actions">
              <button type="button" className="btn btn-sm btn-light border" onClick={attachBillSlip}>
                {form.slipDataUrl ? "เปลี่ยนสลิป" : "แนบสลิป"}
              </button>
              {form.slipDataUrl && (
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={removeBillSlip}>
                  ลบสลิป
                </button>
              )}
            </div>
          </div>

          <div className="d-flex justify-content-between align-items-center gap-2 mt-3">
            <h3 className="h6 fw-bold mb-0">สมาชิกที่ร่วมบิล</h3>
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-sm btn-outline-success" onClick={selectAllMembers}>
                ทุกคน
              </button>
              <button type="button" className="btn btn-sm btn-light border" onClick={clearParticipants}>
                ล้าง
              </button>
            </div>
          </div>

          <div className="member-pick-list mt-2">
            {members.map((member) => {
              const checked = form.participants.some((p) => p.userId === member.userId);
              return (
                <label
                  key={member.userId}
                  className={`member-pick ${checked ? "is-on" : ""}`}
                >
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={checked}
                    onChange={() => toggleParticipant(member)}
                  />
                  <img
                    src={member.picture || "https://via.placeholder.com/40"}
                    alt={member.name}
                    className="avatar"
                  />
                  <span className="member-pick-name">{member.name}</span>
                </label>
              );
            })}
          </div>

          {form.participants.length > 0 && (
            <div className="mt-3">
              <div className="d-flex justify-content-between align-items-center gap-2">
                <h3 className="h6 fw-bold mb-0">ยอดรายคน</h3>
                <button type="button" className="btn btn-sm btn-outline-success" onClick={splitEqually}>
                  หารเท่ากัน
                </button>
              </div>

              <div className="share-list mt-2">
                {form.participants.map((p) => (
                  <div key={p.userId} className="share-row">
                    <div className="share-row-name">
                      <img
                        src={p.picture || "https://via.placeholder.com/30"}
                        alt={p.name}
                        className="avatar"
                      />
                      <span>{p.name}</span>
                    </div>
                    <div className="share-row-input">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-control"
                        value={p.share}
                        onChange={(e) => updateShare(p.userId, e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-muted mt-2 mb-0 small">
                รวม {money(selectedTotal)} / ยอดบิล {money(form.amount || 0)}
              </p>
            </div>
          )}

          <div className="d-flex gap-2 mt-3">
            <button className="btn btn-success flex-fill" type="submit">
              {editingId ? "บันทึกการแก้ไข" : "สร้างบิล"}
            </button>
            {editingId && (
              <button className="btn btn-light border" type="button" onClick={resetForm}>
                ยกเลิก
              </button>
            )}
          </div>
        </form>
      )}

      <section className="expense-layout mt-3">
        <div className="soft-card p-3 p-md-4">
          <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
            <h2 className="h5 fw-bold mb-0">รายการบิล</h2>
            <span className="badge text-bg-light">{bills.length}</span>
          </div>

          {bills.length === 0 ? (
            <div className="empty-state">
              <h3 className="h6 fw-bold">ยังไม่มีบิล</h3>
              <p className="mb-0">กดเพิ่มบิลเพื่อเริ่มบันทึกค่าใช้จ่าย</p>
            </div>
          ) : (
            <>
              <div className="bill-switcher" aria-label="เลือกบิล">
                {bills.map((bill) => {
                  const totalShare = (bill.participants || []).reduce(
                    (s, p) => s + Number(p.share || 0), 0
                  );
                  const totalPaid = (bill.participants || []).reduce(
                    (s, p) => s + paidValueFor(bill, p), 0
                  );
                  const isSettled = totalShare > 0 && Math.abs(totalShare - totalPaid) < 0.01;
                  return (
                    <button
                      key={bill.id}
                      type="button"
                      className={`bill-tab ${activeBill?.id === bill.id ? "active" : ""}`}
                      onClick={() => setActiveBillId(bill.id)}
                    >
                      <span>{bill.title}</span>
                      <small className="d-flex align-items-center gap-1">
                        {money(bill.amount)}
                        {isSettled && <span className="bill-tab-tick" aria-label="จ่ายครบ">✓</span>}
                      </small>
                    </button>
                  );
                })}
              </div>

              {activeBill && (
                <article className="bill-card">
                  <div className="bill-card-header">
                    <div className="min-w-0">
                      <h3>{activeBill.title}</h3>
                      <p>ออกโดย {activeBill.payerName || "ผู้จ่าย"}</p>
                    </div>
                    <div className="bill-card-meta">
                      <strong>{money(activeBill.amount)}</strong>
                      {activeBill.slipDataUrl && (
                        <button
                          type="button"
                          className="bill-slip-link"
                          onClick={() => openImage(activeBill.slipDataUrl, `bill-${activeBill.id}-slip.jpg`)}
                        >
                          ดูสลิปบิล
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="bill-participants">
                    <div className="bill-section-title">
                      <span>ติดตามการชำระ</span>
                      <small>{activeBill.participants?.length || 0} คน</small>
                    </div>

                    {[...(activeBill.participants || [])]
                      .sort((a, b) => {
                        // ชื่อตัวเองขึ้นก่อน, แล้วผู้จ่ายเงิน, ที่เหลือคงลำดับเดิม
                        if (a.userId === user?.userId) return -1;
                        if (b.userId === user?.userId) return 1;
                        if (a.userId === activeBill.payerId) return -1;
                        if (b.userId === activeBill.payerId) return 1;
                        return 0;
                      })
                      .map((p) => {
                      const draftPaid = draftFor(activeBill, p.userId);
                      const status = paymentStatus(p.share, draftPaid);
                      const isPayer = p.userId === activeBill.payerId;
                      const slipDataUrl = slipFor(activeBill, p.userId);
                      return (
                        <div
                          key={p.userId}
                          className={`pay-row status-${status.id} ${isPayer ? "is-payer" : ""}`}
                        >
                          <div className="pay-row-head">
                            <div className="pay-row-name">
                              <img
                                src={p.picture || "https://via.placeholder.com/30"}
                                alt={p.name}
                                className="avatar"
                              />
                              <div className="min-w-0">
                                <strong>{p.name}</strong>
                                <small>ส่วนแบ่ง {money(p.share)}</small>
                              </div>
                            </div>
                            <span className={`pay-status pay-status-${status.id}`}>
                              {isPayer ? "ผู้ออกเงิน" : status.label}
                            </span>
                          </div>

                          {!isPayer && (canManage || slipDataUrl) && (
                            <div className="pay-row-controls">
                              {canManage && (
                                <div className="pay-row-input">
                                  <div className="pay-input-group">
                                    <span className="pay-input-prefix">จ่ายแล้ว</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      className="form-control"
                                      value={draftPaid}
                                      onChange={(e) =>
                                        setDraft(activeBill.id, p.userId, e.target.value)
                                      }
                                    />
                                  </div>
                                  <div className="pay-quick">
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-success"
                                      onClick={() => markPaidFull(activeBill, p)}
                                      title="ตั้งเป็นจ่ายครบ"
                                    >
                                      ครบ
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-light border"
                                      onClick={() => markPaidZero(activeBill, p)}
                                      title="ล้างยอดที่จ่าย"
                                    >
                                      0
                                    </button>
                                  </div>
                                </div>
                              )}

                              <div className="pay-slip-row">
                                {slipDataUrl ? (
                                  <button
                                    type="button"
                                    className="pay-slip-preview"
                                    onClick={() => openImage(slipDataUrl, `bill-${activeBill.id}-${p.userId}.jpg`)}
                                    title="ดูสลิป"
                                  >
                                    <img src={slipDataUrl} alt="สลิปการชำระ" />
                                    <span>ดูสลิป</span>
                                  </button>
                                ) : (
                                  <span className="pay-slip-empty">ยังไม่มีสลิป</span>
                                )}

                                {canManage && (
                                  <div className="pay-slip-actions">
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-light border"
                                      onClick={() => attachSlip(activeBill, p)}
                                    >
                                      {slipDataUrl ? "เปลี่ยนสลิป" : "แนบสลิป"}
                                    </button>
                                    {slipDataUrl && (
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={() => removeSlip(activeBill, p)}
                                      >
                                        ลบสลิป
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Payment summary + save bar */}
                  {activeBillSummary && (
                    <div className="pay-summary">
                      <div className="pay-summary-stats">
                        <span>ยอด {money(activeBillSummary.totalShare)}</span>
                        <span>·</span>
                        <span>จ่ายแล้ว {money(activeBillSummary.totalPaid)}</span>
                        <span>·</span>
                        <span className={activeBillSummary.remaining > 0 ? "is-warn" : "is-good"}>
                          {activeBillSummary.remaining > 0
                            ? `เหลือ ${money(activeBillSummary.remaining)}`
                            : activeBillSummary.remaining < 0
                              ? `เกิน ${money(-activeBillSummary.remaining)}`
                              : "สมดุล"}
                        </span>
                      </div>
                      {canManage && hasUnsavedPayments(activeBill) && (
                        <div className="pay-actions">
                          <button
                            type="button"
                            className="btn btn-sm btn-light border"
                            onClick={() => discardPayments(activeBill.id)}
                            disabled={savingPayments}
                          >
                            ยกเลิก
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-success"
                            onClick={() => savePayments(activeBill)}
                            disabled={savingPayments}
                          >
                            {savingPayments ? "กำลังบันทึก..." : "บันทึกการชำระ"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {canManage && (
                    <div className="d-flex gap-2 mt-3">
                      <button className="btn btn-sm btn-outline-primary" onClick={() => handleEdit(activeBill)}>
                        แก้ไข
                      </button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(activeBill.id)}>
                        ลบ
                      </button>
                    </div>
                  )}
                </article>
              )}
            </>
          )}
        </div>

        <aside className="soft-card p-3 p-md-4">
          <h2 className="h5 fw-bold">สรุปยอดต้องชำระ</h2>
          {summaryByPerson.length === 0 ? (
            <p className="text-muted mb-0 small">ทุกบิลชำระสมดุลแล้ว</p>
          ) : (
            <div className="debt-list">
              {summaryByPerson.map((row) => {
                const isOver = row.amount < 0;
                return (
                  <div key={`${row.debtorName}-${row.payerName}`} className="debt-row">
                    <div className="debt-row-text">
                      <strong>{row.debtorName}</strong>
                      <small>
                        {isOver ? "จ่ายเกินให้" : "ค้างจ่ายให้"} {row.payerName}
                      </small>
                    </div>
                    <strong className={`debt-amount ${isOver ? "is-over" : "is-due"}`}>
                      {money(Math.abs(row.amount))}
                    </strong>
                  </div>
                );
              })}
            </div>
          )}

          <div className="bill-log-panel">
            <h2 className="h5 fw-bold">ประวัติการชำระทั้งหมด</h2>
            {allPaymentLogs.length === 0 ? (
              <p className="text-muted mb-0 small">ยังไม่มี logs การชำระ</p>
            ) : (
              <div className="bill-log-list">
                {allPaymentLogs.map((log) => (
                  <article key={`${log.billId}-${log.id}`} className={`bill-log-row type-${log.type}`}>
                    <div className="bill-log-main">
                      <strong>{paymentLogText(log)}</strong>
                      <small>
                        {formatLogTime(log.createdAt)}
                        {log.createdByName && ` · บันทึกโดย ${log.createdByName}`}
                      </small>
                    </div>
                    {Number(log.amount) > 0 && (
                      <span className="bill-log-amount">{money(log.amount)}</span>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </aside>
      </section>

      <BackHomeButtons />
    </>
  );
}

export default BillManager;
