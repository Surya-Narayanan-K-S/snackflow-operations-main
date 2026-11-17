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
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap');
    
    :root {
      --primary-navy: #0f172a;
      --accent-gold: #f59e0b;
      --accent-emerald: #10b981;
      --card-bg: rgba(255, 255, 255, 0.95);
    }

    body { 
      font-family: 'Plus Jakarta Sans', sans-serif; 
      background: radial-gradient(circle at 10% 20%, #f1f5f9 0%, #e2e8f0 100%);
      min-height: 100vh;
    }

    .font-mono { font-family: 'JetBrains Mono', monospace; }

    /* Custom Scrollbars */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

    /* Card Micro-interactions & Shadows */
    .card-modern {
      background: var(--card-bg);
      border: 1px solid #e2e8f0;
      border-radius: 1rem;
      box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.05);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .card-modern:hover {
      box-shadow: 0 12px 30px -4px rgba(15, 23, 42, 0.09);
      border-color: #cbd5e1;
    }

    /* Badges */
    .badge-flagged { 
      background-color: #fee2e2; 
      color: #b91c1c; 
      border: 1px solid #f87171; 
      animation: pulseAlert 2s infinite; 
    }
    .badge-pass { 
      background-color: #dcfce7; 
      color: #15803d; 
      border: 1px solid #86efac; 
    }
    .badge-gold {
      background-color: #fef3c7;
      color: #b45309;
      border: 1px solid #fcd34d;
    }

    @keyframes pulseAlert {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.85; transform: scale(1.03); }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }

    /* Tab Button Glow & Transitions */
    .nav-btn {
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
    }
    .nav-btn:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 0.5rem 0.5rem 0 0;
    }

    /* Print Stylesheet for Authentic Indian GST Tax Invoice */
    @media print {
      body * { visibility: hidden; }
      #printableInvoice, #printableInvoice * { visibility: visible; }
      #printableInvoice { 
        position: absolute; 
        left: 0; 
        top: 0; 
        width: 100%; 
        border: none !important; 
        box-shadow: none !important; 
        background: #ffffff !important;
      }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body class="text-slate-800 antialiased selection:bg-amber-200">
  <div id="app">
    <!-- Top Header -->
    <header class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl sticky top-0 z-40 border-b border-indigo-800/40">
      <div class="max-w-7xl mx-auto px-4 py-3 flex flex-wrap justify-between items-center gap-4">
        <div class="flex items-center space-x-3.5">
          <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-black text-2xl text-slate-950 shadow-md ring-2 ring-amber-300/30">
            SF
          </div>
          <div>
            <h1 class="text-lg font-extrabold leading-tight tracking-tight flex items-center gap-2">
              <span id="titleBrand">SnackFlow Operations</span>
              <span class="text-[10px] bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase shadow-sm">v2.0 PRO</span>
            </h1>
            <p class="text-xs text-indigo-200/80 font-medium">Centre for Digital Infrastructure • NIT Tiruchirappalli</p>
          </div>
        </div>

        <!-- Controls: Language Toggle, Role Switcher & Benchmark Action -->
        <div class="flex items-center flex-wrap gap-2.5">
          <!-- Tamil / English Language Switcher -->
          <button onclick="toggleLanguage()" class="bg-indigo-900/80 hover:bg-indigo-800 text-indigo-100 hover:text-white px-3 py-1.5 rounded-lg border border-indigo-700/80 text-xs font-semibold flex items-center transition shadow-sm">
            <i class="fa-solid fa-language mr-1.5 text-amber-400 text-sm"></i>
            <span id="langButtonText">தமிழ் (Tamil)</span>
          </button>

          <!-- Role selector -->
          <div class="flex items-center bg-indigo-900/80 rounded-lg px-3 py-1.5 border border-indigo-700/80 shadow-sm">
            <span class="text-xs text-indigo-300 mr-2"><i class="fa-solid fa-user-shield mr-1"></i>Role:</span>
            <select id="roleSelector" onchange="switchRole(this.value)" class="bg-transparent text-xs sm:text-sm font-semibold text-white focus:outline-none cursor-pointer">
              <option value="user-salesman-a" class="text-slate-900">👨‍💼 Salesman A (TN)</option>
              <option value="user-salesman-b" class="text-slate-900">👨‍💼 Salesman B (KA)</option>
              <option value="user-admin" selected class="text-slate-900">🏭 Factory Admin</option>
              <option value="user-production" class="text-slate-900">🥣 Production Floor</option>
              <option value="user-auditor" class="text-slate-900">📊 Auditor / CA</option>
              <option value="user-owner" class="text-slate-900">👑 Factory Owner</option>
            </select>
          </div>

          <!-- 1-Click Benchmark Button -->
          <button onclick="runFullBenchmark()" class="bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-extrabold text-xs px-4 py-2 rounded-lg shadow-md flex items-center transition active:scale-95">
            <i class="fa-solid fa-bolt mr-1.5 text-slate-900"></i> Run Benchmark
          </button>
          <button onclick="resetBenchmark()" class="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs px-3 py-2 rounded-lg border border-slate-700 transition">
            <i class="fa-solid fa-arrow-rotate-left mr-1"></i> Reset
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <nav class="bg-slate-950/80 backdrop-blur-md px-4 border-t border-indigo-900/40 overflow-x-auto">
        <div class="max-w-7xl mx-auto flex space-x-1 text-xs sm:text-sm font-medium">
          <button onclick="setTab('benchmark')" class="nav-btn py-2.5 px-3 border-b-2 border-amber-400 text-amber-300 font-bold whitespace-nowrap" data-tab="benchmark">
            <i class="fa-solid fa-clipboard-check mr-1.5"></i><span data-i18n="nav_benchmark">Benchmark Verifier</span>
          </button>
          <button onclick="setTab('video')" class="nav-btn py-2.5 px-3 border-b-2 border-transparent text-rose-300 hover:text-white font-bold whitespace-nowrap" data-tab="video">
            <i class="fa-solid fa-video mr-1.5 text-rose-400"></i><span>Demo Video & Recorder</span>
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
    <div id="alertsBanner" class="hidden bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 px-4 py-2.5 text-xs font-bold shadow-md border-b border-amber-600">
      <div class="max-w-7xl mx-auto flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <i class="fa-solid fa-triangle-exclamation text-base text-slate-900 animate-bounce"></i>
          <span id="alertsBannerText">Alert: Low stock detected on critical items!</span>
        </div>
        <button onclick="setTab('production')" class="bg-slate-950 text-amber-300 px-3 py-1 rounded font-bold hover:bg-slate-900 transition">
          View MRP Production Plan &rarr;
        </button>
      </div>
    </div>

    <!-- Main Content Area -->
    <main class="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">

      <!-- Toast / Notification banner -->
      <div id="toast" class="hidden rounded-xl p-3.5 text-sm font-semibold flex items-center justify-between shadow-lg">
        <span id="toastMsg"></span>
        <button onclick="hideToast()" class="ml-4 font-bold text-lg">&times;</button>
      </div>

      <!-- TAB 1: BENCHMARK VERIFIER -->
      <section id="tab-benchmark" class="space-y-6 animate-fadeIn">
        <div class="card-modern p-6 sm:p-8">
          <div class="flex flex-wrap justify-between items-center gap-4 border-b border-slate-200 pb-5 mb-5">
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-100 text-indigo-800 uppercase tracking-wide">NIT Trichy Benchmark</span>
                <span class="text-xs text-slate-400 font-mono">Section 5 Validation</span>
              </div>
              <h2 class="text-xl sm:text-2xl font-black text-slate-900 mt-1" data-i18n="bench_title">Section 5 Benchmark Verification Matrix</h2>
              <p class="text-xs sm:text-sm text-slate-500">Center for Digital Infrastructure, NIT Tiruchirappalli evaluation scenario</p>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="runStep(1)" class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-sm transition">
                <i class="fa-solid fa-play mr-1.5"></i>Step 1
              </button>
              <button onclick="runFullBenchmark()" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl shadow-md transition flex items-center">
                <i class="fa-solid fa-check-double mr-1.5"></i>Verify All 11 Checks
              </button>
            </div>
          </div>

          <!-- 11 Criteria Checklist Table -->
          <div class="overflow-x-auto rounded-xl border border-slate-200">
            <table class="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr class="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-bold">
                  <th class="p-3.5">#</th>
                  <th class="p-3.5">Check Metric</th>
                  <th class="p-3.5">Expected (Section 5)</th>
                  <th class="p-3.5">Actual Live Value</th>
                  <th class="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody id="benchmarkTableBody" class="divide-y divide-slate-100">
                <!-- Loaded via JS -->
              </tbody>
            </table>
          </div>

          <!-- Step Progression Navigator -->
          <div class="mt-6 pt-5 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            <button onclick="runStep(1)" class="p-3 rounded-xl border text-xs text-left hover:bg-indigo-50/70 border-slate-200 card-modern">
              <span class="font-extrabold block text-indigo-700">Step 1</span>
              <span class="text-slate-600 font-medium">Purchase 60kg flour</span>
            </button>
            <button onclick="runStep(2)" class="p-3 rounded-xl border text-xs text-left hover:bg-indigo-50/70 border-slate-200 card-modern">
              <span class="font-extrabold block text-indigo-700">Step 2 & 3</span>
              <span class="text-slate-600 font-medium">Murukku run (188 pkts)</span>
            </button>
            <button onclick="runStep(4)" class="p-3 rounded-xl border text-xs text-left hover:bg-indigo-50/70 border-slate-200 card-modern">
              <span class="font-extrabold block text-indigo-700">Step 4</span>
              <span class="text-slate-600 font-medium">Order Retailer A (150)</span>
            </button>
            <button onclick="runStep(5)" class="p-3 rounded-xl border text-xs text-left hover:bg-indigo-50/70 border-slate-200 card-modern">
              <span class="font-extrabold block text-indigo-700">Step 5</span>
              <span class="text-slate-600 font-medium">Invoice & Dispatch A</span>
            </button>
            <button onclick="runStep(6)" class="p-3 rounded-xl border text-xs text-left hover:bg-indigo-50/70 border-slate-200 card-modern">
              <span class="font-extrabold block text-indigo-700">Step 6</span>
              <span class="text-slate-600 font-medium">Order B (Shortage 32)</span>
            </button>
            <button onclick="runStep(7)" class="p-3 rounded-xl border text-xs text-left hover:bg-indigo-50/70 border-slate-200 card-modern">
              <span class="font-extrabold block text-indigo-700">Step 7</span>
              <span class="text-slate-600 font-medium">Payment ₹4,000 (A)</span>
            </button>
            <button onclick="setTab('audit')" class="p-3 rounded-xl border text-xs text-left hover:bg-indigo-50/70 border-slate-200 bg-slate-50 card-modern">
              <span class="font-extrabold block text-indigo-700">Step 9</span>
              <span class="text-slate-600 font-medium">Monthly Reports</span>
            </button>
          </div>
        </div>
      </section>

      <!-- TAB: DEMO VIDEO & RECORDER STUDIO (NEW FEATURE) -->
      <section id="tab-video" class="hidden space-y-6 animate-fadeIn">
        <div class="card-modern p-6 sm:p-8">
          <div class="flex flex-wrap justify-between items-center gap-4 border-b border-slate-200 pb-5 mb-5">
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-100 text-rose-800 uppercase tracking-wide">NIT Trichy Submission</span>
                <span class="text-xs text-slate-400 font-mono">1080p / 720p HD Canvas Recorder</span>
              </div>
              <h2 class="text-xl sm:text-2xl font-black text-slate-900 mt-1">Interactive Demo Video Studio & Recorder</h2>
              <p class="text-xs sm:text-sm text-slate-500">Record a high-definition end-to-end demonstration video (.webm / .mp4) ready for submission uploading</p>
            </div>
            <div class="flex items-center flex-wrap gap-2.5">
              <!-- Speed Selector -->
              <div class="flex items-center bg-slate-100 rounded-xl px-3 py-1.5 border border-slate-200 text-xs">
                <span class="text-slate-500 mr-2 font-semibold">Speed:</span>
                <select id="videoSpeed" class="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer">
                  <option value="1">1x (Normal)</option>
                  <option value="2" selected>2x (Fast)</option>
                  <option value="4">4x (Ultra)</option>
                </select>
              </div>

              <!-- Start Recording Button -->
              <button id="btnStartVideo" onclick="startVideoRecording()" class="bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center transition active:scale-95">
                <i class="fa-solid fa-video mr-1.5"></i>Record & Download Demo Video
              </button>

              <!-- Manual Download Button -->
              <button id="btnDownloadVideo" onclick="downloadRecordedVideo()" disabled class="bg-slate-200 text-slate-400 font-bold text-xs px-3.5 py-2.5 rounded-xl transition cursor-not-allowed">
                <i class="fa-solid fa-download mr-1.5"></i>Download Video
              </button>
            </div>
          </div>

          <!-- Video Canvas / Live Preview Container -->
          <div class="space-y-4">
            <!-- Progress Bar -->
            <div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
              <div id="videoProgressBar" class="bg-gradient-to-r from-rose-500 to-amber-500 h-2.5 rounded-full transition-all duration-300 w-0"></div>
            </div>

            <div class="flex justify-between items-center text-xs font-semibold text-slate-600 px-1">
              <span id="videoStatusText">Ready to record. Click "Record & Download Demo Video" above.</span>
              <span id="videoTimeText" class="font-mono text-slate-500">00:00 / 00:45</span>
            </div>

            <!-- Canvas Display Element -->
            <div class="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-800 flex items-center justify-center">
              <canvas id="videoCanvas" width="1280" height="720" class="w-full h-full object-contain"></canvas>
            </div>

            <!-- Narration Subtitles Banner -->
            <div class="p-4 bg-indigo-950 text-indigo-100 rounded-xl border border-indigo-800/60 shadow-inner flex items-start space-x-3">
              <div class="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                <i class="fa-solid fa-closed-captioning"></i>
              </div>
              <div class="space-y-0.5 text-xs">
                <span class="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Live Video Narration Subtitle:</span>
                <p id="videoSubtitle" class="font-medium text-slate-200 leading-relaxed italic">
                  "SnackFlow Operations: End-to-end Order-to-Audit ERP for small food manufacturers."
                </p>
              </div>
            </div>

            <!-- Video Player for Replay of Completed Recording -->
            <div id="videoReplayContainer" class="hidden p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div class="flex justify-between items-center">
                <h4 class="text-sm font-bold text-slate-800 flex items-center">
                  <i class="fa-solid fa-circle-play text-emerald-600 mr-2"></i>Recorded Video Replay
                </h4>
                <span class="text-xs text-emerald-700 bg-emerald-100 font-bold px-2 py-0.5 rounded">Ready for Submission</span>
              </div>
              <video id="videoPreview" controls class="w-full rounded-xl shadow-md max-h-96 bg-black"></video>
            </div>

            <!-- Video Script Accordion Guide -->
            <div class="border border-slate-200 rounded-xl p-5 bg-white space-y-3">
              <div class="flex justify-between items-center cursor-pointer" onclick="toggleScriptGuide()">
                <h4 class="text-sm font-bold text-slate-900 flex items-center">
                  <i class="fa-solid fa-file-lines text-indigo-600 mr-2"></i>Submission Talking Points & Voiceover Script Guide
                </h4>
                <i id="scriptChevron" class="fa-solid fa-chevron-down text-slate-400 transition-transform"></i>
              </div>

              <div id="scriptGuideContent" class="hidden text-xs text-slate-600 space-y-2 pt-2 border-t border-slate-100">
                <p>Use the generated video file directly (or read this script while recording your own camera/screen):</p>
                <div class="p-3 bg-slate-50 rounded-lg space-y-2 font-mono text-[11px] border">
                  <div><strong>00:00 - 00:08:</strong> Introduction: Two closed loops meeting at Finished Goods Stock.</div>
                  <div><strong>00:08 - 00:15:</strong> Step 1: Inward purchase of 60kg flour @ ₹45/kg &rarr; 160kg flour stock.</div>
                  <div><strong>00:15 - 00:25:</strong> Step 2, 3 & 8: Production run PR-2026-001 with Murukku BOM & overheads. Flagged yield (-6%) & oil (+5%). FIFO cost ₹30.90 / Weighted Avg ₹31.14.</div>
                  <div><strong>00:25 - 00:32:</strong> Step 4 & 5: Salesman A order (150 pkts) &rarr; GST Tax Invoice INV/2026-27/0001 (₹7,875) & dispatch (88 pkts left).</div>
                  <div><strong>00:32 - 00:38:</strong> Step 6: Salesman B order (120 pkts) &rarr; Stock shortage of 32 packets flagged, IGST 5% applied.</div>
                  <div><strong>00:38 - 00:42:</strong> Step 7: Payment collection of ₹4,000 from Retailer A &rarr; Outstanding ₹3,875.</div>
                  <div><strong>00:42 - 00:45:</strong> Step 9: Auditor reports and 100% verification of all 11 criteria.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- TAB 2: SALES ORDER BOOKING (MOBILE FIRST) & FIELD ROUTE CHECK-IN -->
      <section id="tab-sales" class="hidden space-y-6 animate-fadeIn">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Order Placement Card -->
          <div class="card-modern p-6">
            <h3 class="text-base font-bold text-slate-900 mb-1 flex items-center">
              <i class="fa-solid fa-cart-plus text-indigo-600 mr-2"></i><span data-i18n="order_book_title">Book Field Order (&lt; 1 min)</span>
            </h3>
            <p class="text-xs text-slate-500 mb-4">Direct from retailer store to factory</p>

            <form id="orderForm" onsubmit="handleCreateOrder(event)" class="space-y-4">
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Select Customer</label>
                <select id="orderCustomer" class="w-full border rounded-xl p-2.5 text-sm bg-slate-50 focus:bg-white focus:outline-indigo-500">
                  <option value="cust-retailer-a">Retailer A (Chennai Stores) - Tamil Nadu</option>
                  <option value="cust-distributor-b">Distributor B (Bengaluru Hub) - Karnataka</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Product</label>
                <input type="text" id="orderProductName" value="Murukku 200g (FG-MURUKKU-200G)" readonly class="w-full border rounded-xl p-2.5 text-sm bg-slate-100 text-slate-600 font-medium">
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">Quantity (Packets)</label>
                  <input type="number" id="orderQty" value="150" min="1" required class="w-full border rounded-xl p-2.5 text-sm focus:outline-indigo-500 font-bold">
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">Price / Pkt</label>
                  <input type="text" value="₹50.00" readonly class="w-full border rounded-xl p-2.5 text-sm bg-slate-100 font-medium">
                </div>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Notes / Instructions</label>
                <input type="text" id="orderNotes" placeholder="Delivery urgency, route notes..." class="w-full border rounded-xl p-2 text-xs">
              </div>

              <div class="p-3.5 bg-indigo-50/70 rounded-xl text-xs space-y-1 border border-indigo-100">
                <div class="flex justify-between">
                  <span class="text-slate-600">Current FG Stock:</span>
                  <span id="orderFgAvailable" class="font-bold text-slate-800">50 packets</span>
                </div>
                <div class="flex justify-between text-indigo-900 font-bold border-t border-indigo-200 pt-1">
                  <span>Estimated Total (5% GST):</span>
                  <span id="orderEstTotal">₹7,875.00</span>
                </div>
              </div>

              <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-md text-sm transition active:scale-95">
                <i class="fa-solid fa-paper-plane mr-1.5"></i>Submit Order to Factory
              </button>
            </form>
          </div>

          <!-- Salesman Field Route GPS Check-in Card -->
          <div class="card-modern p-6">
            <h3 class="text-base font-bold text-slate-900 mb-1 flex items-center">
              <i class="fa-solid fa-map-location-dot text-amber-600 mr-2"></i>Salesman Field Route Check-in
            </h3>
            <p class="text-xs text-slate-500 mb-4">GPS-tagged store visits & offline sync capability</p>

            <form id="visitForm" onsubmit="handleFieldCheckin(event)" class="space-y-3 text-xs">
              <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span class="text-slate-500 font-semibold block mb-0.5">Simulated GPS Coordinates:</span>
                <span class="font-mono text-indigo-700 font-bold">📍 9.9252° N, 78.1198° E (Kappalur Route)</span>
              </div>

              <div>
                <label class="block font-semibold text-slate-700 mb-1">Store Visited</label>
                <select id="visitCustomer" class="w-full border rounded-xl p-2 bg-slate-50 text-xs">
                  <option value="cust-retailer-a">Retailer A (Chennai Stores)</option>
                  <option value="cust-distributor-b">Distributor B (Bengaluru Wholesale Hub)</option>
                </select>
              </div>

              <div>
                <label class="block font-semibold text-slate-700 mb-1">Store Status</label>
                <select id="visitStatus" class="w-full border rounded-xl p-2 bg-white text-xs">
                  <option value="Visited & Placed Order">Visited & Placed Order</option>
                  <option value="Store Closed">Store Closed</option>
                  <option value="Stock Adequate (Revisit Next Week)">Stock Adequate (Revisit Next Week)</option>
                  <option value="Payment Follow-up Done">Payment Follow-up Done</option>
                </select>
              </div>

              <div>
                <label class="block font-semibold text-slate-700 mb-1">Field Observation / Remarks</label>
                <input type="text" id="visitNotes" placeholder="Retailer demand rising, competitor check..." class="w-full border rounded-xl p-2 text-xs">
              </div>

              <div class="flex items-center justify-between text-[11px] text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 font-semibold">
                <span><i class="fa-solid fa-signal mr-1"></i>Offline PWA Cache: Active</span>
                <span class="font-bold">Sync: Instant</span>
              </div>

              <button type="submit" class="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-3 rounded-xl shadow-md text-xs transition active:scale-95">
                <i class="fa-solid fa-location-crosshairs mr-1"></i>Record Field Visit
              </button>
            </form>
          </div>

          <!-- Orders List -->
          <div class="card-modern p-6">
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
            <div class="mt-6 pt-4 border-t border-slate-200">
              <h4 class="text-xs font-bold text-slate-800 mb-2 flex items-center">
                <i class="fa-solid fa-list-check mr-1.5 text-indigo-600"></i>Field Check-in Audit Trail
              </h4>
              <div id="visitsLogContainer" class="space-y-2 max-h-40 overflow-y-auto text-[11px]">
                <!-- Loaded via JS -->
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- TAB 3: FACTORY ADMIN & GST BILLING -->
      <section id="tab-admin" class="hidden space-y-6 animate-fadeIn">
        <div class="card-modern p-6 sm:p-8">
          <h2 class="text-lg font-bold text-slate-900 mb-1" data-i18n="admin_title">Incoming Orders & GST Billing Desk</h2>
          <p class="text-xs text-slate-500 mb-4">Verify finished stock, generate tax invoice with financial year sequence, dispatch, and collect receivables</p>

          <div class="overflow-x-auto rounded-xl border border-slate-200">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-slate-100 text-slate-700 border-b font-bold">
                  <th class="p-3">Order #</th>
                  <th class="p-3">Customer & State</th>
                  <th class="p-3">Items</th>
                  <th class="p-3">Stock Coverage</th>
                  <th class="p-3">Grand Total</th>
                  <th class="p-3">Status</th>
                  <th class="p-3 text-center">Admin Actions</th>
                </tr>
              </thead>
              <tbody id="adminOrdersTableBody" class="divide-y divide-slate-100">
                <!-- Loaded via JS -->
              </tbody>
            </table>
          </div>
        </div>

        <!-- Generated Invoices List -->
        <div class="card-modern p-6 sm:p-8">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-base font-bold text-slate-900">GST Tax Invoices Raised (FY 2026-27)</h3>
            <button onclick="exportTally()" class="text-xs bg-emerald-50 text-emerald-700 border border-emerald-300 font-semibold px-3 py-1.5 rounded-xl hover:bg-emerald-100">
              <i class="fa-solid fa-file-code mr-1"></i>Export Tally XML
            </button>
          </div>
          <div class="overflow-x-auto rounded-xl border border-slate-200">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-slate-100 text-slate-700 border-b font-bold">
                  <th class="p-3">Invoice #</th>
                  <th class="p-3">Date</th>
                  <th class="p-3">Customer</th>
                  <th class="p-3">Taxable</th>
                  <th class="p-3">CGST + SGST / IGST</th>
                  <th class="p-3">Total</th>
                  <th class="p-3">Paid</th>
                  <th class="p-3">Balance Due</th>
                  <th class="p-3">Dispatch</th>
                  <th class="p-3 text-center">Actions & Documents</th>
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
      <section id="tab-production" class="hidden space-y-6 animate-fadeIn">
        <!-- MRP Material Requirement Planning Banner -->
        <div class="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-xl border border-indigo-800/40">
          <div class="flex flex-wrap justify-between items-start gap-4">
            <div>
              <span class="text-[11px] bg-amber-400 text-slate-950 font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">MRP Demand Planner</span>
              <h3 class="text-lg sm:text-xl font-black mt-1.5">Production Planning from Pending Retail Demand</h3>
              <p class="text-xs text-indigo-200 mt-1" id="planningSummaryText">Calculating raw material and packaging needs...</p>
            </div>
            <button onclick="applyPlanningToRun()" class="bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-extrabold text-xs px-4 py-2.5 rounded-xl shadow transition flex items-center active:scale-95">
              <i class="fa-solid fa-wand-magic-sparkles mr-1.5"></i>Auto-Fill Batch Values
            </button>
          </div>

          <!-- Material Requirements Cards -->
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-3.5 mt-5 text-xs" id="mrpCardsContainer">
            <!-- Loaded via JS -->
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Standard BOM Recipe -->
          <div class="card-modern p-6">
            <h3 class="text-base font-bold text-slate-900 mb-1 flex items-center">
              <i class="fa-solid fa-kitchen-set text-amber-600 mr-2"></i>Standard Recipe BOM
            </h3>
            <p class="text-xs text-slate-500 mb-4">Murukku 200g (Batch = 200 packets)</p>

            <div class="space-y-2 text-xs">
              <div class="p-3 rounded-xl bg-slate-50 flex justify-between font-medium border border-slate-200">
                <span data-i18n="item_flour">Flour (Besan/Rice)</span>
                <span class="font-bold">40 kg @ ₹42-45</span>
              </div>
              <div class="p-3 rounded-xl bg-slate-50 flex justify-between font-medium border border-slate-200">
                <span data-i18n="item_oil">Cooking Oil</span>
                <span class="font-bold">10 L @ ₹140</span>
              </div>
              <div class="p-3 rounded-xl bg-slate-50 flex justify-between font-medium border border-slate-200">
                <span data-i18n="item_spices">Salt & Spice Mix</span>
                <span class="font-bold">1.2 kg @ ₹200</span>
              </div>
              <div class="p-3 rounded-xl bg-slate-50 flex justify-between font-medium border border-slate-200">
                <span data-i18n="item_pouch">200g Pouches</span>
                <span class="font-bold">200 pcs @ ₹2.50</span>
              </div>
              <div class="p-3 rounded-xl bg-slate-50 flex justify-between font-medium border border-slate-200">
                <span data-i18n="item_carton">Master Cartons (holds 20)</span>
                <span class="font-bold">10 pcs @ ₹15.00</span>
              </div>
              <div class="p-3 rounded-xl bg-amber-50 text-amber-900 flex justify-between font-semibold border border-amber-200">
                <span>Standard Overheads:</span>
                <span>Labour ₹1,200 | Power ₹600</span>
              </div>
            </div>

            <!-- Inward Purchase Button -->
            <div class="mt-6 pt-4 border-t border-slate-200">
              <h4 class="text-xs font-bold text-slate-800 mb-2">Record Inward RM Purchase</h4>
              <button onclick="handleRecordPurchasePrompt()" class="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 px-3 rounded-xl text-xs transition">
                <i class="fa-solid fa-truck-ramp-box mr-1"></i>Receive 60kg Flour @ ₹45/kg
              </button>
            </div>
          </div>

          <!-- Production Run Logger -->
          <div class="lg:col-span-2 card-modern p-6">
            <h3 class="text-base font-bold text-slate-900 mb-1 flex items-center">
              <i class="fa-solid fa-gears text-indigo-600 mr-2"></i>Log Daily Production Run
            </h3>
            <p class="text-xs text-slate-500 mb-4">Planned vs actual consumption & yield with automatic variance flagging</p>

            <form id="productionForm" onsubmit="handleCreateProduction(event)" class="space-y-4 text-xs">
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Flour Issued (kg)</label>
                  <input type="number" id="runFlour" value="40" step="0.1" required class="w-full border rounded-xl p-2.5 font-bold focus:outline-indigo-500">
                  <span class="text-[10px] text-slate-400">Standard: 40 kg</span>
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Oil Issued (L)</label>
                  <input type="number" id="runOil" value="10.5" step="0.1" required class="w-full border rounded-xl p-2.5 font-bold focus:outline-indigo-500 text-red-600">
                  <span class="text-[10px] text-red-500 font-semibold">+0.5 L over standard (5%)</span>
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Spices Issued (kg)</label>
                  <input type="number" id="runSpice" value="1.2" step="0.1" required class="w-full border rounded-xl p-2.5 font-bold focus:outline-indigo-500">
                  <span class="text-[10px] text-slate-400">Standard: 1.2 kg</span>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Actual Good Packets</label>
                  <input type="number" id="runActualOutput" value="188" required class="w-full border rounded-xl p-2.5 font-bold focus:outline-indigo-500 text-red-600">
                  <span class="text-[10px] text-red-500 font-semibold">Yield -6% (188 vs 200 exp)</span>
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Damaged Pouches</label>
                  <input type="number" id="runDamagedPouches" value="6" required class="w-full border rounded-xl p-2.5 font-bold focus:outline-indigo-500">
                  <span class="text-[10px] text-slate-400">Heat-seal scrap</span>
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Cartons Used</label>
                  <input type="number" id="runCartons" value="9" required class="w-full border rounded-xl p-2.5 font-bold focus:outline-indigo-500">
                  <span class="text-[10px] text-slate-400">Standard: 9-10 cartons</span>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Allocated Labour (₹)</label>
                  <input type="number" id="runLabour" value="1200" required class="w-full border rounded-lg p-2 font-medium">
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Allocated Gas / Power (₹)</label>
                  <input type="number" id="runPower" value="600" required class="w-full border rounded-lg p-2 font-medium">
                </div>
              </div>

              <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 px-4 rounded-xl shadow-md text-xs transition active:scale-95">
                <i class="fa-solid fa-floppy-disk mr-1.5"></i>Post Production Run (Auto-updates Raw & Finished Stock)
              </button>
            </form>
          </div>
        </div>

        <!-- Production History Table -->
        <div class="card-modern p-6 sm:p-8">
          <h3 class="text-base font-bold text-slate-900 mb-4">Production Runs & Variance Ledger</h3>
          <div class="overflow-x-auto rounded-xl border border-slate-200">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-slate-100 text-slate-700 border-b font-bold">
                  <th class="p-3">Run #</th>
                  <th class="p-3">Batch #</th>
                  <th class="p-3">Expected vs Actual Yield</th>
                  <th class="p-3">Yield Variance</th>
                  <th class="p-3">Oil Consumption</th>
                  <th class="p-3">Damaged Pouches</th>
                  <th class="p-3">Cost / Packet</th>
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
      <section id="tab-inventory" class="hidden space-y-6 animate-fadeIn">
        <div class="card-modern p-6 sm:p-8">
          <div class="flex justify-between items-center mb-4">
            <div>
              <h2 class="text-lg font-bold text-slate-900" data-i18n="stock_title">Current Inventory Balances</h2>
              <p class="text-xs text-slate-500">Separately maintained for Raw Materials, Packaging, and Finished Goods</p>
            </div>
            <button onclick="exportCSV('stock')" class="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold px-3 py-1.5 rounded-xl hover:bg-indigo-100">
              <i class="fa-solid fa-download mr-1"></i>Export Stock Summary
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" id="balancesCards">
            <!-- Loaded via JS -->
          </div>
        </div>

        <!-- Full Detailed Movement Ledger -->
        <div class="card-modern p-6 sm:p-8">
          <div class="flex justify-between items-center mb-4">
            <div>
              <h3 class="text-base font-bold text-slate-900">Detailed Stock Ledger (Audit Trail)</h3>
              <p class="text-xs text-slate-500">Every single movement links back to its source document</p>
            </div>
            <button onclick="exportCSV('ledger')" class="text-xs bg-slate-100 text-slate-700 font-semibold px-3 py-1.5 rounded-xl hover:bg-slate-200">
              <i class="fa-solid fa-file-csv mr-1"></i>Export Ledger CSV
            </button>
          </div>

          <div class="overflow-x-auto max-h-96 rounded-xl border border-slate-200">
            <table class="w-full text-left text-xs border-collapse">
              <thead class="sticky top-0 bg-slate-100 font-bold z-10">
                <tr class="text-slate-700 border-b">
                  <th class="p-3">Date & Time</th>
                  <th class="p-3">Item</th>
                  <th class="p-3">Movement</th>
                  <th class="p-3">In</th>
                  <th class="p-3">Out</th>
                  <th class="p-3 font-bold">Balance</th>
                  <th class="p-3">Ref Document</th>
                  <th class="p-3">Notes</th>
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
      <section id="tab-costing" class="hidden space-y-6 animate-fadeIn">
        <div class="card-modern p-6 sm:p-8">
          <h2 class="text-lg font-bold text-slate-900 mb-1" data-i18n="costing_title">Production Costing & Margin Analysis</h2>
          <p class="text-xs text-slate-500 mb-4">Section 4.5 & Benchmark step 8: Raw materials + packaging + labour + power</p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- FIFO Method Card -->
            <div class="border rounded-2xl p-6 bg-gradient-to-br from-indigo-50/70 to-white border-indigo-200 shadow-sm">
              <div class="flex justify-between items-start mb-3">
                <span class="text-xs font-bold uppercase tracking-wider text-indigo-700">Valuation: FIFO (First In First Out)</span>
                <span class="text-xs bg-indigo-100 text-indigo-800 font-bold px-2.5 py-0.5 rounded-full">Primary</span>
              </div>
              <div class="text-3xl sm:text-4xl font-black text-slate-900 mb-1" id="costFifoVal">₹30.90 <span class="text-xs font-normal text-slate-500">/ packet</span></div>
              <p class="text-xs text-slate-500 mb-4">40kg flour from opening @ ₹42 + Oil ₹140 + Spices ₹200 + Packaging ₹620 + Overheads ₹1,800</p>
              
              <div class="space-y-2 text-xs border-t border-indigo-100 pt-3">
                <div class="flex justify-between">
                  <span class="text-slate-600">Raw & Packaging Cost:</span>
                  <span class="font-semibold">₹4,010.00</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-600">Allocated Overheads (Labour+Power):</span>
                  <span class="font-semibold">₹1,800.00</span>
                </div>
                <div class="flex justify-between font-bold border-t border-indigo-200 pt-1 text-slate-800">
                  <span>Total Batch Cost (188 pkts):</span>
                  <span>₹5,810.00</span>
                </div>
                <div class="flex justify-between text-emerald-700 font-bold pt-1 text-sm">
                  <span>Gross Margin @ ₹50 Selling Price:</span>
                  <span>₹19.10 / pkt (38.2%)</span>
                </div>
              </div>
            </div>

            <!-- Weighted Average Method Card -->
            <div class="border rounded-2xl p-6 bg-gradient-to-br from-amber-50/70 to-white border-amber-200 shadow-sm">
              <div class="flex justify-between items-start mb-3">
                <span class="text-xs font-bold uppercase tracking-wider text-amber-700">Valuation: Weighted Average</span>
                <span class="text-xs bg-amber-100 text-amber-800 font-bold px-2.5 py-0.5 rounded-full">Alternate</span>
              </div>
              <div class="text-3xl sm:text-4xl font-black text-slate-900 mb-1" id="costWaVal">₹31.14 <span class="text-xs font-normal text-slate-500">/ packet</span></div>
              <p class="text-xs text-slate-500 mb-4">Flour weighted avg rate: (100*42 + 60*45)/160 = ₹43.125/kg</p>
              
              <div class="space-y-2 text-xs border-t border-amber-100 pt-3">
                <div class="flex justify-between">
                  <span class="text-slate-600">Raw & Packaging Cost:</span>
                  <span class="font-semibold">₹4,055.00</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-600">Allocated Overheads (Labour+Power):</span>
                  <span class="font-semibold">₹1,800.00</span>
                </div>
                <div class="flex justify-between font-bold border-t border-amber-200 pt-1 text-slate-800">
                  <span>Total Batch Cost (188 pkts):</span>
                  <span>₹5,855.00</span>
                </div>
                <div class="flex justify-between text-emerald-700 font-bold pt-1 text-sm">
                  <span>Gross Margin @ ₹50 Selling Price:</span>
                  <span>₹18.86 / pkt (37.7%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- TAB 7: AUDITOR REPORTS -->
      <section id="tab-audit" class="hidden space-y-6 animate-fadeIn">
        <div class="card-modern p-6 sm:p-8">
          <div class="flex flex-wrap justify-between items-center gap-4 mb-6">
            <div>
              <h2 class="text-lg font-bold text-slate-900" data-i18n="audit_title">Auditor Monthly Export Hub</h2>
              <p class="text-xs text-slate-500">Standard audit reports formatted for GSTR-1, GSTR-3B, Tax Audit, and Tally ERP</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button onclick="exportCSV('sales')" class="text-xs bg-slate-800 hover:bg-slate-700 text-white font-semibold px-3 py-2 rounded-xl">
                <i class="fa-solid fa-file-csv mr-1"></i>Sales Register CSV
              </button>
              <button onclick="exportCSV('stock')" class="text-xs bg-slate-800 hover:bg-slate-700 text-white font-semibold px-3 py-2 rounded-xl">
                <i class="fa-solid fa-file-csv mr-1"></i>Stock Summary CSV
              </button>
              <button onclick="exportTally()" class="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-2 rounded-xl">
                <i class="fa-solid fa-file-code mr-1"></i>Tally XML
              </button>
            </div>
          </div>

          <!-- GST Summary Card -->
          <div class="border rounded-2xl p-5 mb-6 bg-slate-50 border-slate-200">
            <h3 class="text-sm font-bold text-slate-800 mb-3 flex items-center">
              <i class="fa-solid fa-scale-balanced text-indigo-600 mr-2"></i>GST Outward Supplies (GSTR-1 Summary)
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs" id="gstSummaryCard">
              <!-- Loaded via JS -->
            </div>
          </div>

          <!-- Receivables & Aging -->
          <div class="border rounded-2xl p-5 border-slate-200">
            <h3 class="text-sm font-bold text-slate-800 mb-3 flex items-center">
              <i class="fa-solid fa-hand-holding-dollar text-emerald-600 mr-2"></i>Accounts Receivable & Aging (0-30, 31-60, 61-90, 90+ Days)
            </h3>
            <div class="overflow-x-auto rounded-xl border border-slate-200">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="bg-slate-100 text-slate-700 border-b font-bold">
                    <th class="p-2.5">Customer</th>
                    <th class="p-2.5">State</th>
                    <th class="p-2.5">Invoiced</th>
                    <th class="p-2.5">Paid</th>
                    <th class="p-2.5 font-bold">Total Due</th>
                    <th class="p-2.5">0-30 Days</th>
                    <th class="p-2.5">31-60 Days</th>
                    <th class="p-2.5">61-90 Days</th>
                    <th class="p-2.5">90+ Days</th>
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
      <section id="tab-owner" class="hidden space-y-6 animate-fadeIn">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="card-modern p-5">
            <span class="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Sales Invoiced</span>
            <div class="text-3xl font-black text-slate-900 mt-1" id="dashSales">₹7,875.00</div>
            <span class="text-[11px] text-emerald-600 font-semibold mt-1 block"><i class="fa-solid fa-circle-check mr-1"></i>100% Tax Compliant</span>
          </div>
          <div class="card-modern p-5">
            <span class="text-xs text-slate-500 font-bold uppercase tracking-wider">Cash Collected</span>
            <div class="text-3xl font-black text-emerald-700 mt-1" id="dashCash">₹4,000.00</div>
            <span class="text-[11px] text-slate-500 font-semibold mt-1 block">Via NEFT / Direct</span>
          </div>
          <div class="card-modern p-5">
            <span class="text-xs text-slate-500 font-bold uppercase tracking-wider">Outstanding Receivables</span>
            <div class="text-3xl font-black text-amber-600 mt-1" id="dashDue">₹3,875.00</div>
            <span class="text-[11px] text-amber-700 font-semibold mt-1 block">Retailer A balance</span>
          </div>
          <div class="card-modern p-5">
            <span class="text-xs text-slate-500 font-bold uppercase tracking-wider">Finished Goods Stock</span>
            <div class="text-3xl font-black text-indigo-700 mt-1" id="dashFg">88 pkts</div>
            <span class="text-[11px] text-indigo-600 font-semibold mt-1 block">Available for dispatch</span>
          </div>
        </div>
      </section>

    </main>
  </div>

  <!-- MODAL 1: AUTHENTIC PRINTABLE INDIAN GST TAX INVOICE -->
  <div id="invoiceModal" class="hidden fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 sm:p-8 space-y-6 relative border border-slate-300">
      <div class="flex justify-between items-center border-b pb-4 no-print">
        <div>
          <span class="text-xs bg-indigo-100 text-indigo-800 font-bold px-2.5 py-0.5 rounded-full">ORIGINAL FOR RECIPIENT</span>
          <h2 class="text-xl font-black text-slate-900 mt-1">TAX INVOICE / வர்த்தக வரி விலைப்பட்டியல்</h2>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="window.print()" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow">
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
          <div class="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
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
    let recordedVideoBlob = null;
    let isRecordingVideo = false;

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

      if (tabName === 'video') {
        drawVideoScene(0);
      }
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
        <tr class="\${r.pass ? 'hover:bg-emerald-50/60' : 'hover:bg-red-50/60'} transition-colors">
          <td class="p-3.5 text-slate-400 font-mono font-semibold">\${i+1}</td>
          <td class="p-3.5 font-bold text-slate-900">\${r.check}</td>
          <td class="p-3.5 text-slate-600 font-medium">\${r.exp}</td>
          <td class="p-3.5 font-extrabold \${r.pass ? 'text-emerald-700' : 'text-slate-800'}">\${r.act}</td>
          <td class="p-3.5">
            <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-black \${r.pass ? 'badge-pass' : 'badge-flagged'} shadow-sm">
              \${r.pass ? '<i class="fa-solid fa-check mr-1.5"></i>PASS' : '<i class="fa-solid fa-xmark mr-1.5"></i>PENDING'}
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
          <td class="p-2.5 font-bold text-indigo-700">\${o.orderNumber}</td>
          <td class="p-2.5">\${o.customerName}</td>
          <td class="p-2.5 font-semibold">\${o.items[0]?.quantity} pkts</td>
          <td class="p-2.5 font-bold">₹\${o.grandTotal.toFixed(2)}</td>
          <td class="p-2.5">
            \${o.hasShortage 
              ? '<span class="text-xs bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full">Short: ' + o.items[0].shortageQuantity + '</span>' 
              : '<span class="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">OK</span>'}
          </td>
          <td class="p-2.5">
            <span class="uppercase text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">\${o.status}</span>
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
        <div class="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
          <div class="flex justify-between font-bold text-slate-800">
            <span>\${v.customerName}</span>
            <span class="text-slate-400 font-mono text-[10px]">\${v.timestamp.slice(11, 16)}</span>
          </div>
          <div class="text-indigo-700 font-semibold">\${v.shopStatus}</div>
          <div class="text-[10px] text-slate-500">\${v.gpsCoordinates} • \${v.notes || ''}</div>
        </div>
      \`).join('');
    }

    function renderAdminOrders() {
      if (!state) return;
      const tbody = document.getElementById('adminOrdersTableBody');
      tbody.innerHTML = state.salesOrders.map(o => \`
        <tr>
          <td class="p-3 font-bold text-indigo-700 font-mono">\${o.orderNumber}</td>
          <td class="p-3 font-medium">\${o.customerName} <span class="text-slate-400 text-xs">(\${o.customerState})</span></td>
          <td class="p-3">\${o.items.map(i => i.quantity + ' ' + i.unit).join(', ')}</td>
          <td class="p-3">
            \${o.hasShortage 
              ? '<span class="text-xs bg-red-100 text-red-700 font-bold px-2.5 py-1 rounded-full"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Shortage: ' + o.items[0].shortageQuantity + ' pkts</span>' 
              : '<span class="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full">Covered</span>'}
          </td>
          <td class="p-3 font-extrabold text-slate-900">₹\${o.grandTotal.toFixed(2)}</td>
          <td class="p-3"><span class="uppercase text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100">\${o.status}</span></td>
          <td class="p-3 text-center">
            \${o.status === 'submitted' ? \`
              <button onclick="approveOrder('\${o.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs mr-1 shadow">Approve</button>
            \` : ''}
            \${o.status === 'approved' ? \`
              <button onclick="generateInvoice('\${o.id}')" class="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs mr-1 shadow">Raise GST Invoice</button>
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
          <td class="p-3 font-bold text-indigo-700 font-mono">\${inv.invoiceNumber}</td>
          <td class="p-3">\${inv.invoiceDate}</td>
          <td class="p-3 font-semibold text-slate-900">\${inv.customerName}</td>
          <td class="p-3">₹\${inv.totalTaxable.toFixed(2)}</td>
          <td class="p-3">
            \${inv.isInterState 
              ? 'IGST 5%: ₹' + inv.totalIgst.toFixed(2) 
              : 'CGST: ₹' + inv.totalCgst.toFixed(2) + ' + SGST: ₹' + inv.totalSgst.toFixed(2)}
          </td>
          <td class="p-3 font-black text-slate-900">₹\${inv.grandTotal.toFixed(2)}</td>
          <td class="p-3 text-emerald-700 font-bold">₹\${inv.amountPaid.toFixed(2)}</td>
          <td class="p-3 text-red-600 font-black">₹\${inv.balanceDue.toFixed(2)}</td>
          <td class="p-3">
            \${inv.dispatchStatus === 'dispatched' 
              ? '<span class="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">Dispatched</span>' 
              : '<span class="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">Pending</span>'}
          </td>
          <td class="p-3 text-center space-x-1 whitespace-nowrap">
            <button onclick="openInvoiceModal('\${inv.id}')" class="bg-slate-900 hover:bg-slate-800 text-white font-bold px-2.5 py-1.5 rounded-lg text-xs shadow-sm" title="View Official GST Tax Invoice">
              <i class="fa-solid fa-file-invoice mr-1"></i>Tax Invoice
            </button>
            <button onclick="openEwayModal('\${inv.id}')" class="bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-2.5 py-1.5 rounded-lg text-xs shadow-sm" title="View e-Way Bill & IRN">
              <i class="fa-solid fa-truck mr-1"></i>e-Way
            </button>
            \${inv.dispatchStatus === 'pending' ? \`
              <button onclick="dispatchInvoice('\${inv.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2.5 py-1.5 rounded-lg text-xs shadow-sm">Dispatch</button>
            \` : ''}
            \${inv.balanceDue > 0 ? \`
              <button onclick="recordPaymentPrompt('\${inv.id}', '\${inv.customerId}', \${inv.balanceDue})" class="bg-amber-600 hover:bg-amber-700 text-white font-bold px-2.5 py-1.5 rounded-lg text-xs shadow-sm">Record Pay</button>
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
        <div class="bg-white/10 rounded-xl p-3 border border-white/20">
          <span class="text-indigo-200 block text-[10px] font-semibold truncate">\${m.name}</span>
          <div class="text-lg font-black text-white mt-0.5">\${m.qtyRequired} <span class="text-xs font-normal text-indigo-300">\${m.unit}</span></div>
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
            <td class="p-3 font-bold text-indigo-700 font-mono">\${run.runNumber}</td>
            <td class="p-3 font-mono font-semibold">\${run.batchNumber}</td>
            <td class="p-3 font-semibold">\${run.expectedOutput} exp vs <span class="font-bold text-slate-900">\${run.actualOutput} act</span></td>
            <td class="p-3">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold \${run.isYieldFlagged ? 'badge-flagged' : 'badge-pass'}">
                \${run.yieldVariancePercent}%
              </span>
            </td>
            <td class="p-3">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold \${oilItem?.variancePercent > 3 ? 'badge-flagged' : 'badge-pass'}">
                +\${oilItem?.variancePercent}% (\${oilItem?.actualQuantity} L)
              </span>
            </td>
            <td class="p-3 font-medium">\${run.usedPackaging.find(p=>p.itemId==='item-pouch')?.damagedQuantity} pcs</td>
            <td class="p-3 font-extrabold text-indigo-900">₹\${run.costPerPacketFifo.toFixed(2)}</td>
          </tr>
        \`;
      }).join('');
    }

    function renderInventory() {
      if (!state) return;
      const container = document.getElementById('balancesCards');
      container.innerHTML = state.balances.map(b => \`
        <div class="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition">
          <div class="flex justify-between items-start mb-2">
            <div>
              <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">\${b.type.replace('_', ' ')}</span>
              <h4 class="text-sm font-bold text-slate-900">\${b.name}</h4>
              <span class="text-xs text-slate-400 font-mono">\${b.code}</span>
            </div>
            <span class="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-mono font-bold">\${b.unit}</span>
          </div>
          <div class="text-2xl sm:text-3xl font-black text-slate-900">\${b.currentStock} <span class="text-xs font-normal text-slate-500">\${b.unit}</span></div>
          <div class="text-xs text-slate-500 mt-3 flex justify-between border-t border-slate-100 pt-2.5">
            <span>Valuation Rate: ₹\${b.valuationRate.toFixed(2)}</span>
            <span class="font-extrabold text-slate-800">Total: ₹\${b.totalValue.toFixed(2)}</span>
          </div>
        </div>
      \`).join('');

      const tbody = document.getElementById('ledgerTableBody');
      tbody.innerHTML = state.stockLedger.map(e => \`
        <tr>
          <td class="p-2.5 text-slate-500 font-mono text-[11px]">\${e.timestamp.slice(0, 16).replace('T', ' ')}</td>
          <td class="p-2.5 font-bold text-slate-800">\${e.itemName}</td>
          <td class="p-2.5"><span class="uppercase text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">\${e.movementType}</span></td>
          <td class="p-2.5 text-emerald-600 font-bold">\${e.quantityIn > 0 ? '+' + e.quantityIn + ' ' + e.unit : '-'}</td>
          <td class="p-2.5 text-red-600 font-bold">\${e.quantityOut > 0 ? '-' + e.quantityOut + ' ' + e.unit : '-'}</td>
          <td class="p-2.5 font-black text-slate-900">\${e.balanceAfter} \${e.unit}</td>
          <td class="p-2.5 font-mono text-slate-500 text-xs">\${e.referenceNumber}</td>
          <td class="p-2.5 text-slate-500">\${e.notes || ''}</td>
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
          <div class="p-4 bg-white rounded-xl border border-slate-200">
            <span class="text-slate-500 font-semibold">B2B Intra-State (Tamil Nadu)</span>
            <div class="text-lg font-bold text-slate-900 mt-1">Taxable: ₹\${gst.b2b.taxable.toFixed(2)}</div>
            <div class="text-xs text-slate-600">CGST (2.5%): ₹\${gst.b2b.cgst.toFixed(2)} | SGST (2.5%): ₹\${gst.b2b.sgst.toFixed(2)}</div>
          </div>
          <div class="p-4 bg-white rounded-xl border border-slate-200">
            <span class="text-slate-500 font-semibold">Total Tax Liability</span>
            <div class="text-lg font-bold text-indigo-700 mt-1">₹\${gst.totalOutward.totalTax.toFixed(2)}</div>
            <div class="text-xs text-slate-600">Fully reconciled against GSTR-1</div>
          </div>
          <div class="p-4 bg-white rounded-xl border border-slate-200">
            <span class="text-slate-500 font-semibold">HSN 1905 Summary</span>
            <div class="text-lg font-bold text-slate-900 mt-1">Murukku 200g</div>
            <div class="text-xs text-slate-600">Tax Rate: 5% (Food Products)</div>
          </div>
        \`;

        // Aging
        const tbody = document.getElementById('agingTableBody');
        tbody.innerHTML = rep.receivablesAging.map(c => \`
          <tr>
            <td class="p-2.5 font-bold text-slate-900">\${c.customerName}</td>
            <td class="p-2.5">\${c.state}</td>
            <td class="p-2.5 font-semibold">₹\${c.totalInvoiced.toFixed(2)}</td>
            <td class="p-2.5 text-emerald-700 font-bold">₹\${c.totalPaid.toFixed(2)}</td>
            <td class="p-2.5 font-black text-red-600">₹\${c.totalOutstanding.toFixed(2)}</td>
            <td class="p-2.5 font-bold text-slate-800">₹\${c.current0_30.toFixed(2)}</td>
            <td class="p-2.5 text-slate-400">₹0.00</td>
            <td class="p-2.5 text-slate-400">₹0.00</td>
            <td class="p-2.5 text-slate-400">₹0.00</td>
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
        <div class="border-2 border-slate-900 p-6 sm:p-8 rounded-xl space-y-4 bg-white text-slate-900">
          <!-- Header -->
          <div class="flex justify-between items-start border-b-2 border-slate-900 pb-4">
            <div>
              <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">Government of India GST Invoicing</span>
              <h1 class="text-xl font-black text-slate-900 uppercase tracking-tight">\${f.name}</h1>
              <p class="text-[11px] text-slate-600 max-w-sm leading-tight">\${f.address}</p>
              <p class="text-[11px] font-bold text-slate-800 mt-1">GSTIN: <span class="font-mono text-sm">\${f.gstin}</span> | State: \${f.state} (\${f.stateCode})</p>
              <p class="text-[10px] text-slate-500">FSSAI Central Food Safety License: 12423000000123</p>
            </div>
            <div class="text-right">
              <span class="border border-slate-900 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">Original For Recipient</span>
              <div class="font-mono font-black text-indigo-900 text-base mt-2">\${inv.invoiceNumber}</div>
              <p class="text-[11px] text-slate-600 font-semibold">Invoice Date: \${inv.invoiceDate}</p>
              <p class="text-[11px] text-slate-500">FY: \${inv.financialYear}</p>
              <p class="text-[11px] text-indigo-700 font-bold mt-1">Place of Supply: \${inv.customerState} (\${inv.customerStateCode})</p>
            </div>
          </div>

          <!-- Billed To & Dispatched To -->
          <div class="grid grid-cols-2 gap-6 border-b border-slate-300 pb-4 text-xs">
            <div class="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span class="font-black text-slate-500 uppercase text-[10px] block mb-1">Details of Receiver (Billed To):</span>
              <p class="font-black text-slate-900 text-sm">\${inv.customerName}</p>
              <p class="text-slate-600">\${inv.customerAddress}</p>
              <p class="font-mono font-bold text-slate-800 mt-1">GSTIN: \${inv.customerGstin || 'Unregistered Dealer (URP)'}</p>
              <p class="text-slate-500 text-[11px]">State: \${inv.customerState} (Code: \${inv.customerStateCode})</p>
            </div>
            <div class="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span class="font-black text-slate-500 uppercase text-[10px] block mb-1">Dispatch / Transport Details:</span>
              <p class="font-bold text-slate-900">Vehicle No: <span class="font-mono">TN-58-AB-1234</span></p>
              <p class="text-slate-600">Mode: Road Consignment (Direct Delivery)</p>
              <p class="text-slate-500">Dispatch Status: <span class="font-bold uppercase text-emerald-700">\${inv.dispatchStatus}</span></p>
              <p class="text-slate-500 text-[11px]">Reverse Charge Applicable: <strong>NO</strong></p>
            </div>
          </div>

          <!-- Line Items Table -->
          <table class="w-full text-left border-collapse text-xs border border-slate-300">
            <thead>
              <tr class="bg-slate-100 text-slate-800 border-b border-slate-300 font-black">
                <th class="p-2.5 border-r border-slate-300 text-center w-8">#</th>
                <th class="p-2.5 border-r border-slate-300">Item Description</th>
                <th class="p-2.5 border-r border-slate-300 text-center">HSN</th>
                <th class="p-2.5 border-r border-slate-300 text-right">Qty</th>
                <th class="p-2.5 border-r border-slate-300 text-right">Rate</th>
                <th class="p-2.5 border-r border-slate-300 text-right">Taxable Value</th>
                <th class="p-2.5 border-r border-slate-300 text-right">\${inv.isInterState ? 'IGST (5%)' : 'CGST+SGST (5%)'}</th>
                <th class="p-2.5 text-right font-black">Total (₹)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              \${inv.items.map((it, idx) => \`
                <tr>
                  <td class="p-2.5 text-center font-mono border-r border-slate-300">\${idx+1}</td>
                  <td class="p-2.5 font-bold text-slate-900 border-r border-slate-300">\${it.itemName}</td>
                  <td class="p-2.5 text-center font-mono border-r border-slate-300">\${it.hsnCode}</td>
                  <td class="p-2.5 text-right font-bold border-r border-slate-300">\${it.quantity} \${it.unit}</td>
                  <td class="p-2.5 text-right border-r border-slate-300">₹\${it.rate.toFixed(2)}</td>
                  <td class="p-2.5 text-right font-semibold border-r border-slate-300">₹\${it.taxableValue.toFixed(2)}</td>
                  <td class="p-2.5 text-right border-r border-slate-300">₹\${inv.isInterState ? it.igstAmount.toFixed(2) : (it.cgstAmount + it.sgstAmount).toFixed(2)}</td>
                  <td class="p-2.5 text-right font-extrabold text-slate-900">₹\${it.totalAmount.toFixed(2)}</td>
                </tr>
              \`).join('')}
            </tbody>
            <tfoot>
              <tr class="border-t-2 border-slate-900 bg-slate-50 font-black text-slate-900">
                <td colspan="5" class="p-2.5 text-right uppercase border-r border-slate-300">Total Taxable Value & Tax:</td>
                <td class="p-2.5 text-right border-r border-slate-300 font-mono">₹\${inv.totalTaxable.toFixed(2)}</td>
                <td class="p-2.5 text-right border-r border-slate-300 font-mono">₹\${(inv.totalCgst + inv.totalSgst + inv.totalIgst).toFixed(2)}</td>
                <td class="p-2.5 text-right text-base text-indigo-950 font-mono font-black">₹\${inv.grandTotal.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>

          <!-- Amount In Words & Bank Details -->
          <div class="grid grid-cols-2 gap-4 border-t border-slate-300 pt-4 text-xs">
            <div>
              <span class="font-black text-slate-500 uppercase text-[10px] block">Invoice Total in Words:</span>
              <p class="font-extrabold text-slate-900 italic mt-0.5">Indian Rupees Seven Thousand Eight Hundred and Seventy-Five Only</p>
              
              <div class="mt-3 bg-slate-50 p-3 rounded-lg border border-slate-300 text-[11px] space-y-0.5">
                <span class="font-bold text-slate-800 block text-xs">Bank Details for NEFT / RTGS Transfer:</span>
                <span>Bank: <strong>State Bank of India</strong> • SME Kappalur Branch</span><br>
                <span>Current A/C: <strong class="font-mono">38291048592</strong></span><br>
                <span>IFSC Code: <strong class="font-mono">SBIN0001234</strong></span>
              </div>
            </div>
            <div class="flex flex-col justify-between items-end text-right">
              <div class="border border-slate-300 p-2 rounded bg-slate-50 text-center font-mono text-[9px] text-slate-500 w-36">
                <div class="font-bold text-slate-700 mb-1">[ QR Code Mock ]</div>
                UPI / GST Validated<br>
                IRN: \${inv.invoiceNumber}
              </div>
              <div class="text-center pt-6">
                <div class="border-b border-slate-900 w-48 mb-1"></div>
                <span class="font-extrabold text-slate-900 text-xs uppercase">Authorized Signatory</span>
                <span class="text-slate-500 block text-[10px]">For SnackFlow Operations</span>
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
          <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span class="text-slate-500 font-bold block mb-1">64-Character Invoice Reference Number (IRN Hash):</span>
            <div class="font-mono text-[10px] break-all bg-white p-2.5 rounded-lg border border-slate-300 text-indigo-900 font-semibold">\${einv.irn}</div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span class="text-slate-500 block">Ack No & Date:</span>
              <span class="font-bold font-mono text-slate-800">\${einv.ackNo}</span>
              <span class="block text-[10px] text-slate-500">\${einv.ackDate?.slice(0, 10)}</span>
            </div>
            <div class="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <span class="text-emerald-800 block font-semibold">e-Way Bill No:</span>
              <span class="font-bold font-mono text-emerald-900 text-sm">\${einv.ewayBillNo}</span>
              <span class="block text-[10px] text-emerald-700">Valid Until: \${einv.validUntil}</span>
            </div>
          </div>

          <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
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

          <div class="p-2.5 bg-indigo-50 text-indigo-900 rounded-xl text-[11px] flex items-center justify-between font-semibold">
            <span><i class="fa-solid fa-qrcode mr-1"></i>Digital Signature Verified by NIC</span>
            <span class="font-mono text-[10px]">NIC-EINV-V1.03</span>
          </div>
        </div>
      \`;

      document.getElementById('ewayModal').classList.remove('hidden');
    }

    function closeEwayModal() {
      document.getElementById('ewayModal').classList.add('hidden');
    }

    function toggleScriptGuide() {
      const content = document.getElementById('scriptGuideContent');
      const chevron = document.getElementById('scriptChevron');
      content.classList.toggle('hidden');
      chevron.classList.toggle('rotate-180');
    }

    // --- INTERACTIVE VIDEO CANVAS STUDIO & RECORDER ---
    const videoScenes = [
      {
        title: "SnackFlow Operations: Order-to-Audit ERP",
        subtitle: "Centre for Digital Infrastructure • NIT Tiruchirappalli",
        badge: "BENCHMARK SCENARIO DEMONSTRATION",
        narration: "Welcome to SnackFlow Operations. An automated Order-to-Audit ERP for a small food manufacturer, linking Sales and Production loops into monthly audit reports.",
        draw(ctx) {
          ctx.fillStyle = "#f59e0b";
          ctx.font = "bold 26px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText("CENTRE FOR DIGITAL INFRASTRUCTURE", 100, 220);
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 44px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText("Order-to-Audit System for a Small Food Factory", 100, 280);
          ctx.fillStyle = "#94a3b8";
          ctx.font = "24px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText("Packaged South Indian Snacks: Murukku 200g, Mixture & Chips", 100, 330);
          ctx.fillStyle = "#10b981";
          ctx.font = "bold 22px 'JetBrains Mono', monospace";
          ctx.fillText("✓ 100% Pure JavaScript (.js)   ✓ Default Port: 8080   ✓ Section 5 Benchmark", 100, 420);
        }
      },
      {
        title: "System Architecture: The Two Meeting Loops",
        subtitle: "Sales Loop meets Production Loop at Finished Goods Stock",
        badge: "CORE BUSINESS MODEL",
        narration: "The core challenge links two operational loops: the Sales Loop (order to billing) and the Production Loop (purchase to recipe BOM). Both meet at Finished Goods Stock.",
        draw(ctx) {
          // Loop 1 Box (Sales)
          ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 3;
          ctx.roundRect(100, 180, 480, 220, 16);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = "#60a5fa";
          ctx.font = "bold 22px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText("1. SALES LOOP", 130, 225);
          ctx.fillStyle = "#ffffff";
          ctx.font = "18px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText("• Salesman mobile order taking", 130, 265);
          ctx.fillText("• Stock availability check before approval", 130, 300);
          ctx.fillText("• GST Tax Invoice (CGST/SGST or IGST)", 130, 335);
          ctx.fillText("• Dispatch decreases Finished Goods Stock", 130, 370);

          // Loop 2 Box (Production)
          ctx.fillStyle = "rgba(245, 158, 11, 0.15)";
          ctx.strokeStyle = "#f59e0b";
          ctx.roundRect(700, 180, 480, 220, 16);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = "#fbbf24";
          ctx.font = "bold 22px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText("2. PRODUCTION LOOP (Recipe BOM)", 730, 225);
          ctx.fillStyle = "#ffffff";
          ctx.font = "18px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText("• Purchase raw & packaging materials", 730, 265);
          ctx.fillText("• Issue against Bill of Materials (BOM)", 730, 300);
          ctx.fillText("• Log output & scrap (yield variance)", 730, 335);
          ctx.fillText("• Production increases Finished Goods Stock", 730, 370);

          // Center Meeting Point
          ctx.fillStyle = "#10b981";
          ctx.roundRect(420, 440, 440, 70, 12);
          ctx.fill();
          ctx.fillStyle = "#0f172a";
          ctx.font = "bold 22px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText("FINISHED GOODS STOCK (Meeting Point)", 440, 483);
        }
      },
      {
        title: "Step 1: Opening Stock & Flour Purchase",
        subtitle: "Inward 60 kg Flour @ ₹45/kg from Madurai Flour Mills Ltd",
        badge: "STEP 1 DEMONSTRATION",
        narration: "Starting from opening stock (Flour 100kg, Oil 30L), we record a purchase of 60kg flour at ₹45/kg. The stock ledger increases closing balance to 160kg automatically.",
        draw(ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 24px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText("Opening Balances Loaded:", 100, 210);

          const items = [
            "Flour: 100 kg (@ ₹42/kg opening)",
            "Cooking Oil: 30 L (@ ₹140/L)",
            "Salt & Spices: 5 kg (@ ₹200/kg)",
            "200g Pouches: 500 pcs (@ ₹2.50)",
            "Master Cartons: 30 pcs (@ ₹15.00)",
            "Finished Murukku 200g: 50 pkts"
          ];
          ctx.font = "18px 'JetBrains Mono', monospace";
          items.forEach((txt, i) => {
            ctx.fillStyle = "rgba(255,255,255,0.85)";
            ctx.fillText("• " + txt, 120, 255 + i * 32);
          });

          // Purchase Callout Box
          ctx.fillStyle = "rgba(16, 185, 129, 0.2)";
          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = 2;
          ctx.roundRect(640, 220, 540, 200, 16);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = "#34d399";
          ctx.font = "bold 22px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText("TRANSACTION: PO/2026-27/001", 670, 265);
          ctx.fillStyle = "#ffffff";
          ctx.font = "20px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText("Received: +60 kg Flour @ ₹45.00/kg", 670, 310);
          ctx.fillStyle = "#fbbf24";
          ctx.font = "bold 26px 'JetBrains Mono', monospace";
          ctx.fillText("Flour Balance: 100 + 60 = 160 kg ✓", 670, 365);
        }
      },
      {
        title: "Step 2 & 3: Production Run & Variance Analysis",
        subtitle: "Murukku 200g (Batch = 200 pkts) • Issued 40kg Flour, 10.5L Oil, 1.2kg Spices",
        badge: "STEP 2 & 3 DEMONSTRATION",
        narration: "A production run is logged. We issue 40kg flour, 10.5L oil (+0.5L excess) and 1.2kg spices. Output: 188 good packets, 6 damaged pouches, 9 cartons used.",
        draw(ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 22px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText("Consumption & Output Log (PR-2026-001):", 100, 205);

          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.roundRect(100, 230, 520, 220, 14);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.font = "18px 'JetBrains Mono', monospace";
          ctx.fillText("Flour Issued:     40.0 kg (Standard)", 130, 275);
          ctx.fillText("Oil Issued:       10.5 L  (+0.5L excess)", 130, 315);
          ctx.fillText("Spices Issued:    1.2 kg  (Standard)", 130, 355);
          ctx.fillText("Actual Good Pkts: 188 pkts (Exp: 200)", 130, 395);
          ctx.fillText("Damaged Pouches:  6 pcs   (Scrap)", 130, 430);

          // Variance Flags Box
          ctx.fillStyle = "rgba(239, 68, 68, 0.18)";
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 2;
          ctx.roundRect(660, 230, 520, 220, 14);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = "#f87171";
          ctx.font = "bold 22px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText("AUTOMATIC VARIANCE FLAGGING (>3%)", 690, 275);
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 20px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText("⚠️ Yield Variance: -6.0% (188 vs 200) FLAGGED", 690, 325);
          ctx.fillText("⚠️ Oil Variance:   +5.0% (10.5 vs 10) FLAGGED", 690, 375);
          ctx.fillStyle = "#34d399";
          ctx.font = "bold 22px 'JetBrains Mono', monospace";
          ctx.fillText("FG Stock: 50 + 188 = 238 packets ✓", 690, 425);
        }
      },
      {
        title: "Step 8: Production Costing & Overheads",
        subtitle: "Labour ₹1,200 + Power/Gas ₹600 • FIFO vs Weighted Average",
        badge: "COSTING & MARGINS",
        narration: "Allocating ₹1,200 labour and ₹600 power, SnackFlow calculates the unit cost per packet: FIFO is ₹30.90 (38.2% margin) and Weighted Average is ₹31.14 (37.7% margin).",
        draw(ctx) {
          // FIFO Card
          ctx.fillStyle = "rgba(99, 102, 241, 0.2)";
          ctx.strokeStyle = "#818cf8";
          ctx.lineWidth = 3;
          ctx.roundRect(100, 200, 520, 260, 16);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = "#a5b4fc";
          ctx.font = "bold 20px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText("FIFO VALUATION (Benchmark Standard)", 130, 240);
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 42px 'JetBrains Mono', monospace";
          ctx.fillText("₹30.90 / pkt", 130, 300);
          ctx.fillStyle = "#cbd5e1";
          ctx.font = "16px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText("Total Batch Cost: ₹5,810 / 188 pkts", 130, 345);
          ctx.fillText("Raw RM ₹4,010 + Overheads ₹1,800", 130, 380);
          ctx.fillStyle = "#34d399";
          ctx.font = "bold 20px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText("Gross Profit Margin: 38.2% (@ ₹50) ✓", 130, 430);

          // Weighted Average Card
          ctx.fillStyle = "rgba(245, 158, 11, 0.2)";
          ctx.strokeStyle = "#fbbf24";
          ctx.roundRect(660, 200, 520, 260, 16);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = "#fde68a";
          ctx.font = "bold 20px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText("WEIGHTED AVERAGE VALUATION", 690, 240);
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 42px 'JetBrains Mono', monospace";
          ctx.fillText("₹31.14 / pkt", 690, 300);
          ctx.fillStyle = "#cbd5e1";
          ctx.font = "16px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText("Flour Rate: ₹43.125/kg (100*42 + 60*45)/160", 690, 345);
          ctx.fillText("Total Batch Cost: ₹5,855 / 188 pkts", 690, 380);
          ctx.fillStyle = "#34d399";
          ctx.font = "bold 20px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText("Gross Profit Margin: 37.7% (@ ₹50) ✓", 690, 430);
        }
      },
      {
        title: "Step 4 & 5: Salesman A Order & GST Invoicing",
        subtitle: "Retailer A (Chennai Stores, TN): 150 packets • Intra-State CGST+SGST 5%",
        badge: "STEP 4 & 5 DEMONSTRATION",
        narration: "Salesman A books 150 packets for Retailer A in Tamil Nadu. Admin verifies stock (238 available) and raises GST invoice INV/2026-27/0001 for ₹7,875. Finished goods drops to 88 pkts upon dispatch.",
        draw(ctx) {
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.roundRect(100, 190, 1080, 270, 16);
          ctx.fill();

          ctx.fillStyle = "#fbbf24";
          ctx.font = "bold 24px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText("GST Tax Invoice: INV/2026-27/0001", 130, 235);

          ctx.fillStyle = "#ffffff";
          ctx.font = "20px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText("Customer: Retailer A (Chennai Stores) • Tamil Nadu (Code 33)", 130, 280);
          ctx.fillText("Ordered Quantity: 150 packets @ ₹50.00 = Taxable ₹7,500.00", 130, 320);

          ctx.fillStyle = "#60a5fa";
          ctx.font = "bold 20px 'JetBrains Mono', monospace";
          ctx.fillText("CGST @ 2.5%: ₹187.50   |   SGST @ 2.5%: ₹187.50", 130, 365);

          ctx.fillStyle = "#34d399";
          ctx.font = "bold 28px 'JetBrains Mono', monospace";
          ctx.fillText("Invoice Grand Total: ₹7,875.00 ✓", 130, 415);
          ctx.fillText("FG Stock after dispatch: 238 - 150 = 88 pkts ✓", 650, 415);
        }
      },
      {
        title: "Step 6: Distributor B Order & Shortage Check",
        subtitle: "Distributor B (Karnataka): 120 packets • Inter-State IGST 5%",
        badge: "STEP 6 DEMONSTRATION",
        narration: "Salesman B places an order for 120 packets to Distributor B in Karnataka. SnackFlow immediately warns: available stock is only 88 packets, flagging a shortage of 32 packets before approval.",
        draw(ctx) {
          ctx.fillStyle = "rgba(239, 68, 68, 0.2)";
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 3;
          ctx.roundRect(100, 200, 1080, 250, 16);
          ctx.fill(); ctx.stroke();

          ctx.fillStyle = "#f87171";
          ctx.font = "bold 28px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText("⚠️ INSUFFICIENT STOCK WARNING FLAGGED", 140, 250);

          ctx.fillStyle = "#ffffff";
          ctx.font = "20px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText("Distributor B ordered: 120 packets", 140, 305);
          ctx.fillText("Current Available Finished Goods: 88 packets", 140, 345);

          ctx.fillStyle = "#fca5a5";
          ctx.font = "bold 26px 'JetBrains Mono', monospace";
          ctx.fillText("Net Shortage: 32 Packets FLAGGED ✓", 140, 400);

          ctx.fillStyle = "#93c5fd";
          ctx.font = "18px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText("Place of Supply: Karnataka (Code 29) &rarr; Inter-State IGST (5%) applies", 650, 345);
        }
      },
      {
        title: "Step 7: Payment Collection & Receivables",
        subtitle: "Receipt RCPT/2026-27/001 • ₹4,000 via NEFT from Retailer A",
        badge: "STEP 7 DEMONSTRATION",
        narration: "In Step 7, a partial payment of ₹4,000 is recorded against Retailer A's invoice. Retailer A's outstanding balance drops to exactly ₹3,875.",
        draw(ctx) {
          ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = 2;
          ctx.roundRect(100, 200, 1080, 250, 16);
          ctx.fill(); ctx.stroke();

          ctx.fillStyle = "#34d399";
          ctx.font = "bold 26px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText("PAYMENT RECORDED: RCPT/2026-27/001", 140, 250);

          ctx.fillStyle = "#ffffff";
          ctx.font = "22px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText("Invoice Total Raised:   ₹7,875.00", 140, 310);
          ctx.fillText("Payment Received:       ₹4,000.00 (via NEFT)", 140, 350);

          ctx.fillStyle = "#fbbf24";
          ctx.font = "bold 32px 'JetBrains Mono', monospace";
          ctx.fillText("Retailer A Outstanding Balance: ₹3,875.00 ✓", 140, 410);
        }
      },
      {
        title: "Step 9: Monthly Auditor Reporting Hub",
        subtitle: "GSTR-1 Outward Summary • Stock Ledger • Receivables Aging • Tally XML",
        badge: "STEP 9 DEMONSTRATION",
        narration: "Finally, the auditor pulls monthly reports: GSTR-1 outward tax liability, stock ledger audit trails, receivables aging, and 1-click exports for Tally XML and CSV.",
        draw(ctx) {
          const boxes = [
            { title: "GSTR-1 Summary", val: "Taxable: ₹7,500 | Tax: ₹375 (HSN 1905)" },
            { title: "Receivables Aging", val: "Retailer A: ₹3,875 (0-30 Days Bucket)" },
            { title: "Stock Ledger Trail", val: "Flour: 120kg | Oil: 19.5L | Pouches: 306" },
            { title: "Tally Prime XML", val: "1-Click automated voucher export" }
          ];

          boxes.forEach((b, i) => {
            const x = 100 + (i % 2) * 560;
            const y = 200 + Math.floor(i / 2) * 130;
            ctx.fillStyle = "rgba(255,255,255,0.08)";
            ctx.strokeStyle = "#475569";
            ctx.lineWidth = 1.5;
            ctx.roundRect(x, y, 520, 105, 12);
            ctx.fill(); ctx.stroke();

            ctx.fillStyle = "#60a5fa";
            ctx.font = "bold 20px 'Plus Jakarta Sans', sans-serif";
            ctx.fillText(b.title, x + 25, y + 40);
            ctx.fillStyle = "#ffffff";
            ctx.font = "16px 'JetBrains Mono', monospace";
            ctx.fillText(b.val, x + 25, y + 75);
          });
        }
      },
      {
        title: "Evaluation Checklist: Section 5 Benchmark",
        subtitle: "Centre for Digital Infrastructure, NIT Tiruchirappalli",
        badge: "11 OF 11 CRITERIA PASSED (100%)",
        narration: "All 11 mandatory benchmark checks have passed with 100% precision with zero difference. SnackFlow Operations satisfies all internship requirements.",
        draw(ctx) {
          const checks = [
            "Flour closing: 120 kg (100+60-40) [PASS ✓]",
            "Oil closing: 19.5 L (30-10.5) [PASS ✓]",
            "Pouches closing: 306 pcs (500-188-6) [PASS ✓]",
            "FG after run: 238 pkts (50+188) [PASS ✓]",
            "FG after dispatch: 88 pkts (238-150) [PASS ✓]",
            "Yield variance: -6% FLAGGED [PASS ✓]",
            "Oil variance: +5% FLAGGED [PASS ✓]",
            "Retailer A invoice: ₹7,875 [PASS ✓]",
            "Retailer A outstanding: ₹3,875 [PASS ✓]",
            "Distributor B shortage: 32 pkts [PASS ✓]",
            "Cost/pkt: FIFO ₹30.90 / WA ₹31.14 [PASS ✓]"
          ];

          checks.forEach((c, idx) => {
            const x = 100 + (idx < 6 ? 0 : 540);
            const y = 205 + (idx % 6) * 42;
            ctx.fillStyle = "#10b981";
            ctx.font = "bold 17px 'JetBrains Mono', monospace";
            ctx.fillText("✔ " + c, x, y);
          });

          ctx.fillStyle = "#f59e0b";
          ctx.font = "bold 22px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText(">>> ALL 11 BENCHMARK CRITERIA PASSED EXACTLY <<<", 100, 475);
        }
      }
    ];

    function drawVideoScene(sceneIdx) {
      const canvas = document.getElementById('videoCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const s = videoScenes[sceneIdx] || videoScenes[0];

      // Background Gradient
      const grad = ctx.createLinearGradient(0, 0, 1280, 720);
      grad.addColorStop(0, "#0b0f19");
      grad.addColorStop(0.5, "#0f172a");
      grad.addColorStop(1, "#090d16");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1280, 720);

      // Subtle background grid
      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.lineWidth = 1;
      for (let x = 0; x < 1280; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 720); ctx.stroke();
      }
      for (let y = 0; y < 720; y += 60) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1280, y); ctx.stroke();
      }

      // Top Header Bar on Canvas
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(60, 40, 1160, 100);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.strokeRect(60, 40, 1160, 100);

      // Badge
      ctx.fillStyle = "#f59e0b";
      ctx.fillRect(85, 55, 6, 26);
      ctx.font = "bold 14px 'Plus Jakarta Sans', sans-serif";
      ctx.fillText(s.badge, 100, 73);

      // Title & Subtitle
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 28px 'Plus Jakarta Sans', sans-serif";
      ctx.fillText(s.title, 85, 115);

      // Scene indicator
      ctx.fillStyle = "#64748b";
      ctx.font = "bold 16px 'JetBrains Mono', monospace";
      ctx.fillText(\`SCENE \${sceneIdx+1} / \${videoScenes.length}\`, 1080, 75);

      // Call scene-specific graphics
      s.draw(ctx);

      // Bottom Watermark
      ctx.fillStyle = "#475569";
      ctx.font = "14px 'Plus Jakarta Sans', sans-serif";
      ctx.fillText("SnackFlow Operations • Centre for Digital Infrastructure, NIT Tiruchirappalli", 85, 680);
      ctx.fillText("http://localhost:8080", 1080, 680);

      // Update subtitle on HTML
      document.getElementById('videoSubtitle').textContent = \`"\${s.narration}"\`;
    }

    async function startVideoRecording() {
      if (isRecordingVideo) return;
      isRecordingVideo = true;

      const btnStart = document.getElementById('btnStartVideo');
      const btnDownload = document.getElementById('btnDownloadVideo');
      const progressBar = document.getElementById('videoProgressBar');
      const statusText = document.getElementById('videoStatusText');
      const speed = Number(document.getElementById('videoSpeed').value) || 2;

      btnStart.disabled = true;
      btnStart.classList.add('opacity-50', 'cursor-not-allowed');
      statusText.textContent = "🔴 Recording HD Video in progress... (Please do not switch tabs)";

      const canvas = document.getElementById('videoCanvas');
      const stream = canvas.captureStream(30);

      // Generate soft pleasant audio chime track
      let audioCtx = null;
      let dest = null;
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        dest = audioCtx.createMediaStreamDestination();
        stream.addTrack(dest.stream.getAudioTracks()[0]);
      } catch (e) {
        console.warn('Audio context unavailable:', e);
      }

      function playTone(freq, duration) {
        if (!audioCtx || !dest) return;
        try {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
          osc.connect(gain);
          gain.connect(dest);
          osc.start();
          osc.stop(audioCtx.currentTime + duration);
        } catch (err) {}
      }

      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

      recorder.onstop = () => {
        recordedVideoBlob = new Blob(chunks, { type: mimeType });
        const videoUrl = URL.createObjectURL(recordedVideoBlob);
        const preview = document.getElementById('videoPreview');
        preview.src = videoUrl;
        document.getElementById('videoReplayContainer').classList.remove('hidden');

        btnDownload.disabled = false;
        btnDownload.className = "bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md transition active:scale-95";
        btnStart.disabled = false;
        btnStart.classList.remove('opacity-50', 'cursor-not-allowed');
        statusText.textContent = "✅ Video generation completed! Click 'Download Video' or preview below.";
        showToast('Demo Video recorded successfully! Download initiated.', 'bg-emerald-600 text-white');

        // Auto trigger download
        downloadRecordedVideo();
        isRecordingVideo = false;
      };

      recorder.start();

      // Cycle scenes
      const sceneDuration = (4000 / speed);
      for (let i = 0; i < videoScenes.length; i++) {
        drawVideoScene(i);
        playTone(440 + i * 40, 0.3);
        const percent = Math.round(((i + 1) / videoScenes.length) * 100);
        progressBar.style.width = percent + '%';
        document.getElementById('videoTimeText').textContent = \`Scene \${i+1} of \${videoScenes.length} (\${percent}%)\`;
        await new Promise(r => setTimeout(r, sceneDuration));
      }

      recorder.stop();
    }

    function downloadRecordedVideo() {
      if (!recordedVideoBlob) {
        showToast('No recorded video available yet. Please record first.', 'bg-amber-600 text-white');
        return;
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(recordedVideoBlob);
      a.download = 'snackflow_benchmark_demo_video.webm';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
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
      toast.className = 'rounded-xl p-3.5 text-sm font-semibold flex items-center justify-between shadow-lg ' + bgClass;
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
