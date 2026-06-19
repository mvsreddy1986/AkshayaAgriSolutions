/**
 * Parser for "Sarvani Bio Fuels – Consignor Wise Finished Weighing Trs Detailed Report" PDFs.
 *
 * Handles two layouts that pdf-parse produces depending on whether the
 * "Vehicle Type" column is populated (3-row vs 4-row transaction format).
 *
 * 3-ROW FORMAT (old) — transaction+product+challan merge onto one anchor line:
 *   "INBOUNDPADDY HUSK2627000107"   (pdf-parse merges columns)
 *   "2627000515 INBOUND PADDY HUSK" (alternate merge order)
 *
 * 4-ROW FORMAT (new) — Vehicle Type column populated, breaks the merge:
 *   "2627000602 PADDY HUSK"   (challan-first, no INBOUND)
 *   "PADDY HUSK2627000602"    (product-first, no space before challan)
 *   INBOUND appears on a separate line 1–5 lines above the anchor.
 *
 * NET+DATE — both variants supported:
 *   Merged (old):  "1794008-Apr-26"   net digits immediately before date
 *   Split  (new):  "08-Apr-26 17940"  date then space then net
 *
 * Gross and tare are always the two pure-number lines immediately before NET_DATE.
 */

export interface SarvaniLot {
  challanNo: string;
  lotDate: string;
  vehicleNo: string;
  product: string;
  grossWeightMT: number;
  tareWeightMT: number;
  netWeightMT: number;
}

export interface SarvaniParseResult {
  lots: SarvaniLot[];
  reportDate: string | null;
  consignorName: string | null;
  errors: string[];
}

// ── Utilities ─────────────────────────────────────────────────────────────────

const MON: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

function parseDate(raw: string): string {
  const [day, mon, yr] = raw.split("-");
  return `20${yr.padStart(2, "0")}-${MON[mon] ?? "01"}-${day.padStart(2, "0")}`;
}

const MON_PAT = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";

// ── Anchor patterns ───────────────────────────────────────────────────────────

// A: old merged — INBOUND first, product, then challan (no spaces between tokens)
//    "INBOUNDPADDY HUSK2627000107"  or  "INBOUND PADDY HUSK 2627000107"
const ANCHOR_A = /^(INBOUND|OUTBOUND)([A-Z][A-Z\- ]*)(\d{8,10})$/i;

// B: challan first — optional INBOUND, then product
//    "2627000602 PADDY HUSK"  or  "2627000107 INBOUND PADDY HUSK"
const ANCHOR_B = /^(\d{8,10})\s+(?:(INBOUND|OUTBOUND)\s+)?([A-Z][A-Z\-\s]+[A-Z\-])$/i;

// C: product first merged with challan (no space between product and digits)
//    "PADDY HUSK2627000602"
const ANCHOR_C = /^([A-Z][A-Z\-\s]{2,})(\d{8,10})$/i;

interface AnchorHit {
  challanNo: string;
  product: string;
  txnType: string | null; // null means we need to look in nearby lines
}

function tryAnchor(line: string): AnchorHit | null {
  const mA = line.match(ANCHOR_A);
  if (mA) {
    return {
      challanNo: mA[3],
      product: mA[2].trim().replace(/\s+/g, " ").toUpperCase(),
      txnType: mA[1].toUpperCase(),
    };
  }

  const mB = line.match(ANCHOR_B);
  if (mB) {
    const product = mB[3].trim().replace(/\s+/g, " ").toUpperCase();
    if (product.length < 3) return null;
    return {
      challanNo: mB[1],
      product,
      txnType: mB[2]?.toUpperCase() ?? null,
    };
  }

  const mC = line.match(ANCHOR_C);
  if (mC) {
    const product = mC[1].trim().replace(/\s+/g, " ").toUpperCase();
    if (product.length < 3) return null;
    return {
      challanNo: mC[2],
      product,
      txnType: null,
    };
  }

  return null;
}

// ── NET + DATE patterns ───────────────────────────────────────────────────────

// Old merged:  "1794008-Apr-26"  (net digits run straight into date)
const NET_DATE_MERGED = new RegExp(`^(\\d{3,6})(\\d{2}-(?:${MON_PAT})-\\d{2})$`, "i");

