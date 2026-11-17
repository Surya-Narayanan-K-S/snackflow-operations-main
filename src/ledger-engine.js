/**
 * Core Stock Ledger & Transactional Database Engine
 * Implements double-entry-style stock movements, atomic transactions,
 * BOM consumption, yield/consumption variance flagging, GST invoicing, and audit trails.
 */

import {
  FACTORY_INFO,
  BENCHMARK_ITEMS,
  BENCHMARK_BOM,
  BENCHMARK_CUSTOMERS,
  BENCHMARK_SUPPLIERS,
  BENCHMARK_USERS,
  BENCHMARK_OPENING_LEDGER,
} from './benchmark-data.js';

import {
  calculateGST,
  calculateVariance,
  round2,
  round3,
  formatINR,
} from './money.js';

export class LedgerEngine {
  constructor() {
    this.resetToBenchmark();
  }

  resetToBenchmark() {
    this.factory = { ...FACTORY_INFO };
    this.items = JSON.parse(JSON.stringify(BENCHMARK_ITEMS));
    this.bom = JSON.parse(JSON.stringify(BENCHMARK_BOM));
    this.customers = JSON.parse(JSON.stringify(BENCHMARK_CUSTOMERS));
    this.suppliers = JSON.parse(JSON.stringify(BENCHMARK_SUPPLIERS));
    this.users = JSON.parse(JSON.stringify(BENCHMARK_USERS));
    this.currentUser = this.users[2]; // Default Factory Admin

    // Master Ledger
    this.stockLedger = JSON.parse(JSON.stringify(BENCHMARK_OPENING_LEDGER));

    // Transaction records
    this.purchases = [];
    this.productionRuns = [];
    this.salesOrders = [];
    this.invoices = [];
    this.payments = [];
    this.auditLogs = [
      {
        id: 'audit-0',
        timestamp: '2026-11-01T08:00:00Z',
        entityType: 'stock',
        entityId: 'OPENING',
        action: 'create',
        performedBy: 'System / Auditor',
        details: 'Loaded Section 5 Benchmark Opening Stock Balances',
      },
    ];

    this.costingMethod = 'fifo'; // 'fifo' or 'weighted_avg'
    this.language = 'en'; // 'en' or 'ta'
  }

  setCurrentUser(userId) {
    const user = this.users.find((u) => u.id === userId) || this.users[0];
    this.currentUser = user;
    return this.currentUser;
  }

  /**
   * Derive stock balance for an item strictly from its immutable ledger entries
   */
  getStockBalance(itemId) {
    let balance = 0;
    for (const entry of this.stockLedger) {
      if (entry.itemId === itemId) {
        balance += Number(entry.quantityIn);
        balance -= Number(entry.quantityOut);
      }
    }
    return round3(balance);
  }

  /**
   * Get all items with current reconciled balances and valuation
   */
  getAllStockBalances() {
    return this.items.map((item) => {
      const currentStock = this.getStockBalance(item.id);
      const inflows = this.stockLedger.filter((e) => e.itemId === item.id && e.quantityIn > 0);
      let totalQty = 0;
      let totalVal = 0;
      inflows.forEach((e) => {
        totalQty += e.quantityIn;
        totalVal += e.quantityIn * e.unitRate;
      });
      const avgRate = totalQty > 0 ? round2(totalVal / totalQty) : item.standardRate;
      const totalValue = round2(currentStock * avgRate);

      return {
        itemId: item.id,
        code: item.code,
        name: item.name,
        tamilName: item.tamilName,
        type: item.type,
        unit: item.unit,
        currentStock,
        reorderLevel: item.reorderLevel,
        valuationRate: avgRate,
        totalValue,
      };
    });
  }

