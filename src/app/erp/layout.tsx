"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import type { AuthUser } from "../../lib/types";
import {
  LayoutDashboard, Database, PackageSearch, Banknote, ShoppingBag,
  Calculator, FileStack, BarChart3, Settings2,
  FlaskConical, Menu, X, TrendingUp, TrendingDown, Minus,
  Search, LogOut, Wheat, RefreshCw, ChevronRight,
} from "lucide-react";

const NAV = [
  { key: "command",     href: "/erp",              label: "Command Center",    short: "Daily control tower",          Icon: LayoutDashboard },
  { key: "masters",     href: "/erp/masters",       label: "Master Data",       short: "Parties, materials, quality",  Icon: Database },
  { key: "procurement", href: "/erp/procurement",   label: "Procurement",       short: "Model A & farmer supply",      Icon: PackageSearch },
  { key: "finance",     href: "/erp/finance",       label: "Finance Flow",      short: "Farmer finance exposure",      Icon: Banknote },
  { key: "sales",       href: "/erp/sales",         label: "Sales & Inventory", short: "Model C resale",               Icon: ShoppingBag },
  { key: "accounting",  href: "/erp/accounting",    label: "Accounting",        short: "GST, ledgers, payments",       Icon: Calculator },
  { key: "documents",   href: "/erp/documents",     label: "Document Hub",      short: "PDF, Excel, audit files",      Icon: FileStack },
  { key: "reports",     href: "/erp/reports",       label: "Reports & KPIs",    short: "MIS and exports",              Icon: BarChart3 },
  { key: "admin",       href: "/erp/admin",         label: "Administration",    short: "Users and controls",           Icon: Settings2 },
  { key: "testing",     href: "/erp/testing",       label: "Testing & QA",      short: "Flows, logic, data reset",     Icon: FlaskConical, adminOnly: true },
];

type MarketState = {
  inrPerTon: number; cornCents: number; usdInr: number;
  source: "live" | "fallback"; updatedAt: string; loading: boolean;
};

function calcInrPerTon(cornCents: number, usdInr: number) {
  return (cornCents / 100) * usdInr * (2204.62262 / 56);
}

