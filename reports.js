// public/js/reports.js
// Cleaned reporting logic. Depends on window.fetchJson and window.safeNumber if available.
// Will not fail if Chart.js is not loaded; it will just skip chart creation.

(function () {
  'use strict';

  // Fallbacks (in case utils.js wasn't loaded)
  if (typeof window.API_ROOT === 'undefined') {
    const DEFAULT_LOCAL_PORT = 3000;
    const BASE = (location.protocol.startsWith('http') && location.hostname === 'localhost' && location.port)
      ? `${location.protocol}//${location.hostname}:${location.port}`
      : `http://localhost:${DEFAULT_LOCAL_PORT}`;
    window.API_ROOT = BASE + '/api';
  }

  if (typeof window.safeNumber !== 'function') {
    window.safeNumber = function (v) {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
  }

  if (typeof window.fetchJson !== 'function') {
    window.fetchJson = async function (pathOrUrl, opts) {
      const url = (/^https?:\/\//i.test(pathOrUrl))
        ? pathOrUrl
        : (pathOrUrl.startsWith('/') ? (window.API_ROOT + pathOrUrl) : (window.API_ROOT + '/' + pathOrUrl.replace(/^\/+/, '')));
      const res = await fetch(url, opts);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('Fetch error', url, res.status, text);
        throw new Error(`Fetch ${url} failed: ${res.status}`);
      }
      return res.json();
    };
  }

  const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const MAX_CATEGORY_SLICES = 10;

  document.addEventListener('DOMContentLoaded', () => {
    const salesEl = document.getElementById('salesChart');
    const expensesEl = document.getElementById('expensesChart');
    const inventoryEl = document.getElementById('inventoryChart');

    // If none present, nothing to render (but still fetch summaries)
    if (!salesEl && !expensesEl && !inventoryEl) {
      // still compute and expose summary
      loadReports().catch(err => console.error('Report load error', err));
      return;
    }

    let salesChart = null;
    let expensesChart = null;
    let inventoryChart = null;

    // create lightweight placeholders if Chart.js is present
    if (typeof Chart !== 'undefined') {
      if (salesEl) {
        salesChart = new Chart(salesEl.getContext('2d'), {
          type: 'line',
          data: { labels: MONTH_LABELS, datasets: [{ label: 'Sales (Ksh)', data: MONTH_LABELS.map(() => 0), tension: 0.3, fill: true }] },
          options: { responsive: true, scales: { y: { ticks: { callback: v => 'Ksh ' + Number(v).toLocaleString() } } } }
        });
      }

      if (expensesEl) {
        expensesChart = new Chart(expensesEl.getContext('2d'), {
          type: 'doughnut',
          data: { labels: ['Loading'], datasets: [{ data: [1] }] },
          options: { responsive: true }
        });
      }

      if (inventoryEl) {
        inventoryChart = new Chart(inventoryEl.getContext('2d'), {
          type: 'doughnut',
          data: { labels: ['In Stock','Sold','Damaged'], datasets: [{ data: [1, 1, 1] }] },
          options: { responsive: true }
        });
      }
    } else {
      console.warn('Browser code response - Chart.js not found — charts will not be rendered. Include Chart.js to enable charts.');
    }

    async function loadReports() {
      try {
        const [salesRaw, expensesRaw, inventoryRaw] = await Promise.all([
          window.fetchJson('/sales'),
          window.fetchJson('/expenses'),
          window.fetchJson('/inventory')
        ]);

        // --- Sales by month ---
        if (salesChart) {
          const byMonth = new Array(12).fill(0);
          salesRaw.forEach(sale => {
            const dateStr = sale.date_of_sale ?? sale.date ?? sale.saleDate ?? null;
            if (!dateStr) return;
            const d = new Date(dateStr);
            if (isNaN(d)) return;
            const m = d.getMonth();
            const amt = window.safeNumber(sale.total_amount ?? sale.total ?? ((sale.quantity_sold ?? sale.quantity ?? 0) * window.safeNumber(sale.unit_price ?? sale.price ?? 0)));
            byMonth[m] += amt;
          });
          salesChart.data.datasets[0].data = byMonth;
          salesChart.update();
        }

        // --- Expenses by category ---
        if (expensesChart) {
          const map = new Map();
          for (const r of expensesRaw) {
            const key = r.expense_name ?? r.category ?? r.type ?? 'Uncategorized';
            map.set(key, (map.get(key) || 0) + window.safeNumber(r.amount ?? r.value ?? 0));
          }
          let grouped = Array.from(map.entries()).map(([label, value]) => ({ label, value }));
          grouped.sort((a,b) => b.value - a.value);
          let labels = grouped.map(g => g.label);
          let values = grouped.map(g => g.value);
          if (labels.length > MAX_CATEGORY_SLICES) {
            const top = grouped.slice(0, MAX_CATEGORY_SLICES);
            const rest = grouped.slice(MAX_CATEGORY_SLICES);
            const otherSum = rest.reduce((s, r) => s + r.value, 0);
            labels = top.map(t => t.label).concat(['Other']);
            values = top.map(t => t.value).concat([otherSum]);
          }
          expensesChart.data.labels = labels;
          expensesChart.data.datasets = [{ label: 'Expenses (Ksh)', data: values }];
          expensesChart.update();
        }

        // --- Inventory overview ---
        if (inventoryChart) {
          let inStock = 0, damaged = 0;
          inventoryRaw.forEach(it => {
            inStock += window.safeNumber(it.quantity ?? it.incoming ?? 0);
            damaged += window.safeNumber(it.damaged ?? 0);
          });
          let sold = salesRaw.reduce((s, sale) => s + window.safeNumber(sale.quantity_sold ?? sale.quantity ?? 0), 0);
          inventoryChart.data.datasets[0].data = [inStock, sold, damaged];
          inventoryChart.update();
        }

        // --- Summary DOM updates (if your page has these elements) ---
        const totalRevenue = salesRaw.reduce((s, sale) => s + window.safeNumber(sale.total_amount ?? sale.total ?? 0), 0);
        const totalCost = inventoryRaw.reduce((s, it) => s + window.safeNumber(it.cost_price ?? it.unit_cost ?? 0) * window.safeNumber(it.quantity ?? it.incoming ?? 0), 0);
        const profitLoss = totalRevenue - totalCost;

        const setIf = (id, val, fmt = v => v) => {
          const el = document.getElementById(id);
          if (el) el.textContent = fmt(val);
        };

        setIf('weeklyTarget', inventoryRaw.reduce((s, it) => s + window.safeNumber(it.weekly_stock_target ?? it.weeklyTarget ?? 0), 0));
        setIf('monthlyTarget', inventoryRaw.reduce((s, it) => s + window.safeNumber(it.monthly_stock_target ?? it.monthlyTarget ?? 0), 0));
        setIf('profitLoss', profitLoss, v => Number(v).toLocaleString());

      } catch (err) {
        console.error('Error loading reports:', err);
      }
    }

    // Initial run
    loadReports().catch(err => console.error(err));

    // Expose for manual refresh by other scripts
    window.reloadReports = loadReports;
  });
})();
