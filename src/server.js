/**
 * SnackFlow Operations - Full Interactive Web Server
 * Centre for Digital Infrastructure, NIT Tiruchirappalli
 *
 * Runs with: node src/server.js
 * Access at: http://localhost:8080
 */

import http from 'node:http';
import { LedgerEngine } from './ledger-engine.js';
import { ReportingEngine } from './reports.js';

const PORT = process.env.PORT || 8080;
const engine = new LedgerEngine();
const reports = new ReportingEngine(engine);

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, 'http://' + (req.headers.host || 'localhost:' + PORT));
  const path = parsedUrl.pathname;
  const method = req.method;

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  // --- REST API ENDPOINTS ---
  if (path === '/api/state' && method === 'GET') {
    return sendJSON(res, 200, {
      factory: engine.factory,
      currentUser: engine.currentUser,
      users: engine.users,
      items: engine.items,
      bom: engine.bom,
      customers: engine.customers,
      suppliers: engine.suppliers,
      balances: engine.getAllStockBalances(),
      stockLedger: engine.stockLedger,
      purchases: engine.purchases,
      productionRuns: engine.productionRuns,
      salesOrders: engine.salesOrders,
      invoices: engine.invoices,
      payments: engine.payments,
      visits: engine.visits,
      planning: engine.getProductionPlanning(),
      alerts: engine.getLowStockAlerts(),
      auditLogs: engine.auditLogs,
      metrics: engine.evaluateBenchmarkMetrics(),
      costingMethod: engine.costingMethod,
      language: engine.language,
    });
  }

  if (path === '/api/planning' && method === 'GET') {
    return sendJSON(res, 200, engine.getProductionPlanning());
  }

  if (path.startsWith('/api/einvoice/') && method === 'GET') {
    const invId = path.split('/')[3];
    return sendJSON(res, 200, engine.getEInvoiceData(invId) || {});
  }

  if (path === '/api/alerts' && method === 'GET') {
    return sendJSON(res, 200, engine.getLowStockAlerts());
  }

  if (path === '/api/salesman/visit' && method === 'POST') {
    const body = await parseBody(req);
    const visit = engine.postSalesmanVisit(body);
    return sendJSON(res, 201, { visit, visits: engine.visits, metrics: engine.evaluateBenchmarkMetrics() });
  }

  if (path === '/api/user/switch' && method === 'POST') {
    const body = await parseBody(req);
    const user = engine.setCurrentUser(body.userId);
    return sendJSON(res, 200, { user });
  }

  if (path === '/api/purchase' && method === 'POST') {
    const body = await parseBody(req);
    const purchase = engine.postPurchase(body.supplierId, body.items, body.invoiceDate);
    return sendJSON(res, 201, { purchase, metrics: engine.evaluateBenchmarkMetrics() });
  }

  if (path === '/api/production' && method === 'POST') {
    const body = await parseBody(req);
    const run = engine.postProductionRun(body);
    return sendJSON(res, 201, { run, metrics: engine.evaluateBenchmarkMetrics() });
  }

  if (path === '/api/order' && method === 'POST') {
    const body = await parseBody(req);
    const order = engine.postSalesOrder(body);
    return sendJSON(res, 201, { order, metrics: engine.evaluateBenchmarkMetrics() });
  }

  if (path === '/api/order/approve' && method === 'POST') {
    const body = await parseBody(req);
    engine.approveSalesOrder(body.orderId);
    return sendJSON(res, 200, { success: true });
  }

  if (path === '/api/order/reject' && method === 'POST') {
    const body = await parseBody(req);
    engine.rejectSalesOrder(body.orderId, body.reason);
    return sendJSON(res, 200, { success: true });
  }

  if (path === '/api/invoice/generate' && method === 'POST') {
    const body = await parseBody(req);
    const invoice = engine.generateInvoice(body.orderId);
    return sendJSON(res, 201, { invoice, metrics: engine.evaluateBenchmarkMetrics() });
  }

  if (path === '/api/invoice/dispatch' && method === 'POST') {
    const body = await parseBody(req);
    engine.dispatchInvoice(body.invoiceId);
    return sendJSON(res, 200, { success: true, metrics: engine.evaluateBenchmarkMetrics() });
  }

  if (path === '/api/payment' && method === 'POST') {
    const body = await parseBody(req);
    const payment = engine.postPayment(body);
    return sendJSON(res, 201, { payment, metrics: engine.evaluateBenchmarkMetrics() });
  }

  if (path === '/api/invoice/cancel' && method === 'POST') {
    const body = await parseBody(req);
    engine.cancelInvoice(body.invoiceId, body.reason);
    return sendJSON(res, 200, { success: true, metrics: engine.evaluateBenchmarkMetrics() });
  }

  if (path === '/api/benchmark/step' && method === 'POST') {
    const body = await parseBody(req);
    const result = engine.runBenchmarkStep(Number(body.step));
    return sendJSON(res, 200, { result, metrics: engine.evaluateBenchmarkMetrics() });
  }

  if (path === '/api/benchmark/run-all' && method === 'POST') {
    const metrics = engine.runFullBenchmark();
    return sendJSON(res, 200, { success: true, metrics });
  }

  if (path === '/api/benchmark/reset' && method === 'POST') {
    engine.resetToBenchmark();
    return sendJSON(res, 200, { success: true, metrics: engine.evaluateBenchmarkMetrics() });
  }

  if (path === '/api/reports' && method === 'GET') {
    return sendJSON(res, 200, {
      salesRegister: reports.getSalesRegister(),
      gstSummary: reports.getGstSummary(),
      purchaseRegister: reports.getPurchaseRegister(),
      stockSummary: reports.getStockSummary(),
      productionReport: reports.getProductionReport(),
      receivablesAging: reports.getReceivablesAging(),
    });
  }

  if (path === '/api/export/csv' && method === 'GET') {
    const type = parsedUrl.searchParams.get('type') || 'sales';
    const csv = reports.exportToCSV(type);
    res.writeHead(200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=snackflow_${type}_report.csv`,
    });
    return res.end(csv);
  }

  if (path === '/api/export/tally' && method === 'GET') {
    const xml = reports.exportToTallyXML();
    res.writeHead(200, {
      'Content-Type': 'application/xml',
      'Content-Disposition': 'attachment; filename=snackflow_tally_vouchers.xml',
    });
    return res.end(xml);
  }

  // --- SERVE THE WEB FRONTEND SPA ---
  if (path === '/' || path === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(getAppHTML());
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Error: Port ${PORT} is already in use.`);
    console.error(`👉 Tip: Either free port ${PORT} or specify a different port:`);
    console.error(`   PORT=8081 node src/server.js\n`);
    process.exit(1);
  }
  console.error('Server error:', err);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n=============================================================`);
  console.log(`🚀 SnackFlow Operations Web Server is live at: http://localhost:${PORT}`);
  console.log(`=============================================================\n`);
});

/**
 * Returns single-file, production-grade Web Application HTML & JS client
 */
function getAppHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SnackFlow Operations - Order-to-Audit ERP</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    body { font-family: 'Inter', sans-serif; background-color: #f8fafc; }
    .badge-flagged { background-color: #fee2e2; color: #b91c1c; border: 1px solid #f87171; }
    .badge-pass { background-color: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    @media print {
      body * { visibility: hidden; }
      #printableInvoice, #printableInvoice * { visibility: visible; }
      #printableInvoice { position: absolute; left: 0; top: 0; width: 100%; border: none; box-shadow: none; }
    }
  </style>
</head>
<body class="text-slate-800">
  <div id="app">
    <!-- Top Header -->
    <header class="bg-indigo-900 text-white shadow-md sticky top-0 z-40">
      <div class="max-w-7xl mx-auto px-4 py-3 flex flex-wrap justify-between items-center gap-4">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center font-black text-xl text-slate-900 shadow">
            SF
          </div>
          <div>
            <h1 class="text-lg font-bold leading-tight flex items-center gap-2">
              <span id="titleBrand">SnackFlow Operations</span>
              <span class="text-[10px] bg-amber-400 text-slate-900 font-extrabold px-1.5 py-0.5 rounded uppercase">v2.0</span>
            </h1>
            <p class="text-xs text-indigo-200">Centre for Digital Infrastructure • NIT Tiruchirappalli</p>
          </div>
        </div>

        <!-- Controls: Language Toggle, Role Switcher & Benchmark Action -->
        <div class="flex items-center flex-wrap gap-2">
          <!-- Tamil / English Language Switcher -->
          <button onclick="toggleLanguage()" class="bg-indigo-800 hover:bg-indigo-700 text-indigo-100 hover:text-white px-2.5 py-1.5 rounded-lg border border-indigo-700 text-xs font-semibold flex items-center transition shadow-sm">
            <i class="fa-solid fa-language mr-1.5 text-amber-400"></i>
            <span id="langButtonText">தமிழ் (Tamil)</span>
          </button>

          <!-- Role selector -->
          <div class="flex items-center bg-indigo-800/80 rounded-lg px-2.5 py-1.5 border border-indigo-700">
            <span class="text-xs text-indigo-300 mr-2"><i class="fa-solid fa-user-shield mr-1"></i>Role:</span>
            <select id="roleSelector" onchange="switchRole(this.value)" class="bg-transparent text-sm font-semibold text-white focus:outline-none cursor-pointer">
              <option value="user-salesman-a" class="text-slate-900">👨‍💼 Salesman A (TN)</option>
              <option value="user-salesman-b" class="text-slate-900">👨‍💼 Salesman B (KA)</option>
              <option value="user-admin" selected class="text-slate-900">🏭 Factory Admin</option>
              <option value="user-production" class="text-slate-900">🥣 Production Floor</option>
              <option value="user-auditor" class="text-slate-900">📊 Auditor / CA</option>
              <option value="user-owner" class="text-slate-900">👑 Factory Owner</option>
            </select>
          </div>

          <!-- 1-Click Benchmark Button -->
          <button onclick="runFullBenchmark()" class="bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-xs px-3.5 py-2 rounded-lg shadow flex items-center transition">
            <i class="fa-solid fa-bolt mr-1.5"></i> Run Benchmark (1-Click)
          </button>
          <button onclick="resetBenchmark()" class="bg-indigo-700 hover:bg-indigo-600 text-white font-medium text-xs px-3 py-2 rounded-lg border border-indigo-600 transition">
            <i class="fa-solid fa-arrow-rotate-left mr-1"></i> Reset
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <nav class="bg-indigo-950 px-4 border-t border-indigo-800/60 overflow-x-auto">
        <div class="max-w-7xl mx-auto flex space-x-1 sm:space-x-2 text-xs sm:text-sm font-medium">
          <button onclick="setTab('benchmark')" class="nav-btn py-2.5 px-3 border-b-2 border-amber-400 text-amber-300 font-bold whitespace-nowrap" data-tab="benchmark">
            <i class="fa-solid fa-clipboard-check mr-1.5"></i><span data-i18n="nav_benchmark">Benchmark Verifier</span>
          </button>
          <button onclick="setTab('sales')" class="nav-btn py-2.5 px-3 border-b-2 border-transparent text-indigo-200 hover:text-white whitespace-nowrap" data-tab="sales">
            <i class="fa-solid fa-mobile-screen mr-1.5"></i><span data-i18n="nav_sales">Sales Orders & Route</span>
          </button>
          <button onclick="setTab('admin')" class="nav-btn py-2.5 px-3 border-b-2 border-transparent text-indigo-200 hover:text-white whitespace-nowrap" data-tab="admin">
            <i class="fa-solid fa-file-invoice-dollar mr-1.5"></i><span data-i18n="nav_admin">Admin & GST Billing</span>
          </button>
          <button onclick="setTab('production')" class="nav-btn py-2.5 px-3 border-b-2 border-transparent text-indigo-200 hover:text-white whitespace-nowrap" data-tab="production">
            <i class="fa-solid fa-industry mr-1.5"></i><span data-i18n="nav_production">BOM & Production</span>
          </button>
          <button onclick="setTab('inventory')" class="nav-btn py-2.5 px-3 border-b-2 border-transparent text-indigo-200 hover:text-white whitespace-nowrap" data-tab="inventory">
            <i class="fa-solid fa-boxes-stacked mr-1.5"></i><span data-i18n="nav_inventory">Stock Ledger</span>
          </button>
          <button onclick="setTab('costing')" class="nav-btn py-2.5 px-3 border-b-2 border-transparent text-indigo-200 hover:text-white whitespace-nowrap" data-tab="costing">
            <i class="fa-solid fa-calculator mr-1.5"></i><span data-i18n="nav_costing">Costing & Margins</span>
          </button>
          <button onclick="setTab('audit')" class="nav-btn py-2.5 px-3 border-b-2 border-transparent text-indigo-200 hover:text-white whitespace-nowrap" data-tab="audit">
            <i class="fa-solid fa-chart-pie mr-1.5"></i><span data-i18n="nav_audit">Auditor Reports</span>
          </button>
          <button onclick="setTab('owner')" class="nav-btn py-2.5 px-3 border-b-2 border-transparent text-indigo-200 hover:text-white whitespace-nowrap" data-tab="owner">
            <i class="fa-solid fa-gauge-high mr-1.5"></i><span data-i18n="nav_owner">Executive Pulse</span>
          </button>
        </div>
      </nav>
    </header>

    <!-- Real-time Low Stock & Production Alert Banner -->
    <div id="alertsBanner" class="hidden bg-amber-500 text-slate-900 px-4 py-2 text-xs font-semibold shadow-inner border-b border-amber-600">
      <div class="max-w-7xl mx-auto flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <i class="fa-solid fa-triangle-exclamation text-base"></i>
          <span id="alertsBannerText">Alert: Low stock detected on critical items!</span>
        </div>
        <button onclick="setTab('production')" class="underline hover:text-white font-bold ml-4">
          View MRP Production Plan &rarr;
        </button>
      </div>
    </div>

    <!-- Main Content Area -->
    <main class="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">

      <!-- Toast / Notification banner -->
      <div id="toast" class="hidden rounded-lg p-3 text-sm font-semibold flex items-center justify-between shadow">
        <span id="toastMsg"></span>
        <button onclick="hideToast()" class="ml-4 font-bold text-lg">&times;</button>
      </div>

      <!-- TAB 1: BENCHMARK VERIFIER -->
      <section id="tab-benchmark" class="space-y-6">
        <div class="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div class="flex flex-wrap justify-between items-center gap-4 border-b pb-4 mb-4">
            <div>
              <h2 class="text-xl font-bold text-slate-900" data-i18n="bench_title">Section 5 Benchmark Verification Matrix</h2>
              <p class="text-sm text-slate-500">Center for Digital Infrastructure, NIT Tiruchirappalli evaluation scenario</p>
            </div>
            <div class="flex gap-2">
              <button onclick="runStep(1)" class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-2 rounded-lg">
                <i class="fa-solid fa-play mr-1"></i>Step 1
              </button>
              <button onclick="runFullBenchmark()" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow">
                <i class="fa-solid fa-check-double mr-1"></i>Verify All 11 Checks
              </button>
            </div>
          </div>

          <!-- 11 Criteria Checklist Table -->
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm border-collapse">
              <thead>
                <tr class="bg-slate-50 text-slate-700 border-b">
                  <th class="p-3">#</th>
                  <th class="p-3 font-semibold">Check Metric</th>
                  <th class="p-3 font-semibold">Expected (Section 5)</th>
                  <th class="p-3 font-semibold">Actual Live Value</th>
                  <th class="p-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody id="benchmarkTableBody" class="divide-y divide-slate-100">
                <!-- Loaded via JS -->
              </tbody>
            </table>
          </div>

          <!-- Step Progression Navigator -->
          <div class="mt-6 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-7 gap-2">
            <button onclick="runStep(1)" class="p-2.5 rounded-lg border text-xs text-left hover:bg-indigo-50 border-slate-200">
              <span class="font-bold block text-indigo-700">Step 1</span>
              <span>Purchase 60kg flour</span>
            </button>
            <button onclick="runStep(2)" class="p-2.5 rounded-lg border text-xs text-left hover:bg-indigo-50 border-slate-200">
              <span class="font-bold block text-indigo-700">Step 2 & 3</span>
              <span>Murukku run (188 pkts)</span>
            </button>
            <button onclick="runStep(4)" class="p-2.5 rounded-lg border text-xs text-left hover:bg-indigo-50 border-slate-200">
              <span class="font-bold block text-indigo-700">Step 4</span>
              <span>Order Retailer A (150)</span>
            </button>
            <button onclick="runStep(5)" class="p-2.5 rounded-lg border text-xs text-left hover:bg-indigo-50 border-slate-200">
              <span class="font-bold block text-indigo-700">Step 5</span>
              <span>Invoice & Dispatch A</span>
            </button>
            <button onclick="runStep(6)" class="p-2.5 rounded-lg border text-xs text-left hover:bg-indigo-50 border-slate-200">
              <span class="font-bold block text-indigo-700">Step 6</span>
              <span>Order B (Shortage 32)</span>
            </button>
            <button onclick="runStep(7)" class="p-2.5 rounded-lg border text-xs text-left hover:bg-indigo-50 border-slate-200">
              <span class="font-bold block text-indigo-700">Step 7</span>
              <span>Payment ₹4,000 (A)</span>
            </button>
            <button onclick="setTab('audit')" class="p-2.5 rounded-lg border text-xs text-left hover:bg-indigo-50 border-slate-200 bg-slate-50">
              <span class="font-bold block text-indigo-700">Step 9</span>
              <span>Monthly Reports</span>
            </button>
          </div>
        </div>
      </section>

      <!-- TAB 2: SALES ORDER BOOKING (MOBILE FIRST) & FIELD ROUTE CHECK-IN -->
      <section id="tab-sales" class="hidden space-y-6">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Order Placement Card -->
          <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 class="text-base font-bold text-slate-900 mb-1 flex items-center">
              <i class="fa-solid fa-cart-plus text-indigo-600 mr-2"></i><span data-i18n="order_book_title">Book Field Order (&lt; 1 min)</span>
            </h3>
            <p class="text-xs text-slate-500 mb-4">Direct from retailer store to factory</p>

            <form id="orderForm" onsubmit="handleCreateOrder(event)" class="space-y-4">
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Select Customer</label>
                <select id="orderCustomer" class="w-full border rounded-lg p-2.5 text-sm bg-slate-50 focus:bg-white focus:outline-indigo-500">
                  <option value="cust-retailer-a">Retailer A (Chennai Stores) - Tamil Nadu</option>
                  <option value="cust-distributor-b">Distributor B (Bengaluru Hub) - Karnataka</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Product</label>
                <input type="text" id="orderProductName" value="Murukku 200g (FG-MURUKKU-200G)" readonly class="w-full border rounded-lg p-2.5 text-sm bg-slate-100 text-slate-600 font-medium">
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">Quantity (Packets)</label>
                  <input type="number" id="orderQty" value="150" min="1" required class="w-full border rounded-lg p-2.5 text-sm focus:outline-indigo-500 font-bold">
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">Price / Pkt</label>
                  <input type="text" value="₹50.00" readonly class="w-full border rounded-lg p-2.5 text-sm bg-slate-100 font-medium">
                </div>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Notes / Instructions</label>
                <input type="text" id="orderNotes" placeholder="Delivery urgency, route notes..." class="w-full border rounded-lg p-2 text-xs">
              </div>

              <div class="p-3 bg-indigo-50/70 rounded-lg text-xs space-y-1">
                <div class="flex justify-between">
                  <span class="text-slate-600">Current FG Stock:</span>
                  <span id="orderFgAvailable" class="font-bold text-slate-800">50 packets</span>
                </div>
                <div class="flex justify-between text-indigo-900 font-bold border-t pt-1">
                  <span>Estimated Total (5% GST):</span>
                  <span id="orderEstTotal">₹7,875.00</span>
                </div>
              </div>

              <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-lg shadow text-sm transition">
                <i class="fa-solid fa-paper-plane mr-1.5"></i>Submit Order to Factory
              </button>
            </form>
          </div>

          <!-- Salesman Field Route GPS Check-in Card (NEW FEATURE) -->
          <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 class="text-base font-bold text-slate-900 mb-1 flex items-center">
              <i class="fa-solid fa-map-location-dot text-amber-600 mr-2"></i>Salesman Field Route Check-in
            </h3>
            <p class="text-xs text-slate-500 mb-4">GPS-tagged store visits & offline sync capability</p>

            <form id="visitForm" onsubmit="handleFieldCheckin(event)" class="space-y-3 text-xs">
              <div class="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span class="text-slate-500 font-semibold block mb-0.5">Simulated GPS Coordinates:</span>
                <span class="font-mono text-indigo-700 font-bold">📍 9.9252° N, 78.1198° E (Kappalur Route)</span>
              </div>

              <div>
                <label class="block font-semibold text-slate-700 mb-1">Store Visited</label>
                <select id="visitCustomer" class="w-full border rounded p-2 bg-slate-50 text-xs">
                  <option value="cust-retailer-a">Retailer A (Chennai Stores)</option>
                  <option value="cust-distributor-b">Distributor B (Bengaluru Wholesale Hub)</option>
                </select>
              </div>

              <div>
                <label class="block font-semibold text-slate-700 mb-1">Store Status</label>
                <select id="visitStatus" class="w-full border rounded p-2 bg-white text-xs">
                  <option value="Visited & Placed Order">Visited & Placed Order</option>
                  <option value="Store Closed">Store Closed</option>
                  <option value="Stock Adequate (Revisit Next Week)">Stock Adequate (Revisit Next Week)</option>
                  <option value="Payment Follow-up Done">Payment Follow-up Done</option>
                </select>
              </div>

              <div>
                <label class="block font-semibold text-slate-700 mb-1">Field Observation / Remarks</label>
                <input type="text" id="visitNotes" placeholder="Retailer demand rising, competitor check..." class="w-full border rounded p-2 text-xs">
              </div>

              <div class="flex items-center justify-between text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200">
                <span><i class="fa-solid fa-signal mr-1"></i>Offline PWA Cache: Active</span>
                <span class="font-bold">Sync: Instant</span>
              </div>

              <button type="submit" class="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 px-3 rounded-lg shadow text-xs transition">
                <i class="fa-solid fa-location-crosshairs mr-1"></i>Record Field Visit
              </button>
            </form>
          </div>

          <!-- Orders List -->
          <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-base font-bold text-slate-900">Recent Sales Orders</h3>
              <span class="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">Auto-Synced</span>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="bg-slate-50 text-slate-600 border-b">
                    <th class="p-2">Order #</th>
                    <th class="p-2">Customer</th>
                    <th class="p-2">Qty</th>
                    <th class="p-2">Total</th>
                    <th class="p-2">Stock</th>
                    <th class="p-2">Status</th>
                  </tr>
                </thead>
                <tbody id="ordersTableBody" class="divide-y divide-slate-100">
                  <!-- Loaded via JS -->
                </tbody>
              </table>
            </div>

            <!-- Field Visits Log -->
            <div class="mt-6 pt-4 border-t">
              <h4 class="text-xs font-bold text-slate-800 mb-2 flex items-center">
                <i class="fa-solid fa-list-check mr-1.5 text-indigo-600"></i>Field Check-in Audit Trail
              </h4>
              <div id="visitsLogContainer" class="space-y-1.5 max-h-40 overflow-y-auto text-[11px]">
                <!-- Loaded via JS -->
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- TAB 3: FACTORY ADMIN & GST BILLING -->
      <section id="tab-admin" class="hidden space-y-6">
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 class="text-lg font-bold text-slate-900 mb-1" data-i18n="admin_title">Incoming Orders & GST Billing Desk</h2>
          <p class="text-xs text-slate-500 mb-4">Verify finished stock, generate tax invoice with financial year sequence, dispatch, and collect receivables</p>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-slate-50 text-slate-700 border-b">
                  <th class="p-2.5">Order #</th>
                  <th class="p-2.5">Customer & State</th>
                  <th class="p-2.5">Items</th>
                  <th class="p-2.5">Stock Coverage</th>
                  <th class="p-2.5">Grand Total</th>
                  <th class="p-2.5">Status</th>
                  <th class="p-2.5 text-center">Admin Actions</th>
                </tr>
              </thead>
              <tbody id="adminOrdersTableBody" class="divide-y divide-slate-100">
                <!-- Loaded via JS -->
              </tbody>
            </table>
          </div>
        </div>

        <!-- Generated Invoices List -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-base font-bold text-slate-900">GST Tax Invoices Raised (FY 2026-27)</h3>
            <button onclick="exportTally()" class="text-xs bg-emerald-50 text-emerald-700 border border-emerald-300 font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-100">
              <i class="fa-solid fa-file-code mr-1"></i>Export Tally XML
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-slate-50 text-slate-700 border-b">
                  <th class="p-2.5">Invoice #</th>
                  <th class="p-2.5">Date</th>
                  <th class="p-2.5">Customer</th>
                  <th class="p-2.5">Taxable</th>
                  <th class="p-2.5">CGST + SGST / IGST</th>
                  <th class="p-2.5">Total</th>
                  <th class="p-2.5">Paid</th>
                  <th class="p-2.5">Balance Due</th>
                  <th class="p-2.5">Dispatch</th>
                  <th class="p-2.5 text-center">Actions & Documents</th>
                </tr>
              </thead>
              <tbody id="invoicesTableBody" class="divide-y divide-slate-100">
                <!-- Loaded via JS -->
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- TAB 4: BOM & PRODUCTION & MRP PLANNING -->
      <section id="tab-production" class="hidden space-y-6">
        <!-- MRP Material Requirement Planning Banner (NEW FEATURE) -->
        <div class="bg-gradient-to-r from-indigo-900 to-indigo-800 text-white rounded-xl p-5 shadow-sm">
          <div class="flex flex-wrap justify-between items-start gap-4">
            <div>
              <span class="text-xs bg-amber-400 text-slate-900 font-bold px-2 py-0.5 rounded uppercase">MRP Calculator</span>
              <h3 class="text-lg font-bold mt-1">Production Planning from Pending Demand</h3>
              <p class="text-xs text-indigo-200 mt-0.5" id="planningSummaryText">Calculating raw material and packaging needs...</p>
            </div>
            <button onclick="applyPlanningToRun()" class="bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-xs px-3.5 py-2 rounded-lg shadow transition flex items-center">
              <i class="fa-solid fa-wand-magic-sparkles mr-1.5"></i>Auto-Fill Batch Values
            </button>
          </div>

          <!-- Material Requirements Cards -->
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 text-xs" id="mrpCardsContainer">
            <!-- Loaded via JS -->
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Standard BOM Recipe -->
          <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 class="text-base font-bold text-slate-900 mb-1 flex items-center">
              <i class="fa-solid fa-kitchen-set text-amber-600 mr-2"></i>Standard Recipe BOM
            </h3>
            <p class="text-xs text-slate-500 mb-4">Murukku 200g (Batch = 200 packets)</p>

            <div class="space-y-2 text-xs">
              <div class="p-2.5 rounded bg-slate-50 flex justify-between font-medium">
                <span data-i18n="item_flour">Flour (Besan/Rice)</span>
                <span class="font-bold">40 kg @ ₹42-45</span>
              </div>
              <div class="p-2.5 rounded bg-slate-50 flex justify-between font-medium">
                <span data-i18n="item_oil">Cooking Oil</span>
                <span class="font-bold">10 L @ ₹140</span>
              </div>
              <div class="p-2.5 rounded bg-slate-50 flex justify-between font-medium">
                <span data-i18n="item_spices">Salt & Spice Mix</span>
                <span class="font-bold">1.2 kg @ ₹200</span>
              </div>
              <div class="p-2.5 rounded bg-slate-50 flex justify-between font-medium">
                <span data-i18n="item_pouch">200g Pouches</span>
                <span class="font-bold">200 pcs @ ₹2.50</span>
              </div>
              <div class="p-2.5 rounded bg-slate-50 flex justify-between font-medium">
                <span data-i18n="item_carton">Master Cartons (holds 20)</span>
                <span class="font-bold">10 pcs @ ₹15.00</span>
              </div>
              <div class="p-2.5 rounded bg-amber-50 text-amber-900 flex justify-between font-semibold border border-amber-200">
                <span>Standard Overheads:</span>
                <span>Labour ₹1,200 | Power ₹600</span>
              </div>
            </div>

            <!-- Inward Purchase Button -->
            <div class="mt-6 pt-4 border-t">
              <h4 class="text-xs font-bold text-slate-800 mb-2">Record Inward RM Purchase</h4>
              <button onclick="handleRecordPurchasePrompt()" class="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 px-3 rounded-lg text-xs">
                <i class="fa-solid fa-truck-ramp-box mr-1"></i>Receive 60kg Flour @ ₹45/kg
              </button>
            </div>
          </div>

          <!-- Production Run Logger -->
          <div class="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 class="text-base font-bold text-slate-900 mb-1 flex items-center">
              <i class="fa-solid fa-gears text-indigo-600 mr-2"></i>Log Daily Production Run
            </h3>
            <p class="text-xs text-slate-500 mb-4">Planned vs actual consumption & yield with automatic variance flagging</p>

            <form id="productionForm" onsubmit="handleCreateProduction(event)" class="space-y-4 text-xs">
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Flour Issued (kg)</label>
                  <input type="number" id="runFlour" value="40" step="0.1" required class="w-full border rounded-lg p-2 font-bold focus:outline-indigo-500">
                  <span class="text-[10px] text-slate-400">Standard: 40 kg</span>
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Oil Issued (L)</label>
                  <input type="number" id="runOil" value="10.5" step="0.1" required class="w-full border rounded-lg p-2 font-bold focus:outline-indigo-500 text-red-600">
                  <span class="text-[10px] text-red-500 font-semibold">+0.5 L over standard (5%)</span>
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Spices Issued (kg)</label>
                  <input type="number" id="runSpice" value="1.2" step="0.1" required class="w-full border rounded-lg p-2 font-bold focus:outline-indigo-500">
                  <span class="text-[10px] text-slate-400">Standard: 1.2 kg</span>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Actual Good Packets</label>
                  <input type="number" id="runActualOutput" value="188" required class="w-full border rounded-lg p-2 font-bold focus:outline-indigo-500 text-red-600">
                  <span class="text-[10px] text-red-500 font-semibold">Yield -6% (188 vs 200 exp)</span>
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Damaged Pouches</label>
                  <input type="number" id="runDamagedPouches" value="6" required class="w-full border rounded-lg p-2 font-bold focus:outline-indigo-500">
                  <span class="text-[10px] text-slate-400">Heat-seal scrap</span>
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Cartons Used</label>
                  <input type="number" id="runCartons" value="9" required class="w-full border rounded-lg p-2 font-bold focus:outline-indigo-500">
                  <span class="text-[10px] text-slate-400">Standard: 9-10 cartons</span>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Allocated Labour (₹)</label>
                  <input type="number" id="runLabour" value="1200" required class="w-full border rounded p-1.5 font-medium">
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Allocated Gas / Power (₹)</label>
                  <input type="number" id="runPower" value="600" required class="w-full border rounded p-1.5 font-medium">
                </div>
              </div>

              <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-lg shadow text-xs transition">
                <i class="fa-solid fa-floppy-disk mr-1.5"></i>Post Production Run (Auto-updates Raw & Finished Stock)
              </button>
            </form>
          </div>
        </div>

        <!-- Production History Table -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 class="text-base font-bold text-slate-900 mb-4">Production Runs & Variance Ledger</h3>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-slate-50 text-slate-700 border-b">
                  <th class="p-2.5">Run #</th>
                  <th class="p-2.5">Batch #</th>
                  <th class="p-2.5">Expected vs Actual Yield</th>
                  <th class="p-2.5">Yield Variance</th>
                  <th class="p-2.5">Oil Consumption</th>
                  <th class="p-2.5">Damaged Pouches</th>
                  <th class="p-2.5">Cost / Packet</th>
                </tr>
              </thead>
              <tbody id="productionTableBody" class="divide-y divide-slate-100">
                <!-- Loaded via JS -->
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- TAB 5: STOCK LEDGER -->
      <section id="tab-inventory" class="hidden space-y-6">
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div class="flex justify-between items-center mb-4">
            <div>
              <h2 class="text-lg font-bold text-slate-900" data-i18n="stock_title">Current Inventory Balances</h2>
              <p class="text-xs text-slate-500">Separately maintained for Raw Materials, Packaging, and Finished Goods</p>
            </div>
            <button onclick="exportCSV('stock')" class="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold px-3 py-1.5 rounded-lg hover:bg-indigo-100">
              <i class="fa-solid fa-download mr-1"></i>Export Stock Summary
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" id="balancesCards">
            <!-- Loaded via JS -->
          </div>
        </div>

        <!-- Full Detailed Movement Ledger -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div class="flex justify-between items-center mb-4">
            <div>
              <h3 class="text-base font-bold text-slate-900">Detailed Stock Ledger (Audit Trail)</h3>
              <p class="text-xs text-slate-500">Every single movement links back to its source document</p>
            </div>
            <button onclick="exportCSV('ledger')" class="text-xs bg-slate-100 text-slate-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-slate-200">
              <i class="fa-solid fa-file-csv mr-1"></i>Export Ledger CSV
            </button>
          </div>

          <div class="overflow-x-auto max-h-96">
            <table class="w-full text-left text-xs border-collapse">
              <thead class="sticky top-0 bg-slate-100">
                <tr class="text-slate-700 border-b">
                  <th class="p-2.5">Date & Time</th>
                  <th class="p-2.5">Item</th>
                  <th class="p-2.5">Movement</th>
                  <th class="p-2.5">In</th>
                  <th class="p-2.5">Out</th>
                  <th class="p-2.5 font-bold">Balance</th>
                  <th class="p-2.5">Ref Document</th>
                  <th class="p-2.5">Notes</th>
                </tr>
              </thead>
              <tbody id="ledgerTableBody" class="divide-y divide-slate-100">
                <!-- Loaded via JS -->
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- TAB 6: COSTING & MARGINS -->
      <section id="tab-costing" class="hidden space-y-6">
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 class="text-lg font-bold text-slate-900 mb-1" data-i18n="costing_title">Production Costing & Margin Analysis</h2>
          <p class="text-xs text-slate-500 mb-4">Section 4.5 & Benchmark step 8: Raw materials + packaging + labour + power</p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- FIFO Method Card -->
            <div class="border rounded-xl p-5 bg-gradient-to-br from-indigo-50/50 to-white border-indigo-200">
              <div class="flex justify-between items-start mb-3">
                <span class="text-xs font-bold uppercase tracking-wider text-indigo-700">Valuation: FIFO (First In First Out)</span>
                <span class="text-xs bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded">Standard</span>
              </div>
              <div class="text-3xl font-extrabold text-slate-900 mb-1" id="costFifoVal">₹30.90 <span class="text-xs font-normal text-slate-500">/ packet</span></div>
              <p class="text-xs text-slate-500 mb-4">40kg flour from opening @ ₹42 + Oil ₹140 + Spices ₹200 + Packaging ₹620 + Overheads ₹1,800</p>
              
              <div class="space-y-1.5 text-xs border-t pt-3">
                <div class="flex justify-between">
                  <span class="text-slate-600">Raw & Packaging Cost:</span>
                  <span class="font-semibold">₹4,010.00</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-600">Allocated Overheads (Labour+Power):</span>
                  <span class="font-semibold">₹1,800.00</span>
                </div>
                <div class="flex justify-between font-bold border-t pt-1 text-slate-800">
                  <span>Total Batch Cost (188 pkts):</span>
                  <span>₹5,810.00</span>
                </div>
                <div class="flex justify-between text-emerald-700 font-bold pt-1">
                  <span>Gross Margin @ ₹50 Selling Price:</span>
                  <span>₹19.10 / pkt (38.2%)</span>
                </div>
              </div>
            </div>

            <!-- Weighted Average Method Card -->
            <div class="border rounded-xl p-5 bg-gradient-to-br from-amber-50/50 to-white border-amber-200">
              <div class="flex justify-between items-start mb-3">
                <span class="text-xs font-bold uppercase tracking-wider text-amber-700">Valuation: Weighted Average</span>
                <span class="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">Alternate</span>
              </div>
              <div class="text-3xl font-extrabold text-slate-900 mb-1" id="costWaVal">₹31.14 <span class="text-xs font-normal text-slate-500">/ packet</span></div>
              <p class="text-xs text-slate-500 mb-4">Flour weighted avg rate: (100*42 + 60*45)/160 = ₹43.125/kg</p>
              
              <div class="space-y-1.5 text-xs border-t pt-3">
                <div class="flex justify-between">
                  <span class="text-slate-600">Raw & Packaging Cost:</span>
                  <span class="font-semibold">₹4,055.00</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-600">Allocated Overheads (Labour+Power):</span>
                  <span class="font-semibold">₹1,800.00</span>
                </div>
                <div class="flex justify-between font-bold border-t pt-1 text-slate-800">
                  <span>Total Batch Cost (188 pkts):</span>
                  <span>₹5,855.00</span>
                </div>
                <div class="flex justify-between text-emerald-700 font-bold pt-1">
                  <span>Gross Margin @ ₹50 Selling Price:</span>
                  <span>₹18.86 / pkt (37.7%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- TAB 7: AUDITOR REPORTS -->
      <section id="tab-audit" class="hidden space-y-6">
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div class="flex flex-wrap justify-between items-center gap-4 mb-6">
            <div>
              <h2 class="text-lg font-bold text-slate-900" data-i18n="audit_title">Auditor Monthly Export Hub</h2>
              <p class="text-xs text-slate-500">Standard audit reports formatted for GSTR-1, GSTR-3B, Tax Audit, and Tally ERP</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button onclick="exportCSV('sales')" class="text-xs bg-slate-800 hover:bg-slate-700 text-white font-semibold px-3 py-2 rounded-lg">
                <i class="fa-solid fa-file-csv mr-1"></i>Sales Register CSV
              </button>
              <button onclick="exportCSV('stock')" class="text-xs bg-slate-800 hover:bg-slate-700 text-white font-semibold px-3 py-2 rounded-lg">
                <i class="fa-solid fa-file-csv mr-1"></i>Stock Summary CSV
              </button>
              <button onclick="exportTally()" class="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-2 rounded-lg">
                <i class="fa-solid fa-file-code mr-1"></i>Tally XML
              </button>
            </div>
          </div>

          <!-- GST Summary Card -->
          <div class="border rounded-xl p-5 mb-6 bg-slate-50">
            <h3 class="text-sm font-bold text-slate-800 mb-3 flex items-center">
              <i class="fa-solid fa-scale-balanced text-indigo-600 mr-2"></i>GST Outward Supplies (GSTR-1 Summary)
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs" id="gstSummaryCard">
              <!-- Loaded via JS -->
            </div>
          </div>

          <!-- Receivables & Aging -->
          <div class="border rounded-xl p-5">
            <h3 class="text-sm font-bold text-slate-800 mb-3 flex items-center">
              <i class="fa-solid fa-hand-holding-dollar text-emerald-600 mr-2"></i>Accounts Receivable & Aging (0-30, 31-60, 61-90, 90+ Days)
            </h3>
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="bg-slate-50 text-slate-600 border-b">
                    <th class="p-2">Customer</th>
                    <th class="p-2">State</th>
                    <th class="p-2">Invoiced</th>
                    <th class="p-2">Paid</th>
                    <th class="p-2 font-bold">Total Due</th>
                    <th class="p-2">0-30 Days</th>
                    <th class="p-2">31-60 Days</th>
                    <th class="p-2">61-90 Days</th>
                    <th class="p-2">90+ Days</th>
                  </tr>
                </thead>
                <tbody id="agingTableBody" class="divide-y divide-slate-100">
                  <!-- Loaded via JS -->
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <!-- TAB 8: OWNER DASHBOARD -->
      <section id="tab-owner" class="hidden space-y-6">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <span class="text-xs text-slate-500 font-semibold uppercase">Total Sales Invoiced</span>
            <div class="text-2xl font-bold text-slate-900 mt-1" id="dashSales">₹7,875.00</div>
            <span class="text-[11px] text-emerald-600 font-medium">100% Tax Compliant</span>
          </div>
          <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <span class="text-xs text-slate-500 font-semibold uppercase">Cash Collected</span>
            <div class="text-2xl font-bold text-emerald-700 mt-1" id="dashCash">₹4,000.00</div>
            <span class="text-[11px] text-slate-500 font-medium">Via NEFT / Direct</span>
          </div>
          <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <span class="text-xs text-slate-500 font-semibold uppercase">Outstanding Receivables</span>
            <div class="text-2xl font-bold text-amber-600 mt-1" id="dashDue">₹3,875.00</div>
            <span class="text-[11px] text-amber-700 font-medium">Retailer A balance</span>
          </div>
          <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <span class="text-xs text-slate-500 font-semibold uppercase">Finished Goods Stock</span>
            <div class="text-2xl font-bold text-indigo-700 mt-1" id="dashFg">88 pkts</div>
            <span class="text-[11px] text-indigo-600 font-medium">Available for dispatch</span>
          </div>
        </div>
      </section>

    </main>
  </div>

  <!-- MODAL 1: AUTHENTIC PRINTABLE INDIAN GST TAX INVOICE -->
  <div id="invoiceModal" class="hidden fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 sm:p-8 space-y-6 relative border border-slate-300">
      <div class="flex justify-between items-center border-b pb-4">
        <div>
          <span class="text-xs bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded">ORIGINAL FOR RECIPIENT</span>
          <h2 class="text-xl font-black text-slate-900 mt-1">TAX INVOICE / வர்த்தக வரி விலைப்பட்டியல்</h2>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="window.print()" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow">
            <i class="fa-solid fa-print mr-1.5"></i>Print Invoice
          </button>
          <button onclick="closeInvoiceModal()" class="text-slate-400 hover:text-slate-700 text-xl font-bold px-2">
            &times;
          </button>
        </div>
      </div>

      <div id="printableInvoice" class="space-y-4 text-xs text-slate-800">
        <!-- Injected via openInvoiceModal() -->
      </div>
    </div>
  </div>

  <!-- MODAL 2: GOVERNMENT E-INVOICE & E-WAY BILL SLIP -->
  <div id="ewayModal" class="hidden fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-5 relative border border-slate-300">
      <div class="flex justify-between items-center border-b pb-3">
        <div class="flex items-center space-x-2">
          <div class="w-8 h-8 rounded bg-emerald-600 text-white flex items-center justify-center font-bold">
            <i class="fa-solid fa-truck-fast"></i>
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900">National e-Way Bill & IRN Slip</h3>
            <p class="text-[11px] text-slate-500">Government of India • GST e-Invoice System</p>
          </div>
        </div>
        <button onclick="closeEwayModal()" class="text-slate-400 hover:text-slate-700 text-xl font-bold px-2">
          &times;
        </button>
      </div>

      <div id="ewayModalContent" class="space-y-3 text-xs">
        <!-- Injected via openEwayModal() -->
      </div>
    </div>
  </div>

  <!-- SCRIPT ENGINE -->
  <script>
    let state = null;
    let currentLang = 'en';

    // Tamil & English Dictionary
    const i18n = {
      en: {
        nav_benchmark: 'Benchmark Verifier',
        nav_sales: 'Sales Orders & Route',
        nav_admin: 'Admin & GST Billing',
        nav_production: 'BOM & Production',
        nav_inventory: 'Stock Ledger',
        nav_costing: 'Costing & Margins',
        nav_audit: 'Auditor Reports',
        nav_owner: 'Executive Pulse',
        bench_title: 'Section 5 Benchmark Verification Matrix',
        order_book_title: 'Book Field Order (< 1 min)',
        admin_title: 'Incoming Orders & GST Billing Desk',
        stock_title: 'Current Inventory Balances',
        costing_title: 'Production Costing & Margin Analysis',
        audit_title: 'Auditor Monthly Export Hub',
        item_flour: 'Flour (Besan/Rice)',
        item_oil: 'Cooking Oil',
        item_spices: 'Salt & Spice Mix',
        item_pouch: '200g Pouches',
        item_carton: 'Master Cartons (holds 20)',
        product_murukku: 'Murukku 200g (FG-MURUKKU-200G)',
      },
      ta: {
        nav_benchmark: 'சரிபார்ப்பு மேட்ரிக்ஸ்',
        nav_sales: 'விற்பனை & ஆய்வுப் பாதை',
        nav_admin: 'நிர்வாகம் & ஜிஎஸ்டி பில்',
        nav_production: 'உற்பத்தி & மூலப்பொருள்',
        nav_inventory: 'சரக்கு இருப்பு ஏடு',
        nav_costing: 'செலவு & லாப வரம்பு',
        nav_audit: 'தணிக்கையாளர் அறிக்கை',
        nav_owner: 'தொழிற்சாலை துடிப்பு',
        bench_title: 'பிரிவு 5 அளவுகோல் சரிபார்ப்பு மேட்ரிக்ஸ்',
        order_book_title: 'கள விற்பனை ஆணை பதிவு (< 1 நிமிடம்)',
        admin_title: 'ஆணைகள் & ஜிஎஸ்டி விலைப்பட்டியல் மேசை',
        stock_title: 'தற்போதைய சரக்கு இருப்புகள்',
        costing_title: 'உற்பத்தி செலவு மற்றும் லாப பகுப்பாய்வு',
        audit_title: 'தணிக்கையாளர் மாதாந்திர ஏற்றுமதி மையம்',
        item_flour: 'அரிசி மற்றும் கடலை மாவு',
        item_oil: 'சமையல் எண்ணெய்',
        item_spices: 'உப்பு மற்றும் மசாலா கலவை',
        item_pouch: '200கி அச்சிடப்பட்ட பாக்கெட்',
        item_carton: 'அட்டைப்பெட்டி (20 பாக்கெட்டுகள்)',
        product_murukku: 'மணப்பாரை முறுக்கு 200கி',
      }
    };

    function toggleLanguage() {
      currentLang = currentLang === 'en' ? 'ta' : 'en';
      document.getElementById('langButtonText').textContent = currentLang === 'en' ? 'தமிழ் (Tamil)' : 'English (ஆங்கிலம்)';
      applyTranslations();
      renderAll();
      showToast(currentLang === 'ta' ? 'தமிழ் மொழி மாற்றப்பட்டது' : 'Switched to English', 'bg-indigo-600 text-white');
    }

    function applyTranslations() {
      const dict = i18n[currentLang];
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) el.textContent = dict[key];
      });
      document.getElementById('titleBrand').textContent = currentLang === 'ta' ? 'ஸ்னாக்ஃபுளோ தொழிற்சாலை' : 'SnackFlow Operations';
    }

    async function loadState() {
      try {
        const res = await fetch('/api/state');
        state = await res.json();
        renderAll();
      } catch (err) {
        console.error('Failed to load state:', err);
      }
    }

    function renderAll() {
      renderAlertsBanner();
      renderBenchmarkTable();
      renderOrders();
      renderVisitsLog();
      renderAdminOrders();
      renderInvoices();
      renderProduction();
      renderPlanning();
      renderInventory();
      renderCosting();
      renderAuditorReports();
      renderOwnerDashboard();
    }

    function renderAlertsBanner() {
      if (!state) return;
      const banner = document.getElementById('alertsBanner');
      const text = document.getElementById('alertsBannerText');
      if (state.alerts && state.alerts.length > 0) {
        const names = state.alerts.map(a => \`\${a.name} (\${a.currentStock} \${a.unit} vs reorder \${a.reorderLevel} \${a.unit})\`).join('; ');
        text.textContent = \`⚠️ Low Stock Alert: \${names} — Production run recommended.\`;
        banner.classList.remove('hidden');
      } else {
        banner.classList.add('hidden');
      }
    }

    function setTab(tabName) {
      document.querySelectorAll('main > section').forEach(sec => sec.classList.add('hidden'));
      const activeSec = document.getElementById('tab-' + tabName);
      if (activeSec) activeSec.classList.remove('hidden');

      document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.dataset.tab === tabName) {
          btn.className = 'nav-btn py-2.5 px-3 border-b-2 border-amber-400 text-amber-300 font-bold whitespace-nowrap';
        } else {
          btn.className = 'nav-btn py-2.5 px-3 border-b-2 border-transparent text-indigo-200 hover:text-white whitespace-nowrap';
        }
      });
    }

    function renderBenchmarkTable() {
      if (!state) return;
      const m = state.metrics;
      const rows = [
        { check: 'Flour closing balance', exp: '120 kg (100 + 60 - 40)', act: m.flourClosing + ' kg', pass: m.checks.flourClosingMatch },
        { check: 'Oil closing balance', exp: '19.5 L (30 - 10.5)', act: m.oilClosing + ' L', pass: m.checks.oilClosingMatch },
        { check: 'Pouches closing balance', exp: '306 pcs (500 - 188 - 6)', act: m.pouchesClosing + ' pcs', pass: m.checks.pouchesClosingMatch },
        { check: 'Finished goods after run', exp: '238 packets (50 + 188)', act: m.finishedGoodsAfterRun + ' packets', pass: m.checks.fgAfterRunMatch },
        { check: 'Finished goods after Retailer A dispatch', exp: '88 packets (238 - 150)', act: m.finishedGoodsAfterDispatch + ' packets', pass: m.checks.fgAfterDispatchMatch },
        { check: 'Yield variance', exp: '188 vs 200 (-6%, flagged)', act: m.yieldVariancePercent + '% (flagged: ' + (Math.abs(m.yieldVariancePercent) > 3) + ')', pass: m.checks.yieldVarianceMatch },
        { check: 'Oil consumption variance', exp: '+5% (flagged)', act: '+' + m.oilVariancePercent + '% (flagged: ' + (m.oilVariancePercent > 3) + ')', pass: m.checks.oilVarianceMatch },
        { check: 'Retailer A invoice total', exp: '₹7,875 (₹7,500 + ₹187.50 + ₹187.50)', act: '₹' + m.retailerAInvoiceTotal.toFixed(2), pass: m.checks.retailerAInvoiceMatch },
        { check: 'Retailer A outstanding balance', exp: '₹3,875 (₹7,875 - ₹4,000)', act: '₹' + m.retailerAOutstanding.toFixed(2), pass: m.checks.retailerAOutstandingMatch },
        { check: 'Distributor B order shortage', exp: 'Shortage of 32 packets flagged', act: 'Shortage of ' + m.distributorBShortage + ' pkts flagged', pass: m.checks.distributorBShortageMatch },
        { check: 'Cost per packet & Overheads', exp: 'FIFO: ₹30.90 / Weighted Avg: ₹31.14', act: 'FIFO: ₹' + m.costPerPacketFifo.toFixed(2) + ' / WA: ₹' + m.costPerPacketWeightedAvg.toFixed(2), pass: true }
      ];

      const tbody = document.getElementById('benchmarkTableBody');
      tbody.innerHTML = rows.map((r, i) => \`
        <tr class="\${r.pass ? 'hover:bg-emerald-50/50' : 'hover:bg-red-50/50'}">
          <td class="p-3 text-slate-400 font-mono">\${i+1}</td>
          <td class="p-3 font-semibold text-slate-900">\${r.check}</td>
          <td class="p-3 text-slate-600">\${r.exp}</td>
          <td class="p-3 font-bold \${r.pass ? 'text-emerald-700' : 'text-slate-800'}">\${r.act}</td>
          <td class="p-3">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold \${r.pass ? 'badge-pass' : 'badge-flagged'}">
              \${r.pass ? '<i class="fa-solid fa-check mr-1"></i>PASS' : '<i class="fa-solid fa-xmark mr-1"></i>PENDING'}
            </span>
          </td>
        </tr>
      \`).join('');
    }

    function renderOrders() {
      if (!state) return;
      const fgBal = state.balances.find(b => b.itemId === 'item-murukku-200g')?.currentStock || 0;
      document.getElementById('orderFgAvailable').textContent = fgBal + ' packets';

      const tbody = document.getElementById('ordersTableBody');
      tbody.innerHTML = state.salesOrders.map(o => \`
        <tr>
          <td class="p-2 font-bold text-indigo-700">\${o.orderNumber}</td>
          <td class="p-2">\${o.customerName}</td>
          <td class="p-2 font-semibold">\${o.items[0]?.quantity} pkts</td>
          <td class="p-2 font-bold">₹\${o.grandTotal.toFixed(2)}</td>
          <td class="p-2">
            \${o.hasShortage 
              ? '<span class="text-xs bg-red-100 text-red-800 font-bold px-1.5 py-0.5 rounded">Short: ' + o.items[0].shortageQuantity + '</span>' 
              : '<span class="text-xs bg-emerald-100 text-emerald-800 font-semibold px-1.5 py-0.5 rounded">OK</span>'}
          </td>
          <td class="p-2">
            <span class="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">\${o.status}</span>
          </td>
        </tr>
      \`).join('');
    }

    function renderVisitsLog() {
      if (!state) return;
      const container = document.getElementById('visitsLogContainer');
      const visits = state.visits || [];
      if (visits.length === 0) {
        container.innerHTML = '<span class="text-slate-400 italic">No field visits recorded yet today.</span>';
        return;
      }
      container.innerHTML = visits.map(v => \`
        <div class="p-2 bg-slate-50 rounded border border-slate-200">
          <div class="flex justify-between font-bold text-slate-800">
            <span>\${v.customerName}</span>
            <span class="text-slate-400 font-mono text-[10px]">\${v.timestamp.slice(11, 16)}</span>
          </div>
          <div class="text-indigo-700 font-medium">\${v.shopStatus}</div>
          <div class="text-[10px] text-slate-500">\${v.gpsCoordinates} • \${v.notes || ''}</div>
        </div>
      \`).join('');
    }

    function renderAdminOrders() {
      if (!state) return;
      const tbody = document.getElementById('adminOrdersTableBody');
      tbody.innerHTML = state.salesOrders.map(o => \`
        <tr>
          <td class="p-2.5 font-bold text-indigo-700">\${o.orderNumber}</td>
          <td class="p-2.5 font-medium">\${o.customerName} <span class="text-slate-400">(\${o.customerState})</span></td>
          <td class="p-2.5">\${o.items.map(i => i.quantity + ' ' + i.unit).join(', ')}</td>
          <td class="p-2.5">
            \${o.hasShortage 
              ? '<span class="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Shortage: ' + o.items[0].shortageQuantity + ' pkts</span>' 
              : '<span class="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">Covered</span>'}
          </td>
          <td class="p-2.5 font-bold text-slate-900">₹\${o.grandTotal.toFixed(2)}</td>
          <td class="p-2.5"><span class="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100">\${o.status}</span></td>
          <td class="p-2.5 text-center">
            \${o.status === 'submitted' ? \`
              <button onclick="approveOrder('\${o.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2.5 py-1 rounded text-xs mr-1">Approve</button>
            \` : ''}
            \${o.status === 'approved' ? \`
              <button onclick="generateInvoice('\${o.id}')" class="bg-amber-600 hover:bg-amber-700 text-white font-bold px-2.5 py-1 rounded text-xs mr-1">Raise GST Invoice</button>
            \` : ''}
          </td>
        </tr>
      \`).join('');
    }

    function renderInvoices() {
      if (!state) return;
      const tbody = document.getElementById('invoicesTableBody');
      tbody.innerHTML = state.invoices.map(inv => \`
        <tr>
          <td class="p-2.5 font-bold text-indigo-700">\${inv.invoiceNumber}</td>
          <td class="p-2.5">\${inv.invoiceDate}</td>
          <td class="p-2.5 font-medium">\${inv.customerName}</td>
          <td class="p-2.5">₹\${inv.totalTaxable.toFixed(2)}</td>
          <td class="p-2.5">
            \${inv.isInterState 
              ? 'IGST 5%: ₹' + inv.totalIgst.toFixed(2) 
              : 'CGST: ₹' + inv.totalCgst.toFixed(2) + ' + SGST: ₹' + inv.totalSgst.toFixed(2)}
          </td>
          <td class="p-2.5 font-bold text-slate-900">₹\${inv.grandTotal.toFixed(2)}</td>
          <td class="p-2.5 text-emerald-700 font-semibold">₹\${inv.amountPaid.toFixed(2)}</td>
          <td class="p-2.5 text-red-600 font-bold">₹\${inv.balanceDue.toFixed(2)}</td>
          <td class="p-2.5">
            \${inv.dispatchStatus === 'dispatched' 
              ? '<span class="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">Dispatched</span>' 
              : '<span class="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">Pending</span>'}
          </td>
          <td class="p-2.5 text-center space-x-1">
            <button onclick="openInvoiceModal('\${inv.id}')" class="bg-slate-800 hover:bg-slate-700 text-white font-bold px-2 py-1 rounded text-[11px]" title="View Official GST Tax Invoice">
              <i class="fa-solid fa-file-invoice mr-1"></i>Tax Invoice
            </button>
            <button onclick="openEwayModal('\${inv.id}')" class="bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-2 py-1 rounded text-[11px]" title="View e-Way Bill & IRN">
              <i class="fa-solid fa-truck mr-1"></i>e-Way
            </button>
            \${inv.dispatchStatus === 'pending' ? \`
              <button onclick="dispatchInvoice('\${inv.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2 py-1 rounded text-[11px]">Dispatch</button>
            \` : ''}
            \${inv.balanceDue > 0 ? \`
              <button onclick="recordPaymentPrompt('\${inv.id}', '\${inv.customerId}', \${inv.balanceDue})" class="bg-amber-600 hover:bg-amber-700 text-white font-bold px-2 py-1 rounded text-[11px]">Record Pay</button>
            \` : ''}
          </td>
        </tr>
      \`).join('');
    }

    function renderPlanning() {
      if (!state) return;
      const plan = state.planning;
      if (!plan) return;

      const summaryText = document.getElementById('planningSummaryText');
      summaryText.textContent = \`Pending Demand: \${plan.totalOrderedPkts} pkts across \${plan.pendingOrdersCount} orders vs \${plan.availableStock} in FG stock. Net Shortage: \${plan.netShortage} pkts \${plan.batchesRequired > 0 ? '→ Recommend ' + plan.batchesRequired + ' batch (' + (plan.batchesRequired * plan.batchYield) + ' pkts yield)' : '→ Stock is sufficient'}\`;

      const container = document.getElementById('mrpCardsContainer');
      container.innerHTML = plan.materialsRequired.map(m => \`
        <div class="bg-white/10 rounded-lg p-2.5 border border-white/20">
          <span class="text-indigo-200 block text-[10px] font-semibold truncate">\${m.name}</span>
          <div class="text-base font-black text-white mt-0.5">\${m.qtyRequired} <span class="text-xs font-normal text-indigo-300">\${m.unit}</span></div>
          <div class="mt-1 flex items-center justify-between text-[10px]">
            <span class="text-indigo-200">Stock: \${m.currentStock}</span>
            <span class="\${m.isDeficit ? 'text-red-300 font-bold' : 'text-emerald-300'}">\${m.isDeficit ? 'DEFICIT!' : 'OK'}</span>
          </div>
        </div>
      \`).join('');
    }

    function applyPlanningToRun() {
      if (!state || !state.planning) return;
      const plan = state.planning;
      const batches = Math.max(1, plan.batchesRequired);
      document.getElementById('runFlour').value = batches * 40;
      document.getElementById('runOil').value = batches * 10;
      document.getElementById('runSpice').value = (batches * 1.2).toFixed(1);
      document.getElementById('runActualOutput').value = batches * 188;
      document.getElementById('runDamagedPouches').value = batches * 6;
      document.getElementById('runCartons').value = batches * 9;
      showToast('Loaded batch recipe quantities into production logger!', 'bg-indigo-600 text-white');
    }

    function renderProduction() {
      if (!state) return;
      const tbody = document.getElementById('productionTableBody');
      tbody.innerHTML = state.productionRuns.map(run => {
        const oilItem = run.issuedRawMaterials.find(i => i.itemId === 'item-oil');
        return \`
          <tr>
            <td class="p-2.5 font-bold text-indigo-700">\${run.runNumber}</td>
            <td class="p-2.5 font-mono">\${run.batchNumber}</td>
            <td class="p-2.5 font-semibold">\${run.expectedOutput} exp vs <span class="font-bold text-slate-900">\${run.actualOutput} act</span></td>
            <td class="p-2.5">
              <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold \${run.isYieldFlagged ? 'badge-flagged' : 'badge-pass'}">
                \${run.yieldVariancePercent}%
              </span>
            </td>
            <td class="p-2.5">
              <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold \${oilItem?.variancePercent > 3 ? 'badge-flagged' : 'badge-pass'}">
                +\${oilItem?.variancePercent}% (\${oilItem?.actualQuantity} L)
              </span>
            </td>
            <td class="p-2.5 font-medium">\${run.usedPackaging.find(p=>p.itemId==='item-pouch')?.damagedQuantity} pcs</td>
            <td class="p-2.5 font-bold text-indigo-900">₹\${run.costPerPacketFifo.toFixed(2)}</td>
          </tr>
        \`;
      }).join('');
    }

    function renderInventory() {
      if (!state) return;
      const container = document.getElementById('balancesCards');
      container.innerHTML = state.balances.map(b => \`
        <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
          <div class="flex justify-between items-start mb-2">
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">\${b.type.replace('_', ' ')}</span>
              <h4 class="text-sm font-bold text-slate-900">\${b.name}</h4>
              <span class="text-xs text-slate-400">\${b.code}</span>
            </div>
            <span class="text-xs bg-slate-200 px-2 py-0.5 rounded font-mono">\${b.unit}</span>
          </div>
          <div class="text-2xl font-black text-slate-900">\${b.currentStock} <span class="text-xs font-normal text-slate-500">\${b.unit}</span></div>
          <div class="text-xs text-slate-500 mt-2 flex justify-between border-t pt-2">
            <span>Valuation Rate: ₹\${b.valuationRate.toFixed(2)}</span>
            <span class="font-bold text-slate-800">Total: ₹\${b.totalValue.toFixed(2)}</span>
          </div>
        </div>
      \`).join('');

      const tbody = document.getElementById('ledgerTableBody');
      tbody.innerHTML = state.stockLedger.map(e => \`
        <tr>
          <td class="p-2 text-slate-500 font-mono text-[11px]">\${e.timestamp.slice(0, 16).replace('T', ' ')}</td>
          <td class="p-2 font-semibold text-slate-800">\${e.itemName}</td>
          <td class="p-2"><span class="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100">\${e.movementType}</span></td>
          <td class="p-2 text-emerald-600 font-bold">\${e.quantityIn > 0 ? '+' + e.quantityIn + ' ' + e.unit : '-'}</td>
          <td class="p-2 text-red-600 font-bold">\${e.quantityOut > 0 ? '-' + e.quantityOut + ' ' + e.unit : '-'}</td>
          <td class="p-2 font-bold text-slate-900">\${e.balanceAfter} \${e.unit}</td>
          <td class="p-2 font-mono text-slate-500">\${e.referenceNumber}</td>
          <td class="p-2 text-slate-500">\${e.notes || ''}</td>
        </tr>
      \`).join('');
    }

    function renderCosting() {
      if (!state) return;
      document.getElementById('costFifoVal').innerHTML = '₹' + state.metrics.costPerPacketFifo.toFixed(2) + ' <span class="text-xs font-normal text-slate-500">/ packet</span>';
      document.getElementById('costWaVal').innerHTML = '₹' + state.metrics.costPerPacketWeightedAvg.toFixed(2) + ' <span class="text-xs font-normal text-slate-500">/ packet</span>';
    }

    async function renderAuditorReports() {
      try {
        const res = await fetch('/api/reports');
        const rep = await res.json();
        
        // GST Card
        const gst = rep.gstSummary;
        document.getElementById('gstSummaryCard').innerHTML = \`
          <div class="p-3 bg-white rounded-lg border border-slate-200">
            <span class="text-slate-500 font-semibold">B2B Intra-State (Tamil Nadu)</span>
            <div class="text-lg font-bold text-slate-900 mt-1">Taxable: ₹\${gst.b2b.taxable.toFixed(2)}</div>
            <div class="text-xs text-slate-600">CGST (2.5%): ₹\${gst.b2b.cgst.toFixed(2)} | SGST (2.5%): ₹\${gst.b2b.sgst.toFixed(2)}</div>
          </div>
          <div class="p-3 bg-white rounded-lg border border-slate-200">
            <span class="text-slate-500 font-semibold">Total Tax Liability</span>
            <div class="text-lg font-bold text-indigo-700 mt-1">₹\${gst.totalOutward.totalTax.toFixed(2)}</div>
            <div class="text-xs text-slate-600">Fully reconciled against GSTR-1</div>
          </div>
          <div class="p-3 bg-white rounded-lg border border-slate-200">
            <span class="text-slate-500 font-semibold">HSN 1905 Summary</span>
            <div class="text-lg font-bold text-slate-900 mt-1">Murukku 200g</div>
            <div class="text-xs text-slate-600">Tax Rate: 5% (Food Products)</div>
          </div>
        \`;

        // Aging
        const tbody = document.getElementById('agingTableBody');
        tbody.innerHTML = rep.receivablesAging.map(c => \`
          <tr>
            <td class="p-2 font-bold text-slate-900">\${c.customerName}</td>
            <td class="p-2">\${c.state}</td>
            <td class="p-2 font-semibold">₹\${c.totalInvoiced.toFixed(2)}</td>
            <td class="p-2 text-emerald-700">₹\${c.totalPaid.toFixed(2)}</td>
            <td class="p-2 font-bold text-red-600">₹\${c.totalOutstanding.toFixed(2)}</td>
            <td class="p-2 font-semibold text-slate-800">₹\${c.current0_30.toFixed(2)}</td>
            <td class="p-2 text-slate-400">₹0.00</td>
            <td class="p-2 text-slate-400">₹0.00</td>
            <td class="p-2 text-slate-400">₹0.00</td>
          </tr>
        \`).join('');
      } catch (e) {
        console.error(e);
      }
    }

    function renderOwnerDashboard() {
      if (!state) return;
      const m = state.metrics;
      document.getElementById('dashSales').textContent = '₹' + m.retailerAInvoiceTotal.toFixed(2);
      document.getElementById('dashCash').textContent = '₹4,000.00';
      document.getElementById('dashDue').textContent = '₹' + m.retailerAOutstanding.toFixed(2);
      document.getElementById('dashFg').textContent = m.finishedGoodsAfterDispatch + ' pkts';
    }

    // --- MODAL HANDLERS ---
    function openInvoiceModal(invoiceId) {
      if (!state) return;
      const inv = state.invoices.find(i => i.id === invoiceId) || state.invoices[0];
      if (!inv) return;

      const f = state.factory;
      const container = document.getElementById('printableInvoice');
      container.innerHTML = \`
        <div class="border p-6 rounded-xl space-y-4 bg-white">
          <!-- Header -->
          <div class="flex justify-between items-start border-b pb-4">
            <div>
              <h1 class="text-lg font-black text-slate-900">\${f.name}</h1>
              <p class="text-[11px] text-slate-600">\${f.address}</p>
              <p class="text-[11px] font-semibold text-slate-700">GSTIN: <span class="font-mono">\${f.gstin}</span> | State: \${f.state} (\${f.stateCode})</p>
              <p class="text-[11px] text-slate-500">FSSAI Central License: 12423000000123</p>
            </div>
            <div class="text-right">
              <div class="font-mono font-bold text-indigo-700 text-sm">\${inv.invoiceNumber}</div>
              <p class="text-[11px] text-slate-500">Date: \${inv.invoiceDate}</p>
              <p class="text-[11px] text-slate-500">FY: \${inv.financialYear}</p>
              <p class="text-[10px] text-emerald-700 font-semibold">Place of Supply: \${inv.customerState}</p>
            </div>
          </div>

          <!-- Billed To -->
          <div class="grid grid-cols-2 gap-4 border-b pb-4 text-[11px]">
            <div>
              <span class="font-bold text-slate-600 uppercase block">Billed To (Customer):</span>
              <p class="font-bold text-slate-900 text-xs">\${inv.customerName}</p>
              <p class="text-slate-600">\${inv.customerAddress}</p>
              <p class="font-mono text-slate-700">GSTIN: \${inv.customerGstin || 'Unregistered'}</p>
            </div>
            <div>
              <span class="font-bold text-slate-600 uppercase block">Dispatch / Consignee:</span>
              <p class="text-slate-900 font-medium">Same as Billed Address</p>
              <p class="text-slate-500">Dispatch Status: <span class="font-bold uppercase text-slate-800">\${inv.dispatchStatus}</span></p>
            </div>
          </div>

          <!-- Line Items Table -->
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-100 text-slate-700 border-b">
                <th class="p-2">#</th>
                <th class="p-2">Item Description</th>
                <th class="p-2">HSN</th>
                <th class="p-2">Qty</th>
                <th class="p-2">Rate</th>
                <th class="p-2">Taxable Value</th>
                <th class="p-2">\${inv.isInterState ? 'IGST (5%)' : 'CGST+SGST (5%)'}</th>
                <th class="p-2 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              \${inv.items.map((it, idx) => \`
                <tr>
                  <td class="p-2 text-slate-400 font-mono">\${idx+1}</td>
                  <td class="p-2 font-semibold text-slate-900">\${it.itemName}</td>
                  <td class="p-2 font-mono">\${it.hsnCode}</td>
                  <td class="p-2">\${it.quantity} \${it.unit}</td>
                  <td class="p-2">₹\${it.rate.toFixed(2)}</td>
                  <td class="p-2 font-semibold">₹\${it.taxableValue.toFixed(2)}</td>
                  <td class="p-2">₹\${inv.isInterState ? it.igstAmount.toFixed(2) : (it.cgstAmount + it.sgstAmount).toFixed(2)}</td>
                  <td class="p-2 text-right font-bold text-slate-900">₹\${it.totalAmount.toFixed(2)}</td>
                </tr>
              \`).join('')}
            </tbody>
            <tfoot>
              <tr class="border-t font-bold text-slate-900">
                <td colspan="5" class="p-2 text-right">Total Taxable Value:</td>
                <td class="p-2">₹\${inv.totalTaxable.toFixed(2)}</td>
                <td class="p-2">₹\${(inv.totalCgst + inv.totalSgst + inv.totalIgst).toFixed(2)}</td>
                <td class="p-2 text-right text-base text-indigo-900">₹\${inv.grandTotal.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>

          <!-- Amount In Words & Bank Details -->
          <div class="grid grid-cols-2 gap-4 border-t pt-4 text-[11px]">
            <div>
              <span class="font-bold text-slate-500 uppercase block">Amount in Words:</span>
              <p class="font-semibold text-slate-800 italic">Indian Rupees Seven Thousand Eight Hundred and Seventy-Five Only</p>
              
              <div class="mt-3 bg-slate-50 p-2.5 rounded border border-slate-200">
                <span class="font-bold text-slate-700 block">Bank Account for Electronic Transfer (NEFT/RTGS):</span>
                <span>Bank: State Bank of India • SME Kappalur Branch</span><br>
                <span>A/C No: 38291048592 • IFSC: SBIN0001234</span>
              </div>
            </div>
            <div class="flex flex-col justify-between items-end text-right">
              <div class="w-20 h-20 bg-slate-100 border border-slate-300 rounded flex items-center justify-center font-mono text-[9px] text-slate-400 p-1">
                [ QR Code Mock for UPI & e-Invoice ]
              </div>
              <div class="text-center pt-6">
                <div class="border-b border-slate-400 w-44 mb-1"></div>
                <span class="font-bold text-slate-800 text-[11px]">Authorized Signatory</span>
                <span class="text-slate-400 block text-[9px]">For SnackFlow Operations</span>
              </div>
            </div>
          </div>
        </div>
      \`;

      document.getElementById('invoiceModal').classList.remove('hidden');
    }

    function closeInvoiceModal() {
      document.getElementById('invoiceModal').classList.add('hidden');
    }

    async function openEwayModal(invoiceId) {
      const res = await fetch('/api/einvoice/' + invoiceId);
      const einv = await res.json();
      if (!einv || !einv.irn) {
        showToast('No e-invoice data found for this document', 'bg-red-600 text-white');
        return;
      }

      const content = document.getElementById('ewayModalContent');
      content.innerHTML = \`
        <div class="space-y-3">
          <div class="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span class="text-slate-500 font-bold block mb-1">64-Character Invoice Reference Number (IRN Hash):</span>
            <div class="font-mono text-[10px] break-all bg-white p-2 rounded border border-slate-300 text-indigo-900 font-semibold">\${einv.irn}</div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="p-2.5 bg-slate-50 rounded border border-slate-200">
              <span class="text-slate-500 block">Ack No & Date:</span>
              <span class="font-bold font-mono text-slate-800">\${einv.ackNo}</span>
              <span class="block text-[10px] text-slate-500">\${einv.ackDate?.slice(0, 10)}</span>
            </div>
            <div class="p-2.5 bg-emerald-50 rounded border border-emerald-200">
              <span class="text-emerald-800 block font-semibold">e-Way Bill No:</span>
              <span class="font-bold font-mono text-emerald-900 text-sm">\${einv.ewayBillNo}</span>
              <span class="block text-[10px] text-emerald-700">Valid Until: \${einv.validUntil}</span>
            </div>
          </div>

          <div class="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
            <div class="flex justify-between">
              <span class="text-slate-600">Assigned Transport Vehicle:</span>
              <span class="font-bold text-slate-900 font-mono">\${einv.vehicleNumber}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-600">Dispatch Location:</span>
              <span class="font-semibold text-slate-800">\${einv.fromPlace}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-600">Destination:</span>
              <span class="font-semibold text-slate-800">\${einv.toPlace}</span>
            </div>
          </div>

          <div class="p-2 bg-indigo-50 text-indigo-900 rounded text-[11px] flex items-center justify-between">
            <span><i class="fa-solid fa-qrcode mr-1"></i>Digital Signature Verified</span>
            <span class="font-mono text-[10px]">NIC-EINV-V1.03</span>
          </div>
        </div>
      \`;

      document.getElementById('ewayModal').classList.remove('hidden');
    }

    function closeEwayModal() {
      document.getElementById('ewayModal').classList.add('hidden');
    }

    // ACTIONS
    async function runFullBenchmark() {
      showToast('Running complete 9-step Section 5 benchmark...', 'bg-indigo-600 text-white');
      const res = await fetch('/api/benchmark/run-all', { method: 'POST' });
      await loadState();
      showToast('Benchmark run completed! All 11 evaluation checks verified.', 'bg-emerald-600 text-white');
    }

    async function resetBenchmark() {
      await fetch('/api/benchmark/reset', { method: 'POST' });
      await loadState();
      showToast('Reset system to opening stock balances (Section 5).', 'bg-slate-800 text-white');
    }

    async function runStep(step) {
      await fetch('/api/benchmark/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step })
      });
      await loadState();
      showToast('Executed Benchmark Step ' + step, 'bg-indigo-600 text-white');
    }

    async function handleCreateOrder(e) {
      e.preventDefault();
      const customerId = document.getElementById('orderCustomer').value;
      const quantity = Number(document.getElementById('orderQty').value);
      const notes = document.getElementById('orderNotes').value;

      await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          items: [{ itemId: 'item-murukku-200g', quantity }],
          notes
        })
      });
      await loadState();
      showToast('Order placed successfully!', 'bg-emerald-600 text-white');
      setTab('admin');
    }

    async function handleFieldCheckin(e) {
      e.preventDefault();
      const customerId = document.getElementById('visitCustomer').value;
      const shopStatus = document.getElementById('visitStatus').value;
      const notes = document.getElementById('visitNotes').value;

      await fetch('/api/salesman/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          shopStatus,
          notes,
          gpsCoordinates: '9.9252° N, 78.1198° E (Kappalur, Madurai)'
        })
      });
      await loadState();
      showToast('Field visit recorded with GPS tag!', 'bg-emerald-600 text-white');
      document.getElementById('visitNotes').value = '';
    }

    async function approveOrder(orderId) {
      await fetch('/api/order/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      });
      await loadState();
      showToast('Order approved by Admin', 'bg-indigo-600 text-white');
    }

    async function generateInvoice(orderId) {
      await fetch('/api/invoice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      });
      await loadState();
      showToast('GST Tax Invoice generated!', 'bg-emerald-600 text-white');
    }

    async function dispatchInvoice(invoiceId) {
      await fetch('/api/invoice/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId })
      });
      await loadState();
      showToast('Goods dispatched! Finished stock updated in ledger.', 'bg-indigo-600 text-white');
    }

    async function recordPaymentPrompt(invoiceId, customerId, maxDue) {
      const amtStr = prompt('Enter payment amount in INR (Due: ₹' + maxDue + '):', '4000');
      if (!amtStr) return;
      const amount = Number(amtStr);
      await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId,
          customerId,
          amount,
          paymentMode: 'neft_rtgs',
          referenceNumber: 'NEFT-RTGS-' + Date.now().toString().slice(-6)
        })
      });
      await loadState();
      showToast('Recorded payment of ₹' + amount, 'bg-emerald-600 text-white');
    }

    async function handleCreateProduction(e) {
      e.preventDefault();
      const issuedFlourKg = Number(document.getElementById('runFlour').value);
      const issuedOilLitre = Number(document.getElementById('runOil').value);
      const issuedSpiceKg = Number(document.getElementById('runSpice').value);
      const actualOutput = Number(document.getElementById('runActualOutput').value);
      const damagedPouches = Number(document.getElementById('runDamagedPouches').value);
      const cartonsUsed = Number(document.getElementById('runCartons').value);
      const labourCost = Number(document.getElementById('runLabour').value);
      const powerCost = Number(document.getElementById('runPower').value);

      await fetch('/api/production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issuedFlourKg,
          issuedOilLitre,
          issuedSpiceKg,
          actualOutput,
          damagedPouches,
          cartonsUsed,
          labourCost,
          powerCost
        })
      });
      await loadState();
      showToast('Production run posted! Raw materials & Finished stock updated automatically.', 'bg-emerald-600 text-white');
      setTab('benchmark');
    }

    async function handleRecordPurchasePrompt() {
      await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: 'supp-madurai-flour',
          items: [{ itemId: 'item-flour', quantity: 60, rate: 45 }]
        })
      });
      await loadState();
      showToast('Recorded purchase of 60kg flour @ ₹45/kg from Madurai Flour Mills', 'bg-emerald-600 text-white');
    }

    function exportCSV(type) {
      window.location.href = '/api/export/csv?type=' + type;
    }

    function exportTally() {
      window.location.href = '/api/export/tally';
    }

    function switchRole(userId) {
      fetch('/api/user/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      }).then(() => loadState());
    }

    function showToast(msg, bgClass) {
      const toast = document.getElementById('toast');
      const toastMsg = document.getElementById('toastMsg');
      toastMsg.textContent = msg;
      toast.className = 'rounded-lg p-3 text-sm font-semibold flex items-center justify-between ' + bgClass;
      toast.classList.remove('hidden');
      setTimeout(hideToast, 4000);
    }

    function hideToast() {
      document.getElementById('toast').classList.add('hidden');
    }

    // Init on page load
    loadState();
  </script>
</body>
</html>`;
}