export default function ERPLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [market, setMarket] = useState<MarketState>({
    inrPerTon: calcInrPerTon(449, 83.4),
    cornCents: 449, usdInr: 83.4,
    source: "fallback", updatedAt: "Indicative", loading: false,
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem("erp_auth");
      if (!stored) { router.replace("/login"); return; }
      setUser(JSON.parse(stored) as AuthUser);
    } catch { router.replace("/login"); }
  }, [router]);

  const refreshMarket = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setMarket((m) => ({ ...m, loading: true }));
    try {
      const res = await fetch("/api/market/corn", { cache: "no-store", signal: controller.signal });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setMarket({ inrPerTon: d.inrPerTon, cornCents: d.cornCents, usdInr: d.usdInr, source: "live", updatedAt: d.updatedAt, loading: false });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setMarket((m) => ({ ...m, source: "fallback", updatedAt: "Offline", loading: false }));
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(refreshMarket, 0);
    return () => { clearTimeout(t); abortRef.current?.abort(); };
  }, [refreshMarket]);

  function logout() { localStorage.removeItem("erp_auth"); router.push("/login"); }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 rounded-full border-2 border-[#22c55e] border-t-transparent animate-spin" />
          <span className="text-sm font-medium" style={{ color: "var(--ink-3)" }}>Loading workspace…</span>
        </div>
      </div>
    );
  }

  const today = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date());
  const activeNav = NAV.find((n) => {
    if (n.href === "/erp") return pathname === "/erp";
    return pathname.startsWith(n.href);
  }) ?? NAV[0];
  const inrFmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--ink)" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 xl:hidden"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="min-h-screen xl:grid" style={{ gridTemplateColumns: "264px 1fr" }}>

        {/* ── Sidebar ── */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-[264px] flex flex-col xl:static xl:translate-x-0 transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
          style={{ background: "var(--sidebar-bg)" }}
        >
          {/* Brand */}
          <div className="flex items-center justify-between px-5 py-5" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
            <Link href="/erp" className="flex items-center gap-3 group min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--brand-glow)", border: "1px solid rgba(34,197,94,0.3)" }}>
                <Wheat size={18} style={{ color: "#22c55e" }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "#22c55e", letterSpacing: "0.15em" }}>Akshaya ERP</p>
                <p className="text-[11px] leading-tight truncate" style={{ color: "var(--sidebar-muted)" }}>Commodity Trading Suite</p>
              </div>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg xl:hidden transition-colors hover:bg-white/10"
              style={{ color: "var(--sidebar-text)" }}
              aria-label="Close sidebar"
            >
              <X size={15} />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
            {NAV.filter((item) => !item.adminOnly || user.role === "Admin").map((item) => {
              const active = item.key === activeNav.key;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150"
                  style={{
                    background: active ? "rgba(34,197,94,0.13)" : "transparent",
                    borderLeft: active ? "3px solid #22c55e" : "3px solid transparent",
                  }}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "var(--sidebar-hover)"; }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <item.Icon
                    size={16}
                    className="shrink-0 transition-colors"
                    style={{ color: active ? "#22c55e" : "var(--sidebar-muted)" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold leading-tight transition-colors" style={{ color: active ? "#ffffff" : "var(--sidebar-text)" }}>
                      {item.label}
                    </p>
                    <p className="text-[11px] leading-tight truncate mt-0.5" style={{ color: "var(--sidebar-muted)" }}>
                      {item.short}
                    </p>
                  </div>
                  {active && <ChevronRight size={13} style={{ color: "#22c55e", opacity: 0.7 }} />}
                </Link>
              );
            })}
          </nav>

          {/* User card */}
          <div className="px-3 pb-4 pt-2" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
            <div className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: "var(--brand-glow)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}>
                {user.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold leading-tight" style={{ color: "#ffffff" }}>{user.name}</p>
                <p className="text-[11px] truncate" style={{ color: "var(--sidebar-muted)" }}>{user.role}</p>
              </div>
              <button
                onClick={logout}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-white/10"
                style={{ color: "var(--sidebar-muted)" }}
                title="Sign out"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="min-w-0 flex flex-col">

          {/* Header */}
          <header className="sticky top-0 z-10" style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div className="flex items-center gap-3 px-5 py-3 lg:px-6">

              {/* Mobile hamburger */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-lg xl:hidden transition-colors"
                style={{ border: "1px solid var(--border)", color: "var(--ink-3)" }}
                aria-label="Open menu"
              >
                <Menu size={16} />
              </button>

              {/* Page title */}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium" style={{ color: "var(--ink-4)" }}>{today} · {user.role}</p>
                <h2 className="text-lg font-bold leading-tight" style={{ color: "var(--ink)" }}>{activeNav.label}</h2>
              </div>

              {/* Right controls */}
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative hidden lg:block">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--ink-4)" }} />
                  <input
                    className="w-56 rounded-lg pl-8 pr-3 py-2 text-sm outline-none transition-all"
                    style={{
                      border: "1.5px solid var(--border)",
                      background: "var(--bg)",
                      color: "var(--ink)",
                      fontSize: "0.8125rem",
                    }}
                    placeholder="Search invoice, vehicle…"
                    onFocus={(e) => { e.target.style.borderColor = "#22c55e"; e.target.style.boxShadow = "0 0 0 3px rgba(34,197,94,0.12)"; }}
                    onBlur={(e) => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                  />
                </div>

                {/* Market ticker */}
                <button
                  onClick={refreshMarket}
                  disabled={market.loading}
                  className="hidden sm:flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors"
                  style={{ border: "1.5px solid var(--border)", background: "var(--card)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--muted)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--card)")}
                >
                  <div>
                    <p className="text-xs font-semibold leading-tight" style={{ color: "var(--ink)" }}>
                      Corn {inrFmt.format(market.inrPerTon)}/MT
                    </p>
                    <p className="text-[10px] leading-tight" style={{ color: "var(--ink-3)" }}>
                      {market.loading
                        ? "Refreshing…"
                        : `$${(market.cornCents / 100).toFixed(2)}/bu · ${market.source}`}
                    </p>
                  </div>
                  <RefreshCw size={12} className={market.loading ? "animate-spin" : ""} style={{ color: "var(--ink-4)" }} />
                </button>

                {/* CTA */}
                <Link
                  href="/erp/procurement"
                  className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition-all"
                  style={{ background: "var(--brand)", boxShadow: "0 1px 3px rgba(22,163,74,0.30)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#15803d")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--brand)")}
                >
                  <span className="text-base leading-none">+</span>
                  <span>New Entry</span>
                </Link>
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 px-5 py-6 lg:px-6 animate-fade-in">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
