import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { useAuth } from "../AuthContext";
import BackHomeButtons from "./BackHomeButtons";
import {
  checkIsAdmin,
  getAllGroups,
  getAllUsers,
  getGroupBills,
  deleteGroup,
  setGroupFinanceUsers,
  setGroupOwner,
  setUserAdmin,
  updateGroupName,
} from "../services/adminService";

const money = (n) =>
  Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const relativeTime = (ts) => {
  if (!ts) return "-";
  const ms = ts?.toDate ? ts.toDate().getTime() : new Date(ts).getTime();
  const diff = Date.now() - ms;
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "วันนี้";
  if (d === 1) return "เมื่อวาน";
  if (d < 30) return `${d} วันที่แล้ว`;
  if (d < 365) return `${Math.floor(d / 30)} เดือนที่แล้ว`;
  return `${Math.floor(d / 365)} ปีที่แล้ว`;
};

/* ── Stat card ── */
function StatCard({ label, value, color = "var(--accent)" }) {
  return (
    <div className="soft-card p-3 text-center" style={{ flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: "2rem", fontWeight: 800, color }}>{value}</div>
      <div className="text-muted" style={{ fontSize: "0.82rem" }}>{label}</div>
    </div>
  );
}

/* ── Finance role editor ── */
function FinanceRoleEditor({ group, allUsers, onSave }) {
  const currentIds = group.financeUserIds || [];
  const members = group.members || [];
  const [ids, setIds] = useState(currentIds);
  const [saving, setSaving] = useState(false);

  const toggle = (uid) =>
    setIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );

  const save = async () => {
    setSaving(true);
    try {
      await setGroupFinanceUsers(group.id, ids);
      onSave(ids);
      Swal.fire({ toast: true, position: "top", icon: "success", title: "บันทึกแล้ว", showConfirmButton: false, timer: 1400 });
    } catch {
      Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถบันทึกได้", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2">
      <p className="mb-1" style={{ fontSize: "0.82rem", fontWeight: 600 }}>ฝ่ายการเงิน (financeUserIds)</p>
      <div className="d-flex flex-wrap gap-2 mb-2">
        {members.filter((m) => m.userId !== group.ownerId).map((m) => (
          <label key={m.userId} className="d-flex align-items-center gap-1" style={{ cursor: "pointer", fontSize: "0.85rem" }}>
            <input
              type="checkbox"
              checked={ids.includes(m.userId)}
              onChange={() => toggle(m.userId)}
            />
            <img src={m.picture || "https://via.placeholder.com/20"} alt={m.name} style={{ width: 20, height: 20, borderRadius: "50%" }} />
            {m.name}
          </label>
        ))}
      </div>
      <button className="btn btn-sm btn-success" onClick={save} disabled={saving}>
        {saving ? "กำลังบันทึก…" : "บันทึก"}
      </button>
    </div>
  );
}

