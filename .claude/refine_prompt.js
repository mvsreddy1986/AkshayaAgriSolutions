#!/usr/bin/env node
/**
 * Akshaya Agri ERP — OpenAI Prompt Mediator v2
 * Runs as a Claude Code UserPromptSubmit hook.
 *
 * v2: reads transcript_path from hook input to get recent conversation context,
 * so references like "point 1", "that bug", numbered items from Claude's last
 * response are resolved correctly before refining.
 *
 * Normal flow:  Your message → Mediator (with context) → Claude sees both
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
  if (p.startsWith("/")) return true;
  if (SKIP_EXACT.has(p)) return true;
  if (/^(git |npm |npx )/.test(p)) return true;
  if (SKIP_TOPICS.some((t) => p.includes(t))) return true;
  return false;
}

// ── Read recent conversation from Claude Code transcript JSONL ────────────────
// Claude Code provides transcript_path in the hook input JSON.
// We parse the last 200 lines and extract recent user+assistant text turns.

function getRecentConversation(transcriptPath, maxExchanges) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return [];
  maxExchanges = maxExchanges || 6;
  try {
    const allLines = fs.readFileSync(transcriptPath, "utf8").split("\n").filter(function(l) { return l.trim(); });
    const lines = allLines.slice(-200);
    const messages = [];
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type === "user" && entry.message && entry.message.content) {
          const parts = Array.isArray(entry.message.content)
            ? entry.message.content.filter(function(c) { return c.type === "text"; }).map(function(c) { return c.text; })
            : [String(entry.message.content)];
          const text = parts.join("\n").trim();
          if (text) messages.push({ role: "user", content: text.slice(0, 400) });
        } else if (entry.type === "assistant" && entry.message && entry.message.content) {
          const parts = Array.isArray(entry.message.content)
            ? entry.message.content.filter(function(c) { return c.type === "text"; }).map(function(c) { return c.text; })
            : [String(entry.message.content)];
          const text = parts.join("\n").trim();
          // Truncate long assistant messages — we only need enough to understand context
          if (text) messages.push({ role: "assistant", content: text.slice(0, 1200) });
        }
      } catch (e) { /* skip malformed lines */ }
    }
    // Exclude the last entry (the current prompt, added separately in refine())
    return messages.slice(-(maxExchanges * 2 + 1), -1);
  } catch (e) {
    return [];
  }
}

// ── ERP system context ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior software architect for Akshaya Agri Solutions ERP (Next.js 15 + TypeScript + Supabase).

Key facts:
- Models: A (Akshaya intermediates Supplier to Sarvani Biofuels, earns margin + quality deductions), B (direct farmer), C (byproduct)
- Lot flow: Draft → Mapped → QualityHold → Approved → Settled → Invoiced
- Key files: src/app/erp/procurement/page.tsx, src/app/erp/accounting/page.tsx, src/lib/settlement/engine.ts, src/lib/types/index.ts, src/lib/db.ts
- Accounts: 1100 Bank, 1201 Sarvani AR, 2101 Supplier Payable, 3100 Sales, 3200 Margin, 5001 Procurement, 5101 Market Cess
- Materials: Maize, DDGS, WDG, Paddy Husk, Coal, Corn Oil

IMPORTANT: You have RECENT CONVERSATION HISTORY below. Use it to resolve references like "point 1 and 2",
"that bug", "the issue we discussed", or numbered items from a prior Claude response.

When refining a vague instruction:
1. Check conversation history first — if user refers to numbered points or items from Claude output, identify them exactly
2. Identify the specific file/component involved
3. Rewrite as a precise coding task: what to change, which files, expected outcome
4. Keep it under 5 sentences
5. If the message is already specific, return it unchanged

Output ONLY the refined task. No preamble, no label.`;

// ── OpenAI call with conversation context ─────────────────────────────────────

async function refine(prompt, context, apiKey) {
  const { default: OpenAI } = require("openai");
  const openai = new OpenAI({ apiKey });
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...context,
    { role: "user", content: "Refine this new message (use the conversation above for context):\n\n\"" + prompt + "\"" },
  ];
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: messages,
    max_tokens: 300,
    temperature: 0.2,
  });
  return res.choices[0].message.content.trim();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;

  let prompt = "";
  let transcriptPath = "";
  try {
    const hookInput = JSON.parse(raw);
    prompt         = hookInput.prompt          || "";
    transcriptPath = hookInput.transcript_path || "";
  } catch (e) {
    prompt = raw.trim();
  }

  if (!prompt) process.exit(0);

  if (isDirectBypass(prompt)) {
    const actual = prompt.replace(/^\/\/\s*/, "").trim();
    console.log("╔══ DIRECT MODE (mediator bypassed) ══╗\n║ You said: " + actual + "\n╚═════════════════════════════════════╝");
    process.exit(0);
  }

  if (shouldSkip(prompt)) process.exit(0);

  const apiKey = loadApiKey();
  if (!apiKey) process.exit(0);

  try {
    const context = getRecentConversation(transcriptPath);
    const refined = await refine(prompt, context, apiKey);
    const ctxNote = context.length > 0
      ? " · " + Math.ceil(context.length / 2) + " prior turns"
      : " · no prior context";
    console.log(
      "╔══ Mediator AI Log" + ctxNote + " ══════════════════════════════╗\n" +
      "║ 📨 You said  : " + prompt.trim() + "\n" +
      "╠═════════════════════════════════════════════════════════════╣\n" +
      "║ ✨ Refined to: " + refined.replace(/\n/g, "\n║              ") + "\n" +
      "╚═════════════════════════════════════════════════════════════╝"
    );
  } catch (err) {
    process.stderr.write("[Mediator] error: " + err.message + "\n");
    process.exit(0);
  }
}

main();
