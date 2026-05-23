"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { UserRole } from "../../lib/types";

const DEMO_USERS: { email: string; password: string; role: UserRole; name: string }[] = [
  { email: "admin@akshayaagri.in", password: "admin123", role: "Admin", name: "Admin" },
  { email: "manager@akshayaagri.in", password: "manager123", role: "Manager", name: "Manager" },
  { email: "clerk@akshayaagri.in", password: "clerk123", role: "Clerk", name: "Clerk" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("manager@akshayaagri.in");
  const [password, setPassword] = useState("manager123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("erp_auth");
      if (stored) router.replace("/erp");
    } catch {}
  }, [router]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      const match = DEMO_USERS.find((u) => u.email === email && u.password === password);
      if (match) {
        localStorage.setItem("erp_auth", JSON.stringify({ id: `usr-${match.role.toLowerCase()}`, name: match.name, email: match.email, role: match.role }));
        router.push("/erp");
      } else {
        setError("Invalid credentials. Use a demo account below.");
        setLoading(false);
      }
    }, 400);
  }

  return (
    <div className="min-h-screen bg-[#eef3e8]">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-10 px-5 py-6 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        {/* Left panel */}
        <div className="flex flex-col justify-between py-6">
          <Link href="/" className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#60735d] hover:text-[#172018]">
            ← Akshaya Agri Solutions
          </Link>

          <div className="max-w-xl py-10">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#c8d4c0] bg-white px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-[#4a9e44]" />
              <span className="text-sm font-bold text-[#405b3d]">Private ERP · Secure workspace</span>
            </div>
            <h1 className="text-5xl font-black leading-[1.04] sm:text-6xl">
              GST Agriculture Commodity ERP
            </h1>
            <p className="mt-6 text-base leading-8 text-[#536251]">
              Procurement, quality settlement, farmer finance, bulk invoicing, ledger management and KPI reporting — all in one audit-ready platform.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                { role: "Admin", desc: "Full control and configuration" },
                { role: "Manager", desc: "Approvals, invoices, reports" },
                { role: "Clerk", desc: "Upload, entry, draft lots" },
              ].map(({ role, desc }) => (
                <div key={role} className="rounded-lg border border-[#d5ddce] bg-white/80 p-4">
                  <p className="text-sm font-black">{role}</p>
                  <p className="mt-1 text-xs text-[#60735d]">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-[#8a9e87]">
            Akshaya Agri Solutions · GST Registered · West Godavari, Andhra Pradesh
          </p>
        </div>

        {/* Login card */}
        <div className="self-center">
          <div className="rounded-2xl border border-[#d4dccb] bg-white p-8 shadow-xl shadow-[#60735d]/10">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#698065]">Secure accounting area</p>
            <h2 className="mt-2 text-3xl font-black">Login to ERP</h2>
            <p className="mt-2 text-sm text-[#60735d]">Enter your credentials to access the business workspace.</p>

            <form className="mt-7 grid gap-5" onSubmit={handleSubmit}>
              <label className="grid gap-2 text-sm font-bold text-[#172018]">
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="rounded-lg border border-[#c8d4c0] px-4 py-3 text-sm font-normal outline-none transition focus:border-[#172018] focus:ring-2 focus:ring-[#172018]/10"
                  placeholder="user@akshayaagri.in"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-[#172018]">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="rounded-lg border border-[#c8d4c0] px-4 py-3 text-sm font-normal outline-none transition focus:border-[#172018] focus:ring-2 focus:ring-[#172018]/10"
                  placeholder="••••••••"
                />
              </label>

              {error && (
                <p className="rounded-lg bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-[#172018] px-5 py-3.5 text-sm font-black uppercase tracking-[0.13em] text-white transition hover:bg-[#2a3b29] disabled:opacity-60"
              >
                {loading ? "Signing in…" : "Enter Business Workspace"}
              </button>
            </form>

            {/* Demo accounts */}
            <div className="mt-6 rounded-xl bg-[#f2f5ed] p-5">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.15em] text-[#60735d]">Demo Accounts</p>
              <div className="grid gap-2">
                {DEMO_USERS.map((u) => (
                  <button
                    key={u.role}
                    type="button"
                    onClick={() => { setEmail(u.email); setPassword(u.password); setError(""); }}
                    className="flex items-center justify-between rounded-lg border border-[#d5ddce] bg-white px-4 py-2.5 text-left text-sm transition hover:border-[#172018]"
                  >
                    <span>
                      <span className="font-black">{u.role}</span>
                      <span className="ml-2 text-[#60735d]">{u.email}</span>
                    </span>
                    <span className="text-xs text-[#8a9e87]">Use</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