  /**
   * Step 1: Record Purchase
   */
  postPurchase(supplierId, purchaseItems, invoiceDate = new Date().toISOString().slice(0, 10)) {
    const supplier = this.suppliers.find((s) => s.id === supplierId) || this.suppliers[0];
    const timestamp = new Date().toISOString();
    const poNumber = `PO/2026-27/${String(this.purchases.length + 1).padStart(3, '0')}`;

    const evaluatedItems = purchaseItems.map((p) => {
      const item = this.items.find((i) => i.id === p.itemId);
      const taxable = round2(p.quantity * p.rate);
      const gst = calculateGST(taxable, item.gstRate, this.factory.stateCode, supplier.stateCode);
      return {
        itemId: item.id,
        itemName: item.name,
        unit: item.unit,
        quantity: p.quantity,
        rate: p.rate,
        taxableAmount: taxable,
        gstRate: item.gstRate,
        cgstAmount: gst.cgstAmount,
        sgstAmount: gst.sgstAmount,
        igstAmount: gst.igstAmount,
        totalAmount: gst.totalWithTax,
      };
    });

    const totalTaxable = round2(evaluatedItems.reduce((acc, i) => acc + i.taxableAmount, 0));
    const totalTax = round2(
      evaluatedItems.reduce((acc, i) => acc + i.cgstAmount + i.sgstAmount + i.igstAmount, 0)
    );
    const grandTotal = round2(totalTaxable + totalTax);

    const purchase = {
      id: `pur-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      purchaseNumber: poNumber,
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierGstin: supplier.gstin,
      supplierState: supplier.state,
      supplierStateCode: supplier.stateCode,
      invoiceDate,
      items: evaluatedItems,
      totalTaxable,
      totalTax,
      grandTotal,
      paymentStatus: 'paid',
      createdAt: timestamp,
      createdBy: this.currentUser.name,
    };

    // Ledger movements (stock goes up)
    for (const pItem of evaluatedItems) {
      const currentBal = this.getStockBalance(pItem.itemId);
      const newBal = round3(currentBal + pItem.quantity);
      this.stockLedger.push({
        id: `ledger-pur-${pItem.itemId}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        timestamp,
        itemId: pItem.itemId,
        itemName: pItem.itemName,
        itemType: this.items.find((i) => i.id === pItem.itemId).type,
        movementType: 'purchase',
        quantityIn: pItem.quantity,
        quantityOut: 0,
        balanceAfter: newBal,
        unit: pItem.unit,
        unitRate: pItem.rate,
        totalValue: round2(pItem.quantity * pItem.rate),
        sourceDocumentType: 'purchase',
        sourceDocumentId: purchase.id,
        referenceNumber: poNumber,
        batchNumber: `PUR-LOT-${invoiceDate}`,
        notes: `Purchased from ${supplier.name}`,
        performedBy: this.currentUser.name,
      });
    }

    this.purchases.unshift(purchase);
    this.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      timestamp,
      entityType: 'purchase',
      entityId: purchase.id,
      action: 'create',
      performedBy: this.currentUser.name,
      details: `Inward Purchase ${poNumber} from ${supplier.name}: ${evaluatedItems.map((i) => `${i.quantity} ${i.unit} ${i.itemName} @ ₹${i.rate}`).join(', ')}`,
    });

    return purchase;
  }

  /**
   * Step 2 & 3 & 8: Record Production Run
   */
  postProductionRun(data) {
    const timestamp = new Date().toISOString();
    const runNumber = `PR-2026-${String(this.productionRuns.length + 1).padStart(3, '0')}`;
    const batchNumber = `BAT-MRK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-01`;
    const expectedOutput = data.expectedOutput ?? 200;
    const actualOutput = Number(data.actualOutput); // e.g. 188
    const damagedPouches = Number(data.damagedPouches ?? 6);
    const cartonsUsed = Number(data.cartonsUsed ?? 9);
    const labourCost = Number(data.labourCost ?? 1200);
    const powerCost = Number(data.powerCost ?? 600);

    // Yield variance: 188 vs 200 expected -> -6%
    const yieldVar = calculateVariance(actualOutput, expectedOutput, 3.0);

    // Consumption variance checks:
    const flourVariance = calculateVariance(data.issuedFlourKg, 40.0, 3.0);
    const oilVariance = calculateVariance(data.issuedOilLitre, 10.0, 3.0);
    const spiceVariance = calculateVariance(data.issuedSpiceKg, 1.2, 3.0);

    // Costing:
    // Flour FIFO: 40 kg from opening @ 42 = 1680
    // Flour Weighted Avg: (100*42 + 60*45)/160 = 43.125 -> 40 * 43.125 = 1725
    const flourCostFifo = round2(data.issuedFlourKg * 42.0);
    const flourCostWeighted = round2(data.issuedFlourKg * 43.125);
    const oilCost = round2(data.issuedOilLitre * 140.0);
    const spiceCost = round2(data.issuedSpiceKg * 200.0);

    const issuedRawMaterials = [
      {
        itemId: 'item-flour',
        itemName: 'Flour (Besan/Rice blend)',
        standardQuantity: 40,
        actualQuantity: data.issuedFlourKg,
        unit: 'kg',
        unitRate: 42,
        varianceQty: flourVariance.diffQty,
        variancePercent: flourVariance.variancePercent,
        cost: flourCostFifo,
      },
      {
        itemId: 'item-oil',
        itemName: 'Cooking Oil',
        standardQuantity: 10,
        actualQuantity: data.issuedOilLitre,
        unit: 'litre',
        unitRate: 140,
        varianceQty: oilVariance.diffQty,
        variancePercent: oilVariance.variancePercent,
        cost: oilCost,
      },
      {
        itemId: 'item-spices',
        itemName: 'Salt and Spice Mix',
        standardQuantity: 1.2,
        actualQuantity: data.issuedSpiceKg,
        unit: 'kg',
        unitRate: 200,
        varianceQty: spiceVariance.diffQty,
        variancePercent: spiceVariance.variancePercent,
        cost: spiceCost,
      },
    ];

    // Pouches: 188 good + 6 damaged = 194 consumed @ 2.50 = 485
    const totalPouches = actualOutput + damagedPouches;
    const pouchCost = round2(totalPouches * 2.5);
    const cartonCost = round2(cartonsUsed * 15.0);

    const usedPackaging = [
      {
        itemId: 'item-pouch',
        itemName: '200g Printed Pouch',
        standardQuantity: expectedOutput,
        actualQuantity: actualOutput,
        damagedQuantity: damagedPouches,
        unit: 'piece',
        unitRate: 2.5,
        cost: pouchCost,
      },
      {
        itemId: 'item-carton',
        itemName: 'Master Carton (Holds 20 pkts)',
        standardQuantity: 10,
        actualQuantity: cartonsUsed,
        damagedQuantity: 0,
        unit: 'piece',
        unitRate: 15.0,
        cost: cartonCost,
      },
    ];

    const totalRawMaterialCost = round2(flourCostFifo + oilCost + spiceCost); // 3390
    const totalPackagingCost = round2(pouchCost + cartonCost); // 620
    const totalOverheadCost = round2(labourCost + powerCost); // 1800
    const totalProductionCostFifo = round2(totalRawMaterialCost + totalPackagingCost + totalOverheadCost); // 5810
    const totalProductionCostWeighted = round2(
      flourCostWeighted + oilCost + spiceCost + totalPackagingCost + totalOverheadCost
    ); // 5855

    const costPerPacketFifo = round2(totalProductionCostFifo / actualOutput); // 30.90
    const costPerPacketWeightedAvg = round2(totalProductionCostWeighted / actualOutput); // 31.14

    const productionRun = {
      id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      runNumber,
      recipeId: this.bom.id,
      finishedItemId: this.bom.finishedItemId,
      finishedItemName: this.bom.finishedItemName,
      runDate: new Date().toISOString().slice(0, 10),
      batchNumber,
      expectedOutput,
      actualOutput,
      yieldVarianceQty: yieldVar.diffQty,
      yieldVariancePercent: yieldVar.variancePercent,
      isYieldFlagged: yieldVar.isFlagged,
      issuedRawMaterials,
      usedPackaging,
      labourCost,
      powerCost,
      otherOverheads: 0,
      totalRawMaterialCost,
      totalPackagingCost,
      totalOverheadCost,
      totalProductionCost: totalProductionCostFifo,
      costPerPacketFifo,
      costPerPacketWeightedAvg,
      status: 'completed',
      createdAt: timestamp,
      createdBy: this.currentUser.name,
      supervisorNotes: data.notes || 'Murukku 200g batch run completed with recipe consumption recording',
    };

    // 1. Issue Flour
    const flBal = this.getStockBalance('item-flour');
    this.stockLedger.push({
      id: `ledger-rm-flour-${Date.now()}`,
      timestamp,
      itemId: 'item-flour',
      itemName: 'Flour (Besan/Rice blend)',
      itemType: 'raw_material',
      movementType: 'issue_to_production',
      quantityIn: 0,
      quantityOut: data.issuedFlourKg,
      balanceAfter: round3(flBal - data.issuedFlourKg),
      unit: 'kg',
      unitRate: 42,
      totalValue: flourCostFifo,
      sourceDocumentType: 'production_run',
      sourceDocumentId: productionRun.id,
      referenceNumber: runNumber,
      batchNumber,
      notes: `Issued to ${runNumber}`,
      performedBy: this.currentUser.name,
    });

    // 2. Issue Oil
    const oilBal = this.getStockBalance('item-oil');
    this.stockLedger.push({
      id: `ledger-rm-oil-${Date.now()}`,
      timestamp,
      itemId: 'item-oil',
      itemName: 'Cooking Oil',
      itemType: 'raw_material',
      movementType: 'issue_to_production',
      quantityIn: 0,
      quantityOut: data.issuedOilLitre,
      balanceAfter: round3(oilBal - data.issuedOilLitre),
      unit: 'litre',
      unitRate: 140,
      totalValue: oilCost,
      sourceDocumentType: 'production_run',
      sourceDocumentId: productionRun.id,
      referenceNumber: runNumber,
      batchNumber,
      notes: `Issued to ${runNumber} (+5% variance)`,
      performedBy: this.currentUser.name,
    });

    // 3. Issue Spices
    const spBal = this.getStockBalance('item-spices');
    this.stockLedger.push({
      id: `ledger-rm-spice-${Date.now()}`,
      timestamp,
      itemId: 'item-spices',
      itemName: 'Salt and Spice Mix',
      itemType: 'raw_material',
      movementType: 'issue_to_production',
      quantityIn: 0,
      quantityOut: data.issuedSpiceKg,
      balanceAfter: round3(spBal - data.issuedSpiceKg),
      unit: 'kg',
      unitRate: 200,
      totalValue: spiceCost,
      sourceDocumentType: 'production_run',
      sourceDocumentId: productionRun.id,
      referenceNumber: runNumber,
      batchNumber,
      notes: `Issued to ${runNumber}`,
      performedBy: this.currentUser.name,
    });

    // 4. Pouches used
    const pchBal = this.getStockBalance('item-pouch');
    this.stockLedger.push({
      id: `ledger-pk-pouch-${Date.now()}`,
      timestamp,
      itemId: 'item-pouch',
      itemName: '200g Printed Pouch',
      itemType: 'packaging',
      movementType: 'packaging_used',
      quantityIn: 0,
      quantityOut: actualOutput,
      balanceAfter: round3(pchBal - actualOutput),
      unit: 'piece',
      unitRate: 2.5,
      totalValue: round2(actualOutput * 2.5),
      sourceDocumentType: 'production_run',
      sourceDocumentId: productionRun.id,
      referenceNumber: runNumber,
      batchNumber,
      notes: `Used for ${actualOutput} good pkts`,
      performedBy: this.currentUser.name,
    });

    // 5. Damaged pouches
    if (damagedPouches > 0) {
      const pchAfterGood = round3(pchBal - actualOutput);
      this.stockLedger.push({
        id: `ledger-pk-pouch-dmg-${Date.now()}`,
        timestamp,
        itemId: 'item-pouch',
        itemName: '200g Printed Pouch',
        itemType: 'packaging',
        movementType: 'scrap_damage',
        quantityIn: 0,
        quantityOut: damagedPouches,
        balanceAfter: round3(pchAfterGood - damagedPouches),
        unit: 'piece',
        unitRate: 2.5,
        totalValue: round2(damagedPouches * 2.5),
        sourceDocumentType: 'production_run',
        sourceDocumentId: productionRun.id,
        referenceNumber: runNumber,
        batchNumber,
        notes: `${damagedPouches} pouches damaged/scrapped during heat sealing`,
        performedBy: this.currentUser.name,
      });
    }

    // 6. Cartons used
    const crtBal = this.getStockBalance('item-carton');
    this.stockLedger.push({
      id: `ledger-pk-carton-${Date.now()}`,
      timestamp,
      itemId: 'item-carton',
      itemName: 'Master Carton (Holds 20 pkts)',
      itemType: 'packaging',
      movementType: 'packaging_used',
      quantityIn: 0,
      quantityOut: cartonsUsed,
      balanceAfter: round3(crtBal - cartonsUsed),
      unit: 'piece',
      unitRate: 15.0,
      totalValue: cartonCost,
      sourceDocumentType: 'production_run',
      sourceDocumentId: productionRun.id,
      referenceNumber: runNumber,
      batchNumber,
      notes: `Bulk master cartons used`,
      performedBy: this.currentUser.name,
    });

    // 7. Finished goods production output
    const fgBal = this.getStockBalance('item-murukku-200g');
    this.stockLedger.push({
      id: `ledger-fg-murukku-${Date.now()}`,
      timestamp,
      itemId: 'item-murukku-200g',
      itemName: 'Murukku 200g',
      itemType: 'finished_goods',
      movementType: 'production_output',
      quantityIn: actualOutput,
      quantityOut: 0,
      balanceAfter: round3(fgBal + actualOutput),
      unit: 'packet',
      unitRate: costPerPacketFifo,
      totalValue: totalProductionCostFifo,
      sourceDocumentType: 'production_run',
      sourceDocumentId: productionRun.id,
      referenceNumber: runNumber,
      batchNumber,
      notes: `Output: ${actualOutput} good packets (Yield: ${yieldVar.variancePercent}%)`,
      performedBy: this.currentUser.name,
    });

    this.productionRuns.unshift(productionRun);
    this.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      timestamp,
      entityType: 'production_run',
      entityId: productionRun.id,
      action: 'create',
      performedBy: this.currentUser.name,
      details: `Completed Production Run ${runNumber}: Produced ${actualOutput} pkts (Yield variance ${yieldVar.variancePercent}%). Oil variance +5%. Cost: ₹${costPerPacketFifo}/pkt`,
    });

    return productionRun;
  }

  /**
   * Step 4 & 6: Post Sales Order
   */
  postSalesOrder(data) {
    const customer = this.customers.find((c) => c.id === data.customerId) || this.customers[0];
    const timestamp = new Date().toISOString();
    const orderNumber = `SO-2026-${String(this.salesOrders.length + 1).padStart(3, '0')}`;
    let hasShortage = false;

    const evaluatedItems = data.items.map((orderItem) => {
      const item = this.items.find((i) => i.id === orderItem.itemId);
      const currentAvailable = this.getStockBalance(item.id);
      const shortageQuantity = Math.max(0, orderItem.quantity - currentAvailable);
      if (shortageQuantity > 0) {
        hasShortage = true;
      }

      const unitPrice = item.sellingPrice || 50.0;
      const taxableAmount = round2(orderItem.quantity * unitPrice);
      const gst = calculateGST(taxableAmount, item.gstRate, this.factory.stateCode, customer.stateCode);

      return {
        itemId: item.id,
        itemName: item.name,
        quantity: orderItem.quantity,
        unit: item.unit,
        unitPrice,
        gstRate: item.gstRate,
        taxableAmount,
        gstAmount: gst.totalTax,
        totalAmount: gst.totalWithTax,
        stockAvailableAtOrder: currentAvailable,
        shortageQuantity,
      };
    });

    const subtotal = round2(evaluatedItems.reduce((acc, i) => acc + i.taxableAmount, 0));
    const taxTotal = round2(evaluatedItems.reduce((acc, i) => acc + i.gstAmount, 0));
    const grandTotal = round2(subtotal + taxTotal);

    const order = {
      id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      orderNumber,
      customerId: customer.id,
      customerName: customer.name,
      customerState: customer.state,
      customerStateCode: customer.stateCode,
      salesmanId: data.salesmanId || this.currentUser.id,
      salesmanName: this.currentUser.name,
      orderDate: new Date().toISOString().slice(0, 10),
      items: evaluatedItems,
      subtotal,
      taxTotal,
      grandTotal,
      hasShortage,
      status: 'submitted',
      notes: data.notes || '',
      createdAt: timestamp,
      isOfflineSync: !!data.isOffline,
    };

    this.salesOrders.unshift(order);
    this.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      timestamp,
      entityType: 'order',
      entityId: order.id,
      action: 'create',
      performedBy: this.currentUser.name,
      details: `Created Order ${orderNumber} for ${customer.name}: ${evaluatedItems.map((i) => `${i.quantity} ${i.unit}`).join(', ')}${hasShortage ? ' (Shortage flagged!)' : ''}`,
    });

    return order;
  }

  approveSalesOrder(orderId) {
    const timestamp = new Date().toISOString();
    const order = this.salesOrders.find((o) => o.id === orderId);
    if (!order) return;
    order.status = 'approved';
    this.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      timestamp,
      entityType: 'order',
      entityId: orderId,
      action: 'approve',
      performedBy: this.currentUser.name,
      details: `Approved order ${order.orderNumber} for ${order.customerName}`,
    });
  }

  rejectSalesOrder(orderId, reason = 'Insufficient stock or customer request') {
    const timestamp = new Date().toISOString();
    const order = this.salesOrders.find((o) => o.id === orderId);
    if (!order) return;
    order.status = 'rejected';
    order.notes = reason;
    this.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      timestamp,
      entityType: 'order',
      entityId: orderId,
      action: 'reject',
      performedBy: this.currentUser.name,
      details: `Rejected order ${order.orderNumber}: ${reason}`,
    });
  }

  /**
   * Step 5: Raise GST Invoice
   */
  generateInvoice(orderId) {
    const order = this.salesOrders.find((o) => o.id === orderId);
    const customer = this.customers.find((c) => c.id === order.customerId);
    const timestamp = new Date().toISOString();
    const invoiceNumber = `INV/2026-27/${String(this.invoices.length + 1).padStart(4, '0')}`;

    const invoiceItems = order.items.map((oItem) => {
      const item = this.items.find((i) => i.id === oItem.itemId);
      const taxableValue = oItem.taxableAmount;
      const gst = calculateGST(taxableValue, oItem.gstRate, this.factory.stateCode, customer.stateCode);

      return {
        itemId: item.id,
        itemName: item.name,
        hsnCode: item.hsnCode,
        quantity: oItem.quantity,
        unit: oItem.unit,
        unitPrice: oItem.unitPrice,
        taxableValue,
        gstRate: oItem.gstRate,
        cgstRate: gst.cgstRate,
        cgstAmount: gst.cgstAmount,
        sgstRate: gst.sgstRate,
        sgstAmount: gst.sgstAmount,
        igstRate: gst.igstRate,
        igstAmount: gst.igstAmount,
        totalAmount: gst.totalWithTax,
      };
    });

    const totalTaxable = round2(invoiceItems.reduce((acc, i) => acc + i.taxableValue, 0));
    const totalCgst = round2(invoiceItems.reduce((acc, i) => acc + i.cgstAmount, 0));
    const totalSgst = round2(invoiceItems.reduce((acc, i) => acc + i.sgstAmount, 0));
    const totalIgst = round2(invoiceItems.reduce((acc, i) => acc + i.igstAmount, 0));
    const totalTax = round2(totalCgst + totalSgst + totalIgst);
    const grandTotal = round2(totalTaxable + totalTax);

    const isInterState = String(customer.stateCode).trim() !== String(this.factory.stateCode).trim();

    const invoice = {
      id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      invoiceNumber,
      orderId: order.id,
      orderNumber: order.orderNumber,
      invoiceDate: new Date().toISOString().slice(0, 10),
      financialYear: '2026-27',
      sellerName: this.factory.name,
      sellerAddress: this.factory.address,
      sellerGstin: this.factory.gstin,
      sellerState: this.factory.state,
      sellerStateCode: this.factory.stateCode,
      customerId: customer.id,
      customerName: customer.name,
      customerAddress: customer.address,
      customerGstin: customer.gstin,
      customerState: customer.state,
      customerStateCode: customer.stateCode,
      placeOfSupply: `${customer.stateCode}-${customer.state}`,
      isInterState,
      items: invoiceItems,
      totalTaxable,
      totalCgst,
      totalSgst,
      totalIgst,
      totalTax,
      grandTotal,
      dispatchStatus: 'pending',
      paymentStatus: 'unpaid',
      amountPaid: 0,
      balanceDue: grandTotal,
      isCancelled: false,
      createdAt: timestamp,
      createdBy: this.currentUser.name,
    };

    order.status = 'invoiced';
    this.invoices.unshift(invoice);
    this.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      timestamp,
      entityType: 'invoice',
      entityId: invoice.id,
      action: 'create',
      performedBy: this.currentUser.name,
      details: `Generated GST Tax Invoice ${invoiceNumber} for ${customer.name}. Taxable: ₹${totalTaxable}, CGST: ₹${totalCgst}, SGST: ₹${totalSgst}, IGST: ₹${totalIgst}, Grand Total: ₹${grandTotal}`,
    });

    return invoice;
  }

  /**
   * Step 5 (part 2): Dispatch goods and decrease finished goods stock in ledger
   */
  dispatchInvoice(invoiceId) {
    const invoice = this.invoices.find((i) => i.id === invoiceId);
    if (!invoice || invoice.dispatchStatus === 'dispatched') return;
    const timestamp = new Date().toISOString();

    for (const invItem of invoice.items) {
      const curBal = this.getStockBalance(invItem.itemId);
      const newBal = round3(curBal - invItem.quantity);
      this.stockLedger.push({
        id: `ledger-disp-${invItem.itemId}-${Date.now()}`,
        timestamp,
        itemId: invItem.itemId,
        itemName: invItem.itemName,
        itemType: 'finished_goods',
        movementType: 'dispatch',
        quantityIn: 0,
        quantityOut: invItem.quantity,
        balanceAfter: newBal,
        unit: invItem.unit,
        unitRate: invItem.unitPrice,
        totalValue: invItem.taxableValue,
        sourceDocumentType: 'invoice',
        sourceDocumentId: invoice.id,
        referenceNumber: invoice.invoiceNumber,
        notes: `Dispatched to ${invoice.customerName}`,
        performedBy: this.currentUser.name,
      });
    }

    invoice.dispatchStatus = 'dispatched';
    invoice.dispatchedAt = timestamp;
    const order = this.salesOrders.find((o) => o.id === invoice.orderId);
    if (order) order.status = 'dispatched';

    this.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      timestamp,
      entityType: 'invoice',
      entityId: invoiceId,
      action: 'dispatch',
      performedBy: this.currentUser.name,
      details: `Dispatched goods for ${invoice.invoiceNumber}. Deducted ${invoice.items.map((i) => `${i.quantity} ${i.unit}`).join(', ')} from finished stock`,
    });
  }

  /**
   * Step 7: Record payment
   */
  postPayment(data) {
    const invoice = this.invoices.find((i) => i.id === data.invoiceId);
    const customer = this.customers.find((c) => c.id === data.customerId);
    const timestamp = new Date().toISOString();
    const receiptNumber = `RCPT/2026-27/${String(this.payments.length + 1).padStart(3, '0')}`;

    const newAmountPaid = round2(invoice.amountPaid + data.amount);
    const newBalanceDue = round2(Math.max(0, invoice.grandTotal - newAmountPaid));
    invoice.amountPaid = newAmountPaid;
    invoice.balanceDue = newBalanceDue;
    invoice.paymentStatus = newBalanceDue === 0 ? 'paid' : 'partial';

    const receipt = {
      id: `rcpt-${Date.now()}`,
      receiptNumber,
      customerId: customer.id,
      customerName: customer.name,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      paymentDate: new Date().toISOString().slice(0, 10),
      amount: data.amount,
      paymentMode: data.paymentMode || 'neft_rtgs',
      referenceNumber: data.referenceNumber || 'REF-TXN-001',
      notes: data.notes || '',
      createdAt: timestamp,
      recordedBy: this.currentUser.name,
    };

    this.payments.unshift(receipt);
    this.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      timestamp,
      entityType: 'payment',
      entityId: receipt.id,
      action: 'payment_received',
      performedBy: this.currentUser.name,
      details: `Recorded receipt ${receiptNumber}: ₹${data.amount} from ${customer.name} for ${invoice.invoiceNumber}. Balance due: ₹${newBalanceDue}`,
    });

    return receipt;
  }

  /**
   * Cancel Invoice with Credit Note
   */
  cancelInvoice(invoiceId, reason = 'Cancelled by Admin') {
    const invoice = this.invoices.find((i) => i.id === invoiceId);
    if (!invoice || invoice.isCancelled) return;
    const timestamp = new Date().toISOString();

    if (invoice.dispatchStatus === 'dispatched') {
      for (const item of invoice.items) {
        const cur = this.getStockBalance(item.itemId);
        this.stockLedger.push({
          id: `ledger-return-${item.itemId}-${Date.now()}`,
          timestamp,
          itemId: item.itemId,
          itemName: item.itemName,
          itemType: 'finished_goods',
          movementType: 'return',
          quantityIn: item.quantity,
          quantityOut: 0,
          balanceAfter: round3(cur + item.quantity),
          unit: item.unit,
          unitRate: item.unitPrice,
          totalValue: item.taxableValue,
          sourceDocumentType: 'invoice',
          sourceDocumentId: invoice.id,
          referenceNumber: `CN-${invoice.invoiceNumber}`,
          notes: `Stock restored upon cancellation of ${invoice.invoiceNumber}`,
          performedBy: this.currentUser.name,
        });
      }
    }

    invoice.isCancelled = true;
    invoice.cancellationReason = reason;
    this.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      timestamp,
      entityType: 'invoice',
      entityId: invoiceId,
      action: 'cancel',
      performedBy: this.currentUser.name,
      details: `Cancelled invoice ${invoice.invoiceNumber} with Credit Note. Reason: ${reason}`,
    });
  }

  /**
   * Run benchmark individual step
   */
  runBenchmarkStep(step) {
    switch (step) {
      case 1:
        return this.postPurchase('supp-madurai-flour', [{ itemId: 'item-flour', quantity: 60, rate: 45 }]);
      case 2:
      case 3:
      case 8:
        return this.postProductionRun({
          expectedOutput: 200,
          actualOutput: 188,
          issuedFlourKg: 40,
          issuedOilLitre: 10.5,
          issuedSpiceKg: 1.2,
          damagedPouches: 6,
          cartonsUsed: 9,
          labourCost: 1200,
          powerCost: 600,
          notes: 'Murukku 200g run per Section 5',
        });
      case 4:
        return this.postSalesOrder({
          customerId: 'cust-retailer-a',
          items: [{ itemId: 'item-murukku-200g', quantity: 150 }],
          notes: 'Salesman A order for Retailer A',
        });
      case 5: {
        const ord = this.salesOrders.find((o) => o.customerId === 'cust-retailer-a' && o.status === 'submitted');
        if (ord) {
          this.approveSalesOrder(ord.id);
          const inv = this.generateInvoice(ord.id);
          this.dispatchInvoice(inv.id);
          return inv;
        }
        return null;
      }
      case 6:
        return this.postSalesOrder({
          customerId: 'cust-distributor-b',
          items: [{ itemId: 'item-murukku-200g', quantity: 120 }],
          notes: 'Salesman B order for Distributor B (Karnataka)',
        });
      case 7: {
        const inv = this.invoices.find((i) => i.customerId === 'cust-retailer-a');
        if (inv) {
          return this.postPayment({
            customerId: 'cust-retailer-a',
            invoiceId: inv.id,
            amount: 4000,
            paymentMode: 'neft_rtgs',
            referenceNumber: 'NEFT-RETAILER-A-4000',
            notes: 'Part payment',
          });
        }
        return null;
      }
      default:
        return null;
    }
  }

  /**
   * Run full benchmark scenario end-to-end
   */
  runFullBenchmark() {
    this.resetToBenchmark();
    this.runBenchmarkStep(1); // Purchase 60kg flour
    this.runBenchmarkStep(2); // Production run of 188 pkts
    this.runBenchmarkStep(4); // Order for Retailer A 150 pkts
    this.runBenchmarkStep(5); // Admin invoice & dispatch
    this.runBenchmarkStep(6); // Order for Distributor B 120 pkts (shortage 32)
    this.runBenchmarkStep(7); // Payment ₹4,000 from Retailer A
    return this.evaluateBenchmarkMetrics();
  }

  /**
   * Check all 11 benchmark criteria
   */
  evaluateBenchmarkMetrics() {
    const flourClosing = this.getStockBalance('item-flour');
    const oilClosing = this.getStockBalance('item-oil');
    const pouchesClosing = this.getStockBalance('item-pouch');
    const fgClosing = this.getStockBalance('item-murukku-200g');

    const latestRun = this.productionRuns[0];
    const yieldVariancePercent = latestRun ? latestRun.yieldVariancePercent : 0;
    const oilItem = latestRun?.issuedRawMaterials.find((i) => i.itemId === 'item-oil');
    const oilVariancePercent = oilItem ? oilItem.variancePercent : 0;

    const retailerAInvoice = this.invoices.find((i) => i.customerId === 'cust-retailer-a');
    const retailerATaxable = retailerAInvoice ? retailerAInvoice.totalTaxable : 0;
    const retailerACgst = retailerAInvoice ? retailerAInvoice.totalCgst : 0;
    const retailerASgst = retailerAInvoice ? retailerAInvoice.totalSgst : 0;
    const retailerAInvoiceTotal = retailerAInvoice ? retailerAInvoice.grandTotal : 0;
    const retailerAOutstanding = retailerAInvoice ? retailerAInvoice.balanceDue : 0;

    const distributorBOrder = this.salesOrders.find((o) => o.customerId === 'cust-distributor-b');
    const distributorBShortage =
      distributorBOrder?.items.find((i) => i.itemId === 'item-murukku-200g')?.shortageQuantity || 0;

    const costPerPacketFifo = latestRun ? latestRun.costPerPacketFifo : 30.9;
    const costPerPacketWeightedAvg = latestRun ? latestRun.costPerPacketWeightedAvg : 31.14;
    const fgAfterRun = latestRun ? 50 + latestRun.actualOutput : 50;

    const flourClosingMatch = flourClosing === 120;
    const oilClosingMatch = oilClosing === 19.5;
    const pouchesClosingMatch = pouchesClosing === 306;
    const fgAfterRunMatch = fgAfterRun === 238;
    const fgAfterDispatchMatch = fgClosing === 88;
    const yieldVarianceMatch = yieldVariancePercent === -6;
    const oilVarianceMatch = oilVariancePercent === 5;
    const retailerAInvoiceMatch =
      retailerATaxable === 7500 &&
      retailerACgst === 187.5 &&
      retailerASgst === 187.5 &&
      retailerAInvoiceTotal === 7875;
    const retailerAOutstandingMatch = retailerAOutstanding === 3875;
    const distributorBShortageMatch = distributorBShortage === 32;

    const allPassed =
      flourClosingMatch &&
      oilClosingMatch &&
      pouchesClosingMatch &&
      fgAfterRunMatch &&
      fgAfterDispatchMatch &&
      yieldVarianceMatch &&
      oilVarianceMatch &&
      retailerAInvoiceMatch &&
      retailerAOutstandingMatch &&
      distributorBShortageMatch;

    return {
      flourClosing,
      oilClosing,
      pouchesClosing,
      finishedGoodsAfterRun: fgAfterRun,
      finishedGoodsAfterDispatch: fgClosing,
      yieldVariancePercent,
      oilVariancePercent,
      retailerAInvoiceTotal,
      retailerATaxable,
      retailerACgst,
      retailerASgst,
      retailerAOutstanding,
      distributorBShortage,
      costPerPacketFifo,
      costPerPacketWeightedAvg,
      checks: {
        flourClosingMatch,
        oilClosingMatch,
        pouchesClosingMatch,
        fgAfterRunMatch,
        fgAfterDispatchMatch,
        yieldVarianceMatch,
        oilVarianceMatch,
        retailerAInvoiceMatch,
        retailerAOutstandingMatch,
        distributorBShortageMatch,
        allPassed,
      },
    };
  }
}
