"use client";

import Link from "next/link";

const CAPABILITIES = [
  { title: "PDF / Excel Import", body: "Upload Sarvani delivery reports and farmer Excel sheets. System creates draft lots for review and approval — no re-keying." },
  { title: "Quality Deduction Engine", body: "Date-valid rules for moisture, foreign matter, and cess. Versioned so historical settlements are never recalculated." },
  { title: "Bulk Invoice Generation", body: "One click generates material-wise, date-wise GST invoices to Sarvani. Invoice numbering, tax computation and PDF rendering included." },
  { title: "Farmer Payout Register", body: "Track every farmer payment reference against the inward lot — independent of the supplier ledger. Full audit trail for compliance." },
  { title: "Model B Financing Control", body: "Separate advance control account tracks farmer finance exposure vs Sarvani recovery. Clean double-entry with no manual journals." },
  { title: "Party Ledgers & Ageing", body: "Drill from outstanding summary to individual invoice in two clicks. Share ledger statements directly with counterparties." },
  { title: "GST-Ready Invoicing", body: "CGST/SGST/IGST auto-computed, invoice register maintained for each financial year. Supports debit and credit notes." },
  { title: "KPI Dashboards", body: "Daily supply, receivables, payables, quality trends, material margins, and exception alerts — all on one screen." },
];

const MODELS = [
  {
    tag: "Model A",
    title: "Supplier Aggregation",
    color: "bg-[#d8ff72] text-[#172018]",
    points: [
      "PDF delivery report from Sarvani parsed and converted to draft lots",
      "Each lot mapped to local supplier + farmer reference",
      "Quality deductions applied and approved by manager",
      "Bulk invoices raised to Sarvani",
      "Separate farmer payout register for audit compliance",
    ],
  },
  {
    tag: "Model B",
    title: "Farmer Financing",
    color: "bg-[#172018] text-white",
    points: [
      "Farmers deliver directly to Sarvani; Akshaya pays upfront",
      "Excel sheet import for farmer data and weights",
      "Finance advance control account tracks exposure",
      "Bulk invoices to Sarvani to recover advance",
      "Recovery auto-reduces finance exposure balance",
    ],
  },
  {
    tag: "Model C",
    title: "Buy and Resell",
    color: "bg-[#405b3d] text-white",
    points: [
      "Purchase DDGS, WDG, CO2, Corn Oil from Sarvani",
      "Batch-wise stock tracking with quality records",
      "Trader invoices with retail markup and credit terms",
      "Margin tracking per material per batch",
      "Payable to Sarvani and receivable from traders — separate",
    ],
  },
];

