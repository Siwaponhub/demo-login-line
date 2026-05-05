import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import Swal from "sweetalert2";
import { db } from "../firebase";
import { createBill, deleteBill, getBills, updateBill } from "../services/billService";
import { useAuth } from "../AuthContext";
import BackHomeButtons from "./BackHomeButtons";

const emptyBill = {
  title: "",
  amount: "",
  payerId: "",
  participants: [],
};

const money = (amount) =>
  Number(amount || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function BillManager() {
  const { id } = useParams();
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [group, setGroup] = useState(null);
  const [bills, setBills] = useState([]);
  const [form, setForm] = useState(emptyBill);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const isGroupRoute = Boolean(id);
  const members = useMemo(() => group?.members || [], [group]);

  const totalTripAmount = useMemo(
    () => bills.reduce((sum, bill) => sum + Number(bill.amount || 0), 0),
    [bills]
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
      setGroup(groupData);
      setForm((current) => ({
        ...current,
        payerId: current.payerId || user?.userId || groupData.members?.[0]?.userId || "",
      }));
      setBills(await getBills(groupId));
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

  const billSummary = useMemo(() => {
    const rows = [];

    bills.forEach((bill) => {
      const payer = members.find((member) => member.userId === bill.payerId);
      bill.participants?.forEach((participant) => {
        if (participant.userId === bill.payerId) return;
        const share = Number(participant.share || 0);
        if (share <= 0) return;

        rows.push({
          billId: bill.id,
          payerName: payer?.name || bill.payerName || "ผู้จ่าย",
          debtorName: participant.name,
          amount: share,
        });
      });
    });

    return rows;
  }, [bills, members]);

  const summaryByPerson = useMemo(() => {
    const map = new Map();
    billSummary.forEach((row) => {
      const key = `${row.debtorName}->${row.payerName}`;
      const current = map.get(key) || {
        debtorName: row.debtorName,
        payerName: row.payerName,
        amount: 0,
      };
      current.amount += row.amount;
      map.set(key, current);
    });
    return Array.from(map.values());
  }, [billSummary]);

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
      const exists = current.participants.some((participant) => participant.userId === member.userId);
      return {
        ...current,
        participants: exists
          ? current.participants.filter((participant) => participant.userId !== member.userId)
          : [
              ...current.participants,
              {
                userId: member.userId,
                name: member.name,
                email: member.email || "",
                picture: member.picture || "",
                share: 0,
              },
            ],
      };
    });
  };

  const selectAllMembers = () => {
    setForm((current) => ({
      ...current,
      participants: members.map((member) => ({
        userId: member.userId,
        name: member.name,
        email: member.email || "",
        picture: member.picture || "",
        share: 0,
      })),
    }));
  };

  const clearParticipants = () => {
    setForm((current) => ({ ...current, participants: [] }));
  };

  const updateShare = (userId, value) => {
    setForm((current) => ({
      ...current,
      participants: current.participants.map((participant) =>
        participant.userId === userId
          ? { ...participant, share: Number(value) || 0 }
          : participant
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
      participants: current.participants.map((participant, index) => ({
        ...participant,
        share: Number((perPerson + (index === 0 ? diff : 0)).toFixed(2)),
      })),
    }));
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
        text: `ยอดรายคนรวม ${money(shareTotal)} บาท แต่ยอดบิลคือ ${money(amount)} บาท`,
        showCancelButton: true,
        confirmButtonText: "บันทึกต่อ",
        cancelButtonText: "กลับไปแก้",
      });
      if (!result.isConfirmed) return;
    }

    const payer = members.find((member) => member.userId === form.payerId);
    const payload = {
      title: form.title.trim(),
      amount,
      payerId: form.payerId,
      payerName: payer?.name || "",
      participants: form.participants,
      updatedBy: user.userId,
    };

    try {
      if (editingId) {
        await updateBill(id, editingId, payload);
        Swal.fire("สำเร็จ", "แก้ไขบิลแล้ว", "success");
      } else {
        await createBill(id, {
          ...payload,
          createdBy: user.userId,
        });
        Swal.fire("สำเร็จ", "สร้างบิลแล้ว", "success");
      }

      resetForm();
      setBills(await getBills(id));
    } catch (err) {
      console.error(err);
      Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถบันทึกบิลได้", "error");
    }
  };

  const handleEdit = (bill) => {
    setEditingId(bill.id);
    setForm({
      title: bill.title || "",
      amount: bill.amount || "",
      payerId: bill.payerId || user?.userId || "",
      participants: bill.participants || [],
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
    setBills(bills.filter((bill) => bill.id !== billId));
    Swal.fire("สำเร็จ", "ลบบิลแล้ว", "success");
  };

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
              <Link key={g.id} to={`/group/${g.id}/bills`} className="menu-card">
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

  if (loading) {
    return <div className="soft-card empty-state">กำลังโหลดค่าใช้จ่าย...</div>;
  }

  if (!group) {
    return <div className="soft-card empty-state">ไม่พบกลุ่มนี้</div>;
  }

  return (
    <>
      <section className="page-header">
        <div>
          <h1 className="page-title">ค่าใช้จ่ายทริป</h1>
          <p className="page-subtitle">{group.name}</p>
        </div>
        <button className="btn btn-success px-4 py-3" onClick={openCreateForm}>
          เพิ่มบิล
        </button>
      </section>

      <section className="expense-overview">
        <div className="soft-card p-4">
          <p className="text-muted mb-1">ยอดรวมทริป</p>
          <strong>{money(totalTripAmount)} บาท</strong>
        </div>
        <div className="soft-card p-4">
          <p className="text-muted mb-1">จำนวนบิล</p>
          <strong>{bills.length} บิล</strong>
        </div>
        <div className="soft-card p-4">
          <p className="text-muted mb-1">รายการที่ต้องชำระคืน</p>
          <strong>{summaryByPerson.length} รายการ</strong>
        </div>
      </section>

      {showForm && (
        <form className="soft-card p-4 mt-3" onSubmit={handleSubmit}>
          <div className="d-flex justify-content-between align-items-start gap-3">
            <div>
              <h2 className="h4 fw-bold mb-1">{editingId ? "แก้ไขบิล" : "เพิ่มบิล"}</h2>
              <p className="text-muted mb-0">เลือกคนออกเงินและสมาชิกที่ร่วมบิลนี้</p>
            </div>
            <button className="btn btn-light border" type="button" onClick={resetForm}>
              ปิด
            </button>
          </div>

          <label className="form-label fw-bold mt-3">ชื่อบิล</label>
          <input
            className="form-control"
            value={form.title}
            onChange={(event) => updateForm("title", event.target.value)}
            placeholder="เช่น ค่าที่พัก คืนแรก"
          />

          <div className="row g-3 mt-1">
            <div className="col-12 col-md-6">
              <label className="form-label fw-bold">ยอดรวม</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-control"
                value={form.amount}
                onChange={(event) => updateForm("amount", event.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label fw-bold">คนออกเงิน</label>
              <select
                className="form-control"
                value={form.payerId}
                onChange={(event) => updateForm("payerId", event.target.value)}
              >
                <option value="">เลือกผู้จ่าย</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="d-flex justify-content-between align-items-center gap-2 mt-4">
            <h3 className="h5 fw-bold mb-0">สมาชิกที่ร่วมบิล</h3>
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-sm btn-outline-success" onClick={selectAllMembers}>
                ทุกคน
              </button>
              <button type="button" className="btn btn-sm btn-light border" onClick={clearParticipants}>
                ล้าง
              </button>
            </div>
          </div>

          <div className="list-group mt-3">
            {members.map((member) => (
              <label key={member.userId} className="list-group-item d-flex align-items-center gap-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={form.participants.some((participant) => participant.userId === member.userId)}
                  onChange={() => toggleParticipant(member)}
                />
                <img
                  src={member.picture || "https://via.placeholder.com/40"}
                  alt={member.name}
                  className="avatar"
                />
                <span className="fw-bold">{member.name}</span>
              </label>
            ))}
          </div>

          {form.participants.length > 0 && (
            <div className="mt-4">
              <div className="d-flex justify-content-between align-items-center gap-2">
                <h3 className="h5 fw-bold mb-0">ยอดรายคน</h3>
                <button type="button" className="btn btn-sm btn-outline-success" onClick={splitEqually}>
                  หารเท่ากัน
                </button>
              </div>

              <div className="d-grid gap-2 mt-3">
                {form.participants.map((participant) => (
                  <div key={participant.userId} className="input-group">
                    <span className="input-group-text bg-white">
                      <img
                        src={participant.picture || "https://via.placeholder.com/30"}
                        alt={participant.name}
                        className="avatar me-2"
                      />
                      {participant.name}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-control"
                      value={participant.share}
                      onChange={(event) => updateShare(participant.userId, event.target.value)}
                    />
                    <span className="input-group-text">บาท</span>
                  </div>
                ))}
              </div>

              <p className="text-muted mt-2 mb-0">
                ยอดรายคนรวม {money(selectedTotal)} บาท
              </p>
            </div>
          )}

          <div className="d-flex gap-2 mt-4">
            <button className="btn btn-success flex-fill py-3" type="submit">
              {editingId ? "บันทึกการแก้ไข" : "สร้างบิล"}
            </button>
            {editingId && (
              <button className="btn btn-light border py-3" type="button" onClick={resetForm}>
                ยกเลิก
              </button>
            )}
          </div>
        </form>
      )}

      <section className="expense-layout mt-3">
        <div className="soft-card p-4">
          <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
            <h2 className="h4 fw-bold mb-0">รายการบิล</h2>
            <span className="badge text-bg-light">{bills.length} บิล</span>
          </div>

          {bills.length === 0 ? (
            <div className="empty-state">
              <h3 className="h5 fw-bold">ยังไม่มีบิล</h3>
              <p>กดเพิ่มบิลเพื่อเริ่มบันทึกค่าใช้จ่ายของทริปนี้</p>
            </div>
          ) : (
            <div className="bill-grid">
              {bills.map((bill) => (
                <article key={bill.id} className="bill-card">
                  <div className="bill-card-header">
                    <div>
                      <h3>{bill.title}</h3>
                      <p>ออกโดย {bill.payerName || "ผู้จ่าย"}</p>
                    </div>
                    <strong>{money(bill.amount)} บาท</strong>
                  </div>

                  <div className="bill-participants">
                    <div className="bill-section-title">
                      <span>รายละเอียดสมาชิกในบิล</span>
                      <small>{bill.participants?.length || 0} คน</small>
                    </div>

                    {(bill.participants || []).map((participant) => (
                      <div key={participant.userId} className="bill-participant-row">
                        <span className="d-flex align-items-center gap-2">
                          <img
                            src={participant.picture || "https://via.placeholder.com/30"}
                            alt={participant.name}
                            className="avatar"
                          />
                          <span>{participant.name}</span>
                        </span>
                        <strong>{money(participant.share)} บาท</strong>
                      </div>
                    ))}
                  </div>

                  <div className="d-flex gap-2 mt-3">
                    <button className="btn btn-sm btn-outline-primary" onClick={() => handleEdit(bill)}>
                      แก้ไข
                    </button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(bill.id)}>
                      ลบ
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="soft-card p-4">
          <h2 className="h4 fw-bold">สรุปยอดต้องชำระ</h2>
          {summaryByPerson.length === 0 ? (
            <p className="text-muted mb-0">ยังไม่มีรายการที่ต้องจ่ายคืน</p>
          ) : (
            <div className="list-group list-group-flush">
              {summaryByPerson.map((row) => (
                <div key={`${row.debtorName}-${row.payerName}`} className="list-group-item px-0">
                  <strong>{row.debtorName}</strong> จ่ายให้ <strong>{row.payerName}</strong>
                  <span className="d-block text-success fw-bold">{money(row.amount)} บาท</span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </section>

      <BackHomeButtons />
    </>
  );
}

export default BillManager;
