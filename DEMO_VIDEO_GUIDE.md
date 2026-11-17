# SnackFlow Operations: Official Demo Video Script & Submission Guide
**Centre for Digital Infrastructure, NIT Tiruchirappalli**
**Internship Problem Statement: Order-to-Audit System for a Small Food Manufacturer**

---

## 1. Demo Video Overview

This guide accompanies the automated in-app video recorder and provides a timestamped, professional voiceover script for submitting the video requirement.

| Property | Value |
|---|---|
| **Project Name** | SnackFlow Operations (Order-to-Audit ERP) |
| **Target Business** | Small packaged South Indian snack factory (Murukku 200g, mixture, chips) |
| **Evaluation Scenario** | Section 5 Benchmark (Mandatory end-to-end 9-step test) |
| **Output Video Format** | HD 1080p / 720p (`.webm` or `.mp4`), 16:9 Widescreen |
| **Recommended Duration** | 2:30 to 3:30 minutes |

---

## 2. In-App 1-Click Video Generator

The application includes an integrated **Demo Video Recorder Studio** located at:
`http://localhost:8080` &rarr; Tab: **🎬 Demo Video & Recorder**

### How to generate and download the video:
1. Start the server:
   ```bash
   node src/server.js
   ```
2. Open `http://localhost:8080` in Chrome, Edge, or Brave.
3. Click on the **🎬 Demo Video & Recorder** tab.
4. Click the green button: **"🎥 Record & Download Demo Video"**.
5. The built-in Canvas Studio animates all 9 steps, shows the two loops, records all 11 criteria, and synthesizes audio chimes.
6. Upon completion, it automatically triggers a download of:
   `snackflow_benchmark_demo_video.webm`
7. You can upload this `.webm` file directly to Google Drive, YouTube (unlisted), or the NIT Trichy internship portal.

---

## 3. Timestamped Screen Recording & Voiceover Script

If you wish to record your own voiceover or webcam screen capture, use this exact script:

