"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import type { AuthUser } from "../../lib/types";

const NAV = [
  { key: "command",      href: "/erp",               label: "Command Center",    short: "Daily control tower" },
  { key: "masters",      href: "/erp/masters",        label: "Master Data",       short: "Parties, materials, quality" },
  { key: "procurement",  href: "/erp/procurement",    label: "Procurement",       short: "Model A and farmer supply" },
  { key: "finance",      href: "/erp/finance",        label: "Finance Flow",      short: "Farmer finance exposure" },
  { key: "sales",        href: "/erp/sales",          label: "Sales & Inventory", short: "Model C resale" },
  { key: "accounting",   href: "/erp/accounting",     label: "Accounting",        short: "GST, ledgers, payments" },
  { key: "documents",    href: "/erp/documents",      label: "Document Hub",      short: "PDF, Excel, audit files" },
  { key: "reports",      href: "/erp/reports",        label: "Reports & KPIs",    short: "MIS and exports" },
  { key: "exceptions",   href: "/erp/exceptions",     label: "Exception Center",  short: "Quality holds, alerts", badge: "3" },
  { key: "admin",        href: "/erp/admin",          label: "Administration",    short: "Users and controls" },
];

type MarketState = {
  inrPerTon: number;
  cornCents: number;
  usdInr: number;
  source: "live" | "fallback";
  updatedAt: string;
  loading: boolean;
};

function inrPerTon(cornCents: number, usdInr: number) {
  return (cornCents / 100) * usdInr * (2204.62262 / 56);
}

export default function ERPLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [market, setMarket] = useState<MarketState>({
    inrPerTon: inrPerTon(449, 83.4),
    cornCents: 449,
    usdInr: 83.4,
    source: "fallback",
    updatedAt: "Indicative",
    loading: false,
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem("erp_auth");
      if (!stored) { router.replace("/login"); return; }
      setUser(JSON.parse(stored) as AuthUser);
    } catch {
      router.replace("/login");
    }
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
    return () => {
      clearTimeout(t);
      abortRef.current?.abort();
    };
  }, [refreshMarket]);

  function logout() {
    localStorage.removeItem("erp_auth");
    router.push("/login");
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f6ef]">
        <div className="text-sm font-bold text-[#60735d]">Loading workspace…</div>
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
    <div className="min-h-screen bg-[#f4f6ef] text-[#172018]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 xl:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="grid min-h-screen xl:grid-cols-[288px_1fr]">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-72 border-r border-white/10 bg-[#172018] px-4 py-5 text-white transition-transform xl:static xl:translate-x-0 xl:w-auto ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="flex items-start justify-between border-b border-white/15 pb-5">
            <Link href="/erp">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d8ff72]">Akshaya ERP</p>
              <h1 className="mt-1.5 text-xl font-black leading-tight">Commodity Trading Suite</h1>
              <p className="mt-0.5 text-xs text-white/50">Akshaya Agri Solutions</p>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-md p-1.5 hover:bg-white/10 xl:hidden"
              aria-label="Close sidebar"
            >
              ✕
            </button>
          </div>

          <nav className="mt-4 grid gap-1">
            {NAV.map((item) => {
              const active = item.key === activeNav.key;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`rounded-lg px-3.5 py-2.5 transition flex items-center justify-between ${active ? "bg-[#d8ff72] text-[#172018]" : "text-[#dbe5d6] hover:bg-white/10"}`}
                >
                  <span>
                    <span className="block text-sm font-black">{item.label}</span>
                    <span className="mt-0.5 block text-xs opacity-70">{item.short}</span>
                  </span>
                  {"badge" in item && item.badge && !active && (
                    <span className="ml-2 text-xs font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full min-w-5 text-center">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 border-t border-white/15 pt-4">
            <div className="flex items-center justify-between rounded-lg bg-white/10 px-3.5 py-3">
              <div>
                <p className="text-sm font-black">{user.name}</p>
                <p className="text-xs text-white/60">{user.role} · {user.email}</p>
              </div>
              <button
                onClick={logout}
                className="rounded-md border border-white/20 px-2.5 py-1.5 text-xs font-black hover:bg-white/10"
              >
                Exit
              </button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="min-w-0 flex flex-col">
          {/* Header */}
          <header className="sticky top-0 z-10 border-b border-[#d7dfce] bg-white">
            <div className="flex items-center gap-4 px-5 py-4 lg:px-7">
              {/* Mobile menu button */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-md border border-[#d7dfce] p-2 text-sm xl:hidden"
                aria-label="Open menu"
              >
                ☰
              </button>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#63745f]">{today} · {user.role} workspace</p>
                <h2 className="text-2xl font-black leading-tight">{activeNav.label}</h2>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap justify-end">
                <input
                  className="hidden w-64 rounded-md border border-[#c8d2bf] bg-[#fbfcf8] px-3.5 py-2.5 text-sm outline-none focus:border-[#172018] lg:block"
                  placeholder="Search invoice, vehicle, farmer…"
                />
                {/* Market ticker */}
                <button
                  onClick={refreshMarket}
                  disabled={market.loading}
                  className="hidden rounded-md border border-[#d7dfce] bg-[#f6faef] px-3.5 py-2 text-left sm:block"
                >
                  <p className="text-xs font-black text-[#172018]">
                    Corn {inrFmt.format(market.inrPerTon)}/MT
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#60735d]">
                    {market.loading ? "Refreshing…" : `${(market.cornCents / 100).toFixed(2)} USD/bu · ${market.source}`}
                  </p>
                </button>
                <Link
                  href="/erp/procurement"
                  className="rounded-md bg-[#172018] px-4 py-2.5 text-sm font-black text-white hover:bg-[#2a3b29]"
                >
                  + New Entry
                </Link>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 px-5 py-6 lg:px-7">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
