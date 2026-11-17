# SnackFlow Operations: Order-to-Audit ERP for a Small Food Factory

**Centre for Digital Infrastructure, NIT Tiruchirappalli — Internship Problem Statement**  
**Role-to-Audit System for Small-Scale South Indian Packaged Snack Manufacturing**

---

## 1. Quick Start (Single Command)

### Prerequisites
- Node.js (v18+ or v20+ or v22+; tested on Node v24)
- No build steps or compiler setup required — built with clean, standard JavaScript (`.js` files).

### Run the Interactive Web Server
```bash
npm start
# OR directly:
node src/server.js
```
Open **[http://localhost:8080](http://localhost:8080)** in your browser to access the complete interactive ERP with role switcher, mobile salesman order taking, production floor BOM logger, GST tax billing, live stock ledger, and auditor reports.

### Run the Automated Benchmark Runner (CLI)
```bash
npm run benchmark
# OR directly:
node benchmark.js
```

### Run the Automated Unit Tests
```bash
npm test
# OR directly:
node --test test.js
```

---

## 2. Technology Stack & Why

- **Pure JavaScript (`.js` modules):** Eliminates complex transpilation or compilation chains; runs directly on standard Node.js runtime and in modern browsers with maximum portability and zero startup latency.
- **Double-Entry Style Ledger Engine (`ledger-engine.js`):** Stock balances are strictly derived by reconciling immutable movements (`Opening + Inward - Outward = Closing`). Stock numbers can never be arbitrarily overwritten.
- **Integer-Paisa Financial Math (`money.js`):** Prevents floating-point drift across currency calculations, Indian GST (CGST/SGST/IGST), and consumption variances.
- **Embedded HTTP & SPA Server (`server.js`):** A lightweight server serving REST APIs and a responsive single-page application with zero heavy server dependencies.
- **Auditor & Compliance Hub (`reports.js`):** Generates Sales Register, GSTR-1 outward summaries, Purchase Register, Stock Summary & Ledger, Production Variance, Receivables Aging, CSV exports, and Tally-compatible XML vouchers.

---

## 3. Section 5 Benchmark Verification Matrix

Every benchmark number specified in the problem statement matches with **100% precision and zero unexplained differences**:

| Evaluation Check | Problem Statement Expected | SnackFlow Live Actual | Verification Status |
| :--- | :--- | :--- | :---: |
| **Flour closing balance** | 120 kg (100 + 60 − 40) | **120.0 kg** | **PASS ✓** |
| **Cooking oil closing balance** | 19.5 L (30 − 10.5) | **19.5 L** | **PASS ✓** |
| **Pouches closing balance** | 306 pcs (500 − 188 used − 6 damaged) | **306 pcs** | **PASS ✓** |
| **Finished goods after run** | 238 packets (50 opening + 188 output) | **238 packets** | **PASS ✓** |
| **Finished goods after Retailer A dispatch**| 88 packets (238 − 150) | **88 packets** | **PASS ✓** |
| **Yield variance** | 188 vs 200 expected, −6%, flagged | **−6.0% (Flagged: Yes)** | **PASS ✓** |
| **Oil consumption variance** | +5% over standard, flagged | **+5.0% (Flagged: Yes)** | **PASS ✓** |
| **Retailer A invoice total** | ₹7,500 taxable + ₹187.50 CGST + ₹187.50 SGST = ₹7,875 | **₹7,875.00** (Taxable: ₹7,500, CGST: ₹187.50, SGST: ₹187.50) | **PASS ✓** |
| **Retailer A outstanding balance** | ₹3,875 (₹7,875 − ₹4,000 paid) | **₹3,875.00** | **PASS ✓** |
| **Distributor B order shortage** | Shortage of 32 packets flagged; IGST applies | **Shortage: 32 pkts flagged (IGST 5% applies)** | **PASS ✓** |
| **Cost per packet (FIFO)** | Valuation method & overhead rule stated | **₹30.90 / packet** (Material: ₹4,010 + Overheads: ₹1,800) / 188 pkts | **PASS ✓** |
| **Cost per packet (Weighted Avg)** | Valuation method & overhead rule stated | **₹31.14 / packet** (Material: ₹4,055 + Overheads: ₹1,800) / 188 pkts | **PASS ✓** |

---

## 4. Costing & Valuation Breakdown (Benchmark Step 8)

For 1 production run of Murukku 200g (188 good packets produced):

### Material & Packaging Consumption:
- **Flour (40 kg):**
  - FIFO (Opening stock @ ₹42/kg): $40 \times 42 = \mathbf{₹1,680.00}$
  - Weighted Average ($\frac{100 \times 42 + 60 \times 45}{160} = ₹43.125/\text{kg}$): $40 \times 43.125 = \mathbf{₹1,725.00}$
- **Cooking Oil (10.5 L @ ₹140/L):** $10.5 \times 140 = \mathbf{₹1,470.00}$
- **Salt & Spice Mix (1.2 kg @ ₹200/kg):** $1.2 \times 200 = \mathbf{₹240.00}$
- **200g Printed Pouches (194 consumed = 188 good + 6 damaged @ ₹2.50):** $194 \times 2.50 = \mathbf{₹485.00}$
- **Master Cartons (9 used @ ₹15.00):** $9 \times 15.00 = \mathbf{₹135.00}$

### Overheads Allocated to the Run:
- Direct Labour: **₹1,200.00**
- Gas & Power: **₹600.00**
- Total Overheads: **₹1,800.00**

### Unit Cost & Margins:
- **FIFO Total Cost:** $₹4,010 + ₹1,800 = ₹5,810.00 \implies \mathbf{₹30.90 \text{ per packet}}$.
  - Gross Margin @ ₹50 selling price: **₹19.10 (38.2%)**.
- **Weighted Average Total Cost:** $₹4,055 + ₹1,800 = ₹5,855.00 \implies \mathbf{₹31.14 \text{ per packet}}$.
  - Gross Margin @ ₹50 selling price: **₹18.86 (37.7%)**.

---

## 5. Feature Coverage Against Problem Statement Tiers

### Must-Have Features (Section 6) — 100% Implemented
- [x] Multi-role authentication & Role Switcher (Salesman, Factory Admin, Production Supervisor, Auditor, Owner)
- [x] Item, Customer, Supplier, Raw Material, and BOM masters (Murukku 200g)
- [x] Mobile-friendly field order entry (< 1 min) & factory admin approval
- [x] Indian GST-compliant invoice generation (HSN 1905, state codes 33-TN and 29-KA, financial year sequence `INV/2026-27/0001`)
- [x] Production run updating raw-material & finished-goods stock automatically
- [x] Planned vs actual consumption and yield variance with threshold flagging (> 3%)
- [x] Continuous stock balance summary and detailed immutable stock ledger
- [x] Sales register & stock report exportable to CSV/Excel

### Should-Have Features — 100% Implemented
- [x] Purchase receipts & supplier records with automatic stock inwarding
- [x] Payment collection, invoice balance due, and customer aging (0-30, 31-60, 61-90, 90+ days)
- [x] Cost per packet with dual valuation (FIFO & Weighted Average) and overhead rules
- [x] GSTR-1 outward supplies summary (B2B, B2C, HSN summary)
- [x] Visual variance alerts for abnormal material consumption (+5% oil) and yield (−6%)
- [x] Owner executive dashboard (today's revenue, stock status, outstanding dues, margins)

### Stretch Goals Implemented
- [x] **Tally-Compatible Export:** Exports invoices as standard Tally XML vouchers for direct import into Tally Prime / ERP 9.
- [x] **Offline Order Capture:** Salesmen can record orders without internet; orders are queued and synced upon reconnection.
- [x] **Audit Trail & Immutability:** Edits and cancellations generate credit notes (`CN-...`); posted invoices are never hard-deleted.
- [x] **Production Planning from Pending Orders:** System computes batch requirement based on customer order quantities and BOM yield.

---

## 6. Pre-configured Users & Roles for Demo

| Role | Name | Phone / Login | Focus |
| :--- | :--- | :--- | :--- |
| **Salesman A** | Karthik Raja | `+91 94431 11222` | Tamil Nadu orders (Retailer A), mobile order taking |
| **Salesman B** | Manoj Kumar | `+91 94432 22333` | Karnataka orders (Distributor B), shortage alerts |
| **Factory Admin** | Suresh Babu | `+91 94433 33444` | Order verification, GST invoicing, dispatch, payments |
| **Production Supervisor**| Murugan Floor Lead| `+91 94434 44555` | Recipe BOM, raw material issue, output & wastage logging |
| **Auditor / CA** | R. Ramanathan & Co | `+91 44 2827 9999` | Sales register, GSTR-1, stock ledger, Tally XML export |
| **Factory Owner** | V. Sundaram | `+91 94430 00001` | Executive pulse, margins, receivables, overall health |

---

## 7. Assumptions & Known Gaps

1. **GST Rates:** Pre-set to 5% on Murukku (HSN 1905) per Indian GST notifications for branded namkeens/sweets; packaging carries 12-18% input credit.
2. **Factory Location:** Kappalur, Madurai, Tamil Nadu (`State Code: 33`, GSTIN: `33AAAAA0000A1Z5`).
3. **Overhead Allocation Rule:** Labour (₹1,200) and power (₹600) are assigned per production batch run.
4. **Rounding Rule:** Decimal paise precision (`Math.round((x + EPSILON) * 100) / 100`) is maintained on every transaction to prevent rounding drift.
