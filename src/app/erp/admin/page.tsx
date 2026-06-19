"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { USERS, AUDIT_LOGS, APPROVAL_QUEUE } from "../../../lib/data/seed";
import {
  Users, ShieldCheck, Settings, Activity, Trash2,
  UserPlus, Check, X, Download, Pencil, PowerOff, CheckCircle2,
  AlertTriangle, RefreshCw, Package, BookOpen, Wallet, ShoppingCart,
  ChevronRight,
} from "lucide-react";

const TABS = ["Users", "Approvals", "GST Setup", "Audit Log", "Dev Tools"] as const;
type Tab = (typeof TABS)[number];

const ADMIN_TAB_ICONS = {
  "Users": Users,
  "Approvals": ShieldCheck,
  "GST Setup": Settings,
  "Audit Log": Activity,
  "Dev Tools": Trash2,
} as const;

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Active: "bg-[#f0fdf4] text-[#15803d]",
    Inactive: "bg-[#fef2f2] text-[#b91c1c]",
    Admin: "bg-[#fdf2f8] text-[#9d174d]",
    Manager: "bg-[#eff6ff] text-[#1d4ed8]",
    Clerk: "bg-[#f3f4f6] text-[#374151]",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[status] ?? "bg-gray-100 text-gray-700"}`}>{status}</span>;
}

function UsersTab() {
  const [showForm, setShowForm] = useState(false);

  const rolePermissions: Record<string, string[]> = {
    Admin: ["All modules", "User management", "GST setup", "Approval authority (all)", "Audit log", "Delete records", "Override quality rules"],
    Manager: ["All operational modules", "Approve invoices and settlements", "Quality rule approval", "View all reports", "Cannot manage users or delete"],
    Clerk: ["Upload PDF and Excel", "Create draft lots and entries", "Map suppliers and farmers", "View assigned modules only", "Cannot post, approve, or delete"],
  };

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">User management</h3>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary flex items-center gap-1.5">
          <UserPlus size={14} />Add user
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-[#d8decf] bg-white p-6">
          <h3 className="mb-4 text-xl font-semibold">New user</h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[
              ["Full name", "First Last", "text"],
              ["Email address", "user@akshayaagri.in", "email"],
              ["Mobile", "9848012345", "tel"],
            ].map(([label, placeholder, type]) => (
              <label key={label} className="grid gap-1.5 text-sm font-medium">
                {label}
                <input type={type as string} placeholder={placeholder as string} className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]" />
              </label>
            ))}
            <label className="grid gap-1.5 text-sm font-medium">
              Role
              <select className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]">
                <option value="Clerk">Clerk</option>
                <option value="Manager">Manager</option>
                <option value="Admin">Admin</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium sm:col-span-2 xl:col-span-3">
              Module access (leave blank for role default)
              <input type="text" placeholder="command, procurement, documents — or leave blank to use role defaults" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]" />
            </label>
          </div>
          <div className="mt-5 flex gap-3">
            <button onClick={() => setShowForm(false)} className="btn btn-primary flex items-center gap-1.5"><Check size={14} />Create User</button>
            <button onClick={() => setShowForm(false)} className="btn btn-ghost flex items-center gap-1.5"><X size={14} />Cancel</button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f3f6ef] text-xs font-semibold uppercase tracking-[0.1em] text-[#60735d]">
              <tr>
                {["User", "Email", "Role", "Module access", "Status", "Action"].map((h) => (
                  <th key={h} className="px-5 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {USERS.map((u) => (
                <tr key={u.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                  <td className="px-5 py-3.5 font-semibold">{u.name}</td>
                  <td className="px-5 py-3.5 text-[#536251]">{u.email}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={u.role} /></td>
                  <td className="px-5 py-3.5 text-[#536251]">
                    {u.modules[0] === "*" ? "All modules" : u.modules.join(", ")}
                  </td>
                  <td className="px-5 py-3.5"><StatusBadge status={u.status} /></td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2">
                      <button className="text-xs font-semibold text-[#172018] hover:underline inline-flex items-center gap-1"><Pencil size={12} />Edit</button>
                      <button className="text-xs font-semibold text-[#dc2626] hover:underline inline-flex items-center gap-1"><PowerOff size={12} />Disable</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role permission matrix */}
      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="border-b border-[#edf0e8] px-5 py-4">
          <h3 className="text-lg font-semibold">Role permission matrix</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f3f6ef] text-xs font-semibold uppercase tracking-[0.1em] text-[#60735d]">
              <tr>
                <th className="px-5 py-3.5">Capability</th>
                <th className="px-5 py-3.5">Admin</th>
                <th className="px-5 py-3.5">Manager</th>
                <th className="px-5 py-3.5">Clerk</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Upload PDF / Excel imports", true, true, true],
                ["Create draft lots and entries", true, true, true],
                ["Map suppliers and farmers", true, true, true],
                ["Approve and post transactions", true, true, false],
                ["Generate invoice drafts", true, true, true],
                ["Approve and release invoices", true, true, false],
                ["Record payments and receipts", true, true, false],
                ["View ledgers and reports", true, true, "Limited"],
                ["Manage users and roles", true, false, false],
                ["Configure GST settings", true, false, false],
                ["Edit quality rules", true, "Propose only", false],
                ["Override quality deductions", true, "Requires reason", false],
                ["Delete records", true, false, false],
                ["View full audit log", true, true, false],
              ].map(([cap, admin, mgr, clerk]) => (
                <tr key={cap as string} className="border-t border-[#edf0e8]">
                  <td className="px-5 py-3 text-[#172018]">{cap}</td>
                  {([admin, mgr, clerk] as (boolean | string)[]).map((val, i) => (
                    <td key={i} className="px-5 py-3">
                      {val === true ? (
                        <span className="font-bold text-[#15803d]">✓ Yes</span>
                      ) : val === false ? (
                        <span className="text-[#dc2626]">✗ No</span>
                      ) : (
                        <span className="text-[#d97706] font-bold">{val}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ApprovalsTab() {
  return (
    <div className="grid gap-6">
      <div className="rounded-xl border border-[#d8decf] bg-white p-5">
        <h3 className="mb-4 text-lg font-semibold">Approval matrix configuration</h3>
        <div className="grid gap-4 text-sm">
          {[
            { action: "Invoice approval", threshold: "Any value", approver: "Manager or Admin", notes: "All invoices require approval before release" },
            { action: "Quality rule activation", threshold: "Any new rule", approver: "Admin", notes: "Quality rule changes affect all active settlements" },
            { action: "Farmer payout batch", threshold: "Any value", approver: "Manager", notes: "14+ beneficiaries in a batch require manager review" },
            { action: "Credit limit change", threshold: "> ₹1,00,000", approver: "Admin", notes: "Below threshold: Manager can approve" },
            { action: "Quality deduction override", threshold: "> Allowed variance", approver: "Manager or Admin", notes: "Override reason mandatory for audit" },
            { action: "Invoice cancellation", threshold: "Any", approver: "Admin", notes: "Cancellation must create a credit note automatically" },
          ].map((row) => (
            <div key={row.action} className="grid grid-cols-4 gap-4 border-b border-[#edf0e8] py-3 last:border-0">
              <span className="font-semibold">{row.action}</span>
              <span className="text-[#536251]">{row.threshold}</span>
              <span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${row.approver.includes("Admin") && row.approver.includes("Manager") ? "bg-[#eff6ff] text-[#1d4ed8]" : row.approver.includes("Admin") ? "bg-[#fdf2f8] text-[#9d174d]" : "bg-[#eff6ff] text-[#1d4ed8]"}`}>
                  {row.approver}
                </span>
              </span>
              <span className="text-[#8a9e87]">{row.notes}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="border-b border-[#edf0e8] px-5 py-4">
          <h3 className="text-lg font-semibold">Pending approval queue</h3>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f3f6ef] text-xs font-semibold uppercase tracking-[0.1em] text-[#60735d]">
            <tr>
              {["Reference", "Type", "Required role", "Value", "Description", "Action"].map((h) => (
                <th key={h} className="px-5 py-3.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {APPROVAL_QUEUE.map((row) => (
              <tr key={row.ref} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                <td className="px-5 py-3.5 font-semibold">{row.ref}</td>
                <td className="px-5 py-3.5 text-[#536251]">{row.type}</td>
                <td className="px-5 py-3.5">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${row.requiredRole === "Admin" ? "bg-[#fdf2f8] text-[#9d174d]" : "bg-[#eff6ff] text-[#1d4ed8]"}`}>
                    {row.requiredRole}
                  </span>
                </td>
                <td className="px-5 py-3.5 font-bold">{row.value}</td>
                <td className="px-5 py-3.5 text-[#536251] max-w-[200px]">{row.description}</td>
                <td className="px-5 py-3.5">
                  <div className="flex gap-2">
                    <button className="btn btn-primary text-xs flex items-center gap-1"><CheckCircle2 size={12} />Approve</button>
                    <button className="btn btn-ghost text-xs flex items-center gap-1"><X size={12} />Reject</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GSTSetupTab() {
  return (
    <div className="grid gap-6">
      <div className="rounded-xl border border-[#d8decf] bg-white p-6">
        <h3 className="mb-4 text-xl font-semibold">Company GST settings</h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["Legal name", "Akshaya Agri Solutions"],
            ["GSTIN", "37AABCA1234A1ZX"],
            ["State", "Andhra Pradesh (37)"],
            ["Invoice prefix", "AAS"],
            ["Current financial year", "2026-27"],
            ["Invoice sequence start", "0001"],
            ["Default tax mode", "Intra-state (CGST + SGST)"],
            ["E-way bill threshold (₹)", "50,000"],
          ].map(([label, placeholder]) => (
            <label key={label} className="grid gap-1.5 text-sm font-medium">
              {label}
              <input type="text" defaultValue={placeholder} className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]" />
            </label>
          ))}
          <label className="grid gap-1.5 text-sm font-medium sm:col-span-2 xl:col-span-3">
            Registered address
            <textarea className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]" rows={2} defaultValue="Industrial Area, Bhimavaram, West Godavari, Andhra Pradesh 534202" />
          </label>
        </div>
        <div className="mt-5 flex gap-3">
          <button className="btn btn-primary flex items-center gap-1.5"><Check size={14} />Save GST Settings</button>
        </div>
      </div>

      <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-5">
        <h3 className="font-semibold text-[#92400e]">GST compliance checklist — May 2026</h3>
        <div className="mt-3 grid gap-2">
          {[
            ["GSTR-1 filing (May 2026)", "Due 11-Jun-2026", false],
            ["Sales register reconciliation", "All invoices approved", true],
            ["ITC reconciliation with GSTR-2B", "Pending", false],
            ["E-way bills for dispatches > ₹50,000", "AAS-2627-0122 covered", true],
            ["HSN summary for invoices > ₹5 Cr", "Required — GSTR-1", true],
          ].map(([item, note, done]) => (
            <div key={item as string} className="flex items-center gap-3 rounded-lg bg-white p-3">
              <span className={`text-lg ${done ? "text-[#15803d]" : "text-[#d97706]"}`}>{done ? "✓" : "○"}</span>
              <div>
                <p className="text-sm font-semibold">{item}</p>
                <p className="text-xs text-[#60735d]">{note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AuditLogTab() {
  const actionColors: Record<string, string> = {
    CREATE: "bg-[#eff6ff] text-[#1d4ed8]",
    APPROVE: "bg-[#f0fdf4] text-[#15803d]",
    MAP: "bg-[#f5f3ff] text-[#6d28d9]",
    HOLD: "bg-[#fef3c7] text-[#92400e]",
    UPDATE: "bg-[#fff7ed] text-[#c2410c]",
    DELETE: "bg-[#fef2f2] text-[#b91c1c]",
  };

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Audit log</h3>
        <div className="flex gap-2">
          <input type="text" placeholder="Search logs…" className="w-56 rounded-md border border-[#c8d4c0] px-3.5 py-2 text-sm outline-none focus:border-[#16a34a]" />
          <button className="btn btn-ghost flex items-center gap-1.5"><Download size={14} />Export</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f3f6ef] text-xs font-semibold uppercase tracking-[0.1em] text-[#60735d]">
              <tr>
                {["Timestamp", "User", "Role", "Action", "Entity type", "Reference", "Details"].map((h) => (
                  <th key={h} className="px-5 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AUDIT_LOGS.map((log) => (
                <tr key={log.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                  <td className="px-5 py-3.5 font-mono text-xs text-[#536251] whitespace-nowrap">
                    {new Date(log.loggedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true, hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                  </td>
                  <td className="px-5 py-3.5 font-semibold">{log.userName}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={log.role} /></td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${actionColors[log.action] ?? "bg-gray-100 text-gray-700"}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[#536251]">{log.entityType}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-[#1d4ed8]">{log.entityRef}</td>
                  <td className="px-5 py-3.5 text-[#536251] max-w-[260px] truncate">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── DEV TOOLS ────────────────────────────────────────────────────────────────

type Group = {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  tables: string[];
};

const GROUPS: Group[] = [
  {
    id: "procurement",
    label: "Procurement",
    description: "Inward lots & PDF import batches",
    icon: Package,
    color: "text-[#6d28d9]",
    bg: "bg-[#f5f3ff]",
    border: "border-[#ddd6fe]",
    tables: ["Inward lots", "Import batches"],
  },
  {
    id: "sales",
    label: "Sales",
    description: "Invoices, stock batches & dispatch",
    icon: ShoppingCart,
    color: "text-[#15803d]",
    bg: "bg-[#f0fdf4]",
    border: "border-[#bbf7d0]",
    tables: ["Invoices", "Stock batches"],
  },
  {
    id: "accounting",
    label: "Accounting & Finance",
    description: "Ledger entries & payment vouchers",
    icon: BookOpen,
    color: "text-[#1d4ed8]",
    bg: "bg-[#eff6ff]",
    border: "border-[#bfdbfe]",
    tables: ["Ledger entries", "Vouchers"],
  },
  {
    id: "payments",
    label: "Farmer Payments",
    description: "Farmer payout records",
    icon: Wallet,
    color: "text-[#d97706]",
    bg: "bg-[#fffbeb]",
    border: "border-[#fde68a]",
    tables: ["Farmer payouts"],
  },
];

const MASTER_DATA = ["Parties", "Materials", "Quality rules", "Rates", "App users"];

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${on ? "bg-[#172018]" : "bg-[#d1d5db]"}`}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${on ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

function DevToolsTab() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set(GROUPS.map((g) => g.id)));
  const [step, setStep] = useState<"idle" | "confirm" | "running" | "done">("idle");
  const [result, setResult] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holdPct, setHoldPct] = useState(0);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCounts = useCallback(() => {
    setLoading(true);
    fetch("/api/dev/reset")
      .then((r) => r.json())
      .then((d) => setCounts(d.counts ?? {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  const toggleGroup = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === GROUPS.length ? new Set() : new Set(GROUPS.map((g) => g.id))
    );
  };

  const selectedLabels = GROUPS.filter((g) => selected.has(g.id)).flatMap((g) => g.tables);
  const selectedRows = selectedLabels.reduce((s, l) => s + (counts[l] ?? 0), 0);
  const allOn = selected.size === GROUPS.length;

  // Hold-to-confirm: press and hold for 1.5 s to erase
  const startHold = () => {
    setHoldPct(0);
    const start = Date.now();
    holdInterval.current = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / 1500) * 100);
      setHoldPct(pct);
    }, 30);
    holdRef.current = setTimeout(() => {
      clearInterval(holdInterval.current!);
      setHoldPct(100);
      runErase();
    }, 1500);
  };

  const cancelHold = () => {
    if (holdRef.current) clearTimeout(holdRef.current);
    if (holdInterval.current) clearInterval(holdInterval.current);
    setHoldPct(0);
  };

  const runErase = async () => {
    setStep("running");
    setError(null);
    try {
      const res = await fetch("/api/dev/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labels: selectedLabels }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Reset failed"); setStep("confirm"); return; }
      setResult(d.deleted ?? {});
      setStep("done");
      fetchCounts();
    } catch (e) {
      setError(String(e));
      setStep("confirm");
    }
  };

  const reset = () => { setStep("idle"); setResult({}); setError(null); setHoldPct(0); };

  return (
    <div className="grid gap-5 max-w-2xl">

      {/* ── DONE ── */}
      {step === "done" && (
        <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-[#15803d]" />
              <div>
                <p className="font-bold text-[#15803d]">All done — data erased</p>
                <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm text-[#166534]">
                  {Object.entries(result).map(([label, n]) => (
                    <li key={label} className="flex justify-between gap-4">
                      <span>{label}</span><strong>{n} deleted</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <button onClick={reset} className="shrink-0 btn btn-ghost text-xs flex items-center gap-1">
              <RefreshCw size={12} />New run
            </button>
          </div>
        </div>
      )}

      {step !== "done" && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Reset test data</h3>
              <p className="text-sm text-[#60735d] mt-0.5">Select what to erase, then confirm. Master data is always preserved.</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#60735d]">
              <span>Select all</span>
              <Toggle on={allOn} onClick={toggleAll} />
            </div>
          </div>

          {/* Group cards */}
          <div className="grid gap-3 sm:grid-cols-2">
            {GROUPS.map((g) => {
              const on = selected.has(g.id);
              const Icon = g.icon;
              const groupTotal = g.tables.reduce((s, t) => s + (counts[t] ?? 0), 0);
              return (
                <div
                  key={g.id}
                  onClick={() => toggleGroup(g.id)}
                  className={`cursor-pointer rounded-xl border-2 p-4 transition-all select-none ${on ? g.border + " " + g.bg : "border-[#e5e7eb] bg-white opacity-50"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`rounded-lg p-2 ${on ? g.bg : "bg-[#f3f4f6]"}`}>
                        <Icon size={16} className={on ? g.color : "text-[#9ca3af]"} />
                      </div>
                      <div>
                        <p className={`font-semibold text-sm ${on ? "text-[#172018]" : "text-[#6b7280]"}`}>{g.label}</p>
                        <p className="text-xs text-[#60735d] mt-0.5">{g.description}</p>
                      </div>
                    </div>
                    <Toggle on={on} onClick={(e?: React.MouseEvent) => { e?.stopPropagation(); toggleGroup(g.id); }} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {g.tables.map((t) => (
                      <span key={t} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${on ? "bg-white/70 text-[#374151]" : "bg-[#f3f4f6] text-[#9ca3af]"}`}>
                        {t}: <span className="font-bold">{loading ? "…" : (counts[t] ?? 0)}</span>
                      </span>
                    ))}
                  </div>
                  {loading && <div className="mt-2 h-1 w-full rounded-full bg-[#e5e7eb] animate-pulse" />}
                </div>
              );
            })}
          </div>

          {/* Preserved master data */}
          <div className="rounded-xl border border-[#c8d4c0] bg-[#f3f6ef] px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#60735d] shrink-0">Always kept</span>
            {MASTER_DATA.map((m) => (
              <span key={m} className="flex items-center gap-1 text-xs font-semibold text-[#15803d]">
                <CheckCircle2 size={11} />{m}
              </span>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-[#fca5a5] bg-[#fef2f2] px-4 py-3 text-sm text-[#dc2626] flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />{error}
            </div>
          )}

          {/* Action footer */}
          {step === "idle" && (
            <div className="rounded-xl border border-[#d8decf] bg-white p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[#172018]">
                  {selected.size === 0
                    ? "No groups selected"
                    : `${selected.size} group${selected.size > 1 ? "s" : ""} · ${selectedRows} rows`}
                </p>
                <p className="text-xs text-[#60735d] mt-0.5">Click groups above to include or exclude</p>
              </div>
              <button
                onClick={() => setStep("confirm")}
                disabled={selected.size === 0}
                className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${selected.size > 0 ? "bg-[#dc2626] text-white hover:bg-[#b91c1c]" : "bg-[#f3f6ef] text-[#c8d4c0] cursor-not-allowed"}`}
              >
                Erase selected <ChevronRight size={14} />
              </button>
            </div>
          )}

          {step === "confirm" && (
            <div className="rounded-xl border-2 border-[#fca5a5] bg-[#fef2f2] p-5 grid gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#dc2626]" />
                <div>
                  <p className="font-bold text-[#dc2626]">Delete {selectedRows} rows across {selected.size} group{selected.size > 1 ? "s" : ""}?</p>
                  <p className="text-sm text-[#7f1d1d] mt-1">This cannot be undone. Hold the button below to confirm.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <button
                    onMouseDown={startHold}
                    onMouseUp={cancelHold}
                    onMouseLeave={cancelHold}
                    onTouchStart={startHold}
                    onTouchEnd={cancelHold}
                    className="relative w-full overflow-hidden rounded-xl bg-[#dc2626] px-5 py-3 text-sm font-bold text-white select-none"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      <Trash2 size={14} />
                      {holdPct > 0 ? "Hold…" : "Hold to confirm erase"}
                    </span>
                    {holdPct > 0 && (
                      <span
                        className="absolute inset-0 bg-[#b91c1c] origin-left transition-none"
                        style={{ transform: `scaleX(${holdPct / 100})` }}
                      />
                    )}
                  </button>
                </div>
                <button
                  onClick={() => { setStep("idle"); setHoldPct(0); }}
                  className="rounded-xl border border-[#d8decf] bg-white px-5 py-3 text-sm font-semibold text-[#172018] hover:bg-[#f3f6ef]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {step === "running" && (
            <div className="rounded-xl border border-[#d8decf] bg-white p-5 flex items-center gap-3 text-sm text-[#60735d]">
              <RefreshCw size={16} className="animate-spin shrink-0" />Erasing data, please wait…
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("Users");
  return (
    <div className="grid gap-5">
      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => {
          const TabIcon = ADMIN_TAB_ICONS[t];
          return (
            <button key={t} onClick={() => setTab(t)} className={`shrink-0 rounded-lg px-4 py-1.5 text-sm font-semibold transition-all flex items-center gap-1.5 ${tab === t ? "bg-[var(--ink)] text-white shadow-sm" : "border border-[var(--border)] bg-[var(--card)] text-[var(--ink-2)] hover:bg-[var(--muted)]"}`}>
              <TabIcon size={14} />{t}
            </button>
          );
        })}
      </div>
      {tab === "Users" && <UsersTab />}
      {tab === "Approvals" && <ApprovalsTab />}
      {tab === "GST Setup" && <GSTSetupTab />}
      {tab === "Audit Log" && <AuditLogTab />}
      {tab === "Dev Tools" && <DevToolsTab />}
    </div>
  );
}