// New split:   "08-Apr-26 17940"  (date, space, net)
const NET_DATE_SPLIT  = new RegExp(`^(\\d{2}-(?:${MON_PAT})-\\d{2})\\s+(\\d{3,6})$`, "i");

function matchNetDate(line: string): { netKg: number; date: string } | null {
  const mA = line.match(NET_DATE_MERGED);
  if (mA) return { netKg: parseInt(mA[1], 10), date: parseDate(mA[2]) };
  const mB = line.match(NET_DATE_SPLIT);
  if (mB) return { netKg: parseInt(mB[2], 10), date: parseDate(mB[1]) };
  return null;
}

// ── Misc ──────────────────────────────────────────────────────────────────────

// Indian vehicle registration  e.g. AP40EX5896, TG07X0711, TS12UB1619
const VEHICLE_RE = /\b([A-Z]{2}\d{2}[A-Z]{1,3}\d{4})\b/;

// Pure integer 3–6 digits (gross / tare weights in KG)
const PURE_NUM_RE = /^\d{3,6}$/;

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseSarvaniText(text: string): SarvaniParseResult {
  const errors: string[] = [];

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Header metadata
  let reportDate: string | null = null;
  let consignorName: string | null = null;
  for (const line of lines) {
    if (!reportDate) {
      const m = line.match(/Report From\s+(\d{2}-\w{3}-\d{2})/i);
      if (m) reportDate = parseDate(m[1]);
    }
    if (!consignorName) {
      const m = line.match(/Consignor:\s+(.+)/i);
      if (m) consignorName = m[1].trim();
    }
    if (reportDate && consignorName) break;
  }

  const lots: SarvaniLot[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const anchor = tryAnchor(lines[i]);
    if (!anchor) continue;

    const { challanNo, product } = anchor;
    if (seen.has(challanNo)) continue;

    // If INBOUND/OUTBOUND not found on the anchor line (patterns B/C),
    // confirm by looking ≤5 lines backward.
    let txnType = anchor.txnType;
    if (!txnType) {
      for (let k = i - 1; k >= Math.max(0, i - 5); k--) {
        const m = lines[k].match(/\b(INBOUND|OUTBOUND)\b/i);
        if (m) { txnType = m[1].toUpperCase(); break; }
      }
      // Without INBOUND/OUTBOUND confirmation this line is not a transaction anchor
      if (!txnType) continue;
    }

    // Scan backward ≤25 lines for NET_DATE and vehicle number
    let vehicleNo = "";
    let netKg = 0;
    let lotDate: string = reportDate ?? new Date().toISOString().slice(0, 10);
    let netDateIdx = -1;

    for (let j = i - 1; j >= Math.max(0, i - 25); j--) {
      if (netDateIdx === -1) {
        const nd = matchNetDate(lines[j]);
        if (nd) { netKg = nd.netKg; lotDate = nd.date; netDateIdx = j; }
      }
      if (!vehicleNo) {
        const vm = lines[j].match(VEHICLE_RE);
        if (vm) vehicleNo = vm[1];
      }
      if (netDateIdx !== -1 && vehicleNo) break;
    }

    if (netDateIdx < 2) continue; // need 2 lines before NET_DATE for gross/tare

    const tareLine  = lines[netDateIdx - 1];
    const grossLine = lines[netDateIdx - 2];
    if (!PURE_NUM_RE.test(tareLine) || !PURE_NUM_RE.test(grossLine)) continue;

    const tareKg  = parseInt(tareLine, 10);
    const grossKg = parseInt(grossLine, 10);

    // Gross − Tare should ≈ Net (allow ±200 kg rounding tolerance)
    if (Math.abs(grossKg - tareKg - netKg) > 200) continue;

    seen.add(challanNo);
    lots.push({
      challanNo,
      lotDate,
      vehicleNo: vehicleNo || "",
      product,
      grossWeightMT: grossKg / 1000,
      tareWeightMT:  tareKg  / 1000,
      netWeightMT:   netKg   / 1000,
    });
  }

  if (lots.length === 0) {
    errors.push("No weighment transactions found. Check that this is a Sarvani weighbridge PDF.");
  }

  return { lots, reportDate, consignorName, errors };
}
