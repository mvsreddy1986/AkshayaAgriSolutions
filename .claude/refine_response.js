#!/usr/bin/env node
/**
 * Akshaya Agri ERP — OpenAI Response Refiner
 * Runs as a Claude Code Stop hook (after Claude finishes responding).
 *
 * Flow:
 *   Claude finishes → this script reads last response from transcript →
 *   sends to OpenAI → gets concise developer summary →
 *   prints it so the user sees a clean action-oriented wrap-up
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

// ── Read last assistant message from transcript ───────────────────────────────

function getLastAssistantMessage(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return "";

  const lines = fs.readFileSync(transcriptPath, "utf8")
    .split("\n")
    .filter(Boolean);

  // Walk backwards to find the last assistant message
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const entry = JSON.parse(lines[i]);

      // Transcript entries can be role/content or message objects
      if (entry.role === "assistant") {
        const content = entry.content;
        if (typeof content === "string") return content;
        if (Array.isArray(content)) {
          return content
            .filter((c) => c.type === "text")
            .map((c) => c.text)
            .join("\n");
        }
      }

      // Nested under message key
      if (entry.message?.role === "assistant") {
        const content = entry.message.content;
        if (typeof content === "string") return content;
        if (Array.isArray(content)) {
          return content
            .filter((c) => c.type === "text")
            .map((c) => c.text)
            .join("\n");
        }
      }
    } catch {
      // Skip malformed lines
    }
  }
  return "";
}

// ── System prompt for response summarisation ─────────────────────────────────

const SYSTEM_PROMPT = `You are a concise technical summariser for a developer working on an agricultural ERP (Akshaya Agri Solutions) built with Next.js + TypeScript + Supabase.

Given Claude's full response, produce a SHORT developer-friendly summary with exactly these three sections:

✅ Done: One sentence on what was completed or answered.
📁 Files: List only the files actually changed (skip if none).
▶ Next: One actionable suggestion for what to do next.

Rules:
- Total output: under 80 words
- Skip any section that doesn't apply (e.g. no files changed for a Q&A)
- Use plain language, no markdown headers
- Do NOT repeat Claude's full explanation — only the essence`;

// ── OpenAI call ───────────────────────────────────────────────────────────────

async function summarise(responseText, apiKey) {
  const { default: OpenAI } = require("openai");
  const openai = new OpenAI({ apiKey });

  const result = await openai.responses.create({
    model: "gpt-4o-mini",
    instructions: SYSTEM_PROMPT,
    input: `Claude's response to summarise:\n\n${responseText.slice(0, 4000)}`,
  });

  return result.output_text;
}

// ── Skip conditions ───────────────────────────────────────────────────────────
// Don't summarise very short responses (confirmations, one-liners)

function shouldSkip(text) {
  if (!text) return true;
  if (text.trim().split(/\s+/).length < 40) return true;  // under 40 words
  return false;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Read Stop hook input from stdin
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;

  let transcriptPath = "";
  try {
    const hookInput = JSON.parse(raw);
    transcriptPath = hookInput.transcript_path ?? "";
  } catch {
    // ignore
  }

  const lastResponse = getLastAssistantMessage(transcriptPath);
  if (shouldSkip(lastResponse)) process.exit(0);

  const apiKey = loadApiKey();
  if (!apiKey) process.exit(0);

  try {
    const summary = await summarise(lastResponse, apiKey);
    console.log(`\n─────────────────────────────────────\n🤖 AI Summary\n${summary}\n─────────────────────────────────────`);
  } catch {
    process.exit(0); // never block on failure
  }
}

main();
