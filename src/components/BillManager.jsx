import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, deleteField, doc, getDoc, getDocs } from "firebase/firestore";
import Swal from "sweetalert2";
import { db } from "../firebase";
import { createBill, deleteBill, getBills, updateBill } from "../services/billService";
import { getPaymentAllocations, getPayments, getPayouts, isFinance } from "../services/financeService";
import { useAuth } from "../AuthContext";
import { resizeImageToDataURL } from "../utils/image";
import BackHomeButtons from "./BackHomeButtons";
import PageGuideButton from "./PageGuideButton";

const GUIDE_STEPS = [
  {
    element: ".page-header",
    popover: {
      title: "🧾 ค่าใช้จ่าย",
      description: "<p>หน้านี้ใช้บันทึกบิลค่าใช้จ่ายร่วมในกลุ่ม ระบบจะคำนวณว่าใครต้องโอนให้ใครเท่าไรโดยอัตโนมัติ</p><ul class='dv-list'><li>📊 ดูยอดรวมค่าใช้จ่ายทั้งทริป</li><li>🤝 ระบบ Netting ลดจำนวนการโอน</li></ul>",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: ".stat-strip",
    popover: {
      title: "📊 สรุปตัวเลข",
      description: "<p>แถบสถิติแสดงภาพรวมค่าใช้จ่ายของกลุ่มในมุมมองเดียว</p><ul class='dv-list'><li>💰 ยอดรวม — ค่าใช้จ่ายทั้งหมด</li><li>🧾 จำนวนบิล — บิลที่บันทึกไว้</li><li>👥 คนที่ร่วมบิล — จำนวนสมาชิก</li></ul>",
      side: "bottom",
    },
  },
  {
    element: '[data-guide="bill-add-btn"]',
    popover: {
      title: "➕ เพิ่มบิล",
      description: "<p>กดเพื่อเปิดฟอร์มบันทึกบิล ระบุชื่อรายการ ยอดเงิน ผู้จ่าย และสมาชิกที่ร่วมบิล</p><ul class='dv-list'><li>📸 แนบรูปหลักฐาน/ใบเสร็จได้</li><li>👥 เลือกสมาชิกที่ร่วมค่าใช้จ่าย</li></ul>",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: '[data-guide="bill-list"]',
    popover: {
      title: "📋 รายการบิล",
      description: "<p>กดที่แท็บบิลเพื่อดูรายละเอียด ยอดแต่ละคน และหลักฐาน แก้ไขหรือลบบิลได้จากหน้านี้</p><ul class='dv-list'><li>🔍 คลิกบิลเพื่อดูรายละเอียด</li><li>✏️ แก้ไขหรือลบบิลได้</li></ul>",
      side: "top",
      align: "start",
    },
  },
  {
    element: '[data-guide="bill-summary"]',
    popover: {
      title: "💸 สรุปยอดต้องชำระ",
      description: "<p>แสดงว่าใครต้องโอนเงินให้ใครเท่าไร กดปุ่มชำระและแนบสลิปเพื่อยืนยันการโอน</p><ul class='dv-list'><li>🏦 กดชำระเพื่อแนบสลิปโอนเงิน</li><li>✅ เจ้าของบัญชียืนยันสลิปเพื่อตัดยอด</li><li>📜 ดูประวัติการชำระย้อนหลังได้</li></ul>",
      side: "left",
      align: "start",
    },
  },
];

const emptyBill = {
  title: "",
  amount: "",
  payerId: "",
  evidenceImage: "",
  participants: [],
};

const HISTORY_PAGE_SIZE = 5;
const HISTORY_FILTERS = [
  { id: "all", label: "ทั้งหมด" },
  { id: "payment", label: "ชำระเข้า" },
  { id: "payout", label: "จ่ายคืน" },
  { id: "bill", label: "บันทึกบิล" },
];

const money = (amount) =>
  Number(amount || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

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
  if (log.type === "finance_payment_verified") {
    return `${log.fromName} ชำระเข้าบัญชีกลางแล้ว`;
  }
  if (log.type === "finance_payment_pending") {
    return `${log.fromName} ส่งสลิปรอตรวจ`;
  }
  if (log.type === "finance_payment_rejected") {
    return `ปฏิเสธสลิปของ ${log.fromName}`;
  }
  if (log.type === "finance_payout_confirmed") {
    return `โอนคืนให้ ${log.toName} และยืนยันแล้ว`;
  }
  if (log.type === "finance_payout_sent") {
    return `โอนคืนให้ ${log.toName} แล้ว`;
  }
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

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function centralSettledPaid(participant) {
  return roundMoney(participant.centralSettledPaid ?? participant.financePaid ?? 0);
}

function manualPaid(participant) {
  return Math.max(0, roundMoney(Number(participant.paid || 0) - centralSettledPaid(participant)));
}

function verifiedPaidByUser(payments) {
  const map = new Map();
  payments
    .filter((payment) => payment.status === "verified")
    .forEach((payment) => {
      getPaymentAllocations(payment).forEach((allocation) => {
        map.set(
          allocation.userId,
          roundMoney((map.get(allocation.userId) || 0) + allocation.amount)
        );
      });
    });
  return map;
}

function buildCentralSettlement(bills, payments) {
  const verifiedMap = verifiedPaidByUser(payments);
  const balances = new Map();
  const rawDebtTotals = new Map();
  const debtRows = [];

  [...bills]
    .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt))
    .forEach((bill) => {
      (bill.participants || []).forEach((participant) => {
        if (participant.userId === bill.payerId) return;
        const share = roundMoney(participant.share);
        if (share <= 0) return;

        const paidOutsideCentral = manualPaid(participant);
        const remainingBeforeCentral = Math.max(0, roundMoney(share - paidOutsideCentral));
        if (remainingBeforeCentral < 0.01) return;

        debtRows.push({
          billId: bill.id,
          userId: participant.userId,
          remainingBeforeCentral,
        });
        rawDebtTotals.set(
          participant.userId,
          roundMoney((rawDebtTotals.get(participant.userId) || 0) + remainingBeforeCentral)
        );
        balances.set(
          participant.userId,
          roundMoney((balances.get(participant.userId) || 0) - remainingBeforeCentral)
        );
        balances.set(
          bill.payerId,
          roundMoney((balances.get(bill.payerId) || 0) + remainingBeforeCentral)
        );
      });
    });

  const settleBudgetByUser = new Map();
  rawDebtTotals.forEach((rawDebtTotal, userId) => {
    const verifiedPaid = verifiedMap.get(userId) || 0;
    settleBudgetByUser.set(userId, Math.min(rawDebtTotal, verifiedPaid));
  });

  const settledByParticipant = new Map();
  debtRows.forEach((row) => {
    const budget = settleBudgetByUser.get(row.userId) || 0;
    if (budget <= 0) return;
    const settled = Math.min(row.remainingBeforeCentral, budget);
    settleBudgetByUser.set(row.userId, roundMoney(budget - settled));
    settledByParticipant.set(`${row.billId}:${row.userId}`, roundMoney(settled));
  });

  let hasChanges = false;
  const patches = [];
  const settledBills = bills.map((bill) => {
    let billChanged = false;
    const participants = (bill.participants || []).map((participant) => {
      if (participant.userId === bill.payerId) return participant;

      const paidOutsideCentral = manualPaid(participant);
      const nextCentralSettled = settledByParticipant.get(`${bill.id}:${participant.userId}`) || 0;
      const nextPaid = roundMoney(paidOutsideCentral + nextCentralSettled);
      const currentPaid = roundMoney(participant.paid);
      const currentCentralSettled = centralSettledPaid(participant);

      if (
        Math.abs(currentPaid - nextPaid) < 0.01 &&
        Math.abs(currentCentralSettled - nextCentralSettled) < 0.01 &&
        (participant.centralSettledPaid !== undefined || nextCentralSettled === 0)
      ) {
        return participant;
      }

      billChanged = true;
      return {
        ...participant,
        paid: nextPaid,
        centralSettledPaid: nextCentralSettled,
      };
    });

    if (!billChanged) return bill;

    hasChanges = true;
    patches.push({ billId: bill.id, participants });
    return { ...bill, participants };
  });

  return { bills: settledBills, patches, hasChanges };
}

function withoutCentralSettlement(bills) {
  return bills.map((bill) => ({
    ...bill,
    participants: (bill.participants || []).map((participant) => (
      participant.userId === bill.payerId
        ? participant
        : { ...participant, paid: manualPaid(participant), centralSettledPaid: 0 }
    )),
  }));
}

function buildDebtSummary(sourceBills, members) {
  const map = new Map();
  sourceBills.forEach((bill) => {
    const payer = members.find((m) => m.userId === bill.payerId);
    const payerName = payer?.name || bill.payerName || "ผู้จ่าย";
    bill.participants?.forEach((participant) => {
      if (participant.userId === bill.payerId) return;
      const remaining = Number(participant.share || 0) - Number(participant.paid || 0);
      if (Math.abs(remaining) < 0.01) return;
      const key = `${participant.userId}->${bill.payerId}`;
      const current = map.get(key) || {
        debtorId: participant.userId,
        debtorName: participant.name,
        payerId: bill.payerId,
        payerName,
        amount: 0,
      };
      current.amount += remaining;
      map.set(key, current);
    });
  });
  return Array.from(map.values()).filter((row) => Math.abs(row.amount) >= 0.01);
}

function paymentHistoryType(status) {
  if (status === "verified") return "finance_payment_verified";
  if (status === "rejected") return "finance_payment_rejected";
  return "finance_payment_pending";
}

function payoutHistoryType(status) {
  return status === "confirmed" ? "finance_payout_confirmed" : "finance_payout_sent";
}

function historyFilterKey(log) {
  if (log.type?.startsWith("finance_payment_")) return "payment";
  if (log.type?.startsWith("finance_payout_")) return "payout";
  return "bill";
}

function BillManager() {
  const { id } = useParams();
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [group, setGroup] = useState(null);
  const [bills, setBills] = useState([]);
  const [payments, setPayments] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [form, setForm] = useState(emptyBill);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeBillId, setActiveBillId] = useState(null);
  const [syncingFinance, setSyncingFinance] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [historyPage, setHistoryPage] = useState(1);

  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const evidenceInputRef = useRef(null);
  const financeSyncKeyRef = useRef("");

  const isGroupRoute = Boolean(id);
  const members = useMemo(() => group?.members || [], [group]);
  const canManage = isFinance(group, user?.userId);
  const canCreateBill = !!user?.userId && (
    canManage || members.some((member) => member.userId === user.userId)
  );
  const syncActorId = user?.userId || "";

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
        setPayments([]);
        setPayouts([]);
        return;
      }
      const groupData = { id: groupSnap.id, ...groupSnap.data() };
      const [nextBills, nextPayments, nextPayouts] = await Promise.all([
        getBills(groupId),
        getPayments(groupId).catch(() => []),
        getPayouts(groupId).catch(() => []),
      ]);
      setGroup(groupData);
      setBills(nextBills);
      setPayments(nextPayments);
      setPayouts(nextPayouts);
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

  const centralSettlement = useMemo(
    () => buildCentralSettlement(bills, payments),
    [bills, payments]
  );

  // ใช้ settled bills เพื่อแสดงสถานะจ่าย/ไม่จ่ายที่ถูกต้องโดยไม่ต้องรอ Sync
  const settledActiveBill = useMemo(
    () => centralSettlement.bills.find((b) => b.id === activeBill?.id) || activeBill,
    [centralSettlement.bills, activeBill]
  );

  useEffect(() => {
    if (!isGroupRoute || !canManage || !group || centralSettlement.patches.length === 0) return;

    const syncKey = JSON.stringify(
      centralSettlement.patches.map((patch) => [
        patch.billId,
        patch.participants.map((participant) => [
          participant.userId,
          roundMoney(participant.paid),
          roundMoney(participant.centralSettledPaid),
        ]),
      ])
    );
    if (financeSyncKeyRef.current === syncKey) return;

    let cancelled = false;
    financeSyncKeyRef.current = syncKey;

    (async () => {
      try {
        const syncedAt = new Date().toISOString();
        await Promise.all(
          centralSettlement.patches.map((patch) =>
            updateBill(id, patch.billId, {
              participants: patch.participants,
              centralSettlementSyncedAt: syncedAt,
              centralSettlementSyncedBy: syncActorId,
            })
          )
        );
        if (!cancelled) setBills(centralSettlement.bills);
      } catch (err) {
        console.error("sync central settlement failed", err);
        financeSyncKeyRef.current = "";
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canManage, centralSettlement, group, id, isGroupRoute, syncActorId]);

  const rawSummaryByPerson = useMemo(
    () => buildDebtSummary(withoutCentralSettlement(bills), members),
    [bills, members]
  );

  const visibleSummary = useMemo(
    () => buildDebtSummary(centralSettlement.bills, members),
    [centralSettlement.bills, members]
  );

  const settledCount = Math.max(0, rawSummaryByPerson.length - visibleSummary.length);

  const totalRemaining = useMemo(
    () => visibleSummary.reduce((sum, row) => sum + Math.max(0, row.amount), 0),
    [visibleSummary]
  );

  const financeHistoryLogs = useMemo(() => {
    const paymentLogs = payments.map((payment) => {
      const allocations = getPaymentAllocations(payment);
      return {
        id: `finance-pay-${payment.id}`,
        type: paymentHistoryType(payment.status),
        amount: roundMoney(payment.actualAmount ?? payment.amount),
        fromName: payment.userName || "สมาชิก",
        toName: "บัญชีกลาง",
        createdAt: payment.reviewedAt || payment.createdAt,
        createdByName: payment.reviewedByName || "",
        detail: allocations
          .map((allocation) => `${allocation.userName} ${money(allocation.amount)}`)
          .join(" · "),
      };
    });

    const payoutLogs = payouts.map((payout) => ({
      id: `finance-payout-${payout.id}`,
      type: payoutHistoryType(payout.status),
      amount: roundMoney(payout.amount),
      fromName: "บัญชีกลาง",
      toName: payout.toUserName || "สมาชิก",
      createdAt: payout.confirmedAt || payout.createdAt,
      createdByName: payout.createdByName || "",
      detail: payout.status === "confirmed" ? "ผู้รับยืนยันแล้ว" : "รอยืนยันรับเงิน",
    }));

    return [...paymentLogs, ...payoutLogs];
  }, [payments, payouts]);

  const allPaymentLogs = useMemo(
    () => [
      ...bills.flatMap((bill) =>
        (bill.paymentLogs || [])
          .filter((log) => log.type !== "bill_created")
          .map((log) => ({
            ...log,
            billId: bill.id,
            billTitle: log.billTitle || bill.title,
          }))
      ),
      ...financeHistoryLogs,
    ].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)),
    [bills, financeHistoryLogs]
  );

  const historyFilterCounts = useMemo(() => {
    const counts = { all: allPaymentLogs.length, payment: 0, payout: 0, bill: 0 };
    allPaymentLogs.forEach((log) => {
      counts[historyFilterKey(log)] += 1;
    });
    return counts;
  }, [allPaymentLogs]);

  const filteredPaymentLogs = useMemo(
    () =>
      historyFilter === "all"
        ? allPaymentLogs
        : allPaymentLogs.filter((log) => historyFilterKey(log) === historyFilter),
    [allPaymentLogs, historyFilter]
  );

  const historyTotalPages = Math.max(1, Math.ceil(filteredPaymentLogs.length / HISTORY_PAGE_SIZE));
  const currentHistoryPage = Math.min(historyPage, historyTotalPages);
  const visiblePaymentLogs = useMemo(() => {
    const start = (currentHistoryPage - 1) * HISTORY_PAGE_SIZE;
    return filteredPaymentLogs.slice(start, start + HISTORY_PAGE_SIZE);
  }, [currentHistoryPage, filteredPaymentLogs]);
  const historyRangeStart = filteredPaymentLogs.length === 0
    ? 0
    : (currentHistoryPage - 1) * HISTORY_PAGE_SIZE + 1;
  const historyRangeEnd = Math.min(
    filteredPaymentLogs.length,
    currentHistoryPage * HISTORY_PAGE_SIZE
  );

  useEffect(() => {
    if (historyPage > historyTotalPages) {
      setHistoryPage(historyTotalPages);
    }
  }, [historyPage, historyTotalPages]);

  const handleSyncFinanceHistory = async () => {
    if (!canManage || syncingFinance) return;
    setSyncingFinance(true);
    try {
      const [nextBills, nextPayments, nextPayouts] = await Promise.all([
        getBills(id),
        getPayments(id).catch(() => []),
        getPayouts(id).catch(() => []),
      ]);
      const settlement = buildCentralSettlement(nextBills, nextPayments);
      const syncedAt = new Date().toISOString();
      if (settlement.patches.length > 0) {
        await Promise.all(
          settlement.patches.map((patch) =>
            updateBill(id, patch.billId, {
              participants: patch.participants,
              centralSettlementSyncedAt: syncedAt,
              centralSettlementSyncedBy: syncActorId,
            })
          )
        );
      }
      setBills(settlement.bills);
      setPayments(nextPayments);
      setPayouts(nextPayouts);
      Swal.fire({
        toast: true,
        position: "top",
        icon: "success",
        title: `Sync แล้ว: ชำระ ${nextPayments.length} / จ่ายคืน ${nextPayouts.length}`,
        showConfirmButton: false,
        timer: 1600,
      });
    } catch (err) {
      console.error(err);
      Swal.fire("Sync ไม่สำเร็จ", "โหลดประวัติการเงินย้อนหลังไม่สำเร็จ", "error");
    } finally {
      setSyncingFinance(false);
    }
  };

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const chooseEvidenceImage = () => {
    evidenceInputRef.current?.click();
  };

  const handleEvidenceImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      Swal.fire("ไฟล์ใหญ่เกินไป", "ขนาดรูปหลักฐานไม่ควรเกิน 5MB", "info");
      return;
    }

    try {
      setUploadingEvidence(true);
      let dataUrl = await resizeImageToDataURL(file, { maxSize: 960, quality: 0.82 });
      if (dataUrl.length > 850000) {
        dataUrl = await resizeImageToDataURL(file, { maxSize: 720, quality: 0.72 });
      }
      if (dataUrl.length > 850000) {
        Swal.fire("รูปยังใหญ่เกินไป", "ลองเลือกรูปที่ขนาดเล็กลงหรือครอปรูปก่อนอัปโหลด", "info");
        return;
      }
      updateForm("evidenceImage", dataUrl);
    } catch (err) {
      console.error(err);
      Swal.fire("เกิดข้อผิดพลาด", "อัปโหลดรูปหลักฐานไม่สำเร็จ", "error");
    } finally {
      setUploadingEvidence(false);
    }
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
    if (!canCreateBill) return;
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (editingId && !canManage) {
      Swal.fire("ไม่มีสิทธิ์", "เฉพาะเจ้าของกลุ่มหรือผู้ดูแลการเงินเท่านั้นที่แก้ไขบิลได้", "warning");
      return;
    }
    if (!editingId && !canCreateBill) {
      Swal.fire("ไม่มีสิทธิ์", "เฉพาะสมาชิกในกลุ่มเท่านั้นที่สร้างบิลได้", "warning");
      return;
    }
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
      userId: p.userId,
      name: p.name,
      email: p.email || "",
      picture: p.picture || "",
      share: Number(p.share) || 0,
      paid: p.userId === form.payerId ? Number(p.share || 0) : Number(p.paid) || 0,
    }));

    const payload = {
      title: form.title.trim(),
      amount,
      payerId: form.payerId,
      payerName: payer?.name || "",
      evidenceImage: form.evidenceImage || "",
      participants: participantsWithPaid,
      updatedBy: user.userId,
    };

    try {
      if (editingId) {
        await updateBill(id, editingId, { ...payload, slipDataUrl: deleteField() });
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
    if (!canManage) return;
    setEditingId(bill.id);
    setActiveBillId(bill.id);
    setForm({
      title: bill.title || "",
      amount: bill.amount || "",
      payerId: bill.payerId || user?.userId || "",
      evidenceImage: bill.evidenceImage || "",
      participants: (bill.participants || []).map((p) => ({
        userId: p.userId,
        name: p.name,
        email: p.email || "",
        picture: p.picture || "",
        share: Number(p.share) || 0,
        paid: Number(p.paid) || 0,
      })),
    });
    setShowForm(true);
  };

  const handleDelete = async (billId) => {
    if (!canManage) return;
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

  const showEvidencePreview = (bill) => {
    if (!bill?.evidenceImage) return;
    Swal.fire({
      title: bill.title || "รูปหลักฐานบิล",
      imageUrl: bill.evidenceImage,
      imageAlt: bill.title || "รูปหลักฐานบิล",
      confirmButtonText: "ปิด",
      width: 680,
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

  // active bill share summary
  const activeBillSummary = (() => {
    if (!activeBill) return null;
    const totalShare = (activeBill.participants || []).reduce(
      (sum, p) => sum + Number(p.share || 0),
      0
    );
    const billAmount = Number(activeBill.amount || 0);
    return {
      billAmount,
      totalShare,
      participantCount: activeBill.participants?.length || 0,
      diff: roundMoney(billAmount - totalShare),
    };
  })();

  return (
    <>
      <section className="page-header page-header-tight">
        <div>
          <h1 className="page-title">ค่าใช้จ่าย</h1>
          <p className="page-subtitle">
            {group.name}
            {!canCreateBill && (
              <span className="badge text-bg-light ms-2">โหมดดูอย่างเดียว</span>
            )}
          </p>
        </div>
        <div className="d-flex gap-2 align-items-center flex-wrap">
          <PageGuideButton steps={GUIDE_STEPS} />
          {canCreateBill && (
            <button className="btn btn-success px-4" onClick={openCreateForm} data-guide="bill-add-btn">
              + เพิ่มบิล
            </button>
          )}
        </div>
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

      {showForm && canCreateBill && (
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

          <div className="bill-evidence-field mt-3">
            <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
              <label className="form-label fw-bold mb-0">รูปหลักฐานบิล</label>
              <span className="text-muted small">ไม่บังคับ</span>
            </div>
            <div className={`bill-evidence-uploader ${form.evidenceImage ? "has-image" : ""}`}>
              {form.evidenceImage ? (
                <img src={form.evidenceImage} alt="รูปหลักฐานบิล" />
              ) : (
                <div className="bill-evidence-empty">
                  <strong>ยังไม่มีรูปหลักฐาน</strong>
                  <small>รองรับ JPG / PNG / WebP ขนาดไม่เกิน 5MB</small>
                </div>
              )}
              <div className="bill-evidence-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-success"
                  onClick={chooseEvidenceImage}
                  disabled={uploadingEvidence}
                >
                  {uploadingEvidence
                    ? "กำลังอัปโหลด..."
                    : form.evidenceImage ? "เปลี่ยนรูป" : "เพิ่มรูป"}
                </button>
                {form.evidenceImage && (
                  <button
                    type="button"
                    className="btn btn-sm btn-light border"
                    onClick={() => updateForm("evidenceImage", "")}
                    disabled={uploadingEvidence}
                  >
                    ลบรูป
                  </button>
                )}
              </div>
              <input
                ref={evidenceInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleEvidenceImage}
              />
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
        <div className="soft-card p-3 p-md-4" data-guide="bill-list">
          <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
            <h2 className="h5 fw-bold mb-0">รายการบิล</h2>
            <div className="d-flex align-items-center gap-2">
              <span className="badge text-bg-light">{bills.length}</span>
              <button
                type="button"
                className="btn btn-sm btn-light border"
                onClick={canManage ? handleSyncFinanceHistory : () => fetchGroupBills(id)}
                disabled={syncingFinance}
                title="ซิงก์สถานะการจ่ายล่าสุด"
              >
                {syncingFinance ? "กำลัง Sync..." : "↺ Sync"}
              </button>
            </div>
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
                    </div>
                  </div>

                  {activeBill.evidenceImage && (
                    <div className="bill-evidence-view">
                      <button
                        type="button"
                        className="bill-evidence-thumb"
                        onClick={() => showEvidencePreview(activeBill)}
                      >
                        <img
                          src={activeBill.evidenceImage}
                          alt={`รูปหลักฐานบิล ${activeBill.title}`}
                        />
                      </button>
                      <div className="bill-evidence-meta">
                        <strong>รูปหลักฐานบิล</strong>
                        <button
                          type="button"
                          className="btn btn-sm btn-light border"
                          onClick={() => showEvidencePreview(activeBill)}
                        >
                          ดูรูป
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="bill-participants">
                    <div className="bill-section-title">
                      <span>สมาชิกที่ร่วมบิล</span>
                      <small>{activeBill.participants?.length || 0} คน</small>
                    </div>

                    {[...(settledActiveBill.participants || [])]
                      .sort((a, b) => {
                        // ชื่อตัวเองขึ้นก่อน, แล้วผู้จ่ายเงิน, ที่เหลือคงลำดับเดิม
                        if (a.userId === user?.userId) return -1;
                        if (b.userId === user?.userId) return 1;
                        if (a.userId === activeBill.payerId) return -1;
                        if (b.userId === activeBill.payerId) return 1;
                        return 0;
                      })
                      .map((p) => {
                      const isPayer = p.userId === activeBill.payerId;
                      const pShare = roundMoney(Number(p.share || 0));
                      const pPaid = roundMoney(Number(p.paid || 0));
                      const hasPaid = !isPayer && pShare > 0 && pPaid >= pShare - 0.01;
                      const isPartial = !isPayer && pPaid > 0.01 && !hasPaid;
                      const payStatusClass = isPayer
                        ? "pay-status-paid"
                        : hasPaid
                          ? "pay-status-paid"
                          : isPartial
                            ? "pay-status-partial"
                            : "pay-status-unpaid";
                      const payStatusLabel = isPayer
                        ? "ผู้ออกเงิน"
                        : hasPaid
                          ? "✓ จ่ายแล้ว"
                          : isPartial
                            ? `จ่าย ${money(pPaid)}`
                            : "ยังไม่จ่าย";
                      return (
                        <div
                          key={p.userId}
                          className={`pay-row ${isPayer ? "is-payer" : ""}`}
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
                                <small>
                                  ส่วนแบ่ง {money(pShare)}
                                  {!isPayer && isPartial && ` · เหลือ ${money(roundMoney(pShare - pPaid))}`}
                                </small>
                              </div>
                            </div>
                            <span className={`pay-status ${payStatusClass}`}>
                              {payStatusLabel}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bill summary */}
                  {activeBillSummary && (
                    <div className="pay-summary">
                      <div className="pay-summary-stats">
                        <span>ยอดบิล {money(activeBillSummary.billAmount)}</span>
                        <span>·</span>
                        <span>ส่วนแบ่งรวม {money(activeBillSummary.totalShare)}</span>
                        <span>·</span>
                        <span>{activeBillSummary.participantCount} คน</span>
                        <span>·</span>
                        <span className={Math.abs(activeBillSummary.diff) >= 0.01 ? "is-warn" : "is-good"}>
                          {Math.abs(activeBillSummary.diff) < 0.01
                            ? "ยอดตรงกัน"
                            : activeBillSummary.diff > 0
                              ? `ยังไม่ถูกหาร ${money(activeBillSummary.diff)}`
                              : `หารเกิน ${money(-activeBillSummary.diff)}`}
                        </span>
                      </div>
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

        <aside className="soft-card p-3 p-md-4" data-guide="bill-summary">
          <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
            <h2 className="h5 fw-bold mb-0">สรุปยอดต้องชำระ</h2>
            {canManage && (
              <button
                type="button"
                className="btn btn-sm btn-light border"
                onClick={handleSyncFinanceHistory}
                disabled={syncingFinance}
                title="เช็คประวัติการชำระและการจ่ายย้อนหลัง"
              >
                {syncingFinance ? "กำลัง Sync..." : "Sync"}
              </button>
            )}
          </div>
          {settledCount > 0 && (
            <p className="text-muted small mb-2">
              <span className="badge text-bg-success me-1">✓</span>
              หัก {settledCount} รายการที่ชำระหรือหักล้างผ่านบัญชีกลางแล้ว
            </p>
          )}
          {visibleSummary.length === 0 ? (
            <p className="text-muted mb-0 small">
              {rawSummaryByPerson.length === 0
                ? "ทุกบิลชำระสมดุลแล้ว"
                : "ทุกคนชำระและได้รับอนุมัติครบแล้ว ✓"}
            </p>
          ) : (
            <div className="debt-list">
              {visibleSummary.map((row) => {
                const isOver = row.amount < 0;
                return (
                  <div key={`${row.debtorId}-${row.payerId}`} className="debt-row">
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

          {allPaymentLogs.length > 0 && (
            <div className="bill-log-panel">
              <div className="bill-log-head">
                <div className="min-w-0">
                  <h2 className="h5 fw-bold mb-1">ประวัติการชำระทั้งหมด</h2>
                  <small>
                    แสดง {historyRangeStart}-{historyRangeEnd} จาก {filteredPaymentLogs.length} รายการ
                  </small>
                </div>
                <div className="bill-log-filters" role="group" aria-label="กรองประวัติการชำระ">
                  {HISTORY_FILTERS.map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      className={`bill-log-filter ${historyFilter === filter.id ? "is-active" : ""}`}
                      onClick={() => {
                        setHistoryFilter(filter.id);
                        setHistoryPage(1);
                      }}
                    >
                      <span>{filter.label}</span>
                      <small>{historyFilterCounts[filter.id] || 0}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bill-log-list">
                {visiblePaymentLogs.length === 0 ? (
                  <p className="text-muted mb-0 small">ไม่มีประวัติในตัวกรองนี้</p>
                ) : (
                  visiblePaymentLogs.map((log) => (
                    <article key={`${log.billId || "finance"}-${log.id}`} className={`bill-log-row type-${log.type}`}>
                      <div className="bill-log-main">
                        <strong>{paymentLogText(log)}</strong>
                        <small>
                          {formatLogTime(log.createdAt)}
                          {log.createdByName && ` · บันทึกโดย ${log.createdByName}`}
                          {log.detail && ` · ${log.detail}`}
                        </small>
                      </div>
                      {Number(log.amount) > 0 && (
                        <span className="bill-log-amount">{money(log.amount)}</span>
                      )}
                    </article>
                  ))
                )}
              </div>

              {filteredPaymentLogs.length > HISTORY_PAGE_SIZE && (
                <div className="bill-log-pager">
                  <button
                    type="button"
                    className="btn btn-sm btn-light border"
                    onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                    disabled={currentHistoryPage <= 1}
                  >
                    ก่อนหน้า
                  </button>
                  <span>
                    หน้า {currentHistoryPage} / {historyTotalPages}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-light border"
                    onClick={() => setHistoryPage((page) => Math.min(historyTotalPages, page + 1))}
                    disabled={currentHistoryPage >= historyTotalPages}
                  >
                    ถัดไป
                  </button>
                </div>
              )}
            </div>
          )}
        </aside>
      </section>

      <BackHomeButtons />
    </>
  );
}

export default BillManager;
