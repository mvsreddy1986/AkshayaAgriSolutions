import * as XLSX from "xlsx";

type Row = (string | number | null)[];

function buildSheet(headers: string[], notes: string[], rows: Row[]) {
  const data = [headers, notes, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Column widths — generous so nothing truncates
  ws["!cols"] = headers.map(() => ({ wch: 28 }));

  // Freeze top 2 rows (headers + notes)
  ws["!freeze"] = { xSplit: 0, ySplit: 2, topLeftCell: "A3" };

  return ws;
}

function download(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

// ─── PARTIES ────────────────────────────────────────────────────────────────

export function downloadPartiesTemplate() {
  const headers = [
    "Name", "Party Type", "GSTIN", "Mobile", "Email",
    "Address", "State", "Opening Balance", "Credit Limit", "Credit Days",
    "Business Flows", "Tax Profile", "Bank Account", "IFSC", "Bank Name",
  ];
  const notes = [
    "Full legal name", "Customer / Supplier / Farmer / Trader / Both",
    "15-char GST number (blank if unregistered)", "10-digit mobile", "Optional email",
    "Full postal address", "State name", "Opening debit/credit in ₹", "Credit limit in ₹", "Credit period days",
    "Comma-separated: A, B, C", "Registered / Unregistered / Composition",
    "Bank account number", "Bank IFSC code", "Bank branch name",
  ];
  const rows: Row[] = [
    ["Sarvani Biofuels Pvt Ltd", "Both", "37AAGCS8432B1ZK", "9848012345", "accounts@sarvanibio.in",
     "Industrial Area, Bhimavaram, West Godavari, AP 534202", "Andhra Pradesh", 0, 10000000, 21,
     "A,B,C", "Registered", "002305001234", "ICIC0000023", "ICICI Bank"],
    ["Mallikarjuna Traders", "Supplier", "37AABCM1234A1Z5", "9440012345", "",
     "Main Road, Tanuku, West Godavari, AP 534211", "Andhra Pradesh", 0, 0, 7,
     "A", "Registered", "67890123456", "SBIN0020301", "SBI"],
    ["Krishna Agro Suppliers", "Supplier", "37AABCK5678B1Z2", "9949876543", "",
     "NH-16, Eluru, West Godavari, AP 534004", "Andhra Pradesh", 0, 0, 7,
     "A", "Registered", "12312312312", "ANDB0001234", "Andhra Bank"],
    ["Ravi Kumar", "Farmer", "", "9848055555", "",
     "Village Achanta, Mandal Achanta, West Godavari, AP", "Andhra Pradesh", 0, 0, 0,
     "A,B", "Unregistered", "33412345678", "UBIN0559843", "Union Bank"],
    ["Suresh Yadav", "Farmer", "", "9866011223", "",
     "Village Narsapuram, West Godavari, AP", "Andhra Pradesh", 0, 0, 0,
     "A,B", "Unregistered", "44567890123", "PUNB0345600", "Punjab National Bank"],
    ["Venkata Ramana Reddy", "Farmer", "", "9490312456", "",
     "Village Palakol, West Godavari, AP", "Andhra Pradesh", 0, 0, 0,
     "B", "Unregistered", "55678901234", "CNRB0003456", "Canara Bank"],
    ["Sri Lakshmi Feeds", "Trader", "37AADCS9988C1ZP", "9848077890", "srilakshmi@feeds.in",
     "Feed Market, Bhimavaram, AP", "Andhra Pradesh", 0, 500000, 15,
     "C", "Registered", "66789012345", "HDFC0001122", "HDFC Bank"],
    ["Balaji Agro Products", "Trader", "37AAACB4321D1ZQ", "9440099887", "",
     "Rajam Road, Srikakulam, AP", "Andhra Pradesh", 0, 300000, 10,
     "C", "Registered", "77890123456", "KKBK0003344", "Kotak Bank"],
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSheet(headers, notes, rows), "Parties");
  download(wb, "AAS_Parties_Import_Template.xlsx");
}

// ─── MATERIALS ───────────────────────────────────────────────────────────────

export function downloadMaterialsTemplate() {
  const headers = [
    "Name", "HSN", "UOM", "GST Rate", "Category",
    "Default Gross Sale Rate", "Settlement Method", "Quality Params", "Status",
  ];
  const notes = [
    "Material name", "HSN code (4–8 digits)", "MT / KG / L / Bag", "GST % (0,5,12,18)", "Grain / Biomass / Chemical / Byproduct / Fuel",
    "₹ per UOM", "Description of how settlement is calculated", "Comma-separated quality parameter names", "Active / Draft / Inactive",
  ];
  const rows: Row[] = [
    ["Maize", "1005", "MT", 0, "Grain", 22500,
     "Quality deduction + cess", "Moisture %, Foreign matter %, Broken grain %, Aflatoxin ppm, Test weight", "Active"],
    ["Paddy Husk", "1213", "MT", 0, "Biomass", 2800,
     "GCV and ash based rate slab", "Moisture %, Ash content %, GCV Kcal/kg", "Active"],
    ["Coal", "2701", "MT", 5, "Fuel", 12000,
     "Weighted landed cost", "GCV Kcal/kg, Ash %, Moisture %, Sulphur %", "Active"],
    ["Biomass", "4401", "MT", 5, "Biomass", 3500,
     "Accepted weight", "Moisture %, Foreign matter %, GCV Kcal/kg", "Active"],
    ["DDGS", "2303", "MT", 0, "Byproduct", 18000,
     "Retail margin", "Moisture %, Protein %, Sand silica %, Fat %", "Active"],
    ["WDG", "2309", "MT", 0, "Byproduct", 9500,
     "Daily dispatch rate", "Moisture %, Freshness days", "Active"],
    ["CO2", "2811", "KG", 18, "Chemical", 28,
     "Bulk purchase ledger", "Purity %, Pressure bar", "Active"],
    ["Corn Oil", "1515", "L", 12, "Byproduct", 85,
     "Batch settlement", "FFA %, Moisture %, Impurities %, Color", "Active"],
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSheet(headers, notes, rows), "Materials");
  download(wb, "AAS_Materials_Import_Template.xlsx");
}

// ─── INWARD LOTS ─────────────────────────────────────────────────────────────

export function downloadInwardLotsTemplate() {
  const headers = [
    "Document Ref", "Business Model", "Date (DD/MM/YYYY)", "Material Name",
    "Customer Name", "Supplier Name", "Farmer Name", "Vehicle No",
    "Gross Weight (MT)", "Tare Weight (MT)", "Net Weight (MT)", "Accepted Weight (MT)",
    "Moisture %", "FM %", "Gross Sale Rate (₹/MT)", "Gross Sale Value (₹)", "Status",
  ];
  const notes = [
    "Unique lot reference (e.g. DR-12MAY-001)", "A, B, or C", "Date of weighment",
    "Must match a material in your materials sheet", "Buyer (usually Sarvani Biofuels Pvt Ltd)",
    "Supplier party name (Model A)", "Farmer name (Model A/B)",
    "Vehicle registration number", "Gross vehicle weight MT", "Tare (empty vehicle) weight MT",
    "Net = Gross − Tare", "Accepted after quality tolerance",
    "Moisture percentage", "Foreign matter percentage",
    "Agreed sale rate ₹/MT", "Accepted Weight × Rate", "Draft / Approved / QualityHold",
  ];
  const rows: Row[] = [
    ["DR-12MAY-001", "A", "12/05/2026", "Maize",
     "Sarvani Biofuels Pvt Ltd", "Mallikarjuna Traders", "Ravi Kumar", "AP39CD1234",
     24.50, 3.80, 20.70, 20.35, 14.2, 0.8, 22500, 457875, "Approved"],
    ["DR-12MAY-002", "A", "12/05/2026", "Maize",
     "Sarvani Biofuels Pvt Ltd", "Krishna Agro Suppliers", "Suresh Yadav", "AP39EF5678",
     21.80, 3.60, 18.20, 17.90, 15.1, 1.2, 22500, 402750, "Approved"],
    ["DR-12MAY-003", "A", "12/05/2026", "Maize",
     "Sarvani Biofuels Pvt Ltd", null, null, "AP39GH9012",
     26.40, 4.10, 22.30, 21.85, 13.8, 1.8, 22500, 491625, "QualityHold"],
    ["FF-12MAY-001", "B", "12/05/2026", "Maize",
     "Sarvani Biofuels Pvt Ltd", null, "Venkata Ramana Reddy", "AP39IJ3456",
     19.20, 3.20, 16.00, 15.75, 14.5, 0.6, 22500, 354375, "Draft"],
    ["CR-12MAY-001", "C", "12/05/2026", "DDGS",
     "Sri Lakshmi Feeds", "Sarvani Biofuels Pvt Ltd", null, "AP39KL7890",
     18.00, 2.80, 15.20, 15.00, 12.0, 0.4, 18000, 270000, "Approved"],
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSheet(headers, notes, rows), "Inward Lots");
  download(wb, "AAS_InwardLots_Import_Template.xlsx");
}

// ─── INVOICES ────────────────────────────────────────────────────────────────

export function downloadInvoicesTemplate() {
  const headers = [
    "Invoice No", "Invoice Type", "Business Model", "Invoice Date", "Due Date",
    "Party Name", "Material Name", "Quantity (MT)", "UOM",
    "Gross Rate (₹/MT)", "Gross Value (₹)", "Taxable Value (₹)",
    "CGST Rate %", "SGST Rate %", "IGST Rate %",
    "CGST Amount (₹)", "SGST Amount (₹)", "IGST Amount (₹)",
    "Total Tax (₹)", "Total Value (₹)", "Amount Paid (₹)", "Amount Due (₹)", "Status",
  ];
  const notes = [
    "Serial number (e.g. AAS-2627-0122)", "Sales / Purchase / DebitNote / CreditNote",
    "A, B, or C", "Invoice date DD/MM/YYYY", "Payment due date DD/MM/YYYY",
    "Party legal name", "Material name", "Quantity in UOM", "MT / KG / L / Bag",
    "Rate per UOM", "Qty × Rate", "Gross Value minus any exemptions",
    "CGST % (intra-state)", "SGST % (intra-state)", "IGST % (inter-state)",
    "Taxable × CGST%/100", "Taxable × SGST%/100", "Taxable × IGST%/100",
    "CGST + SGST + IGST", "Taxable + Total Tax", "Amount received so far", "Total Value − Amount Paid",
    "Draft / Approved / Sent / Partial / Paid",
  ];
  const rows: Row[] = [
    ["AAS-2627-0122", "Sales", "A", "12/05/2026", "02/06/2026",
     "Sarvani Biofuels Pvt Ltd", "Maize", 450.25, "MT",
     22500, 10130625, 10130625, 0, 0, 0, 0, 0, 0, 0, 10130625, 0, 10130625, "Approved"],
    ["AAS-2627-0123", "Sales", "B", "13/05/2026", "03/06/2026",
     "Sarvani Biofuels Pvt Ltd", "Maize", 62.80, "MT",
     22500, 1413000, 1413000, 0, 0, 0, 0, 0, 0, 0, 1413000, 0, 1413000, "Draft"],
    ["AAS-2627-0124", "Sales", "C", "13/05/2026", "28/05/2026",
     "Sri Lakshmi Feeds", "DDGS", 17.40, "MT",
     18000, 313200, 313200, 0, 0, 0, 0, 0, 0, 0, 313200, 0, 313200, "Sent"],
    ["AAS-2627-0125", "Sales", "C", "13/05/2026", "23/05/2026",
     "Balaji Agro Products", "DDGS", 14.20, "MT",
     18000, 255600, 255600, 0, 0, 0, 0, 0, 0, 0, 255600, 255600, 0, "Paid"],
    ["SARB-2627-0044", "Purchase", "C", "05/05/2026", "25/05/2026",
     "Sarvani Biofuels Pvt Ltd", "DDGS", 45.80, "MT",
     16500, 755700, 755700, 0, 0, 0, 0, 0, 0, 0, 755700, 755700, 0, "Paid"],
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSheet(headers, notes, rows), "Invoices");
  download(wb, "AAS_Invoices_Import_Template.xlsx");
}
