#!/usr/bin/env node
/**
 * Akshaya Agri ERP — OpenAI Prompt Mediator
 * Runs as a Claude Code UserPromptSubmit hook.
 *
 * Normal flow:  Your message → Mediator refines → Claude sees both
 * Direct bypass: Start message with //  → mediator skipped entirely
 *
 * API key: OPENAI_API_KEY in .claude/.env
 */

"use strict";

const fs   = require("fs");
const path = require("path");

// ── Load API key ──────────────────────────────────────────────────────────────

function loadApiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  const envPath = path.join(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const t = line.trim();
      if (t.startsWith("OPENAI_API_KEY="))
        return t.slice("OPENAI_API_KEY=".length).replace(/^["']|["']$/g, "").trim();
    }
  }
  return "";
}

// ── Direct bypass ─────────────────────────────────────────────────────────────
// If the message starts with //, skip the mediator entirely and talk to Claude directly.

function isDirectBypass(prompt) {
  return prompt.trimStart().startsWith("//");
}

// ── Skip conditions ───────────────────────────────────────────────────────────

const SKIP_EXACT = new Set(["yes", "no", "ok", "y", "n", "continue", "stop", "done", "exit"]);

const SKIP_TOPICS = [
  "mediator", "openai", "hook", "credits added", "api key", "retest", "test now",
  "are you sure", "is it working", "can we test", "does it work", "working correctly",
  "what do you think", "progress so far", "summarize", "explain", "how does",
];

function shouldSkip(prompt) {
  const p = prompt.trim().toLowerCase();
  if (p.length < 8) return true;
  if (p.startsWith("/")) return true;       // slash commands
  if (SKIP_EXACT.has(p)) return true;
  if (/^(git |npm |npx )/.test(p)) return true;
  if (SKIP_TOPICS.some((t) => p.includes(t))) return true;
  return false;
}

// ── ERP context ───────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior software architect and prompt engineer for an agricultural commodity ERP called "Akshaya Agri Solutions" (AAS), built with Next.js 15 + TypeScript + Supabase.

Key facts:
- Business models: A (Akshaya intermediates between suppliers and Sarvani Biofuels — same rate, earns margin + quality deductions), B (direct farmer procurement), C (byproduct resale)
- Core lot flow: Draft → Mapped → QualityHold → Approved → Settled → Invoiced
- Settlement engine: src/lib/settlement/engine.ts — deduction methods: linear, slab, value-pct, actual-weight
- Communications: TaxInvoiceDialog (multi-lot to Sarvani, navy), SettlementStatement (supplier copy, green), BatchInvoiceDialog (proforma)
- Key files: src/app/erp/procurement/page.tsx, src/app/erp/accounting/page.tsx, src/lib/types/index.ts, src/lib/db.ts
- API routes at src/app/api/*; DB via src/lib/supabase/admin.ts
- Materials: Maize, DDGS, WDG, Paddy Husk, Coal, Corn Oil — HSN codes, GST rate, quality params, cess rate

When given a vague developer instruction:
1. Identify which module/file it likely refers to
2. Infer the specific feature or fix wanted
3. Rewrite as a precise actionable coding task: what to build, which files, expected outcome
4. Name specific components, routes, or DB fields where relevant
5. Keep it under 6 sentences

Output ONLY the refined task. No preamble, no label.`;

// ── OpenAI call ───────────────────────────────────────────────────────────────

async function refine(prompt, apiKey) {
  const { default: OpenAI } = require("openai");
  const openai = new OpenAI({ apiKey });
  const response = await openai.responses.create({
    model: "gpt-4o-mini",
    instructions: SYSTEM_PROMPT,
    input: prompt,
  });
  return response.output_text.trim();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;

  let prompt = "";
  try {
    const hookInput = JSON.parse(raw);
    prompt = hookInput.prompt ?? "";
  } catch {
    prompt = raw.trim();
  }

  if (!prompt) process.exit(0);

  // ── Direct bypass: // prefix → skip mediator, show notice to Claude only ──
  if (isDirectBypass(prompt)) {
    const actual = prompt.replace(/^\/\/\s*/, "").trim();
    console.log(`╔══ DIRECT MODE (mediator bypassed) ══╗
║ You said: ${actual}
╚═════════════════════════════════════╝`);
    process.exit(0);
  }

  if (shouldSkip(prompt)) process.exit(0);

  const apiKey = loadApiKey();
  if (!apiKey) process.exit(0);

  try {
    const refined = await refine(prompt, apiKey);

    // Show both original and refined so user and Claude both see the full log
    console.log(`╔══ Mediator AI Log ══════════════════════════════════════════╗
║ 📨 You said  : ${prompt.trim()}
╠═════════════════════════════════════════════════════════════╣
║ ✨ Refined to: ${refined.replace(/\n/g, "\n║              ")}
╚═════════════════════════════════════════════════════════════╝`);
  } catch (err) {
    process.stderr.write(`[Mediator] error: ${err.message}\n`);
    process.exit(0);
  }
}

main();