/* ══════════════════════════════════
   Tab 1 — กลุ่มทั้งหมด
══════════════════════════════════ */
function GroupsTab({ groups, allUsers, onGroupsChange }) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [editFinance, setEditFinance] = useState(null);
  const [billsCache, setBillsCache] = useState({});
  const [loadingBills, setLoadingBills] = useState(null);

  const filtered = groups.filter((g) =>
    g.name?.toLowerCase().includes(search.toLowerCase()) ||
    g.id?.toLowerCase().includes(search.toLowerCase())
  );

  const handleExpand = async (groupId) => {
    if (expanded === groupId) { setExpanded(null); return; }
    setExpanded(groupId);
    if (!billsCache[groupId]) {
      setLoadingBills(groupId);
      try {
        const bills = await getGroupBills(groupId);
        setBillsCache((prev) => ({ ...prev, [groupId]: bills }));
      } finally {
        setLoadingBills(null);
      }
    }
  };

  const handleEditName = async (group) => {
    const { value } = await Swal.fire({
      title: "แก้ไขชื่อกลุ่ม",
      input: "text",
      inputValue: group.name,
      showCancelButton: true,
      confirmButtonText: "บันทึก",
      cancelButtonText: "ยกเลิก",
    });
    if (!value?.trim() || value.trim() === group.name) return;
    try {
      await updateGroupName(group.id, value.trim());
      onGroupsChange(groups.map((g) => g.id === group.id ? { ...g, name: value.trim() } : g));
      Swal.fire({ toast: true, position: "top", icon: "success", title: "แก้ไขชื่อแล้ว", showConfirmButton: false, timer: 1400 });
    } catch {
      Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถแก้ไขชื่อได้", "error");
    }
  };

  const handleDelete = async (group) => {
    const result = await Swal.fire({
      icon: "warning",
      title: `ลบกลุ่ม "${group.name}"?`,
      text: "ข้อมูลทั้งหมดในกลุ่มจะถูกลบถาวร ไม่สามารถกู้คืนได้",
      showCancelButton: true,
      confirmButtonText: "ลบกลุ่ม",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#dc3545",
    });
    if (!result.isConfirmed) return;
    try {
      await deleteGroup(group.id);
      onGroupsChange(groups.filter((g) => g.id !== group.id));
      Swal.fire({ toast: true, position: "top", icon: "success", title: "ลบกลุ่มแล้ว", showConfirmButton: false, timer: 1600 });
    } catch {
      Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถลบกลุ่มได้", "error");
    }
  };

  const handleSaveFinance = (groupId, newIds) => {
    onGroupsChange(groups.map((g) => g.id === groupId ? { ...g, financeUserIds: newIds } : g));
    setEditFinance(null);
  };

  return (
    <div>
      <input
        className="form-control mb-3"
        placeholder="ค้นหากลุ่ม (ชื่อหรือ ID)…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {filtered.length === 0 && <p className="text-muted text-center py-4">ไม่พบกลุ่ม</p>}
      <div className="d-flex flex-column gap-3">
        {filtered.map((group) => {
          const bills = billsCache[group.id] || [];
          const isExpanded = expanded === group.id;
          const owner = group.members?.find((m) => m.userId === group.ownerId);
          const financeMembers = group.members?.filter((m) =>
            (group.financeUserIds || []).includes(m.userId)
          ) || [];
          const totalAmount = bills.reduce((s, b) => s + Number(b.amount || 0), 0);

          return (
            <div key={group.id} className="soft-card p-0 overflow-hidden">
              {/* Header row */}
              <div
                className="d-flex align-items-center gap-3 p-3"
                style={{ cursor: "pointer" }}
                onClick={() => handleExpand(group.id)}
              >
                <div
                  style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: "linear-gradient(135deg, var(--accent), var(--accent-strong))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontWeight: 800, fontSize: "1.1rem",
                  }}
                >
                  {group.name?.charAt(0)?.toUpperCase() || "G"}
                </div>
                <div className="flex-fill min-w-0">
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <strong className="text-truncate">{group.name}</strong>
                    <span className="badge text-bg-light" style={{ fontSize: "0.7rem" }}>{group.id.slice(0, 8)}</span>
                    {group.financeClosed && (
                      <span className="badge text-bg-secondary" style={{ fontSize: "0.7rem" }}>ปิดบัญชีแล้ว</span>
                    )}
                  </div>
                  <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                    {group.members?.length || 0} สมาชิก ·{" "}
                    {billsCache[group.id] ? `${bills.length} บิล · ` : ""}
                    เจ้าของ: {owner?.name || group.ownerId?.slice(0, 8) || "-"} ·{" "}
                    สร้าง {relativeTime(group.createdAt)}
                  </div>
                </div>
                <svg
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ width: 20, height: 20, flexShrink: 0, transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 200ms" }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div style={{ borderTop: "1px solid var(--border)" }} className="p-3">
                  {loadingBills === group.id ? (
                    <div className="text-center py-3">
                      <div className="spinner-border spinner-border-sm text-success" />
                      <span className="ms-2 text-muted small">กำลังโหลดบิล…</span>
                    </div>
                  ) : (
                    <>
                      {/* Stats row */}
                      <div className="d-flex gap-2 mb-3 flex-wrap">
                        <div className="px-3 py-2 rounded-3 text-center" style={{ background: "var(--surface-mute)", minWidth: 80 }}>
                          <div style={{ fontWeight: 800, color: "var(--accent)" }}>{bills.length}</div>
                          <div style={{ fontSize: "0.75rem" }} className="text-muted">บิล</div>
                        </div>
                        <div className="px-3 py-2 rounded-3 text-center" style={{ background: "var(--surface-mute)", minWidth: 80 }}>
                          <div style={{ fontWeight: 800, color: "var(--accent)" }}>{money(totalAmount)}</div>
                          <div style={{ fontSize: "0.75rem" }} className="text-muted">ยอดรวม</div>
                        </div>
                        <div className="px-3 py-2 rounded-3 text-center" style={{ background: "var(--surface-mute)", minWidth: 80 }}>
                          <div style={{ fontWeight: 800, color: "var(--accent)" }}>{financeMembers.length}</div>
                          <div style={{ fontSize: "0.75rem" }} className="text-muted">ฝ่ายการเงิน</div>
                        </div>
                      </div>

                      {/* Members */}
                      <p className="mb-1" style={{ fontSize: "0.82rem", fontWeight: 600 }}>สมาชิก</p>
                      <div className="d-flex flex-wrap gap-2 mb-3">
                        {(group.members || []).map((m) => (
                          <div key={m.userId} className="d-flex align-items-center gap-1 px-2 py-1 rounded-3"
                            style={{ background: "var(--surface-mute)", fontSize: "0.82rem" }}>
                            <img src={m.picture || "https://via.placeholder.com/20"} alt={m.name}
                              style={{ width: 20, height: 20, borderRadius: "50%" }} />
                            <span>{m.name}</span>
                            {m.userId === group.ownerId && (
                              <span className="badge text-bg-success ms-1" style={{ fontSize: "0.6rem" }}>เจ้าของ</span>
                            )}
                            {(group.financeUserIds || []).includes(m.userId) && (
                              <span className="badge text-bg-primary ms-1" style={{ fontSize: "0.6rem" }}>การเงิน</span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Bills preview */}
                      {bills.length > 0 && (
                        <>
                          <p className="mb-1" style={{ fontSize: "0.82rem", fontWeight: 600 }}>บิลล่าสุด</p>
                          <div className="d-flex flex-column gap-1 mb-3">
                            {bills.slice(0, 5).map((b) => {
                              const payer = group.members?.find((m) => m.userId === b.payerId);
                              return (
                                <div key={b.id} className="d-flex justify-content-between align-items-center px-2 py-1 rounded-3"
                                  style={{ background: "var(--surface-mute)", fontSize: "0.82rem" }}>
                                  <span className="text-truncate me-2">{b.title || "ไม่มีชื่อ"}</span>
                                  <div className="d-flex gap-2 align-items-center text-muted flex-shrink-0">
                                    <span>{payer?.name || "-"}</span>
                                    <strong style={{ color: "var(--accent)" }}>฿{money(b.amount)}</strong>
                                  </div>
                                </div>
                              );
                            })}
                            {bills.length > 5 && (
                              <p className="text-muted mb-0" style={{ fontSize: "0.78rem" }}>และอีก {bills.length - 5} บิล…</p>
                            )}
                          </div>
                        </>
                      )}

                      {/* Finance role editor */}
                      {editFinance === group.id ? (
                        <FinanceRoleEditor
                          group={group}
                          allUsers={allUsers}
                          onSave={(ids) => handleSaveFinance(group.id, ids)}
                        />
                      ) : (
                        <div className="d-flex gap-2 flex-wrap">
                          <Link to={`/group/${group.id}`} className="btn btn-sm btn-outline-success">
                            เข้าหน้ากลุ่ม
                          </Link>
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => handleEditName(group)}>
                            แก้ชื่อ
                          </button>
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditFinance(group.id)}>
                            จัดการฝ่ายการเงิน
                          </button>
                          <button className="btn btn-sm btn-outline-danger ms-auto" onClick={() => handleDelete(group)}>
                            ลบกลุ่ม
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════
   Tab 2 — ผู้ใช้ทั้งหมด
══════════════════════════════════ */
function UsersTab({ users, groups, onUsersChange }) {
  const [search, setSearch] = useState("");

  const filtered = users.filter((u) =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.id?.toLowerCase().includes(search.toLowerCase())
  );

  const userGroupMap = new Map();
  groups.forEach((g) => {
    (g.members || []).forEach((m) => {
      if (!userGroupMap.has(m.userId)) userGroupMap.set(m.userId, []);
      userGroupMap.get(m.userId).push(g);
    });
  });

  const handleToggleAdmin = async (u) => {
    const next = !u.isAdmin;
    const result = await Swal.fire({
      icon: "question",
      title: next ? `ให้ ${u.name} เป็น Admin?` : `ถอด ${u.name} ออกจาก Admin?`,
      showCancelButton: true,
      confirmButtonText: "ยืนยัน",
      cancelButtonText: "ยกเลิก",
    });
    if (!result.isConfirmed) return;
    try {
      await setUserAdmin(u.id, next);
      onUsersChange(users.map((x) => x.id === u.id ? { ...x, isAdmin: next } : x));
      Swal.fire({ toast: true, position: "top", icon: "success", title: "บันทึกแล้ว", showConfirmButton: false, timer: 1400 });
    } catch {
      Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถอัปเดตได้", "error");
    }
  };

  return (
    <div>
      <input
        className="form-control mb-3"
        placeholder="ค้นหาผู้ใช้ (ชื่อ, อีเมล, ID)…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {filtered.length === 0 && <p className="text-muted text-center py-4">ไม่พบผู้ใช้</p>}
      <div className="d-flex flex-column gap-2">
        {filtered.map((u) => {
          const memberGroups = userGroupMap.get(u.id) || [];
          return (
            <div key={u.id} className="soft-card p-3">
              <div className="d-flex align-items-center gap-3">
                <img
                  src={u.pictureUrl || u.picture || "https://via.placeholder.com/40"}
                  alt={u.name}
                  style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, objectFit: "cover" }}
                />
                <div className="flex-fill min-w-0">
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <strong>{u.name || "(ไม่มีชื่อ)"}</strong>
                    {u.isAdmin && (
                      <span className="badge text-bg-danger" style={{ fontSize: "0.7rem" }}>Admin</span>
                    )}
                  </div>
                  <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                    {u.email || u.id?.slice(0, 16)}
                  </div>
                  {memberGroups.length > 0 && (
                    <div className="mt-1 d-flex flex-wrap gap-1">
                      {memberGroups.map((g) => (
                        <span key={g.id} className="badge text-bg-light" style={{ fontSize: "0.7rem", fontWeight: 500 }}>
                          {g.name}
                          {g.ownerId === u.id && " 👑"}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="d-flex flex-column gap-1 align-items-end flex-shrink-0">
                  <span className="text-muted" style={{ fontSize: "0.75rem" }}>{memberGroups.length} กลุ่ม</span>
                  <button
                    className={`btn btn-sm ${u.isAdmin ? "btn-danger" : "btn-outline-secondary"}`}
                    style={{ fontSize: "0.75rem", padding: "2px 10px" }}
                    onClick={() => handleToggleAdmin(u)}
                  >
                    {u.isAdmin ? "ถอด Admin" : "ตั้งเป็น Admin"}
                  </button>
                </div>
              </div>
              {u.bankProfile && (
                <div className="mt-2 px-2 py-1 rounded-3 text-muted" style={{ background: "var(--surface-mute)", fontSize: "0.78rem" }}>
                  💳 {u.bankProfile.bankName} · {u.bankProfile.accountName} · {u.bankProfile.bankAccount || u.bankProfile.promptpay || "-"}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════
   Tab 3 — บิลทั้งหมด
══════════════════════════════════ */
function BillsTab({ groups }) {
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const loadBills = useCallback(async (gid) => {
    setLoading(true);
    setBills([]);
    try {
      const data = await getGroupBills(gid);
      setBills(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectGroup = (gid) => {
    setSelectedGroupId(gid);
    setSearch("");
    if (gid) loadBills(gid);
  };

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const filtered = bills.filter((b) =>
    b.title?.toLowerCase().includes(search.toLowerCase()) ||
    b.payerName?.toLowerCase().includes(search.toLowerCase())
  );
  const totalAmount = filtered.reduce((s, b) => s + Number(b.amount || 0), 0);

  return (
    <div>
      <div className="d-flex gap-2 mb-3 flex-wrap">
        <select
          className="form-select"
          style={{ maxWidth: 320 }}
          value={selectedGroupId}
          onChange={(e) => handleSelectGroup(e.target.value)}
        >
          <option value="">-- เลือกกลุ่ม --</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} ({g.members?.length || 0} สมาชิก)
            </option>
          ))}
        </select>
        {selectedGroupId && (
          <input
            className="form-control"
            style={{ maxWidth: 240 }}
            placeholder="ค้นหาบิล…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}
      </div>

      {!selectedGroupId && (
        <div className="soft-card empty-state text-muted">เลือกกลุ่มเพื่อดูรายการบิล</div>
      )}

      {selectedGroupId && loading && (
        <div className="soft-card text-center py-4">
          <div className="spinner-border text-success" />
          <p className="mt-2 mb-0 text-muted">กำลังโหลดบิล…</p>
        </div>
      )}

      {selectedGroupId && !loading && (
        <>
          <div className="d-flex gap-3 mb-3 flex-wrap">
            <div className="px-3 py-2 rounded-3 text-center" style={{ background: "var(--surface-mute)", minWidth: 80 }}>
              <div style={{ fontWeight: 800, color: "var(--accent)" }}>{filtered.length}</div>
              <div style={{ fontSize: "0.75rem" }} className="text-muted">บิล</div>
            </div>
            <div className="px-3 py-2 rounded-3 text-center" style={{ background: "var(--surface-mute)", minWidth: 120 }}>
              <div style={{ fontWeight: 800, color: "var(--accent)" }}>฿{money(totalAmount)}</div>
              <div style={{ fontSize: "0.75rem" }} className="text-muted">ยอดรวม</div>
            </div>
          </div>

          {filtered.length === 0 && (
            <p className="text-muted text-center py-4">ไม่มีบิลในกลุ่มนี้</p>
          )}

          <div className="d-flex flex-column gap-2">
            {filtered.map((bill) => {
              const payer = selectedGroup?.members?.find((m) => m.userId === bill.payerId);
              const paid = (bill.participants || []).filter((p) =>
                p.userId !== bill.payerId && Number(p.paid || 0) >= Number(p.share || 0) - 0.01
              ).length;
              const total = (bill.participants || []).filter((p) => p.userId !== bill.payerId).length;

              return (
                <div key={bill.id} className="soft-card p-3">
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <div className="flex-fill min-w-0">
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <strong className="text-truncate">{bill.title || "(ไม่มีชื่อ)"}</strong>
                        <span className={`badge ${paid === total ? "text-bg-success" : "text-bg-warning"}`} style={{ fontSize: "0.7rem" }}>
                          {paid}/{total} จ่าย
                        </span>
                      </div>
                      <div className="text-muted mt-1" style={{ fontSize: "0.8rem" }}>
                        ออกโดย {payer?.name || bill.payerName || "-"} · {relativeTime(bill.createdAt)}
                      </div>
                      <div className="d-flex flex-wrap gap-1 mt-1">
                        {(bill.participants || []).map((p) => {
                          const isPayer = p.userId === bill.payerId;
                          const hasPaid = isPayer || Number(p.paid || 0) >= Number(p.share || 0) - 0.01;
                          const member = selectedGroup?.members?.find((m) => m.userId === p.userId);
                          return (
                            <span
                              key={p.userId}
                              className={`badge ${isPayer ? "text-bg-primary" : hasPaid ? "text-bg-success" : "text-bg-light"}`}
                              style={{ fontSize: "0.7rem", color: (!isPayer && !hasPaid) ? "var(--text)" : undefined }}
                              title={`ส่วนแบ่ง ฿${money(p.share)}`}
                            >
                              {member?.name || p.name || p.userId?.slice(0, 6)}
                              {!isPayer && !hasPaid && " ⚠️"}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="text-end flex-shrink-0">
                      <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--accent)" }}>
                        ฿{money(bill.amount)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════
   Main — AdminPanel
══════════════════════════════════ */
export default function AdminPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState("groups");
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (!user?.userId) { navigate("/"); return; }
    checkIsAdmin(user.userId).then((ok) => {
      setIsAdmin(ok);
      setChecking(false);
      if (!ok) navigate("/menu");
    });
  }, [user, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    setLoadingData(true);
    Promise.all([getAllGroups(), getAllUsers()])
      .then(([g, u]) => { setGroups(g); setUsers(u); })
      .catch(() => Swal.fire("เกิดข้อผิดพลาด", "โหลดข้อมูลไม่สำเร็จ", "error"))
      .finally(() => setLoadingData(false));
  }, [isAdmin]);

  if (checking) {
    return (
      <div className="soft-card empty-state mt-4">
        <div className="spinner-border text-success" />
        <p className="mt-3 mb-0">กำลังตรวจสอบสิทธิ์…</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  const totalBills = groups.reduce((s, g) => s + (g.billCount || 0), 0);

  const TABS = [
    { id: "groups", label: `กลุ่ม (${groups.length})` },
    { id: "users", label: `ผู้ใช้ (${users.length})` },
    { id: "bills", label: "บิล" },
  ];

  return (
    <>
      {/* Header */}
      <section className="page-header">
        <div>
          <h1 className="page-title">แผงควบคุมผู้ดูแลระบบ</h1>
          <p className="page-subtitle">จัดการข้อมูลทุกกลุ่ม ผู้ใช้ และบิลในระบบ</p>
        </div>
        <span className="badge text-bg-danger px-3 py-2" style={{ fontSize: "0.85rem" }}>
          🔐 Admin
        </span>
      </section>

      {loadingData ? (
        <div className="soft-card empty-state">
          <div className="spinner-border text-success" />
          <p className="mt-3 mb-0">กำลังโหลดข้อมูล…</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="d-flex gap-3 mb-4 flex-wrap">
            <StatCard label="กลุ่มทั้งหมด" value={groups.length} />
            <StatCard label="ผู้ใช้ทั้งหมด" value={users.length} color="#2374ab" />
            <StatCard label="Admin" value={users.filter((u) => u.isAdmin).length} color="#dc3545" />
          </div>

          {/* Tabs */}
          <div className="d-flex gap-1 mb-3 p-1 rounded-3" style={{ background: "var(--surface-mute)", width: "fit-content" }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                className="btn btn-sm"
                style={{
                  borderRadius: 10,
                  fontWeight: 600,
                  background: activeTab === t.id ? "var(--surface)" : "transparent",
                  color: activeTab === t.id ? "var(--accent)" : "var(--text-muted)",
                  boxShadow: activeTab === t.id ? "var(--shadow-sm)" : "none",
                  border: "none",
                  padding: "6px 16px",
                }}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "groups" && (
            <GroupsTab groups={groups} allUsers={users} onGroupsChange={setGroups} />
          )}
          {activeTab === "users" && (
            <UsersTab users={users} groups={groups} onUsersChange={setUsers} />
          )}
          {activeTab === "bills" && (
            <BillsTab groups={groups} />
          )}
        </>
      )}

      <BackHomeButtons />
    </>
  );
}