const MATERIALS = [
  ["Maize", "1005", "MT", "0%"],
  ["Paddy Husk", "1213", "MT", "0%"],
  ["Coal", "2701", "MT", "5%"],
  ["Biomass", "4401", "MT", "5%"],
  ["DDGS", "2303", "MT", "0%"],
  ["WDG", "2309", "MT", "0%"],
  ["CO2", "2811", "KG", "18%"],
  ["Corn Oil", "1515", "L", "12%"],
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#eef3e8] text-[#172018]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[#c8d4c0] bg-[#eef3e8]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <div>
            <span className="text-xs font-black uppercase tracking-[0.2em] text-[#60735d]">Akshaya Agri Solutions</span>
            <span className="ml-3 hidden rounded-full border border-[#c8d4c0] bg-white px-3 py-0.5 text-xs font-bold text-[#60735d] sm:inline">
              GST Registered · Agriculture Commodity Trading
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#2a3b29]"
            >
              Login to ERP
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#c8d4c0] bg-white px-4 py-2">
            <span className="h-2 w-2 rounded-full bg-[#4a9e44]" />
            <span className="text-sm font-bold text-[#405b3d]">Private ERP · Production-ready platform</span>
          </div>
          <h1 className="text-5xl font-black leading-[1.03] sm:text-6xl lg:text-7xl">
            Agriculture commodity ERP for{" "}
            <span className="text-[#405b3d]">Akshaya Agri Solutions</span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#536251]">
            Manage supplier aggregation, farmer finance, retail resale, PDF and Excel intake,
            quality deductions, GST invoices, ledgers and KPI reports — all in one secure workspace.
            Three business models, one audit-ready platform.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/login"
              className="rounded-md bg-[#172018] px-7 py-4 text-base font-black text-white transition hover:bg-[#2a3b29]"
            >
              Enter ERP
            </Link>
            <a
              href="#modules"
              className="rounded-md border border-[#c8d4c0] bg-white px-7 py-4 text-base font-black text-[#172018] transition hover:bg-[#eef3e8]"
            >
              See all modules
            </a>
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="border-y border-[#c8d4c0] bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-[#e8ede3] px-5 sm:grid-cols-4 sm:px-8">
          {[
            ["3 Business models", "A · B · C in one ledger"],
            ["8 Materials", "Maize, Coal, DDGS, CO2 + more"],
            ["GST compliant", "CGST / SGST / IGST invoicing"],
            ["Full audit trail", "Every edit, approval, reversal"],
          ].map(([stat, sub]) => (
            <div key={stat} className="py-8 px-4 text-center">
              <p className="text-xl font-black">{stat}</p>
              <p className="mt-1 text-sm text-[#60735d]">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Business Models */}
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-[#60735d]">Business Models</p>
        <h2 className="mb-10 text-4xl font-black">Three flows, one platform</h2>
        <div className="grid gap-6 lg:grid-cols-3">
          {MODELS.map((model) => (
            <div key={model.tag} className="rounded-xl border border-[#c8d4c0] bg-white p-7">
              <span className={`inline-block rounded-md px-3 py-1 text-xs font-black uppercase tracking-[0.15em] ${model.color}`}>
                {model.tag}
              </span>
              <h3 className="mt-4 text-2xl font-black">{model.title}</h3>
              <ul className="mt-5 space-y-3">
                {model.points.map((pt) => (
                  <li key={pt} className="flex gap-2.5 text-sm leading-6 text-[#536251]">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4a9e44]" />
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Capabilities */}
      <section id="modules" className="border-t border-[#c8d4c0] bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-[#60735d]">Platform Capabilities</p>
          <h2 className="mb-10 text-4xl font-black">Everything your operations need</h2>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {CAPABILITIES.map((cap) => (
              <div key={cap.title} className="rounded-xl border border-[#e3e9de] bg-[#f8fbf5] p-6">
                <h3 className="text-lg font-black">{cap.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#536251]">{cap.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Material Master Preview */}
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-[#60735d]">Material Master</p>
        <h2 className="mb-10 text-4xl font-black">8 materials, extensible</h2>
        <div className="overflow-hidden rounded-xl border border-[#c8d4c0] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.12em] text-[#60735d]">
              <tr>
                {["Material", "HSN", "UOM", "GST Rate", "Business use"].map((h) => (
                  <th key={h} className="px-6 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATERIALS.map(([mat, hsn, uom, gst], i) => (
                <tr key={mat} className={`border-t border-[#edf0e8] ${i % 2 === 0 ? "" : "bg-[#fafcf8]"}`}>
                  <td className="px-6 py-4 font-black">{mat}</td>
                  <td className="px-6 py-4 text-[#60735d]">{hsn}</td>
                  <td className="px-6 py-4 text-[#60735d]">{uom}</td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${gst === "0%" ? "bg-[#e8f5e9] text-[#2e7d32]" : "bg-[#fff3e0] text-[#e65100]"}`}>
                      {gst}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[#60735d]">
                    {["A, B", "A", "A, B, C", "A", "C", "C", "C", "C"][i]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-[#60735d]">
          More materials can be added at any time via the Material Master module. Each material carries its own HSN, GST rate, quality parameters, and settlement logic.
        </p>
      </section>

      {/* Roles */}
      <section className="border-t border-[#c8d4c0] bg-[#172018] py-16 text-white sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-[#d8ff72]">Access Control</p>
          <h2 className="mb-10 text-4xl font-black">Role-based access</h2>
          <div className="grid gap-6 lg:grid-cols-3">
            {[
              { role: "Admin", color: "bg-[#d8ff72] text-[#172018]", caps: ["All modules and configuration", "Approve invoices and quality rules", "Release payments", "Manage users, roles, and GST setup", "Full audit log access"] },
              { role: "Manager", color: "bg-white/20 text-white", caps: ["Approve transactions and settlements", "Set and approve quality rules", "View all reports and ledgers", "Generate and send invoices", "Cannot manage users or delete data"] },
              { role: "Clerk", color: "bg-white/10 text-white/80", caps: ["Upload PDF and Excel imports", "Create draft entries and lots", "Map suppliers and farmers", "View assigned modules only", "Cannot post, approve, or delete"] },
            ].map(({ role, color, caps }) => (
              <div key={role} className="rounded-xl border border-white/15 p-7">
                <span className={`inline-block rounded-md px-3 py-1 text-xs font-black uppercase tracking-[0.15em] ${color}`}>{role}</span>
                <ul className="mt-5 space-y-3">
                  {caps.map((cap) => (
                    <li key={cap} className="flex gap-2.5 text-sm leading-6 text-white/75">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d8ff72]" />
                      {cap}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-5 py-16 text-center sm:px-8 sm:py-24">
        <h2 className="text-4xl font-black sm:text-5xl">Ready to start?</h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-[#536251]">
          Log in to the ERP workspace. Explore all modules with realistic demo data for Akshaya Agri Solutions and Sarvani Biofuels.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block rounded-md bg-[#172018] px-10 py-4 text-base font-black text-white transition hover:bg-[#2a3b29]"
        >
          Enter ERP →
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#c8d4c0] py-8">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm font-black text-[#60735d]">Akshaya Agri Solutions · Private ERP</p>
            <p className="text-sm text-[#60735d]">GST-registered agriculture commodity trading and settlement · Andhra Pradesh, India</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