```
[00:00 - 00:25] INTRODUCTION & THE TWO LOOPS
"Hello everyone. This is SnackFlow Operations, an Order-to-Audit ERP designed for a small South
Indian packaged food manufacturer, addressing the shortlisting challenge for the Centre for
Digital Infrastructure at NIT Tiruchirappalli.

Traditional snack factories struggle with disconnected operations: field salesmen taking orders
on WhatsApp, manual GST invoicing, paper-based recipe tracking, and month-end audit stress.

SnackFlow solves this by linking two real-world business loops:
1. The Sales Loop: Salesman order to Admin approval, GST tax invoicing, dispatch, and collections.
2. The Production Loop: Raw material purchasing, recipe-based BOM issuance, yield and consumption
   variance tracking, and cost per packet computation.
Both loops meet at Finished Goods Stock and flow automatically into monthly auditor reports."

[00:25 - 00:50] STEP 1: OPENING STOCK & RAW MATERIAL PURCHASE
"Let's walk through the mandatory Section 5 benchmark.
We begin with our opening balances: Flour 100 kg at ₹42, Cooking Oil 30 L at ₹140, Salt and
Spice mix 5 kg at ₹200, 500 pouches, 30 master cartons, and 50 packets of finished Murukku 200g.

In Step 1, we record an inward purchase of 60 kg flour at ₹45/kg from Madurai Flour Mills.
Our stock ledger immediately updates: 100 kg opening + 60 kg received gives a closing flour
balance of 160 kg."

[00:50 - 01:25] STEP 2, 3 & 8: RECIPE BOM, PRODUCTION RUN & COSTING
"In Step 2 and 3, the factory initiates a production run for Murukku 200g.
Our Bill of Materials specifies that one 200-packet batch requires 40 kg flour, 10 L oil,
and 1.2 kg spice mix.
On the floor, the supervisor issues:
- 40 kg flour (standard)
- 10.5 L cooking oil (+0.5 L over standard)
- 1.2 kg spice mix

The run yields 188 good packets, 6 damaged pouches, and 9 cartons used.
Notice how SnackFlow immediately flags the variances:
- Yield variance is 188 vs 200 expected, a -6% shortfall, flagged exceeding our 3% tolerance.
- Oil consumption variance is +5% excess, flagged in red.
Finished goods stock automatically increases from 50 opening + 188 produced to 238 packets.

In Step 8, we allocate ₹1,200 labour and ₹600 gas/power overheads to the run.
SnackFlow calculates cost per packet under both standards:
- FIFO Cost per packet: ₹30.90, yielding a 38.2% gross profit margin against our ₹50 selling price.
- Weighted Average Cost: ₹31.14, yielding a 37.7% gross profit margin."

[01:25 - 01:55] STEP 4 & 5: SALESMAN ORDER & GST TAX INVOICING (TAMIL NADU)
"In Step 4, Salesman A visits Retailer A (Chennai Stores, Tamil Nadu) on mobile and books an
order for 150 packets.
In Step 5, the factory admin verifies stock coverage. 238 packets are in stock, so the order
is approved and converted to GST Tax Invoice INV/2026-27/0001:
- Taxable value (150 * ₹50): ₹7,500.00
- Intra-state CGST (2.5%): ₹187.50
- Intra-state SGST (2.5%): ₹187.50
- Grand Total: ₹7,875.00
Upon recording dispatch, finished goods stock drops automatically from 238 to 88 packets."

[01:55 - 02:25] STEP 6 & 7: DISTRIBUTOR B SHORTAGE & PAYMENT COLLECTION
"In Step 6, Salesman B books an order for Distributor B in Karnataka for 120 packets.
SnackFlow's real-time inventory validation flags an INSUFFICIENT STOCK WARNING:
Available stock is 88 packets, so a shortage of 32 packets is clearly indicated before approval.
Because the place of supply is Karnataka (State Code 29), inter-state IGST of 5% applies.

In Step 7, we record a payment collection of ₹4,000 received via NEFT from Retailer A.
Retailer A's outstanding balance immediately updates from ₹7,875 to ₹3,875."

[02:25 - 03:00] STEP 9: AUDITOR MONTHLY REPORTS & 11 CHECK VERIFICATION
"Finally, in Step 9, we navigate to the Auditor Hub:
- GSTR-1 outward tax liability matches ₹375.00 under HSN 1905.
- Receivables aging shows Retailer A's ₹3,875 in the 0-30 day bucket.
- Stock ledger provides full traceability for raw, packaging, and finished goods.
- 1-click exports are available for CSV and Tally XML vouchers.

Looking at our Section 5 Benchmark Verification Matrix:
All 11 criteria—Flour 120kg, Oil 19.5L, Pouches 306, FG 238 pkts after run, FG 88 pkts after dispatch,
Yield -6% flagged, Oil +5% flagged, Retailer A invoice ₹7,875, Outstanding ₹3,875, Distributor B shortage 32 pkts,
and FIFO costing ₹30.90—have passed with 100% precision.

Thank you!"
```

---

## 4. Evaluation Checklist Mapping

| Check # | Metric | Benchmark Target | SnackFlow Verified Result |
|---|---|---|---|
| **1** | Flour closing balance | 120 kg (100 + 60 − 40) | **120 kg** (PASS ✓) |
| **2** | Oil closing balance | 19.5 L (30 − 10.5) | **19.5 L** (PASS ✓) |
| **3** | Pouches closing balance | 306 pcs (500 − 188 − 6) | **306 pcs** (PASS ✓) |
| **4** | Finished goods after run | 238 packets (50 + 188) | **238 packets** (PASS ✓) |
| **5** | Finished goods after dispatch | 88 packets (238 − 150) | **88 packets** (PASS ✓) |
| **6** | Yield variance | 188 vs 200 (-6%, flagged) | **-6.0% (Flagged)** (PASS ✓) |
| **7** | Oil consumption variance | +5% (flagged) | **+5.0% (Flagged)** (PASS ✓) |
| **8** | Retailer A invoice total | ₹7,875 (₹7,500 + ₹187.50 + ₹187.50) | **₹7,875.00** (PASS ✓) |
| **9** | Retailer A outstanding balance | ₹3,875 (₹7,875 − ₹4,000) | **₹3,875.00** (PASS ✓) |
| **10** | Distributor B order shortage | Shortage of 32 packets flagged | **32 packets Shortage** (PASS ✓) |
| **11** | Cost per packet & Overheads | FIFO: ₹30.90 / Weighted Avg: ₹31.14 | **₹30.90 / ₹31.14** (PASS ✓) |
