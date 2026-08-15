import React, { useState, useEffect, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  LayoutDashboard, Users, PiggyBank, Coins, Landmark, FileBarChart, UserCog,
  History, Settings, LogOut, Plus, Search, Download, Printer, Eye, EyeOff,
  Check, X, AlertTriangle, TrendingUp, TrendingDown, Calendar, ChevronRight,
  Wallet, ArrowDownCircle, ArrowUpCircle, Clock, ShieldCheck, Menu, Loader2,
  Bell, KeyRound, RefreshCw
} from "lucide-react";

/* ============================== BRAND ============================== */
const C = {
  ink: "#152238",
  ink2: "#1F3358",
  navy: "#1B2A4A",
  navyDeep: "#0F1B30",
  gold: "#B8862E",
  goldLight: "#D9A84E",
  paper: "#F6F4EE",
  paperDim: "#EFECE3",
  card: "#FFFFFF",
  line: "#E4E0D4",
  green: "#2F6B4F",
  greenBg: "#E9F2ED",
  red: "#A23B34",
  redBg: "#F7EAE8",
  amber: "#B8862E",
  amberBg: "#F6EEDD",
  slate: "#6B7280",
};

const ROLES = ["admin", "manager", "accountant", "staff", "member"];
const ROLE_LABEL = {
  admin: "Admin", manager: "Manager", accountant: "Accountant",
  staff: "Staff", member: "Member",
};
const ROLE_PERMS = {
  admin: { dashboard: true, members: true, savings: true, shares: true, loans: true, loanApprove: true, reports: true, users: true, loginHistory: true },
  manager: { dashboard: true, members: true, savings: true, shares: true, loans: true, loanApprove: true, reports: true, users: false, loginHistory: false },
  accountant: { dashboard: true, members: false, savings: true, shares: true, loans: true, loanApprove: false, reports: true, users: false, loginHistory: false },
  staff: { dashboard: true, members: true, savings: true, shares: true, loans: false, loanApprove: false, reports: false, users: false, loginHistory: false },
  member: { dashboard: false, members: false, savings: false, shares: false, loans: false, loanApprove: false, reports: false, users: false, loginHistory: false },
};

/* ============================== UTILS ============================== */
const uid = (p = "") => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => {
  if (!d) return "-";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};
const fmtMoney = (n) =>
  "Rs. " + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
const initials = (name = "") =>
  name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const monthKey = (d) => (d || "").slice(0, 7);
