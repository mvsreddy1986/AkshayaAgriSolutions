"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wheat, Shield, Zap, TrendingUp, ArrowRight } from "lucide-react";
import type { UserRole } from "../../lib/types";

const DEMO_USERS: { email: string; password: string; role: UserRole; name: string; desc: string; color: string }[] = [
  { email: "admin@akshayaagri.in",   password: "admin123",   role: "Admin",   name: "Admin",   desc: "Full platform access & configuration", color: "#7c3aed" },
  { email: "manager@akshayaagri.in", password: "manager123", role: "Manager", name: "Manager", desc: "Approvals, invoices, reports",         color: "#0369a1" },
  { email: "clerk@akshayaagri.in",   password: "clerk123",   role: "Clerk",   name: "Clerk",   desc: "Upload, entry and draft lots",         color: "#0f766e" },
];

const FEATURES = [
  { Icon: Shield,     label: "Quality Settlement",  desc: "Param-based deduction engine for Maize, Paddy Husk & more" },
  { Icon: TrendingUp, label: "Live Market Rates",   desc: "Corn futures in ₹/MT via CBOT — refreshed on every login" },
  { Icon: Zap,        label: "Instant GST Invoices",desc: "Multi-party, multi-model invoicing with CGST/SGST/IGST" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("manager@akshayaagri.in");
  const [password, setPassword] = useState("manager123");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    try { if (localStorage.getItem("erp_auth")) router.replace("/erp"); }
    catch (e) { console.warn("Auth check failed:", e); }
  }, [router]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    setTimeout(() => {
      const match = DEMO_USERS.find((u) => u.email === email && u.password === password);
      if (match) {
        localStorage.setItem("erp_auth", JSON.stringify({ id: `usr-${match.role.toLowerCase()}`, name: match.name, email: match.email, role: match.role }));
        router.push("/erp");
      } else {
        setError("Invalid credentials — use a demo account below.");
        setLoading(false);
      }
    }, 420);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="mx-auto grid min-h-screen max-w-7xl gap-0 px-5 py-8 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12 lg:px-12 lg:py-0">

        {/* ── Left: Hero ── */}
        <div className="flex flex-col justify-between py-10 lg:py-16">

          {/* Wordmark */}
          <Link href="/" className="flex items-center gap-2.5 group w-fit">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "rgba(22,163,74,0.12)", border: "1px solid rgba(22,163,74,0.25)" }}>
              <Wheat size={16} style={{ color: "#16a34a" }} />
            </div>
            <span className="text-sm font-semibold" style={{ color: "var(--ink-2)" }}>Akshaya Agri Solutions</span>
          </Link>

          {/* Hero text */}
          <div className="max-w-lg py-8">
            {/* Live badge */}
            <div className="mb-6 flex items-center gap-2 w-fit rounded-full px-3.5 py-1.5" style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.2)" }}>
              <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: "#22c55e" }} />
              <span className="text-xs font-semibold" style={{ color: "#16a34a" }}>Live ERP · Supabase-backed · GST compliant</span>
            </div>

            <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-[3.5rem]" style={{ color: "var(--ink)" }}>
              Agriculture<br />
              <span style={{ color: "#16a34a" }}>Commodity</span> ERP
            </h1>

            <p className="mt-5 text-base leading-relaxed" style={{ color: "var(--ink-3)" }}>
              Procurement, quality settlement, farmer finance, bulk invoicing, ledger management and KPI reporting — designed for Andhra Pradesh agri trading.
            </p>

            {/* Feature pills */}
            <div className="mt-8 grid gap-3">
              {FEATURES.map(({ Icon, label, desc }) => (
                <div key={label} className="flex items-start gap-3 rounded-xl p-3.5 transition-colors" style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-xs)" }}>
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.15)" }}>
                    <Icon size={15} style={{ color: "#16a34a" }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight" style={{ color: "var(--ink)" }}>{label}</p>
                    <p className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--ink-3)" }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs" style={{ color: "var(--ink-4)" }}>
            Akshaya Agri Solutions · GST Registered · Addanki, Prakasam District, Andhra Pradesh
          </p>
        </div>

        {/* ── Right: Login card ── */}
        <div className="flex items-center py-10 lg:py-16">
          <div className="w-full rounded-2xl p-7 sm:p-8" style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}>

            {/* Card header */}
            <div className="mb-7">
              <p className="section-title mb-2">Secure workspace</p>
              <h2 className="text-2xl font-bold" style={{ color: "var(--ink)" }}>Sign in to ERP</h2>
              <p className="mt-1.5 text-sm" style={{ color: "var(--ink-3)" }}>Access your trading operations dashboard.</p>
            </div>

            {/* Form */}
            <form className="grid gap-4" onSubmit={handleSubmit}>
              <label className="grid gap-1.5 text-sm font-semibold" style={{ color: "var(--ink)" }}>
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input"
                  placeholder="user@akshayaagri.in"
                />
              </label>

              <label className="grid gap-1.5 text-sm font-semibold" style={{ color: "var(--ink)" }}>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input"
                  placeholder="••••••••"
                />
              </label>

              {error && (
                <div className="flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c" }}>
                  <span>⚠</span> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary mt-1 w-full justify-center py-3 text-sm"
                style={{ borderRadius: "10px" }}
              >
                {loading
                  ? <><span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Signing in…</>
                  : <><span>Enter Workspace</span> <ArrowRight size={15} /></>
                }
              </button>
            </form>

            {/* Demo accounts */}
            <div className="mt-6">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                <span className="text-xs font-medium px-2" style={{ color: "var(--ink-4)" }}>demo accounts</span>
                <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
              </div>
              <div className="grid gap-2">
                {DEMO_USERS.map((u) => (
                  <button
                    key={u.role}
                    type="button"
                    onClick={() => { setEmail(u.email); setPassword(u.password); setError(""); }}
                    className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-all"
                    style={{ border: "1.5px solid var(--border)", background: "transparent" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--muted)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: u.color }}>
                      {u.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-tight" style={{ color: "var(--ink)" }}>{u.role}</p>
                      <p className="text-[11px]" style={{ color: "var(--ink-4)" }}>{u.email}</p>
                    </div>
                    <span className="text-xs font-medium" style={{ color: "var(--brand)" }}>Use →</span>
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
