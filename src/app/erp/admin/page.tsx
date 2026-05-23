"use client";

import { useState } from "react";
import { USERS, AUDIT_LOGS, APPROVAL_QUEUE } from "../../../lib/data/seed";

const TABS = ["Users", "Approvals", "GST Setup", "Audit Log"] as const;
type Tab = (typeof TABS)[number];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Active: "bg-[#f0fdf4] text-[#15803d]",
    Inactive: "bg-[#fef2f2] text-[#b91c1c]",
    Admin: "bg-[#fdf2f8] text-[#9d174d]",
    Manager: "bg-[#eff6ff] text-[#1d4ed8]",
    Clerk: "bg-[#f3f4f6] text-[#374151]",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${map[status] ?? "bg-gray-100 text-gray-700"}`}>{status}</span>;
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
        <h3 className="text-xl font-black">User management</h3>
        <button onClick={() => setShowForm(!showForm)} className="rounded-md bg-[#172018] px-4 py-2.5 text-sm font-black text-white hover:bg-[#2a3b29]">
          + Add user
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-[#d8decf] bg-white p-6">
          <h3 className="mb-4 text-xl font-black">New user</h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[
              ["Full name", "First Last", "text"],
              ["Email address", "user@akshayaagri.in", "email"],
              ["Mobile", "9848012345", "tel"],
            ].map(([label, placeholder, type]) => (
              <label key={label} className="grid gap-1.5 text-sm font-bold">
                {label}
                <input type={type as string} placeholder={placeholder as string} className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
              </label>
            ))}
            <label className="grid gap-1.5 text-sm font-bold">
              Role
              <select className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]">
                <option value="Clerk">Clerk</option>
                <option value="Manager">Manager</option>
                <option value="Admin">Admin</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-bold sm:col-span-2 xl:col-span-3">
              Module access (leave blank for role default)
              <input type="text" placeholder="command, procurement, documents — or leave blank to use role defaults" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
          </div>
          <div className="mt-5 flex gap-3">
            <button onClick={() => setShowForm(false)} className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white">Create User</button>
            <button onClick={() => setShowForm(false)} className="rounded-md border border-[#d7dfce] px-5 py-2.5 text-sm font-black">Cancel</button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
              <tr>
                {["User", "Email", "Role", "Module access", "Status", "Action"].map((h) => (
                  <th key={h} className="px-5 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {USERS.map((u) => (
                <tr key={u.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                  <td className="px-5 py-3.5 font-black">{u.name}</td>
                  <td className="px-5 py-3.5 text-[#536251]">{u.email}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={u.role} /></td>
                  <td className="px-5 py-3.5 text-[#536251]">
                    {u.modules[0] === "*" ? "All modules" : u.modules.join(", ")}
                  </td>
                  <td className="px-5 py-3.5"><StatusBadge status={u.status} /></td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2">
                      <button className="text-xs font-black text-[#172018] hover:underline">Edit</button>
                      <button className="text-xs font-black text-[#dc2626] hover:underline">Disable</button>
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
          <h3 className="text-lg font-black">Role permission matrix</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
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
        <h3 className="mb-4 text-lg font-black">Approval matrix configuration</h3>
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
              <span className="font-black">{row.action}</span>
              <span className="text-[#536251]">{row.threshold}</span>
              <span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${row.approver.includes("Admin") && row.approver.includes("Manager") ? "bg-[#eff6ff] text-[#1d4ed8]" : row.approver.includes("Admin") ? "bg-[#fdf2f8] text-[#9d174d]" : "bg-[#eff6ff] text-[#1d4ed8]"}`}>
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
          <h3 className="text-lg font-black">Pending approval queue</h3>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
            <tr>
              {["Reference", "Type", "Required role", "Value", "Description", "Action"].map((h) => (
                <th key={h} className="px-5 py-3.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {APPROVAL_QUEUE.map((row) => (
              <tr key={row.ref} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                <td className="px-5 py-3.5 font-black">{row.ref}</td>
                <td className="px-5 py-3.5 text-[#536251]">{row.type}</td>
                <td className="px-5 py-3.5">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${row.requiredRole === "Admin" ? "bg-[#fdf2f8] text-[#9d174d]" : "bg-[#eff6ff] text-[#1d4ed8]"}`}>
                    {row.requiredRole}
                  </span>
                </td>
                <td className="px-5 py-3.5 font-bold">{row.value}</td>
                <td className="px-5 py-3.5 text-[#536251] max-w-[200px]">{row.description}</td>
                <td className="px-5 py-3.5">
                  <div className="flex gap-2">
                    <button className="rounded-md bg-[#172018] px-3 py-1.5 text-xs font-black text-white">Approve</button>
                    <button className="rounded-md border border-[#d7dfce] px-3 py-1.5 text-xs font-black">Reject</button>
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
        <h3 className="mb-4 text-xl font-black">Company GST settings</h3>
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
            <label key={label} className="grid gap-1.5 text-sm font-bold">
              {label}
              <input type="text" defaultValue={placeholder} className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
          ))}
          <label className="grid gap-1.5 text-sm font-bold sm:col-span-2 xl:col-span-3">
            Registered address
            <textarea className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" rows={2} defaultValue="Industrial Area, Bhimavaram, West Godavari, Andhra Pradesh 534202" />
          </label>
        </div>
        <div className="mt-5 flex gap-3">
          <button className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white">Save GST Settings</button>
        </div>
      </div>

      <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-5">
        <h3 className="font-black text-[#92400e]">GST compliance checklist — May 2026</h3>
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
                <p className="text-sm font-black">{item}</p>
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
        <h3 className="text-xl font-black">Audit log</h3>
        <div className="flex gap-2">
          <input type="text" placeholder="Search logs…" className="w-56 rounded-md border border-[#c8d4c0] px-3.5 py-2 text-sm outline-none focus:border-[#172018]" />
          <button className="rounded-md border border-[#9baa91] px-3.5 py-2 text-sm font-black hover:bg-[#f3f6ef]">Export</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
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
                  <td className="px-5 py-3.5 font-black">{log.userName}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={log.role} /></td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${actionColors[log.action] ?? "bg-gray-100 text-gray-700"}`}>
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

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("Users");
  return (
    <div className="grid gap-5">
      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`shrink-0 rounded-md px-4 py-2 text-sm font-black transition ${tab === t ? "bg-[#172018] text-white" : "border border-[#d7dfce] bg-white text-[#40513d] hover:bg-[#f3f6ef]"}`}>{t}</button>
        ))}
      </div>
      {tab === "Users" && <UsersTab />}
      {tab === "Approvals" && <ApprovalsTab />}
      {tab === "GST Setup" && <GSTSetupTab />}
      {tab === "Audit Log" && <AuditLogTab />}
    </div>
  );
}