const addMonths = (dateStr, n) => {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
};
function resizePhoto(file, maxSize = 220) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read image"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) { height = Math.round((height * maxSize) / width); width = maxSize; }
        else if (height > maxSize) { width = Math.round((width * maxSize) / height); height = maxSize; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function memberCode(existing) {
  const n = existing.length + 1;
  return "LBFG-NP-" + String(n).padStart(6, "0");
}

/* ========================= LOAN CALCULATIONS ========================= */
function buildLoanSchedule(principal, annualRate, tenureMonths, startDate) {
  const monthlyInterest = (principal * (annualRate / 100)) / 12;
  const totalInterest = monthlyInterest * tenureMonths;
  const totalPayable = principal + totalInterest;
  const installmentAmt = Math.round((totalPayable / tenureMonths) * 100) / 100;
  const schedule = [];
  for (let i = 1; i <= tenureMonths; i++) {
    schedule.push({
      id: uid("inst"),
      no: i,
      dueDate: addMonths(startDate, i),
      amount: i === tenureMonths ? Math.round((totalPayable - installmentAmt * (tenureMonths - 1)) * 100) / 100 : installmentAmt,
      paid: false,
      paidDate: null,
      paidAmount: 0,
      fineCollected: 0,
    });
  }
  return { schedule, totalInterest, totalPayable };
}
function buildLoanScheduleReducing(principal, annualRate, tenureMonths, startDate) {
  const r = annualRate / 100 / 12;
  const n = tenureMonths;
  const emi = r === 0 ? principal / n : (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const roundedEmi = Math.round(emi * 100) / 100;
  let balance = principal;
  let totalInterest = 0;
  const schedule = [];
  for (let i = 1; i <= n; i++) {
    const interestPortion = Math.round(balance * r * 100) / 100;
    let installmentAmt = roundedEmi;
    let principalPortion = installmentAmt - interestPortion;
    if (i === n) {
      // settle any rounding drift on the final installment
      principalPortion = Math.round(balance * 100) / 100;
      installmentAmt = Math.round((principalPortion + interestPortion) * 100) / 100;
    }
    balance = Math.round((balance - principalPortion) * 100) / 100;
    totalInterest += interestPortion;
    schedule.push({
      id: uid("inst"), no: i, dueDate: addMonths(startDate, i), amount: installmentAmt,
      principalPortion, interestPortion, paid: false, paidDate: null, paidAmount: 0, fineCollected: 0,
    });
  }
  return { schedule, totalInterest: Math.round(totalInterest * 100) / 100, totalPayable: Math.round((principal + totalInterest) * 100) / 100 };
}
function buildSchedule(method, principal, annualRate, tenureMonths, startDate) {
  return method === "reducing"
    ? buildLoanScheduleReducing(principal, annualRate, tenureMonths, startDate)
    : buildLoanSchedule(principal, annualRate, tenureMonths, startDate);
}
function isOverdue(inst) {
  return !inst.paid && new Date(inst.dueDate) < new Date(todayISO());
}
function fineFor(inst) {
  return isOverdue(inst) ? Math.round(inst.amount * 0.02 * 100) / 100 : 0;
}
function loanOutstanding(loan) {
  if (!loan.schedule) return loan.principal || 0;
  return loan.schedule.filter((i) => !i.paid).reduce((s, i) => s + i.amount, 0);
}

/* ============================== SEED DATA ============================== */
function seedAll() {
  const members = [
    { id: uid("m"), code: "LBFG-NP-000001", name: "Sita Kumari Thapa", citizenship: "12-01-70-00123", phone: "9841000001", address: "Butwal-5, Rupandehi", nominee: "Ram Thapa (Husband)", joinDate: "2023-02-11", status: "active" },
    { id: uid("m"), code: "LBFG-NP-000002", name: "Hari Prasad Sharma", citizenship: "05-02-71-00456", phone: "9841000002", address: "Bhairahawa-3, Rupandehi", nominee: "Gita Sharma (Wife)", joinDate: "2023-04-02", status: "active" },
    { id: uid("m"), code: "LBFG-NP-000003", name: "Kamala Devi Gurung", citizenship: "22-03-69-00789", phone: "9841000003", address: "Lumbini-2, Rupandehi", nominee: "Suman Gurung (Son)", joinDate: "2024-01-19", status: "active" },
  ];

  const tx = []; // savings + share transactions
  const push = (memberId, type, amount, date, note) =>
    tx.push({ id: uid("t"), memberId, type, amount, date, note });

  push(members[0].id, "deposit", 5000, "2024-11-05", "Monthly saving");
  push(members[0].id, "deposit", 5000, "2024-12-05", "Monthly saving");
  push(members[0].id, "deposit", 5000, todayISO(), "Monthly saving");
  push(members[0].id, "share", 2000, "2023-02-11", "Initial share purchase");

  push(members[1].id, "deposit", 3000, "2024-12-01", "Monthly saving");
  push(members[1].id, "withdrawal", 1000, "2025-01-10", "Emergency withdrawal");
  push(members[1].id, "share", 1000, "2023-04-02", "Initial share purchase");

  push(members[2].id, "deposit", 2500, todayISO(), "Monthly saving");
  push(members[2].id, "share", 1500, "2024-01-19", "Initial share purchase");

  const loan1Start = "2025-03-01";
  const { schedule: s1, totalInterest: ti1, totalPayable: tp1 } = buildLoanSchedule(50000, 14, 12, loan1Start);
  s1[0].paid = true; s1[0].paidDate = "2025-04-01"; s1[0].paidAmount = s1[0].amount;
  s1[1].paid = true; s1[1].paidDate = "2025-05-02"; s1[1].paidAmount = s1[1].amount;

  const loans = [
    {
      id: uid("l"), memberId: members[1].id, principal: 50000, rate: 14, tenureMonths: 12, method: "flat",
      purpose: "Agriculture", appliedDate: "2025-02-20", status: "approved", startDate: loan1Start,
      approvedBy: "manager", totalInterest: ti1, totalPayable: tp1, schedule: s1,
    },
    {
      id: uid("l"), memberId: members[2].id, principal: 20000, rate: 12, tenureMonths: 6, method: "reducing",
      purpose: "Small business", appliedDate: todayISO(), status: "pending",
      approvedBy: null, totalInterest: 0, totalPayable: 0, schedule: [],
    },
  ];

  const users = [
    { id: uid("u"), username: "admin", password: "admin123", role: "admin", name: "System Admin", linkedMemberId: null },
    { id: uid("u"), username: "manager", password: "manager123", role: "manager", name: "Bimala Rana (Manager)", linkedMemberId: null },
    { id: uid("u"), username: "accountant", password: "account123", role: "accountant", name: "Deepak Koirala (Accountant)", linkedMemberId: null },
    { id: uid("u"), username: "staff", password: "staff123", role: "staff", name: "Sunita Oli (Field Staff)", linkedMemberId: null },
    { id: uid("u"), username: "member1", password: "member123", role: "member", name: members[0].name, linkedMemberId: members[0].id },
  ];

  return { members, tx, loans, users, loginLog: [] };
}

/* ============================== STORAGE HOOK ============================== */
function useOrgData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const api = async (url, options = {}) => {
    const res = await fetch(url, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    if (!res.ok) {
      let msg = "Request failed";
      try { msg = (await res.json()).error || msg; } catch {}
      throw new Error(msg);
    }
    return res.json();
  };

  useEffect(() => {
    (async () => {
      try {
        const result = await api("/api/state");
        setData(result.data);
      } catch (e) {
        setError(e.message || "Could not load online data.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (key, value) => {
    try {
      await api("/api/state", {
        method: "PUT",
        body: JSON.stringify({ key, value }),
      });
    } catch (e) {
      setError(e.message || "Could not save online data.");
      throw e;
    }
  }, []);

  return { data, setData, loading, error, persist };
}

/* ============================== SMALL UI PARTS ============================== */
function Btn({ children, onClick, variant = "primary", icon: Icon, type = "button", disabled, className = "" }) {
  const styles = {
    primary: { background: C.navy, color: "#fff" },
    gold: { background: C.gold, color: "#fff" },
    ghost: { background: "transparent", color: C.navy, border: `1px solid ${C.line}` },
    danger: { background: C.red, color: "#fff" },
    subtle: { background: C.paperDim, color: C.ink },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      style={styles[variant]}
    >
      {Icon && <Icon size={15} />}
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs font-semibold mb-1 tracking-wide" style={{ color: C.slate }}>{label}</span>
      {children}
    </label>
  );
}
const inputCls = "w-full px-3 py-2 rounded-md text-sm outline-none border focus:ring-2";
const inputStyle = { borderColor: C.line, background: "#fff" };

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,27,48,0.55)" }}>
      <div className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-lg shadow-2xl max-h-[90vh] overflow-y-auto`} style={{ background: C.card }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: C.line }}>
          <h3 className="font-semibold text-base" style={{ color: C.ink }}>{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:opacity-70"><X size={18} color={C.slate} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, tint }) {
  return (
    <div className="rounded-lg p-4 flex items-start justify-between" style={{ background: C.card, border: `1px solid ${C.line}` }}>
      <div>
        <div className="text-xs font-medium mb-1" style={{ color: C.slate }}>{label}</div>
        <div className="text-xl font-bold" style={{ color: C.ink }}>{value}</div>
      </div>
      <div className="p-2 rounded-md" style={{ background: tint + "22" }}>
        <Icon size={18} color={tint} />
      </div>
    </div>
  );
}

function Avatar({ name, photo, size = 32 }) {
  if (photo) {
    return <img src={photo} alt={name} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div className="rounded-full flex items-center justify-center font-bold text-white" style={{ width: size, height: size, background: C.navy, fontSize: size * 0.35 }}>
      {initials(name)}
    </div>
  );
}
function OrgLogo({ logo, size = 36, radius = 10 }) {
  if (logo) {
    return <img src={logo} alt="Organization logo" className="object-cover" style={{ width: size, height: size, borderRadius: radius }} />;
  }
  return (
    <div className="flex items-center justify-center" style={{ width: size, height: size, borderRadius: radius, background: C.gold }}>
      <ShieldCheck size={Math.round(size * 0.55)} color="#fff" />
    </div>
  );
}
function Badge({ children, tone = "slate" }) {
  const map = {
    slate: { bg: "#EEF0F3", fg: C.slate },
    green: { bg: C.greenBg, fg: C.green },
    red: { bg: C.redBg, fg: C.red },
    amber: { bg: C.amberBg, fg: C.amber },
  };
  const s = map[tone];
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: s.bg, color: s.fg }}>{children}</span>;
}

function exportExcel(rows, filename, sheetName = "Sheet1") {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : filename + ".xlsx");
}

/* ============================== LOGIN SCREEN ============================== */
function LoginScreen({ users, onLogin, orgLogo }) {
  const [role, setRole] = useState("admin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password, role }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Login failed.");
      onLogin(body.user);
    } catch (e) {
      setErr(e.message || "Login failed.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: `linear-gradient(160deg, ${C.navyDeep}, ${C.navy})` }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3">
            <OrgLogo logo={orgLogo} size={56} radius={14} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">LBFG Cooperative</h1>
          <p className="text-sm" style={{ color: "#C7CEDC" }}>Digital Management System</p>
        </div>

        <div className="rounded-xl p-5 shadow-2xl" style={{ background: C.card }}>
          <div className="grid grid-cols-5 gap-1 mb-5 p-1 rounded-lg" style={{ background: C.paperDim }}>
            {ROLES.map((r) => (
              <button
                key={r}
                onClick={() => { setRole(r); setErr(""); }}
                className="py-1.5 rounded-md text-[11px] font-semibold transition-colors"
                style={role === r ? { background: C.navy, color: "#fff" } : { color: C.slate }}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>

          <form onSubmit={submit}>
            <Field label="Username">
              <input className={inputCls} style={inputStyle} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. admin" autoFocus />
            </Field>
            <Field label="Password">
              <div className="relative">
                <input type={showPw ? "text" : "password"} className={inputCls} style={inputStyle} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-2 top-2 opacity-60">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
            {err && (
              <div className="flex items-center gap-1.5 text-xs mb-3 px-2 py-1.5 rounded" style={{ background: C.redBg, color: C.red }}>
                <AlertTriangle size={13} /> {err}
              </div>
            )}
            <Btn type="submit" className="w-full justify-center" variant="gold">Log in as {ROLE_LABEL[role]}</Btn>
          </form>

          <div className="mt-4 pt-4 border-t text-[11px] leading-relaxed" style={{ borderColor: C.line, color: C.slate }}>
            Demo credentials — Admin: admin / admin123 · Manager: manager / manager123 · Accountant: accountant / account123 · Staff: staff / staff123 · Member: member1 / member123
          </div>
        </div>
        <p className="text-center text-[11px] mt-4" style={{ color: "#8D97AC" }}>Data is shared across everyone using this app instance.</p>
      </div>
    </div>
  );
}

/* ============================== DASHBOARD ============================== */
function Dashboard({ members, tx, loans }) {
  const totalSavings = useMemo(() => tx.filter((t) => t.type === "deposit").reduce((s, t) => s + t.amount, 0) - tx.filter((t) => t.type === "withdrawal").reduce((s, t) => s + t.amount, 0), [tx]);
  const totalShares = useMemo(() => tx.filter((t) => t.type === "share").reduce((s, t) => s + t.amount, 0), [tx]);
  const approvedLoans = loans.filter((l) => l.status === "approved");
  const totalDisbursed = approvedLoans.reduce((s, l) => s + l.principal, 0);
  const outstanding = approvedLoans.reduce((s, l) => s + loanOutstanding(l), 0);
  const today = todayISO();
  const todaysCollection = tx.filter((t) => t.date === today && t.type !== "withdrawal").reduce((s, t) => s + t.amount, 0)
    + approvedLoans.flatMap((l) => l.schedule).filter((i) => i.paid && i.paidDate === today).reduce((s, i) => s + i.paidAmount, 0);
  const thisMonth = today.slice(0, 7);
  const monthlyCollection = tx.filter((t) => monthKey(t.date) === thisMonth && t.type !== "withdrawal").reduce((s, t) => s + t.amount, 0)
    + approvedLoans.flatMap((l) => l.schedule).filter((i) => i.paid && monthKey(i.paidDate) === thisMonth).reduce((s, i) => s + i.paidAmount, 0);
  const interestIncome = approvedLoans.flatMap((l) => l.schedule).filter((i) => i.paid).reduce((s, i, idx, arr) => s + 0, 0);
  const interestEarned = approvedLoans.reduce((s, l) => {
    const paidCount = l.schedule.filter((i) => i.paid).length;
    return s + (l.totalInterest / (l.tenureMonths || 1)) * paidCount;
  }, 0);
  const overdueList = approvedLoans.flatMap((l) => l.schedule.filter(isOverdue).map((i) => ({ ...i, loan: l })));
  const pendingLoans = loans.filter((l) => l.status === "pending").length;

  return (
    <div>
      <h2 className="text-lg font-bold mb-4" style={{ color: C.ink }}>Overview</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="Total Members" value={members.length} icon={Users} tint={C.navy} />
        <Stat label="Total Savings" value={fmtMoney(totalSavings)} icon={PiggyBank} tint={C.green} />
        <Stat label="Total Shares" value={fmtMoney(totalShares)} icon={Coins} tint={C.gold} />
        <Stat label="Loans Disbursed" value={fmtMoney(totalDisbursed)} icon={Landmark} tint={C.navy} />
        <Stat label="Outstanding Loans" value={fmtMoney(outstanding)} icon={Wallet} tint={C.red} />
        <Stat label="Today's Collection" value={fmtMoney(todaysCollection)} icon={ArrowDownCircle} tint={C.green} />
        <Stat label="Monthly Collection" value={fmtMoney(monthlyCollection)} icon={TrendingUp} tint={C.green} />
        <Stat label="Overdue Installments" value={overdueList.length} icon={AlertTriangle} tint={C.red} />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-lg p-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm" style={{ color: C.ink }}>Income snapshot</h3>
            <TrendingUp size={16} color={C.green} />
          </div>
          <div className="flex justify-between text-sm py-1.5 border-b" style={{ borderColor: C.line }}>
            <span style={{ color: C.slate }}>Interest earned (collected)</span>
            <span className="font-semibold" style={{ color: C.ink }}>{fmtMoney(interestEarned)}</span>
          </div>
          <div className="flex justify-between text-sm py-1.5 border-b" style={{ borderColor: C.line }}>
            <span style={{ color: C.slate }}>Principal disbursed (approved loans)</span>
            <span className="font-semibold" style={{ color: C.ink }}>{fmtMoney(totalDisbursed)}</span>
          </div>
          <div className="flex justify-between text-sm py-1.5">
            <span style={{ color: C.slate }}>Loan applications pending approval</span>
            <span className="font-semibold" style={{ color: C.amber }}>{pendingLoans}</span>
          </div>
        </div>

        <div className="rounded-lg p-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm" style={{ color: C.ink }}>Overdue loan installments</h3>
            <AlertTriangle size={16} color={C.red} />
          </div>
          {overdueList.length === 0 ? (
            <p className="text-sm" style={{ color: C.slate }}>No overdue installments. All accounts are current.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {overdueList.slice(0, 6).map((i) => (
                <div key={i.id} className="flex justify-between text-sm">
                  <span style={{ color: C.ink }}>Installment #{i.no} · due {fmtDate(i.dueDate)}</span>
                  <span className="font-semibold" style={{ color: C.red }}>{fmtMoney(i.amount + fineFor(i))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================== MEMBERS ============================== */
function MembersPage({ members, setMembers, canEdit }) {
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null); // {mode:'new'|'edit', member}

  const filtered = members.filter((m) => (m.name + m.code + m.phone).toLowerCase().includes(q.toLowerCase()));

  const save = (form) => {
    if (modal.mode === "new") {
      setMembers([...members, { ...form, id: uid("m"), code: memberCode(members), joinDate: todayISO(), status: "active" }]);
    } else {
      setMembers(members.map((m) => (m.id === modal.member.id ? { ...m, ...form } : m)));
    }
    setModal(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-bold" style={{ color: C.ink }}>Members</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5" color={C.slate} />
            <input className={inputCls + " pl-8"} style={{ ...inputStyle, width: 220 }} placeholder="Search members…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {canEdit && <Btn icon={Plus} onClick={() => setModal({ mode: "new" })}>Add member</Btn>}
        </div>
      </div>

      <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: C.paperDim }}>
              {["Member", "ID", "Phone", "Citizenship No.", "Nominee", "Joined", ""].map((h) => (
                <th key={h} className="text-left px-3 py-2 font-semibold text-xs" style={{ color: C.slate }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className="border-t" style={{ borderColor: C.line }}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Avatar name={m.name} photo={m.photo} size={32} />
                    <span style={{ color: C.ink }}>{m.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-xs" style={{ color: C.slate }}>{m.code}</td>
                <td className="px-3 py-2" style={{ color: C.ink }}>{m.phone}</td>
                <td className="px-3 py-2" style={{ color: C.ink }}>{m.citizenship}</td>
                <td className="px-3 py-2" style={{ color: C.ink }}>{m.nominee}</td>
                <td className="px-3 py-2" style={{ color: C.slate }}>{fmtDate(m.joinDate)}</td>
                <td className="px-3 py-2 text-right">
                  {canEdit && <button onClick={() => setModal({ mode: "edit", member: m })} className="text-xs font-semibold" style={{ color: C.navy }}>Edit</button>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-6 text-sm" style={{ color: C.slate }}>No members found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && <MemberForm modal={modal} onSave={save} onClose={() => setModal(null)} />}
    </div>
  );
}

function MemberForm({ modal, onSave, onClose }) {
  const m = modal.member || {};
  const [form, setForm] = useState({
    name: m.name || "", citizenship: m.citizenship || "", phone: m.phone || "",
    address: m.address || "", nominee: m.nominee || "", photo: m.photo || "",
  });
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onPhotoPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setPhotoErr("Please choose an image file."); return; }
    setPhotoErr(""); setPhotoBusy(true);
    try {
      const dataUrl = await resizePhoto(file, 220);
      setForm((f) => ({ ...f, photo: dataUrl }));
    } catch {
      setPhotoErr("Could not process that photo — please try another.");
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
    <Modal title={modal.mode === "new" ? "Add new member" : "Edit member"} onClose={onClose}>
      <div className="flex items-center gap-3 mb-4">
        <Avatar name={form.name || "?"} photo={form.photo} size={56} />
        <div>
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer" style={{ background: C.paperDim, color: C.ink }}>
            {photoBusy ? "Processing…" : form.photo ? "Change photo" : "Upload photo"}
            <input type="file" accept="image/*" className="hidden" onChange={onPhotoPick} disabled={photoBusy} />
          </label>
          {form.photo && (
            <button type="button" onClick={() => setForm({ ...form, photo: "" })} className="ml-2 text-xs font-semibold" style={{ color: C.red }}>Remove</button>
          )}
          {photoErr && <div className="text-[11px] mt-1" style={{ color: C.red }}>{photoErr}</div>}
        </div>
      </div>
      <Field label="Full name"><input className={inputCls} style={inputStyle} value={form.name} onChange={set("name")} /></Field>
      <Field label="Citizenship number"><input className={inputCls} style={inputStyle} value={form.citizenship} onChange={set("citizenship")} /></Field>
      <Field label="Phone"><input className={inputCls} style={inputStyle} value={form.phone} onChange={set("phone")} /></Field>
      <Field label="Address"><input className={inputCls} style={inputStyle} value={form.address} onChange={set("address")} /></Field>
      <Field label="Family / Nominee details"><input className={inputCls} style={inputStyle} value={form.nominee} onChange={set("nominee")} placeholder="Name (Relation)" /></Field>
      <div className="flex justify-end gap-2 mt-2">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => form.name.trim() && onSave(form)}>Save member</Btn>
      </div>
    </Modal>
  );
}

/* ============================== SAVINGS & SHARES ============================== */
function MoneyPage({ title, type, members, tx, setTx, canEdit }) {
  const [memberId, setMemberId] = useState(members[0]?.id || "");
  const [modal, setModal] = useState(false);

  const list = tx.filter((t) => t.type === (type === "savings" ? undefined : "share")).filter(Boolean);
  const relevant = type === "savings" ? tx.filter((t) => t.type === "deposit" || t.type === "withdrawal") : tx.filter((t) => t.type === "share");
  const balanceFor = (mid) => {
    const rows = relevant.filter((t) => t.memberId === mid);
    if (type === "savings") return rows.reduce((s, t) => s + (t.type === "deposit" ? t.amount : -t.amount), 0);
    return rows.reduce((s, t) => s + t.amount, 0);
  };

  const addEntry = (form) => {
    setTx([...tx, { id: uid("t"), memberId: form.memberId, type: type === "savings" ? form.kind : "share", amount: Number(form.amount), date: form.date, note: form.note }]);
    setModal(false);
  };

  const sorted = [...relevant].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-bold" style={{ color: C.ink }}>{title}</h2>
        {canEdit && <Btn icon={Plus} onClick={() => setModal(true)}>New entry</Btn>}
      </div>

      <div className="grid md:grid-cols-3 gap-3 mb-4">
        {members.map((m) => (
          <div key={m.id} className="rounded-lg p-3 flex items-center justify-between" style={{ background: C.card, border: `1px solid ${C.line}` }}>
            <div>
              <div className="text-sm font-semibold" style={{ color: C.ink }}>{m.name}</div>
              <div className="text-xs" style={{ color: C.slate }}>{m.code}</div>
            </div>
            <div className="text-sm font-bold" style={{ color: C.green }}>{fmtMoney(balanceFor(m.id))}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: C.paperDim }}>
              {["Date", "Member", "Type", "Amount", "Note"].map((h) => (
                <th key={h} className="text-left px-3 py-2 font-semibold text-xs" style={{ color: C.slate }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => {
              const mm = members.find((m) => m.id === t.memberId);
              return (
                <tr key={t.id} className="border-t" style={{ borderColor: C.line }}>
                  <td className="px-3 py-2" style={{ color: C.slate }}>{fmtDate(t.date)}</td>
                  <td className="px-3 py-2" style={{ color: C.ink }}>{mm?.name || "—"}</td>
                  <td className="px-3 py-2">
                    <Badge tone={t.type === "withdrawal" ? "red" : "green"}>{t.type}</Badge>
                  </td>
                  <td className="px-3 py-2 font-semibold" style={{ color: t.type === "withdrawal" ? C.red : C.green }}>
                    {t.type === "withdrawal" ? "-" : "+"}{fmtMoney(t.amount)}
                  </td>
                  <td className="px-3 py-2" style={{ color: C.slate }}>{t.note}</td>
                </tr>
              );
            })}
            {sorted.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-sm" style={{ color: C.slate }}>No entries yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={`New ${type === "savings" ? "savings" : "share"} entry`} onClose={() => setModal(false)}>
          <EntryForm type={type} members={members} onSave={addEntry} onClose={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}

function EntryForm({ type, members, onSave, onClose }) {
  const [form, setForm] = useState({ memberId: members[0]?.id || "", kind: "deposit", amount: "", date: todayISO(), note: "" });
  return (
    <div>
      <Field label="Member">
        <select className={inputCls} style={inputStyle} value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })}>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
        </select>
      </Field>
      {type === "savings" && (
        <Field label="Entry type">
          <div className="flex gap-2">
            {["deposit", "withdrawal"].map((k) => (
              <button key={k} onClick={() => setForm({ ...form, kind: k })} className="flex-1 py-2 rounded-md text-sm font-semibold border" style={form.kind === k ? { background: C.navy, color: "#fff", borderColor: C.navy } : { color: C.ink, borderColor: C.line }}>
                {k === "deposit" ? "Deposit" : "Withdrawal"}
              </button>
            ))}
          </div>
        </Field>
      )}
      <Field label="Amount (Rs.)"><input type="number" className={inputCls} style={inputStyle} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
      <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
      <Field label="Note"><input className={inputCls} style={inputStyle} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
      <div className="flex justify-end gap-2 mt-2">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => form.amount && onSave(form)}>Save entry</Btn>
      </div>
    </div>
  );
}

/* ============================== LOANS ============================== */
function LoansPage({ members, loans, setLoans, tx, setTx, canApprove, canApply }) {
  const [applyModal, setApplyModal] = useState(false);
  const [repayModal, setRepayModal] = useState(null); // {loan, inst}

  const apply = (form) => {
    setLoans([...loans, {
      id: uid("l"), memberId: form.memberId, principal: Number(form.principal), rate: Number(form.rate),
      tenureMonths: Number(form.tenureMonths), method: form.method, purpose: form.purpose, appliedDate: todayISO(),
      status: "pending", approvedBy: null, totalInterest: 0, totalPayable: 0, schedule: [],
    }]);
    setApplyModal(false);
  };

  const decide = (loan, approve) => {
    if (approve) {
      const { schedule, totalInterest, totalPayable } = buildSchedule(loan.method || "flat", loan.principal, loan.rate, loan.tenureMonths, todayISO());
      setLoans(loans.map((l) => (l.id === loan.id ? { ...l, status: "approved", startDate: todayISO(), schedule, totalInterest, totalPayable } : l)));
    } else {
      setLoans(loans.map((l) => (l.id === loan.id ? { ...l, status: "rejected" } : l)));
    }
  };

  const recordRepayment = (loan, inst, extra) => {
    const fine = fineFor(inst);
    const paidAmount = inst.amount + fine;
    const updatedSchedule = loan.schedule.map((i) => i.id === inst.id ? { ...i, paid: true, paidDate: todayISO(), paidAmount, fineCollected: fine } : i);
    setLoans(loans.map((l) => (l.id === loan.id ? { ...l, schedule: updatedSchedule } : l)));
    setTx([...tx, { id: uid("t"), memberId: loan.memberId, type: "loan-repayment", amount: paidAmount, date: todayISO(), note: `Installment #${inst.no}${fine ? " incl. late fine" : ""}` }]);
    setRepayModal(null);
  };

  const statusTone = { pending: "amber", approved: "green", rejected: "red", closed: "slate" };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-bold" style={{ color: C.ink }}>Loans</h2>
        {canApply && <Btn icon={Plus} onClick={() => setApplyModal(true)}>New loan application</Btn>}
      </div>

      <div className="space-y-3">
        {loans.map((l) => {
          const m = members.find((mm) => mm.id === l.memberId);
          const outstanding = loanOutstanding(l);
          const overdueCount = (l.schedule || []).filter(isOverdue).length;
          return (
            <div key={l.id} className="rounded-lg p-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <div>
                  <div className="font-semibold text-sm" style={{ color: C.ink }}>{m?.name} <span className="font-normal" style={{ color: C.slate }}>· {m?.code}</span></div>
                  <div className="text-xs" style={{ color: C.slate }}>{l.purpose} · applied {fmtDate(l.appliedDate)}</div>
                </div>
                <div className="flex items-center gap-2">
                  {overdueCount > 0 && <Badge tone="red">{overdueCount} overdue</Badge>}
                  <Badge tone="slate">{l.method === "reducing" ? "Reducing balance" : "Flat rate"}</Badge>
                  <Badge tone={statusTone[l.status]}>{l.status}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-2">
                <div><span style={{ color: C.slate }}>Principal: </span><span className="font-semibold" style={{ color: C.ink }}>{fmtMoney(l.principal)}</span></div>
                <div><span style={{ color: C.slate }}>Rate: </span><span className="font-semibold" style={{ color: C.ink }}>{l.rate}% p.a.</span></div>
                <div><span style={{ color: C.slate }}>Tenure: </span><span className="font-semibold" style={{ color: C.ink }}>{l.tenureMonths} months</span></div>
                <div><span style={{ color: C.slate }}>Outstanding: </span><span className="font-semibold" style={{ color: C.red }}>{fmtMoney(outstanding)}</span></div>
              </div>

              {l.status === "pending" && canApprove && (
                <div className="flex gap-2 mt-2">
                  <Btn variant="primary" icon={Check} onClick={() => decide(l, true)}>Approve</Btn>
                  <Btn variant="danger" icon={X} onClick={() => decide(l, false)}>Reject</Btn>
                </div>
              )}

              {l.status === "approved" && (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ color: C.slate }}>
                        <th className="text-left py-1">#</th><th className="text-left py-1">Due</th><th className="text-left py-1">Amount</th><th className="text-left py-1">Status</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {l.schedule.map((i) => (
                        <tr key={i.id} className="border-t" style={{ borderColor: C.line }}>
                          <td className="py-1" style={{ color: C.ink }}>{i.no}</td>
                          <td className="py-1" style={{ color: C.ink }}>{fmtDate(i.dueDate)}</td>
                          <td className="py-1" style={{ color: C.ink }}>{fmtMoney(i.amount)}{isOverdue(i) ? ` + ${fmtMoney(fineFor(i))} fine` : ""}</td>
                          <td className="py-1">
                            {i.paid ? <Badge tone="green">paid {fmtDate(i.paidDate)}</Badge> : isOverdue(i) ? <Badge tone="red">overdue</Badge> : <Badge tone="slate">upcoming</Badge>}
                          </td>
                          <td className="py-1 text-right">
                            {!i.paid && canApprove && <button className="text-xs font-semibold" style={{ color: C.navy }} onClick={() => setRepayModal({ loan: l, inst: i })}>Record payment</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
        {loans.length === 0 && <p className="text-sm" style={{ color: C.slate }}>No loan records yet.</p>}
      </div>

      {applyModal && <LoanApplyForm members={members} onSave={apply} onClose={() => setApplyModal(false)} />}
      {repayModal && (
        <Modal title={`Record repayment — Installment #${repayModal.inst.no}`} onClose={() => setRepayModal(null)}>
          <p className="text-sm mb-3" style={{ color: C.ink }}>
            Due {fmtDate(repayModal.inst.dueDate)} · Amount {fmtMoney(repayModal.inst.amount)}
            {isOverdue(repayModal.inst) && <span style={{ color: C.red }}> + {fmtMoney(fineFor(repayModal.inst))} late fine</span>}
          </p>
          <p className="text-sm font-semibold mb-4" style={{ color: C.ink }}>
            Total to collect: {fmtMoney(repayModal.inst.amount + fineFor(repayModal.inst))}
          </p>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setRepayModal(null)}>Cancel</Btn>
            <Btn onClick={() => recordRepayment(repayModal.loan, repayModal.inst)}>Confirm payment received</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function LoanApplyForm({ members, onSave, onClose }) {
  const [form, setForm] = useState({ memberId: members[0]?.id || "", principal: "", rate: "12", tenureMonths: "12", purpose: "", method: "flat" });

  const preview = useMemo(() => {
    const p = Number(form.principal), r = Number(form.rate), n = Number(form.tenureMonths);
    if (!p || !r || !n) return null;
    const { totalInterest, totalPayable } = buildSchedule(form.method, p, r, n, todayISO());
    return { totalInterest, totalPayable, emi: Math.round((totalPayable / n) * 100) / 100 };
  }, [form.principal, form.rate, form.tenureMonths, form.method]);

  return (
    <Modal title="New loan application" onClose={onClose}>
      <Field label="Member">
        <select className={inputCls} style={inputStyle} value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })}>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
        </select>
      </Field>
      <Field label="Calculation method">
        <div className="flex gap-2">
          {[["flat", "Flat rate"], ["reducing", "Reducing balance"]].map(([k, label]) => (
            <button key={k} type="button" onClick={() => setForm({ ...form, method: k })} className="flex-1 py-2 rounded-md text-sm font-semibold border" style={form.method === k ? { background: C.navy, color: "#fff", borderColor: C.navy } : { color: C.ink, borderColor: C.line }}>
              {label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Loan amount (Rs.)"><input type="number" className={inputCls} style={inputStyle} value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} /></Field>
      <Field label="Interest rate (% per annum)"><input type="number" className={inputCls} style={inputStyle} value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} /></Field>
      <Field label="Tenure (months)"><input type="number" className={inputCls} style={inputStyle} value={form.tenureMonths} onChange={(e) => setForm({ ...form, tenureMonths: e.target.value })} /></Field>
      <Field label="Purpose"><input className={inputCls} style={inputStyle} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></Field>

      {preview && (
        <div className="rounded-md p-3 mb-3 text-xs" style={{ background: C.paperDim }}>
          <div className="flex justify-between py-0.5"><span style={{ color: C.slate }}>Monthly installment (EMI)</span><span className="font-semibold" style={{ color: C.ink }}>{fmtMoney(preview.emi)}</span></div>
          <div className="flex justify-between py-0.5"><span style={{ color: C.slate }}>Total interest payable</span><span className="font-semibold" style={{ color: C.ink }}>{fmtMoney(preview.totalInterest)}</span></div>
          <div className="flex justify-between py-0.5"><span style={{ color: C.slate }}>Total repayable</span><span className="font-semibold" style={{ color: C.ink }}>{fmtMoney(preview.totalPayable)}</span></div>
        </div>
      )}

      <div className="flex justify-end gap-2 mt-2">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => form.principal && onSave(form)}>Submit application</Btn>
      </div>
    </Modal>
  );
}

/* ============================== REPORTS ============================== */
function ReportsPage({ members, tx, loans, orgLogo }) {
  const [tab, setTab] = useState("statement");
  const [memberId, setMemberId] = useState(members[0]?.id || "");
  const [date, setDate] = useState(todayISO());
  const [month, setMonth] = useState(todayISO().slice(0, 7));

  const tabs = [
    { k: "statement", label: "Member statement" },
    { k: "daily", label: "Daily collection" },
    { k: "monthly", label: "Monthly report" },
    { k: "loan", label: "Loan report" },
    { k: "savings", label: "Savings report" },
    { k: "cashbook", label: "Cashbook" },
  ];

  const repaymentsAsTx = () =>
    loans.flatMap((l) => l.schedule.filter((i) => i.paid).map((i) => ({ id: i.id, memberId: l.memberId, type: "loan-repayment", amount: i.paidAmount, date: i.paidDate, note: `Installment #${i.no}` })));

  const allTx = [...tx, ...repaymentsAsTx()];

  const memberRows = allTx.filter((t) => t.memberId === memberId).sort((a, b) => (a.date < b.date ? -1 : 1));
  const dailyRows = allTx.filter((t) => t.date === date);
  const monthlyRows = allTx.filter((t) => monthKey(t.date) === month);
  const cashbookRows = [...allTx].sort((a, b) => (a.date < b.date ? 1 : -1));

  const nameOf = (mid) => members.find((m) => m.id === mid)?.name || "—";
  const codeOf = (mid) => members.find((m) => m.id === mid)?.code || "—";

  const buildExportRows = (rows) => rows.map((t) => ({
    Date: fmtDate(t.date), Member: nameOf(t.memberId), "Member ID": codeOf(t.memberId),
    Type: t.type, Amount: t.amount, Note: t.note || "",
  }));

  return (
    <div>
      <h2 className="text-lg font-bold mb-4" style={{ color: C.ink }}>Reports</h2>
      <div className="no-print flex gap-1 mb-4 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className="px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap" style={tab === t.k ? { background: C.navy, color: "#fff" } : { background: C.paperDim, color: C.ink }}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg p-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
        {tab === "statement" && (
          <>
            <div className="no-print flex items-center gap-2 mb-3 flex-wrap">
              <select className={inputCls} style={{ ...inputStyle, width: 260 }} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
              </select>
              <Btn variant="subtle" icon={Download} onClick={() => exportExcel(buildExportRows(memberRows), `${codeOf(memberId)}-statement`)}>Export Excel</Btn>
              <Btn variant="subtle" icon={Printer} onClick={() => window.print()}>Print passbook slip</Btn>
            </div>
            <div className="no-print">
              <ReportTable rows={memberRows} nameOf={nameOf} showMember={false} />
            </div>
            <div className="print-only">
              <PassbookSlip member={members.find((m) => m.id === memberId)} tx={tx} loans={loans} orgLogo={orgLogo} />
            </div>
          </>
        )}
        {tab === "daily" && (
          <>
            <div className="no-print flex items-center gap-2 mb-3 flex-wrap">
              <input type="date" className={inputCls} style={{ ...inputStyle, width: 180 }} value={date} onChange={(e) => setDate(e.target.value)} />
              <Btn variant="subtle" icon={Download} onClick={() => exportExcel(buildExportRows(dailyRows), `daily-collection-${date}`)}>Export Excel</Btn>
              <Btn variant="subtle" icon={Printer} onClick={() => window.print()}>Print / Save PDF</Btn>
            </div>
            <ReportTable rows={dailyRows} nameOf={nameOf} showMember />
          </>
        )}
        {tab === "monthly" && (
          <>
            <div className="no-print flex items-center gap-2 mb-3 flex-wrap">
              <input type="month" className={inputCls} style={{ ...inputStyle, width: 180 }} value={month} onChange={(e) => setMonth(e.target.value)} />
              <Btn variant="subtle" icon={Download} onClick={() => exportExcel(buildExportRows(monthlyRows), `monthly-report-${month}`)}>Export Excel</Btn>
              <Btn variant="subtle" icon={Printer} onClick={() => window.print()}>Print / Save PDF</Btn>
            </div>
            <ReportTable rows={monthlyRows} nameOf={nameOf} showMember />
          </>
        )}
        {tab === "loan" && (
          <>
            <div className="no-print flex items-center gap-2 mb-3 flex-wrap">
              <Btn variant="subtle" icon={Download} onClick={() => exportExcel(loans.map((l) => ({
                Member: nameOf(l.memberId), "Member ID": codeOf(l.memberId), Method: l.method === "reducing" ? "Reducing balance" : "Flat rate",
                Principal: l.principal, Rate: l.rate + "%", Tenure: l.tenureMonths + "mo", Status: l.status,
                Applied: fmtDate(l.appliedDate), Outstanding: loanOutstanding(l),
              })), "loan-report")}>Export Excel</Btn>
              <Btn variant="subtle" icon={Printer} onClick={() => window.print()}>Print / Save PDF</Btn>
            </div>
            <table className="w-full text-sm">
              <thead><tr style={{ background: C.paperDim }}>{["Member", "Method", "Principal", "Rate", "Tenure", "Status", "Outstanding"].map((h) => <th key={h} className="text-left px-2 py-2 text-xs font-semibold" style={{ color: C.slate }}>{h}</th>)}</tr></thead>
              <tbody>
                {loans.map((l) => (
                  <tr key={l.id} className="border-t" style={{ borderColor: C.line }}>
                    <td className="px-2 py-2" style={{ color: C.ink }}>{nameOf(l.memberId)}</td>
                    <td className="px-2 py-2" style={{ color: C.ink }}>{l.method === "reducing" ? "Reducing balance" : "Flat rate"}</td>
                    <td className="px-2 py-2" style={{ color: C.ink }}>{fmtMoney(l.principal)}</td>
                    <td className="px-2 py-2" style={{ color: C.ink }}>{l.rate}%</td>
                    <td className="px-2 py-2" style={{ color: C.ink }}>{l.tenureMonths} mo</td>
                    <td className="px-2 py-2"><Badge tone={l.status === "approved" ? "green" : l.status === "pending" ? "amber" : "red"}>{l.status}</Badge></td>
                    <td className="px-2 py-2 font-semibold" style={{ color: C.red }}>{fmtMoney(loanOutstanding(l))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {tab === "savings" && (
          <>
            <div className="no-print flex items-center gap-2 mb-3 flex-wrap">
              <Btn variant="subtle" icon={Download} onClick={() => exportExcel(buildExportRows(tx.filter((t) => t.type === "deposit" || t.type === "withdrawal")), "savings-report")}>Export Excel</Btn>
              <Btn variant="subtle" icon={Printer} onClick={() => window.print()}>Print / Save PDF</Btn>
            </div>
            <ReportTable rows={tx.filter((t) => t.type === "deposit" || t.type === "withdrawal")} nameOf={nameOf} showMember />
          </>
        )}
        {tab === "cashbook" && (
          <>
            <div className="no-print flex items-center gap-2 mb-3 flex-wrap">
              <Btn variant="subtle" icon={Download} onClick={() => exportExcel(buildExportRows(cashbookRows), "cashbook")}>Export Excel</Btn>
              <Btn variant="subtle" icon={Printer} onClick={() => window.print()}>Print / Save PDF</Btn>
            </div>
            <ReportTable rows={cashbookRows} nameOf={nameOf} showMember />
          </>
        )}
      </div>
    </div>
  );
}

function ReportTable({ rows, nameOf, showMember }) {
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: C.paperDim }}>
            <th className="text-left px-2 py-2 text-xs font-semibold" style={{ color: C.slate }}>Date</th>
            {showMember && <th className="text-left px-2 py-2 text-xs font-semibold" style={{ color: C.slate }}>Member</th>}
            <th className="text-left px-2 py-2 text-xs font-semibold" style={{ color: C.slate }}>Type</th>
            <th className="text-left px-2 py-2 text-xs font-semibold" style={{ color: C.slate }}>Amount</th>
            <th className="text-left px-2 py-2 text-xs font-semibold" style={{ color: C.slate }}>Note</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <tr key={t.id} className="border-t" style={{ borderColor: C.line }}>
              <td className="px-2 py-2" style={{ color: C.slate }}>{fmtDate(t.date)}</td>
              {showMember && <td className="px-2 py-2" style={{ color: C.ink }}>{nameOf(t.memberId)}</td>}
              <td className="px-2 py-2"><Badge tone={t.type === "withdrawal" ? "red" : "green"}>{t.type}</Badge></td>
              <td className="px-2 py-2 font-semibold" style={{ color: t.type === "withdrawal" ? C.red : C.green }}>{t.type === "withdrawal" ? "-" : "+"}{fmtMoney(t.amount)}</td>
              <td className="px-2 py-2" style={{ color: C.slate }}>{t.note}</td>
            </tr>
          ))}
          {sorted.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-sm" style={{ color: C.slate }}>No records for this selection.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ============================== PASSBOOK SLIP (print) ============================== */
function PassbookSlip({ member, tx, loans, orgLogo }) {
  const rows = tx.filter((t) => t.memberId === member.id).sort((a, b) => (a.date < b.date ? -1 : 1));
  const savingsBal = tx.filter((t) => t.memberId === member.id && (t.type === "deposit" || t.type === "withdrawal")).reduce((s, t) => s + (t.type === "deposit" ? t.amount : -t.amount), 0);
  const shareBal = tx.filter((t) => t.memberId === member.id && t.type === "share").reduce((s, t) => s + t.amount, 0);
  const myLoans = loans.filter((l) => l.memberId === member.id && l.status === "approved");
  let running = 0;

  return (
    <div className="slip-sheet" style={{ background: "#fff", color: C.ink, padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <div className="flex items-center justify-between pb-3 mb-3" style={{ borderBottom: `2px solid ${C.navy}` }}>
        <div className="flex items-center gap-2">
          <OrgLogo logo={orgLogo} size={36} radius={8} />
          <div>
            <div className="font-bold text-sm">LBFG Cooperative</div>
            <div className="text-[10px]" style={{ color: C.slate }}>Member Passbook Statement</div>
          </div>
        </div>
        <div className="text-right text-[10px]" style={{ color: C.slate }}>
          Generated {fmtDate(todayISO())}<br />by LBFG Digital System
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs mb-4">
        <div><span style={{ color: C.slate }}>Member name: </span><span className="font-semibold">{member.name}</span></div>
        <div><span style={{ color: C.slate }}>Member ID: </span><span className="font-semibold font-mono">{member.code}</span></div>
        <div><span style={{ color: C.slate }}>Citizenship no.: </span><span className="font-semibold">{member.citizenship || "—"}</span></div>
        <div><span style={{ color: C.slate }}>Phone: </span><span className="font-semibold">{member.phone || "—"}</span></div>
        <div><span style={{ color: C.slate }}>Joined: </span><span className="font-semibold">{fmtDate(member.joinDate)}</span></div>
        <div><span style={{ color: C.slate }}>Nominee: </span><span className="font-semibold">{member.nominee || "—"}</span></div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="rounded p-2 text-center" style={{ background: C.paperDim }}>
          <div className="text-[10px]" style={{ color: C.slate }}>Savings balance</div>
          <div className="font-bold text-sm">{fmtMoney(savingsBal)}</div>
        </div>
        <div className="rounded p-2 text-center" style={{ background: C.paperDim }}>
          <div className="text-[10px]" style={{ color: C.slate }}>Share balance</div>
          <div className="font-bold text-sm">{fmtMoney(shareBal)}</div>
        </div>
      </div>

      {myLoans.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-bold mb-1">Active loans</div>
          <table className="w-full text-[11px]" style={{ borderCollapse: "collapse" }}>
            <thead><tr>{["Principal", "Method", "Rate", "Tenure", "Outstanding"].map((h) => <th key={h} className="text-left py-1" style={{ borderBottom: `1px solid ${C.line}`, color: C.slate }}>{h}</th>)}</tr></thead>
            <tbody>
              {myLoans.map((l) => (
                <tr key={l.id}>
                  <td className="py-1" style={{ borderBottom: `1px solid ${C.line}` }}>{fmtMoney(l.principal)}</td>
                  <td className="py-1" style={{ borderBottom: `1px solid ${C.line}` }}>{l.method === "reducing" ? "Reducing" : "Flat"}</td>
                  <td className="py-1" style={{ borderBottom: `1px solid ${C.line}` }}>{l.rate}%</td>
                  <td className="py-1" style={{ borderBottom: `1px solid ${C.line}` }}>{l.tenureMonths} mo</td>
                  <td className="py-1 font-semibold" style={{ borderBottom: `1px solid ${C.line}` }}>{fmtMoney(loanOutstanding(l))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs font-bold mb-1">Transaction history</div>
      <table className="w-full text-[11px]" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>{["Date", "Type", "Amount", "Balance", "Note"].map((h) => <th key={h} className="text-left py-1" style={{ borderBottom: `1px solid ${C.line}`, color: C.slate }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            if (t.type === "deposit") running += t.amount;
            else if (t.type === "withdrawal") running -= t.amount;
            return (
              <tr key={t.id}>
                <td className="py-1" style={{ borderBottom: `1px solid ${C.line}` }}>{fmtDate(t.date)}</td>
                <td className="py-1" style={{ borderBottom: `1px solid ${C.line}` }}>{t.type}</td>
                <td className="py-1" style={{ borderBottom: `1px solid ${C.line}` }}>{t.type === "withdrawal" ? "-" : "+"}{fmtMoney(t.amount)}</td>
                <td className="py-1" style={{ borderBottom: `1px solid ${C.line}` }}>{t.type === "share" ? "—" : fmtMoney(running)}</td>
                <td className="py-1" style={{ borderBottom: `1px solid ${C.line}` }}>{t.note}</td>
              </tr>
            );
          })}
          {rows.length === 0 && <tr><td colSpan={5} className="text-center py-4" style={{ color: C.slate }}>No transactions recorded.</td></tr>}
        </tbody>
      </table>

      <div className="flex justify-between mt-10 pt-4 text-[11px]" style={{ borderTop: `1px solid ${C.line}` }}>
        <div>Member signature: ______________________</div>
        <div>Authorized signature: ______________________</div>
      </div>
    </div>
  );
}

/* ============================== USERS (admin) ============================== */
function UsersPage({ users, setUsers, members }) {
  const [modal, setModal] = useState(null);
  const save = (form) => {
    if (modal.mode === "new") setUsers([...users, { ...form, id: uid("u") }]);
    else setUsers(users.map((u) => (u.id === modal.user.id ? { ...u, ...form } : u)));
    setModal(null);
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: C.ink }}>User accounts</h2>
        <Btn icon={Plus} onClick={() => setModal({ mode: "new" })}>Add user</Btn>
      </div>
      <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
        <table className="w-full text-sm">
          <thead><tr style={{ background: C.paperDim }}>{["Name", "Username", "Role", "Linked member", ""].map((h) => <th key={h} className="text-left px-3 py-2 text-xs font-semibold" style={{ color: C.slate }}>{h}</th>)}</tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t" style={{ borderColor: C.line }}>
                <td className="px-3 py-2" style={{ color: C.ink }}>{u.name}</td>
                <td className="px-3 py-2 font-mono text-xs" style={{ color: C.slate }}>{u.username}</td>
                <td className="px-3 py-2"><Badge tone="slate">{ROLE_LABEL[u.role]}</Badge></td>
                <td className="px-3 py-2" style={{ color: C.slate }}>{members.find((m) => m.id === u.linkedMemberId)?.name || "—"}</td>
                <td className="px-3 py-2 text-right"><button className="text-xs font-semibold" style={{ color: C.navy }} onClick={() => setModal({ mode: "edit", user: u })}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && <UserForm modal={modal} members={members} onSave={save} onClose={() => setModal(null)} />}
    </div>
  );
}

function UserForm({ modal, members, onSave, onClose }) {
  const u = modal.user || {};
  const [form, setForm] = useState({ name: u.name || "", username: u.username || "", password: u.password || "", role: u.role || "staff", linkedMemberId: u.linkedMemberId || "" });
  return (
    <Modal title={modal.mode === "new" ? "Add user" : "Edit user"} onClose={onClose}>
      <Field label="Full name"><input className={inputCls} style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label="Username"><input className={inputCls} style={inputStyle} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
      <Field label="Password"><input className={inputCls} style={inputStyle} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
      <Field label="Role">
        <select className={inputCls} style={inputStyle} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </Field>
      {form.role === "member" && (
        <Field label="Linked member record">
          <select className={inputCls} style={inputStyle} value={form.linkedMemberId} onChange={(e) => setForm({ ...form, linkedMemberId: e.target.value })}>
            <option value="">— none —</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
          </select>
        </Field>
      )}
      <div className="flex justify-end gap-2 mt-2">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => form.username && form.password && onSave(form)}>Save user</Btn>
      </div>
    </Modal>
  );
}

/* ============================== LOGIN HISTORY ============================== */
function LoginHistoryPage({ log }) {
  return (
    <div>
      <h2 className="text-lg font-bold mb-4" style={{ color: C.ink }}>Login activity</h2>
      <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
        <table className="w-full text-sm">
          <thead><tr style={{ background: C.paperDim }}>{["Time", "Username", "Role"].map((h) => <th key={h} className="text-left px-3 py-2 text-xs font-semibold" style={{ color: C.slate }}>{h}</th>)}</tr></thead>
          <tbody>
            {[...log].reverse().map((l) => (
              <tr key={l.id} className="border-t" style={{ borderColor: C.line }}>
                <td className="px-3 py-2" style={{ color: C.slate }}>{new Date(l.at).toLocaleString()}</td>
                <td className="px-3 py-2" style={{ color: C.ink }}>{l.username}</td>
                <td className="px-3 py-2"><Badge tone="slate">{ROLE_LABEL[l.role]}</Badge></td>
              </tr>
            ))}
            {log.length === 0 && <tr><td colSpan={3} className="text-center py-6 text-sm" style={{ color: C.slate }}>No login activity recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================== SETTINGS ============================== */
function SettingsPage({ user, users, setUsers, orgLogo, setOrgLogo }) {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [msg, setMsg] = useState("");
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoErr, setLogoErr] = useState("");

  const change = () => {
    if (oldPw !== user.password) { setMsg("Current password is incorrect."); return; }
    if (newPw.length < 4) { setMsg("New password must be at least 4 characters."); return; }
    setUsers(users.map((u) => (u.id === user.id ? { ...u, password: newPw } : u)));
    setMsg("Password updated successfully.");
    setOldPw(""); setNewPw("");
  };

  const onLogoPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setLogoErr("Please choose an image file."); return; }
    setLogoErr(""); setLogoBusy(true);
    try {
      const dataUrl = await resizePhoto(file, 300);
      setOrgLogo(dataUrl);
    } catch {
      setLogoErr("Could not process that image — please try another.");
    } finally {
      setLogoBusy(false);
    }
  };

  return (
    <div className="max-w-md">
      {user.role === "admin" && (
        <>
          <h2 className="text-lg font-bold mb-4" style={{ color: C.ink }}>Organization logo</h2>
          <div className="rounded-lg p-4 mb-6" style={{ background: C.card, border: `1px solid ${C.line}` }}>
            <div className="flex items-center gap-4 mb-2">
              <OrgLogo logo={orgLogo} size={64} radius={14} />
              <div>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer" style={{ background: C.paperDim, color: C.ink }}>
                  {logoBusy ? "Processing…" : orgLogo ? "Change logo" : "Upload logo"}
                  <input type="file" accept="image/*" className="hidden" onChange={onLogoPick} disabled={logoBusy} />
                </label>
                {orgLogo && (
                  <button type="button" onClick={() => setOrgLogo("")} className="ml-2 text-xs font-semibold" style={{ color: C.red }}>Remove</button>
                )}
              </div>
            </div>
            {logoErr && <div className="text-[11px]" style={{ color: C.red }}>{logoErr}</div>}
            <p className="text-[11px] mt-2" style={{ color: C.slate }}>Appears on the login screen, sidebar, and printed passbook slips for everyone using this system.</p>
          </div>
        </>
      )}

      <h2 className="text-lg font-bold mb-4" style={{ color: C.ink }}>Change password</h2>
      <div className="rounded-lg p-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
        <Field label="Current password"><input type="password" className={inputCls} style={inputStyle} value={oldPw} onChange={(e) => setOldPw(e.target.value)} /></Field>
        <Field label="New password"><input type="password" className={inputCls} style={inputStyle} value={newPw} onChange={(e) => setNewPw(e.target.value)} /></Field>
        {msg && <div className="text-xs mb-3 px-2 py-1.5 rounded" style={{ background: msg.includes("success") ? C.greenBg : C.redBg, color: msg.includes("success") ? C.green : C.red }}>{msg}</div>}
        <Btn icon={KeyRound} onClick={change}>Update password</Btn>
      </div>
    </div>
  );
}

/* ============================== MEMBER SELF-VIEW ============================== */
function MyPassbook({ user, members, tx, loans, orgLogo }) {
  const member = members.find((m) => m.id === user.linkedMemberId);
  if (!member) return <p style={{ color: C.slate }}>No member record is linked to this login yet. Please contact your cooperative office.</p>;
  const rows = tx.filter((t) => t.memberId === member.id).sort((a, b) => (a.date < b.date ? 1 : -1));
  const savingsBal = tx.filter((t) => t.memberId === member.id && (t.type === "deposit" || t.type === "withdrawal")).reduce((s, t) => s + (t.type === "deposit" ? t.amount : -t.amount), 0);
  const shareBal = tx.filter((t) => t.memberId === member.id && t.type === "share").reduce((s, t) => s + t.amount, 0);
  const myLoans = loans.filter((l) => l.memberId === member.id);

  return (
    <div>
      <div className="rounded-lg p-4 mb-4 flex items-center justify-between gap-3 no-print" style={{ background: C.card, border: `1px solid ${C.line}` }}>
        <div className="flex items-center gap-3">
          <Avatar name={member.name} photo={member.photo} size={48} />
          <div>
            <div className="font-bold" style={{ color: C.ink }}>{member.name}</div>
            <div className="text-xs font-mono" style={{ color: C.slate }}>{member.code}</div>
          </div>
        </div>
        <Btn variant="subtle" icon={Printer} onClick={() => window.print()}>Print passbook slip</Btn>
      </div>
      <div className="no-print">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Stat label="Savings balance" value={fmtMoney(savingsBal)} icon={PiggyBank} tint={C.green} />
          <Stat label="Share balance" value={fmtMoney(shareBal)} icon={Coins} tint={C.gold} />
        </div>

        {myLoans.length > 0 && (
          <div className="rounded-lg p-4 mb-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
            <h3 className="font-semibold text-sm mb-2" style={{ color: C.ink }}>My loans</h3>
            {myLoans.map((l) => (
              <div key={l.id} className="flex items-center justify-between text-sm py-1.5 border-t" style={{ borderColor: C.line }}>
                <span style={{ color: C.ink }}>{fmtMoney(l.principal)} · {l.rate}% · {l.tenureMonths}mo</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold" style={{ color: C.red }}>{fmtMoney(loanOutstanding(l))} due</span>
                  <Badge tone={l.status === "approved" ? "green" : l.status === "pending" ? "amber" : "red"}>{l.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        <h3 className="font-semibold text-sm mb-2" style={{ color: C.ink }}>Passbook</h3>
        <ReportTable rows={rows} nameOf={() => member.name} showMember={false} />
      </div>

      <div className="print-only">
        <PassbookSlip member={member} tx={tx} loans={loans} orgLogo={orgLogo} />
      </div>
    </div>
  );
}

/* ============================== APP SHELL ============================== */
const NAV_ICON = { dashboard: LayoutDashboard, members: Users, savings: PiggyBank, shares: Coins, loans: Landmark, reports: FileBarChart, users: UserCog, loginHistory: History, settings: Settings };
const NAV_LABEL = { dashboard: "Dashboard", members: "Members", savings: "Savings", shares: "Shares", loans: "Loans", reports: "Reports", users: "User accounts", loginHistory: "Login history", settings: "Settings" };

export default function App() {
  const { data, setData, loading, error, persist } = useOrgData();
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [navOpen, setNavOpen] = useState(false);

  const update = (key, updater) => {
    setData((prev) => {
      const next = { ...prev, [key]: updater(prev[key]) };
      persist(key === "tx" ? "transactions" : key === "loginLog" ? "login-log" : key === "orgLogo" ? "org-logo" : key, next[key]);
      return next;
    });
  };
  const setMembers = (v) => update("members", () => v);
  const setTx = (v) => update("tx", () => v);
  const setLoans = (v) => update("loans", () => v);
  const setUsers = (v) => update("users", () => v);
  const setOrgLogo = (v) => update("orgLogo", () => v);

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.navy }}>
        <Loader2 className="animate-spin" color="#fff" size={28} />
      </div>
    );
  }

  const handleLogin = (u) => {
    setUser(u);
    update("loginLog", (log) => [...log, { id: uid("log"), username: u.username, role: u.role, at: new Date().toISOString() }]);
    setPage(u.role === "member" ? "mypassbook" : "dashboard");
  };

  if (!user) return <LoginScreen users={data.users} onLogin={handleLogin} orgLogo={data.orgLogo} />;

  const perms = ROLE_PERMS[user.role];
  const navItems = ["dashboard", "members", "savings", "shares", "loans", "reports", "users", "loginHistory"].filter((k) => perms[k]);
  navItems.push("settings");

  return (
    <div className="min-h-screen flex" style={{ background: C.paper }}>
      <style>{`
        .print-only { display: none; }
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body, #root { background: #fff !important; }
          main { padding: 0 !important; }
        }
      `}</style>
      {/* Sidebar */}
      <aside className={`no-print fixed md:static inset-y-0 left-0 z-40 w-64 transform transition-transform ${navOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`} style={{ background: C.navyDeep }}>
        <div className="flex items-center gap-2 px-5 py-5 border-b" style={{ borderColor: "#26375C" }}>
          <OrgLogo logo={data.orgLogo} size={36} radius={10} />
          <div>
            <div className="text-white font-bold text-sm leading-tight">LBFG Cooperative</div>
            <div className="text-[10px]" style={{ color: "#8D97AC" }}>Digital System</div>
          </div>
        </div>
        <nav className="py-3 px-3">
          {(user.role === "member" ? [] : navItems).map((k) => {
            const Icon = NAV_ICON[k];
            return (
              <button key={k} onClick={() => { setPage(k); setNavOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm mb-1 transition-colors" style={page === k ? { background: C.gold, color: "#fff" } : { color: "#C7CEDC" }}>
                <Icon size={16} /> {NAV_LABEL[k]}
              </button>
            );
          })}
          {user.role === "member" && (
            <>
              <button onClick={() => setPage("mypassbook")} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm mb-1" style={page === "mypassbook" ? { background: C.gold, color: "#fff" } : { color: "#C7CEDC" }}>
                <Wallet size={16} /> My passbook
              </button>
              <button onClick={() => setPage("settings")} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm mb-1" style={page === "settings" ? { background: C.gold, color: "#fff" } : { color: "#C7CEDC" }}>
                <Settings size={16} /> Settings
              </button>
            </>
          )}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 px-3 py-4 border-t" style={{ borderColor: "#26375C" }}>
          <div className="px-3 mb-2">
            <div className="text-sm font-semibold text-white">{user.name}</div>
            <div className="text-[11px]" style={{ color: "#8D97AC" }}>{ROLE_LABEL[user.role]}</div>
          </div>
          <button onClick={async () => { try { await fetch("/api/logout", { method: "POST", credentials: "include" }); } catch {} setUser(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm" style={{ color: "#F0B4AE" }}>
            <LogOut size={16} /> Log out
          </button>
        </div>
      </aside>
      {navOpen && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setNavOpen(false)} />}

      {/* Main */}
      <div className="flex-1 md:ml-0 min-w-0">
        <header className="no-print flex items-center justify-between px-4 md:px-6 py-3 border-b md:hidden" style={{ background: C.card, borderColor: C.line }}>
          <button onClick={() => setNavOpen(true)}><Menu size={20} color={C.ink} /></button>
          <span className="font-bold text-sm" style={{ color: C.ink }}>LBFG Cooperative</span>
          <div style={{ width: 20 }} />
        </header>
        <main className="p-4 md:p-6">
          {error && <div className="mb-4 text-xs px-3 py-2 rounded" style={{ background: C.amberBg, color: C.amber }}>{error}</div>}
          {page === "dashboard" && <Dashboard members={data.members} tx={data.tx} loans={data.loans} />}
          {page === "members" && <MembersPage members={data.members} setMembers={setMembers} canEdit={perms.members} />}
          {page === "savings" && <MoneyPage title="Savings" type="savings" members={data.members} tx={data.tx} setTx={setTx} canEdit={perms.savings} />}
          {page === "shares" && <MoneyPage title="Share accounts" type="shares" members={data.members} tx={data.tx} setTx={setTx} canEdit={perms.shares} />}
          {page === "loans" && <LoansPage members={data.members} loans={data.loans} setLoans={setLoans} tx={data.tx} setTx={setTx} canApprove={perms.loanApprove} canApply={perms.loans} />}
          {page === "reports" && <ReportsPage members={data.members} tx={data.tx} loans={data.loans} orgLogo={data.orgLogo} />}
          {page === "users" && <UsersPage users={data.users} setUsers={setUsers} members={data.members} />}
          {page === "loginHistory" && <LoginHistoryPage log={data.loginLog} />}
          {page === "settings" && <SettingsPage user={user} users={data.users} setUsers={setUsers} orgLogo={data.orgLogo} setOrgLogo={setOrgLogo} />}
          {page === "mypassbook" && <MyPassbook user={user} members={data.members} tx={data.tx} loans={data.loans} orgLogo={data.orgLogo} />}
        </main>
      </div>
    </div>
  );
}
