# SnackFlow Operations: Order-to-Audit System for a Small Food Manufacturer

Centre for Digital Infrastructure, NIT Tiruchirappalli - Internship Problem Statement

## 1. Background
Build a working prototype of one system that takes a small food factory from a salesman's order to the monthly auditor's report.
The client is a small-scale manufacturer of packaged South Indian snacks (murukku, mixture, chips, sweets). It has 5–15 field salesmen visiting retailers and distributors, one factory with an admin/billing desk, a production floor, and an external accountant and auditor.

## 2. Core Architecture
- **Sales Loop**: Salesman order → Admin verifies & approves → GST invoice (CGST/SGST or IGST) → Dispatch (Finished goods stock goes down) → Receivables and collections.
- **Production Loop**: Raw material purchased → Issued to production against Recipe (BOM) → Finished packets produced → Finished goods stock goes up → Variance and cost per packet.
- **Single Source of Truth**: Both loops meet at Finished Goods Stock and feed monthly auditor reports (Sales Register, GSTR summary, Stock Summary & Ledger, Production Variance, Receivables & Aging).
- **Benchmark Scenario**: Murukku 200g production run, variance checks, sales order, dispatch, payment, overhead costing, and auditor reports.
