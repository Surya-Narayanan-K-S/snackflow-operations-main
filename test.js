/**
 * Automated Test Suite for SnackFlow Operations
 * Run with: node --test test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateGST, calculateVariance, toPaisa, fromPaisa } from './money.js';
import { LedgerEngine } from './ledger-engine.js';
import { ReportingEngine } from './reports.js';

test('1. Decimal & Integer Paisa Arithmetic', () => {
  assert.equal(toPaisa(187.5), 18750);
  assert.equal(fromPaisa(18750), 187.5);
  assert.equal(toPaisa(7875.0), 787500);
});

test('2. Intra-state GST (Tamil Nadu to Tamil Nadu): CGST 2.5% + SGST 2.5%', () => {
  // Retailer A: 150 pkts * ₹50 = ₹7,500
  const gst = calculateGST(7500, 5, '33', '33');
  assert.equal(gst.isInterState, false);
  assert.equal(gst.taxableValue, 7500.0);
  assert.equal(gst.cgstAmount, 187.5);
  assert.equal(gst.sgstAmount, 187.5);
  assert.equal(gst.igstAmount, 0.0);
  assert.equal(gst.totalTax, 375.0);
  assert.equal(gst.totalWithTax, 7875.0);
});

test('3. Inter-state GST (Tamil Nadu to Karnataka): IGST 5.0%', () => {
  // Distributor B: 120 pkts * ₹50 = ₹6,000
  const gst = calculateGST(6000, 5, '33', '29');
  assert.equal(gst.isInterState, true);
  assert.equal(gst.taxableValue, 6000.0);
  assert.equal(gst.cgstAmount, 0.0);
  assert.equal(gst.sgstAmount, 0.0);
  assert.equal(gst.igstAmount, 300.0);
  assert.equal(gst.totalTax, 300.0);
  assert.equal(gst.totalWithTax, 6300.0);
});

test('4. Variance Analysis and Tolerance Flags', () => {
  // Yield variance: 188 output vs 200 expected = -6%, flagged
  const yieldVar = calculateVariance(188, 200, 3.0);
  assert.equal(yieldVar.diffQty, -12);
  assert.equal(yieldVar.variancePercent, -6.0);
  assert.equal(yieldVar.isFlagged, true);
  assert.equal(yieldVar.direction, 'saving');

  // Oil variance: 10.5 L vs 10 L expected = +5%, flagged
  const oilVar = calculateVariance(10.5, 10.0, 3.0);
  assert.equal(oilVar.diffQty, 0.5);
  assert.equal(oilVar.variancePercent, 5.0);
  assert.equal(oilVar.isFlagged, true);
  assert.equal(oilVar.direction, 'excess');
});

test('5. End-to-End Section 5 Benchmark Execution and 11 Checks', () => {
  const engine = new LedgerEngine();
  const metrics = engine.runFullBenchmark();

  // 1. Flour closing: 120 kg (100 opening + 60 purchase - 40 used)
  assert.equal(metrics.flourClosing, 120, 'Flour closing must be 120 kg');
  assert.equal(metrics.checks.flourClosingMatch, true);

  // 2. Oil closing: 19.5 L (30 opening - 10.5 used)
  assert.equal(metrics.oilClosing, 19.5, 'Oil closing must be 19.5 L');
  assert.equal(metrics.checks.oilClosingMatch, true);

  // 3. Pouches closing: 306 (500 opening - 188 used - 6 damaged)
  assert.equal(metrics.pouchesClosing, 306, 'Pouches closing must be 306 pcs');
  assert.equal(metrics.checks.pouchesClosingMatch, true);

  // 4. Finished goods after run: 238 pkts (50 opening + 188 output)
  assert.equal(metrics.finishedGoodsAfterRun, 238, 'FG after run must be 238 pkts');
  assert.equal(metrics.checks.fgAfterRunMatch, true);

  // 5. Finished goods after dispatch: 88 pkts (238 - 150)
  assert.equal(metrics.finishedGoodsAfterDispatch, 88, 'FG after dispatch must be 88 pkts');
  assert.equal(metrics.checks.fgAfterDispatchMatch, true);

  // 6. Yield variance: -6% (flagged)
  assert.equal(metrics.yieldVariancePercent, -6, 'Yield variance must be -6%');
  assert.equal(metrics.checks.yieldVarianceMatch, true);

  // 7. Oil consumption variance: +5% (flagged)
  assert.equal(metrics.oilVariancePercent, 5, 'Oil variance must be +5%');
  assert.equal(metrics.checks.oilVarianceMatch, true);

  // 8. Retailer A invoice: ₹7,500 taxable + ₹187.50 CGST + ₹187.50 SGST = ₹7,875
  assert.equal(metrics.retailerATaxable, 7500);
  assert.equal(metrics.retailerACgst, 187.5);
  assert.equal(metrics.retailerASgst, 187.5);
  assert.equal(metrics.retailerAInvoiceTotal, 7875);
  assert.equal(metrics.checks.retailerAInvoiceMatch, true);

  // 9. Retailer A outstanding: ₹3,875 (₹7,875 - ₹4,000 paid)
  assert.equal(metrics.retailerAOutstanding, 3875, 'Outstanding must be ₹3,875');
  assert.equal(metrics.checks.retailerAOutstandingMatch, true);

  // 10. Distributor B order: shortage of 32 packets flagged (120 ordered vs 88 in stock)
  assert.equal(metrics.distributorBShortage, 32, 'Shortage must be 32 pkts');
  assert.equal(metrics.checks.distributorBShortageMatch, true);

  // 11. Cost per packet:
  // FIFO: (40*42 + 10.5*140 + 1.2*200 + 194*2.5 + 9*15 + 1800 overhead) / 188 = 5810 / 188 = ₹30.90
  assert.equal(metrics.costPerPacketFifo, 30.9, 'Cost per packet under FIFO must be ₹30.90');
  // Weighted Average: (40*43.125 + 1470 + 240 + 485 + 135 + 1800) / 188 = 5855 / 188 = ₹31.14
  assert.equal(metrics.costPerPacketWeightedAvg, 31.14, 'Cost per packet under Weighted Avg must be ₹31.14');

  assert.equal(metrics.checks.allPassed, true, 'All 11 benchmark criteria must pass');
});

test('6. Reporting Engine Outputs Valid Auditor Statements', () => {
  const engine = new LedgerEngine();
  engine.runFullBenchmark();
  const reports = new ReportingEngine(engine);

  const sales = reports.getSalesRegister();
  assert.equal(sales.length, 1);
  assert.equal(sales[0].grandTotal, 7875);

  const gst = reports.getGstSummary();
  assert.equal(gst.b2b.taxable, 7500);
  assert.equal(gst.b2b.cgst, 187.5);
  assert.equal(gst.b2b.sgst, 187.5);

  const stockSummary = reports.getStockSummary();
  const flour = stockSummary.find((s) => s.itemId === 'item-flour');
  assert.equal(flour.closingQty, 120);

  const aging = reports.getReceivablesAging();
  assert.equal(aging.length, 1);
  assert.equal(aging[0].totalOutstanding, 3875);

  const csv = reports.exportToCSV('sales');
  assert.ok(csv.includes('INV/2026-27/0001'));
  assert.ok(csv.includes('7875'));

  const xml = reports.exportToTallyXML();
  assert.ok(xml.includes('<VOUCHER VCHTYPE="Sales"'));
  assert.ok(xml.includes('<AMOUNT>-7875</AMOUNT>'));
});
